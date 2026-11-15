import { randomUUID } from 'node:crypto';
import { DomainError } from '../errors';

export enum ServiceOrderStatus {
  RECEIVED = 'RECEIVED',
  IN_DIAGNOSIS = 'IN_DIAGNOSIS',
  AWAITING_APPROVAL = 'AWAITING_APPROVAL',
  IN_EXECUTION = 'IN_EXECUTION',
  FINISHED = 'FINISHED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

const ALLOWED_TRANSITIONS: Record<ServiceOrderStatus, ServiceOrderStatus[]> = {
  [ServiceOrderStatus.RECEIVED]: [ServiceOrderStatus.IN_DIAGNOSIS, ServiceOrderStatus.CANCELLED],
  [ServiceOrderStatus.IN_DIAGNOSIS]: [
    ServiceOrderStatus.AWAITING_APPROVAL,
    ServiceOrderStatus.CANCELLED,
  ],
  [ServiceOrderStatus.AWAITING_APPROVAL]: [
    ServiceOrderStatus.IN_EXECUTION,
    ServiceOrderStatus.CANCELLED,
  ],
  [ServiceOrderStatus.IN_EXECUTION]: [ServiceOrderStatus.FINISHED, ServiceOrderStatus.CANCELLED],
  [ServiceOrderStatus.FINISHED]: [ServiceOrderStatus.DELIVERED],
  [ServiceOrderStatus.DELIVERED]: [],
  [ServiceOrderStatus.CANCELLED]: [],
};

export const ACTIVE_STATUSES_BY_PRIORITY = [
  ServiceOrderStatus.IN_EXECUTION,
  ServiceOrderStatus.AWAITING_APPROVAL,
  ServiceOrderStatus.IN_DIAGNOSIS,
  ServiceOrderStatus.RECEIVED,
];

export type ItemType = 'SERVICE' | 'PART';

export interface ServiceOrderItem {
  id: string;
  type: ItemType;
  referenceId: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

export interface StatusChange {
  id: string;
  status: ServiceOrderStatus;
  changedAt: Date;
}

export interface ServiceOrderProps {
  id: string;
  customerId: string;
  vehicleId: string;
  status: ServiceOrderStatus;
  items: ServiceOrderItem[];
  history: StatusChange[];
  totalAmount: number;
  paymentUrl: string | null;
  cancellationReason: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  deliveredAt: Date | null;
}

const roundMoney = (value: number) => Math.round(value * 100) / 100;

export class ServiceOrder {
  private constructor(private readonly props: ServiceOrderProps) {}

  static open(
    input: { customerId: string; vehicleId: string; items: Omit<ServiceOrderItem, 'id'>[] },
    now = new Date(),
  ): ServiceOrder {
    if (!input.items.some((item) => item.type === 'SERVICE')) {
      throw new DomainError('A service order requires at least one service');
    }
    if (input.items.some((item) => !Number.isInteger(item.quantity) || item.quantity <= 0)) {
      throw new DomainError('Item quantity must be a positive integer');
    }
    const items = input.items.map((item) => ({ ...item, id: randomUUID() }));
    return new ServiceOrder({
      id: randomUUID(),
      customerId: input.customerId,
      vehicleId: input.vehicleId,
      status: ServiceOrderStatus.RECEIVED,
      items,
      history: [{ id: randomUUID(), status: ServiceOrderStatus.RECEIVED, changedAt: now }],
      totalAmount: roundMoney(
        items.reduce((total, item) => total + item.unitPrice * item.quantity, 0),
      ),
      paymentUrl: null,
      cancellationReason: null,
      createdAt: now,
      startedAt: null,
      finishedAt: null,
      deliveredAt: null,
    });
  }

  static restore(props: ServiceOrderProps): ServiceOrder {
    return new ServiceOrder(props);
  }

  get id() {
    return this.props.id;
  }

  get customerId() {
    return this.props.customerId;
  }

  get vehicleId() {
    return this.props.vehicleId;
  }

  get status() {
    return this.props.status;
  }

  get items(): readonly ServiceOrderItem[] {
    return this.props.items;
  }

  get parts(): readonly ServiceOrderItem[] {
    return this.props.items.filter((item) => item.type === 'PART');
  }

  get history(): readonly StatusChange[] {
    return this.props.history;
  }

  get totalAmount() {
    return this.props.totalAmount;
  }

  get paymentUrl() {
    return this.props.paymentUrl;
  }

  get cancellationReason() {
    return this.props.cancellationReason;
  }

  get createdAt() {
    return this.props.createdAt;
  }

  get startedAt() {
    return this.props.startedAt;
  }

  get finishedAt() {
    return this.props.finishedAt;
  }

  get deliveredAt() {
    return this.props.deliveredAt;
  }

  get previousStatusChange(): StatusChange | undefined {
    return this.props.history.at(-2);
  }

  get lastStatusChange(): StatusChange {
    return this.props.history.at(-1)!;
  }

  startDiagnosis(now = new Date()): void {
    this.transitionTo(ServiceOrderStatus.IN_DIAGNOSIS, now);
  }

  awaitApproval(now = new Date()): void {
    this.transitionTo(ServiceOrderStatus.AWAITING_APPROVAL, now);
  }

  registerPaymentUrl(url: string): void {
    this.props.paymentUrl = url;
  }

  startExecution(now = new Date()): void {
    this.transitionTo(ServiceOrderStatus.IN_EXECUTION, now);
    this.props.startedAt = now;
  }

  finish(now = new Date()): void {
    this.transitionTo(ServiceOrderStatus.FINISHED, now);
    this.props.finishedAt = now;
  }

  deliver(now = new Date()): void {
    this.transitionTo(ServiceOrderStatus.DELIVERED, now);
    this.props.deliveredAt = now;
  }

  cancel(reason: string, now = new Date()): void {
    this.transitionTo(ServiceOrderStatus.CANCELLED, now);
    this.props.cancellationReason = reason;
  }

  private transitionTo(next: ServiceOrderStatus, now: Date): void {
    if (!ALLOWED_TRANSITIONS[this.props.status].includes(next)) {
      throw new DomainError(`Cannot change service order from ${this.props.status} to ${next}`);
    }
    this.props.status = next;
    this.props.history.push({ id: randomUUID(), status: next, changedAt: now });
  }
}
