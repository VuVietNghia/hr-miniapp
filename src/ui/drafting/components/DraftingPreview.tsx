import { Fragment, useMemo, type ReactNode } from 'react';
import {
  parseDraftingMarkdown,
  type DraftingInlineSegment,
  type DraftingMarkdownBlock,
} from '../services/DraftingMarkdownParser';

export type DraftingViewMode = 'a4' | 'raw';

interface DraftingPreviewProps {
  content: string;
  viewMode: DraftingViewMode;
  zoomLevel: number;
  isGenerating: boolean;
  onContentChange: (value: string) => void;
  onViewModeChange: (mode: DraftingViewMode) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onCopy: () => void;
  onDownloadMarkdown: () => void;
}

export function DraftingPreview(props: DraftingPreviewProps) {
  return (
    <section className="bot-preview-panel">
      <div className="bot-preview-toolbar">
        <div className="bot-preview-tabs">
          <PreviewTab active={props.viewMode === 'a4'} onClick={() => props.onViewModeChange('a4')}>📄 Bản in A4 chuẩn</PreviewTab>
          <PreviewTab active={props.viewMode === 'raw'} onClick={() => props.onViewModeChange('raw')}>📝 Soạn thảo Markdown</PreviewTab>
        </div>
        {props.viewMode === 'a4' && (
          <div className="bot-zoom-controls">
            <button type="button" className="bot-zoom-btn" onClick={props.onZoomOut}>-</button>
            <button type="button" className="bot-zoom-btn" onClick={props.onZoomReset}>{props.zoomLevel}%</button>
            <button type="button" className="bot-zoom-btn" onClick={props.onZoomIn}>+</button>
          </div>
        )}
        <div className="bot-action-buttons">
          <button type="button" className="hr-btn" onClick={props.onCopy} disabled={props.isGenerating || !props.content.trim()}>📋 Copy</button>
          <button type="button" className="hr-btn" onClick={props.onDownloadMarkdown} disabled={props.isGenerating || !props.content.trim()}>📥 .md</button>
        </div>
      </div>
      <div className="bot-preview-content">
        {!props.content ? (
          <div className="bot-empty-state">
            <div className="bot-empty-icon">📄</div>
            <p>Chưa có văn bản nào được soạn thảo.</p>
            <p className="bot-empty-sub">Nhập yêu cầu ở khung bên trái để AI bắt đầu tạo tài liệu.</p>
          </div>
        ) : props.viewMode === 'a4' ? (
          <div className="bot-a4-sheet-container">
            <article
              className="bot-a4-paper"
              style={{
                transform: props.zoomLevel === 100 ? undefined : `scale(${props.zoomLevel / 100})`,
                transformOrigin: 'top center',
              }}
            >
              <SafeDraftingDocument markdown={props.content} />
            </article>
          </div>
        ) : (
          <textarea
            className="bot-raw-editor"
            value={props.content}
            onChange={(event) => props.onContentChange(event.target.value)}
            disabled={props.isGenerating}
            placeholder="Nội dung văn bản định dạng Markdown..."
          />
        )}
      </div>
    </section>
  );
}

export function PrintableDraftingDocument({ markdown }: { markdown: string }) {
  if (!markdown) return null;
  return (
    <article className="bot-a4-paper bot-print-paper">
      <SafeDraftingDocument markdown={markdown} />
    </article>
  );
}

function SafeDraftingDocument({ markdown }: { markdown: string }) {
  const blocks = useMemo(() => parseDraftingMarkdown(markdown), [markdown]);
  return <>{blocks.map(renderBlock)}</>;
}

function renderBlock(block: DraftingMarkdownBlock, index: number): ReactNode {
  const key = `draft-block-${index}`;
  if (block.kind === 'empty') return <div key={key} style={{ height: '6px' }} />;
  if (block.kind === 'divider') return <hr key={key} className="a4-divider" />;
  if (block.kind === 'end-mark') return <p key={key} className="a4-end-mark"><strong>./.</strong></p>;
  if (block.kind === 'legal-basis') return <p key={key} className="a4-legal-basis"><em>{renderInline(block.content, key)}</em></p>;
  if (block.kind === 'sub-section') return <p key={key} className="a4-sub-section">{renderInline(block.content, key)}</p>;
  if (block.kind === 'bullet') return <p key={key} className="a4-bullet-item">• {renderInline(block.content, key)}</p>;
  if (block.kind === 'paragraph') return <p key={key} className="a4-paragraph">{renderInline(block.content, key)}</p>;
  if (block.kind === 'table') return renderTable(block, key);

  if (block.level === 1) {
    return <h1 key={key} className="a4-heading-1">{renderInline(block.content, key)}</h1>;
  }
  return (
    <Fragment key={key}>
      <h3 className={block.subject ? 'a4-subject-heading' : 'a4-heading-3'}>
        {renderInline(block.content, key)}
      </h3>
      {block.subject && <div className="a4-line-dec a4-line-subject" />}
    </Fragment>
  );
}

function renderTable(block: Extract<DraftingMarkdownBlock, { kind: 'table' }>, key: string): ReactNode {
  if (block.headerLayout && block.rows[0]) {
    return (
      <div key={key} className="a4-header-grid">
        <div className="a4-header-col-left">
          <div className="a4-org-block">{renderInline(block.rows[0][0] ?? [], `${key}-left`)}</div>
          <div className="a4-line-dec a4-line-org" />
        </div>
        <div className="a4-header-col-right">
          <div className="a4-motto-block">{renderInline(block.rows[0][1] ?? [], `${key}-right`)}</div>
          <div className="a4-line-dec a4-line-motto" />
        </div>
      </div>
    );
  }

  return (
    <table key={key} className="a4-table">
      <tbody>
        {block.rows.map((row, rowIndex) => (
          <tr key={`${key}-row-${rowIndex}`}>
            {row.map((cell, cellIndex) => (
              <td key={`${key}-cell-${cellIndex}`} className={rowIndex === 0 ? 'a4-th' : 'a4-td'}>
                {renderInline(cell, `${key}-${rowIndex}-${cellIndex}`)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function renderInline(segments: DraftingInlineSegment[], keyPrefix: string): ReactNode[] {
  return segments.map((segment, index) => {
    const key = `${keyPrefix}-inline-${index}`;
    if (segment.kind === 'line-break') return <br key={key} />;
    if (segment.kind === 'strong') return <strong key={key}>{segment.text}</strong>;
    if (segment.kind === 'emphasis') return <em key={key}>{segment.text}</em>;
    return <Fragment key={key}>{segment.text}</Fragment>;
  });
}

function PreviewTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className={`bot-preview-tab-btn ${active ? 'active' : ''}`} onClick={onClick}>
      {children}
    </button>
  );
}
