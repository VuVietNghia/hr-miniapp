import type { VerifiedActor } from '@privos_ai/app-server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApplicationServices } from '../../src/composition/create-application-services';
import { readEmailJsConfig } from '../../src/config/emailjs-config';
import type {
  EmailHistoryRecord,
  StoredEmailPayload,
} from '../../src/email-history/email-history-model';
import {
  EmailJsMailClient,
  redactTokenLikeValues,
} from '../../src/services/EmailJsMailClient';
import { MailService, type SendMailParams } from '../../src/services/MailService';
import { MailToolApplicationService } from '../../src/services/MailToolApplicationService';
import {
  type EmailHistoryGateway,
  type MailDeliveryGateway,
  TrackedMailService,
} from '../../src/services/TrackedMailService';
import { TaskQueue } from '../../src/utils/TaskQueue';

const actor: VerifiedActor = Object.freeze({
  userId: 'verified-user',
  username: 'Verified User',
  roomId: 'room-1',
  claims: Object.freeze({ sub: 'verified-user', rid: 'room-1' }),
  provenance: 'user-token',
});

const sendParams: SendMailParams = {
  toName: 'Candidate',
  toEmail: 'candidate@example.test',
  subject: 'Interview',
  htmlContent: 'mail-content',
};

class RecordingDelivery implements MailDeliveryGateway {
  readonly requests: SendMailParams[] = [];

  async queueMail(params: SendMailParams): Promise<void> {
    this.requests.push(params);
  }
}

class RecordingHistory implements EmailHistoryGateway {
  requestedBy: string | undefined;

  async assertReadyForTrackedWrite(): Promise<void> {}

  async createResult(
    _roomId: string,
    payload: StoredEmailPayload,
    status: 'sent' | 'failed',
    _error?: unknown,
    requestedBy?: string,
  ) {
    this.requestedBy = requestedBy;
    return {
      id: 'item-1',
      listId: 'list-1',
      stageId: `stage-${status}`,
      status,
      ...payload,
      createdAt: '2026-08-30T00:00:00.000Z',
      updatedAt: '2026-08-30T00:00:00.000Z',
      attemptCount: 1,
    };
  }

  async markSent(): Promise<EmailHistoryRecord> {
    throw new Error('not used');
  }

  async markFailed(): Promise<EmailHistoryRecord> {
    throw new Error('not used');
  }

  async prepareRetry(): Promise<{
    record: EmailHistoryRecord;
    payload: StoredEmailPayload;
  }> {
    throw new Error('not used');
  }
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('readEmailJsConfig', () => {
  it('trims required and optional values', () => {
    expect(readEmailJsConfig({
      EMAILJS_SERVICE_ID: ' service ',
      EMAILJS_TEMPLATE_ID: ' template ',
      EMAILJS_PUBLIC_KEY: ' public ',
      EMAILJS_PRIVATE_KEY: ' private ',
    })).toEqual({
      serviceId: 'service',
      templateId: 'template',
      publicKey: 'public',
      privateKey: 'private',
    });
  });

  it('names only missing required keys', () => {
    expect(() => readEmailJsConfig({
      EMAILJS_SERVICE_ID: ' ',
      EMAILJS_TEMPLATE_ID: 'template',
      EMAILJS_PUBLIC_KEY: '',
    })).toThrow(
      'Missing EmailJS configuration: EMAILJS_SERVICE_ID, EMAILJS_PUBLIC_KEY',
    );
  });
});

describe('EmailJS provider error sanitizer', () => {
  it('redacts quoted JSON, quote/case variants, and unquoted token-like fields', () => {
    const secrets = [
      'json-access-secret',
      'json-private-secret',
      'Bearer json-authorization-secret',
      'single-quoted-secret',
      'unquoted-private-secret',
      'truncated-authorization-secret',
      'escaped-json-secret-tail',
    ];
    const providerText = [
      JSON.stringify({
        accessToken: secrets[0],
        privateKey: secrets[1],
        authorization: secrets[2],
        apiKey: `prefix\"${secrets[6]}`,
      }),
      `'AcCeSs_ToKeN':'${secrets[3]}'`,
      `PRIVATE-KEY=${secrets[4]}`,
      `authorization="${secrets[5]}`,
    ].join('\n');

    const sanitized = redactTokenLikeValues(providerText);

    for (const secret of secrets) expect(sanitized).not.toContain(secret);
    expect(sanitized.match(/\[REDACTED\]/g)).toHaveLength(7);
  });
});

describe('EmailJsMailClient', () => {
  async function expectGenericDeliveryFailure(
    promise: Promise<void>,
    forbiddenProviderText: string,
  ): Promise<void> {
    let caught: unknown;
    try {
      await promise;
      expect.unreachable('expected EmailJS delivery to reject');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    const message = caught instanceof Error ? caught.message : String(caught);
    expect(message).toBe('Email delivery failed');
    expect(message).not.toContain(forbiddenProviderText);
  }

  it('sends only the whitelisted EmailJS payload and honors the abort signal', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const fetchFn: typeof fetch = async (input, init) => {
      calls.push({ input, init });
      return new Response('', { status: 200 });
    };
    const controller = new AbortController();
    const client = new EmailJsMailClient({
      serviceId: 'service',
      templateId: 'template',
      publicKey: 'public',
      privateKey: 'private',
    }, fetchFn);

    await client.send(sendParams, controller.signal);

    expect(calls).toEqual([{
      input: 'https://api.emailjs.com/api/v1.0/email/send',
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: 'service',
          template_id: 'template',
          user_id: 'public',
          template_params: {
            name: 'Candidate',
            to_email: 'candidate@example.test',
            subject: 'Interview',
            message: 'mail-content',
            Tomorow: '',
          },
          accessToken: 'private',
        }),
        signal: controller.signal,
      },
    }]);
  });

  it('caps provider error reads and throws a generic redacted error without logging PII', async () => {
    let cancelled = false;
    const providerBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('accessToken=provider-secret '.repeat(50)));
        controller.enqueue(new TextEncoder().encode('recipient@example.test and body-content'));
      },
      cancel() {
        cancelled = true;
      },
    });
    const fetchFn: typeof fetch = async () => new Response(providerBody, { status: 503 });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const client = new EmailJsMailClient({
      serviceId: 'service',
      templateId: 'template',
      publicKey: 'public',
    }, fetchFn);

    await expect(client.send(sendParams)).rejects.toThrow('Email delivery failed');
    expect(cancelled).toBe(true);
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleLog).not.toHaveBeenCalled();
  });

  it('maps a failing provider-body read to the exact generic delivery error', async () => {
    const providerBody = new ReadableStream<Uint8Array>({
      pull() {
        throw new Error('provider-stream-detail');
      },
    });
    const client = new EmailJsMailClient({
      serviceId: 'service',
      templateId: 'template',
      publicKey: 'public',
    }, async () => new Response(providerBody, { status: 503 }));

    await expectGenericDeliveryFailure(
      client.send(sendParams),
      'provider-stream-detail',
    );
  });

  it('maps a failing provider-body cancel to the exact generic delivery error', async () => {
    const providerBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('x'.repeat(1001)));
      },
      cancel() {
        throw new Error('provider-cancel-detail');
      },
    });
    const client = new EmailJsMailClient({
      serviceId: 'service',
      templateId: 'template',
      publicKey: 'public',
    }, async () => new Response(providerBody, { status: 503 }));

    await expectGenericDeliveryFailure(
      client.send(sendParams),
      'provider-cancel-detail',
    );
  });

  it('cancels an oversized single provider chunk and still returns only the generic error', async () => {
    let cancelled = false;
    const providerBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('oversized-provider-detail'.repeat(100)));
      },
      cancel() {
        cancelled = true;
      },
    });
    const client = new EmailJsMailClient({
      serviceId: 'service',
      templateId: 'template',
      publicKey: 'public',
    }, async () => new Response(providerBody, { status: 503 }));

    await expectGenericDeliveryFailure(
      client.send(sendParams),
      'oversized-provider-detail',
    );
    expect(cancelled).toBe(true);
  });

  it('sanitizes quoted JSON token fields internally without logging or returning provider text', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const providerText = JSON.stringify({
      accessToken: 'quoted-provider-secret',
      private_key: 'second-provider-secret',
      authorization: 'Bearer provider-secret',
    });
    const client = new EmailJsMailClient({
      serviceId: 'service',
      templateId: 'template',
      publicKey: 'public',
    }, async () => new Response(providerText, { status: 503 }));

    await expectGenericDeliveryFailure(
      client.send(sendParams),
      'quoted-provider-secret',
    );
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleLog).not.toHaveBeenCalled();
  });
});

describe('MailService', () => {
  it('queues delivery through its injected queue and client', async () => {
    const sent: SendMailParams[] = [];
    const service = new MailService(new TaskQueue({ delayMs: 0 }), {
      async send(params) {
        sent.push(params);
      },
    });

    await service.queueMail(sendParams);

    expect(sent).toEqual([sendParams]);
  });
});

describe('MailToolApplicationService', () => {
  function fixture() {
    const delivery = new RecordingDelivery();
    const history = new RecordingHistory();
    const tracked = new TrackedMailService(history, delivery);
    return {
      delivery,
      history,
      service: new MailToolApplicationService(tracked, delivery),
    };
  }

  it('derives requestedBy only from the verified actor for tracked send', async () => {
    const { history, service } = fixture();

    await service.send({
      ...sendParams,
      roomId: 'room-1',
      source: 'cv_scored',
    }, actor, 'room-1');

    expect(history.requestedBy).toBe('verified-user');
  });

  it('requires a verified actor for untracked send', async () => {
    const { delivery, service } = fixture();

    await expect(service.send(sendParams, undefined, 'room-1')).rejects.toThrow(
      'Verified actor is required',
    );
    expect(delivery.requests).toEqual([]);
  });

  it('rejects invalid recipient input before queueing delivery', async () => {
    const { delivery, service } = fixture();

    await expect(service.send({ ...sendParams, toEmail: 'invalid' }, actor, 'room-1'))
      .rejects.toThrow('Recipient email is invalid for hrm.mail.send');
    await expect(service.send({ ...sendParams, subject: '' }, actor, 'room-1'))
      .rejects.toThrow('Missing required arguments for hrm.mail.send');
    expect(delivery.requests).toEqual([]);
  });

  it('requires matching non-empty context Room and supported source for tracked send', async () => {
    const { delivery, service } = fixture();
    const trackedInput = { ...sendParams, roomId: 'room-compat', source: 'lifecycle' as const };

    await expect(service.send(trackedInput, actor, 'room-context')).rejects.toThrow(
      'Tracked mail Room context is invalid',
    );
    await expect(service.send({ ...sendParams, roomId: 'room-1' }, actor, 'room-1')).rejects.toThrow(
      'Tracked mail requires a supported source',
    );
    expect(delivery.requests).toEqual([]);
  });

  it('requires actor and exact Room compatibility for retry', async () => {
    const { service } = fixture();

    await expect(service.retry({ roomId: 'room-1', itemId: 'item-1' }, undefined, 'room-1'))
      .rejects.toThrow('Verified actor is required');
    await expect(service.retry({ roomId: 'room-1', itemId: 'item-1' }, actor, 'room-2'))
      .rejects.toThrow('Tracked mail Room context is invalid');
  });
});

describe('final mail composition', () => {
  const environment = {
    EMAILJS_SERVICE_ID: 'service',
    EMAILJS_TEMPLATE_ID: 'template',
    EMAILJS_PUBLIC_KEY: 'public',
  };

  it('keeps the 1500ms spacing in composition', async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn<typeof fetch>(async () => new Response('', { status: 200 }));
    const services = createApplicationServices({
      environment,
      fetchFn,
      hubClient: { async authorizedFetch() { throw new Error('unexpected Room request'); } },
      resolveMcpAppId: async () => 'app-1',
      uiAssetReader: { readAssets: () => ({ js: '', css: '' }) },
    });

    const call = () => services.mcpHandler({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'hrm.mail.send', arguments: sendParams },
    }, {
      transport: 'direct',
      identityState: 'verified',
      sessionScope: 'mail-spacing',
      actor,
      roomId: 'room-1',
    });
    const first = call();
    const second = call();
    await first;
    expect(fetchFn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1499);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await second;
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('keeps production tracked mail fail-closed before delivery without verified capabilities', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => new Response('', { status: 200 }));
    const services = createApplicationServices({
      environment,
      fetchFn,
      hubClient: { async authorizedFetch() { throw new Error('unexpected Room request'); } },
      resolveMcpAppId: async () => 'app-1',
      uiAssetReader: { readAssets: () => ({ js: '', css: '' }) },
    });

    await expect(services.mcpHandler({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'hrm.mail.send',
        arguments: { ...sendParams, roomId: 'room-1', source: 'cv_scored' },
      },
    }, {
      transport: 'direct',
      identityState: 'verified',
      sessionScope: 'tracked-mail',
      actor,
      roomId: 'room-1',
    })).rejects.toThrow('Tool execution failed');
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
