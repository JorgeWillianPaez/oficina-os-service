import { randomUUID } from 'node:crypto';
import { DomainError } from '../errors';
import { LicensePlate } from '../value-objects/license-plate';

const FIRST_VALID_YEAR = 1900;

export interface VehicleData {
  brand: string;
  model: string;
  year: number;
}

export class Vehicle {
  constructor(
    readonly id: string,
    readonly customerId: string,
    readonly plate: LicensePlate,
    public brand: string,
    public model: string,
    public year: number,
  ) {
    this.validate();
  }

  static register(data: VehicleData & { customerId: string; plate: string }): Vehicle {
    return new Vehicle(
      randomUUID(),
      data.customerId,
      LicensePlate.create(data.plate),
      data.brand,
      data.model,
      data.year,
    );
  }

  update(data: Partial<VehicleData>): void {
    this.brand = data.brand ?? this.brand;
    this.model = data.model ?? this.model;
    this.year = data.year ?? this.year;
    this.validate();
  }

  private validate(): void {
    if (!this.brand?.trim()) throw new DomainError('Vehicle brand is required');
    if (!this.model?.trim()) throw new DomainError('Vehicle model is required');
    const nextYear = new Date().getFullYear() + 1;
    if (!Number.isInteger(this.year) || this.year < FIRST_VALID_YEAR || this.year > nextYear) {
      throw new DomainError('Invalid vehicle year');
    }
  }
}
