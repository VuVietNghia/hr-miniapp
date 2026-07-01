import { useState } from 'react';
import { usePrivosApp, usePrivosContext } from '@privos/app-react';
import { restCall } from './privos-rest';

export default function TestAi() {
  const app = usePrivosApp();
  const { roomId } = usePrivosContext();

  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState(`Bạn là một trợ lý AI phân tích tài liệu.
QUY TẮC TỐI THƯỢNG:
1. CHỈ được phép lấy thông tin CÓ THỰC TRONG FILE ĐÍNH KÈM.
2. TUYỆT ĐỐI KHÔNG được bịa đặt, không suy đoán, không sử dụng kiến thức bên ngoài.
3. Nếu trong file không có thông tin, bắt buộc phải trả lời: "Không tìm thấy thông tin trong file".

Dựa vào file đính kèm, hãy cho tôi biết tên của ứng viên là gì?`);
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string>('');

  const appendLog = (msg: string) => {
    setLog(prev => prev + '\n' + msg);
  };

  const handleTest = async () => {
    if (!app || !roomId) {
      alert('Ứng dụng chưa được khởi tạo đúng cách (thiếu app hoặc roomId).');
      return;
    }
    if (!file) {
      alert('Vui lòng chọn 1 file CV để test!');
      return;
    }

    setLoading(true);
    setLog('Bắt đầu quy trình test AI...');
    try {
      // 1. Chuyển file thành base64
      appendLog('1. Đang đọc file thành base64...');
      const reader = new FileReader();
      const dataUri = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject('Failed to read file');
        reader.readAsDataURL(file);
      });

      // 2. Upload file lên PrivOS channel
      appendLog('2. Đang tải file lên PrivOS channel...');
      const uploadRes: any = await app.uploadFile({
        channelId: roomId,
        fileName: file.name,
        base64Data: dataUri,
        mimeType: file.type || 'application/octet-stream',
      });
      const fileId = uploadRes?.file?._id || uploadRes?.file?.id;
      if (!fileId) throw new Error('Không lấy được fileId sau khi upload');
      appendLog(`-> Tải file thành công, fileId = ${fileId}`);

      // 3. Gửi tin nhắn chứa prompt và fileId
      appendLog('3. Đang gửi prompt cho AI...');
      
      const finalPrompt = `[LỆNH HỆ THỐNG QUAN TRỌNG]
Tên file đính kèm của tác vụ này là: "${file.name}". 
BẠN BẮT BUỘC PHẢI ĐỌC ĐÚNG FILE NÀY VÀ CHỈ FILE NÀY MÀ THÔI. 
TUYỆT ĐỐI KHÔNG tìm kiếm, không liệt kê (list) thư mục, không đọc các file CV khác.
Chỉ tập trung xử lý duy nhất file "${file.name}".

${prompt}`;

      const sendRes = await restCall<any>(app, 'POST', 'ai-messages.send', {
        body: {
          entityType: 'room-chat',
          entityId: roomId,
          roomId: roomId,
          flowChatId: roomId,
          content: finalPrompt,
          fileIds: [fileId]
        },
        timeoutMs: 60000,
      });
      const sessionId = sendRes.sessionId;
      const aiMessageId = sendRes.aiMessage?._id;
      appendLog(`-> Đã gửi tin nhắn (Session: ${sessionId}, MessageId: ${aiMessageId})`);

      // 4. Kích hoạt AI Generation
      if (aiMessageId) {
        appendLog('4. Yêu cầu AI bắt đầu trả lời...');
        await restCall(app, 'POST', 'ai-messages.startGeneration', { body: { messageId: aiMessageId } });
      }

      // 5. Polling chờ kết quả
      appendLog('5. Đang chờ AI xử lý (Polling)...');
      let aiResponseText = '';
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const res = await restCall<any>(app, 'GET', 'ai-messages.list', {
          query: { sessionId, count: 20 }
        });
        const list = Array.isArray(res.messages) ? res.messages : [];
        const aiMsg = [...list].reverse().find((m: any) => m.type === 'ai');
        
        if (aiMsg) {
          if (['completed', 'failed', 'cancelled'].includes(aiMsg.status)) {
            aiResponseText = aiMsg.content || '(Không có nội dung trả về)';
            appendLog(`-> AI xử lý xong với status: ${aiMsg.status}`);
            break;
          } else {
            appendLog(`... đang chờ (status = ${aiMsg.status})`);
          }
        }
      }

      if (!aiResponseText) {
        throw new Error('Timeout: Không nhận được phản hồi từ AI sau 60 giây.');
      }

      appendLog('\n=== KẾT QUẢ TỪ AI ===\n' + aiResponseText);

    } catch (err: any) {
      appendLog('\n❌ LỖI: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Test Giao Tiếp AI & Đọc File trên PrivOS</h1>
      
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', fontWeight: 'bold' }}>1. Chọn file CV cần đọc:</label>
        <input 
          type="file" 
          onChange={e => setFile(e.target.files?.[0] || null)} 
          disabled={loading} 
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', fontWeight: 'bold' }}>2. Nhập Prompt (Yêu cầu AI):</label>
        <textarea 
          style={{ width: '100%', height: '80px', padding: '8px' }}
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          disabled={loading}
        />
      </div>

      <button 
        className="btn-submit" 
        onClick={handleTest} 
        disabled={loading || !file}
        style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}
      >
        {loading ? 'Đang gọi AI...' : '🚀 Gửi Test Cho AI'}
      </button>

      <div style={{ marginTop: '30px' }}>
        <h3>Log quá trình xử lý & Kết quả:</h3>
        <pre style={{ 
          backgroundColor: '#1e1e1e', 
          color: '#00ff00', 
          padding: '15px', 
          borderRadius: '5px',
          minHeight: '200px',
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word',
          fontFamily: 'monospace'
        }}>
          {log || 'Chưa có log...'}
        </pre>
      </div>
    </div>
  );
}
