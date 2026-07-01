export interface IScreeningStrategy {
  getRenamePrompt(): string;
  getScoringPrompt(jdContent: string): string;
}

export class MarkdownScreeningStrategy implements IScreeningStrategy {
  private chuanHoaRules: string;
  private sangLocRules: string;

  constructor(chuanHoaRules: string, sangLocRules: string) {
    this.chuanHoaRules = chuanHoaRules;
    this.sangLocRules = sangLocRules;
  }

  getRenamePrompt(): string {
    return `<task>
  <objective>Trích xuất họ tên và ngày nộp từ DỮ LIỆU TEXT BÊN DƯỚI để tạo tên file mới.</objective>
  <strict_constraints>
    - Nguồn dữ liệu DUY NHẤT: Nội dung text được bọc trong thẻ <raw_cv_text>.
    - CẤM MỌI HÀNH VI TỰ CHẾ HOẶC DỰ ĐOÁN. Nếu không tìm thấy, dùng giá trị "KhongXacDinh".
  </strict_constraints>
  <data_standardization>
${this.chuanHoaRules}
  </data_standardization>
  <output_format>
    Chỉ trả về 1 dòng duy nhất chứa tên file mới. KHÔNG JSON. KHÔNG GIẢI THÍCH.
  </output_format>
</task>`;
  }

  getScoringPrompt(jdContent: string): string {
    return `<task>
  <objective>
    Chấm điểm CV dựa trên Job Description và Bộ Tiêu Chuẩn.
  </objective>
  <context>
    <job_description>
${jdContent}
    </job_description>
    <evaluation_criteria>
${this.sangLocRules}
    </evaluation_criteria>
  </context>
  
  <execution_steps>
    1. Đọc nội dung text bên trong thẻ <raw_cv_text>. 
    2. Trích xuất CÁC TRÍCH DẪN NGUYÊN VĂN (exact quotes) từ văn bản cho các kỹ năng, kinh nghiệm, học vấn.
    3. Đối chiếu các trích dẫn đó với <evaluation_criteria> để ra quyết định ĐẠT/CÂN NHẮC/KHÔNG ĐẠT/KHÔNG TUYỂN.
  </execution_steps>

  <strict_constraints>
    - KHÔNG SỬ DỤNG DỮ LIỆU TỪ NGUỒN KHÁC NGOÀI TEXT ĐƯỢC CẤP.
    - Mọi đánh giá phải có BẰNG CHỨNG LÀ TRÍCH DẪN TỪ TEXT.
    - Nếu CV không ghi thông tin, mặc định là ứng viên KHÔNG CÓ thông tin đó. Không tự suy diễn.
  </strict_constraints>

  <output_schema>
    Bạn PHẢI trả về ĐÚNG CẤU TRÚC JSON sau. Đặt nó bên trong khối \`\`\`json ... \`\`\`.
    {
      "verification": {
        "text_analyzed": "Yes/No (Bạn có lấy dữ liệu từ thẻ raw_cv_text không?)"
      },
      "extracted_evidence": [
        "Quote 1 nguyên văn từ CV...",
        "Quote 2 nguyên văn từ CV..."
      ],
      "markdown": "Nội dung CV chuẩn hóa (Markdown)",
      "category": "ĐẠT | CÂN NHẮC | KHÔNG ĐẠT | KHÔNG TUYỂN",
      "score": 85,
      "reason": "Lý do (Phải viện dẫn các quote ở trên)"
    }
  </output_schema>
</task>`;
  }
}
