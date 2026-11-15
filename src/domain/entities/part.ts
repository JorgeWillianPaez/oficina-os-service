import { randomUUID } from 'node:crypto';
import { DomainError } from '../errors';

export interface PartData {
  name: string;
  sku: string;
  price: number;
  stockQuantity?: number;
}

export class Part {
  constructor(
    readonly id: string,
    public name: string,
    readonly sku: string,
    public price: number,
    public stockQuantity: number,
    public active = true,
  ) {
    this.validate();
  }

  static register(data: PartData): Part {
    return new Part(randomUUID(), data.name, data.sku, data.price, data.stockQuantity ?? 0);
  }

  update(data: Partial<Pick<PartData, 'name' | 'price'>>): void {
    this.name = data.name ?? this.name;
    this.price = data.price ?? this.price;
    this.validate();
  }

  adjustStock(delta: number): void {
    if (!Number.isInteger(delta) || delta === 0) {
      throw new DomainError('Stock adjustment must be a non-zero integer');
    }
    if (this.stockQuantity + delta < 0) throw new DomainError('Insufficient stock');
    this.stockQuantity += delta;
  }

  deactivate(): void {
    this.active = false;
  }

  private validate(): void {
    if (!this.name?.trim()) throw new DomainError('Part name is required');
    if (!this.sku?.trim()) throw new DomainError('Part SKU is required');
    if (!(this.price >= 0)) throw new DomainError('Part price must not be negative');
    if (!Number.isInteger(this.stockQuantity) || this.stockQuantity < 0) {
      throw new DomainError('Stock quantity must be a non-negative integer');
    }
  }
}
