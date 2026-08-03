import { useState } from 'react';
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
    mst: '',
    bankAccount: '',
    salary: '',
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
      setError('Vui lòng nhập Họ và Tên.');
      return;
    }
    if (!formData.phone.trim()) {
      setError('Vui lòng nhập Số điện thoại.');
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);
    
    await onSubmit({
      name: formData.name.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      position: formData.position,
      department: formData.department,
      mst: formData.mst.trim(),
      bankAccount: formData.bankAccount.trim(),
      salary: formData.salary,
      startDate: formData.startDate
    });
    
    setIsSubmitting(false);
  };

  return (
    <div className="create-profile-form-container slide-in-top">
      <form onSubmit={handleSubmit} className="profile-form">
        <h3 className="form-title">Thêm Nhân Sự Mới</h3>
        
        {error && <div className="form-error">{error}</div>}

        <div className="form-grid">
          {/* Thông tin cơ bản */}
          <div className="form-section">
            <h4 className="section-title">Thông tin cơ bản</h4>
            <div className="form-group">
              <label>Họ và Tên *</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="VD: Nguyễn Văn A" autoFocus disabled={isSubmitting} />
            </div>
            <div className="form-group">
              <label>Số điện thoại *</label>
              <input type="text" name="phone" value={formData.phone} onChange={handleChange} placeholder="VD: 0901234567" disabled={isSubmitting} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="VD: email@example.com" disabled={isSubmitting} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Vị trí</label>
                <select name="position" value={formData.position} onChange={handleChange} disabled={isSubmitting}>
                  <option value="Developer">Developer</option>
                  <option value="Tester">Tester</option>
                  <option value="HR">HR</option>
                  <option value="Sales">Sales</option>
                </select>
              </div>
              <div className="form-group">
                <label>Phòng ban</label>
                <select name="department" value={formData.department} onChange={handleChange} disabled={isSubmitting}>
                  <option value="IT">IT</option>
                  <option value="Business">Business</option>
                  <option value="Back-office">Back-office</option>
                </select>
              </div>
            </div>
          </div>

          {/* Thông tin tài chính & Hợp đồng */}
          <div className="form-section">
            <h4 className="section-title">Tài chính & Hợp đồng</h4>
            <div className="form-group">
              <label>Mã số thuế</label>
              <input type="text" name="mst" value={formData.mst} onChange={handleChange} placeholder="VD: 0123456789" disabled={isSubmitting} />
            </div>
            <div className="form-group">
              <label>Số tài khoản</label>
              <input type="text" name="bankAccount" value={formData.bankAccount} onChange={handleChange} placeholder="VD: 123456789 - VCB" disabled={isSubmitting} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Mức lương (VNĐ)</label>
                <input type="number" name="salary" value={formData.salary} onChange={handleChange} placeholder="VD: 15000000" disabled={isSubmitting} />
              </div>
              <div className="form-group">
                <label>Ngày bắt đầu</label>
                <input type="date" name="startDate" value={formData.startDate} onChange={handleChange} disabled={isSubmitting} />
              </div>
            </div>
          </div>
        </div>

        <div className="form-actions-bottom">
          <button type="submit" className="primary-btn submit-btn" disabled={isSubmitting}>
            {isSubmitting ? 'Đang lưu...' : 'Lưu Hồ Sơ'}
          </button>
          <button type="button" className="cancel-btn" onClick={onCancel} disabled={isSubmitting}>
            Hủy
          </button>
        </div>
      </form>
    </div>
  );
}
