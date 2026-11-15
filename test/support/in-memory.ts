import {
  BusinessMetrics,
  CustomerNotifier,
  MessagePublisher,
  PasswordHasher,
  StatusNotification,
  TokenIssuer,
  TokenPayload,
} from '../../src/application/ports/gateways';
import {
  CatalogServiceRepository,
  CustomerRepository,
  PartRepository,
  SagaRepository,
  ServiceOrderRepository,
  UserRepository,
  VehicleRepository,
} from '../../src/application/ports/repositories';
import { CatalogService } from '../../src/domain/entities/catalog-service';
import { Customer } from '../../src/domain/entities/customer';
import { Part } from '../../src/domain/entities/part';
import { Saga } from '../../src/domain/entities/saga';
import { ServiceOrder, ServiceOrderStatus } from '../../src/domain/entities/service-order';
import { User } from '../../src/domain/entities/user';
import { Vehicle } from '../../src/domain/entities/vehicle';

class InMemoryStore<T extends { id: string }> {
  readonly items = new Map<string, T>();

  async save(item: T): Promise<void> {
    this.items.set(item.id, item);
  }

  async findById(id: string): Promise<T | null> {
    return this.items.get(id) ?? null;
  }

  protected all(): T[] {
    return [...this.items.values()];
  }
}

export class InMemoryCustomerRepository
  extends InMemoryStore<Customer>
  implements CustomerRepository
{
  async findByDocument(document: string) {
    return this.all().find((customer) => customer.document.value === document) ?? null;
  }

  async list() {
    return this.all().filter((customer) => customer.active);
  }
}

export class InMemoryVehicleRepository extends InMemoryStore<Vehicle> implements VehicleRepository {
  async findByPlate(plate: string) {
    return this.all().find((vehicle) => vehicle.plate.value === plate) ?? null;
  }

  async list(customerId?: string) {
    return this.all().filter((vehicle) => !customerId || vehicle.customerId === customerId);
  }

  async delete(id: string) {
    this.items.delete(id);
  }
}

export class InMemoryCatalogServiceRepository
  extends InMemoryStore<CatalogService>
  implements CatalogServiceRepository
{
  async list() {
    return this.all().filter((service) => service.active);
  }
}

export class InMemoryPartRepository extends InMemoryStore<Part> implements PartRepository {
  async findBySku(sku: string) {
    return this.all().find((part) => part.sku === sku) ?? null;
  }

  async list() {
    return this.all().filter((part) => part.active);
  }

  async reserve(id: string, quantity: number) {
    const part = this.items.get(id);
    if (!part || part.stockQuantity < quantity) return false;
    part.stockQuantity -= quantity;
    return true;
  }

  async release(id: string, quantity: number) {
    const part = this.items.get(id);
    if (part) part.stockQuantity += quantity;
  }
}

export class InMemoryServiceOrderRepository
  extends InMemoryStore<ServiceOrder>
  implements ServiceOrderRepository
{
  async listByStatuses(statuses: ServiceOrderStatus[]) {
    return this.all().filter((order) => statuses.includes(order.status));
  }

  async listByCustomer(customerId: string) {
    return this.all().filter((order) => order.customerId === customerId);
  }

  async existsForVehicle(vehicleId: string) {
    return this.all().some((order) => order.vehicleId === vehicleId);
  }
}

export class InMemorySagaRepository implements SagaRepository {
  readonly items = new Map<string, Saga>();

  async save(saga: Saga) {
    this.items.set(saga.orderId, saga);
  }

  async findByOrderId(orderId: string) {
    return this.items.get(orderId) ?? null;
  }
}

export class InMemoryUserRepository extends InMemoryStore<User> implements UserRepository {
  async findByEmail(email: string) {
    return this.all().find((user) => user.email === email) ?? null;
  }
}

export class RecordingMessagePublisher implements MessagePublisher {
  readonly messages: { routingKey: string; payload: any }[] = [];
  failure?: Error;

  async publish(routingKey: string, payload: object) {
    if (this.failure) throw this.failure;
    this.messages.push({ routingKey, payload });
  }

  routingKeys(): string[] {
    return this.messages.map((message) => message.routingKey);
  }
}

export class RecordingNotifier implements CustomerNotifier {
  readonly notifications: StatusNotification[] = [];

  async statusChanged(notification: StatusNotification) {
    this.notifications.push(notification);
  }
}

export class RecordingMetrics implements BusinessMetrics {
  readonly statusChanges: string[] = [];
  readonly compensations: { orderId: string; reason: string }[] = [];

  orderStatusChanged(order: ServiceOrder) {
    this.statusChanges.push(order.status);
  }

  sagaCompensated(orderId: string, reason: string) {
    this.compensations.push({ orderId, reason });
  }
}

export class PlainPasswordHasher implements PasswordHasher {
  async hash(plain: string) {
    return `hashed:${plain}`;
  }

  async matches(plain: string, hash: string) {
    return hash === `hashed:${plain}`;
  }
}

export class FakeTokenIssuer implements TokenIssuer {
  async issue(payload: TokenPayload) {
    return `token:${payload.sub}:${payload.role}`;
  }
}
