---
name: cv-evaluator
description: "Kỹ năng chuyên biệt dùng để phân tích, chấm điểm CV ứng viên và đánh giá chuyên sâu (Deep Review) dựa trên Job Description (JD). Kích hoạt khi người dùng yêu cầu 'chấm CV', 'đánh giá CV', 'sàng lọc ứng viên' hoặc 'deep review'."
---

# Kỹ năng Đánh giá CV (CV Evaluator Skill)

Kỹ năng này giúp chuẩn hóa toàn bộ quy trình từ lúc nhận CV thô, phân tích nội dung, chấm điểm dựa trên JD và lưu trữ kết quả phân tích một cách có cấu trúc vào thư mục báo cáo.

## 1. Triggers (Khi nào sử dụng)
Sử dụng kỹ năng này khi có yêu cầu:
- Chấm điểm CV sơ loại ("Chấm CV này", "Sàng lọc ứng viên").
- Đánh giá chuyên sâu một CV đã qua sơ loại ("Deep review CV này", "Đánh giá chuyên sâu").

## 2. Dependencies (Tài liệu tham khảo bắt buộc)
Trước khi bắt đầu, BẠN BẮT BUỘC PHẢI TÌM VÀ ĐỌC các file hướng dẫn sau đây trong workspace (thường nằm ở `hr-miniapp/skills/` hoặc tuân theo người dùng chỉ định):
1. `@Files:[ROOM_ID]/hr-miniapp/skills/cv_processing_guidelines.md`: Quy trình và đường dẫn thư mục chuẩn (VD: lưu vào `02-passed_screening` hay `03-deep_reviewed`).
2. `@Files:[ROOM_ID]/hr-miniapp/skills/cv_md_template.md`: Cấu trúc bắt buộc của file kết quả Markdown.

Nếu không tìm thấy các file trên, hãy yêu cầu người dùng cung cấp đường dẫn đến các file hướng dẫn nghiệp vụ trước khi tiến hành chấm CV.

## 3. Workflow (Quy trình thực thi)

Dựa trên yêu cầu của người dùng (Sơ loại hay Deep Review), hãy áp dụng logic sau:

### Phase 1: Phân loại yêu cầu
- Nếu yêu cầu là sơ loại (Screening): Mục tiêu là quyết định ĐẠT / CÂN NHẮC / KHÔNG ĐẠT. File kết quả sẽ được lưu vào `02-passed_screening/` hoặc `01-failed/` tương ứng.
- Nếu yêu cầu là đánh giá chuyên sâu (Deep Review): Mục tiêu là phân tích chi tiết kỹ năng, tính cách, kinh nghiệm (dựa trên các câu hỏi phỏng vấn, bài test...). File kết quả BẮT BUỘC lưu vào thư mục `03-deep_reviewed/`.

### Phase 2: Lưu trữ File Gốc (BẮT BUỘC VÀO ROOM FILES)
- ⚠️ **SYSTEM DIRECTIVE - NO SANDBOX:** BẠN BẮT BUỘC PHẢI THỰC HIỆN "BƯỚC 1" TRONG FILE GUIDELINES TRƯỚC TIÊN.
- Đổi tên CV gốc theo chuẩn và dùng PrivOS File Tool để lưu trực tiếp vào Room Files:
  `hr-miniapp/raws-cv/[YYYY-MM]/[Tên_file_chuẩn]`
- Tuyệt đối KHÔNG lưu file vào container sandbox nội bộ.
- Tuyệt đối KHÔNG thêm tiền tố `RoomFiles/` hoặc `[ROOM_ID]/` vào đường dẫn lưu file.
- Tuyệt đối không được bỏ sót bất kỳ file CV nào do người dùng tải lên.

### Phase 3: Đọc dữ liệu & Phân tích
- Đọc bản text MD của CV từ thư mục ẩn (nếu có) hoặc yêu cầu người dùng trích xuất.
- Đọc nội dung Job Description (JD).
- So khớp kỹ năng, kinh nghiệm trong CV với JD. Đưa ra điểm số (Ví dụ: 85/100).
- Lập bảng phân tích ưu/nhược điểm khách quan, không bịa đặt (No Hallucination).

### Phase 4: Lưu trữ Kết Quả (BẮT BUỘC VÀO ROOM FILES)
> **LƯU Ý QUAN TRỌNG:** Việc tạo/cập nhật Bảng Kanban (privos.lists) **KHÔNG** được thực hiện ở đây. Hệ thống UI sẽ tự động tạo List và lưu toàn bộ CV vào các stage sau khi chấm điểm xong TẤT CẢ các CV trong đợt. Nhiệm vụ của kỹ năng này chỉ là chấm điểm và lưu file Markdown vào Room Files.

1. **Quy tắc phân loại theo thang 100 điểm bắt buộc:**
   - **Tổng điểm ≥ 80:** ✅ `ĐẠT`
   - **Tổng điểm 50 – 79:** 🟡 `CÂN NHẮC`
   - **Tổng điểm < 50:** ❌ `KHÔNG ĐẠT` *(Tuyệt đối KHÔNG được xếp CÂN NHẮC nếu điểm dưới 50)*
   - **Không đúng vị trí trong JD:** ⛔ `KHÔNG TUYỂN VỊ TRÍ NÀY`

2. **Lưu file Markdown vào đúng thư mục Room Files:**
   - Tên file chuẩn: `[YYYY-MM-DD]_CV_[TenKhongDau]_[ViTriKhongDau].md` (Nếu trùng thì thêm `_1.md`, `_2.md`...).
   - Đường dẫn tương đối bắt đầu bằng `hr-miniapp/...` (TUYỆT ĐỐI KHÔNG thêm `RoomFiles/` hay `[ROOM_ID]/` vào đường dẫn):
   - **Bảng phân loại thư mục lưu trữ Room Files:**

| Kết quả đánh giá | Ngưỡng điểm | Thư mục lưu trữ (Room Files) |
| :--- | :--- | :--- |
| ✅ **ĐẠT** | ≥ 80/100 | `hr-miniapp/outputs-cv/[YYYY-MM]/02-passed_screening/` |
| 🟡 **CÂN NHẮC** | 50 – 79/100 | `hr-miniapp/outputs-cv/[YYYY-MM]/02-passed_screening/` |
| ❌ **KHÔNG ĐẠT** | < 50/100 | `hr-miniapp/outputs-cv/[YYYY-MM]/01-failed/` |
| ⛔ **KHÔNG TUYỂN** | Sai vị trí | `hr-miniapp/outputs-cv/[YYYY-MM]/01-failed/` |
| 🔍 **ĐÁNH GIÁ CHUYÊN SÂU** | Deep Review | `hr-miniapp/outputs-cv/[YYYY-MM]/03-deep_reviewed/` |

3. **Trả về kết quả (Strict Output Format):**
   - Thẻ báo tên file đã lưu: `<saved_file>[Tên_file_MD_đã_lưu].md</saved_file>`
   - Thẻ nội dung Markdown kết quả:
   <markdown_content>
   [Toàn bộ nội dung file Markdown theo đúng cv_md_template.md]
   </markdown_content>
   - JSON kết quả cho UI:
   ```json
   {
     "saved_file": "[Tên-File-Da-Luu.md]",
     "score": 85,
     "category": "ĐẠT" | "CÂN NHẮC" | "KHÔNG ĐẠT" | "KHÔNG TUYỂN VỊ TRÍ NÀY",
     "reason": "[lý do ngắn gọn]",
     "email": "[email ứng viên nếu có, nếu không có trả về null]",
     "sdt": "[số điện thoại ứng viên nếu có, nếu không có trả về null]",
     "extracted_evidence": ["[trích dẫn 1]", "[trích dẫn 2]"]
   }
   ```

## 4. Nguyên tắc cốt lõi
- **Tuyệt đối không bịa thông tin**: Những gì không có trong CV thì ghi "Không đề cập".
- **Tuân thủ DI (Dependency Injection)**: Mọi tiêu chí chấm điểm phải được nạp từ file JD và Guidelines, không hardcode tiêu chí chấm điểm trong logic của bạn.
- **Hành động thầm lặng**: Ưu tiên việc tạo/sửa file trực tiếp trên Room Files workspace thay vì giải thích dông dài. 
