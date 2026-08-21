import { useEffect, useRef, useState } from 'react';
import { usePrivosApp, usePrivosContext } from '@privos/app-react';
import { PipelineService, CVFile } from './pipeline-service';
import { MarkdownPathContextBuilder } from './cv-context-builder';
import { createOrUpdateFile, getFileContent } from './privos-rest';

type Message = { role: 'user' | 'ai'; content: string };
const hello: Message = { role: 'ai', content: 'Chào bạn! Tôi sẽ hỏi lần lượt thông tin cần thiết để tạo hoặc chỉnh sửa JD.' };

function renderJDMarkdown(content: string) {
  return content.split('\n').map((line, index) => {
    const text = line.trim();
    if (text.startsWith('# ')) return <h1 key={index}>{text.slice(2)}</h1>;
    if (text.startsWith('## ')) return <h2 key={index}>{text.slice(3)}</h2>;
    if (text.startsWith('### ')) return <h3 key={index}>{text.slice(4)}</h3>;
    if (text.startsWith('- ') || text.startsWith('* ')) return <div className="jd-chatbot-markdown-list" key={index}><span>•</span>{text.slice(2)}</div>;
    return text ? <p key={index}>{text}</p> : <div key={index} className="jd-chatbot-markdown-space" />;
  });
}

async function loadJDContent(app: any, roomId: string, jd: CVFile): Promise<string> {
  if (jd.downloadUrl) {
    try {
      const response = await fetch(jd.downloadUrl);
      if (response.ok) {
        const content = await response.text();
        if (content.trim()) return content;
      }
    } catch (error) {
      console.warn('[JD Chatbot] Không tải được từ downloadUrl:', error);
    }
  }

  return getFileContent(app, `${roomId}/hr-miniapp/jds/${jd.name}`);
}

export default function JDChatbotFunctional() {
  const app = usePrivosApp(); const { roomId } = usePrivosContext(); const service = useRef<PipelineService>();
  const [jds, setJds] = useState<CVFile[]>([]); const [selected, setSelected] = useState<CVFile | null>(null);
  const [draft, setDraft] = useState(''); const [saved, setSaved] = useState(''); const [messages, setMessages] = useState<Message[]>([hello]);
  const [input, setInput] = useState(''); const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [editing, setEditing] = useState(false); const [isSaving, setIsSaving] = useState(false); const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const refresh = async () => { if (!service.current) return []; const files = await service.current.fetchAvailableJDs(); setJds(files); return files; };
  useEffect(() => { service.current = new PipelineService(app, roomId, new MarkdownPathContextBuilder()); refresh().catch(console.error); }, [app, roomId]);
  const choose = async (jd: CVFile) => { setSelected(jd); setOpen(false); setMessages([hello]); setEditing(false); const content = await loadJDContent(app, roomId, jd); setDraft(content); setSaved(content); };
  const save = async (content: string, name = selected?.name) => { if (!content.trim() || !name || isSaving) return; setIsSaving(true); setSaveMessage(null); try { await createOrUpdateFile(app, `${roomId}/hr-miniapp/jds/${name}`, content); const files = await refresh(); setSelected(files.find(jd => jd.name === name) || selected); setSaved(content); setEditing(false); setSaveMessage({ type: 'success', text: '✓ Đã lưu thay đổi.' }); window.setTimeout(() => setSaveMessage(null), 2000); } catch (error) { setSaveMessage({ type: 'error', text: `Không thể lưu JD: ${error instanceof Error ? error.message : String(error)}` }); } finally { setIsSaving(false); } };
  const send = async () => { if (!input.trim() || !service.current || busy) return; const next = [...messages, { role: 'user' as const, content: input }]; setMessages(next); setInput(''); setBusy(true); const history = next.map(m => `${m.role === 'user' ? 'Người dùng' : 'AI'}: ${m.content}`).join('\n'); const existing = selected ? `\nJD đang chỉnh sửa, giữ tên <saved_file>${selected.name}</saved_file>:\n${draft}` : ''; const prompt = `[SYSTEM AUTOMATION] Bạn là AI Chatbot tuyển dụng. Hỏi đến khi đủ Vị trí, Địa điểm, Mức lương, Yêu cầu/kinh nghiệm; thiếu thì không tạo JD. Khi đủ trả JD trong <jd_content>...</jd_content>, không dùng công cụ hay lưu file. Trả tên .md trong <saved_file>...</saved_file>; giao diện chỉ lưu vào hr-miniapp/jds.${existing}\nLịch sử:\n${history}\nAI:`; try { const result = await service.current.askAI(prompt, undefined, undefined, undefined, `jd-chat-${Date.now()}`); const text = result?.text || 'Không nhận được phản hồi từ AI.'; setMessages(previous => [...previous, { role: 'ai', content: text }]); const content = text.match(/<jd_content>\s*([\s\S]*?)\s*<\/jd_content>/i)?.[1]?.trim(); if (content) { setDraft(content); setEditing(false); } } catch (error) { setMessages(previous => [...previous, { role: 'ai', content: `Lỗi gửi AI: ${String(error)}` }]); } finally { setBusy(false); } };
  const fresh = () => { setSelected(null); setDraft(''); setSaved(''); setMessages([hello]); setEditing(false); setOpen(false); };
  return <main className="jd-chatbot-page">
    <header className="jd-chatbot-page-header"><div><p className="jd-chatbot-eyebrow">HR · Job Description</p><h1>Chatbot JD</h1><p>Soạn, xem và tinh chỉnh JD cùng AI.</p></div><div className="jd-chatbot-header-actions"><button className="jd-chatbot-library-trigger" onClick={() => setOpen(true)}>Danh sách JD</button><button className="jd-chatbot-preview-badge" onClick={fresh}>Tạo JD mới</button></div></header>
    <div className="jd-chatbot-workspace"><section className="jd-chatbot-conversation jd-chatbot-panel"><div className="jd-chatbot-panel-heading"><div><span className="jd-chatbot-panel-kicker">Trợ lý AI</span><h2>Chat chỉnh sửa JD</h2></div><span className="jd-chatbot-context">{selected ? 'Chỉnh sửa JD' : 'Tạo JD mới'}</span></div><div className="jd-chatbot-messages">{messages.map((message, index) => <div key={index} className={`jd-chatbot-message ${message.role}`}><p>{message.content.replace(/<jd_content>[\s\S]*?<\/jd_content>/gi, '[Đã cập nhật bản nháp]')}</p></div>)}</div><div className="jd-chatbot-composer"><input className="jd-chatbot-chat-input" value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => event.key === 'Enter' && send()} placeholder="Nhập yêu cầu tạo hoặc chỉnh sửa JD…"/><button onClick={send} disabled={busy || !input.trim()}>Gửi</button></div></section>
    <section className="jd-chatbot-preview jd-chatbot-panel"><div className="jd-chatbot-panel-heading"><div><span className="jd-chatbot-panel-kicker">Nội dung JD</span><h2>{selected?.name || 'JD mới'}</h2></div><span className="jd-chatbot-draft-state">{draft === saved ? 'Đã lưu' : 'Chưa lưu'}</span></div><article className="jd-chatbot-document">{editing ? <textarea value={draft} onChange={event => setDraft(event.target.value)} placeholder="Nội dung JD sẽ hiển thị tại đây…"/> : renderJDMarkdown(draft)}</article>{saveMessage && <p className={`jd-chatbot-save-message ${saveMessage.type}`}>{saveMessage.text}</p>}<div className="jd-chatbot-preview-actions"><button className="jd-chatbot-restore-action" onClick={() => { setDraft(saved); setMessages([hello]); setEditing(false); setSaveMessage(null); }} disabled={!selected || isSaving || draft === saved}>Khôi phục chỉnh sửa</button><button className="jd-chatbot-secondary-action" onClick={() => setEditing(value => !value)} disabled={!draft || isSaving}>{editing ? 'Xem JD' : 'Sửa JD'}</button><button className="jd-chatbot-primary-action" onClick={() => save(draft)} disabled={!selected || isSaving || !draft.trim() || draft === saved}>{isSaving ? 'Đang lưu…' : 'Lưu thay đổi'}</button></div></section></div>
    {open && <div className="jd-chatbot-drawer-backdrop" onClick={() => setOpen(false)}><aside className="jd-chatbot-drawer" onClick={event => event.stopPropagation()}><div className="jd-chatbot-panel-heading"><h2>Danh sách JD</h2><button className="jd-chatbot-drawer-close" onClick={() => setOpen(false)}>×</button></div><button className="jd-chatbot-library-trigger" onClick={fresh}>Tạo JD mới</button><div className="jd-chatbot-file-list">{jds.map(j => <button key={j._id} className={`jd-chatbot-file ${selected?._id === j._id ? 'active' : ''}`} onClick={() => choose(j)}><strong>{j.name}</strong></button>)}</div></aside></div>}
  </main>;
}
