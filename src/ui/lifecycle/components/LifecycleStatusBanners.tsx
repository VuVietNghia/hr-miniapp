import type { LifecycleDataState, LifecycleStatusMessage } from '../hooks/useLifecycleDashboard';

interface LifecycleStatusBannersProps {
  dataState: LifecycleDataState;
  statusMessage: LifecycleStatusMessage | null;
}

export function LifecycleStatusBanners({ dataState, statusMessage }: LifecycleStatusBannersProps) {
  return (
    <>
      {statusMessage && (
        <div className={`hr-status-banner hr-status-${statusMessage.type}`}>
          {statusMessage.text}
        </div>
      )}
      {dataState === 'degraded' && (
        <div className="hr-status-banner hr-status-error">
          Cấu hình trạng thái nhân sự chưa sẵn sàng. Dữ liệu hiện có được giữ nguyên và các thao tác thay đổi tạm thời bị khóa.
        </div>
      )}
    </>
  );
}
