import { randomUUID } from 'node:crypto';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { AmqpConnectionManager, ChannelWrapper, connect } from 'amqp-connection-manager';
import { ConfirmChannel, ConsumeMessage } from 'amqplib';
import { config } from '../../config';
import {
  CORRELATION_HEADER,
  currentCorrelationId,
  runWithCorrelation,
} from '../observability/correlation';

const EXCHANGE = 'oficina';
const PUBLISH_TIMEOUT_MS = 5000;
const PREFETCH = 10;

export type MessageHandler = (routingKey: string, payload: any) => Promise<void>;

@Injectable()
export class RabbitMqClient implements OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqClient.name);
  private readonly connection: AmqpConnectionManager = connect([config.rabbitmqUrl]);
  private readonly channel: ChannelWrapper = this.connection.createChannel({
    json: true,
    setup: (channel: ConfirmChannel) =>
      channel.assertExchange(EXCHANGE, 'topic', { durable: true }),
  });

  async publish(routingKey: string, payload: object): Promise<void> {
    await this.channel.publish(EXCHANGE, routingKey, payload, {
      persistent: true,
      messageId: randomUUID(),
      timeout: PUBLISH_TIMEOUT_MS,
      headers: { [CORRELATION_HEADER]: currentCorrelationId() },
    });
    this.logger.log({
      msg: 'Message published',
      routingKey,
      orderId: (payload as { orderId?: string }).orderId,
    });
  }

  async subscribe(queue: string, bindings: string[], handler: MessageHandler): Promise<void> {
    const deadLetterQueue = `${queue}.dlq`;
    await this.channel.addSetup(async (channel: ConfirmChannel) => {
      await channel.assertQueue(deadLetterQueue, { durable: true });
      await channel.assertQueue(queue, {
        durable: true,
        deadLetterExchange: '',
        deadLetterRoutingKey: deadLetterQueue,
      });
      await Promise.all(bindings.map((binding) => channel.bindQueue(queue, EXCHANGE, binding)));
      await channel.prefetch(PREFETCH);
      await channel.consume(queue, (message) => this.dispatch(channel, message, handler));
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel.close();
    await this.connection.close();
  }

  private async dispatch(
    channel: ConfirmChannel,
    message: ConsumeMessage | null,
    handler: MessageHandler,
  ): Promise<void> {
    if (!message) return;
    const routingKey = message.fields.routingKey;
    const correlationId = message.properties.headers?.[CORRELATION_HEADER];

    await runWithCorrelation(correlationId, async () => {
      try {
        const payload = JSON.parse(message.content.toString());
        await handler(routingKey, payload);
        channel.ack(message);
        this.logger.log({ msg: 'Message processed', routingKey, orderId: payload.orderId });
      } catch (error) {
        this.logger.error({ msg: 'Message processing failed, sent to DLQ', routingKey, err: error });
        channel.nack(message, false, false);
      }
    });
  }
}
