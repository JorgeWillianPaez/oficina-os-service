import { Injectable } from '@nestjs/common';
import { Part, PartData } from '../../domain/entities/part';
import { ConflictError, NotFoundError } from '../../domain/errors';
import { PartRepository } from '../ports/repositories';

@Injectable()
export class ManageParts {
  constructor(private readonly parts: PartRepository) {}

  async create(data: PartData): Promise<Part> {
    const part = Part.register(data);
    if (await this.parts.findBySku(part.sku)) throw new ConflictError('SKU already registered');
    await this.parts.save(part);
    return part;
  }

  list(): Promise<Part[]> {
    return this.parts.list();
  }

  async findById(id: string): Promise<Part> {
    const part = await this.parts.findById(id);
    if (!part) throw new NotFoundError('Part not found');
    return part;
  }

  async update(id: string, data: Partial<Pick<PartData, 'name' | 'price'>>): Promise<Part> {
    const part = await this.findById(id);
    part.update(data);
    await this.parts.save(part);
    return part;
  }

  async adjustStock(id: string, delta: number): Promise<Part> {
    const part = await this.findById(id);
    part.adjustStock(delta);
    await this.parts.save(part);
    return part;
  }

  async remove(id: string): Promise<void> {
    const part = await this.findById(id);
    part.deactivate();
    await this.parts.save(part);
  }
}
