import { formatCurrency } from '../utils';
import type { PayrollStats as PayrollStatsValue } from '../payroll-dashboard-selectors';

interface PayrollStatsProps {
  stats: PayrollStatsValue;
  selectedDepartment: string;
}

export function PayrollStats({ stats, selectedDepartment }: PayrollStatsProps) {
  return (
    <div className="hr-stats-grid">
      <StatCard
        icon="👥"
        label={selectedDepartment === 'all' ? 'Tổng số nhân sự' : `Nhân sự (${selectedDepartment})`}
        value={String(stats.totalStaff)}
      />
      <StatCard icon="💰" label="Tổng quỹ lương thực chi" value={formatCurrency(stats.totalBudget)} color="#148660" />
      <StatCard icon="📋" label="Đã định mức lương" value={`${stats.configuredCount} / ${stats.totalStaff}`} />
      <StatCard
        icon="🛡️"
        label="Hồ sơ thanh toán đủ"
        value={`${stats.fullyCompleted} (${stats.completionRate}%)`}
        color="#10B981"
      />
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string; color?: string }) {
  return (
    <div className="hr-stat-card">
      <div className="hr-stat-icon">{icon}</div>
      <div className="hr-stat-content">
        <span className="hr-stat-label">{label}</span>
        <span className="hr-stat-value" style={color ? { color } : undefined}>{value}</span>
      </div>
    </div>
  );
}
