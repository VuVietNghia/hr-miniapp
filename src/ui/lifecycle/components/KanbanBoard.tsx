import { EmployeeProfile, KANBAN_COLUMNS } from '../types';
import { KanbanColumn } from './KanbanColumn';

interface KanbanBoardProps {
  profiles: EmployeeProfile[];
  isLoading: boolean;
}

export function KanbanBoard({ profiles, isLoading }: KanbanBoardProps) {
  if (isLoading) {
    return (
      <div className="kanban-loading">
        <div className="spinner"></div>
        <p>Đang tải dữ liệu hồ sơ nhân sự...</p>
      </div>
    );
  }

  return (
    <div className="kanban-board-container fade-in">
      {KANBAN_COLUMNS.map(col => (
        <KanbanColumn 
          key={col.status}
          column={col} 
          profiles={profiles.filter(p => p.status === col.status)} 
        />
      ))}
    </div>
  );
}
