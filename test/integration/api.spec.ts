import { Global, INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  BusinessMetrics,
  CustomerNotifier,
  MessagePublisher,
  PasswordHasher,
  TokenIssuer,
} from '../../src/application/ports/gateways';
import {
  CatalogServiceRepository,
  CustomerRepository,
  PartRepository,
  SagaRepository,
  ServiceOrderRepository,
  UserRepository,
  VehicleRepository,
} from '../../src/application/ports/repositories';
import { Events } from '../../src/application/messaging-contracts';
import { ServiceOrderSaga } from '../../src/application/use-cases/service-order-saga';
import { User } from '../../src/domain/entities/user';
import { JwtTokenIssuer } from '../../src/infrastructure/adapters/security';
import { ApiModule } from '../../src/presentation/api.module';
import {
  InMemoryCatalogServiceRepository,
  InMemoryCustomerRepository,
  InMemoryPartRepository,
  InMemorySagaRepository,
  InMemoryServiceOrderRepository,
  InMemoryUserRepository,
  InMemoryVehicleRepository,
  PlainPasswordHasher,
  RecordingMessagePublisher,
  RecordingMetrics,
  RecordingNotifier,
} from '../support/in-memory';
import { VALID_CPF } from '../support/workshop';

const ports = [
  { provide: CustomerRepository, useClass: InMemoryCustomerRepository },
  { provide: VehicleRepository, useClass: InMemoryVehicleRepository },
  { provide: CatalogServiceRepository, useClass: InMemoryCatalogServiceRepository },
  { provide: PartRepository, useClass: InMemoryPartRepository },
  { provide: ServiceOrderRepository, useClass: InMemoryServiceOrderRepository },
  { provide: SagaRepository, useClass: InMemorySagaRepository },
  { provide: UserRepository, useClass: InMemoryUserRepository },
  { provide: MessagePublisher, useClass: RecordingMessagePublisher },
  { provide: CustomerNotifier, useClass: RecordingNotifier },
  { provide: BusinessMetrics, useClass: RecordingMetrics },
  { provide: PasswordHasher, useClass: PlainPasswordHasher },
  { provide: TokenIssuer, useClass: JwtTokenIssuer },
];

@Global()
@Module({
  imports: [JwtModule.register({ global: true, secret: 'test-secret' })],
  providers: ports,
  exports: ports.map((port) => port.provide),
})
class InMemoryInfrastructureModule {}

describe('OS Service API', () => {
  let app: INestApplication;
  let adminToken: string;
  let serviceId: string;
  let partId: string;

  const api = () => request(app.getHttpServer());
  const asAdmin = (test: request.Test) => test.set('Authorization', `Bearer ${adminToken}`);
  const customerToken = (customerId: string) =>
    app.get(JwtService).signAsync({ sub: customerId, role: 'CUSTOMER' });

  const openOrder = () =>
    asAdmin(api().post('/service-orders')).send({
      customer: { document: VALID_CPF, name: 'Maria Silva', email: 'maria@example.com' },
      vehicle: { plate: 'ABC1D23', brand: 'Fiat', model: 'Argo', year: 2022 },
      services: [{ serviceId }],
      parts: [{ partId, quantity: 2 }],
    });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [InMemoryInfrastructureModule, ApiModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    await app
      .get(UserRepository)
      .save(new User('admin-id', 'admin@oficina.com', 'hashed:secret', 'ADMIN'));
    const login = await api()
      .post('/auth/login')
      .send({ email: 'admin@oficina.com', password: 'secret' })
      .expect(200);
    adminToken = login.body.accessToken;
  });

  afterAll(() => app.close());

  it('rejects invalid credentials and unauthenticated requests', async () => {
    await api().post('/auth/login').send({ email: 'admin@oficina.com', password: 'x' }).expect(401);
    await api().get('/customers').expect(401);
    await api().get('/customers').set('Authorization', 'Bearer invalid').expect(401);
  });

  it('manages the service and parts catalog', async () => {
    const service = await asAdmin(api().post('/services'))
      .send({ name: 'Troca de óleo', price: 120, estimatedMinutes: 40 })
      .expect(201);
    serviceId = service.body.id;
    await asAdmin(api().put(`/services/${serviceId}`)).send({ price: 130 }).expect(200);
    await asAdmin(api().get(`/services/${serviceId}`)).expect(200);
    await asAdmin(api().get('/services')).expect(200);

    const part = await asAdmin(api().post('/parts'))
      .send({ name: 'Filtro de óleo', sku: 'FLT-001', price: 45.5 })
      .expect(201);
    partId = part.body.id;
    await asAdmin(api().put(`/parts/${partId}`)).send({ price: 50 }).expect(200);
    const stocked = await asAdmin(api().patch(`/parts/${partId}/stock`)).send({ delta: 10 }).expect(200);
    expect(stocked.body.stockQuantity).toBe(10);
    await asAdmin(api().get(`/parts/${partId}`)).expect(200);
    await asAdmin(api().get('/parts')).expect(200);

    await asAdmin(api().post('/parts')).send({ name: 'Filtro', sku: 'FLT-001', price: 1 }).expect(409);
    await asAdmin(api().post('/services')).send({ name: '', price: -1 }).expect(400);
  });

  it('manages customers and vehicles', async () => {
    const customer = await asAdmin(api().post('/customers'))
      .send({ name: 'Frota Ltda', document: '11.222.333/0001-81', email: 'frota@example.com' })
      .expect(201);
    const customerId = customer.body.id;
    expect(customer.body.documentType).toBe('CNPJ');

    await asAdmin(api().post('/customers'))
      .send({ name: 'Inválido', document: '11111111111', email: 'x@example.com' })
      .expect(422);
    await asAdmin(api().put(`/customers/${customerId}`)).send({ phone: '1133334444' }).expect(200);
    await asAdmin(api().get(`/customers/${customerId}`)).expect(200);
    await asAdmin(api().get('/customers?document=11222333000181')).expect(200);
    await asAdmin(api().get('/customers')).expect(200);
    await asAdmin(api().get('/customers/not-a-uuid')).expect(400);

    const vehicle = await asAdmin(api().post('/vehicles'))
      .send({ customerId, plate: 'XYZ-9876', brand: 'VW', model: 'Gol', year: 2019 })
      .expect(201);
    await asAdmin(api().put(`/vehicles/${vehicle.body.id}`)).send({ model: 'Polo' }).expect(200);
    await asAdmin(api().get(`/vehicles/${vehicle.body.id}`)).expect(200);
    await asAdmin(api().get(`/vehicles?customerId=${customerId}`)).expect(200);
    await asAdmin(api().delete(`/vehicles/${vehicle.body.id}`)).expect(204);

    await asAdmin(api().get(`/customers/${customerId}/service-orders`)).expect(200, []);
    await asAdmin(api().delete(`/customers/${customerId}`)).expect(204);
  });

  it('opens a service order and exposes its progress', async () => {
    const opened = await openOrder().expect(201);
    expect(opened.body).toMatchObject({ status: 'RECEIVED', totalAmount: 230 });
    const orderId = opened.body.id;

    const saga = app.get(ServiceOrderSaga);
    await saga.handle(Events.WORK_ORDER_OPENED, { orderId });
    await saga.handle(Events.DIAGNOSIS_STARTED, { orderId });

    const detail = await asAdmin(api().get(`/service-orders/${orderId}`)).expect(200);
    const ownerToken = await customerToken(detail.body.customerId);
    const strangerToken = await customerToken('00000000-0000-4000-8000-000000000000');

    const status = await api()
      .get(`/service-orders/${orderId}/status`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(status.body.status).toBe('IN_DIAGNOSIS');

    await api()
      .get(`/service-orders/${orderId}/status`)
      .set('Authorization', `Bearer ${strangerToken}`)
      .expect(403);
    await api().get('/service-orders').set('Authorization', `Bearer ${ownerToken}`).expect(403);

    const listed = await asAdmin(api().get('/service-orders')).expect(200);
    expect(listed.body).toHaveLength(1);
    await asAdmin(api().get('/service-orders/metrics')).expect(200);
    const sagaState = await asAdmin(api().get(`/service-orders/${orderId}/saga`)).expect(200);
    expect(sagaState.body.step).toBe('AWAIT_DIAGNOSIS');

    await asAdmin(api().post(`/service-orders/${orderId}/deliver`)).expect(422);
    const cancelled = await asAdmin(api().post(`/service-orders/${orderId}/cancel`))
      .send({ reason: 'Cliente desistiu' })
      .expect(200);
    expect(cancelled.body.status).toBe('CANCELLED');
  });

  it('validates the service order payload', async () => {
    await asAdmin(api().post('/service-orders'))
      .send({ customer: { document: VALID_CPF }, vehicle: { plate: 'ABC1D23' }, services: [] })
      .expect(400);
    await asAdmin(api().delete(`/services/${serviceId}`)).expect(204);
    await asAdmin(api().delete(`/parts/${partId}`)).expect(204);
    await openOrder().expect(404);
  });
});
