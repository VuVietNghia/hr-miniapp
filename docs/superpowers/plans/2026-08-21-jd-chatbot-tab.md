# Hoàn thiện tab Chatbot JD

## Mục tiêu

Đưa toàn bộ trải nghiệm chat tạo/chỉnh sửa JD sang tab `Chatbot JD`; dùng dữ liệu thật trong `hr-miniapp/jds`; gỡ đúng nút và popup chat cũ của CV Pipeline.

## Phạm vi an toàn

- Giữ nguyên form tạo JD, chấm CV, tải lên, chọn và xem JD của CV Pipeline.
- Không sửa `loadJdContent` vì GitNexus xác định nó có rủi ro cao và được dùng bởi nhiều luồng JD hiện có.
- Khi AI trả JD, frontend chỉ ghi vào đường dẫn chuẩn `hr-miniapp/jds/<tên-file>.md`.

## Các bước

1. Viết kiểm thử đặc tả cho tải danh sách JD, chọn JD, và lưu JD từ phản hồi AI.
2. Thay giao diện mẫu của `JDChatbotTab` bằng dữ liệu và thao tác thật: chọn/tạo JD, tải nội dung, chat, hiển thị bản nháp.
3. Chuyển quy tắc prompt/phân tích phản hồi của popup hiện tại sang tab mới; với JD đang chọn, giữ nguyên tên file khi lưu.
4. Gỡ state, handler, nút và popup `Chat với AI` khỏi `PipelineDashboard`, không đụng form tạo JD khác.
5. Chạy kiểm thử, build, GitNexus detect-changes và kiểm tra diff.

## Kiểm chứng

- Chọn một JD đọc đúng nội dung từ `hr-miniapp/jds`.
- Chat chỉnh JD đang chọn ghi đè đúng file đó; chat tạo mới chỉ ghi trong `hr-miniapp/jds`.
- CV Pipeline không còn nút/popup chat nhưng các phần JD khác vẫn hiện.
