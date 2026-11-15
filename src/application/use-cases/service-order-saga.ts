import { Injectable, Logger } from '@nestjs/common';
import { Customer } from '../../domain/entities/customer';
import { Saga, SagaStep } from '../../domain/entities/saga';
import { ServiceOrder } from '../../domain/entities/service-order';
import { Vehicle } from '../../domain/entities/vehicle';
import { DomainError, NotFoundError } from '../../domain/errors';
import { Commands, Events, SagaReply } from '../messaging-contracts';
import { BusinessMetrics, MessagePublisher } from '../ports/gateways';
import {
  CustomerRepository,
  PartRepository,
  SagaRepository,
  ServiceOrderRepository,
} from '../ports/repositories';
import { StatusChangeAnnouncer } from './status-change-announcer';

interface SagaContext {
  order: ServiceOrder;
  saga: Saga;
  reason: string;
  reply: SagaReply;
}

interface Transition {
  from: SagaStep[];
  apply: (context: SagaContext) => Promise<void>;
}

interface CompensationScope {
  cancelWorkOrder?: boolean;
  cancelBudget?: boolean;
}

@Injectable()
export class ServiceOrderSaga {
  private readonly logger = new Logger(ServiceOrderSaga.name);

  private readonly transitions: Record<string, Transition> = {
    [Events.WORK_ORDER_OPENED]: {
      from: [SagaStep.OPEN_WORK_ORDER],
      apply: async ({ saga }) => saga.advanceTo(SagaStep.AWAIT_DIAGNOSIS),
    },
    [Events.WORK_ORDER_OPEN_FAILED]: {
      from: [SagaStep.OPEN_WORK_ORDER],
      apply: (context) => this.compensate(context, {}),
    },
    [Events.DIAGNOSIS_STARTED]: {
      from: [SagaStep.AWAIT_DIAGNOSIS],
      apply: ({ order }) => this.changeStatus(order, () => order.startDiagnosis()),
    },
    [Events.DIAGNOSIS_COMPLETED]: {
      from: [SagaStep.AWAIT_DIAGNOSIS],
      apply: (context) => this.requestBudget(context),
    },
    [Events.BUDGET_GENERATED]: {
      from: [SagaStep.GENERATE_BUDGET],
      apply: async ({ order, saga }) => {
        await this.changeStatus(order, () => order.awaitApproval());
        saga.advanceTo(SagaStep.AWAIT_APPROVAL);
      },
    },
    [Events.BUDGET_GENERATION_FAILED]: {
      from: [SagaStep.GENERATE_BUDGET],
      apply: (context) => this.compensate(context, { cancelWorkOrder: true }),
    },
    [Events.BUDGET_APPROVED]: {
      from: [SagaStep.AWAIT_APPROVAL],
      apply: async ({ order, saga, reply }) => {
        if (reply.checkoutUrl) order.registerPaymentUrl(reply.checkoutUrl);
        await this.orders.save(order);
        saga.advanceTo(SagaStep.AWAIT_PAYMENT);
      },
    },
    [Events.BUDGET_REJECTED]: {
      from: [SagaStep.AWAIT_APPROVAL],
      apply: (context) => this.compensate(context, { cancelWorkOrder: true }),
    },
    [Events.PAYMENT_CONFIRMED]: {
      from: [SagaStep.AWAIT_PAYMENT],
      apply: async ({ order, saga }) => {
        await this.publisher.publish(Commands.ENQUEUE_REPAIR, { orderId: order.id });
        saga.advanceTo(SagaStep.ENQUEUE_REPAIR);
      },
    },
    [Events.PAYMENT_FAILED]: {
      from: [SagaStep.AWAIT_PAYMENT],
      apply: (context) => this.compensate(context, { cancelWorkOrder: true }),
    },
    [Events.REPAIR_QUEUED]: {
      from: [SagaStep.ENQUEUE_REPAIR],
      apply: async ({ saga }) => saga.advanceTo(SagaStep.AWAIT_REPAIR),
    },
    [Events.REPAIR_STARTED]: {
      from: [SagaStep.AWAIT_REPAIR],
      apply: ({ order }) => this.changeStatus(order, () => order.startExecution()),
    },
    [Events.REPAIR_COMPLETED]: {
      from: [SagaStep.AWAIT_REPAIR],
      apply: async ({ order, saga }) => {
        await this.changeStatus(order, () => order.finish());
        saga.complete();
      },
    },
    [Events.REPAIR_FAILED]: {
      from: [SagaStep.ENQUEUE_REPAIR, SagaStep.AWAIT_REPAIR],
      apply: (context) => this.compensate(context, { cancelBudget: true }),
    },
    [Events.BUDGET_CANCELLED]: {
      from: [SagaStep.COMPENSATE_BILLING],
      apply: async ({ saga }) => saga.markCompensated(),
    },
    [Events.PAYMENT_REFUNDED]: {
      from: [SagaStep.COMPENSATE_BILLING],
      apply: async ({ saga }) => saga.markCompensated(),
    },
  };

  constructor(
    private readonly orders: ServiceOrderRepository,
    private readonly sagas: SagaRepository,
    private readonly parts: PartRepository,
    private readonly customers: CustomerRepository,
    private readonly publisher: MessagePublisher,
    private readonly announcer: StatusChangeAnnouncer,
    private readonly metrics: BusinessMetrics,
  ) {}

  async start(order: ServiceOrder, customer: Customer, vehicle: Vehicle): Promise<void> {
    const saga = Saga.start(order.id);
    saga.record('saga-started');
    await this.sagas.save(saga);
    await this.publisher.publish(Commands.OPEN_WORK_ORDER, {
      orderId: order.id,
      customerName: customer.name,
      vehicle: { plate: vehicle.plate.value, brand: vehicle.brand, model: vehicle.model },
      items: order.items.map(({ type, name, quantity }) => ({ type, name, quantity })),
    });
  }

  async handle(event: string, reply: SagaReply): Promise<void> {
    const transition = this.transitions[event];
    if (!transition) return;

    const [order, saga] = await Promise.all([
      this.orders.findById(reply.orderId),
      this.sagas.findByOrderId(reply.orderId),
    ]);
    if (!order || !saga) {
      this.logger.warn({ msg: 'Saga reply for unknown service order', event, orderId: reply.orderId });
      return;
    }
    if (!saga.isAt(transition.from)) {
      this.logger.warn({
        msg: 'Saga reply ignored: unexpected step',
        event,
        orderId: order.id,
        step: saga.step,
      });
      return;
    }

    const reason = reply.reason ?? `Compensation triggered by ${event}`;
    await transition.apply({ order, saga, reason, reply });
    saga.record(event);
    await this.sagas.save(saga);
  }

  async cancel(orderId: string, reason: string): Promise<ServiceOrder> {
    const [order, saga] = await Promise.all([
      this.orders.findById(orderId),
      this.sagas.findByOrderId(orderId),
    ]);
    if (!order || !saga) throw new NotFoundError('Service order not found');
    if (!saga.isRunning) throw new DomainError('Service order can no longer be cancelled');

    await this.compensate(
      { order, saga, reason, reply: { orderId } },
      { cancelWorkOrder: true, cancelBudget: saga.hasBudget },
    );
    saga.record('cancelled-by-admin');
    await this.sagas.save(saga);
    return order;
  }

  private async requestBudget({ order, saga }: SagaContext): Promise<void> {
    const customer = await this.customers.findById(order.customerId);
    await this.publisher.publish(Commands.GENERATE_BUDGET, {
      orderId: order.id,
      customer: { id: order.customerId, name: customer?.name, email: customer?.email },
      items: order.items.map(({ type, name, unitPrice, quantity }) => ({
        type,
        name,
        unitPrice,
        quantity,
      })),
      totalAmount: order.totalAmount,
    });
    saga.advanceTo(SagaStep.GENERATE_BUDGET);
  }

  private async compensate(
    { order, saga, reason }: SagaContext,
    scope: CompensationScope,
  ): Promise<void> {
    await this.changeStatus(order, () => order.cancel(reason));
    await Promise.all(order.parts.map((part) => this.parts.release(part.referenceId, part.quantity)));
    this.metrics.sagaCompensated(order.id, reason);

    if (scope.cancelWorkOrder) {
      await this.publisher.publish(Commands.CANCEL_WORK_ORDER, { orderId: order.id, reason });
    }
    if (scope.cancelBudget) {
      await this.publisher.publish(Commands.CANCEL_BUDGET, { orderId: order.id, reason });
      saga.awaitBillingCompensation();
      return;
    }
    saga.markCompensated();
  }

  private async changeStatus(order: ServiceOrder, change: () => void): Promise<void> {
    change();
    await this.orders.save(order);
    await this.announcer.announce(order);
  }
}
