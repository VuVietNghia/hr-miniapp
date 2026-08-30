import { TaskQueue } from '../utils/TaskQueue';
import type { MailDeliveryClient } from './EmailJsMailClient';
import type { MailDeliveryGateway } from './TrackedMailService';

export interface SendMailParams {
  toName: string;
  toEmail: string;
  subject: string;
  htmlContent: string;
}

export class MailService implements MailDeliveryGateway {
  constructor(
    private readonly queue: TaskQueue,
    private readonly client: MailDeliveryClient,
  ) {}

  /**
   * Đưa tác vụ gửi mail vào hàng đợi (Queue)
   */
  public async queueMail(params: SendMailParams): Promise<void> {
    await this.queue.enqueue(() => this.client.send(params));
  }
}
