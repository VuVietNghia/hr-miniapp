import type { FilesClient, FoldersClient } from '../../platform/contracts';
import { uploadFileToPrivos } from '../PrivosApi';

export interface OnboardingSubmission {
  fullName?: string;
  position?: string;
  onboardingDate?: string;
  dob?: string;
  idNumber?: string;
  idIssueDate?: string;
  idIssuePlace?: string;
  permanentAddress?: string;
  currentAddress?: string;
  vehiclePlate?: string;
  vehicleType?: string;
  socialInsurance?: string;
  taxCode?: string;
  bankAccount?: string;
  bankName?: string;
  momoWallet?: string;
  email?: string;
  phone?: string;
  telegram?: string;
  password?: string;
  emergencyContact?: string;
  idPhotoBase64?: string;
  idPhotoFilename?: string;
}

export class OnboardingService {
  constructor(
    private readonly roomId: string,
    private readonly files: FilesClient,
    private readonly folders: FoldersClient,
  ) {}

  async handleSubmission(data: OnboardingSubmission): Promise<{ success: boolean; message: string }> {
    try {
      if (!this.roomId.trim()) throw new Error('Không xác định được Room HR.');
      if (!this.folders.capabilities.ensurePath || !this.files.capabilities.folderScopedWrite) {
        throw new Error('Lưu hồ sơ onboarding theo thư mục không khả dụng.');
      }

      const cleanName = this.removeVietnameseTones(data.fullName || 'KhongTen').replace(/\s+/g, '_');
      const cleanPos = this.removeVietnameseTones(data.position || 'KhongViTri').replace(/\s+/g, '_');
      const folder = await this.folders.ensurePath(this.roomId, ['hr-miniapp', 'employees', cleanName]);
      let photoReference = '';

      if (data.idPhotoBase64 && data.idPhotoFilename) {
        const mimeType = /^data:([^;]+);base64,/u.exec(data.idPhotoBase64)?.[1] ?? 'image/png';
        const uploaded = await uploadFileToPrivos(this.files, {
          roomId: this.roomId,
          folderId: folder._id,
          content: data.idPhotoBase64,
          fileName: data.idPhotoFilename,
          mimeType,
        });
        photoReference = `[fileId:${uploaded._id}]`;
      }

      const dateStr = new Date().toISOString().split('T')[0];
      const fileName = `${dateStr}_CV_${cleanName}_${cleanPos}.md`;
      await uploadFileToPrivos(this.files, {
        roomId: this.roomId,
        folderId: folder._id,
        content: this.generateMarkdown(data, photoReference),
        fileName,
        mimeType: 'text/markdown',
      });
      return { success: true, message: `Hồ sơ ${data.fullName ?? ''} đã được lưu thành công vào phòng HR.` };
    } catch (error: unknown) {
      return { success: false, message: error instanceof Error ? error.message : 'Không thể lưu hồ sơ onboarding.' };
    }
  }

  static async handleOnboardingSubmission(): Promise<{ success: boolean; message: string }> {
    return { success: false, message: 'Onboarding cần Room clients được inject từ UI đang mount.' };
  }

  private generateMarkdown(data: OnboardingSubmission, photoReference: string): string {
    return `
# HỒ SƠ ỨNG VIÊN TRÚNG TUYỂN

**Vị trí ứng tuyển:** ${data.position || ''}
**Ngày Onboarding:** ${data.onboardingDate || ''}

---

## 1. THÔNG TIN CÁ NHÂN
- **Họ và Tên (Full name):** ${data.fullName || ''}
- **Ngày Sinh (DOB):** ${data.dob || ''}
- **CMND / CCCD (ID/Passport):** ${data.idNumber || ''}
- **Ngày Cấp (Issue Date):** ${data.idIssueDate || ''}
- **Nơi Cấp (Place):** ${data.idIssuePlace || ''}
- **Địa Chỉ Thường Trú (Permanent Address):** ${data.permanentAddress || ''}
- **Chỗ ở Hiện Tại (Current Address):** ${data.currentAddress || ''}

## 2. THÔNG TIN PHƯƠNG TIỆN
- **Biển Số Xe (License plate):** ${data.vehiclePlate || ''}
- **Loại Xe (Type of vehicle):** ${data.vehicleType || ''}

## 3. THÔNG TIN BẢO HIỂM
- **Số Sổ BHXH (Social Insurance book number):** ${data.socialInsurance || ''}

## 4. THÔNG TIN TÀI CHÍNH
- **Mã Số Thuế Cá Nhân (PIT):** ${data.taxCode || ''}
- **Số Tài Khoản NH (Bank account No.):** ${data.bankAccount || ''}
- **Ngân Hàng / Chi Nhánh (Bank / Branch):** ${data.bankName || ''}
- **Ví Điện Tử Momo (nếu có):** ${data.momoWallet || ''}

## 5. LIÊN HỆ & BẢO MẬT
- **Email:** ${data.email || ''}
- **Số Điện Thoại (Phone No.):** ${data.phone || ''}
- **Tài khoản Telegram cá nhân:** ${data.telegram || ''}
- **Mật khẩu (Password cho CRM/Email):** ${data.password || 'Đã ẩn'}
- **Liên Hệ Khẩn Cấp (Emergency contact):** ${data.emergencyContact || ''}

---
## HÌNH ẢNH CÁ NHÂN / CMND:
${photoReference || '*Chưa đính kèm ảnh*'}
    `.trim();
  }

  private removeVietnameseTones(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
  }
}
