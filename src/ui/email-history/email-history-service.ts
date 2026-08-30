import {
  EMAIL_HISTORY_LIST_NAME,
  EMAIL_HISTORY_STAGES,
  parseEmailHistoryItem,
  type EmailHistoryRecord,
  type EmailHistoryStageIds,
} from '../../email-history/email-history-model';
import type { ListsClient } from '../platform/contracts';

export interface EmailRetryClient {
  retry(input: Readonly<{ roomId: string; itemId: string }>): Promise<void>;
}

function resolveStageIds(stages: readonly Readonly<{ _id: string; name?: string }>[]): EmailHistoryStageIds | null {
  const ids = new Map(stages.filter(stage => stage.name).map(stage => [stage.name as string, stage._id]));
  const interviewSent = ids.get(EMAIL_HISTORY_STAGES.interviewSent);
  const interviewFailed = ids.get(EMAIL_HISTORY_STAGES.interviewFailed);
  const employeeSent = ids.get(EMAIL_HISTORY_STAGES.employeeSent);
  const employeeFailed = ids.get(EMAIL_HISTORY_STAGES.employeeFailed);
  return interviewSent && interviewFailed && employeeSent && employeeFailed
    ? { interviewSent, interviewFailed, employeeSent, employeeFailed }
    : null;
}

export class EmailHistoryService {
  constructor(
    private readonly lists: ListsClient,
    private readonly mail: EmailRetryClient,
  ) {}

  async load(roomId: string): Promise<EmailHistoryRecord[]> {
    if (!roomId.trim()) throw new Error('Không xác định được Room để tải lịch sử email.');
    const list = (await this.lists.listByRoom(roomId)).find(candidate => candidate.name === EMAIL_HISTORY_LIST_NAME);
    if (!list) return [];

    const info = await this.lists.getInfo(list._id);
    const stageIds = resolveStageIds(info.stages);
    if (!stageIds) throw new Error('List lịch sử email thiếu cấu hình trạng thái.');

    const page = await this.lists.queryItems({ listId: list._id, count: 500 });
    if (page.nextCursor) throw new Error('Lịch sử email vượt giới hạn trang an toàn.');
    return page.items
      .map(item => parseEmailHistoryItem({ ...item, listId: list._id }, stageIds))
      .filter((record): record is EmailHistoryRecord => Boolean(record))
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
  }

  async retry(roomId: string, itemId: string): Promise<void> {
    await this.mail.retry({ roomId, itemId });
  }

  async delete(itemId: string): Promise<void> {
    await this.lists.deleteItem(itemId);
  }
}
