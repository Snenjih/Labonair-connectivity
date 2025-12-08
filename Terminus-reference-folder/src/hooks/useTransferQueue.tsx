import { useState, useCallback, useEffect, createContext, useContext, ReactNode } from 'react';

export interface Transfer {
  id: string;
  fileName: string;
  operation: 'upload' | 'download';
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'paused';
  progress: number; // 0-100
  bytesTransferred: number;
  totalBytes: number;
  speed: number; // bytes per second
  startTime: number;
  endTime?: number;
  error?: string;
  sshSessionId: string;
  sourcePath: string;
  targetPath: string;
}

interface TransferQueueContextType {
  transfers: Transfer[];
  addTransfer: (transfer: Omit<Transfer, 'id' | 'status' | 'progress' | 'bytesTransferred' | 'speed' | 'startTime'>) => string;
  updateTransferProgress: (id: string, update: Partial<Transfer>) => void;
  cancelTransfer: (id: string) => void;
  clearCompleted: () => void;
  getTotalProgress: () => { active: number; total: number; percentage: number };
}

const TransferQueueContext = createContext<TransferQueueContextType | undefined>(undefined);

export function TransferQueueProvider({ children }: { children: ReactNode }) {
  const [transfers, setTransfers] = useState<Transfer[]>(() => {
    // Restore from sessionStorage on mount
    try {
      const saved = sessionStorage.getItem('transfer-queue');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Filter out completed/failed transfers older than 1 hour
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        return parsed.filter((t: Transfer) => {
          if ((t.status === 'completed' || t.status === 'failed') && t.endTime && t.endTime < oneHourAgo) {
            return false;
          }
          return true;
        });
      }
    } catch (error) {
      console.error('Failed to restore transfer queue:', error);
    }
    return [];
  });

  // Persist to sessionStorage whenever transfers change
  useEffect(() => {
    try {
      sessionStorage.setItem('transfer-queue', JSON.stringify(transfers));
    } catch (error) {
      console.error('Failed to persist transfer queue:', error);
    }
  }, [transfers]);

  const addTransfer = useCallback((transfer: Omit<Transfer, 'id' | 'status' | 'progress' | 'bytesTransferred' | 'speed' | 'startTime'>) => {
    const id = `transfer-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const newTransfer: Transfer = {
      ...transfer,
      id,
      status: 'queued',
      progress: 0,
      bytesTransferred: 0,
      speed: 0,
      startTime: Date.now(),
    };

    setTransfers(prev => [...prev, newTransfer]);
    return id;
  }, []);

  const updateTransferProgress = useCallback((id: string, update: Partial<Transfer>) => {
    setTransfers(prev => prev.map(transfer => {
      if (transfer.id === id) {
        const updated = { ...transfer, ...update };

        // Calculate progress percentage
        if (updated.totalBytes > 0) {
          updated.progress = Math.min(100, Math.round((updated.bytesTransferred / updated.totalBytes) * 100));
        }

        // Calculate speed (moving average)
        if (update.bytesTransferred !== undefined && transfer.bytesTransferred !== update.bytesTransferred) {
          const elapsed = (Date.now() - transfer.startTime) / 1000; // seconds
          if (elapsed > 0) {
            updated.speed = Math.round(updated.bytesTransferred / elapsed);
          }
        }

        return updated;
      }
      return transfer;
    }));
  }, []);

  const cancelTransfer = useCallback((id: string) => {
    setTransfers(prev => prev.map(transfer =>
      transfer.id === id
        ? { ...transfer, status: 'cancelled', endTime: Date.now() }
        : transfer
    ));
  }, []);

  const clearCompleted = useCallback(() => {
    setTransfers(prev => prev.filter(t =>
      t.status !== 'completed' && t.status !== 'failed' && t.status !== 'cancelled'
    ));
  }, []);

  const getTotalProgress = useCallback(() => {
    const activeTransfers = transfers.filter(t =>
      t.status === 'in_progress' || t.status === 'queued'
    );

    if (activeTransfers.length === 0) {
      return { active: 0, total: 0, percentage: 0 };
    }

    const totalBytes = activeTransfers.reduce((sum, t) => sum + t.totalBytes, 0);
    const transferredBytes = activeTransfers.reduce((sum, t) => sum + t.bytesTransferred, 0);

    return {
      active: activeTransfers.length,
      total: transfers.length,
      percentage: totalBytes > 0 ? Math.round((transferredBytes / totalBytes) * 100) : 0,
    };
  }, [transfers]);

  return (
    <TransferQueueContext.Provider
      value={{
        transfers,
        addTransfer,
        updateTransferProgress,
        cancelTransfer,
        clearCompleted,
        getTotalProgress,
      }}
    >
      {children}
    </TransferQueueContext.Provider>
  );
}

export function useTransferQueue() {
  const context = useContext(TransferQueueContext);
  if (!context) {
    throw new Error('useTransferQueue must be used within a TransferQueueProvider');
  }
  return context;
}
