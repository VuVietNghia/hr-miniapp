import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { usePrivosApp, usePrivosContext } from '@privos/app-react';
import { PayrollDashboard } from './components/PayrollDashboard';
import { PayrollService } from './services/PayrollService';
import { PayrollExportService } from './services/PayrollExportService';
import { PrivOSLifecycleService } from '../lifecycle/services/PrivOSLifecycleService';

export default function PayrollTab() {
  const app = usePrivosApp();
  const { roomId } = usePrivosContext();
  const [schemaState, setSchemaState] = useState<'initializing' | 'ready' | 'error'>('initializing');

  const { payrollService, lifecycleService, payrollExportService } = useMemo(() => {
    if (!app || !roomId) {
      return { payrollService: null, lifecycleService: null, payrollExportService: null };
    }
    
    // Dependency Injection: Pass the app and roomId into PayrollService
    const ps = new PayrollService(app, roomId);
    
    // LifecycleService needs app
    const ls = new PrivOSLifecycleService(app);
    const pes = new PayrollExportService(app, roomId);
    
    return { payrollService: ps, lifecycleService: ls, payrollExportService: pes };
  }, [app, roomId]);

  const initializeSchema = useCallback(async () => {
    if (!payrollService) return;
    setSchemaState('initializing');
    try {
      await payrollService.initializeSchema();
      setSchemaState('ready');
    } catch {
      console.error('[PayrollTab] PAYROLL_SCHEMA_INIT_FAILED');
      setSchemaState('error');
    }
  }, [payrollService]);

  useEffect(() => {
    void initializeSchema();
  }, [initializeSchema]);

  if (schemaState === 'error') {
    return (
      <div className="p-4 flex justify-center items-center h-full">
        <p>Không thể khởi tạo dữ liệu lương.</p>
        <button type="button" className="hr-btn" onClick={() => void initializeSchema()}>
          Thử lại
        </button>
      </div>
    );
  }

  if (!app || !roomId || !payrollService || !lifecycleService || !payrollExportService || schemaState !== 'ready') {
    return (
      <div className="p-4 flex justify-center items-center h-full">
        <div className="spinner"></div>
        <p className="ml-2">Đang khởi tạo hệ thống Lương...</p>
      </div>
    );
  }

  return (
    <PayrollDashboard 
      roomId={roomId} 
      payrollService={payrollService} 
      lifecycleService={lifecycleService} 
      payrollExportService={payrollExportService}
    />
  );
}
