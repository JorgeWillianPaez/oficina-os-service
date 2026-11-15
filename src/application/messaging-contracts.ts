export const Commands = {
  OPEN_WORK_ORDER: 'execution.command.open-work-order',
  ENQUEUE_REPAIR: 'execution.command.enqueue-repair',
  CANCEL_WORK_ORDER: 'execution.command.cancel-work-order',
  GENERATE_BUDGET: 'billing.command.generate-budget',
  CANCEL_BUDGET: 'billing.command.cancel-budget',
} as const;

export const Events = {
  WORK_ORDER_OPENED: 'execution.event.work-order-opened',
  WORK_ORDER_OPEN_FAILED: 'execution.event.work-order-open-failed',
  DIAGNOSIS_STARTED: 'execution.event.diagnosis-started',
  DIAGNOSIS_COMPLETED: 'execution.event.diagnosis-completed',
  REPAIR_QUEUED: 'execution.event.repair-queued',
  REPAIR_STARTED: 'execution.event.repair-started',
  REPAIR_COMPLETED: 'execution.event.repair-completed',
  REPAIR_FAILED: 'execution.event.repair-failed',
  BUDGET_GENERATED: 'billing.event.budget-generated',
  BUDGET_GENERATION_FAILED: 'billing.event.budget-generation-failed',
  BUDGET_APPROVED: 'billing.event.budget-approved',
  BUDGET_REJECTED: 'billing.event.budget-rejected',
  BUDGET_CANCELLED: 'billing.event.budget-cancelled',
  PAYMENT_CONFIRMED: 'billing.event.payment-confirmed',
  PAYMENT_FAILED: 'billing.event.payment-failed',
  PAYMENT_REFUNDED: 'billing.event.payment-refunded',
} as const;

export const SAGA_REPLY_BINDINGS = ['execution.event.*', 'billing.event.*'];

export interface SagaReply {
  orderId: string;
  reason?: string;
  checkoutUrl?: string;
}
