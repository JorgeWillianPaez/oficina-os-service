import { Injectable } from '@nestjs/common';
import { Vehicle, VehicleData } from '../../domain/entities/vehicle';
import { ConflictError, NotFoundError } from '../../domain/errors';
import {
  CustomerRepository,
  ServiceOrderRepository,
  VehicleRepository,
} from '../ports/repositories';

@Injectable()
export class ManageVehicles {
  constructor(
    private readonly vehicles: VehicleRepository,
    private readonly customers: CustomerRepository,
    private readonly orders: ServiceOrderRepository,
  ) {}

  async create(data: VehicleData & { customerId: string; plate: string }): Promise<Vehicle> {
    if (!(await this.customers.findById(data.customerId))) {
      throw new NotFoundError('Customer not found');
    }
    const vehicle = Vehicle.register(data);
    if (await this.vehicles.findByPlate(vehicle.plate.value)) {
      throw new ConflictError('License plate already registered');
    }
    await this.vehicles.save(vehicle);
    return vehicle;
  }

  list(customerId?: string): Promise<Vehicle[]> {
    return this.vehicles.list(customerId);
  }

  async findById(id: string): Promise<Vehicle> {
    const vehicle = await this.vehicles.findById(id);
    if (!vehicle) throw new NotFoundError('Vehicle not found');
    return vehicle;
  }

  async update(id: string, data: Partial<VehicleData>): Promise<Vehicle> {
    const vehicle = await this.findById(id);
    vehicle.update(data);
    await this.vehicles.save(vehicle);
    return vehicle;
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    if (await this.orders.existsForVehicle(id)) {
      throw new ConflictError('Vehicle has service orders and cannot be removed');
    }
    await this.vehicles.delete(id);
  }
}
