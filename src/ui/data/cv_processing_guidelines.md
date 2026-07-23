# HƯỚNG DẪN XỬ LÝ VÀ CHẤM ĐIỂM CV (ANTI-HALLUCINATION)

**MỤC ĐÍCH TỐI THƯỢNG:**

* KHÔNG BAO GIỜ tự bịa đặt hoặc suy diễn thông tin.
* Bắt buộc phải trích xuất dữ liệu dựa trên bản Text (Markdown) gốc do hệ thống Auto-parse tạo ra.
* Đảm bảo 100% các CV sau khi xử lý đều có chung một cấu trúc trình bày thống nhất và được ĐÁNH GIÁ SÀNG LỌC theo tiêu chuẩn.

***

## BƯỚC 1: COPY FILE RAW VÀO THƯ MỤC RAWS-CV (BẮT BUỘC)

> ⚠️ **SYSTEM DIRECTIVE:** YOU MUST COPY ALL RAW FILES TO `hr-miniapp/raws-cv/` BEFORE PROCEEDING. NẾU BẠN BỎ QUA BƯỚC NÀY, TOÀN BỘ QUY TRÌNH SẼ BỊ LỖI.

Ngay khi nhận được yêu cầu xử lý một file CV raw (ví dụ: `NguyenVanA.pdf`), bạn phải thực hiện quy trình sau để lưu trữ bản gốc:

* **Cách làm:** Thay vì phải gọi tool kiểm tra danh sách file, bạn hãy ĐỔI TÊN file gốc theo chuẩn `[YYYY-MM-DD]_CV_[TenKhongDau]_[ViTriKhongDau]_[Timestamp_YYYYMMDD_HHMMSS].[extension]`.
* **Ví dụ:** File gốc là `NguyenVanA.pdf` ứng tuyển Data Analyst, ở thời điểm hiện tại (ví dụ 16:05:30 ngày 09/07/2026), bạn sẽ đặt tên là `2026-07-09_CV_NguyenVanA_DataAnalyst_20260709_160530.pdf`.
* **Thực thi:** Dùng công cụ Copy (hoặc lệnh tương đương) để copy file này vào `hr-miniapp/raws-cv/[YYYY-MM]/` với tên vừa tạo. Bằng cách này 100% không bao giờ bị trùng tên! KHÔNG CẦN LOOP HAY KIỂM TRA LẠI, CV có thể có nhiều đuôi khác nhau (ví dụ: .pdf, .doc, .docx, vv) cần phải copy hết.

**(TUYỆT ĐỐI KHÔNG ĐƯỢC GHI ĐÈ FILE CŨ VÀ KHÔNG BỎ QUA BƯỚC NÀY)**

## BƯỚC 2: TÌM VÀ ĐỌC BẢN TEXT GỐC (BẮT BUỘC)

Khi nhận được yêu cầu xử lý CV, AI **KHÔNG ĐƯỢC** đọc thẳng file PDF. Thay vào đó, AI phải tìm bản text đã được bóc tách nằm trong thư mục ẩn theo các đường dẫn sau (thay khoảng trắng bằng dấu `_`):

1. `[ROOM_ID]/.markdown/[Tên_File_Có_Gạch_Dưới].pdf.md`
2. `[ROOM_ID]/.markdown/[Tên_File_Có_Gạch_Dưới].md`
3. `[ROOM_ID]/.markdown/hr-miniapp/cv-lon-xon/[Tên_File_Có_Gạch_Dưới].md`

_Lưu ý: Nội dung lấy từ file MD này chính là "Nguồn Dữ Liệu Gốc". Nếu không tìm thấy file, hãy dừng lại báo lỗi._

## BƯỚC 3: CHUẨN HÓA FORMAT & ĐÁNH GIÁ SÀNG LỌC

Sử dụng nội dung từ "Nguồn Dữ Liệu Gốc", định dạng lại CV theo cấu trúc sau.
**Yêu cầu:** Sắp xếp lại nội dung, giữ nguyên văn kỹ năng/kinh nghiệm. Sau đó, dựa vào thông tin trích xuất, thực hiện **ĐÁNH GIÁ SÀNG LỌC** theo 3 tiêu chí dưới đây đối chiếu với JD đính kèm:

### 3 Tiêu Chí Đánh Giá Chính:

1. **Vị trí ứng tuyển:** Có đúng với danh sách tuyển dụng trong JD hay không?
2. **Kinh nghiệm & Yêu cầu cốt lõi:** Có đạt yêu cầu tối thiểu của JD không?
3. **Mức lương mong muốn:** Có nằm trong Budget (nếu JD có đề cập) không?

### Phân Loại Kết Quả Rẽ Nhánh:

* ✅ **ĐẠT (Mời phỏng vấn):** Đúng vị trí + Kinh nghiệm đạt yêu cầu + Lương trong budget.
* 🟡 **CÂN NHẮC (Cần xem thêm):** Đúng vị trí nhưng thiếu 1 tiêu chí (ít kinh nghiệm hơn yêu cầu hoặc lương hơi cao nhưng có thể thương lượng).
* ❌ **KHÔNG ĐẠT (Từ chối):** Lương vượt budget quá xa HOẶC không đủ yêu cầu cơ bản của JD.
* ⛔ **KHÔNG TUYỂN VỊ TRÍ NÀY:** Ứng tuyển vị trí không có trong JD hiện tại.

### TEMPLATE KẾT QUẢ BẮT BUỘC (Markdown):

> **CẢNH BÁO CỐT LÕI:** BẠN BẮT BUỘC PHẢI TRÌNH BÀY FILE MARKDOWN ĐÚNG Y HỆT THEO CẤU TRÚC ĐƯỢC QUY ĐỊNH TẠI FILE TEMPLATE DƯỚI ĐÂY. BẠN PHẢI LẬP BẢNG CHẤM ĐIỂM CHI TIẾT THEO YÊU CẦU TRONG TEMPLATE.
>
> 💡 Đọc cấu trúc template tại: `@Files:[ROOM_ID]/hr-miniapp/skills/cv_md_template.md`

## BƯỚC 4: LƯU FILE VÀO OUTPUTS CV (CHỐNG TRÙNG LẶP)

* Trích xuất Họ và Tên ứng viên cùng với Vị trí ứng tuyển TỪ TRONG NỘI DUNG CV. **LƯU Ý CỐT LÕI:** Vị trí ứng tuyển phải lấy đúng theo những gì ứng viên viết trong CV, TUYỆT ĐỐI KHÔNG lấy tên tiêu đề của file JD hay tên JD để đặt tên. Nếu trong CV không ghi rõ vị trí, hãy dùng `KhongXacDinh`.
* Loại bỏ dấu tiếng Việt và dấu cách cho cả Tên và Vị trí ứng tuyển (VD: `Lưu Sơn Trường` -> `LuuSonTruong`, `Lập trình viên` -> `LapTrinhVien`).
* Tên file chuẩn: `[YYYY-MM-DD]_CV_[TenKhongDau]_[ViTriUngTuyenKhongDau].md`.
* Dùng công cụ **Write File** để lưu nội dung vừa được chuẩn hóa vào các thư mục tương ứng theo tháng `[YYYY-MM]`:
  * NẾU ĐANG CHẤM SƠ LOẠI VÀ ỨNG VIÊN ĐẠT/CÂN NHẮC: `[ROOM_ID]/hr-miniapp/outputs-cv/[YYYY-MM]/02-passed_screening/[Tên_file_chuẩn]`
  * NẾU ĐANG CHẤM SƠ LOẠI VÀ ỨNG VIÊN KHÔNG ĐẠT/KHÔNG TUYỂN: `[ROOM_ID]/hr-miniapp/outputs-cv/[YYYY-MM]/01-failed/[Tên_file_chuẩn]`
  * NẾU ĐANG LÀM NHIỆM VỤ ĐÁNH GIÁ CHUYÊN SÂU (Deep Review): `[ROOM_ID]/hr-miniapp/outputs-cv/[YYYY-MM]/03-deep_reviewed/[Tên_file_chuẩn]`
* **QUAN TRỌNG (CHỐNG TRÙNG LẶP):** Trước khi lưu, nếu phát hiện file đã tồn tại, bạn **BẮT BUỘC** phải tạo ra tên file mới bằng cách thêm số thứ tự (ví dụ: `..._LapTrinhVien_1.md`).

## BƯỚC 5: GHI THẺ ỨNG VIÊN VÀO BẢNG KANBAN CỐ ĐỊNH (PRIVOS LISTS)

> ⚠️ **SYSTEM DIRECTIVE:** BẠN BẮT BUỘC PHẢI GHI ỨNG VIÊN VÀO ĐÚNG BẢNG KANBAN TƯƠNG ỨNG. ĐÂY LÀ YÊU CẦU TỐI QUAN TRỌNG ĐỂ HR THEO DÕI.

* **TUYỆT ĐỐI KHÔNG tạo list mới.** App đã tạo sẵn 3 bảng Kanban cố định, bạn chỉ được phép dùng 3 bảng này:
  * `CV_DEV` — IT/Lập trình/Phát triển phần mềm/Backend/Frontend/DevOps/Data
  * `CV_HR` — Nhân sự/HR/Tuyển dụng/Đào tạo/C&B
  * `CV_Marketing` — Marketing/Truyền thông/Quảng cáo/Branding/SEO/Content

### Bước 5.1 — Xác định list phù hợp

Dựa trên **vị trí ứng tuyển** trong CV (không phải tên file JD):
* Vị trí liên quan đến IT/lập trình/phần mềm/công nghệ/dữ liệu → dùng list `CV_DEV`
* Vị trí liên quan đến nhân sự/HR/tuyển dụng/đào tạo/lương thưởng → dùng list `CV_HR`
* Vị trí liên quan đến marketing/truyền thông/quảng cáo/thương hiệu → dùng list `CV_Marketing`

### Bước 5.2 — Lấy listId và stageId từ file config

> ⚠️ **QUAN TRỌNG:** Bot **KHÔNG có quyền** gọi `privos.lists.getAll` (trả về `lists: []`). Thay vào đó, App TypeScript đã lưu sẵn toàn bộ thông tin vào file config — bạn chỉ cần đọc file đó.

1. Đọc file config tại đường dẫn: `@Files:[ROOM_ID]/hr-miniapp/skills/cv_list_config.json`
2. File có cấu trúc JSON như sau:
   ```json
   {
     "CV_DEV":       { "listId": "list_abc", "stageMap": { "01_Dau_Vao": "stage_111", "02_Loai_CV": "stage_222", "03_Tiem_Nang": "stage_333", ... } },
     "CV_HR":        { "listId": "list_def", "stageMap": { "01_Dau_Vao": "stage_444", ... } },
     "CV_Marketing": { "listId": "list_ghi", "stageMap": { "01_Dau_Vao": "stage_777", ... } }
   }
   ```
3. Lấy object tương ứng với tên list đã chọn ở Bước 5.1 → ghi nhớ `listId` và `stageMap`.
4. Từ `stageMap`, lấy stageId của `01_Dau_Vao`, `02_Loai_CV`, `03_Tiem_Nang`.

### Bước 5.3 — Tạo thẻ ứng viên và chuyển stage

1. Gọi `privos.lists.createItem` với:
   * `listId`: ID lấy từ file config ở Bước 5.2
   * `title`: Họ tên ứng viên (lấy từ CV)
   * `stageId`: stageId của `01_Dau_Vao` từ stageMap
   * `description`: toàn bộ nội dung Markdown đã tạo ở BƯỚC 3
2. Sau khi tạo xong, gọi `privos.lists.moveItemToStage` để chuyển thẻ sang đúng cột:
   * Sang `03_Tiem_Nang` nếu kết quả là ✅ ĐẠT hoặc 🟡 CÂN NHẮC
   * Sang `02_Loai_CV` nếu kết quả là ❌ KHÔNG ĐẠT hoặc ⛔ KHÔNG TUYỂN
3. Cập nhật custom fields nếu list có định nghĩa sẵn:
   * `Tổng điểm`: điền số điểm đạt được
   * `CV Gốc`: đường dẫn/file PDF gốc từ BƯỚC 1




***

***

**YÊU CẦU ĐẦU RA CUỐI CÙNG (STRICT OUTPUT FORMAT):**&#x4B;hi hoàn tất toàn bộ 5 bước trên, bạn BẮT BUỘC phải trả về kết quả theo chuẩn sau để hệ thống tự động nhận diện:

* Phải trả về thẻ `<saved_file>` chứa ĐÚNG tên file MD đã lưu thành công ở BƯỚC 4.
* VD chuẩn xác: `<saved_file>2026-07-03_CV_NguyenVanA_LapTrinhVien_1.md</saved_file>`
* TUYỆT ĐỐI KHÔNG bọc thẻ `<saved_file>` vào trong block code (\`\`\`) hay bảng markdown.
