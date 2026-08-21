import { useCallback, useEffect, useRef, useState } from 'react';
import type { McpApp } from '@privos/app-react';
import type { PipelineService } from '../../pipeline-service';
import { createOrUpdateFile } from '../../privos-rest';
import { DocxExportService } from '../../docx-export-service';
import type { DraftingTemplate } from '../types';
import {
  buildDraftingAIPrompt,
  buildDraftingRouterPrompt,
  buildGenericDraftingAIPrompt,
  resolveDraftingRouterTemplate,
} from '../services/DraftingTemplateService';
import { DraftingRequestCoordinator } from '../services/DraftingRequestCoordinator';

interface UseDraftingSessionOptions {
  app: McpApp | null;
  roomId: string | null;
  pipelineService: PipelineService | null;
  templates: DraftingTemplate[];
  onLog: (message: string) => void;
}

export function useDraftingSession(options: UseDraftingSessionOptions) {
  const [documentContent, setDocumentContent] = useState('');
  const [userPrompt, setUserPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const requestCoordinatorRef = useRef(new DraftingRequestCoordinator());
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    requestCoordinatorRef.current = new DraftingRequestCoordinator();
    return () => {
      mountedRef.current = false;
      requestCoordinatorRef.current.dispose();
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = useCallback((message: string) => {
    if (!mountedRef.current) return;
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(message);
    toastTimerRef.current = setTimeout(() => {
      if (mountedRef.current) setToastMessage(null);
    }, 3500);
  }, []);

  const generateDocument = useCallback(async () => {
    const prompt = userPrompt.trim();
    if (!prompt) return;
    if (!options.pipelineService || !options.app || !options.roomId) {
      showToast('Chưa kết nối PrivOS. Vui lòng mở trong ứng dụng PrivOS.');
      return;
    }

    const requestId = requestCoordinatorRef.current.start();
    if (requestId === null) return;
    setIsGenerating(true);
    options.onLog('[AI DRAFTING] REQUEST_STARTED');

    try {
      setGenerationStatus('Bước 1/2: Đang phân loại yêu cầu...');
      const routerPrompt = buildDraftingRouterPrompt(options.templates, prompt);
      const routerResponse = await options.pipelineService.askAI(routerPrompt, undefined, undefined, options.onLog);
      if (!requestCoordinatorRef.current.isCurrent(requestId)) return;

      const matchedTemplate = resolveDraftingRouterTemplate(routerResponse?.text ?? '', options.templates);
      options.onLog(`[AI DRAFTING] ROUTE_RESOLVED template=${matchedTemplate?.id ?? 'unknown'}`);
      const generatorPrompt = matchedTemplate
        ? buildDraftingAIPrompt(matchedTemplate, {}, 'custom', prompt, documentContent)
        : buildGenericDraftingAIPrompt(prompt, documentContent);
      setGenerationStatus(matchedTemplate
        ? `Bước 2/2: Đang soạn thảo theo mẫu "${matchedTemplate.title}"...`
        : 'Bước 2/2: Đang soạn thảo văn bản tự do...');

      const response = await options.pipelineService.askAI(generatorPrompt, undefined, undefined, options.onLog);
      if (!requestCoordinatorRef.current.isCurrent(requestId)) return;
      const content = extractDraftingContent(response?.text ?? '');

      if (!content) {
        setGenerationStatus('Không nhận được nội dung từ AI');
        showToast('AI không trả về nội dung hợp lệ.');
        return;
      }

      setDocumentContent(content);
      setGenerationStatus('Hoàn tất');
      showToast('AI đã hoàn tất soạn thảo văn bản.');
    } catch {
      if (!requestCoordinatorRef.current.isCurrent(requestId)) return;
      console.error('[BotDrafting] AI_DRAFTING_FAILED');
      options.onLog('[AI DRAFTING] REQUEST_FAILED');
      setGenerationStatus('Không thể hoàn tất yêu cầu soạn thảo');
      showToast('Không thể hoàn tất yêu cầu soạn thảo. Vui lòng thử lại.');
    } finally {
      if (requestCoordinatorRef.current.finish(requestId) && mountedRef.current) {
        setIsGenerating(false);
      }
    }
  }, [documentContent, options, showToast, userPrompt]);

  const copyDocument = useCallback(async () => {
    if (isGenerating || !documentContent.trim()) return;
    try {
      await navigator.clipboard.writeText(documentContent);
      showToast('Đã sao chép nội dung văn bản.');
    } catch {
      console.error('[BotDrafting] COPY_FAILED');
      showToast('Không thể sao chép văn bản.');
    }
  }, [documentContent, isGenerating, showToast]);

  const downloadMarkdown = useCallback(() => {
    if (isGenerating || !documentContent.trim()) return;
    const filename = createDatedFilename('md');
    const url = URL.createObjectURL(new Blob([documentContent], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Đã tải xuống văn bản Markdown.');
  }, [documentContent, isGenerating, showToast]);

  const downloadDocx = useCallback(async () => {
    if (isGenerating || !documentContent.trim()) return;
    try {
      await DocxExportService.downloadDocx(createDatedFilename('docx'), documentContent);
      showToast('Đã xuất file Word thành công.');
    } catch {
      console.error('[BotDrafting] DOCX_EXPORT_FAILED');
      showToast('Không thể tạo file Word. Vui lòng thử lại.');
    }
  }, [documentContent, isGenerating, showToast]);

  const saveToRoom = useCallback(async () => {
    if (isGenerating || !documentContent.trim()) return;
    if (!options.app || !options.roomId) {
      showToast('Chưa kết nối PrivOS để lưu tài liệu.');
      return;
    }

    try {
      const filename = createDatedFilename('md');
      await createOrUpdateFile(
        options.app,
        `${options.roomId}/hr-miniapp/van-ban/${filename}`,
        documentContent,
      );
      showToast('Đã lưu tài liệu vào Room PrivOS.');
      options.onLog('[AI DRAFTING] FILE_SAVED');
    } catch {
      console.error('[BotDrafting] FILE_SAVE_FAILED');
      showToast('Không thể lưu tài liệu vào Room PrivOS.');
    }
  }, [documentContent, isGenerating, options, showToast]);

  return {
    documentContent,
    userPrompt,
    isGenerating,
    generationStatus,
    toastMessage,
    setDocumentContent,
    setUserPrompt,
    generateDocument,
    copyDocument,
    downloadMarkdown,
    downloadDocx,
    saveToRoom,
  };
}

function extractDraftingContent(responseText: string): string {
  const contentMatch = responseText.match(/<drafting_content>\s*([\s\S]*?)\s*<\/drafting_content>/iu);
  return (contentMatch?.[1] ?? responseText).trim().replace(/—/gu, ' - ');
}

function createDatedFilename(extension: 'md' | 'docx'): string {
  return `VanBan_${new Date().toISOString().split('T')[0]}.${extension}`;
}
