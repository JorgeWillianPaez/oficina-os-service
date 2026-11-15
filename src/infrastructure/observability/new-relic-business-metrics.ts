import { Injectable, Logger } from '@nestjs/common';
import { BusinessMetrics } from '../../application/ports/gateways';
import { ServiceOrder } from '../../domain/entities/service-order';
import { config } from '../../config';

type CustomAttributes = Record<string, string | number | boolean>;

@Injectable()
export class NewRelicBusinessMetrics implements BusinessMetrics {
  private readonly logger = new Logger('BusinessMetrics');
  private readonly agent = config.newRelicEnabled ? require('newrelic') : undefined;

  orderStatusChanged(order: ServiceOrder): void {
    const previous = order.previousStatusChange;
    const current = order.lastStatusChange;
    this.record('ServiceOrderStatusChanged', {
      orderId: order.id,
      status: order.status,
      previousStatus: previous?.status ?? 'NONE',
      secondsInPreviousStatus: previous
        ? (current.changedAt.getTime() - previous.changedAt.getTime()) / 1000
        : 0,
      totalAmount: order.totalAmount,
    });
  }

  sagaCompensated(orderId: string, reason: string): void {
    this.record('ServiceOrderSagaCompensated', { orderId, reason });
  }

  private record(eventType: string, attributes: CustomAttributes): void {
    this.logger.log({ msg: eventType, eventType, ...attributes });
    this.agent?.recordCustomEvent(eventType, attributes);
  }
}
