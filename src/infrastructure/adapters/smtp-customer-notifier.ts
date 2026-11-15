import { Injectable, Logger } from '@nestjs/common';
import { createTransport, Transporter } from 'nodemailer';
import { CustomerNotifier, StatusNotification } from '../../application/ports/gateways';
import { config } from '../../config';

const STATUS_LABELS: Record<string, string> = {
  RECEIVED: 'Recebida',
  IN_DIAGNOSIS: 'Em diagnóstico',
  AWAITING_APPROVAL: 'Aguardando aprovação',
  IN_EXECUTION: 'Em execução',
  FINISHED: 'Finalizada',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelada',
};

@Injectable()
export class SmtpCustomerNotifier implements CustomerNotifier {
  private readonly logger = new Logger(SmtpCustomerNotifier.name);
  private readonly transporter?: Transporter = config.smtp.host
    ? createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        auth: config.smtp.user
          ? { user: config.smtp.user, pass: config.smtp.password }
          : undefined,
      })
    : undefined;

  async statusChanged(notification: StatusNotification): Promise<void> {
    if (!this.transporter) return;
    const status = STATUS_LABELS[notification.status] ?? notification.status;
    const lines = [
      `Olá, ${notification.customerName}.`,
      `Sua ordem de serviço ${notification.orderId} está com o status: ${status}.`,
      `Valor total: R$ ${notification.totalAmount.toFixed(2)}.`,
      notification.cancellationReason && `Motivo: ${notification.cancellationReason}.`,
    ];
    try {
      await this.transporter.sendMail({
        from: config.smtp.from,
        to: notification.to,
        subject: `Ordem de serviço ${status}`,
        text: lines.filter(Boolean).join('\n'),
      });
    } catch (error) {
      this.logger.error({
        msg: 'E-mail integration failed',
        integration: 'smtp',
        orderId: notification.orderId,
        err: error,
      });
    }
  }
}
