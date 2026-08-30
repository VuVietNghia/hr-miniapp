export const APP_TOOL_NAMES = {
  dashboard: 'hr_management_dashboard',
  payrollQuery: 'hrm.payroll.query',
  mailSend: 'hrm.mail.send',
  mailRetry: 'hrm.mail.retry',
  payrollCreate: 'hrm.payroll.create',
  payrollUpdate: 'hrm.payroll.update',
  payrollDelete: 'hrm.payroll.delete',
} as const;

export type AppToolName = (typeof APP_TOOL_NAMES)[keyof typeof APP_TOOL_NAMES];
