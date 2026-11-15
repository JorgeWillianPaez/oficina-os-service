import { CatalogService } from '../domain/entities/catalog-service';
import { Customer } from '../domain/entities/customer';
import { Part } from '../domain/entities/part';
import { Saga } from '../domain/entities/saga';
import { ServiceOrder } from '../domain/entities/service-order';
import { Vehicle } from '../domain/entities/vehicle';

export const presentCustomer = (customer: Customer) => ({
  id: customer.id,
  name: customer.name,
  document: customer.document.value,
  documentType: customer.document.type,
  email: customer.email,
  phone: customer.phone,
  active: customer.active,
});

export const presentVehicle = (vehicle: Vehicle) => ({
  id: vehicle.id,
  customerId: vehicle.customerId,
  plate: vehicle.plate.value,
  brand: vehicle.brand,
  model: vehicle.model,
  year: vehicle.year,
});

export const presentCatalogService = (service: CatalogService) => ({
  id: service.id,
  name: service.name,
  description: service.description,
  price: service.price,
  estimatedMinutes: service.estimatedMinutes,
  active: service.active,
});

export const presentPart = (part: Part) => ({
  id: part.id,
  name: part.name,
  sku: part.sku,
  price: part.price,
  stockQuantity: part.stockQuantity,
  active: part.active,
});

export const presentServiceOrderStatus = (order: ServiceOrder) => ({
  id: order.id,
  status: order.status,
  updatedAt: order.lastStatusChange.changedAt,
  history: order.history.map(({ status, changedAt }) => ({ status, changedAt })),
});

export const presentServiceOrder = (order: ServiceOrder) => ({
  id: order.id,
  customerId: order.customerId,
  vehicleId: order.vehicleId,
  status: order.status,
  totalAmount: order.totalAmount,
  paymentUrl: order.paymentUrl,
  cancellationReason: order.cancellationReason,
  createdAt: order.createdAt,
  startedAt: order.startedAt,
  finishedAt: order.finishedAt,
  deliveredAt: order.deliveredAt,
  items: order.items.map(({ type, referenceId, name, unitPrice, quantity }) => ({
    type,
    referenceId,
    name,
    unitPrice,
    quantity,
  })),
  history: order.history.map(({ status, changedAt }) => ({ status, changedAt })),
});

export const presentSaga = (saga: Saga) => ({
  orderId: saga.orderId,
  step: saga.step,
  status: saga.status,
  log: saga.log,
});
