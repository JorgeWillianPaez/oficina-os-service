import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import {
  BusinessMetrics,
  CustomerNotifier,
  MessagePublisher,
  PasswordHasher,
  TokenIssuer,
} from '../application/ports/gateways';
import {
  CatalogServiceRepository,
  CustomerRepository,
  PartRepository,
  SagaRepository,
  ServiceOrderRepository,
  UserRepository,
  VehicleRepository,
} from '../application/ports/repositories';
import { config } from '../config';
import { AdminSeeder } from './adapters/admin-seeder';
import { BcryptPasswordHasher, JwtTokenIssuer } from './adapters/security';
import { SmtpCustomerNotifier } from './adapters/smtp-customer-notifier';
import { HealthController } from './health.controller';
import { RabbitMqMessagePublisher } from './messaging/rabbitmq-message-publisher';
import { RabbitMqClient } from './messaging/rabbitmq.client';
import { NewRelicBusinessMetrics } from './observability/new-relic-business-metrics';
import {
  PrismaCatalogServiceRepository,
  PrismaCustomerRepository,
  PrismaPartRepository,
  PrismaUserRepository,
  PrismaVehicleRepository,
} from './persistence/prisma-registry.repositories';
import {
  PrismaSagaRepository,
  PrismaServiceOrderRepository,
} from './persistence/prisma-service-order.repositories';
import { PrismaService } from './persistence/prisma.service';

const ports = [
  { provide: CustomerRepository, useClass: PrismaCustomerRepository },
  { provide: VehicleRepository, useClass: PrismaVehicleRepository },
  { provide: CatalogServiceRepository, useClass: PrismaCatalogServiceRepository },
  { provide: PartRepository, useClass: PrismaPartRepository },
  { provide: ServiceOrderRepository, useClass: PrismaServiceOrderRepository },
  { provide: SagaRepository, useClass: PrismaSagaRepository },
  { provide: UserRepository, useClass: PrismaUserRepository },
  { provide: MessagePublisher, useClass: RabbitMqMessagePublisher },
  { provide: CustomerNotifier, useClass: SmtpCustomerNotifier },
  { provide: BusinessMetrics, useClass: NewRelicBusinessMetrics },
  { provide: PasswordHasher, useClass: BcryptPasswordHasher },
  { provide: TokenIssuer, useClass: JwtTokenIssuer },
];

@Global()
@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: config.jwtSecret,
      signOptions: { expiresIn: config.jwtExpiresIn as any },
    }),
  ],
  controllers: [HealthController],
  providers: [PrismaService, RabbitMqClient, AdminSeeder, ...ports],
  exports: [RabbitMqClient, ...ports.map((port) => port.provide)],
})
export class InfrastructureModule {}
