import assert from 'node:assert/strict';
import { Before, Given, Then, When } from '@cucumber/cucumber';
import { Commands, Events } from '../../../src/application/messaging-contracts';
import { ServiceOrder } from '../../../src/domain/entities/service-order';
import { buildWorkshop, Workshop } from '../../support/workshop';

interface Scenario {
  workshop: Workshop;
  order: ServiceOrder;
}

const reply = async (scenario: Scenario, ...events: string[]) => {
  for (const event of events) {
    await scenario.workshop.saga.handle(event, { orderId: scenario.order.id });
  }
};

Before(function (this: Scenario) {
  this.workshop = buildWorkshop();
});

Given('um serviço {string} no catálogo por {float}', function (this: Scenario, name: string, price: number) {
  this.workshop.oilChange.update({ name, price });
});

Given(
  'uma peça {string} com {int} unidades em estoque por {float}',
  function (this: Scenario, name: string, stock: number, price: number) {
    this.workshop.oilFilter.update({ name, price });
    this.workshop.oilFilter.stockQuantity = stock;
  },
);

When(
  'o atendente abre uma ordem de serviço com {int} unidades da peça',
  async function (this: Scenario, quantity: number) {
    this.order = await this.workshop.openDefaultOrder(quantity);
  },
);

When('o mecânico inicia e conclui o diagnóstico', async function (this: Scenario) {
  await reply(this, Events.WORK_ORDER_OPENED, Events.DIAGNOSIS_STARTED, Events.DIAGNOSIS_COMPLETED);
});

When('o orçamento é gerado', async function (this: Scenario) {
  await reply(this, Events.BUDGET_GENERATED);
});

When('o cliente aprova o orçamento e o pagamento é confirmado', async function (this: Scenario) {
  await reply(this, Events.BUDGET_APPROVED, Events.PAYMENT_CONFIRMED, Events.REPAIR_QUEUED);
});

When('o cliente recusa o orçamento', async function (this: Scenario) {
  await reply(this, Events.BUDGET_REJECTED);
});

When('o mecânico inicia e conclui o reparo', async function (this: Scenario) {
  await reply(this, Events.REPAIR_STARTED, Events.REPAIR_COMPLETED);
});

When('o reparo falha', async function (this: Scenario) {
  await reply(this, Events.REPAIR_FAILED);
});

When('o estorno é confirmado', async function (this: Scenario) {
  await reply(this, Events.PAYMENT_REFUNDED);
});

When('o atendente entrega o veículo', async function (this: Scenario) {
  await this.workshop.deliverServiceOrder.execute(this.order.id);
});

Then('a ordem de serviço fica com status {string}', function (this: Scenario, status: string) {
  assert.equal(this.order.status, status);
});

Then('o orçamento da ordem de serviço é {float}', function (this: Scenario, total: number) {
  assert.equal(this.order.totalAmount, total);
});

Then('o estoque da peça passa a ser {int}', function (this: Scenario, stock: number) {
  assert.equal(this.workshop.oilFilter.stockQuantity, stock);
});

Then('a saga termina como {string}', function (this: Scenario, status: string) {
  assert.equal(this.workshop.sagas.items.get(this.order.id)?.status, status);
});

Then('a execução recebe o comando de cancelamento', function (this: Scenario) {
  assert.ok(this.workshop.publisher.routingKeys().includes(Commands.CANCEL_WORK_ORDER));
});

Then('o faturamento recebe o comando de estorno', function (this: Scenario) {
  assert.ok(this.workshop.publisher.routingKeys().includes(Commands.CANCEL_BUDGET));
});
