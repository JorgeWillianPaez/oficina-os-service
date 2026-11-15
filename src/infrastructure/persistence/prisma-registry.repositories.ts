import { Injectable } from '@nestjs/common';
import {
  CatalogService as CatalogServiceRecord,
  Customer as CustomerRecord,
  Part as PartRecord,
  Vehicle as VehicleRecord,
} from '@prisma/client';
import {
  CatalogServiceRepository,
  CustomerRepository,
  PartRepository,
  UserRepository,
  VehicleRepository,
} from '../../application/ports/repositories';
import { CatalogService } from '../../domain/entities/catalog-service';
import { Customer } from '../../domain/entities/customer';
import { Part } from '../../domain/entities/part';
import { Role, User } from '../../domain/entities/user';
import { Vehicle } from '../../domain/entities/vehicle';
import { Document } from '../../domain/value-objects/document';
import { LicensePlate } from '../../domain/value-objects/license-plate';
import { PrismaService } from './prisma.service';

const toCustomer = (record: CustomerRecord) =>
  new Customer(
    record.id,
    record.name,
    Document.create(record.document),
    record.email,
    record.phone,
    record.active,
  );

const toVehicle = (record: VehicleRecord) =>
  new Vehicle(
    record.id,
    record.customerId,
    LicensePlate.create(record.plate),
    record.brand,
    record.model,
    record.year,
  );

const toCatalogService = (record: CatalogServiceRecord) =>
  new CatalogService(
    record.id,
    record.name,
    record.description,
    Number(record.price),
    record.estimatedMinutes,
    record.active,
  );

const toPart = (record: PartRecord) =>
  new Part(
    record.id,
    record.name,
    record.sku,
    Number(record.price),
    record.stockQuantity,
    record.active,
  );

@Injectable()
export class PrismaCustomerRepository implements CustomerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(customer: Customer): Promise<void> {
    const data = {
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      active: customer.active,
    };
    await this.prisma.customer.upsert({
      where: { id: customer.id },
      create: { id: customer.id, document: customer.document.value, ...data },
      update: data,
    });
  }

  async findById(id: string): Promise<Customer | null> {
    const record = await this.prisma.customer.findUnique({ where: { id } });
    return record && toCustomer(record);
  }

  async findByDocument(document: string): Promise<Customer | null> {
    const record = await this.prisma.customer.findUnique({ where: { document } });
    return record && toCustomer(record);
  }

  async list(): Promise<Customer[]> {
    const records = await this.prisma.customer.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
    return records.map(toCustomer);
  }
}

@Injectable()
export class PrismaVehicleRepository implements VehicleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(vehicle: Vehicle): Promise<void> {
    const data = { brand: vehicle.brand, model: vehicle.model, year: vehicle.year };
    await this.prisma.vehicle.upsert({
      where: { id: vehicle.id },
      create: {
        id: vehicle.id,
        customerId: vehicle.customerId,
        plate: vehicle.plate.value,
        ...data,
      },
      update: data,
    });
  }

  async findById(id: string): Promise<Vehicle | null> {
    const record = await this.prisma.vehicle.findUnique({ where: { id } });
    return record && toVehicle(record);
  }

  async findByPlate(plate: string): Promise<Vehicle | null> {
    const record = await this.prisma.vehicle.findUnique({ where: { plate } });
    return record && toVehicle(record);
  }

  async list(customerId?: string): Promise<Vehicle[]> {
    const records = await this.prisma.vehicle.findMany({
      where: { customerId },
      orderBy: { plate: 'asc' },
    });
    return records.map(toVehicle);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.vehicle.delete({ where: { id } });
  }
}

@Injectable()
export class PrismaCatalogServiceRepository implements CatalogServiceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(service: CatalogService): Promise<void> {
    const data = {
      name: service.name,
      description: service.description,
      price: service.price,
      estimatedMinutes: service.estimatedMinutes,
      active: service.active,
    };
    await this.prisma.catalogService.upsert({
      where: { id: service.id },
      create: { id: service.id, ...data },
      update: data,
    });
  }

  async findById(id: string): Promise<CatalogService | null> {
    const record = await this.prisma.catalogService.findUnique({ where: { id } });
    return record && toCatalogService(record);
  }

  async list(): Promise<CatalogService[]> {
    const records = await this.prisma.catalogService.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
    return records.map(toCatalogService);
  }
}

@Injectable()
export class PrismaPartRepository implements PartRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(part: Part): Promise<void> {
    const data = {
      name: part.name,
      price: part.price,
      stockQuantity: part.stockQuantity,
      active: part.active,
    };
    await this.prisma.part.upsert({
      where: { id: part.id },
      create: { id: part.id, sku: part.sku, ...data },
      update: data,
    });
  }

  async findById(id: string): Promise<Part | null> {
    const record = await this.prisma.part.findUnique({ where: { id } });
    return record && toPart(record);
  }

  async findBySku(sku: string): Promise<Part | null> {
    const record = await this.prisma.part.findUnique({ where: { sku } });
    return record && toPart(record);
  }

  async list(): Promise<Part[]> {
    const records = await this.prisma.part.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
    return records.map(toPart);
  }

  async reserve(id: string, quantity: number): Promise<boolean> {
    const { count } = await this.prisma.part.updateMany({
      where: { id, stockQuantity: { gte: quantity } },
      data: { stockQuantity: { decrement: quantity } },
    });
    return count === 1;
  }

  async release(id: string, quantity: number): Promise<void> {
    await this.prisma.part.updateMany({
      where: { id },
      data: { stockQuantity: { increment: quantity } },
    });
  }
}

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(user: User): Promise<void> {
    const data = { email: user.email, passwordHash: user.passwordHash, role: user.role };
    await this.prisma.user.upsert({
      where: { id: user.id },
      create: { id: user.id, ...data },
      update: data,
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({ where: { email } });
    return record && new User(record.id, record.email, record.passwordHash, record.role as Role);
  }
}
