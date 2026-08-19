import { useState } from 'react';
import type { CreateContractDto, EmployeeContract } from '../../../../contracts/types';
import type { EmployeeProfile } from '../../types';

export type ContractFormValue = Omit<CreateContractDto, 'roomId' | 'employeeId' | 'previousContractId'>;

interface ContractFormProps {
  profile: EmployeeProfile;
  initial?: EmployeeContract;
  title: string;
  submitLabel: string;
  onSubmit: (value: ContractFormValue) => Promise<void>;
  onCancel: () => void;
}

export function ContractForm({ profile, initial, title, submitLabel, onSubmit, onCancel }: ContractFormProps) {
  const [value, setValue] = useState<ContractFormValue>({
    contractNumber: initial?.contractNumber ?? '',
    contractType: initial?.contractType ?? 'FIXED_TERM',
    startDate: initial?.startDate ?? new Date().toISOString().slice(0, 10),
    endDate: initial?.endDate ?? '',
    position: initial?.position ?? profile.position ?? '',
    department: initial?.department ?? profile.department ?? '',
    workLocation: initial?.workLocation ?? '',
    baseSalary: initial?.baseSalary ?? 0,
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (field: keyof ContractFormValue, fieldValue: string | number) => {
    setValue(previous => ({ ...previous, [field]: fieldValue }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (value.contractType === 'FIXED_TERM' && !value.endDate) {
      setError('Hợp đồng xác định thời hạn cần ngày kết thúc.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        ...value,
        endDate: value.contractType === 'INDEFINITE' ? undefined : value.endDate,
        baseSalary: Number(value.baseSalary),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể lưu hợp đồng.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="contract-form" onSubmit={submit}>
      <div className="contract-section-header">
        <h4>{title}</h4>
        <button type="button" className="hr-btn" onClick={onCancel}>Đóng</button>
      </div>
      {error && <div className="hr-status-banner hr-status-error">{error}</div>}
      <div className="contract-form-grid">
        <label>Số hợp đồng<input className="hr-input" value={value.contractNumber} onChange={e => update('contractNumber', e.target.value)} required /></label>
        <label>Loại hợp đồng
          <select className="hr-input" value={value.contractType} onChange={e => update('contractType', e.target.value)}>
            <option value="FIXED_TERM">Xác định thời hạn</option>
            <option value="INDEFINITE">Không xác định thời hạn</option>
          </select>
        </label>
        <label>Ngày bắt đầu<input className="hr-input" type="date" value={value.startDate} onChange={e => update('startDate', e.target.value)} required /></label>
        {value.contractType === 'FIXED_TERM' && (
          <label>Ngày kết thúc<input className="hr-input" type="date" value={value.endDate ?? ''} onChange={e => update('endDate', e.target.value)} required /></label>
        )}
        <label>Vị trí<input className="hr-input" value={value.position} onChange={e => update('position', e.target.value)} required /></label>
        <label>Phòng ban<input className="hr-input" value={value.department} onChange={e => update('department', e.target.value)} required /></label>
        <label className="contract-span-2">Địa điểm làm việc<input className="hr-input" value={value.workLocation} onChange={e => update('workLocation', e.target.value)} required /></label>
        <label>Mức lương VND<input className="hr-input" type="number" min="1" step="1" value={value.baseSalary || ''} onChange={e => update('baseSalary', Number(e.target.value))} required /></label>
      </div>
      <div className="contract-form-actions">
        <button type="button" className="hr-btn" onClick={onCancel} disabled={submitting}>Hủy</button>
        <button type="submit" className="hr-btn hr-btn-accent" disabled={submitting}>{submitting ? 'Đang lưu...' : submitLabel}</button>
      </div>
    </form>
  );
}
