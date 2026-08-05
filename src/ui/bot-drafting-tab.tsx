import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { usePrivosApp, usePrivosContext, type McpApp } from '@privos/app-react';
import {
  DRAFTING_TEMPLATES,
  DraftingTemplate,
  renderDraftingTemplate,
  buildDraftingAIPrompt
} from './drafting-templates';
import { PipelineService } from './pipeline-service';
import { MarkdownPathContextBuilder } from './cv-context-builder';
import { createOrUpdateFile } from './privos-rest';
import { DocxExportService } from './docx-export-service';
import { PrivOSLifecycleService } from './lifecycle/services/PrivOSLifecycleService';
import { getMockProfiles } from './lifecycle/services/lifecycleService';
import type { EmployeeProfile, ILifecycleService } from './lifecycle/types';
import './contact-form-styles.css';
import './bot-drafting.css';

export interface BotDraftingTabProps {
  app?: McpApp | null;
  roomId?: string | null;
  onLog?: (msg: string) => void;
  lifecycleService?: ILifecycleService | null;
  pipelineService?: PipelineService | null;
}

type TemplateCategory = 'all' | 'onboarding' | 'personnel' | 'admin' | 'legal';

const CATEGORIES: { id: TemplateCategory; label: string; icon: string }[] = [
  { id: 'all', label: 'Tất cả mẫu', icon: '📑' },
  { id: 'onboarding', label: 'Tuyển dụng & Thử việc', icon: '👋' },
  { id: 'personnel', label: 'Nhân sự & Quyết định', icon: '👥' },
  { id: 'admin', label: 'Hành chính & Công văn', icon: '🏛️' },
  { id: 'legal', label: 'Pháp lý & Đề án', icon: '⚖️' }
];

const FIELD_GROUPS = [
  {
    id: 'personnel',
    title: 'Thông tin Nhân sự & Ứng viên',
    icon: '👤',
    keys: [
      'candidateName',
      'employeeName',
      'position',
      'currentPosition',
      'newPosition',
      'department',
      'idCard',
      'email',
      'phone',
      'oldSalary',
      'newSalary',
      'probationSalary',
      'officialSalary',
      'baseSalary'
    ]
  },
  {
    id: 'company',
    title: 'Đơn vị & Pháp lý',
    icon: '🏛️',
    keys: [
      'companyName',
      'companyRep',
      'companyRole',
      'companyAddress',
      'draftingDept',
      'planCode',
      'docCode',
      'recipientOrg',
      'targetCompany'
    ]
  },
  {
    id: 'content',
    title: 'Nội dung & Thời hạn',
    icon: '📄',
    keys: [
      'subject',
      'announcementTitle',
      'reportTitle',
      'meetingSubject',
      'proposalSubject',
      'reason',
      'startDate',
      'endDate',
      'resumeDate',
      'duration',
      'totalBudget',
      'budget',
      'meetingTime',
      'meetingLocation',
      'expectedRoi',
      'notes'
    ]
  },
  {
    id: 'signers',
    title: 'Ký duyệt, Chủ trì & Nơi nhận',
    icon: '✍️',
    keys: [
      'signerName',
      'signerRole',
      'proposerName',
      'proposerRole',
      'approver',
      'recipients',
      'recipientGroup',
      'chairperson',
      'secretary',
      'attendees',
      'authorizerName',
      'authorizerRole',
      'authorizerId',
      'authorizedPerson',
      'authorizedRole',
      'authorizedId',
      'authorizedIdDate',
      'authorizedIdPlace',
      'scope',
      'validFrom',
      'validTo'
    ]
  }
];

/**
 * Maps an EmployeeProfile to template form fields based on target schema.
 */
function mapProfileToFormData(profile: EmployeeProfile, currentData: Record<string, string>): Record<string, string> {
  const updated = { ...currentData };

  if ('candidateName' in updated) {
    updated.candidateName = profile.name;
  }
  if ('employeeName' in updated) {
    updated.employeeName = profile.name;
  }
  if ('position' in updated && profile.position) {
    updated.position = profile.position;
  }
  if ('currentPosition' in updated && profile.position) {
    updated.currentPosition = profile.position;
  }
  if ('department' in updated && profile.department) {
    updated.department = profile.department;
  }
  if ('startDate' in updated && profile.startDate) {
    updated.startDate = profile.startDate;
  }
  if ('email' in updated && profile.email) {
    updated.email = profile.email;
  }
  if ('phone' in updated && profile.phone) {
    updated.phone = profile.phone;
  }

  return updated;
}

/**
 * Safely replaces a field value or placeholder inside a document while preserving AI-generated modifications.
 */
function replaceValueInDocument(doc: string, oldValue: string, newValue: string, fieldKey?: string): string {
  if (!doc) return doc;

  // 1. If oldValue is meaningful (not empty and distinct from newValue) and exists in doc
  if (oldValue && oldValue.trim() !== '' && oldValue !== newValue && doc.includes(oldValue)) {
    return doc.split(oldValue).join(newValue);
  }

  // 2. If oldValue is not found but template placeholder exists (e.g. {{fieldKey}})
  if (fieldKey) {
    const placeholder = `{{${fieldKey}}}`;
    if (doc.includes(placeholder)) {
      return doc.split(placeholder).join(newValue);
    }
  }

  return doc;
}

/**
 * Checks if a template is designed for personnel / HR onboarding.
 */
function isPersonnelTemplate(template: DraftingTemplate): boolean {
  if (template.category === 'onboarding' || template.category === 'personnel') {
    return true;
  }
  const defaultKeys = Object.keys(template.defaultData);
  return defaultKeys.some(k => ['candidateName', 'employeeName', 'position', 'currentPosition'].includes(k));
}

export default function BotDraftingTab(props: BotDraftingTabProps) {
  // PrivOS Context Resolution (Supports both Direct Props and Ambient Context)
  const contextApp = usePrivosApp();
  const contextRoomInfo = usePrivosContext();

  const app = props.app !== undefined ? props.app : contextApp;
  const roomId = props.roomId !== undefined ? props.roomId : (contextRoomInfo?.roomId ?? null);
  const onLog = useCallback((msg: string) => {
    if (props.onLog) {
      props.onLog(msg);
    } else {
      console.log(`[BotDrafting] ${msg}`);
    }
  }, [props.onLog]);

  // Dependency Injection: Service Instantiations
  const lifecycleService: ILifecycleService | null = useMemo(() => {
    if (props.lifecycleService !== undefined) {
      return props.lifecycleService;
    }
    if (app) {
      return new PrivOSLifecycleService(app);
    }
    return null;
  }, [props.lifecycleService, app]);

  const pipelineService: PipelineService | null = useMemo(() => {
    if (props.pipelineService !== undefined) {
      return props.pipelineService;
    }
    if (app && roomId) {
      return new PipelineService(app, roomId, new MarkdownPathContextBuilder());
    }
    return null;
  }, [props.pipelineService, app, roomId]);

  // UI States
  const [templates] = useState<DraftingTemplate[]>(DRAFTING_TEMPLATES);
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0].id);
  const [sidebarTab, setSidebarTab] = useState<'form' | 'ai'>('form');
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  const [formData, setFormData] = useState<Record<string, string>>({});
  const [documentContent, setDocumentContent] = useState<string>('');
  const [viewMode, setViewMode] = useState<'a4' | 'raw'>('a4');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isAiModified, setIsAiModified] = useState<boolean>(false);
  const [pollingStatus, setPollingStatus] = useState<string>('');
  const [aiCustomPrompt, setAiCustomPrompt] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Personnel List State from Kanban / Profiles
  const [profiles, setProfiles] = useState<EmployeeProfile[]>([]);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState<boolean>(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');

  const currentTemplate = useMemo(
    () => templates.find(t => t.id === selectedTemplateId) || templates[0],
    [templates, selectedTemplateId]
  );

  const isPersonnel = useMemo(() => isPersonnelTemplate(currentTemplate), [currentTemplate]);

  // Filter templates by category and search
  const filteredTemplates = useMemo(() => {
    return templates.filter(tpl => {
      const matchesCat = selectedCategory === 'all' || tpl.category === selectedCategory;
      const matchesSearch =
        !searchQuery.trim() ||
        tpl.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tpl.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [templates, selectedCategory, searchQuery]);

  // Toast Notification Helper
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  // Fetch Employee Profiles on mount / roomId change
  useEffect(() => {
    let isMounted = true;

    async function loadEmployeeProfiles() {
      setIsLoadingProfiles(true);
      try {
        if (lifecycleService && roomId) {
          const fetchedProfiles = await lifecycleService.loadProfiles(roomId);
          if (isMounted) {
            setProfiles(fetchedProfiles.length > 0 ? fetchedProfiles : getMockProfiles());
          }
        } else {
          if (isMounted) {
            setProfiles(getMockProfiles());
          }
        }
      } catch (err) {
        console.warn('[BotDrafting] Fallback to mock profiles due to load failure:', err);
        if (isMounted) {
          setProfiles(getMockProfiles());
        }
      } finally {
        if (isMounted) {
          setIsLoadingProfiles(false);
        }
      }
    }

    loadEmployeeProfiles();

    return () => {
      isMounted = false;
    };
  }, [lifecycleService, roomId]);

  // Initialize Form Data when Template Changes
  useEffect(() => {
    setSelectedProfileId('');
    setIsAiModified(false);
    setFormData({ ...currentTemplate.defaultData });
    const initialText = renderDraftingTemplate(currentTemplate.templateText, currentTemplate.defaultData);
    setDocumentContent(initialText);
  }, [selectedTemplateId, currentTemplate]);

  // Update Live Document when form inputs change (smart find-and-replace if AI-modified)
  const handleInputChange = (key: string, value: string) => {
    const oldValue = formData[key] ?? '';
    const updated = { ...formData, [key]: value };
    setFormData(updated);

    if (isAiModified) {
      const updatedContent = replaceValueInDocument(documentContent, oldValue, value, key);
      setDocumentContent(updatedContent);
    } else {
      const rendered = renderDraftingTemplate(currentTemplate.templateText, updated);
      setDocumentContent(rendered);
    }
  };

  // Handle Quick Employee Profile Selection & Auto-populate
  const handleProfileSelect = (profileId: string) => {
    setSelectedProfileId(profileId);
    if (!profileId) return;

    const profile = profiles.find(p => p._id === profileId);
    if (!profile) return;

    const updated = mapProfileToFormData(profile, formData);

    if (isAiModified) {
      let updatedContent = documentContent;
      for (const [key, newVal] of Object.entries(updated)) {
        const oldVal = formData[key] ?? '';
        if (oldVal !== newVal) {
          updatedContent = replaceValueInDocument(updatedContent, oldVal, newVal, key);
        }
      }
      setFormData(updated);
      setDocumentContent(updatedContent);
    } else {
      setFormData(updated);
      const rendered = renderDraftingTemplate(currentTemplate.templateText, updated);
      setDocumentContent(rendered);
    }
    showToast(`Đã tự động nạp hồ sơ nhân sự "${profile.name}" vào văn bản!`);
  };

  // Restore Default Template (Discards AI modifications)
  const handleResetTemplate = () => {
    setSelectedProfileId('');
    setIsAiModified(false);
    setFormData({ ...currentTemplate.defaultData });
    const initialText = renderDraftingTemplate(currentTemplate.templateText, currentTemplate.defaultData);
    setDocumentContent(initialText);
    showToast('Đã khôi phục văn bản về mẫu chuẩn ban đầu!');
  };

  // AI Pipeline Execution with Real-Time Polling Status
  const handleAiAction = async (
    actionType: 'full_generation' | 'make_formal' | 'make_concise' | 'add_nda' | 'bilingual_summary' | 'custom'
  ) => {
    if (isGenerating) return;

    if (!pipelineService || !app || !roomId) {
      showToast('Chưa kết nối PrivOS. Vui lòng mở trong ứng dụng PrivOS.');
      return;
    }

    setIsGenerating(true);
    setPollingStatus('Đang gửi yêu cầu cho AI...');
    onLog(`[AI DRAFTING] Khởi chạy tác vụ: ${actionType} cho "${currentTemplate.title}"`);

    try {
      const prompt = buildDraftingAIPrompt(
        currentTemplate,
        formData,
        actionType,
        actionType === 'custom' ? aiCustomPrompt : undefined,
        documentContent
      );

      const aiResponse = await pipelineService.askAI(prompt, undefined, undefined, onLog);
      let text = aiResponse.text;

      // Extract content from <drafting_content> tag if present
      const contentMatch = text.match(/<drafting_content>\s*([\s\S]*?)\s*<\/drafting_content>/i);
      let finalMarkdown = contentMatch ? contentMatch[1].trim() : text.trim();

      // Clean AI artifacts (em dash, colon in headings)
      finalMarkdown = finalMarkdown.replace(/—/g, ' - ');

      setDocumentContent(finalMarkdown);
      setIsAiModified(true);
      setPollingStatus('Hoàn tất!');
      showToast('AI đã hoàn tất soạn thảo văn bản!');
      if (actionType === 'custom') setAiCustomPrompt('');
    } catch (err: any) {
      console.error('Lỗi khi gọi AI soạn thảo:', err);
      onLog(`[LỖI] ${err.message || err}`);
      setPollingStatus('Gặp lỗi khi xử lý AI');
      showToast(`Lỗi: ${err.message || err}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Export & Action Handlers
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(documentContent);
      showToast('Đã sao chép nội dung văn bản vào bộ nhớ tạm!');
    } catch (e) {
      console.error(e);
      showToast('Không thể sao chép văn bản.');
    }
  };

  const handleDownloadMd = () => {
    const blob = new Blob([documentContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentTemplate.id}_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Đã tải xuống file .md thành công!');
  };

  const handleDownloadDocx = async () => {
    try {
      const filename = `${currentTemplate.id}_${new Date().toISOString().slice(0, 10)}.docx`;
      await DocxExportService.downloadDocx(filename, documentContent);
      showToast('Đã xuất file Word (.docx) chuẩn Nghị định 30 thành công!');
    } catch (err: any) {
      console.error('Lỗi khi xuất Word .docx:', err);
      showToast(`Lỗi khi tạo file Word: ${err.message || err}`);
    }
  };

  const handleSaveToPrivos = async () => {
    if (!app || !roomId) {
      showToast('Chưa kết nối PrivOS để lưu file vào Room.');
      return;
    }

    try {
      const filename = `${currentTemplate.id}_${new Date().toISOString().slice(0, 10)}.md`;
      const targetPath = `${roomId}/hr-miniapp/van-ban/${filename}`;
      await createOrUpdateFile(app, targetPath, documentContent);
      showToast(`Đã lưu tài liệu vào Room PrivOS: ${targetPath}`);
      onLog(`[LƯU FILE] Thành công lưu "${targetPath}" vào phòng.`);
    } catch (err: any) {
      console.error('Lỗi lưu file PrivOS:', err);
      showToast(`Lỗi khi lưu vào Room: ${err.message || err}`);
    }
  };

  // Zoom Helpers
  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 10, 130));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 10, 70));
  const handleZoomReset = () => setZoomLevel(100);

  // Group Form Fields logically for clean UI
  const groupedFields = useMemo(() => {
    const presentKeys = Object.keys(formData);
    const groups: { id: string; title: string; icon: string; fields: [string, string][] }[] = [];
    const assigned = new Set<string>();

    for (const group of FIELD_GROUPS) {
      const fieldsInGroup = group.keys
        .filter(k => presentKeys.includes(k))
        .map(k => [k, formData[k]] as [string, string]);

      if (fieldsInGroup.length > 0) {
        groups.push({
          id: group.id,
          title: group.title,
          icon: group.icon,
          fields: fieldsInGroup
        });
        fieldsInGroup.forEach(([k]) => assigned.add(k));
      }
    }

    const remaining = presentKeys
      .filter(k => !assigned.has(k))
      .map(k => [k, formData[k]] as [string, string]);

    if (remaining.length > 0) {
      groups.push({
        id: 'other',
        title: 'Thông tin khác',
        icon: 'ℹ️',
        fields: remaining
      });
    }

    return groups;
  }, [formData]);

  // Professional A4 Parser according to NĐ 30/2020/NĐ-CP Standard
  const renderFormattedA4 = (markdown: string) => {
    const lines = markdown.split('\n');
    const elements: React.ReactNode[] = [];
    let tableBuffer: string[] = [];

    const flushTable = (keyPrefix: string) => {
      if (tableBuffer.length === 0) return;
      const rows = tableBuffer.map(r =>
        r.split('|').slice(1, -1).map(c => c.trim())
      );

      const isHeader2Col = rows.length >= 2 && rows[0].length === 2 && rows[1].every(c => /^:?-+:?$/.test(c));

      if (isHeader2Col) {
        const leftCell = rows[0][0];
        const rightCell = rows[0][1];

        elements.push(
          <div key={`header-table-${keyPrefix}`} className="a4-header-grid">
            <div className="a4-header-col-left">
              <div
                className="a4-org-block"
                dangerouslySetInnerHTML={{
                  __html: leftCell
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(.*?)\*/g, '<em>$1</em>')
                }}
              />
              <div className="a4-line-dec a4-line-org" />
            </div>
            <div className="a4-header-col-right">
              <div
                className="a4-motto-block"
                dangerouslySetInnerHTML={{
                  __html: rightCell
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(.*?)\*/g, '<em>$1</em>')
                }}
              />
              <div className="a4-line-dec a4-line-motto" />
            </div>
          </div>
        );
      } else {
        elements.push(
          <table key={`table-${keyPrefix}`} className="a4-table">
            <tbody>
              {rows.map((row, rIdx) => {
                if (rIdx === 1 && row.every(c => /^:?-+:?$/.test(c))) return null;
                const isHead = rIdx === 0;
                return (
                  <tr key={`tr-${rIdx}`}>
                    {row.map((cell, cIdx) => (
                      <td
                        key={`td-${cIdx}`}
                        className={isHead ? 'a4-th' : 'a4-td'}
                        dangerouslySetInnerHTML={{
                          __html: cell
                            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                            .replace(/\*(.*?)\*/g, '<em>$1</em>')
                        }}
                      />
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        );
      }
      tableBuffer = [];
    };

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        tableBuffer.push(trimmed);
        i++;
        continue;
      } else if (tableBuffer.length > 0) {
        flushTable(`table-${i}`);
      }

      if (!trimmed) {
        elements.push(<div key={`empty-${i}`} style={{ height: '6px' }} />);
        i++;
        continue;
      }

      if (trimmed.startsWith('# ')) {
        elements.push(
          <h1 key={`h1-${i}`} className="a4-heading-1">
            {trimmed.replace('# ', '')}
          </h1>
        );
        i++;
      } else if (trimmed.startsWith('### ') || trimmed.startsWith('## ')) {
        const subText = trimmed.replace(/^#{2,3}\s+/, '');
        const isSubject = DocxExportService.isSubjectLine(subText);
        elements.push(
          <React.Fragment key={`sub-${i}`}>
            <h3 className={isSubject ? 'a4-subject-heading' : 'a4-heading-3'}>
              {subText}
            </h3>
            {isSubject && <div className="a4-line-dec a4-line-subject" />}
          </React.Fragment>
        );
        i++;
      } else if (trimmed === '---' || trimmed === '***') {
        elements.push(<hr key={`hr-${i}`} className="a4-divider" />);
        i++;
      } else if (DocxExportService.isLegalBasisLine(trimmed)) {
        const rawLegalLines: string[] = [];
        const startIndex = i;
        while (i < lines.length && DocxExportService.isLegalBasisLine(lines[i].trim())) {
          rawLegalLines.push(lines[i].trim());
          i++;
        }

        const normalizedLegalLines = DocxExportService.normalizeLegalBases(rawLegalLines);
        normalizedLegalLines.forEach((legalText, lIdx) => {
          elements.push(
            <p key={`legal-${startIndex}-${lIdx}`} className="a4-legal-basis">
              <em>{legalText}</em>
            </p>
          );
        });
      } else if (/^[a-z]\)\s+/.test(trimmed)) {
        elements.push(
          <p
            key={`sec-${i}`}
            className="a4-sub-section"
            dangerouslySetInnerHTML={{
              __html: trimmed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>')
            }}
          />
        );
        i++;
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        elements.push(
          <p
            key={`bullet-${i}`}
            className="a4-bullet-item"
            dangerouslySetInnerHTML={{
              __html: `• ${trimmed.replace(/^[-*]\s+/, '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>')}`
            }}
          />
        );
        i++;
      } else if (trimmed === './.') {
        elements.push(
          <p key={`end-${i}`} className="a4-end-mark">
            <strong>./.</strong>
          </p>
        );
        i++;
      } else {
        elements.push(
          <p
            key={`p-${i}`}
            className="a4-paragraph"
            dangerouslySetInnerHTML={{
              __html: trimmed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>')
            }}
          />
        );
        i++;
      }
    }

    if (tableBuffer.length > 0) {
      flushTable(`table-final`);
    }

    return elements;
  };

  const labelMap: Record<string, string> = {
    companyName: 'Tên Doanh nghiệp',
    companyRep: 'Người đại diện',
    companyRole: 'Chức danh người đại diện',
    companyAddress: 'Địa chỉ công ty',
    signerName: 'Họ tên người ký',
    signerRole: 'Chức danh người ký',
    candidateName: 'Họ tên nhân sự / Ứng viên',
    employeeName: 'Họ tên nhân sự',
    position: 'Vị trí công tác',
    currentPosition: 'Vị trí hiện tại',
    newPosition: 'Vị trí bổ nhiệm mới',
    department: 'Phòng ban / Bộ phận',
    draftingDept: 'Đơn vị soạn thảo',
    subject: 'Trích yếu / Nội dung chính',
    recipients: 'Nơi nhận / Kính gửi',
    totalBudget: 'Tổng ngân sách dự toán',
    duration: 'Thời gian thực hiện',
    planCode: 'Số hiệu kế hoạch',
    startDate: 'Ngày bắt đầu',
    endDate: 'Ngày kết thúc',
    probationSalary: 'Lương thử việc',
    officialSalary: 'Lương chính thức',
    baseSalary: 'Mức lương thỏa thuận',
    oldSalary: 'Mức lương cũ',
    newSalary: 'Mức lương mới',
    idCard: 'Số CCCD / MST',
    announcementTitle: 'Tiêu đề thông báo',
    recipientGroup: 'Đối tượng nhận thông báo',
    resumeDate: 'Ngày làm việc lại',
    reason: 'Lý do ban hành',
    docCode: 'Số hiệu văn bản',
    recipientOrg: 'Đơn vị nhận / Đối tác',
    approver: 'Cấp có thẩm quyền phê duyệt',
    proposerRole: 'Chức danh người trình',
    proposerName: 'Họ tên người trình',
    budget: 'Tổng kinh phí dự toán',
    reportTitle: 'Tiêu đề báo cáo',
    reportingDept: 'Đơn vị thực hiện báo cáo',
    reporterRole: 'Chức danh người báo cáo',
    reporterName: 'Họ tên người báo cáo',
    meetingSubject: 'Chủ đề cuộc họp',
    meetingTime: 'Thời gian họp',
    meetingLocation: 'Địa điểm họp',
    chairperson: 'Chủ trì cuộc họp',
    secretary: 'Thư ký cuộc họp',
    attendees: 'Thành phần tham dự',
    authorizerName: 'Họ tên người ủy quyền',
    authorizerRole: 'Chức danh người ủy quyền',
    authorizerId: 'CCCD người ủy quyền',
    authorizedPerson: 'Họ tên người được ủy quyền',
    authorizedRole: 'Chức danh người được ủy quyền',
    authorizedId: 'CCCD người được ủy quyền',
    authorizedIdDate: 'Ngày cấp CCCD',
    authorizedIdPlace: 'Nơi cấp CCCD',
    scope: 'Phạm vi ủy quyền',
    validFrom: 'Hiệu lực từ ngày',
    validTo: 'Hiệu lực đến ngày',
    proposalSubject: 'Tên đề án / Đề xuất',
    targetCompany: 'Đơn vị tiếp nhận đề xuất',
    expectedRoi: 'Hiệu quả kỳ vọng (ROI)'
  };

  return (
    <main className="bot-drafting-tab">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="bot-toast-message">
          <span>✓</span> {toastMessage}
        </div>
      )}

      {/* Modern Header Banner */}
      <section className="bot-drafting-header">
        <div className="bot-drafting-title-area">
          <div className="bot-drafting-title-icon">✍️</div>
          <div className="bot-drafting-title-text">
            <h1>
              Bot Soạn Thảo Văn Bản Chuẩn Doanh Nghiệp
              <span className="bot-drafting-badge">Nghị định 30/2020/NĐ-CP</span>
            </h1>
            <p>
              Soạn thảo Kế hoạch, Quyết định, Hợp đồng, Thư mời nhận việc, Công văn, Tờ trình và xuất file Word (.docx) chuyên nghiệp.
            </p>
          </div>
        </div>
        <div className="bot-drafting-status-pill">
          <span className="bot-drafting-status-dot" />
          {isGenerating ? `AI: ${pollingStatus}` : 'PrivOS AI Sẵn sàng'}
        </div>
      </section>

      {/* Category Filter Bar */}
      <nav className="bot-category-bar" aria-label="Phân loại biểu mẫu">
        {CATEGORIES.map(cat => {
          const isActive = selectedCategory === cat.id;
          const count = cat.id === 'all'
            ? templates.length
            : templates.filter(t => t.category === cat.id).length;

          return (
            <button
              key={cat.id}
              type="button"
              className={`bot-cat-pill ${isActive ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
              <span style={{ opacity: 0.8, fontSize: '0.72rem' }}>({count})</span>
            </button>
          );
        })}
      </nav>

      {/* Template Grid Selector */}
      <section className="bot-template-grid" aria-label="Danh sách mẫu văn bản">
        {filteredTemplates.map(tpl => {
          const isActive = tpl.id === selectedTemplateId;
          const isND30 = tpl.track === 'nd30_administrative';

          return (
            <div
              key={tpl.id}
              className={`bot-template-card ${isActive ? 'active' : ''}`}
              onClick={() => setSelectedTemplateId(tpl.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setSelectedTemplateId(tpl.id);
                }
              }}
            >
              <div className="bot-tpl-icon">{tpl.icon}</div>
              <div className="bot-tpl-meta">
                <div className="bot-tpl-title" title={tpl.title}>{tpl.title}</div>
                <div className="bot-tpl-desc">{tpl.description}</div>
                <div>
                  <span className={`bot-track-badge ${isND30 ? 'bot-track-nd30' : 'bot-track-modern'}`}>
                    {isND30 ? 'Nghị định 30' : 'Doanh nghiệp'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* Split Workspace: Left Studio Controls / Right A4 Canvas */}
      <div className="bot-drafting-split">
        {/* Left Studio Sidebar */}
        <aside className="bot-studio-sidebar">
          {/* Sidebar Tab Switcher */}
          <div className="bot-sidebar-tabs">
            <button
              type="button"
              className={`bot-sidebar-tab-btn ${sidebarTab === 'form' ? 'active' : ''}`}
              onClick={() => setSidebarTab('form')}
            >
              <span>📝</span> Điền thông tin
            </button>
            <button
              type="button"
              className={`bot-sidebar-tab-btn ${sidebarTab === 'ai' ? 'active' : ''}`}
              onClick={() => setSidebarTab('ai')}
            >
              <span>🤖</span> Trợ lý AI PrivOS
            </button>
          </div>

          {sidebarTab === 'form' ? (
            <>
              {/* Personnel Auto-Fill Box for Onboarding & Personnel Templates */}
              {isPersonnel && (
                <div className="bot-profile-autofill-box">
                  <div className="bot-profile-autofill-header">
                    <div className="bot-profile-autofill-title">
                      <span>👤</span> Tự Động Nạp Hồ Sơ Nhân Sự
                    </div>
                    <span
                      className="bot-drafting-badge"
                      style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                    >
                      {isLoadingProfiles ? 'Đang tải...' : `${profiles.length} hồ sơ`}
                    </span>
                  </div>
                  <p className="bot-profile-autofill-desc">
                    Chọn nhân sự từ Kanban / Hồ sơ để tự động nạp họ tên, chức danh, phòng ban và ngày bắt đầu vào văn bản.
                  </p>
                  <div className="bot-form-group">
                    <select
                      id="select-employee-profile"
                      value={selectedProfileId}
                      onChange={(e) => handleProfileSelect(e.target.value)}
                      disabled={isLoadingProfiles}
                    >
                      <option value="">-- Chọn nhân sự từ Hồ sơ / Kanban --</option>
                      {profiles.map(p => (
                        <option key={p._id} value={p._id}>
                          {p.name} {p.position ? `— ${p.position}` : ''} ({p.department || p.status})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Grouped Form Fields */}
              {groupedFields.map(group => (
                <section key={group.id} className="bot-field-section">
                  <div className="bot-field-section-header">
                    <span>{group.icon}</span>
                    <span>{group.title}</span>
                  </div>
                  <div className="bot-form-grid">
                    {group.fields.map(([key, value]) => {
                      const isLongText = [
                        'notes',
                        'reason',
                        'recipients',
                        'subject',
                        'attendees',
                        'scope',
                        'expectedRoi',
                        'proposalSubject'
                      ].includes(key);

                      return (
                        <div className="bot-form-group" key={key}>
                          <label htmlFor={`input-${key}`}>{labelMap[key] || key}:</label>
                          {isLongText ? (
                            <textarea
                              id={`input-${key}`}
                              value={value}
                              onChange={(e) => handleInputChange(key, e.target.value)}
                            />
                          ) : (
                            <input
                              id={`input-${key}`}
                              type="text"
                              value={value}
                              onChange={(e) => handleInputChange(key, e.target.value)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </>
          ) : (
            /* AI Assistant Studio */
            <div className="bot-ai-studio">
              <div className="bot-ai-studio-header">
                <div className="bot-ai-studio-title">
                  <span>🤖</span> Chỉ đạo PrivOS AI
                </div>
                {isGenerating && (
                  <span className="bot-drafting-badge" style={{ color: 'var(--accent)' }}>
                    Đang xử lý...
                  </span>
                )}
              </div>

              <div className="bot-form-group">
                <label htmlFor="ai-custom-prompt">Yêu cầu điều chỉnh tùy biến:</label>
                <textarea
                  id="ai-custom-prompt"
                  rows={4}
                  placeholder="VD: Thêm điều khoản cam kết bảo mật thông tin và trách nhiệm bồi thường nếu vi phạm trong vòng 2 năm..."
                  value={aiCustomPrompt}
                  onChange={(e) => setAiCustomPrompt(e.target.value)}
                />
              </div>

              <button
                type="button"
                className="bot-primary-btn"
                disabled={isGenerating || !aiCustomPrompt.trim()}
                onClick={() => handleAiAction('custom')}
              >
                {isGenerating ? 'AI đang thực hiện...' : '✨ Thực hiện yêu cầu tùy biến'}
              </button>

              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginTop: '6px' }}>
                Hành động thông minh một chạm:
              </div>

              <div className="bot-ai-actions-wrap">
                <button
                  type="button"
                  className="bot-ai-chip"
                  disabled={isGenerating}
                  onClick={() => handleAiAction('full_generation')}
                >
                  <span>🔄</span>
                  <div>
                    <div>Soạn mới toàn diện</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                      Sinh lại văn bản hoàn chỉnh dựa trên tham số đã điền
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  className="bot-ai-chip"
                  disabled={isGenerating}
                  onClick={() => handleAiAction('make_formal')}
                >
                  <span>🏛️</span>
                  <div>
                    <div>Chuẩn hóa Nghị định 30</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                      Tối ưu câu từ hành chính, chuẩn căn cứ pháp lý
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  className="bot-ai-chip"
                  disabled={isGenerating}
                  onClick={() => handleAiAction('make_concise')}
                >
                  <span>✂️</span>
                  <div>
                    <div>Rút gọn & Súc tích</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                      Tập trung vào điều khoản chính, loại bỏ câu chữ rườm rà
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  className="bot-ai-chip"
                  disabled={isGenerating}
                  onClick={() => handleAiAction('add_nda')}
                >
                  <span>🔒</span>
                  <div>
                    <div>Bổ sung điều khoản NDA & Cam kết</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                      Thêm cam kết bảo mật thông tin và sở hữu trí tuệ
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  className="bot-ai-chip"
                  disabled={isGenerating}
                  onClick={() => handleAiAction('bilingual_summary')}
                >
                  <span>🌐</span>
                  <div>
                    <div>Tóm tắt Song ngữ Anh - Việt</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                      Thêm phần tóm tắt Executive Summary tiếng Anh ở đầu
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}
        </aside>

        {/* Right Preview Panel & Canvas */}
        <section className="bot-preview-panel">
          {/* Action Toolbar */}
          <div className="bot-preview-toolbar">
            <div className="bot-preview-tabs">
              <button
                type="button"
                className={`bot-preview-tab-btn ${viewMode === 'a4' ? 'active' : ''}`}
                onClick={() => setViewMode('a4')}
              >
                📄 Bản in A4 chuẩn NĐ 30
              </button>
              <button
                type="button"
                className={`bot-preview-tab-btn ${viewMode === 'raw' ? 'active' : ''}`}
                onClick={() => setViewMode('raw')}
              >
                📝 Soạn thảo Markdown
              </button>
            </div>

            {/* Zoom Controls */}
            {viewMode === 'a4' && (
              <div className="bot-zoom-controls">
                <button type="button" className="bot-zoom-btn" onClick={handleZoomOut} title="Thu nhỏ">
                  -
                </button>
                <span onClick={handleZoomReset} style={{ cursor: 'pointer' }} title="Đặt về 100%">
                  {zoomLevel}%
                </span>
                <button type="button" className="bot-zoom-btn" onClick={handleZoomIn} title="Phóng to">
                  +
                </button>
              </div>
            )}

            {/* Action Buttons */}
            <div className="bot-action-buttons">
              {isAiModified && (
                <button
                  type="button"
                  className="bot-action-btn bot-btn-reset"
                  onClick={handleResetTemplate}
                  title="Khôi phục về mẫu chuẩn ban đầu (bỏ các thay đổi của AI)"
                >
                  <span>↺</span> Khôi phục mẫu
                </button>
              )}
              <button
                type="button"
                className="bot-action-btn bot-btn-docx-primary"
                onClick={handleDownloadDocx}
                title="Tải file Word (.docx) chuẩn Nghị định 30"
              >
                <span>💾</span> Xuất Word (.docx)
              </button>
              <button type="button" className="bot-action-btn" onClick={handleCopy} title="Sao chép nội dung">
                <span>📋</span> Copy
              </button>
              <button type="button" className="bot-action-btn" onClick={handleSaveToPrivos} title="Lưu văn bản vào Room PrivOS">
                <span>☁️</span> Lưu Room
              </button>
              <button
                type="button"
                className="bot-action-btn"
                onClick={() => window.print()}
                title="In văn bản hoặc xuất PDF"
              >
                <span>🖨️</span> In / PDF
              </button>
              <button type="button" className="bot-action-btn" onClick={handleDownloadMd} title="Tải file .md">
                <span>📥</span> .md
              </button>
            </div>
          </div>

          {/* Document Content Canvas */}
          {viewMode === 'a4' ? (
            <div className="bot-a4-sheet-container">
              <article
                className="bot-a4-paper"
                style={{
                  transform: zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : undefined,
                  transformOrigin: 'top center'
                }}
              >
                {renderFormattedA4(documentContent)}
              </article>
            </div>
          ) : (
            <textarea
              className="bot-raw-editor"
              value={documentContent}
              onChange={(e) => setDocumentContent(e.target.value)}
              placeholder="Nội dung văn bản định dạng Markdown..."
            />
          )}
        </section>
      </div>
    </main>
  );
}
