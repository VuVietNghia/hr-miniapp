---
name: jd-generator
description: "Kỹ năng chuyên biệt để tạo Job Description (JD) chuẩn form của công ty B.Army. Tuyệt đối không bịa đặt thông tin."
---

# Kỹ năng Tạo JD (JD Generator Skill)

Kỹ năng này giúp tự động tạo ra một Job Description (JD) chuyên nghiệp, tuân thủ đúng template và văn hoá của công ty B.Army.

## 1. Triggers (Khi nào sử dụng)
Sử dụng kỹ năng này khi người dùng yêu cầu: "Tạo JD", "Viết mô tả công việc", "Soạn JD cho vị trí...".

## 2. Dependencies (Tài liệu tham khảo)
1. `@Files:[ROOM_ID]/hr-miniapp/skills/jd_template.md`: Mẫu JD chuẩn bắt buộc phải tuân theo.
2. Nguồn dữ liệu công ty: Truy cập và đọc thông tin từ website chính thức: `https://www.b.army/`

## 3. Workflow (Quy trình thực thi)

### Bước 1: Thu thập thông tin
- Hỏi người dùng về các thông tin cốt lõi nếu họ chưa cung cấp: Tên vị trí, số năm kinh nghiệm yêu cầu, mức lương (nếu có).
- Sử dụng công cụ Browse/Web Search để truy cập `https://www.b.army/` đọc qua về tầm nhìn, sứ mệnh, sản phẩm để hiểu văn hoá công ty (chỉ dùng thông tin có thật).

### Bước 2: Sinh nội dung JD (Anti-Hallucination)
- **SYSTEM DIRECTIVE:** Bắt buộc phải sinh JD dựa theo bộ khung (template) `jd_template.md`.
- Tuyệt đối KHÔNG BỊA ĐẶT (Hallucinate) các chế độ phúc lợi (Ví dụ: Không tự ý ghi "Du lịch châu Âu", "Tháng lương 13", "Macbook Pro" nếu người dùng không cung cấp hoặc trên web công ty không có). Nếu không chắc chắn, hãy ghi "Theo chính sách hiện hành của công ty".
- Đối với phần "Về B.Army", hãy viết tóm tắt ngắn gọn từ những gì bạn đọc được trên website `https://www.b.army/`.
- Hãy dịch hoặc viết lại cho mạch lạc, thu hút ứng viên nhưng giữ tính trung thực.

### Bước 3: Lưu file JD
- Tên file chuẩn: `JD_[TênVịTríKhôngDấu].md` (Ví dụ: `JD_DataAnalyst.md`).
- Sử dụng công cụ lưu file (Write File) để lưu JD vừa tạo vào thư mục: `[ROOM_ID]/hr-miniapp/jds/`.
- Nếu file đã tồn tại, tự động thêm số thứ tự vào sau (VD: `JD_DataAnalyst_1.md`).

### Bước 4: Trả kết quả
- Báo cho người dùng biết file JD đã được tạo thành công kèm theo đường dẫn `<saved_file>đường_dẫn</saved_file>`.
