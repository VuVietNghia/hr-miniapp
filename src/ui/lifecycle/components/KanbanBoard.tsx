import { EmployeeProfile, KANBAN_COLUMNS } from '../types';
import { KanbanColumn } from './KanbanColumn';

interface KanbanBoardProps {
  profiles: EmployeeProfile[];
  isLoading: boolean;
  onMoveProfile?: (profileId: string, newStatus: string) => void;
}

export function KanbanBoard({ profiles, isLoading, onMoveProfile }: KanbanBoardProps) {
  if (isLoading) {
    return (
      <div className="kanban-loading">
        <div className="spinner"></div>
        <p>Đang tải dữ liệu hồ sơ nhân sự...</p>
      </div>
    );
  }

  return (
    <div className="hr-kanban-container">
      {KANBAN_COLUMNS.map(col => (
        <KanbanColumn 
          key={col.status}
          column={col} 
          profiles={profiles.filter(p => p.status === col.status)}
          onMoveProfile={onMoveProfile}
        />
      ))}
    </div>
  );
}
