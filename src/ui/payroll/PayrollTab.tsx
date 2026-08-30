import { useMemo, useEffect, useState } from 'react';
import { usePrivosApp } from '@privos_ai/app-react';
import { PayrollDashboard } from './components/PayrollDashboard';
import { PayrollService } from './services/PayrollService';
import { PayrollExportService } from './services/PayrollExportService';
import { PrivOSLifecycleService } from '../lifecycle/services/PrivOSLifecycleService';
import { createRoomClients } from '../platform/create-room-clients';
import { canMountPayroll } from './access/payroll-mount-policy';
import type { FeatureCapabilities } from '../access/feature-capabilities';

type PayrollTabProps = Readonly<{
  roomId: string;
  userRoles: readonly string[] | null | undefined;
  capabilities: FeatureCapabilities;
}>;

export default function PayrollTab({ roomId, userRoles, capabilities }: PayrollTabProps) {
  const app = usePrivosApp();
  const [schemaInitialized, setSchemaInitialized] = useState(false);
  const canMount = capabilities.payrollReadable && canMountPayroll({
    hasApp: app !== null,
    roomId,
    userRoles,
  });

  const { payrollService, lifecycleService, payrollExportService } = useMemo(() => {
    if (!canMount || !app) {
      return { payrollService: null, lifecycleService: null, payrollExportService: null };
    }
    
    // Dependency Injection: Pass the app and roomId into PayrollService
    const ps = new PayrollService(app, roomId);
    
    // LifecycleService needs app
    const ls = new PrivOSLifecycleService(createRoomClients(app).lists);
    const pes = new PayrollExportService(app, roomId);
    
    return { payrollService: ps, lifecycleService: ls, payrollExportService: pes };
  }, [app, roomId, canMount]);

  useEffect(() => {
    setSchemaInitialized(false);
    if (!payrollService) return;
    if (!capabilities.payrollWritable) {
      setSchemaInitialized(true);
      return;
    }

    let cancelled = false;

    payrollService.initializeSchema()
      .then(() => {
        if (!cancelled) {
          setSchemaInitialized(true);
        }
      })
      .catch(err => {
        if (!cancelled) {
          console.error("Failed to init Payroll schema", err);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [payrollService, capabilities.payrollWritable]);

  if (!canMount) {
    return null;
  }

  if (!payrollService || !lifecycleService || !payrollExportService || !schemaInitialized) {
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
      writable={capabilities.payrollWritable}
      exportUploadAvailable={capabilities.filesWritable}
    />
  );
}
