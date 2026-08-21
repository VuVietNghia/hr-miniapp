import type { KeyboardEvent } from 'react';

interface DraftingComposerProps {
  prompt: string;
  isGenerating: boolean;
  generationStatus: string;
  templateCount: number;
  onPromptChange: (value: string) => void;
  onGenerate: () => void;
  onOpenTemplates: () => void;
}

export function DraftingComposer(props: DraftingComposerProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      props.onGenerate();
    }
  };

  return (
    <section className="bot-chat-panel">
      <div className="bot-chat-header">
        <h3>Giao tiếp với AI</h3>
        <span className="bot-chat-subtitle">Ngầm hiểu {props.templateCount} mẫu văn bản</span>
      </div>
      <div className="bot-chat-body">
        <div className="bot-chat-instructions">
          <p><strong>Hướng dẫn:</strong> Nhập yêu cầu soạn thảo hoặc chọn nhanh từ các mẫu có sẵn.</p>
          <button
            className="hr-btn hr-btn-accent"
            style={{ marginTop: '8px' }}
            onClick={props.onOpenTemplates}
            disabled={props.isGenerating}
          >
            📚 Xem thư viện mẫu văn bản ({props.templateCount} mẫu)
          </button>
        </div>
        <textarea
          className="bot-chat-textarea"
          placeholder="Nhập yêu cầu soạn thảo tại đây... (Nhấn Enter để gửi)"
          value={props.prompt}
          onChange={(event) => props.onPromptChange(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={props.isGenerating}
        />
        {props.isGenerating && (
          <div className="bot-chat-loading">
            <div className="spinner" />
            <span>{props.generationStatus}</span>
          </div>
        )}
        <button
          className="hr-btn hr-btn-accent bot-chat-send-btn"
          onClick={props.onGenerate}
          disabled={props.isGenerating || !props.prompt.trim()}
        >
          {props.isGenerating ? 'Đang xử lý...' : 'Gửi yêu cầu soạn thảo'}
        </button>
      </div>
    </section>
  );
}
