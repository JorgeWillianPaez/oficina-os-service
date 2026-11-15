import { CatalogService } from '../../domain/entities/catalog-service';
import { Customer } from '../../domain/entities/customer';
import { Part } from '../../domain/entities/part';
import { Saga } from '../../domain/entities/saga';
import { ServiceOrder, ServiceOrderStatus } from '../../domain/entities/service-order';
import { User } from '../../domain/entities/user';
import { Vehicle } from '../../domain/entities/vehicle';

export abstract class CustomerRepository {
  abstract save(customer: Customer): Promise<void>;
  abstract findById(id: string): Promise<Customer | null>;
  abstract findByDocument(document: string): Promise<Customer | null>;
  abstract list(): Promise<Customer[]>;
}

export abstract class VehicleRepository {
  abstract save(vehicle: Vehicle): Promise<void>;
  abstract findById(id: string): Promise<Vehicle | null>;
  abstract findByPlate(plate: string): Promise<Vehicle | null>;
  abstract list(customerId?: string): Promise<Vehicle[]>;
  abstract delete(id: string): Promise<void>;
}

export abstract class CatalogServiceRepository {
  abstract save(service: CatalogService): Promise<void>;
  abstract findById(id: string): Promise<CatalogService | null>;
  abstract list(): Promise<CatalogService[]>;
}

export abstract class PartRepository {
  abstract save(part: Part): Promise<void>;
  abstract findById(id: string): Promise<Part | null>;
  abstract findBySku(sku: string): Promise<Part | null>;
  abstract list(): Promise<Part[]>;
  abstract reserve(id: string, quantity: number): Promise<boolean>;
  abstract release(id: string, quantity: number): Promise<void>;
}

export abstract class ServiceOrderRepository {
  abstract save(order: ServiceOrder): Promise<void>;
  abstract findById(id: string): Promise<ServiceOrder | null>;
  abstract listByStatuses(statuses: ServiceOrderStatus[]): Promise<ServiceOrder[]>;
  abstract listByCustomer(customerId: string): Promise<ServiceOrder[]>;
  abstract existsForVehicle(vehicleId: string): Promise<boolean>;
}

export abstract class SagaRepository {
  abstract save(saga: Saga): Promise<void>;
  abstract findByOrderId(orderId: string): Promise<Saga | null>;
}

export abstract class UserRepository {
  abstract save(user: User): Promise<void>;
  abstract findByEmail(email: string): Promise<User | null>;
}
