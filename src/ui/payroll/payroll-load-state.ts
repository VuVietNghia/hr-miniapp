import type { EmployeeProfile, ILifecycleService } from '../lifecycle/types';
import type { IPayrollService, PayrollDataState, PayrollRecord } from './types';

export type PayrollProfileStatus = 'complete' | 'partial' | 'failed';

export interface PayrollDashboardData {
  employees: EmployeeProfile[];
  payrolls: PayrollRecord[];
  profileStatus: PayrollProfileStatus;
  dataState: Exclude<PayrollDataState, 'loading'>;
  errorCode?: 'PAYROLL_READ_FAILED' | 'PROFILE_LOAD_FAILED';
}

interface LoadPayrollDashboardDataParams {
  roomId: string;
  lifecycleService: Pick<ILifecycleService, 'loadProfiles'>;
  payrollService: Pick<IPayrollService, 'getRecords'>;
  previousEmployees: EmployeeProfile[];
  previousPayrolls: PayrollRecord[];
}

function mergeIncompleteEmployeeSnapshot(
  previousEmployees: EmployeeProfile[],
  loadedEmployees: EmployeeProfile[],
): EmployeeProfile[] {
  const loadedIds = new Set(loadedEmployees.map((employee) => employee._id));
  const previouslyLoadedOnly = previousEmployees.filter((employee) => !loadedIds.has(employee._id));
  return [...loadedEmployees, ...previouslyLoadedOnly];
}

export async function loadPayrollDashboardData({
  roomId,
  lifecycleService,
  payrollService,
  previousEmployees,
  previousPayrolls,
}: LoadPayrollDashboardDataParams): Promise<PayrollDashboardData> {
  const [profileResult, payrollResult] = await Promise.all([
    lifecycleService.loadProfiles(roomId),
    payrollService.getRecords(),
  ]);

  const fallbackState: 'error' | 'stale' = previousEmployees.length > 0 || previousPayrolls.length > 0
    ? 'stale'
    : 'error';

  if (payrollResult.status === 'failed') {
    return {
      employees: previousEmployees,
      payrolls: previousPayrolls,
      profileStatus: profileResult.status === 'failed' ? 'failed' : 'partial',
      dataState: fallbackState,
      errorCode: 'PAYROLL_READ_FAILED',
    };
  }

  if (profileResult.status === 'failed') {
    return {
      employees: previousEmployees,
      payrolls: previousPayrolls,
      profileStatus: 'failed',
      dataState: fallbackState,
      errorCode: 'PROFILE_LOAD_FAILED',
    };
  }

  const isAuthoritativeSnapshot = profileResult.status === 'success' && profileResult.isComplete;
  const employees = isAuthoritativeSnapshot
    ? profileResult.records
    : mergeIncompleteEmployeeSnapshot(previousEmployees, profileResult.records);
  return {
    employees,
    payrolls: payrollResult.records,
    profileStatus: isAuthoritativeSnapshot ? 'complete' : 'partial',
    dataState: employees.length === 0 && payrollResult.records.length === 0
      ? 'empty'
      : 'ready',
  };
}
