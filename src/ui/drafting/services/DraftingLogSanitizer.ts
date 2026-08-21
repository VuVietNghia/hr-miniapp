const SAFE_COMPONENT_LOG = /^\[AI DRAFTING\] [A-Z_]+(?: template=[a-zA-Z0-9_-]{1,100})?$/u;

export function sanitizeDraftingLogMessage(message: string): string {
  if (SAFE_COMPONENT_LOG.test(message)) return message;
  if (/đang gửi prompt/i.test(message)) return '[AI DRAFTING] REQUEST_SENT';
  if (/đang chờ/i.test(message)) return '[AI DRAFTING] RESPONSE_PENDING';
  if (/hoàn tất/i.test(message)) return '[AI DRAFTING] RESPONSE_COMPLETED';
  if (/thử lại|retry/i.test(message)) return '[AI DRAFTING] REQUEST_RETRYING';
  return '[AI DRAFTING] PIPELINE_EVENT';
}
