import type { PayrollDataState } from '../types';
import type { PayrollStatusMessage } from '../hooks/usePayrollStatus';

interface PayrollStatusBannerProps {
  dataState: PayrollDataState;
  statusMessage: PayrollStatusMessage | null;
  onRetry: () => void;
}

export function PayrollStatusBanner({ dataState, statusMessage, onRetry }: PayrollStatusBannerProps) {
  const loadFailed = dataState === 'error' || dataState === 'stale';
  return (
    <>
      {statusMessage && (
        <div className={`hr-status-banner hr-status-${statusMessage.type}`}>
          {statusMessage.type === 'success' ? '✓' : '⚠'} {statusMessage.text}
        </div>
      )}
      {!statusMessage && loadFailed && (
        <div className="hr-status-banner hr-status-error">
          Không thể đồng bộ dữ liệu mới. Dữ liệu gần nhất được giữ nguyên.
        </div>
      )}
      {loadFailed && (
        <button type="button" className="hr-btn" onClick={onRetry}>
          Thử tải lại dữ liệu
        </button>
      )}
    </>
  );
}
