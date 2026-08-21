import { useCallback, useMemo, useState } from 'react';
import { usePrivosApp, usePrivosContext, type McpApp } from '@privos/app-react';
import { PipelineService } from './pipeline-service';
import { MarkdownPathContextBuilder } from './cv-context-builder';
import type { DraftingTemplate, IDraftingTemplateProvider } from './drafting/types';
import { BuiltinTemplateProvider } from './drafting/services/BuiltinTemplateProvider';
import { sanitizeDraftingLogMessage } from './drafting/services/DraftingLogSanitizer';
import { useDraftingSession } from './drafting/hooks/useDraftingSession';
import { DraftingComposer } from './drafting/components/DraftingComposer';
import {
  DraftingPreview,
  PrintableDraftingDocument,
  type DraftingViewMode,
} from './drafting/components/DraftingPreview';
import { DraftingTemplateModal } from './drafting/components/DraftingTemplateModal';
import './hr-premium-styles.css';
import './bot-drafting.css';

export interface BotDraftingTabProps {
  app?: McpApp | null;
  roomId?: string | null;
  onLog?: (message: string) => void;
  pipelineService?: PipelineService | null;
  templateProvider?: IDraftingTemplateProvider | null;
}

export default function BotDraftingTab(props: BotDraftingTabProps) {
  const contextApp = usePrivosApp();
  const contextRoom = usePrivosContext();
  const app = props.app !== undefined ? props.app : contextApp;
  const roomId = props.roomId !== undefined ? props.roomId : contextRoom?.roomId ?? null;
  const [viewMode, setViewMode] = useState<DraftingViewMode>('a4');
  const [zoomLevel, setZoomLevel] = useState(100);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');

  const onLog = useCallback((message: string) => {
    const sanitizedMessage = sanitizeDraftingLogMessage(message);
    if (props.onLog) props.onLog(sanitizedMessage);
    else console.log(`[BotDrafting] ${sanitizedMessage}`);
  }, [props.onLog]);
  const pipelineService = useMemo(() => {
    if (props.pipelineService !== undefined) return props.pipelineService;
    return app && roomId
      ? new PipelineService(app, roomId, new MarkdownPathContextBuilder())
      : null;
  }, [app, props.pipelineService, roomId]);
  const templateProvider = useMemo(
    () => props.templateProvider ?? new BuiltinTemplateProvider(),
    [props.templateProvider],
  );
  const templates = useMemo(() => templateProvider.getTemplates(), [templateProvider]);
  const categories = useMemo(() => {
    const categoryMap = new Map<string, string>([['all', 'Tất cả']]);
    templates.forEach((template) => categoryMap.set(template.category, template.categoryLabel));
    return Array.from(categoryMap, ([id, label]) => ({ id, label }));
  }, [templates]);
  const visibleTemplates = useMemo(
    () => selectedCategory === 'all'
      ? templates
      : templates.filter((template) => template.category === selectedCategory),
    [selectedCategory, templates],
  );
  const session = useDraftingSession({ app, roomId, pipelineService, templates, onLog });

  const selectTemplate = (template: DraftingTemplate) => {
    session.setUserPrompt(`Soạn thảo mẫu: ${template.title}\n\nYêu cầu bổ sung của tôi: `);
    setTemplateModalOpen(false);
  };

  return (
    <div className="hr-terminal-ui bot-drafting-ui">
      {session.toastMessage && (
        <div className="bot-toast-message">{session.toastMessage}</div>
      )}
      <header className="hr-header-block">
        <div className="header-content">
          <h2 className="hr-title">Bot Soạn Thảo (Zero-Shot AI)</h2>
          <p className="hr-subtitle">
            Trợ lý AI tự động nhận diện yêu cầu, chọn biểu mẫu và soạn thảo văn bản chuẩn Nghị định 30.
          </p>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="hr-btn hr-btn-accent"
            onClick={() => { void session.downloadDocx(); }}
            disabled={session.isGenerating || !session.documentContent.trim()}
          >
            💾 Xuất Word (.docx)
          </button>
          <button
            type="button"
            className="hr-btn"
            onClick={() => { void session.saveToRoom(); }}
            disabled={session.isGenerating || !session.documentContent.trim()}
          >
            ☁️ Lưu PrivOS Room
          </button>
        </div>
      </header>

      <div className="bot-minimal-container">
        <DraftingComposer
          prompt={session.userPrompt}
          isGenerating={session.isGenerating}
          generationStatus={session.generationStatus}
          templateCount={templates.length}
          onPromptChange={session.setUserPrompt}
          onGenerate={() => { void session.generateDocument(); }}
          onOpenTemplates={() => setTemplateModalOpen(true)}
        />
        <DraftingPreview
          content={session.documentContent}
          viewMode={viewMode}
          zoomLevel={zoomLevel}
          isGenerating={session.isGenerating}
          onContentChange={session.setDocumentContent}
          onViewModeChange={setViewMode}
          onZoomIn={() => setZoomLevel((value) => Math.min(value + 10, 130))}
          onZoomOut={() => setZoomLevel((value) => Math.max(value - 10, 70))}
          onZoomReset={() => setZoomLevel(100)}
          onCopy={() => { void session.copyDocument(); }}
          onDownloadMarkdown={session.downloadMarkdown}
        />
      </div>

      <PrintableDraftingDocument markdown={session.documentContent} />
      {templateModalOpen && (
        <DraftingTemplateModal
          templates={visibleTemplates}
          categories={categories}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          onSelect={selectTemplate}
          onClose={() => setTemplateModalOpen(false)}
        />
      )}
    </div>
  );
}
