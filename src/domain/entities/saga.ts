export enum SagaStep {
  OPEN_WORK_ORDER = 'OPEN_WORK_ORDER',
  AWAIT_DIAGNOSIS = 'AWAIT_DIAGNOSIS',
  GENERATE_BUDGET = 'GENERATE_BUDGET',
  AWAIT_APPROVAL = 'AWAIT_APPROVAL',
  AWAIT_PAYMENT = 'AWAIT_PAYMENT',
  ENQUEUE_REPAIR = 'ENQUEUE_REPAIR',
  AWAIT_REPAIR = 'AWAIT_REPAIR',
  COMPENSATE_BILLING = 'COMPENSATE_BILLING',
  DONE = 'DONE',
}

export enum SagaStatus {
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  COMPENSATING = 'COMPENSATING',
  COMPENSATED = 'COMPENSATED',
}

export interface SagaLogEntry {
  message: string;
  step: SagaStep;
  status: SagaStatus;
  at: string;
}

const STEPS_WITH_BUDGET = [
  SagaStep.GENERATE_BUDGET,
  SagaStep.AWAIT_APPROVAL,
  SagaStep.AWAIT_PAYMENT,
  SagaStep.ENQUEUE_REPAIR,
  SagaStep.AWAIT_REPAIR,
];

export class Saga {
  constructor(
    readonly orderId: string,
    public step: SagaStep,
    public status: SagaStatus,
    readonly log: SagaLogEntry[],
  ) {}

  static start(orderId: string): Saga {
    return new Saga(orderId, SagaStep.OPEN_WORK_ORDER, SagaStatus.RUNNING, []);
  }

  get isRunning(): boolean {
    return this.status === SagaStatus.RUNNING;
  }

  get hasBudget(): boolean {
    return STEPS_WITH_BUDGET.includes(this.step);
  }

  isAt(steps: SagaStep[]): boolean {
    return steps.includes(this.step);
  }

  advanceTo(step: SagaStep): void {
    this.step = step;
  }

  complete(): void {
    this.step = SagaStep.DONE;
    this.status = SagaStatus.COMPLETED;
  }

  awaitBillingCompensation(): void {
    this.step = SagaStep.COMPENSATE_BILLING;
    this.status = SagaStatus.COMPENSATING;
  }

  markCompensated(): void {
    this.step = SagaStep.DONE;
    this.status = SagaStatus.COMPENSATED;
  }

  record(message: string, now = new Date()): void {
    this.log.push({ message, step: this.step, status: this.status, at: now.toISOString() });
  }
}
