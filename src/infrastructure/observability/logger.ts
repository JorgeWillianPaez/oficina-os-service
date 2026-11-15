import { Params } from 'nestjs-pino';
import { CORRELATION_HEADER, currentCorrelationId } from './correlation';

export const loggerOptions: Params = {
  pinoHttp: {
    level: process.env.LOG_LEVEL ?? 'info',
    base: { service: 'oficina-os-service' },
    genReqId: (request) => request.headers[CORRELATION_HEADER] as string,
    mixin: () => ({ correlationId: currentCorrelationId() }),
    redact: ['req.headers.authorization'],
    autoLogging: { ignore: (request) => request.url === '/health' },
  },
};
