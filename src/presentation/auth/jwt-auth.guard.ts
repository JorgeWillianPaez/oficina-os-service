import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { TokenPayload } from '../../application/ports/gateways';
import { Role } from '../../domain/entities/user';
import { ALLOWED_ROLES, IS_PUBLIC } from './auth.decorators';

const DEFAULT_ROLES: Role[] = ['ADMIN'];

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const request = context.switchToHttp().getRequest();
    const user = await this.authenticate(request.headers.authorization);
    const allowedRoles =
      this.reflector.getAllAndOverride<Role[]>(ALLOWED_ROLES, targets) ?? DEFAULT_ROLES;
    if (!allowedRoles.includes(user.role)) throw new ForbiddenException('Insufficient permissions');

    request.user = user;
    return true;
  }

  private async authenticate(authorization?: string): Promise<TokenPayload> {
    const [scheme, token] = authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Missing access token');
    try {
      return await this.jwt.verifyAsync<TokenPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
