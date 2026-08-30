import { describe, expect, it } from 'vitest';

import type {
  EmailHistoryRecord,
  StoredEmailPayload,
} from '../../src/email-history/email-history-model';
import {
  type EmailHistoryGateway,
  type MailDeliveryGateway,
  TrackedMailService,
} from '../../src/services/TrackedMailService';

const payload: StoredEmailPayload = {
  source: 'cv_scored',
  recipientName: 'Candidate',
  recipientEmail: 'candidate@example.test',
  subject: 'Interview',
  htmlContent: 'mail-content',
};

function record(status: EmailHistoryRecord['status']): EmailHistoryRecord {
  return {
    id: 'item-1',
    listId: 'list-1',
    stageId: status === 'sent' ? 'stage-sent' : 'stage-failed',
    status,
    ...payload,
    createdAt: '2026-08-30T00:00:00.000Z',
    updatedAt: '2026-08-30T00:00:00.000Z',
    attemptCount: 1,
  };
}

class FakeHistory implements EmailHistoryGateway {
  readonly readinessChecks: Array<{ roomId: string; requiresStageMovement: boolean }> = [];
  readonly created: Array<{ status: EmailHistoryRecord['status']; requestedBy?: string }> = [];
  readonly markedFailed: string[] = [];
  readonly markedSent: string[] = [];
  preparedRecord = record('failed');
  createFailure: Error | undefined;
  readinessFailure: Error | undefined;

  async assertReadyForTrackedWrite(
    roomId: string,
    requiresStageMovement: boolean,
  ): Promise<void> {
    this.readinessChecks.push({ roomId, requiresStageMovement });
    if (this.readinessFailure) throw this.readinessFailure;
  }

  async createResult(
    _roomId: string,
    _payload: StoredEmailPayload,
    status: EmailHistoryRecord['status'],
    _error?: unknown,
    requestedBy?: string,
  ): Promise<EmailHistoryRecord> {
    if (this.createFailure) throw this.createFailure;
    this.created.push({ status, requestedBy });
    return record(status);
  }

  async markSent(_roomId: string, itemId: string): Promise<EmailHistoryRecord> {
    this.markedSent.push(itemId);
    return record('sent');
  }

  async markFailed(
    _roomId: string,
    itemId: string,
    _error: unknown,
  ): Promise<EmailHistoryRecord> {
    this.markedFailed.push(itemId);
    return record('failed');
  }

  async prepareRetry(): Promise<{
    record: EmailHistoryRecord;
    payload: StoredEmailPayload;
  }> {
    return { record: this.preparedRecord, payload };
  }
}

class FakeDelivery implements MailDeliveryGateway {
  calls = 0;
  failure: Error | undefined;
  waitFor: Promise<void> | undefined;

  async queueMail(): Promise<void> {
    this.calls += 1;
    if (this.waitFor) await this.waitFor;
    if (this.failure) throw this.failure;
  }
}

function deferred(): {
  promise: Promise<void>;
  resolve: () => void;
} {
  let resolvePromise: (() => void) | undefined;
  const promise = new Promise<void>(resolve => {
    resolvePromise = resolve;
  });
  return {
    promise,
    resolve: () => resolvePromise?.(),
  };
}

describe('TrackedMailService', () => {
  it('records sent after delivery succeeds', async () => {
    const history = new FakeHistory();
    const delivery = new FakeDelivery();
    const service = new TrackedMailService(history, delivery);

    const result = await service.send({ roomId: 'room-1', requestedBy: 'actor-1', ...payload });

    expect(result.status).toBe('sent');
    expect(history.created).toEqual([{ status: 'sent', requestedBy: 'actor-1' }]);
  });

  it('records failed and rethrows the original delivery error', async () => {
    const history = new FakeHistory();
    const delivery = new FakeDelivery();
    const deliveryError = new Error('provider unavailable');
    delivery.failure = deliveryError;
    const service = new TrackedMailService(history, delivery);

    await expect(service.send({ roomId: 'room-1', ...payload })).rejects.toBe(deliveryError);
    expect(history.created).toEqual([{ status: 'failed', requestedBy: undefined }]);
  });

  it('reports the combined Vietnamese error when delivery and history both fail', async () => {
    const history = new FakeHistory();
    history.createFailure = new Error('history unavailable');
    const delivery = new FakeDelivery();
    delivery.failure = new Error('provider unavailable');
    const service = new TrackedMailService(history, delivery);

    await expect(service.send({ roomId: 'room-1', ...payload })).rejects.toThrow(
      'Gửi email thất bại và không thể lưu lịch sử: history unavailable',
    );
  });

  it('reports that delivery succeeded when sent history persistence fails', async () => {
    const history = new FakeHistory();
    history.createFailure = new Error('history unavailable');
    const service = new TrackedMailService(history, new FakeDelivery());

    await expect(service.send({ roomId: 'room-1', ...payload })).rejects.toThrow(
      'Email đã gửi nhưng không thể lưu lịch sử: history unavailable',
    );
  });

  it('allows retry only for a failed record', async () => {
    const history = new FakeHistory();
    history.preparedRecord = record('sent');
    const delivery = new FakeDelivery();
    const service = new TrackedMailService(history, delivery);

    await expect(service.retry('room-1', 'item-1')).rejects.toThrow(
      'Chỉ có thể gửi lại email ở trạng thái Gửi lỗi.',
    );
    expect(delivery.calls).toBe(0);
  });

  it('rejects a concurrent retry for the same room and item', async () => {
    const gate = deferred();
    const deliveryStarted = deferred();
    const history = new FakeHistory();
    const delivery = new FakeDelivery();
    delivery.waitFor = gate.promise;
    const originalQueueMail = delivery.queueMail.bind(delivery);
    delivery.queueMail = async () => {
      deliveryStarted.resolve();
      await originalQueueMail();
    };
    const service = new TrackedMailService(history, delivery);

    const firstRetry = service.retry('room-1', 'item-1');
    await deliveryStarted.promise;
    await expect(service.retry('room-1', 'item-1')).rejects.toThrow(
      'Email này đang được gửi lại. Vui lòng chờ kết quả.',
    );
    gate.resolve();
    await expect(firstRetry).resolves.toMatchObject({ status: 'sent' });
  });

  it('marks the record failed when retry delivery fails', async () => {
    const history = new FakeHistory();
    const delivery = new FakeDelivery();
    const deliveryError = new Error('provider unavailable');
    delivery.failure = deliveryError;
    const service = new TrackedMailService(history, delivery);

    await expect(service.retry('room-1', 'item-1')).rejects.toBe(deliveryError);
    expect(history.markedFailed).toEqual(['item-1']);
  });

  it('marks the record sent when retry delivery succeeds', async () => {
    const history = new FakeHistory();
    const service = new TrackedMailService(history, new FakeDelivery());

    await expect(service.retry('room-1', 'item-1')).resolves.toMatchObject({ status: 'sent' });
    expect(history.markedSent).toEqual(['item-1']);
  });

  it('rejects tracked send before delivery when history capabilities are unavailable', async () => {
    const history = new FakeHistory();
    history.readinessFailure = new Error('history capability unavailable');
    const delivery = new FakeDelivery();
    const service = new TrackedMailService(history, delivery);

    await expect(service.send({ roomId: 'room-1', ...payload })).rejects.toThrow(
      'history capability unavailable',
    );
    expect(delivery.calls).toBe(0);
    expect(history.readinessChecks).toEqual([{
      roomId: 'room-1',
      requiresStageMovement: false,
    }]);
  });

  it('rejects retry before delivery when stage movement is unavailable', async () => {
    const history = new FakeHistory();
    history.readinessFailure = new Error('stage capability unavailable');
    const delivery = new FakeDelivery();
    const service = new TrackedMailService(history, delivery);

    await expect(service.retry('room-1', 'item-1')).rejects.toThrow(
      'stage capability unavailable',
    );
    expect(delivery.calls).toBe(0);
    expect(history.readinessChecks).toEqual([{
      roomId: 'room-1',
      requiresStageMovement: true,
    }]);
  });
});
