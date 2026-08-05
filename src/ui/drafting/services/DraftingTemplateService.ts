import { DraftingTemplate, DraftingActionType } from '../types';

export function renderDraftingTemplate(
  template: DraftingTemplate | string,
  customData: Record<string, string> = {}
): string {
  const defaultData = typeof template === 'object' ? template.defaultData : {};
  let text = typeof template === 'object' ? template.templateText : template;

  const mergedData: Record<string, string> = {
    ...defaultData,
    ...customData
  };

  const now = new Date();
  if (!mergedData.currentDate) {
    mergedData.currentDate = `${now.getDate()} tháng ${now.getMonth() + 1} năm ${now.getFullYear()}`;
  }
  if (!mergedData.year) {
    mergedData.year = `${now.getFullYear()}`;
  }
  if (!mergedData.docNumber) {
    mergedData.docNumber = '01';
  }

  Object.entries(mergedData).forEach(([key, val]) => {
    const pattern = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    text = text.replace(pattern, val || `[${key}]`);
  });

  return text;
}

export function buildDraftingAIPrompt(
  template: DraftingTemplate,
  formData: Record<string, string>,
  actionType: DraftingActionType | string = 'full_generation',
  customPrompt?: string,
  currentDocContent?: string
): string {
  const mergedData = { ...template.defaultData, ...formData };

  let actionInstruction = '';
  switch (actionType) {
    case 'make_formal':
      actionInstruction = `NÂNG CAO TÍNH TRANG TRỌNG: Viết lại hoặc tinh chỉnh văn bản hiện tại với văn phong hành chính nhà nước/doanh nghiệp cao cấp, chuẩn mực, uy nghiêm và đúng ngữ pháp pháp lý.`;
      break;
    case 'make_concise':
      actionInstruction = `TINH GỌN VĂN BẢN: Tối ưu hoá câu chữ, súc tích, loại bỏ từ thừa nhưng tuyệt đối giữ nguyên toàn bộ các số liệu, ngày tháng, tên người và các điều khoản quan trọng.`;
      break;
    case 'add_nda':
      actionInstruction = `BỔ SUNG ĐIỀU KHOẢN BẢO MẬT: Chèn thêm một điều khoản/mục riêng về Bảo mật thông tin (NDA), quyền sở hữu trí tuệ và chế tài xử lý vi phạm phù hợp với loại văn bản này.`;
      break;
    case 'bilingual_summary':
      actionInstruction = `TÓM TẮT SONG NGỮ: Thêm một khung tóm tắt song ngữ Việt - Anh (Executive Summary) ngắn gọn ở đầu văn bản trước khi vào nội dung chính.`;
      break;
    case 'custom':
      actionInstruction = `YÊU CẦU TÙY CHỈNH TỪ NGƯỜI DÙNG: "${customPrompt || 'Hoàn thiện văn bản theo ngữ cảnh'}"`;
      break;
    case 'full_generation':
    default:
      actionInstruction = `SOẠN THẢO HOÀN CHỈNH: Điền toàn bộ thông tin từ biểu mẫu vào văn bản, diễn giải chi tiết, rõ ràng các nội dung nghiệp vụ dựa trên mẫu chuẩn.`;
      break;
  }

  return `Bạn là Trợ lý Soạn thảo Văn bản Hành chính & Doanh nghiệp cấp cao (B.Army Drafting AI Copilot).

THÔNG TIN MẪU VĂN BẢN:
- Tên mẫu: ${template.title}
- Danh mục: ${template.categoryLabel}
- Chuẩn thể thức: ${template.track === 'nd30_administrative' ? 'Nghị định 30/2020/NĐ-CP' : 'Doanh nghiệp hiện đại'}

DỮ LIỆU ĐẦU VÀO (FORM DATA):
${JSON.stringify(mergedData, null, 2)}

${currentDocContent ? `NỘI DUNG VĂN BẢN HIỆN TẠI:\n"""\n${currentDocContent}\n"""\n` : ''}

TÁC VỤ CẦN THỰC HIỆN:
${actionInstruction}

QUY TẮC BẮT BUỘC:
1. Giữ cấu trúc định dạng Markdown chuẩn thể thức văn bản:
   - Với Nghị định 30: Quốc hiệu in hoa đậm, Tiêu ngữ in thường đứng đậm, Bảng 2 cột cân đối ở tiêu đề và phần Nơi nhận/Ký tên.
   - Thay thế toàn bộ các biến placeholder {{key}} bằng dữ liệu thực tế, không để lại placeholder thô.
2. Không bịa đặt các số liệu không có căn cứ.
3. Bọc toàn bộ nội dung văn bản Markdown kết quả bên trong thẻ <drafting_content>...</drafting_content>.
Không giải thích lan man bên ngoài thẻ.`;
}

export class DraftingTemplateService {
  public render(template: DraftingTemplate | string, customData: Record<string, string> = {}): string {
    return renderDraftingTemplate(template, customData);
  }

  public buildAIPrompt(
    template: DraftingTemplate,
    formData: Record<string, string>,
    actionType: DraftingActionType | string = 'full_generation',
    customPrompt?: string,
    currentDocContent?: string
  ): string {
    return buildDraftingAIPrompt(template, formData, actionType, customPrompt, currentDocContent);
  }
}
