import { randomUUID } from 'node:crypto';
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { PasswordHasher } from '../../application/ports/gateways';
import { UserRepository } from '../../application/ports/repositories';
import { config } from '../../config';
import { User } from '../../domain/entities/user';

@Injectable()
export class AdminSeeder implements OnApplicationBootstrap {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (await this.users.findByEmail(config.admin.email)) return;
    const passwordHash = await this.hasher.hash(config.admin.password);
    await this.users.save(new User(randomUUID(), config.admin.email, passwordHash, 'ADMIN'));
  }
}
