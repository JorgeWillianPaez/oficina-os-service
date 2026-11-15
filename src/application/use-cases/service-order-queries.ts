import { Injectable } from '@nestjs/common';
import { Saga } from '../../domain/entities/saga';
import {
  ACTIVE_STATUSES_BY_PRIORITY,
  ServiceOrder,
  ServiceOrderStatus,
} from '../../domain/entities/service-order';
import { ForbiddenError, NotFoundError } from '../../domain/errors';
import { TokenPayload } from '../ports/gateways';
import { SagaRepository, ServiceOrderRepository } from '../ports/repositories';

export interface ExecutionMetrics {
  finishedOrders: number;
  averageExecutionMinutes: number;
  averageMinutesByStatus: Record<string, number>;
}

const MILLISECONDS_PER_MINUTE = 60_000;

const average = (values: number[]) =>
  values.length
    ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100
    : 0;

const minutesBetween = (start: Date, end: Date) =>
  (end.getTime() - start.getTime()) / MILLISECONDS_PER_MINUTE;

@Injectable()
export class ServiceOrderQueries {
  constructor(
    private readonly orders: ServiceOrderRepository,
    private readonly sagas: SagaRepository,
  ) {}

  async findById(id: string, requester: TokenPayload): Promise<ServiceOrder> {
    const order = await this.orders.findById(id);
    if (!order) throw new NotFoundError('Service order not found');
    if (requester.role === 'CUSTOMER' && order.customerId !== requester.sub) {
      throw new ForbiddenError('Service order belongs to another customer');
    }
    return order;
  }

  async findSaga(orderId: string): Promise<Saga> {
    const saga = await this.sagas.findByOrderId(orderId);
    if (!saga) throw new NotFoundError('Service order not found');
    return saga;
  }

  async listActive(): Promise<ServiceOrder[]> {
    const orders = await this.orders.listByStatuses(ACTIVE_STATUSES_BY_PRIORITY);
    const priority = (order: ServiceOrder) => ACTIVE_STATUSES_BY_PRIORITY.indexOf(order.status);
    return orders.sort(
      (a, b) => priority(a) - priority(b) || a.createdAt.getTime() - b.createdAt.getTime(),
    );
  }

  listByCustomer(customerId: string): Promise<ServiceOrder[]> {
    return this.orders.listByCustomer(customerId);
  }

  async executionMetrics(): Promise<ExecutionMetrics> {
    const finished = await this.orders.listByStatuses([
      ServiceOrderStatus.FINISHED,
      ServiceOrderStatus.DELIVERED,
    ]);
    const minutesByStatus: Record<string, number[]> = {};
    for (const order of finished) {
      order.history.slice(0, -1).forEach((change, index) => {
        const next = order.history[index + 1];
        (minutesByStatus[change.status] ??= []).push(
          minutesBetween(change.changedAt, next.changedAt),
        );
      });
    }
    return {
      finishedOrders: finished.length,
      averageExecutionMinutes: average(
        finished
          .filter((order) => order.startedAt && order.finishedAt)
          .map((order) => minutesBetween(order.startedAt!, order.finishedAt!)),
      ),
      averageMinutesByStatus: Object.fromEntries(
        Object.entries(minutesByStatus).map(([status, minutes]) => [status, average(minutes)]),
      ),
    };
  }
}
