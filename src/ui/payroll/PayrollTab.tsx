import React, { useMemo, useEffect, useState } from 'react';
import { usePrivosApp, usePrivosContext } from '@privos/app-react';
import { PayrollDashboard } from './components/PayrollDashboard';
import { PayrollService } from './services/PayrollService';
import { PrivOSLifecycleService } from '../lifecycle/services/PrivOSLifecycleService';

export default function PayrollTab() {
  const app = usePrivosApp();
  const { roomId } = usePrivosContext();
  const [schemaInitialized, setSchemaInitialized] = useState(false);

  const { payrollService, lifecycleService } = useMemo(() => {
    if (!app || !roomId) return { payrollService: null, lifecycleService: null };
    
    // Dependency Injection: Pass the app and roomId into PayrollService
    const ps = new PayrollService(app, roomId);
    
    // LifecycleService needs app
    const ls = new PrivOSLifecycleService(app);
    
    return { payrollService: ps, lifecycleService: ls };
  }, [app, roomId]);

  useEffect(() => {
    if (payrollService) {
      payrollService.initializeSchema()
        .then(() => setSchemaInitialized(true))
        .catch(err => console.error("Failed to init Payroll schema", err));
    }
  }, [payrollService]);

  if (!app || !roomId || !payrollService || !lifecycleService || !schemaInitialized) {
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
    />
  );
}
