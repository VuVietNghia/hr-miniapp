import { EmailService, EmailJsProvider } from './email-service';

const service = new EmailService(new EmailJsProvider());

const mdContent1 = `
# 📄 Thông Tin Ứng Viên: Nguyễn Đăng Biển

* **Email:** <bienba8a@gmail.com>
`;

const res1 = service.parseCandidateInfo(mdContent1);
console.log("Result 1:", res1);
