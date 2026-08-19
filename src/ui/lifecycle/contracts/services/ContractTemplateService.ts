import type { EmployeeContract } from '../../../../contracts/types';
import type { EmployeeProfile } from '../../types';

export class ContractTemplateService {
  public render(profile: EmployeeProfile, contract: EmployeeContract): string {
    const contractTypeLabel = contract.contractType === 'FIXED_TERM'
      ? 'HỢP ĐỒNG LAO ĐỘNG XÁC ĐỊNH THỜI HẠN'
      : 'HỢP ĐỒNG LAO ĐỘNG KHÔNG XÁC ĐỊNH THỜI HẠN';
    const durationLine = contract.contractType === 'FIXED_TERM'
      ? `Từ ngày **${contract.startDate}** đến hết ngày **${contract.endDate ?? '[BỔ SUNG]'}**.`
      : `Có hiệu lực từ ngày **${contract.startDate}**, không xác định thời hạn.`;

    return `# ${contractTypeLabel}

**Số:** ${contract.contractNumber}

> Mẫu nháp nghiệp vụ. Thông tin pháp lý của doanh nghiệp và nội dung điều khoản phải được HR/pháp chế kiểm tra trước khi ký.

## BÊN SỬ DỤNG LAO ĐỘNG

- Tên doanh nghiệp: **[BỔ SUNG: TÊN PHÁP LÝ CÔNG TY]**
- Mã số doanh nghiệp: **[BỔ SUNG]**
- Địa chỉ: **[BỔ SUNG]**
- Đại diện: **[BỔ SUNG]**
- Chức vụ: **[BỔ SUNG]**

## NGƯỜI LAO ĐỘNG

- Họ và tên: **${profile.name}**
- Email: ${profile.email || '[BỔ SUNG]'}
- Số điện thoại: ${profile.phone || '[BỔ SUNG]'}
- Địa chỉ/CCCD: **[BỔ SUNG TỪ HỒ SƠ ĐÃ XÁC MINH]**

## 1. Công việc và địa điểm làm việc

- Vị trí: **${contract.position}**
- Phòng ban: **${contract.department}**
- Địa điểm làm việc: **${contract.workLocation}**
- Mô tả công việc: **[BỔ SUNG/ĐÍNH KÈM JD ĐÃ DUYỆT]**

## 2. Thời hạn hợp đồng

${durationLine}

## 3. Tiền lương và chế độ

- Mức lương theo hợp đồng: **${contract.baseSalary.toLocaleString('vi-VN')} VND/tháng**
- Hình thức và kỳ hạn trả lương: **[BỔ SUNG]**
- Phụ cấp, bảo hiểm và quyền lợi khác: **[BỔ SUNG THEO CHÍNH SÁCH ĐÃ DUYỆT]**

## 4. Quyền, nghĩa vụ và điều khoản chung

**[BỔ SUNG NỘI DUNG ĐÃ ĐƯỢC HR/PHÁP CHẾ PHÊ DUYỆT]**

## Chữ ký

| ĐẠI DIỆN NGƯỜI SỬ DỤNG LAO ĐỘNG | NGƯỜI LAO ĐỘNG |
| :---: | :---: |
| Ký, ghi rõ họ tên | Ký, ghi rõ họ tên |
`;
  }
}
