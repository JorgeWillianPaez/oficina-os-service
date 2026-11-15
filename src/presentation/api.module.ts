import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AuthenticateAdmin } from '../application/use-cases/authenticate-admin';
import { DeliverServiceOrder } from '../application/use-cases/deliver-service-order';
import { ManageCatalogServices } from '../application/use-cases/manage-catalog-services';
import { ManageCustomers } from '../application/use-cases/manage-customers';
import { ManageParts } from '../application/use-cases/manage-parts';
import { ManageVehicles } from '../application/use-cases/manage-vehicles';
import { OpenServiceOrder } from '../application/use-cases/open-service-order';
import { ServiceOrderQueries } from '../application/use-cases/service-order-queries';
import { ServiceOrderSaga } from '../application/use-cases/service-order-saga';
import { StatusChangeAnnouncer } from '../application/use-cases/status-change-announcer';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import {
  AuthController,
  CatalogServicesController,
  CustomersController,
  PartsController,
  VehiclesController,
} from './controllers/registry.controllers';
import { ServiceOrdersController } from './controllers/service-orders.controller';
import { DomainExceptionFilter } from './domain-exception.filter';

@Module({
  controllers: [
    AuthController,
    CustomersController,
    VehiclesController,
    CatalogServicesController,
    PartsController,
    ServiceOrdersController,
  ],
  providers: [
    AuthenticateAdmin,
    ManageCustomers,
    ManageVehicles,
    ManageCatalogServices,
    ManageParts,
    OpenServiceOrder,
    DeliverServiceOrder,
    ServiceOrderQueries,
    ServiceOrderSaga,
    StatusChangeAnnouncer,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
  ],
  exports: [ServiceOrderSaga],
})
export class ApiModule {}
