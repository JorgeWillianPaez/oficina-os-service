import './instrumentation';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { config } from './config';
import { correlationMiddleware } from './infrastructure/observability/correlation';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.use(correlationMiddleware);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableShutdownHooks();

  const openApi = new DocumentBuilder()
    .setTitle('Oficina - OS Service')
    .setDescription('Clientes, veículos, catálogo, estoque e ordens de serviço')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs/os', app, SwaggerModule.createDocument(app, openApi));

  await app.listen(config.port);
}

void bootstrap();
