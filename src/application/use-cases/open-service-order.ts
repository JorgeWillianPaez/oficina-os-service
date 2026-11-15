import { Injectable, Logger } from '@nestjs/common';
import { Customer } from '../../domain/entities/customer';
import { ServiceOrder, ServiceOrderItem } from '../../domain/entities/service-order';
import { Vehicle } from '../../domain/entities/vehicle';
import { ConflictError, DomainError, IntegrationError, NotFoundError } from '../../domain/errors';
import { Document } from '../../domain/value-objects/document';
import { LicensePlate } from '../../domain/value-objects/license-plate';
import {
  CatalogServiceRepository,
  CustomerRepository,
  PartRepository,
  ServiceOrderRepository,
  VehicleRepository,
} from '../ports/repositories';
import { ServiceOrderSaga } from './service-order-saga';
import { StatusChangeAnnouncer } from './status-change-announcer';

export interface OpenServiceOrderInput {
  customer: { document: string; name?: string; email?: string; phone?: string };
  vehicle: { plate: string; brand?: string; model?: string; year?: number };
  services: { serviceId: string; quantity?: number }[];
  parts?: { partId: string; quantity: number }[];
}

type NewItem = Omit<ServiceOrderItem, 'id'>;

@Injectable()
export class OpenServiceOrder {
  private readonly logger = new Logger(OpenServiceOrder.name);

  constructor(
    private readonly customers: CustomerRepository,
    private readonly vehicles: VehicleRepository,
    private readonly services: CatalogServiceRepository,
    private readonly parts: PartRepository,
    private readonly orders: ServiceOrderRepository,
    private readonly saga: ServiceOrderSaga,
    private readonly announcer: StatusChangeAnnouncer,
  ) {}

  async execute(input: OpenServiceOrderInput): Promise<ServiceOrder> {
    const customer = await this.identifyCustomer(input.customer);
    const vehicle = await this.identifyVehicle(input.vehicle, customer);
    const items = [
      ...(await this.resolveServices(input.services ?? [])),
      ...(await this.resolveParts(input.parts ?? [])),
    ];
    const order = ServiceOrder.open({ customerId: customer.id, vehicleId: vehicle.id, items });

    await this.reserveStock(order);
    await this.orders.save(order);
    await this.startSaga(order, customer, vehicle);
    await this.announcer.announce(order);
    return order;
  }

  private async identifyCustomer(input: OpenServiceOrderInput['customer']): Promise<Customer> {
    const document = Document.create(input.document);
    const existing = await this.customers.findByDocument(document.value);
    if (existing && !existing.active) throw new DomainError('Customer is inactive');
    if (existing) return existing;

    const customer = Customer.register({
      document: document.value,
      name: input.name ?? '',
      email: input.email ?? '',
      phone: input.phone,
    });
    await this.customers.save(customer);
    return customer;
  }

  private async identifyVehicle(
    input: OpenServiceOrderInput['vehicle'],
    customer: Customer,
  ): Promise<Vehicle> {
    const plate = LicensePlate.create(input.plate);
    const existing = await this.vehicles.findByPlate(plate.value);
    if (existing && existing.customerId !== customer.id) {
      throw new ConflictError('Vehicle belongs to another customer');
    }
    if (existing) return existing;

    const vehicle = Vehicle.register({
      customerId: customer.id,
      plate: plate.value,
      brand: input.brand ?? '',
      model: input.model ?? '',
      year: input.year ?? 0,
    });
    await this.vehicles.save(vehicle);
    return vehicle;
  }

  private resolveServices(requested: OpenServiceOrderInput['services']): Promise<NewItem[]> {
    return Promise.all(
      requested.map(async ({ serviceId, quantity }) => {
        const service = await this.services.findById(serviceId);
        if (!service?.active) throw new NotFoundError(`Service ${serviceId} not found`);
        return {
          type: 'SERVICE' as const,
          referenceId: service.id,
          name: service.name,
          unitPrice: service.price,
          quantity: quantity ?? 1,
        };
      }),
    );
  }

  private resolveParts(requested: NonNullable<OpenServiceOrderInput['parts']>): Promise<NewItem[]> {
    return Promise.all(
      requested.map(async ({ partId, quantity }) => {
        const part = await this.parts.findById(partId);
        if (!part?.active) throw new NotFoundError(`Part ${partId} not found`);
        return {
          type: 'PART' as const,
          referenceId: part.id,
          name: part.name,
          unitPrice: part.price,
          quantity,
        };
      }),
    );
  }

  private async reserveStock(order: ServiceOrder): Promise<void> {
    const reserved: ServiceOrderItem[] = [];
    for (const part of order.parts) {
      if (await this.parts.reserve(part.referenceId, part.quantity)) {
        reserved.push(part);
        continue;
      }
      await this.releaseStock(reserved);
      throw new DomainError(`Insufficient stock for part ${part.name}`);
    }
  }

  private async startSaga(order: ServiceOrder, customer: Customer, vehicle: Vehicle) {
    try {
      await this.saga.start(order, customer, vehicle);
    } catch (error) {
      this.logger.error({ msg: 'Failed to start service order saga', orderId: order.id, err: error });
      order.cancel('Failed to start service order processing');
      await this.releaseStock(order.parts);
      await this.orders.save(order);
      throw new IntegrationError('Service order processing is unavailable, try again later');
    }
  }

  private async releaseStock(parts: readonly ServiceOrderItem[]): Promise<void> {
    await Promise.all(parts.map((part) => this.parts.release(part.referenceId, part.quantity)));
  }
}
