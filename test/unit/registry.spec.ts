import { AuthenticateAdmin } from '../../src/application/use-cases/authenticate-admin';
import { ManageCatalogServices } from '../../src/application/use-cases/manage-catalog-services';
import { ManageCustomers } from '../../src/application/use-cases/manage-customers';
import { ManageParts } from '../../src/application/use-cases/manage-parts';
import { ManageVehicles } from '../../src/application/use-cases/manage-vehicles';
import { User } from '../../src/domain/entities/user';
import { ConflictError, InvalidCredentialsError, NotFoundError } from '../../src/domain/errors';
import {
  FakeTokenIssuer,
  InMemoryCatalogServiceRepository,
  InMemoryCustomerRepository,
  InMemoryPartRepository,
  InMemoryUserRepository,
  PlainPasswordHasher,
} from '../support/in-memory';
import { buildWorkshop, VALID_CPF } from '../support/workshop';

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';
const customerData = { name: 'Maria', document: VALID_CPF, email: 'maria@example.com' };

describe('ManageCustomers', () => {
  const manage = () => new ManageCustomers(new InMemoryCustomerRepository());

  it('creates, finds, updates and deactivates', async () => {
    const customers = manage();
    const created = await customers.create(customerData);

    await expect(customers.findByDocument('529.982.247-25')).resolves.toBe(created);
    await customers.update(created.id, { name: 'Maria Silva' });
    expect((await customers.findById(created.id)).name).toBe('Maria Silva');

    await customers.remove(created.id);
    await expect(customers.list()).resolves.toHaveLength(0);
  });

  it('rejects duplicated documents and unknown customers', async () => {
    const customers = manage();
    await customers.create(customerData);
    await expect(customers.create(customerData)).rejects.toThrow(ConflictError);
    await expect(customers.findById(UNKNOWN_ID)).rejects.toThrow(NotFoundError);
    await expect(customers.findByDocument('11222333000181')).rejects.toThrow(NotFoundError);
  });
});

describe('ManageVehicles', () => {
  const setup = async () => {
    const workshop = buildWorkshop();
    const customer = await new ManageCustomers(workshop.customers).create(customerData);
    const vehicles = new ManageVehicles(workshop.vehicles, workshop.customers, workshop.orders);
    const data = { customerId: customer.id, plate: 'XYZ9A87', brand: 'VW', model: 'Gol', year: 2019 };
    return { workshop, vehicles, data };
  };

  it('creates, lists, updates and removes', async () => {
    const { vehicles, data } = await setup();
    const vehicle = await vehicles.create(data);

    await vehicles.update(vehicle.id, { model: 'Polo' });
    await expect(vehicles.list(data.customerId)).resolves.toEqual([
      expect.objectContaining({ model: 'Polo' }),
    ]);

    await vehicles.remove(vehicle.id);
    await expect(vehicles.findById(vehicle.id)).rejects.toThrow(NotFoundError);
  });

  it('rejects unknown customers and duplicated plates', async () => {
    const { vehicles, data } = await setup();
    await vehicles.create(data);
    await expect(vehicles.create(data)).rejects.toThrow(ConflictError);
    await expect(vehicles.create({ ...data, customerId: UNKNOWN_ID })).rejects.toThrow(NotFoundError);
  });

  it('keeps vehicles that have service orders', async () => {
    const { workshop, vehicles } = await setup();
    const order = await workshop.openServiceOrder.execute({
      customer: { document: VALID_CPF },
      vehicle: { plate: 'ABC1D23', brand: 'Fiat', model: 'Argo', year: 2022 },
      services: [{ serviceId: workshop.oilChange.id }],
    });
    await expect(vehicles.remove(order.vehicleId)).rejects.toThrow(ConflictError);
  });
});

describe('ManageCatalogServices', () => {
  it('creates, updates and deactivates', async () => {
    const services = new ManageCatalogServices(new InMemoryCatalogServiceRepository());
    const service = await services.create({ name: 'Alinhamento', price: 100, estimatedMinutes: 45 });

    await services.update(service.id, { price: 110 });
    expect((await services.findById(service.id)).price).toBe(110);

    await services.remove(service.id);
    await expect(services.list()).resolves.toHaveLength(0);
    await expect(services.findById(UNKNOWN_ID)).rejects.toThrow(NotFoundError);
  });
});

describe('ManageParts', () => {
  it('creates, updates, adjusts stock and deactivates', async () => {
    const parts = new ManageParts(new InMemoryPartRepository());
    const data = { name: 'Vela', sku: 'VEL-1', price: 25 };
    const part = await parts.create(data);

    await expect(parts.create(data)).rejects.toThrow(ConflictError);
    await parts.update(part.id, { price: 27 });
    expect((await parts.adjustStock(part.id, 8)).stockQuantity).toBe(8);
    await expect(parts.adjustStock(part.id, -9)).rejects.toThrow('Insufficient stock');

    await parts.remove(part.id);
    await expect(parts.list()).resolves.toHaveLength(0);
    await expect(parts.findById(UNKNOWN_ID)).rejects.toThrow(NotFoundError);
  });
});

describe('AuthenticateAdmin', () => {
  const setup = async () => {
    const users = new InMemoryUserRepository();
    await users.save(new User('admin-id', 'admin@oficina.com', 'hashed:secret', 'ADMIN'));
    return new AuthenticateAdmin(users, new PlainPasswordHasher(), new FakeTokenIssuer());
  };

  it('issues a token for valid credentials', async () => {
    const authenticate = await setup();
    await expect(authenticate.execute('admin@oficina.com', 'secret')).resolves.toEqual({
      accessToken: 'token:admin-id:ADMIN',
    });
  });

  it('rejects invalid credentials', async () => {
    const authenticate = await setup();
    await expect(authenticate.execute('admin@oficina.com', 'wrong')).rejects.toThrow(InvalidCredentialsError);
    await expect(authenticate.execute('other@oficina.com', 'secret')).rejects.toThrow(InvalidCredentialsError);
  });
});
