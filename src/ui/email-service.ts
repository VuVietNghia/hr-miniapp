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

export class EmailService {
  private provider: IEmailProvider;
  
  constructor(provider: IEmailProvider) {
    this.provider = provider;
  }
  
  async send(payload: EmailPayload, config: EmailProviderConfig): Promise<void> {
    await this.provider.sendEmail(payload, config);
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
