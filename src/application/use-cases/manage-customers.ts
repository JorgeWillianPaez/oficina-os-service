import { Injectable } from '@nestjs/common';
import { Customer, CustomerData } from '../../domain/entities/customer';
import { ConflictError, NotFoundError } from '../../domain/errors';
import { Document } from '../../domain/value-objects/document';
import { CustomerRepository } from '../ports/repositories';

@Injectable()
export class ManageCustomers {
  constructor(private readonly customers: CustomerRepository) {}

  async create(data: CustomerData & { document: string }): Promise<Customer> {
    const customer = Customer.register(data);
    if (await this.customers.findByDocument(customer.document.value)) {
      throw new ConflictError('Document already registered');
    }
    await this.customers.save(customer);
    return customer;
  }

  list(): Promise<Customer[]> {
    return this.customers.list();
  }

  async findById(id: string): Promise<Customer> {
    const customer = await this.customers.findById(id);
    if (!customer) throw new NotFoundError('Customer not found');
    return customer;
  }

  async findByDocument(document: string): Promise<Customer> {
    const customer = await this.customers.findByDocument(Document.create(document).value);
    if (!customer) throw new NotFoundError('Customer not found');
    return customer;
  }

  async update(id: string, data: Partial<CustomerData>): Promise<Customer> {
    const customer = await this.findById(id);
    customer.update(data);
    await this.customers.save(customer);
    return customer;
  }

  async remove(id: string): Promise<void> {
    const customer = await this.findById(id);
    customer.deactivate();
    await this.customers.save(customer);
  }
}
