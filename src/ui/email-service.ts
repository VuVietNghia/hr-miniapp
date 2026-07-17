import { McpApp } from '@privos/app-react';
import { getFileContent, createOrUpdateFile } from './privos-rest';

// ---------------------------------------------------------
// 1. Dependency Injection setup
// ---------------------------------------------------------
export interface EmailPayload {
  toEmail: string;
  toName: string;
  subject?: string;
  content: string; // The fully interpolated HTML/Text content
}

export interface EmailProviderConfig {
  serviceId: string;
  templateId: string;
  publicKey: string;
}

export interface IEmailProvider {
  sendEmail(payload: EmailPayload, config: EmailProviderConfig): Promise<void>;
}

// ---------------------------------------------------------
// 2. EmailJS Provider Implementation
// ---------------------------------------------------------
export class EmailJsProvider implements IEmailProvider {
  async sendEmail(payload: EmailPayload, config: EmailProviderConfig): Promise<void> {
    if (!config.serviceId || !config.templateId || !config.publicKey) {
      throw new Error("EmailJS configuration is missing");
    }
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: config.serviceId,
        template_id: config.templateId,
        user_id: config.publicKey,
        template_params: {
          to_email: payload.toEmail,
          to_name: payload.toName,
          name: payload.toName, // backward compat with some templates
          from_name: 'Phòng Tuyển Dụng Privos',
          message: payload.content
        }
      })
    });
    
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Lỗi EmailJS: ${res.status} ${errText}`);
    }
  }
}

// ---------------------------------------------------------
// 3. Email Template Management Service
// ---------------------------------------------------------
export interface EmailTemplate {
  id: string;
  name: string;
  content: string;
}

export interface EmailSettings {
  templates: EmailTemplate[];
  emailJsConfig?: EmailProviderConfig;
}

const DEFAULT_TEMPLATES: EmailTemplate[] = [
  {
    id: 'interview_invitation',
    name: 'Mời phỏng vấn',
    content: `Dear Bạn {{Tên Ứng Viên}}
Cảm ơn bạn đã quan tâm và nộp hồ sơ ứng tuyển vào vị trí Thực tập sinh Lập trình viên (Dev Intern) tại CÔNG TY TNHH GIẢI PHÁP CHUYỂN ĐỔI SỐ VDX.
Sau khi xem xét hồ sơ, chúng tôi nhận thấy bạn phù hợp với vị trí này và trân trọng mời bạn tham gia buổi phỏng vấn trực tiếp tại văn phòng công ty với các thông tin như sau:

    Thời gian: {{Thời Gian}}
    Địa điểm: {{Địa Điểm}}

Vui lòng xác nhận tham gia buổi phỏng vấn này trong vòng 24 giờ kể từ thời điểm nhận được email này, bằng cách phản hồi lại qua email hoặc liên hệ qua số điện thoại bên dưới:
Một số lưu ý trước buổi phỏng vấn:

    Vui lòng đến đúng giờ và mang theo CV, laptop.
    Nếu bạn không thể tham dự theo lịch trên, vui lòng phản hồi email này trước {{Thời Gian}} để chúng tôi sắp xếp lại lịch phù hợp.

Chúng tôi mong được gặp bạn trong buổi phỏng vấn sắp tới.
Trân trọng,
Nguyễn Hà
HR VDX - {{SĐT}}`
  },
  {
    id: 'rejection_letter',
    name: 'Thông báo không phù hợp (Thank you letter)',
    content: `Dear Bạn {{Tên Ứng Viên}}
Cảm ơn bạn đã quan tâm và dành thời gian phỏng vấn/ứng tuyển tại VDX.
Rất tiếc, tại thời điểm hiện tại định hướng của bạn chưa hoàn toàn phù hợp với vị trí mà chúng tôi đang tìm kiếm.

Chúng tôi sẽ lưu hồ sơ của bạn vào hệ thống và sẽ liên hệ lại nếu có cơ hội phù hợp trong tương lai.
Chúc bạn nhiều sức khỏe và thành công trên con đường sắp tới.

Trân trọng,
Phòng Tuyển Dụng VDX.`
  }
];

export class EmailService {
  private provider: IEmailProvider;
  
  constructor(provider: IEmailProvider) {
    this.provider = provider;
  }
  
  async send(payload: EmailPayload, config: EmailProviderConfig): Promise<void> {
    await this.provider.sendEmail(payload, config);
  }
  
  async loadSettings(app: McpApp, roomId: string): Promise<EmailSettings> {
    const path = `${roomId}/hr-miniapp/configs/email_settings.json`;
    try {
      const content = await getFileContent(app, path);
      if (content && content.trim()) {
        return JSON.parse(content) as EmailSettings;
      }
    } catch (e) {
      console.warn("Không tìm thấy cấu hình Email, sẽ khởi tạo mặc định.", e);
    }
    
    // Default settings
    return {
      templates: DEFAULT_TEMPLATES
    };
  }
  
  async saveSettings(app: McpApp, roomId: string, settings: EmailSettings): Promise<void> {
    const path = `${roomId}/hr-miniapp/configs/email_settings.json`;
    await createOrUpdateFile(app, path, JSON.stringify(settings, null, 2));
  }
  
  parseCandidateInfo(mdContent: string): { name: string, email: string } {
    console.log(`[Email Debug] parseCandidateInfo nhận vào text độ dài: ${mdContent?.length || 0}`);
    if (!mdContent || mdContent.length < 50) {
      console.log(`[Email Debug] Nội dung text quá ngắn hoặc rỗng:\n"${mdContent}"`);
    }

    let email = '';
    // Lấy chuỗi theo nhiều định dạng (bỏ qua *, - hoặc khoảng trắng)
    const emailMatch = mdContent.match(/(?:-|\*)*\s*Email.*:\s*(?:-|\*)*\s*([^\n\r]+)/i);
    if (emailMatch) {
      email = emailMatch[1].trim();
      
      // Bóc tách nếu AI dùng Markdown link: [abc@gmail.com](mailto:abc@gmail.com)
      const linkMatch = email.match(/\[([^\]]+)\]\([^)]+\)/);
      if (linkMatch) {
        email = linkMatch[1];
      }
      
      // Xóa các ký tự thừa (dấu *, dấu <, >, mailto:)
      email = email.replace(/\*/g, '').replace(/<mailto:([^>]+)>/g, '$1').replace(/[<>]/g, '').trim();
    }

    // Fallback cực mạnh: Quét tìm định dạng email chuẩn trong toàn bộ văn bản nếu match theo nhãn thất bại
    if (!email) {
      const rawEmailMatch = mdContent.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (rawEmailMatch) {
        email = rawEmailMatch[0];
      }
    }
    
    console.log(`[Email Debug] Kết quả trích xuất Email: "${email}"`);
    
    let name = '';
    const nameMatch = mdContent.match(/# 📄 Thông Tin Ứng Viên:\s*(.*)/i);
    if (nameMatch) {
      name = nameMatch[1].trim();
      name = name.replace(/\*/g, '').trim();
    }
    
    console.log(`[Email Debug] Kết quả trích xuất Name: "${name}"`);
    
    return { name, email };
  }
}
