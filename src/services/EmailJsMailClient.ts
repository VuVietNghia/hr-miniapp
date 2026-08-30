import type { EmailJsConfig } from '../config/emailjs-config';
import type { SendMailParams } from './MailService';

const EMAILJS_SEND_URL = 'https://api.emailjs.com/api/v1.0/email/send';
const MAX_PROVIDER_ERROR_CHARACTERS = 1000;

export interface MailDeliveryClient {
  send(params: SendMailParams, signal?: AbortSignal): Promise<void>;
}

async function readBoundedResponse(response: Response): Promise<string> {
  if (!response.body) return '';

  let reader: ReadableStreamDefaultReader<Uint8Array>;
  try {
    reader = response.body.getReader();
  } catch {
    return '';
  }
  const decoder = new TextDecoder();
  let result = '';
  try {
    while (result.length < MAX_PROVIDER_ERROR_CHARACTERS) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch {
        break;
      }
      if (chunk.done) break;
      let decoded: string;
      try {
        decoded = decoder.decode(chunk.value, { stream: true });
      } catch {
        break;
      }
      const remaining = MAX_PROVIDER_ERROR_CHARACTERS - result.length;
      result += decoded.slice(0, remaining);
      if (decoded.length >= remaining) {
        try {
          await reader.cancel();
        } catch {
          // Provider error cleanup is best-effort and never changes the public error.
        }
        break;
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Provider error cleanup is best-effort and never changes the public error.
    }
  }
  return result;
}

/** @internal Exported only for the focused provider-error sanitization contract test. */
export function redactTokenLikeValues(value: string): string {
  const keyName = '(?:access[_-]?token|private[_-]?key|authorization|api[_-]?key)';
  const tokenKey = `(?:"${keyName}"|'${keyName}'|\\b${keyName}\\b)`;
  const tokenValue = '(?:"(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\'|[^,;}\\]\\r\\n]+)';
  return value.replace(
    new RegExp(`(${tokenKey}\\s*[=:]\\s*)${tokenValue}`, 'gi'),
    '$1[REDACTED]',
  );
}

export class EmailJsMailClient implements MailDeliveryClient {
  constructor(
    private readonly config: EmailJsConfig,
    private readonly fetchFn: typeof fetch,
  ) {}

  async send(params: SendMailParams, signal?: AbortSignal): Promise<void> {
    const payload = {
      service_id: this.config.serviceId,
      template_id: this.config.templateId,
      user_id: this.config.publicKey,
      template_params: {
        name: params.toName,
        to_email: params.toEmail,
        subject: params.subject,
        message: params.htmlContent,
        Tomorow: '',
      },
      ...(this.config.privateKey ? { accessToken: this.config.privateKey } : {}),
    };

    const response = await this.fetchFn(EMAILJS_SEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok) {
      const boundedProviderError = await readBoundedResponse(response);
      const sanitizedProviderError = redactTokenLikeValues(boundedProviderError)
        .slice(0, MAX_PROVIDER_ERROR_CHARACTERS);
      void sanitizedProviderError;
      throw new Error('Email delivery failed');
    }
  }
}
