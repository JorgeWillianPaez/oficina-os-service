import { randomUUID } from 'node:crypto';
import { DomainError } from '../errors';

export interface CatalogServiceData {
  name: string;
  description?: string | null;
  price: number;
  estimatedMinutes: number;
}

export class CatalogService {
  constructor(
    readonly id: string,
    public name: string,
    public description: string | null,
    public price: number,
    public estimatedMinutes: number,
    public active = true,
  ) {
    this.validate();
  }

  static register(data: CatalogServiceData): CatalogService {
    return new CatalogService(
      randomUUID(),
      data.name,
      data.description ?? null,
      data.price,
      data.estimatedMinutes,
    );
  }

  update(data: Partial<CatalogServiceData>): void {
    this.name = data.name ?? this.name;
    this.description = data.description === undefined ? this.description : data.description;
    this.price = data.price ?? this.price;
    this.estimatedMinutes = data.estimatedMinutes ?? this.estimatedMinutes;
    this.validate();
  }

  deactivate(): void {
    this.active = false;
  }

  private validate(): void {
    if (!this.name?.trim()) throw new DomainError('Service name is required');
    if (!(this.price >= 0)) throw new DomainError('Service price must not be negative');
    if (!(this.estimatedMinutes > 0)) throw new DomainError('Estimated time must be positive');
  }
}
