import { KanbanColumnDef, EmployeeProfile } from '../types';
import { ProfileCard } from './ProfileCard';

interface KanbanColumnProps {
  column: KanbanColumnDef;
  profiles: EmployeeProfile[];
}

export function KanbanColumn({ column, profiles }: KanbanColumnProps) {
  return (
    <div className="lifecycle-kanban-column">
      <div 
        className="column-header" 
        style={{ borderBottomColor: column.color }}
      >
        <h3 className="column-title">{column.label}</h3>
        <span className="column-badge" style={{ backgroundColor: column.color }}>
          {profiles.length}
        </span>
      </div>
      
      <div className="column-content">
        {profiles.length === 0 ? (
          <p className="empty-state">Chưa có hồ sơ nào</p>
        ) : (
          profiles.map(p => <ProfileCard key={p._id} profile={p} />)
        )}
      </div>
    </div>
  );
}
