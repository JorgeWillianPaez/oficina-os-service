import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { PasswordHasher, TokenIssuer, TokenPayload } from '../../application/ports/gateways';

const SALT_ROUNDS = 10;

@Injectable()
export class BcryptPasswordHasher implements PasswordHasher {
  hash(plain: string): Promise<string> {
    return hash(plain, SALT_ROUNDS);
  }

  matches(plain: string, hashed: string): Promise<boolean> {
    return compare(plain, hashed);
  }
}

@Injectable()
export class JwtTokenIssuer implements TokenIssuer {
  constructor(private readonly jwt: JwtService) {}

  issue(payload: TokenPayload): Promise<string> {
    return this.jwt.signAsync(payload);
  }
}
