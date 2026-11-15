import { randomUUID } from 'node:crypto';
import { DomainError } from '../errors';
import { Document } from '../value-objects/document';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CustomerData {
  name: string;
  email: string;
  phone?: string | null;
}

export class Customer {
  constructor(
    readonly id: string,
    public name: string,
    readonly document: Document,
    public email: string,
    public phone: string | null,
    public active = true,
  ) {
    this.validate();
  }

  static register(data: CustomerData & { document: string }): Customer {
    return new Customer(
      randomUUID(),
      data.name,
      Document.create(data.document),
      data.email,
      data.phone ?? null,
    );
  }

  update(data: Partial<CustomerData>): void {
    this.name = data.name ?? this.name;
    this.email = data.email ?? this.email;
    this.phone = data.phone === undefined ? this.phone : data.phone;
    this.validate();
  }

  deactivate(): void {
    this.active = false;
  }

  private validate(): void {
    if (!this.name?.trim()) throw new DomainError('Customer name is required');
    if (!EMAIL_PATTERN.test(this.email ?? '')) throw new DomainError('Invalid customer e-mail');
  }
}
