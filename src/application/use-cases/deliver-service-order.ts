import { Injectable } from '@nestjs/common';
import { ServiceOrder } from '../../domain/entities/service-order';
import { NotFoundError } from '../../domain/errors';
import { ServiceOrderRepository } from '../ports/repositories';
import { StatusChangeAnnouncer } from './status-change-announcer';

@Injectable()
export class DeliverServiceOrder {
  constructor(
    private readonly orders: ServiceOrderRepository,
    private readonly announcer: StatusChangeAnnouncer,
  ) {}

  async execute(id: string): Promise<ServiceOrder> {
    const order = await this.orders.findById(id);
    if (!order) throw new NotFoundError('Service order not found');
    order.deliver();
    await this.orders.save(order);
    await this.announcer.announce(order);
    return order;
  }
}
