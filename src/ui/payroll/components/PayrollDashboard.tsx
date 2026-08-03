import React, { useState, useEffect, useMemo } from 'react';
import { IPayrollService, PayrollRecord } from '../types';
import { EmployeeProfile, ILifecycleService } from '../../lifecycle/types';
import { 
  formatCurrency, 
  calculateNetSalary, 
  formatCurrencyPreview, 
  isProbationContract 
} from '../utils';

interface PayrollDashboardProps {
  roomId: string;
  payrollService: IPayrollService;
  lifecycleService: ILifecycleService;
}

const BANK_OPTIONS = [
  'Vietcombank',
  'MB Bank',
  'Techcombank',
  'VPBank',
  'ACB',
  'BIDV',
  'VietinBank',
  'TPBank',
  'Khác'
];

const CONTRACT_OPTIONS = [
  'Chính thức',
  'Thử việc (85%)',
  'Thực tập',
  'Cộng tác viên'
];

/**
 * Extracts 1-2 letter uppercase initials from the employee's name
 */
function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const SALARY_REGEX = /^\d{1,12}$/;
// Chấp nhận: 10 chữ số (MST cũ/doanh nghiệp), 12 chữ số (CCCD làm MST theo Đề án 06), 13 chữ số (MST chi nhánh 10-3 số)
const TAX_ID_REGEX = /^(?:\d{10}|\d{12}|\d{10}-?\d{3})$/;
const BANK_ACCOUNT_REGEX = /^[0-9-]{6,24}$/;

export function PayrollDashboard({ roomId, payrollService, lifecycleService }: PayrollDashboardProps) {
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  
  // States cho form thêm/sửa lương
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<PayrollRecord>>({});
  const [debugData, setDebugData] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [copiedBankId, setCopiedBankId] = useState<string | null>(null);

  // States cho Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedDept, setSelectedDept] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, [roomId, payrollService, lifecycleService]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Tải song song danh sách nhân sự từ Kanban và bảng Lương từ DB
      const [empData, payData] = await Promise.all([
        lifecycleService.loadProfiles(roomId),
        payrollService.getRecords()
      ]);

      // DỌN RÁC (Garbage Collection): Xoá bản ghi lương nếu nhân viên không còn tồn tại
      const activeEmpIds = new Set(empData.map(e => e._id));
      const orphanedPayrolls = payData.filter(p => !activeEmpIds.has(p.employeeId));
      
      if (orphanedPayrolls.length > 0) {
        console.log(`Tiến hành dọn rác: Xoá ${orphanedPayrolls.length} bản ghi lương mồ côi.`);
        await Promise.all(orphanedPayrolls.map(p => {
          if (p._id) return payrollService.deleteRecord(p._id);
        }));
      }

      setEmployees(empData);
      setPayrolls(payData.filter(p => activeEmpIds.has(p.employeeId)));
    } catch (error) {
      console.error("Lỗi khi tải dữ liệu lương:", error);
      setStatusMsg({ text: 'Lỗi khi tải dữ liệu bảng lương.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (emp: EmployeeProfile) => {
    const existing = payrolls.find(p => p.employeeId === emp._id);
    setEditingId(emp._id);
    setFormData(existing || {
      employeeId: emp._id,
      baseSalary: 0,
      taxId: '',
      bankAccount: '',
      bankName: 'Vietcombank',
      contractType: 'Chính thức',
      applyProbationRate: true,
      probationRate: 85
    });
  };

  const handleSave = async () => {
    if (!formData.employeeId) return;

    // Validate mức lương (bỏ dấu chấm/phẩy nếu người dùng nhập)
    const rawSalary = formData.baseSalary !== undefined && formData.baseSalary !== null 
      ? String(formData.baseSalary).replace(/[^\d]/g, '').trim() 
      : '0';
    if (!SALARY_REGEX.test(rawSalary) || Number(rawSalary) < 0) {
      setStatusMsg({ text: 'Mức lương cơ bản phải là số nguyên dương hợp lệ.', type: 'error' });
      return;
    }

    // Validate Mã số thuế (loại bỏ khoảng trắng thừa trước khi kiểm tra)
    const cleanTaxId = (formData.taxId ?? '').replace(/\s+/g, '');
    if (cleanTaxId && !TAX_ID_REGEX.test(cleanTaxId)) {
      setStatusMsg({ text: 'Mã số thuế không hợp lệ (gồm 10 số, 12 số CCCD, hoặc 13 số chi nhánh dạng 0123456789-001).', type: 'error' });
      return;
    }

    // Validate Số tài khoản (loại bỏ khoảng trắng thừa)
    const cleanBankAcc = (formData.bankAccount ?? '').replace(/\s+/g, '');
    if (cleanBankAcc && !BANK_ACCOUNT_REGEX.test(cleanBankAcc)) {
      setStatusMsg({ text: 'Số tài khoản ngân hàng không hợp lệ (gồm 6–24 chữ số).', type: 'error' });
      return;
    }

    try {
      await payrollService.saveRecord({
        ...formData,
        baseSalary: Number(rawSalary),
        taxId: cleanTaxId,
        bankAccount: cleanBankAcc,
        applyProbationRate: formData.applyProbationRate !== false,
        probationRate: 85
      } as PayrollRecord);
      setEditingId(null);
      setStatusMsg({ text: 'Đã cập nhật thông tin lương thành công!', type: 'success' });
      setTimeout(() => setStatusMsg(null), 3000);
      await loadData();
    } catch (error) {
      console.error("Lỗi khi lưu lương:", error);
      setStatusMsg({ text: 'Có lỗi xảy ra khi lưu thông tin lương.', type: 'error' });
      setTimeout(() => setStatusMsg(null), 4000);
    }
  };

  const copyBankAccount = (stk: string, empId: string) => {
    navigator.clipboard.writeText(stk);
    setCopiedBankId(empId);
    setTimeout(() => setCopiedBankId(null), 1800);
  };

  // Trích xuất danh sách phòng ban duy nhất
  const departments = useMemo(() => {
    const depts = new Set<string>();
    employees.forEach(e => {
      if (e.department && e.department.trim()) {
        depts.add(e.department.trim());
      }
    });
    return Array.from(depts);
  }, [employees]);

  // Export CSV Handler
  const handleExportCSV = () => {
    if (employees.length === 0) return;

    const headers = [
      'Họ và Tên',
      'Vị trí',
      'Phòng ban',
      'Loại hợp đồng',
      'Lương cơ bản (VNĐ)',
      'Tỷ lệ chi trả (%)',
      'Lương thực nhận (VNĐ)',
      'Mã số thuế',
      'Ngân hàng',
      'Số tài khoản'
    ];

    const rows = employees.map(emp => {
      const pay = payrolls.find(p => p.employeeId === emp._id);
      const baseSalary = pay?.baseSalary || 0;
      const { netSalary, effectiveRate } = calculateNetSalary(
        baseSalary,
        pay?.contractType,
        pay?.applyProbationRate !== false,
        pay?.probationRate ?? 85
      );

      return [
        `"${emp.name || ''}"`,
        `"${emp.position || ''}"`,
        `"${emp.department || ''}"`,
        `"${pay?.contractType || 'Chính thức'}"`,
        `${baseSalary}`,
        `${effectiveRate}%`,
        `${netSalary}`,
        `"${pay?.taxId || ''}"`,
        `"${pay?.bankName || ''}"`,
        `"${pay?.bankAccount || ''}"`
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Bang_Luong_Nhan_Su_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setStatusMsg({ text: 'Đã xuất file bảng lương (CSV) thành công!', type: 'success' });
    setTimeout(() => setStatusMsg(null), 3000);
  };

  // KPIs calculations
  const stats = useMemo(() => {
    const relevantEmployees = selectedDept === 'all' 
      ? employees 
      : employees.filter(e => e.department === selectedDept);

    const totalStaff = relevantEmployees.length;
    const configuredCount = relevantEmployees.filter(emp => {
      const pay = payrolls.find(p => p.employeeId === emp._id);
      return pay && (pay.baseSalary ?? 0) > 0;
    }).length;

    // Tính tổng quỹ lương thực nhận (đã tính tỷ lệ thử việc 85% nếu có)
    const totalBudget = relevantEmployees.reduce((acc, emp) => {
      const pay = payrolls.find(p => p.employeeId === emp._id);
      if (!pay || !pay.baseSalary) return acc;
      const { netSalary } = calculateNetSalary(
        pay.baseSalary,
        pay.contractType,
        pay.applyProbationRate !== false,
        pay.probationRate ?? 85
      );
      return acc + netSalary;
    }, 0);

    const fullyCompleted = relevantEmployees.filter(emp => {
      const pay = payrolls.find(p => p.employeeId === emp._id);
      return pay && (pay.baseSalary ?? 0) > 0 && !!pay.taxId && !!pay.bankAccount;
    }).length;

    const completionRate = totalStaff > 0 ? Math.round((fullyCompleted / totalStaff) * 100) : 0;

    return { totalStaff, configuredCount, totalBudget, fullyCompleted, completionRate };
  }, [employees, payrolls, selectedDept]);

  // Filtered employees list
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      // 1. Department Filter
      if (selectedDept !== 'all' && emp.department !== selectedDept) return false;

      const pay = payrolls.find(p => p.employeeId === emp._id);
      const isConfigured = pay && (pay.baseSalary ?? 0) > 0;
      const isMissingInfo = pay && (!pay.taxId || !pay.bankAccount);

      // 2. Status Filter
      if (filterStatus === 'configured' && !isConfigured) return false;
      if (filterStatus === 'unconfigured' && isConfigured) return false;
      if (filterStatus === 'missing_info' && (!isConfigured || !isMissingInfo)) return false;

      // 3. Search Term
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase().trim();
      const matchName = emp.name.toLowerCase().includes(term);
      const matchPosition = emp.position?.toLowerCase().includes(term) ?? false;
      const matchDept = emp.department?.toLowerCase().includes(term) ?? false;
      const matchTax = pay?.taxId?.toLowerCase().includes(term) ?? false;
      const matchBank = pay?.bankAccount?.toLowerCase().includes(term) ?? false;

      return matchName || matchPosition || matchDept || matchTax || matchBank;
    });
  }, [employees, payrolls, filterStatus, selectedDept, searchTerm]);

  if (loading) {
    return (
      <div className="hr-terminal-ui" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <p style={{ color: 'var(--text-muted)' }}>Đang tải bảng lương & thông tin tài chính...</p>
      </div>
    );
  }

  return (
    <div className="hr-terminal-ui">
      {/* Header */}
      <header className="hr-header-block">
        <div className="header-content">
          <h2 className="hr-title">Quản Lý Lương & Tài Chính Nhân Sự</h2>
          <p className="hr-subtitle">
            Theo dõi mức lương cơ bản, lương thử việc, mã số thuế và tài khoản ngân hàng chi trả.
          </p>
        </div>
        <div className="header-actions">
          <button 
            type="button" 
            className="hr-btn hr-btn-export" 
            onClick={handleExportCSV}
            title="Xuất bảng lương ra file Excel/CSV"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Xuất Bảng Lương (CSV)
          </button>

          <button 
            type="button" 
            className="hr-btn" 
            onClick={loadData}
            title="Tải lại bảng lương"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
            </svg>
            Làm mới
          </button>

          {/* Discreet Debug Inspector Button */}
          <button 
            type="button"
            className="hr-btn hr-btn-subtle" 
            style={{ fontSize: '0.8rem' }}
            onClick={async () => {
              const all = await payrollService.getRecords();
              setDebugData(JSON.stringify(all, null, 2));
            }}
            title="Xem dữ liệu gốc JSON từ Database"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="16 18 22 12 16 6"/>
              <polyline points="8 6 2 12 8 18"/>
            </svg>
            Debug JSON
          </button>
        </div>
      </header>

      {/* Status Notifications */}
      {statusMsg && (
        <div className={`hr-status-banner hr-status-${statusMsg.type}`}>
          {statusMsg.type === 'success' ? '✓' : '⚠️'} {statusMsg.text}
        </div>
      )}

      {/* 4 KPI Stat Cards */}
      <div className="hr-stats-grid">
        <div className="hr-stat-card">
          <div className="hr-stat-icon">👥</div>
          <div className="hr-stat-content">
            <span className="hr-stat-label">
              {selectedDept === 'all' ? 'Tổng số nhân sự' : `Nhân sự (${selectedDept})`}
            </span>
            <span className="hr-stat-value">{stats.totalStaff}</span>
          </div>
        </div>

        <div className="hr-stat-card">
          <div className="hr-stat-icon" style={{ background: 'rgba(20, 134, 96, 0.1)', color: '#148660' }}>💰</div>
          <div className="hr-stat-content">
            <span className="hr-stat-label">Tổng quỹ lương thực chi</span>
            <span className="hr-stat-value" style={{ color: '#148660' }}>
              {formatCurrency(stats.totalBudget)}
            </span>
          </div>
        </div>

        <div className="hr-stat-card">
          <div className="hr-stat-icon" style={{ background: 'rgba(217, 119, 6, 0.1)', color: '#D97706' }}>📋</div>
          <div className="hr-stat-content">
            <span className="hr-stat-label">Đã định mức lương</span>
            <span className="hr-stat-value">
              {stats.configuredCount} / {stats.totalStaff}
            </span>
          </div>
        </div>

        <div className="hr-stat-card">
          <div className="hr-stat-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10B981' }}>🛡️</div>
          <div className="hr-stat-content">
            <span className="hr-stat-label">Hồ sơ thanh toán đủ</span>
            <span className="hr-stat-value" style={{ color: '#10B981' }}>
              {stats.fullyCompleted} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}>({stats.completionRate}%)</span>
            </span>
          </div>
        </div>
      </div>

      {/* Toolbar Search & Status Filters */}
      <div className="hr-toolbar" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div className="hr-search-box" style={{ flex: '1 1 280px' }}>
            <span className="hr-search-icon">🔍</span>
            <input 
              type="text"
              className="hr-search-input"
              placeholder="Tìm theo tên, vị trí, phòng ban, STK, MST..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="hr-pill-group">
            <button 
              type="button" 
              className={`hr-filter-pill ${filterStatus === 'all' ? 'active' : ''}`}
              onClick={() => setFilterStatus('all')}
            >
              Tất cả ({employees.length})
            </button>
            <button 
              type="button" 
              className={`hr-filter-pill ${filterStatus === 'configured' ? 'active' : ''}`}
              onClick={() => setFilterStatus('configured')}
            >
              Đã có lương ({stats.configuredCount})
            </button>
            <button 
              type="button" 
              className={`hr-filter-pill ${filterStatus === 'missing_info' ? 'active' : ''}`}
              onClick={() => setFilterStatus('missing_info')}
            >
              Thiếu STK/MST
            </button>
            <button 
              type="button" 
              className={`hr-filter-pill ${filterStatus === 'unconfigured' ? 'active' : ''}`}
              onClick={() => setFilterStatus('unconfigured')}
            >
              Chưa thiết lập
            </button>
          </div>
        </div>

        {/* Department Filter Pills */}
        {departments.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', paddingTop: '4px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Phòng ban:</span>
            <div className="hr-pill-group">
              <button
                type="button"
                className={`hr-filter-pill ${selectedDept === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedDept('all')}
              >
                Tất cả phòng ban
              </button>
              {departments.map(dept => (
                <button
                  key={dept}
                  type="button"
                  className={`hr-filter-pill ${selectedDept === dept ? 'active' : ''}`}
                  onClick={() => setSelectedDept(dept)}
                >
                  {dept}
                </button>
              ))}
            </div>
            <span style={{ marginLeft: 'auto', fontSize: '0.8125rem', color: 'var(--text-muted, #6C737A)' }}>
              Hiển thị <strong>{filteredEmployees.length}</strong> / {employees.length} hồ sơ
            </span>
          </div>
        )}
      </div>

      {/* Modern Data Table */}
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
            {filteredEmployees.map(emp => {
              const pay = payrolls.find(p => p.employeeId === emp._id);
              const isEditing = editingId === emp._id;
              const hasConfiguredSalary = pay && (pay.baseSalary ?? 0) > 0;
              const initials = getInitials(emp.name);
              
              return (
                <tr key={emp._id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="profile-avatar" style={{ width: 30, height: 30, fontSize: '0.75rem' }}>
                        {initials}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text)' }}>{emp.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {emp.position || 'Nhân sự'} {emp.department ? `• ${emp.department}` : ''}
                        </div>
                      </div>
                    </div>
                  </td>
                  
                  {isEditing ? (
                    <>
                      <td>
                        <select 
                          className="hr-select"
                          value={formData.contractType || 'Chính thức'}
                          onChange={e => setFormData({ ...formData, contractType: e.target.value })}
                          style={{ width: '100%' }}
                        >
                          {CONTRACT_OPTIONS.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                        
                        {/* Checkbox kiểm soát phòng Hành chính khi là hợp đồng Thử việc */}
                        {isProbationContract(formData.contractType) && (
                          <label 
                            className="hr-checkbox-control" 
                            title="Phòng Hành chính tích chọn để áp dụng mức 85% lương hoặc bỏ chọn nếu thỏa thuận 100%"
                          >
                            <input 
                              type="checkbox"
                              checked={formData.applyProbationRate !== false}
                              onChange={e => setFormData({ ...formData, applyProbationRate: e.target.checked })}
                            />
                            <span>Hưởng 85% thử việc</span>
                          </label>
                        )}
                      </td>
                      <td>
                        <input 
                          type="number" 
                          value={formData.baseSalary || ''}
                          onChange={e => setFormData({...formData, baseSalary: Number(e.target.value)})}
                          className="hr-input"
                          placeholder="Mức lương cơ bản"
                          style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                        />
                        {/* Real-time currency preview */}
                        {formatCurrencyPreview(formData.baseSalary) && (
                          <span className="hr-input-preview">
                            {formatCurrencyPreview(formData.baseSalary)}
                            {isProbationContract(formData.contractType) && formData.applyProbationRate !== false && (
                              <span style={{ color: '#D97706', display: 'block' }}>
                                ➔ Thực nhận: {formatCurrency(Math.round(Number(formData.baseSalary || 0) * 0.85))}
                              </span>
                            )}
                          </span>
                        )}
                      </td>
                      <td>
                        <input 
                          type="text" 
                          value={formData.taxId || ''}
                          onChange={e => setFormData({...formData, taxId: e.target.value})}
                          className="hr-input"
                          placeholder="Mã số thuế"
                          style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                        />
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <select 
                            className="hr-select"
                            value={formData.bankName || 'Vietcombank'}
                            onChange={e => setFormData({ ...formData, bankName: e.target.value })}
                            style={{ width: '110px' }}
                          >
                            {BANK_OPTIONS.map(b => (
                              <option key={b} value={b}>{b}</option>
                            ))}
                          </select>
                          <input 
                            type="text" 
                            value={formData.bankAccount || ''}
                            onChange={e => setFormData({...formData, bankAccount: e.target.value})}
                            className="hr-input"
                            placeholder="Số tài khoản"
                            style={{ padding: '6px 10px', fontSize: '0.85rem', flex: 1 }}
                          />
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button onClick={handleSave} className="hr-btn hr-btn-accent" style={{ padding: '5px 12px', fontSize: '0.8rem' }}>
                            Lưu
                          </button>
                          <button onClick={() => setEditingId(null)} className="hr-btn" style={{ padding: '5px 10px', fontSize: '0.8rem' }}>
                            Huỷ
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>
                        <span className="contract-tag">
                          {pay?.contractType || 'Chính thức'}
                        </span>
                      </td>
                      <td>
                        {hasConfiguredSalary ? (
                          (() => {
                            const { netSalary, isProbationDiscounted } = calculateNetSalary(
                              pay!.baseSalary,
                              pay?.contractType,
                              pay?.applyProbationRate !== false,
                              pay?.probationRate ?? 85
                            );
                            
                            return (
                              <div>
                                <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                                  {formatCurrency(netSalary)}
                                </div>
                                {isProbationDiscounted ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                    <span className="badge-probation-rate">85%</span>
                                    <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                                      Gốc: {formatCurrency(pay!.baseSalary)}
                                    </span>
                                  </div>
                                ) : isProbationContract(pay?.contractType) ? (
                                  <span className="badge-probation-rate badge-probation-100" style={{ marginTop: '2px' }}>
                                    Thử việc 100%
                                  </span>
                                ) : null}
                              </div>
                            );
                          })()
                        ) : (
                          <span className="hr-status-pill hr-status-pill-warn">
                            Chưa thiết lập
                          </span>
                        )}
                      </td>
                      <td>
                        {pay?.taxId ? (
                          <span style={{ fontWeight: 500 }}>{pay.taxId}</span>
                        ) : (
                          <span className="badge-missing badge-missing-warn" title="Nhân viên chưa cập nhật Mã số thuế">
                            ⚠️ Thiếu MST
                          </span>
                        )}
                      </td>
                      <td>
                        {pay?.bankAccount ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className="bank-tag">{pay.bankName || 'Ngân hàng'}</span>
                            <span style={{ fontFamily: 'var(--hr-font-mono)', fontSize: '0.825rem' }}>{pay.bankAccount}</span>
                            <button
                              type="button"
                              className={`hr-icon-btn ${copiedBankId === emp._id ? 'copied' : ''}`}
                              onClick={() => copyBankAccount(pay.bankAccount, emp._id)}
                              title="Sao chép số tài khoản"
                            >
                              {copiedBankId === emp._id ? 'Đã chép' : 'Chép'}
                            </button>
                          </div>
                        ) : (
                          <span className="badge-missing" title="Chưa cập nhật tài khoản nhận lương">
                            ⚠️ Thiếu STK
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button 
                          onClick={() => handleEdit(emp)} 
                          className="hr-btn"
                          style={{ padding: '5px 12px', fontSize: '0.8rem' }}
                        >
                          {hasConfiguredSalary ? 'Chỉnh sửa' : '+ Thiết lập'}
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
            
            {filteredEmployees.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
                  Không tìm thấy hồ sơ lương nào phù hợp với bộ lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Debug Inspector Modal */}
      {debugData && (
        <div className="hr-debug-modal-overlay" onClick={() => setDebugData(null)}>
          <div className="hr-debug-modal-content" onClick={e => e.stopPropagation()}>
            <div className="hr-debug-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.1rem' }}>⚙️</span>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Dữ liệu thô từ Database (Select All)</h4>
              </div>
              <button 
                className="hr-btn hr-btn-subtle" 
                style={{ padding: '4px 8px' }}
                onClick={() => setDebugData(null)}
              >
                ✕
              </button>
            </div>
            <pre className="hr-debug-pre">{debugData}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

