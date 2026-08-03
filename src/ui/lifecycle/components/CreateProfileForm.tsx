import React, { useState } from 'react';
import { EmployeeProfile } from '../types';

interface CreateProfileFormProps {
  onSubmit: (data: Omit<EmployeeProfile, '_id' | 'status'>) => Promise<void>;
  onCancel: () => void;
}

export function CreateProfileForm({ onSubmit, onCancel }: CreateProfileFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    position: 'Developer',
    department: 'IT',
    startDate: new Date().toISOString().split('T')[0]
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('Vui lòng nhập Họ và Tên nhân sự.');
      return;
    }
    if (!formData.phone.trim()) {
      setError('Vui lòng nhập Số điện thoại liên hệ.');
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      await onSubmit({
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        position: formData.position,
        department: formData.department,
        startDate: formData.startDate
      });
    } catch (err: any) {
      setError(err?.message || 'Có lỗi xảy ra khi lưu hồ sơ.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="hr-form-panel">
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 className="hr-form-title" style={{ margin: 0 }}>Thêm Hồ Sơ Nhân Sự Mới</h3>
          <button 
            type="button" 
            className="hr-btn hr-btn-subtle" 
            onClick={onCancel}
            title="Đóng form"
          >
            ✕
          </button>
        </div>
        
        {error && (
          <div className="hr-status-banner hr-status-error">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          <div>
            <label className="hr-label">Họ và Tên <span style={{ color: '#EC0D2A' }}>*</span></label>
            <input 
              className="hr-input" 
              type="text" 
              name="name" 
              value={formData.name} 
              onChange={handleChange} 
              placeholder="VD: Nguyễn Văn A" 
              autoFocus 
              disabled={isSubmitting} 
            />
          </div>

          <div>
            <label className="hr-label">Số điện thoại <span style={{ color: '#EC0D2A' }}>*</span></label>
            <input 
              className="hr-input" 
              type="tel" 
              name="phone" 
              value={formData.phone} 
              onChange={handleChange} 
              placeholder="VD: 0901 234 567" 
              disabled={isSubmitting} 
            />
          </div>

          <div>
            <label className="hr-label">Email công việc</label>
            <input 
              className="hr-input" 
              type="email" 
              name="email" 
              value={formData.email} 
              onChange={handleChange} 
              placeholder="VD: an.nguyen@company.com" 
              disabled={isSubmitting} 
            />
          </div>

          <div>
            <label className="hr-label">Vị trí công việc</label>
            <select 
              className="hr-input" 
              name="position" 
              value={formData.position} 
              onChange={handleChange} 
              disabled={isSubmitting}
            >
              <option value="Developer">Developer</option>
              <option value="Tester">Tester / QA</option>
              <option value="Designer">UI/UX Designer</option>
              <option value="Product Manager">Product Manager</option>
              <option value="HR">HR Specialist</option>
              <option value="Sales">Sales Executive</option>
              <option value="Marketing">Marketing Specialist</option>
            </select>
          </div>

          <div>
            <label className="hr-label">Phòng ban</label>
            <select 
              className="hr-input" 
              name="department" 
              value={formData.department} 
              onChange={handleChange} 
              disabled={isSubmitting}
            >
              <option value="IT">Kỹ thuật (IT / R&D)</option>
              <option value="Business">Kinh doanh (Business / Sales)</option>
              <option value="Marketing">Truyền thông (Marketing)</option>
              <option value="Back-office">Khối văn phòng (HR / Admin)</option>
            </select>
          </div>

          <div>
            <label className="hr-label">Ngày bắt đầu làm việc</label>
            <input 
              className="hr-input" 
              type="date" 
              name="startDate" 
              value={formData.startDate} 
              onChange={handleChange} 
              disabled={isSubmitting} 
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
          <button 
            type="button" 
            className="hr-btn" 
            onClick={onCancel} 
            disabled={isSubmitting}
          >
            Hủy bỏ
          </button>
          <button 
            type="submit" 
            className="hr-btn hr-btn-accent" 
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Đang lưu hồ sơ...' : 'Tạo hồ sơ nhân sự'}
          </button>
        </div>
      </form>
    </div>
  );
}
