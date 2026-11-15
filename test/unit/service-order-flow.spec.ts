import { Commands, Events } from '../../src/application/messaging-contracts';
import { SagaStatus, SagaStep } from '../../src/domain/entities/saga';
import { ServiceOrderStatus } from '../../src/domain/entities/service-order';
import { ConflictError, DomainError, IntegrationError, NotFoundError } from '../../src/domain/errors';
import { buildWorkshop, VALID_CNPJ, VALID_CPF, Workshop } from '../support/workshop';

const INITIAL_STOCK = 10;
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

describe('Service order flow', () => {
  let workshop: Workshop;

  const reply = (orderId: string, ...events: string[]) =>
    events.reduce(
      (previous, event) => previous.then(() => workshop.saga.handle(event, { orderId })),
      Promise.resolve(),
    );

  const untilPayment = [
    Events.WORK_ORDER_OPENED,
    Events.DIAGNOSIS_STARTED,
    Events.DIAGNOSIS_COMPLETED,
    Events.BUDGET_GENERATED,
    Events.BUDGET_APPROVED,
  ];

  const stock = () => workshop.oilFilter.stockQuantity;
  const sagaOf = (orderId: string) => workshop.sagas.items.get(orderId)!;

  beforeEach(() => {
    workshop = buildWorkshop();
  });

  describe('opening', () => {
    it('registers customer and vehicle, reserves stock and starts the saga', async () => {
      const order = await workshop.openDefaultOrder();

      expect(order.status).toBe(ServiceOrderStatus.RECEIVED);
      expect(order.totalAmount).toBe(211);
      expect(stock()).toBe(INITIAL_STOCK - 2);
      expect(workshop.customers.items.size).toBe(1);
      expect(workshop.vehicles.items.size).toBe(1);
      expect(workshop.publisher.routingKeys()).toEqual([Commands.OPEN_WORK_ORDER]);
      expect(workshop.notifier.notifications[0]).toMatchObject({
        to: 'maria@example.com',
        status: ServiceOrderStatus.RECEIVED,
      });
    });

    it('reuses an existing customer and vehicle', async () => {
      await workshop.openDefaultOrder();
      await workshop.openServiceOrder.execute({
        customer: { document: VALID_CPF },
        vehicle: { plate: 'ABC1D23' },
        services: [{ serviceId: workshop.oilChange.id, quantity: 2 }],
      });
      expect(workshop.customers.items.size).toBe(1);
      expect(workshop.vehicles.items.size).toBe(1);
      expect(workshop.orders.items.size).toBe(2);
    });

    it('rejects insufficient stock without keeping reservations', async () => {
      await expect(workshop.openDefaultOrder(INITIAL_STOCK + 1)).rejects.toThrow('Insufficient stock');
      expect(stock()).toBe(INITIAL_STOCK);
      expect(workshop.orders.items.size).toBe(0);
    });

    it('rejects unknown services and parts', async () => {
      const base = {
        customer: { document: VALID_CPF, name: 'Maria', email: 'maria@example.com' },
        vehicle: { plate: 'ABC1D23', brand: 'Fiat', model: 'Argo', year: 2022 },
      };
      await expect(
        workshop.openServiceOrder.execute({ ...base, services: [{ serviceId: UNKNOWN_ID }] }),
      ).rejects.toThrow(NotFoundError);
      await expect(
        workshop.openServiceOrder.execute({
          ...base,
          services: [{ serviceId: workshop.oilChange.id }],
          parts: [{ partId: UNKNOWN_ID, quantity: 1 }],
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it('rejects a vehicle owned by another customer and inactive customers', async () => {
      await workshop.openDefaultOrder();
      const input = {
        customer: { document: VALID_CNPJ, name: 'Frota Ltda', email: 'frota@example.com' },
        vehicle: { plate: 'ABC1D23' },
        services: [{ serviceId: workshop.oilChange.id }],
      };
      await expect(workshop.openServiceOrder.execute(input)).rejects.toThrow(ConflictError);

      (await workshop.customers.findByDocument(VALID_CPF))!.deactivate();
      await expect(workshop.openDefaultOrder()).rejects.toThrow('Customer is inactive');
    });

    it('requires registration data for new customers and vehicles', async () => {
      await expect(
        workshop.openServiceOrder.execute({
          customer: { document: VALID_CPF },
          vehicle: { plate: 'ABC1D23' },
          services: [{ serviceId: workshop.oilChange.id }],
        }),
      ).rejects.toThrow(DomainError);
      await expect(
        workshop.openServiceOrder.execute({
          customer: { document: VALID_CPF, name: 'Maria', email: 'maria@example.com' },
          vehicle: { plate: 'ABC1D23' },
          services: [{ serviceId: workshop.oilChange.id }],
        }),
      ).rejects.toThrow(DomainError);
    });

    it('cancels the order and releases stock when the saga cannot start', async () => {
      workshop.publisher.failure = new Error('broker unavailable');
      await expect(workshop.openDefaultOrder()).rejects.toThrow(IntegrationError);

      const [order] = [...workshop.orders.items.values()];
      expect(order.status).toBe(ServiceOrderStatus.CANCELLED);
      expect(stock()).toBe(INITIAL_STOCK);
    });
  });

  describe('saga', () => {
    it('drives the order through every status until finished and delivered', async () => {
      const order = await workshop.openDefaultOrder();

      await reply(order.id, Events.WORK_ORDER_OPENED, Events.DIAGNOSIS_STARTED);
      expect(order.status).toBe(ServiceOrderStatus.IN_DIAGNOSIS);

      await reply(order.id, Events.DIAGNOSIS_COMPLETED, Events.BUDGET_GENERATED);
      expect(order.status).toBe(ServiceOrderStatus.AWAITING_APPROVAL);

      await workshop.saga.handle(Events.BUDGET_APPROVED, {
        orderId: order.id,
        checkoutUrl: 'https://pay.example/checkout',
      });
      expect(order.paymentUrl).toBe('https://pay.example/checkout');

      await reply(order.id, Events.PAYMENT_CONFIRMED, Events.REPAIR_QUEUED, Events.REPAIR_STARTED);
      expect(order.status).toBe(ServiceOrderStatus.IN_EXECUTION);

      await reply(order.id, Events.REPAIR_COMPLETED);
      expect(order.status).toBe(ServiceOrderStatus.FINISHED);
      expect(sagaOf(order.id)).toMatchObject({ step: SagaStep.DONE, status: SagaStatus.COMPLETED });

      await workshop.deliverServiceOrder.execute(order.id);
      expect(order.status).toBe(ServiceOrderStatus.DELIVERED);

      expect(workshop.publisher.routingKeys()).toEqual([
        Commands.OPEN_WORK_ORDER,
        Commands.GENERATE_BUDGET,
        Commands.ENQUEUE_REPAIR,
      ]);
      expect(workshop.publisher.messages[1].payload).toMatchObject({
        totalAmount: 211,
        customer: { email: 'maria@example.com' },
      });
      expect(stock()).toBe(INITIAL_STOCK - 2);
      expect(workshop.metrics.statusChanges).toHaveLength(6);
    });

    it.each([
      ['work order cannot be opened', [Events.WORK_ORDER_OPEN_FAILED], []],
      [
        'budget generation fails',
        [Events.WORK_ORDER_OPENED, Events.DIAGNOSIS_STARTED, Events.DIAGNOSIS_COMPLETED, Events.BUDGET_GENERATION_FAILED],
        [Commands.CANCEL_WORK_ORDER],
      ],
      [
        'customer rejects the budget',
        [...untilPayment.slice(0, 4), Events.BUDGET_REJECTED],
        [Commands.CANCEL_WORK_ORDER],
      ],
      ['payment fails', [...untilPayment, Events.PAYMENT_FAILED], [Commands.CANCEL_WORK_ORDER]],
    ])('compensates when %s', async (_, events, compensationCommands) => {
      const order = await workshop.openDefaultOrder();
      await reply(order.id, ...events);

      expect(order.status).toBe(ServiceOrderStatus.CANCELLED);
      expect(stock()).toBe(INITIAL_STOCK);
      expect(sagaOf(order.id).status).toBe(SagaStatus.COMPENSATED);
      expect(workshop.publisher.routingKeys()).toEqual(
        expect.arrayContaining(compensationCommands),
      );
      expect(workshop.metrics.compensations).toHaveLength(1);
    });

    it('refunds the payment when the repair fails', async () => {
      const order = await workshop.openDefaultOrder();
      await reply(order.id, ...untilPayment, Events.PAYMENT_CONFIRMED, Events.REPAIR_QUEUED);
      await workshop.saga.handle(Events.REPAIR_FAILED, { orderId: order.id, reason: 'Peça defeituosa' });

      expect(order.status).toBe(ServiceOrderStatus.CANCELLED);
      expect(order.cancellationReason).toBe('Peça defeituosa');
      expect(stock()).toBe(INITIAL_STOCK);
      expect(workshop.publisher.routingKeys()).toContain(Commands.CANCEL_BUDGET);
      expect(sagaOf(order.id).status).toBe(SagaStatus.COMPENSATING);

      await reply(order.id, Events.PAYMENT_REFUNDED);
      expect(sagaOf(order.id).status).toBe(SagaStatus.COMPENSATED);
    });

    it('ignores unknown events, unknown orders and out-of-order replies', async () => {
      const order = await workshop.openDefaultOrder();
      await workshop.saga.handle('unknown.event', { orderId: order.id });
      await workshop.saga.handle(Events.WORK_ORDER_OPENED, { orderId: UNKNOWN_ID });
      await reply(order.id, Events.REPAIR_COMPLETED);

      expect(order.status).toBe(ServiceOrderStatus.RECEIVED);
      expect(sagaOf(order.id).step).toBe(SagaStep.OPEN_WORK_ORDER);
    });

    it('cancels on admin request compensating billing only when a budget exists', async () => {
      const early = await workshop.openDefaultOrder();
      await workshop.saga.cancel(early.id, 'Cliente desistiu');
      expect(sagaOf(early.id).status).toBe(SagaStatus.COMPENSATED);
      expect(workshop.publisher.routingKeys()).not.toContain(Commands.CANCEL_BUDGET);

      const late = await workshop.openServiceOrder.execute({
        customer: { document: VALID_CPF },
        vehicle: { plate: 'ABC1D23' },
        services: [{ serviceId: workshop.oilChange.id }],
      });
      await reply(late.id, ...untilPayment);
      await workshop.saga.cancel(late.id, 'Cliente desistiu');
      expect(sagaOf(late.id).status).toBe(SagaStatus.COMPENSATING);
      await reply(late.id, Events.BUDGET_CANCELLED);
      expect(sagaOf(late.id).status).toBe(SagaStatus.COMPENSATED);

      await expect(workshop.saga.cancel(late.id, 'again')).rejects.toThrow(DomainError);
      await expect(workshop.saga.cancel(UNKNOWN_ID, 'x')).rejects.toThrow(NotFoundError);
    });
  });

  describe('queries', () => {
    it('lists active orders by status priority and then oldest first', async () => {
      const received = await workshop.openDefaultOrder(1);
      const inExecution = await workshop.openDefaultOrder(1);
      const awaitingApproval = await workshop.openDefaultOrder(1);
      const finished = await workshop.openDefaultOrder(1);
      const olderReceived = await workshop.openDefaultOrder(1);
      (olderReceived as any).props.createdAt = new Date(received.createdAt.getTime() - 60_000);

      await reply(awaitingApproval.id, ...untilPayment.slice(0, 4));
      const untilRepair = [...untilPayment, Events.PAYMENT_CONFIRMED, Events.REPAIR_QUEUED, Events.REPAIR_STARTED];
      await reply(inExecution.id, ...untilRepair);
      await reply(finished.id, ...untilRepair, Events.REPAIR_COMPLETED);

      const listed = await workshop.queries.listActive();
      expect(listed.map((order) => order.id)).toEqual([
        inExecution.id,
        awaitingApproval.id,
        olderReceived.id,
        received.id,
      ]);
    });

    it('restricts customers to their own orders', async () => {
      const order = await workshop.openDefaultOrder();
      const admin = { sub: 'admin', role: 'ADMIN' as const };
      const owner = { sub: order.customerId, role: 'CUSTOMER' as const };
      const stranger = { sub: UNKNOWN_ID, role: 'CUSTOMER' as const };

      await expect(workshop.queries.findById(order.id, admin)).resolves.toBe(order);
      await expect(workshop.queries.findById(order.id, owner)).resolves.toBe(order);
      await expect(workshop.queries.findById(order.id, stranger)).rejects.toThrow('another customer');
      await expect(workshop.queries.findById(UNKNOWN_ID, admin)).rejects.toThrow(NotFoundError);
      await expect(workshop.queries.listByCustomer(order.customerId)).resolves.toHaveLength(1);
      await expect(workshop.queries.findSaga(order.id)).resolves.toBeDefined();
      await expect(workshop.queries.findSaga(UNKNOWN_ID)).rejects.toThrow(NotFoundError);
    });

    it('computes average execution time', async () => {
      expect(await workshop.queries.executionMetrics()).toEqual({
        finishedOrders: 0,
        averageExecutionMinutes: 0,
        averageMinutesByStatus: {},
      });

      const order = await workshop.openDefaultOrder();
      const start = new Date('2026-01-01T10:00:00Z');
      const minutesLater = (minutes: number) => new Date(start.getTime() + minutes * 60_000);
      order.startDiagnosis(minutesLater(10));
      order.awaitApproval(minutesLater(30));
      order.startExecution(minutesLater(60));
      order.finish(minutesLater(150));

      const metrics = await workshop.queries.executionMetrics();
      expect(metrics.finishedOrders).toBe(1);
      expect(metrics.averageExecutionMinutes).toBe(90);
      expect(metrics.averageMinutesByStatus).toMatchObject({
        IN_DIAGNOSIS: 20,
        AWAITING_APPROVAL: 30,
        IN_EXECUTION: 90,
      });
    });

    it('fails to deliver an unknown or unfinished order', async () => {
      const order = await workshop.openDefaultOrder();
      await expect(workshop.deliverServiceOrder.execute(UNKNOWN_ID)).rejects.toThrow(NotFoundError);
      await expect(workshop.deliverServiceOrder.execute(order.id)).rejects.toThrow(DomainError);
    });
  });
});
