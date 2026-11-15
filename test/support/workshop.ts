import { DeliverServiceOrder } from '../../src/application/use-cases/deliver-service-order';
import { OpenServiceOrder } from '../../src/application/use-cases/open-service-order';
import { ServiceOrderQueries } from '../../src/application/use-cases/service-order-queries';
import { ServiceOrderSaga } from '../../src/application/use-cases/service-order-saga';
import { StatusChangeAnnouncer } from '../../src/application/use-cases/status-change-announcer';
import { CatalogService } from '../../src/domain/entities/catalog-service';
import { Part } from '../../src/domain/entities/part';
import {
  InMemoryCatalogServiceRepository,
  InMemoryCustomerRepository,
  InMemoryPartRepository,
  InMemorySagaRepository,
  InMemoryServiceOrderRepository,
  InMemoryVehicleRepository,
  RecordingMessagePublisher,
  RecordingMetrics,
  RecordingNotifier,
} from './in-memory';

export const VALID_CPF = '52998224725';
export const VALID_CNPJ = '11222333000181';

export const buildWorkshop = () => {
  const customers = new InMemoryCustomerRepository();
  const vehicles = new InMemoryVehicleRepository();
  const services = new InMemoryCatalogServiceRepository();
  const parts = new InMemoryPartRepository();
  const orders = new InMemoryServiceOrderRepository();
  const sagas = new InMemorySagaRepository();
  const publisher = new RecordingMessagePublisher();
  const notifier = new RecordingNotifier();
  const metrics = new RecordingMetrics();

  const announcer = new StatusChangeAnnouncer(customers, notifier, metrics);
  const saga = new ServiceOrderSaga(orders, sagas, parts, customers, publisher, announcer, metrics);
  const openServiceOrder = new OpenServiceOrder(
    customers,
    vehicles,
    services,
    parts,
    orders,
    saga,
    announcer,
  );

  const oilChange = CatalogService.register({ name: 'Troca de óleo', price: 120, estimatedMinutes: 40 });
  const oilFilter = Part.register({ name: 'Filtro de óleo', sku: 'FLT-001', price: 45.5, stockQuantity: 10 });
  services.items.set(oilChange.id, oilChange);
  parts.items.set(oilFilter.id, oilFilter);

  const openDefaultOrder = (partQuantity = 2) =>
    openServiceOrder.execute({
      customer: { document: VALID_CPF, name: 'Maria Silva', email: 'maria@example.com' },
      vehicle: { plate: 'ABC1D23', brand: 'Fiat', model: 'Argo', year: 2022 },
      services: [{ serviceId: oilChange.id }],
      parts: [{ partId: oilFilter.id, quantity: partQuantity }],
    });

  return {
    customers,
    vehicles,
    services,
    parts,
    orders,
    sagas,
    publisher,
    notifier,
    metrics,
    saga,
    openServiceOrder,
    deliverServiceOrder: new DeliverServiceOrder(orders, announcer),
    queries: new ServiceOrderQueries(orders, sagas),
    oilChange,
    oilFilter,
    openDefaultOrder,
  };
};

export type Workshop = ReturnType<typeof buildWorkshop>;
