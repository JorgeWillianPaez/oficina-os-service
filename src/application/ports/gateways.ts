import { ServiceOrder } from '../../domain/entities/service-order';
import { Role } from '../../domain/entities/user';

export abstract class MessagePublisher {
  abstract publish(routingKey: string, payload: object): Promise<void>;
}

export interface StatusNotification {
  to: string;
  customerName: string;
  orderId: string;
  status: string;
  totalAmount: number;
  paymentUrl: string | null;
  cancellationReason: string | null;
}

export abstract class CustomerNotifier {
  abstract statusChanged(notification: StatusNotification): Promise<void>;
}

export abstract class BusinessMetrics {
  abstract orderStatusChanged(order: ServiceOrder): void;
  abstract sagaCompensated(orderId: string, reason: string): void;
}

export abstract class PasswordHasher {
  abstract hash(plain: string): Promise<string>;
  abstract matches(plain: string, hash: string): Promise<boolean>;
}

export interface TokenPayload {
  sub: string;
  role: Role;
}

export abstract class TokenIssuer {
  abstract issue(payload: TokenPayload): Promise<string>;
}
