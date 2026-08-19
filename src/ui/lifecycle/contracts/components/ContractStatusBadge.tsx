import type { ContractSummary } from '../../../../contracts/types';

interface ContractStatusBadgeProps {
  summary?: ContractSummary;
}

const STATUS_LABELS: Record<ContractSummary['status'], string> = {
  NONE: 'Chưa có HĐ',
  DRAFT: 'HĐ nháp',
  PENDING_SIGNATURE: 'HĐ chờ ký',
  ACTIVE: 'HĐ hiệu lực',
  TERMINATED: 'HĐ đã chấm dứt',
  CANCELLED: 'HĐ đã hủy',
};

export function ContractStatusBadge({ summary }: ContractStatusBadgeProps) {
  if (!summary) {
    return <span className="contract-status-badge contract-status-unknown">HĐ chưa tải</span>;
  }
  const resolved = summary;
  const expiryText = resolved.expiryBucket === 'EXPIRED'
    ? ' - đã hết hạn'
    : resolved.expiryBucket !== 'NONE' && resolved.daysUntilExpiry !== undefined
      ? ` - còn ${resolved.daysUntilExpiry} ngày`
      : '';
  return (
    <span className={`contract-status-badge contract-status-${resolved.status.toLowerCase()}`}>
      {STATUS_LABELS[resolved.status]}{expiryText}
    </span>
  );
}
