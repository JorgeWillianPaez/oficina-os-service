import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { TokenPayload } from '../../application/ports/gateways';
import { Role } from '../../domain/entities/user';

export const IS_PUBLIC = 'isPublic';
export const ALLOWED_ROLES = 'allowedRoles';

export const Public = () => SetMetadata(IS_PUBLIC, true);

export const Roles = (...roles: Role[]) => SetMetadata(ALLOWED_ROLES, roles);

export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext): TokenPayload => context.switchToHttp().getRequest().user,
);
