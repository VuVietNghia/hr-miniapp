import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { EmployeeProfile } from '../../lifecycle/types';
import { hasConfiguredSalary } from '../payroll-dashboard-selectors';
import type { PayrollRecord } from '../types';
import { calculateNetSalary, formatCurrency, formatCurrencyPreview, isProbationContract } from '../utils';

interface PayrollTableProps {
  employees: EmployeeProfile[];
  payrollByEmployeeId: Map<string, PayrollRecord>;
  editingId: string | null;
  draft: Partial<PayrollRecord>;
  isSaving: boolean;
  setDraft: Dispatch<SetStateAction<Partial<PayrollRecord>>>;
  onBeginEdit: (employee: EmployeeProfile) => void;
  onCancelEdit: () => void;
  onSave: () => void;
}

const BANK_OPTIONS = ['Vietcombank', 'MB Bank', 'Techcombank', 'VPBank', 'ACB', 'BIDV', 'VietinBank', 'TPBank', 'Khác'];
const CONTRACT_OPTIONS = ['Chính thức', 'Thử việc (85%)', 'Thực tập', 'Cộng tác viên'];

export function PayrollTable(props: PayrollTableProps) {
  const [copiedEmployeeId, setCopiedEmployeeId] = useState<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
  }, []);

  const copyBankAccount = async (bankAccount: string, employeeId: string) => {
    try {
      await navigator.clipboard.writeText(bankAccount);
      setCopiedEmployeeId(employeeId);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedEmployeeId(null), 1800);
    } catch {
      console.error('[PayrollDashboard] BANK_ACCOUNT_COPY_FAILED');
    }
  };

  return (
    <div className="hr-table-card">
      <table className="hr-table">
        <thead>
          <tr>
            <th style={{ width: '22%' }}>Nhân viên</th>
            <th style={{ width: '13%' }}>Loại HĐ</th>
            <th style={{ width: '18%' }}>Mức lương & Thực nhận</th>
            <th style={{ width: '12%' }}>Mã số thuế</th>
            <th style={{ width: '22%' }}>Tài khoản ngân hàng</th>
            <th style={{ width: '13%', textAlign: 'right' }}>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {props.employees.map((employee) => {
            const payroll = props.payrollByEmployeeId.get(employee._id);
            return (
              <PayrollRow
                key={employee._id}
                employee={employee}
                payroll={payroll}
                isEditing={props.editingId === employee._id}
                draft={props.draft}
                isSaving={props.isSaving}
                copied={copiedEmployeeId === employee._id}
                setDraft={props.setDraft}
                onBeginEdit={props.onBeginEdit}
                onCancelEdit={props.onCancelEdit}
                onSave={props.onSave}
                onCopyBankAccount={copyBankAccount}
              />
            );
          })}
          {props.employees.length === 0 && (
            <tr>
              <td colSpan={6} style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
                Không tìm thấy hồ sơ lương nào phù hợp với bộ lọc.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

interface PayrollRowProps {
  employee: EmployeeProfile;
  payroll?: PayrollRecord;
  isEditing: boolean;
  draft: Partial<PayrollRecord>;
  isSaving: boolean;
  copied: boolean;
  setDraft: Dispatch<SetStateAction<Partial<PayrollRecord>>>;
  onBeginEdit: (employee: EmployeeProfile) => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onCopyBankAccount: (bankAccount: string, employeeId: string) => void;
}

function PayrollRow(props: PayrollRowProps) {
  return (
    <tr>
      <td><EmployeeIdentity employee={props.employee} /></td>
      {props.isEditing ? (
        <PayrollEditCells {...props} />
      ) : (
        <PayrollReadCells {...props} />
      )}
    </tr>
  );
}

function EmployeeIdentity({ employee }: { employee: EmployeeProfile }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div className="profile-avatar" style={{ width: 30, height: 30, fontSize: '0.75rem' }}>
        {getInitials(employee.name)}
      </div>
      <div>
        <div style={{ fontWeight: 600, color: 'var(--text)' }}>{employee.name}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {employee.position || 'Nhân sự'} {employee.department ? `• ${employee.department}` : ''}
        </div>
      </div>
    </div>
  );
}

function PayrollEditCells(props: PayrollRowProps) {
  const updateDraft = (patch: Partial<PayrollRecord>) => {
    props.setDraft((current) => ({ ...current, ...patch }));
  };
  const salaryPreview = formatCurrencyPreview(props.draft.baseSalary);

  return (
    <>
      <td>
        <select
          className="hr-select"
          value={props.draft.contractType || 'Chính thức'}
          onChange={(event) => updateDraft({ contractType: event.target.value })}
          style={{ width: '100%' }}
        >
          {CONTRACT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        {isProbationContract(props.draft.contractType) && (
          <label className="hr-checkbox-control" title="Áp dụng mức 85% lương trong thời gian thử việc">
            <input
              type="checkbox"
              checked={props.draft.applyProbationRate !== false}
              onChange={(event) => updateDraft({ applyProbationRate: event.target.checked })}
            />
            <span>Hưởng 85% thử việc</span>
          </label>
        )}
      </td>
      <td>
        <input
          type="number"
          value={props.draft.baseSalary || ''}
          onChange={(event) => updateDraft({ baseSalary: Number(event.target.value) })}
          className="hr-input"
          placeholder="Mức lương cơ bản"
          style={{ padding: '6px 10px', fontSize: '0.85rem' }}
        />
        {salaryPreview && (
          <span className="hr-input-preview">
            {salaryPreview}
            {isProbationContract(props.draft.contractType) && props.draft.applyProbationRate !== false && (
              <span style={{ color: '#D97706', display: 'block' }}>
                ➔ Thực nhận: {formatCurrency(Math.round(Number(props.draft.baseSalary || 0) * 0.85))}
              </span>
            )}
          </span>
        )}
      </td>
      <td>
        <input
          type="text"
          value={props.draft.taxId || ''}
          onChange={(event) => updateDraft({ taxId: event.target.value })}
          className="hr-input"
          placeholder="Mã số thuế"
          style={{ padding: '6px 10px', fontSize: '0.85rem' }}
        />
      </td>
      <td>
        <div style={{ display: 'flex', gap: '6px' }}>
          <select
            className="hr-select"
            value={props.draft.bankName || 'Vietcombank'}
            onChange={(event) => updateDraft({ bankName: event.target.value })}
            style={{ width: '110px' }}
          >
            {BANK_OPTIONS.map((bank) => <option key={bank} value={bank}>{bank}</option>)}
          </select>
          <input
            type="text"
            value={props.draft.bankAccount || ''}
            onChange={(event) => updateDraft({ bankAccount: event.target.value })}
            className="hr-input"
            placeholder="Số tài khoản"
            style={{ padding: '6px 10px', fontSize: '0.85rem', flex: 1 }}
          />
        </div>
      </td>
      <td style={{ textAlign: 'right' }}>
        <div style={{ display: 'inline-flex', gap: '6px' }}>
          <button
            onClick={props.onSave}
            className="hr-btn hr-btn-accent"
            disabled={props.isSaving}
            style={{ padding: '5px 12px', fontSize: '0.8rem' }}
          >
            {props.isSaving ? 'Đang lưu...' : 'Lưu'}
          </button>
          <button onClick={props.onCancelEdit} className="hr-btn" style={{ padding: '5px 10px', fontSize: '0.8rem' }}>
            Huỷ
          </button>
        </div>
      </td>
    </>
  );
}

function PayrollReadCells(props: PayrollRowProps) {
  const configured = hasConfiguredSalary(props.payroll);
  return (
    <>
      <td><span className="contract-tag">{props.payroll?.contractType || 'Chính thức'}</span></td>
      <td>{configured ? <SalaryValue payroll={props.payroll!} /> : <MissingSalary />}</td>
      <td>
        {props.payroll?.taxId
          ? <span style={{ fontWeight: 500 }}>{props.payroll.taxId}</span>
          : <span className="badge-missing badge-missing-warn">⚠ Thiếu MST</span>}
      </td>
      <td>
        {props.payroll?.bankAccount ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="bank-tag">{props.payroll.bankName || 'Ngân hàng'}</span>
            <span style={{ fontFamily: 'var(--hr-font-mono)', fontSize: '0.825rem' }}>{props.payroll.bankAccount}</span>
            <button
              type="button"
              className={`hr-icon-btn ${props.copied ? 'copied' : ''}`}
              onClick={() => props.onCopyBankAccount(props.payroll!.bankAccount, props.employee._id)}
            >
              {props.copied ? 'Đã chép' : 'Chép'}
            </button>
          </div>
        ) : <span className="badge-missing">⚠ Thiếu STK</span>}
      </td>
      <td style={{ textAlign: 'right' }}>
        <button
          onClick={() => props.onBeginEdit(props.employee)}
          className="hr-btn"
          style={{ padding: '5px 12px', fontSize: '0.8rem' }}
        >
          {configured ? 'Chỉnh sửa' : '+ Thiết lập'}
        </button>
      </td>
    </>
  );
}

function SalaryValue({ payroll }: { payroll: PayrollRecord }) {
  const result = calculateNetSalary(
    payroll.baseSalary,
    payroll.contractType,
    payroll.applyProbationRate !== false,
    payroll.probationRate ?? 85,
  );
  return (
    <div>
      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{formatCurrency(result.netSalary)}</div>
      {result.isProbationDiscounted ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
          <span className="badge-probation-rate">85%</span>
          <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
            Gốc: {formatCurrency(payroll.baseSalary)}
          </span>
        </div>
      ) : isProbationContract(payroll.contractType) ? (
        <span className="badge-probation-rate badge-probation-100">Thử việc 100%</span>
      ) : null}
    </div>
  );
}

function MissingSalary() {
  return <span className="hr-status-pill hr-status-pill-warn">Chưa thiết lập</span>;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/u);
  if (parts.length === 0 || !parts[0]) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toLocaleUpperCase('vi');
  return `${parts[0][0]}${parts[parts.length - 1]?.[0] ?? ''}`.toLocaleUpperCase('vi');
}
