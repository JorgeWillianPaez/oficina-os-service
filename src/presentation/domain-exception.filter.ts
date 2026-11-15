import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  IntegrationError,
  InvalidCredentialsError,
  NotFoundError,
} from '../domain/errors';

const STATUS_BY_ERROR: [new (...args: any[]) => DomainError, HttpStatus][] = [
  [NotFoundError, HttpStatus.NOT_FOUND],
  [ConflictError, HttpStatus.CONFLICT],
  [ForbiddenError, HttpStatus.FORBIDDEN],
  [InvalidCredentialsError, HttpStatus.UNAUTHORIZED],
  [IntegrationError, HttpStatus.SERVICE_UNAVAILABLE],
];

@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(error: DomainError, host: ArgumentsHost): void {
    const statusCode =
      STATUS_BY_ERROR.find(([type]) => error instanceof type)?.[1] ??
      HttpStatus.UNPROCESSABLE_ENTITY;
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(statusCode)
      .json({ statusCode, message: error.message, error: HttpStatus[statusCode] });
  }
}
