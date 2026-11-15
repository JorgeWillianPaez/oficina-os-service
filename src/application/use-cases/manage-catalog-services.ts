import { Injectable } from '@nestjs/common';
import { CatalogService, CatalogServiceData } from '../../domain/entities/catalog-service';
import { NotFoundError } from '../../domain/errors';
import { CatalogServiceRepository } from '../ports/repositories';

@Injectable()
export class ManageCatalogServices {
  constructor(private readonly services: CatalogServiceRepository) {}

  async create(data: CatalogServiceData): Promise<CatalogService> {
    const service = CatalogService.register(data);
    await this.services.save(service);
    return service;
  }

  list(): Promise<CatalogService[]> {
    return this.services.list();
  }

  async findById(id: string): Promise<CatalogService> {
    const service = await this.services.findById(id);
    if (!service) throw new NotFoundError('Service not found');
    return service;
  }

  async update(id: string, data: Partial<CatalogServiceData>): Promise<CatalogService> {
    const service = await this.findById(id);
    service.update(data);
    await this.services.save(service);
    return service;
  }

  async remove(id: string): Promise<void> {
    const service = await this.findById(id);
    service.deactivate();
    await this.services.save(service);
  }
}
