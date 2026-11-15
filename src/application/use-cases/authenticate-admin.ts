import { Injectable } from '@nestjs/common';
import { InvalidCredentialsError } from '../../domain/errors';
import { PasswordHasher, TokenIssuer } from '../ports/gateways';
import { UserRepository } from '../ports/repositories';

@Injectable()
export class AuthenticateAdmin {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenIssuer,
  ) {}

  async execute(email: string, password: string): Promise<{ accessToken: string }> {
    const user = await this.users.findByEmail(email);
    if (!user || !(await this.hasher.matches(password, user.passwordHash))) {
      throw new InvalidCredentialsError('Invalid credentials');
    }
    return { accessToken: await this.tokens.issue({ sub: user.id, role: user.role }) };
  }
}
