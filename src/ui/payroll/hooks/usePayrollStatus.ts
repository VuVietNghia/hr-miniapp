import { useCallback, useEffect, useRef, useState } from 'react';

export interface PayrollStatusMessage {
  text: string;
  type: 'success' | 'error';
}

export function usePayrollStatus() {
  const [statusMessage, setStatusMessage] = useState<PayrollStatusMessage | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearStatus = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setStatusMessage(null);
  }, []);

  const showStatus = useCallback((message: PayrollStatusMessage, durationMs = 4000) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setStatusMessage(message);
    timerRef.current = setTimeout(() => setStatusMessage(null), durationMs);
  }, []);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return { statusMessage, showStatus, clearStatus };
}
