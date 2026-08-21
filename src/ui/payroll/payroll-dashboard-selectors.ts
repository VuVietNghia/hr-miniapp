import type { EmployeeProfile } from '../lifecycle/types';
import { calculateNetSalary } from './utils';
import type { PayrollRecord } from './types';

export type PayrollFilterStatus = 'all' | 'configured' | 'unconfigured' | 'missing_info';

export interface PayrollFilterCounts {
  all: number;
  configured: number;
  unconfigured: number;
  missingInfo: number;
}

export interface PayrollStats {
  totalStaff: number;
  configuredCount: number;
  totalBudget: number;
  fullyCompleted: number;
  completionRate: number;
}

export const PAYROLL_FILTER_LABELS: Record<PayrollFilterStatus, string> = {
  all: 'Tat_Ca_Trang_Thai',
  configured: 'Da_Co_Luong',
  unconfigured: 'Chua_Thiet_Lap',
  missing_info: 'Thieu_STK_MST',
};

export function hasConfiguredSalary(payroll?: PayrollRecord): boolean {
  return (payroll?.baseSalary ?? 0) > 0;
}

export function getPayrollDepartments(employees: EmployeeProfile[]): string[] {
  const departments = new Set(
    employees
      .map((employee) => employee.department?.trim())
      .filter((department): department is string => Boolean(department)),
  );
  return Array.from(departments).sort((left, right) => left.localeCompare(right, 'vi'));
}

export function getPayrollStats(
  employees: EmployeeProfile[],
  payrollByEmployeeId: Map<string, PayrollRecord>,
): PayrollStats {
  const configuredCount = employees.filter((employee) => (
    hasConfiguredSalary(payrollByEmployeeId.get(employee._id))
  )).length;
  const totalBudget = employees.reduce((sum, employee) => {
    const payroll = payrollByEmployeeId.get(employee._id);
    if (!payroll?.baseSalary) return sum;
    return sum + calculateNetSalary(
      payroll.baseSalary,
      payroll.contractType,
      payroll.applyProbationRate !== false,
      payroll.probationRate ?? 85,
    ).netSalary;
  }, 0);
  const fullyCompleted = employees.filter((employee) => {
    const payroll = payrollByEmployeeId.get(employee._id);
    return Boolean(payroll?.baseSalary && payroll.taxId && payroll.bankAccount);
  }).length;

  return {
    totalStaff: employees.length,
    configuredCount,
    totalBudget,
    fullyCompleted,
    completionRate: employees.length > 0 ? Math.round((fullyCompleted / employees.length) * 100) : 0,
  };
}

export function getPayrollFilterCounts(
  employees: EmployeeProfile[],
  payrollByEmployeeId: Map<string, PayrollRecord>,
): PayrollFilterCounts {
  return employees.reduce<PayrollFilterCounts>((counts, employee) => {
    const payroll = payrollByEmployeeId.get(employee._id);
    counts.all += 1;
    if (hasConfiguredSalary(payroll)) counts.configured += 1;
    else counts.unconfigured += 1;
    if (isPaymentInfoMissing(payroll)) counts.missingInfo += 1;
    return counts;
  }, { all: 0, configured: 0, unconfigured: 0, missingInfo: 0 });
}

export function filterPayrollEmployees(
  employees: EmployeeProfile[],
  payrollByEmployeeId: Map<string, PayrollRecord>,
  department: string,
  filterStatus: PayrollFilterStatus,
  searchTerm: string,
): EmployeeProfile[] {
  const normalizedSearchTerm = searchTerm.trim().toLocaleLowerCase('vi');

  return employees.filter((employee) => {
    if (department !== 'all' && employee.department !== department) return false;
    const payroll = payrollByEmployeeId.get(employee._id);
    if (!matchesPayrollFilter(payroll, filterStatus)) return false;
    if (!normalizedSearchTerm) return true;

    return [
      employee.name,
      employee.position,
      employee.department,
      payroll?.taxId,
      payroll?.bankAccount,
    ].some((value) => value?.toLocaleLowerCase('vi').includes(normalizedSearchTerm));
  });
}

function isPaymentInfoMissing(payroll?: PayrollRecord): boolean {
  return hasConfiguredSalary(payroll)
    && (!payroll?.taxId?.trim() || !payroll.bankAccount?.trim());
}

function matchesPayrollFilter(payroll: PayrollRecord | undefined, filter: PayrollFilterStatus): boolean {
  if (filter === 'configured') return hasConfiguredSalary(payroll);
  if (filter === 'unconfigured') return !hasConfiguredSalary(payroll);
  if (filter === 'missing_info') return isPaymentInfoMissing(payroll);
  return true;
}
