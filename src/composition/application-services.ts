import type { VerifiedActor } from '@privos_ai/app-server';

import type { HrUiResourceProvider } from '../mcp/ui-resource';
import type {
  MailRetryInput,
  MailSendInput,
  PayrollCreateInput,
  PayrollDeleteInput,
  PayrollUpdateInput,
} from '../mcp/tool-inputs';

export interface MailToolService {
  send(
    input: MailSendInput,
    actor: VerifiedActor | undefined,
    roomId: string | undefined,
  ): Promise<unknown>;
  retry(
    input: MailRetryInput,
    actor: VerifiedActor | undefined,
    roomId: string | undefined,
  ): Promise<unknown>;
}

export interface PayrollToolService {
  query(
    actor: VerifiedActor | undefined,
    roomId: string | undefined,
  ): Promise<unknown>;
  create(
    input: PayrollCreateInput,
    actor: VerifiedActor | undefined,
    roomId: string | undefined,
  ): Promise<unknown>;
  update(
    input: PayrollUpdateInput,
    actor: VerifiedActor | undefined,
    roomId: string | undefined,
  ): Promise<unknown>;
  delete(
    input: PayrollDeleteInput,
    actor: VerifiedActor | undefined,
    roomId: string | undefined,
  ): Promise<unknown>;
}

export interface HrApplicationServices {
  mail: MailToolService;
  payroll: PayrollToolService;
  ui: HrUiResourceProvider;
}
