import { Injectable } from '@nestjs/common';
import { ServiceOrder } from '../../domain/entities/service-order';
import { BusinessMetrics, CustomerNotifier } from '../ports/gateways';
import { CustomerRepository } from '../ports/repositories';

@Injectable()
export class StatusChangeAnnouncer {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly notifier: CustomerNotifier,
    private readonly metrics: BusinessMetrics,
  ) {}

  async announce(order: ServiceOrder): Promise<void> {
    this.metrics.orderStatusChanged(order);
    const customer = await this.customers.findById(order.customerId);
    if (!customer) return;
    await this.notifier.statusChanged({
      to: customer.email,
      customerName: customer.name,
      orderId: order.id,
      status: order.status,
      totalAmount: order.totalAmount,
      paymentUrl: order.paymentUrl,
      cancellationReason: order.cancellationReason,
    });
  }
}
