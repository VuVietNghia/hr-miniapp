import type { FilesClient, FoldersClient } from '../../platform/contracts';
import type { ICompanyContextProvider } from '../types';

const COMPANY_PATH = ['hr-miniapp', 'company'] as const;

export class CompanyContextProvider implements ICompanyContextProvider {
  constructor(
    private readonly files: FilesClient,
    private readonly folders: FoldersClient,
    private readonly roomId: string,
  ) {}

  async getContext(): Promise<string> {
    if (!this.roomId.trim()) throw new Error('Không xác định được Room để đọc hr-miniapp/company.');
    if (!this.folders.capabilities.findByPath || !this.files.capabilities.folderScopedRead) {
      throw new Error('Đọc thư mục hr-miniapp/company không khả dụng trên kết nối PrivOS hiện tại.');
    }

    const folder = await this.folders.findByPath(this.roomId, COMPANY_PATH);
    if (!folder) throw new Error('Không tìm thấy thư mục hr-miniapp/company trong Room.');

    const fileNames = (await this.files.listFolderFiles(this.roomId, folder._id))
      .map(file => file.name)
      .filter(name => name.length > 0 && !/[\\/\r\n]/u.test(name))
      .sort((left, right) => left.localeCompare(right, 'vi'));
    if (fileNames.length === 0) {
      throw new Error('Chưa có tài liệu trong thư mục hr-miniapp/company.');
    }

    return fileNames.map(fileName => `@Files:${this.roomId}/hr-miniapp/company/${fileName}`).join('\n');
  }
}
