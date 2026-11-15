import { CatalogService } from '../../src/domain/entities/catalog-service';
import { Customer } from '../../src/domain/entities/customer';
import { Part } from '../../src/domain/entities/part';
import { Saga, SagaStatus, SagaStep } from '../../src/domain/entities/saga';
import { ServiceOrder, ServiceOrderStatus } from '../../src/domain/entities/service-order';
import { Vehicle } from '../../src/domain/entities/vehicle';
import { DomainError } from '../../src/domain/errors';
import { Document } from '../../src/domain/value-objects/document';
import { LicensePlate } from '../../src/domain/value-objects/license-plate';
import { VALID_CNPJ, VALID_CPF } from '../support/workshop';

const CUSTOMER_ID = '7d0c9d5e-3b0f-4a53-9d2e-6f6f6a1d2c10';

const openOrder = () =>
  ServiceOrder.open({
    customerId: CUSTOMER_ID,
    vehicleId: CUSTOMER_ID,
    items: [
      { type: 'SERVICE', referenceId: CUSTOMER_ID, name: 'Alinhamento', unitPrice: 99.9, quantity: 1 },
      { type: 'PART', referenceId: CUSTOMER_ID, name: 'Pastilha', unitPrice: 50.05, quantity: 2 },
    ],
  });

describe('Document', () => {
  it.each([
    ['529.982.247-25', 'CPF', VALID_CPF],
    ['11.222.333/0001-81', 'CNPJ', VALID_CNPJ],
  ])('accepts %s as %s', (raw, type, digits) => {
    const document = Document.create(raw);
    expect(document.type).toBe(type);
    expect(document.value).toBe(digits);
  });

  it.each(['52998224724', '11111111111', '11222333000180', '00000000000000', '123', ''])(
    'rejects %s',
    (raw) => expect(() => Document.create(raw)).toThrow(DomainError),
  );
});

describe('LicensePlate', () => {
  it.each([
    ['abc-1234', 'ABC1234'],
    ['ABC1D23', 'ABC1D23'],
  ])('normalizes %s', (raw, expected) => expect(LicensePlate.create(raw).value).toBe(expected));

  it.each(['AB12345', 'ABCD123', 'ABC12D3', ''])('rejects %s', (raw) =>
    expect(() => LicensePlate.create(raw)).toThrow(DomainError),
  );
});

describe('Customer', () => {
  const register = (overrides = {}) =>
    Customer.register({ name: 'Maria', document: VALID_CPF, email: 'maria@example.com', ...overrides });

  it('registers, updates and deactivates', () => {
    const customer = register();
    customer.update({ name: 'Maria Silva', phone: '11999990000' });
    customer.deactivate();
    expect(customer).toMatchObject({ name: 'Maria Silva', phone: '11999990000', active: false });
  });

  it('rejects invalid data', () => {
    expect(() => register({ name: ' ' })).toThrow(DomainError);
    expect(() => register({ email: 'invalid' })).toThrow(DomainError);
    expect(() => register().update({ email: 'invalid' })).toThrow(DomainError);
  });
});

describe('Vehicle', () => {
  const register = (overrides = {}) =>
    Vehicle.register({
      customerId: CUSTOMER_ID,
      plate: 'ABC1234',
      brand: 'Fiat',
      model: 'Uno',
      year: 2015,
      ...overrides,
    });

  it('registers and updates', () => {
    const vehicle = register();
    vehicle.update({ model: 'Argo', year: 2022 });
    expect(vehicle).toMatchObject({ brand: 'Fiat', model: 'Argo', year: 2022 });
  });

  it('rejects invalid data', () => {
    expect(() => register({ brand: '' })).toThrow(DomainError);
    expect(() => register({ model: '' })).toThrow(DomainError);
    expect(() => register({ year: 1800 })).toThrow(DomainError);
    expect(() => register({ year: 2020.5 })).toThrow(DomainError);
  });
});

describe('CatalogService', () => {
  it('registers, updates and deactivates', () => {
    const service = CatalogService.register({ name: 'Balanceamento', price: 80, estimatedMinutes: 30 });
    service.update({ price: 90, description: 'Quatro rodas' });
    service.deactivate();
    expect(service).toMatchObject({ price: 90, description: 'Quatro rodas', active: false });
  });

  it('rejects invalid data', () => {
    const data = { name: 'Balanceamento', price: 80, estimatedMinutes: 30 };
    expect(() => CatalogService.register({ ...data, name: '' })).toThrow(DomainError);
    expect(() => CatalogService.register({ ...data, price: -1 })).toThrow(DomainError);
    expect(() => CatalogService.register({ ...data, estimatedMinutes: 0 })).toThrow(DomainError);
  });
});

describe('Part', () => {
  const register = (overrides = {}) =>
    Part.register({ name: 'Filtro', sku: 'FLT-1', price: 30, stockQuantity: 5, ...overrides });

  it('adjusts stock within available quantity', () => {
    const part = register();
    part.adjustStock(5);
    part.adjustStock(-8);
    expect(part.stockQuantity).toBe(2);
    expect(() => part.adjustStock(-3)).toThrow('Insufficient stock');
    expect(() => part.adjustStock(0)).toThrow(DomainError);
  });

  it('updates and deactivates', () => {
    const part = register({ stockQuantity: undefined });
    part.update({ price: 35 });
    part.deactivate();
    expect(part).toMatchObject({ price: 35, stockQuantity: 0, active: false });
  });

  it('rejects invalid data', () => {
    expect(() => register({ name: '' })).toThrow(DomainError);
    expect(() => register({ sku: '' })).toThrow(DomainError);
    expect(() => register({ price: -1 })).toThrow(DomainError);
    expect(() => register({ stockQuantity: -1 })).toThrow(DomainError);
  });
});

describe('ServiceOrder', () => {
  it('opens as received with the budget total', () => {
    const order = openOrder();
    expect(order.status).toBe(ServiceOrderStatus.RECEIVED);
    expect(order.totalAmount).toBe(200);
    expect(order.parts).toHaveLength(1);
    expect(order.previousStatusChange).toBeUndefined();
  });

  it('requires at least one service and positive quantities', () => {
    const part = { type: 'PART' as const, referenceId: CUSTOMER_ID, name: 'Pastilha', unitPrice: 50, quantity: 1 };
    const service = { ...part, type: 'SERVICE' as const };
    const open = (items: any[]) =>
      ServiceOrder.open({ customerId: CUSTOMER_ID, vehicleId: CUSTOMER_ID, items });
    expect(() => open([part])).toThrow(DomainError);
    expect(() => open([{ ...service, quantity: 0 }])).toThrow(DomainError);
  });

  it('follows the full lifecycle recording history and timestamps', () => {
    const order = openOrder();
    order.startDiagnosis();
    order.awaitApproval();
    order.registerPaymentUrl('https://pay.example/1');
    order.startExecution();
    order.finish();
    order.deliver();

    expect(order.history.map((change) => change.status)).toEqual([
      ServiceOrderStatus.RECEIVED,
      ServiceOrderStatus.IN_DIAGNOSIS,
      ServiceOrderStatus.AWAITING_APPROVAL,
      ServiceOrderStatus.IN_EXECUTION,
      ServiceOrderStatus.FINISHED,
      ServiceOrderStatus.DELIVERED,
    ]);
    expect(order.paymentUrl).toBe('https://pay.example/1');
    expect(order.startedAt && order.finishedAt && order.deliveredAt).toBeTruthy();
    expect(order.previousStatusChange?.status).toBe(ServiceOrderStatus.FINISHED);
  });

  it('rejects invalid transitions', () => {
    const order = openOrder();
    expect(() => order.finish()).toThrow(DomainError);
    order.cancel('Cliente desistiu');
    expect(order.cancellationReason).toBe('Cliente desistiu');
    expect(() => order.startDiagnosis()).toThrow(DomainError);
  });
});

describe('Saga', () => {
  it('tracks steps, compensation and log', () => {
    const saga = Saga.start(CUSTOMER_ID);
    expect(saga.isRunning).toBe(true);
    expect(saga.hasBudget).toBe(false);

    saga.advanceTo(SagaStep.AWAIT_PAYMENT);
    expect(saga.hasBudget).toBe(true);
    expect(saga.isAt([SagaStep.AWAIT_PAYMENT])).toBe(true);

    saga.awaitBillingCompensation();
    saga.record('compensating');
    expect(saga.status).toBe(SagaStatus.COMPENSATING);

    saga.markCompensated();
    expect(saga).toMatchObject({ step: SagaStep.DONE, status: SagaStatus.COMPENSATED });
    expect(saga.log[0]).toMatchObject({ message: 'compensating', step: SagaStep.COMPENSATE_BILLING });

    const completed = Saga.start(CUSTOMER_ID);
    completed.complete();
    expect(completed.status).toBe(SagaStatus.COMPLETED);
  });
});
