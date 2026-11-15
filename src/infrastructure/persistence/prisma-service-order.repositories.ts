import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SagaRepository, ServiceOrderRepository } from '../../application/ports/repositories';
import { Saga, SagaLogEntry, SagaStatus, SagaStep } from '../../domain/entities/saga';
import { ItemType, ServiceOrder, ServiceOrderStatus } from '../../domain/entities/service-order';
import { PrismaService } from './prisma.service';

const WITH_DETAILS = {
  items: true,
  history: { orderBy: { changedAt: 'asc' } },
} satisfies Prisma.ServiceOrderInclude;

type ServiceOrderRecord = Prisma.ServiceOrderGetPayload<{ include: typeof WITH_DETAILS }>;

const toServiceOrder = (record: ServiceOrderRecord) =>
  ServiceOrder.restore({
    id: record.id,
    customerId: record.customerId,
    vehicleId: record.vehicleId,
    status: record.status as ServiceOrderStatus,
    totalAmount: Number(record.totalAmount),
    paymentUrl: record.paymentUrl,
    cancellationReason: record.cancellationReason,
    createdAt: record.createdAt,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
    deliveredAt: record.deliveredAt,
    items: record.items.map((item) => ({
      id: item.id,
      type: item.type as ItemType,
      referenceId: item.referenceId,
      name: item.name,
      unitPrice: Number(item.unitPrice),
      quantity: item.quantity,
    })),
    history: record.history.map((change) => ({
      id: change.id,
      status: change.status as ServiceOrderStatus,
      changedAt: change.changedAt,
    })),
  });

@Injectable()
export class PrismaServiceOrderRepository implements ServiceOrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(order: ServiceOrder): Promise<void> {
    const data = {
      status: order.status,
      totalAmount: order.totalAmount,
      paymentUrl: order.paymentUrl,
      cancellationReason: order.cancellationReason,
      startedAt: order.startedAt,
      finishedAt: order.finishedAt,
      deliveredAt: order.deliveredAt,
    };
    await this.prisma.$transaction([
      this.prisma.serviceOrder.upsert({
        where: { id: order.id },
        create: {
          id: order.id,
          customerId: order.customerId,
          vehicleId: order.vehicleId,
          createdAt: order.createdAt,
          ...data,
        },
        update: data,
      }),
      this.prisma.serviceOrderItem.createMany({
        data: order.items.map((item) => ({ ...item, orderId: order.id })),
        skipDuplicates: true,
      }),
      this.prisma.serviceOrderStatusHistory.createMany({
        data: order.history.map((change) => ({ ...change, orderId: order.id })),
        skipDuplicates: true,
      }),
    ]);
  }

  async findById(id: string): Promise<ServiceOrder | null> {
    const record = await this.prisma.serviceOrder.findUnique({
      where: { id },
      include: WITH_DETAILS,
    });
    return record && toServiceOrder(record);
  }

  async listByStatuses(statuses: ServiceOrderStatus[]): Promise<ServiceOrder[]> {
    const records = await this.prisma.serviceOrder.findMany({
      where: { status: { in: statuses } },
      include: WITH_DETAILS,
      orderBy: { createdAt: 'asc' },
    });
    return records.map(toServiceOrder);
  }

  async listByCustomer(customerId: string): Promise<ServiceOrder[]> {
    const records = await this.prisma.serviceOrder.findMany({
      where: { customerId },
      include: WITH_DETAILS,
      orderBy: { createdAt: 'desc' },
    });
    return records.map(toServiceOrder);
  }

  async existsForVehicle(vehicleId: string): Promise<boolean> {
    return (await this.prisma.serviceOrder.count({ where: { vehicleId } })) > 0;
  }
}

@Injectable()
export class PrismaSagaRepository implements SagaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(saga: Saga): Promise<void> {
    const data = {
      step: saga.step,
      status: saga.status,
      log: saga.log as unknown as Prisma.InputJsonValue,
    };
    await this.prisma.serviceOrderSaga.upsert({
      where: { orderId: saga.orderId },
      create: { orderId: saga.orderId, ...data },
      update: data,
    });
  }

  async findByOrderId(orderId: string): Promise<Saga | null> {
    const record = await this.prisma.serviceOrderSaga.findUnique({ where: { orderId } });
    return (
      record &&
      new Saga(
        record.orderId,
        record.step as SagaStep,
        record.status as SagaStatus,
        record.log as unknown as SagaLogEntry[],
      )
    );
  }
}
