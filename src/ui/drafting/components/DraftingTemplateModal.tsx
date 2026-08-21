import type { DraftingTemplate } from '../types';

interface DraftingTemplateModalProps {
  templates: DraftingTemplate[];
  categories: Array<{ id: string; label: string }>;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  onSelect: (template: DraftingTemplate) => void;
  onClose: () => void;
}

export function DraftingTemplateModal(props: DraftingTemplateModalProps) {
  return (
    <div className="bot-template-modal-overlay" onClick={props.onClose}>
      <div className="bot-template-modal-content" onClick={(event) => event.stopPropagation()}>
        <div className="bot-template-modal-header">
          <h3>📚 Thư viện Mẫu văn bản</h3>
          <button className="bot-template-close-btn" onClick={props.onClose}>×</button>
        </div>
        <div className="bot-template-modal-body">
          <aside className="bot-template-sidebar">
            {props.categories.map((category) => (
              <button
                key={category.id}
                className={`bot-template-category-btn ${props.selectedCategory === category.id ? 'active' : ''}`}
                onClick={() => props.onCategoryChange(category.id)}
              >
                {category.label}
              </button>
            ))}
          </aside>
          <main className="bot-template-grid-container">
            <div className="bot-template-grid">
              {props.templates.map((template) => (
                <button
                  type="button"
                  key={template.id}
                  className="bot-template-card"
                  onClick={() => props.onSelect(template)}
                >
                  <div className="bot-template-card-header">
                    <span className="bot-template-card-icon">{template.icon}</span>
                    <h4 className="bot-template-card-title">{template.title}</h4>
                  </div>
                  <p className="bot-template-card-desc">{template.description}</p>
                </button>
              ))}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
