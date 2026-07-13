export const getInterviewEmailTemplate = (candidateName?: string) => {
  const name = candidateName || '{{Tên Ứng Viên}}';
  return `Dear Bạn ${name}
Cảm ơn bạn đã quan tâm và nộp hồ sơ ứng tuyển vào vị trí Thực tập sinh Lập trình viên (Dev Intern) tại CÔNG TY TNHH GIẢI PHÁP CHUYỂN ĐỔI SỐ VDX.
Sau khi xem xét hồ sơ, chúng tôi nhận thấy bạn phù hợp với vị trí này và trân trọng mời bạn tham gia buổi phỏng vấn trực tiếp tại văn phòng công ty với các thông tin như sau:

    Thời gian: 15h00, Thứ 3 ngày 21/10/2025
    Địa điểm: Tầng 4, Tòa nhà Sky Tower Thọ Tháp, 11 Phố Thọ Tháp, Đường Trần Thái Tông, Quận Cầu Giấy

Vui lòng xác nhận tham gia buổi phỏng vấn này trong vòng 24 giờ kể từ thời điểm nhận được email này, bằng cách phản hồi lại qua email hoặc liên hệ qua số điện thoại bên dưới:
Một số lưu ý trước buổi phỏng vấn:

    Vui lòng đến đúng giờ và mang theo CV, laptop.
    Nếu bạn không thể tham dự theo lịch trên, vui lòng phản hồi email này trước ngày 21/10/2025 để chúng tôi sắp xếp lại lịch phù hợp.

Chúng tôi mong được gặp bạn trong buổi phỏng vấn sắp tới.
Trân trọng,
Nguyễn Hà
HR VDX - 0886545918`;
};
