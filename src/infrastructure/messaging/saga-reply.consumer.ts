import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { SAGA_REPLY_BINDINGS } from '../../application/messaging-contracts';
import { ServiceOrderSaga } from '../../application/use-cases/service-order-saga';
import { RabbitMqClient } from './rabbitmq.client';

const QUEUE = 'os-service.saga-replies';

@Injectable()
export class SagaReplyConsumer implements OnApplicationBootstrap {
  constructor(
    private readonly client: RabbitMqClient,
    private readonly saga: ServiceOrderSaga,
  ) {}

  onApplicationBootstrap(): void {
    void this.client.subscribe(QUEUE, SAGA_REPLY_BINDINGS, (event, reply) =>
      this.saga.handle(event, reply),
    );
  }
}
