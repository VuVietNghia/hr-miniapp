import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePolling } from '../../hooks/usePolling';
import type { EmployeeProfile, ILifecycleService } from '../../lifecycle/types';
import { getNextPayrollPollingInterval } from '../payroll-dashboard-policy';
import { loadPayrollDashboardData } from '../payroll-load-state';
import type { IPayrollService, PayrollDataState, PayrollRecord } from '../types';

interface UsePayrollDataOptions {
  roomId: string;
  payrollService: IPayrollService;
  lifecycleService: ILifecycleService;
}

export function usePayrollData(options: UsePayrollDataOptions) {
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [dataState, setDataState] = useState<PayrollDataState>('loading');
  const [pollingInterval, setPollingInterval] = useState(15_000);
  const [pollingPaused, setPollingPaused] = useState(false);
  const employeesRef = useRef<EmployeeProfile[]>([]);
  const payrollsRef = useRef<PayrollRecord[]>([]);
  const refreshingRef = useRef(false);
  const mountedRef = useRef(true);
  const unchangedSnapshotCountRef = useRef(0);

  const loadData = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      const result = await loadPayrollDashboardData({
        roomId: options.roomId,
        lifecycleService: options.lifecycleService,
        payrollService: options.payrollService,
        previousEmployees: employeesRef.current,
        previousPayrolls: payrollsRef.current,
      });
      if (!mountedRef.current) return;

      setDataState(result.dataState);
      if (result.dataState === 'error' || result.dataState === 'stale') return;

      const unchanged = areEmployeeProfilesEqual(employeesRef.current, result.employees)
        && arePayrollRecordsEqual(payrollsRef.current, result.payrolls);
      unchangedSnapshotCountRef.current = unchanged ? unchangedSnapshotCountRef.current + 1 : 0;
      setPollingInterval(getNextPayrollPollingInterval(unchangedSnapshotCountRef.current));

      if (!unchanged) {
        employeesRef.current = result.employees;
        payrollsRef.current = result.payrolls;
        setEmployees(result.employees);
        setPayrolls(result.payrolls);
      }
    } catch {
      if (!mountedRef.current) return;
      console.error('[PayrollDashboard] PAYROLL_DASHBOARD_LOAD_FAILED');
      setDataState(employeesRef.current.length || payrollsRef.current.length ? 'stale' : 'error');
    } finally {
      refreshingRef.current = false;
    }
  }, [options.lifecycleService, options.payrollService, options.roomId]);

  useEffect(() => {
    mountedRef.current = true;
    void loadData();
    return () => {
      mountedRef.current = false;
    };
  }, [loadData]);

  usePolling(
    loadData,
    {
      enabled: !pollingPaused && (dataState === 'ready' || dataState === 'empty'),
      interval: pollingInterval,
      immediate: false,
    },
  );

  const payrollByEmployeeId = useMemo(
    () => new Map(payrolls.map((payroll) => [payroll.employeeId, payroll])),
    [payrolls],
  );

  return { employees, payrolls, payrollByEmployeeId, dataState, loadData, setPollingPaused };
}

function areEmployeeProfilesEqual(previous: EmployeeProfile[], next: EmployeeProfile[]): boolean {
  if (previous.length !== next.length) return false;
  return previous.every((employee, index) => {
    const candidate = next[index];
    return employee._id === candidate?._id
      && employee.name === candidate?.name
      && employee.status === candidate?.status
      && employee.phone === candidate?.phone
      && employee.email === candidate?.email
      && employee.position === candidate?.position
      && employee.department === candidate?.department
      && employee.startDate === candidate?.startDate
      && employee.sourceCandidateId === candidate?.sourceCandidateId;
  });
}

function arePayrollRecordsEqual(previous: PayrollRecord[], next: PayrollRecord[]): boolean {
  if (previous.length !== next.length) return false;
  return previous.every((record, index) => {
    const candidate = next[index];
    return record._id === candidate?._id
      && record.employeeId === candidate?.employeeId
      && record.baseSalary === candidate?.baseSalary
      && record.taxId === candidate?.taxId
      && record.bankAccount === candidate?.bankAccount
      && record.bankName === candidate?.bankName
      && record.contractType === candidate?.contractType
      && record.applyProbationRate === candidate?.applyProbationRate
      && record.probationRate === candidate?.probationRate
      && record.roomId === candidate?.roomId;
  });
}
