import { mailService } from './src/services/MailService';

mailService.queueMail({
  toName: 'Nghia Vu',
  toEmail: 'vvn0068@gmail.com',
  subject: 'Test Email từ PrivOS HR Demo',
  htmlContent: '<p>Xin chào, đây là email test gửi từ hệ thống HR PrivOS.</p>'
}).then(() => {
  console.log('Task đã vào hàng đợi. Vui lòng chờ 2 giây để gửi thực tế.');
  setTimeout(() => process.exit(0), 3000);
}).catch(console.error);
