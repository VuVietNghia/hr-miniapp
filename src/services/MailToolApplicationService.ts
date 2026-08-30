import type { VerifiedActor } from '@privos_ai/app-server';

import type { MailToolService } from '../composition/application-services';
import type { MailRetryInput, MailSendInput } from '../mcp/tool-inputs';
import { isValidEmailAddress } from '../utils/email-validation';
import type { MailDeliveryGateway } from './TrackedMailService';
import { TrackedMailService } from './TrackedMailService';

function requireActor(actor: VerifiedActor | undefined): string {
  const userId = actor?.userId.trim();
  if (!userId) throw new Error('Verified actor is required');
  return userId;
}

function requireTrackedRoom(
  contextRoomId: string | undefined,
  compatibilityRoomId: string | undefined,
): string {
  if (!contextRoomId?.trim()) {
    throw new Error('Tracked mail Room context is invalid');
  }
  if (compatibilityRoomId !== undefined && compatibilityRoomId !== contextRoomId) {
    throw new Error('Tracked mail Room context is invalid');
  }
  return contextRoomId;
}

function hasTrackedMetadata(input: MailSendInput): boolean {
  return input.roomId !== undefined
    || input.source !== undefined
    || input.cvItemId !== undefined
    || input.cvListId !== undefined
    || input.jdName !== undefined;
}

function validateSendInput(input: MailSendInput): void {
  if (!input.toName || !input.toEmail || !input.subject || !input.htmlContent) {
    throw new Error('Missing required arguments for hrm.mail.send');
  }
  if (!isValidEmailAddress(input.toEmail)) {
    throw new Error('Recipient email is invalid for hrm.mail.send');
  }
}

function deliveryParams(input: MailSendInput) {
  return {
    toName: input.toName,
    toEmail: input.toEmail,
    subject: input.subject,
    htmlContent: input.htmlContent,
  };
}

export class MailToolApplicationService implements MailToolService {
  constructor(
    private readonly trackedMail: TrackedMailService,
    private readonly delivery: MailDeliveryGateway,
  ) {}

  async send(
    input: MailSendInput,
    actor: VerifiedActor | undefined,
    contextRoomId: string | undefined,
  ): Promise<unknown> {
    const requestedBy = requireActor(actor);
    validateSendInput(input);
    if (!hasTrackedMetadata(input)) {
      await this.delivery.queueMail(deliveryParams(input));
      return { content: [{ type: 'text', text: 'Email has been sent successfully.' }] };
    }

    const roomId = requireTrackedRoom(contextRoomId, input.roomId);
    if (input.source !== 'cv_scored' && input.source !== 'lifecycle') {
      throw new Error('Tracked mail requires a supported source');
    }
    const record = await this.trackedMail.send({
      roomId,
      requestedBy,
      source: input.source,
      recipientName: input.toName,
      recipientEmail: input.toEmail,
      subject: input.subject,
      htmlContent: input.htmlContent,
      ...(input.cvItemId ? { cvItemId: input.cvItemId } : {}),
      ...(input.cvListId ? { cvListId: input.cvListId } : {}),
      ...(input.jdName ? { jdName: input.jdName } : {}),
    });
    return {
      content: [{ type: 'text', text: JSON.stringify({ itemId: record.id, status: record.status }) }],
    };
  }

  async retry(
    input: MailRetryInput,
    actor: VerifiedActor | undefined,
    contextRoomId: string | undefined,
  ): Promise<unknown> {
    requireActor(actor);
    const roomId = requireTrackedRoom(contextRoomId, input.roomId);
    const record = await this.trackedMail.retry(roomId, input.itemId);
    return {
      content: [{ type: 'text', text: JSON.stringify({ itemId: record.id, status: record.status }) }],
    };
  }
}
