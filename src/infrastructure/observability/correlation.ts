import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';

export const CORRELATION_HEADER = 'x-correlation-id';

const storage = new AsyncLocalStorage<string>();

export const currentCorrelationId = (): string | undefined => storage.getStore();

export const runWithCorrelation = <T>(correlationId: string | undefined, callback: () => T): T =>
  storage.run(correlationId ?? randomUUID(), callback);

export const correlationMiddleware = (request: Request, response: Response, next: NextFunction) => {
  const correlationId = request.header(CORRELATION_HEADER) ?? randomUUID();
  request.headers[CORRELATION_HEADER] = correlationId;
  response.setHeader(CORRELATION_HEADER, correlationId);
  runWithCorrelation(correlationId, next);
};
