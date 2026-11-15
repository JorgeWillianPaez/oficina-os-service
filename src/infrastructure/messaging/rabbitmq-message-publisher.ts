import { Injectable } from '@nestjs/common';
import { MessagePublisher } from '../../application/ports/gateways';
import { RabbitMqClient } from './rabbitmq.client';

@Injectable()
export class RabbitMqMessagePublisher implements MessagePublisher {
  constructor(private readonly client: RabbitMqClient) {}

  publish(routingKey: string, payload: object): Promise<void> {
    return this.client.publish(routingKey, payload);
  }
}
