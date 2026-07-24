import { useState, useEffect, useMemo } from 'react';
import { usePrivosApp, usePrivosContext } from '@privos/app-react';
import { EmployeeProfile } from './types';
import { PrivOSLifecycleService } from './services/PrivOSLifecycleService';
import { LifecycleServiceProvider, useLifecycleService } from './di/LifecycleContext';
import { KanbanBoard } from './components/KanbanBoard';
import { CreateProfileForm } from './components/CreateProfileForm';
import './lifecycle-styles.css';

function LifecycleContent() {
  const { roomId } = usePrivosContext();
  const service = useLifecycleService();
  
  const [profiles, setProfiles] = useState<EmployeeProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<{text: string, type: 'info' | 'success' | 'error'} | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (roomId) {
      refreshProfiles();
    }
  }, [roomId, service]);

  const refreshProfiles = async () => {
    if (!roomId) return;
    setIsLoading(true);
    const data = await service.loadProfiles(roomId);
    setProfiles(data);
    setIsLoading(false);
  };

  const handleCreateSubmit = async (data: Omit<EmployeeProfile, '_id' | 'status'>) => {
    if (!roomId) return;
    setStatusMsg({ text: `Đang khởi tạo hồ sơ cho "${data.name}"...`, type: 'info' });
    
    // Create via service
    const newProfile = await service.createProfile(roomId, data);
    
    // Optimistic UI update
    setProfiles(prev => [...prev, newProfile]);
    setStatusMsg({ text: `Đã thêm hồ sơ "${data.name}" thành công!`, type: 'success' });
    setIsCreating(false);
    
    setTimeout(() => setStatusMsg(null), 3000);

    // Sync from server silently to get real ID and fields
    const updatedProfiles = await service.loadProfiles(roomId);
    setProfiles(updatedProfiles);
  };

  return (
    <div className="lifecycle-dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h2 className="dashboard-title">Hồ sơ & Vòng đời nhân sự</h2>
          <p className="dashboard-subtitle">
            Quản lý thông tin, hợp đồng và lộ trình phát triển của từng nhân sự.
          </p>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: '10px' }}>
          <button 
            className="secondary-btn" 
            onClick={refreshProfiles}
            disabled={isLoading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
            </svg>
            Làm mới
          </button>
          <button 
            className={`primary-btn create-action-btn ${isCreating ? 'active' : ''}`} 
            onClick={() => setIsCreating(!isCreating)}
          >
            {isCreating ? 'Đóng form' : '+ Tạo Hồ Sơ Mới'}
          </button>
        </div>
      </header>

      {isCreating && (
        <CreateProfileForm 
          onSubmit={handleCreateSubmit} 
          onCancel={() => setIsCreating(false)} 
        />
      )}

      {statusMsg && (
        <div className={`status-banner status-${statusMsg.type} fade-in`}>
          {statusMsg.text}
        </div>
      )}

      <KanbanBoard profiles={profiles} isLoading={isLoading} />
    </div>
  );
}

export default function LifecycleDashboard() {
  const app = usePrivosApp();
  const { roomId } = usePrivosContext();

  const service = useMemo(() => {
    if (!app) return null;
    return new PrivOSLifecycleService(app);
  }, [app]);

  if (!app || !roomId || !service) {
    return (
      <div className="lifecycle-connecting">
        <div className="spinner"></div>
        <p>Đang kết nối đến hệ thống PrivOS...</p>
      </div>
    );
  }

  return (
    <LifecycleServiceProvider service={service}>
      <LifecycleContent />
    </LifecycleServiceProvider>
  );
}
