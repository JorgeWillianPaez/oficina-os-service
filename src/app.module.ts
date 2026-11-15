import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { SagaReplyConsumer } from './infrastructure/messaging/saga-reply.consumer';
import { loggerOptions } from './infrastructure/observability/logger';
import { ApiModule } from './presentation/api.module';

@Module({
  imports: [LoggerModule.forRoot(loggerOptions), InfrastructureModule, ApiModule],
  providers: [SagaReplyConsumer],
})
export class AppModule {}
