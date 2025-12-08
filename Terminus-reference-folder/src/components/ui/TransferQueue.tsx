import { useState } from 'react';
import { useTransferQueue, type Transfer } from '@/hooks/useTransferQueue';
import { X, ChevronDown, ChevronUp, Trash2, Upload, Download, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function formatSpeed(bytesPerSecond: number): string {
  return `${formatFileSize(bytesPerSecond)}/s`;
}

function formatETA(bytesRemaining: number, speed: number): string {
  if (speed === 0) return 'Calculating...';
  const secondsRemaining = Math.ceil(bytesRemaining / speed);

  if (secondsRemaining < 60) {
    return `${secondsRemaining}s`;
  } else if (secondsRemaining < 3600) {
    const minutes = Math.floor(secondsRemaining / 60);
    const seconds = secondsRemaining % 60;
    return `${minutes}m ${seconds}s`;
  } else {
    const hours = Math.floor(secondsRemaining / 3600);
    const minutes = Math.floor((secondsRemaining % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
}

function TransferItem({ transfer, onCancel }: { transfer: Transfer; onCancel: (id: string) => void }) {
  const bytesRemaining = transfer.totalBytes - transfer.bytesTransferred;
  const eta = transfer.status === 'in_progress' && transfer.speed > 0
    ? formatETA(bytesRemaining, transfer.speed)
    : null;

  const getStatusColor = () => {
    switch (transfer.status) {
      case 'completed': return 'text-green-500';
      case 'failed': return 'text-red-500';
      case 'cancelled': return 'text-yellow-500';
      case 'in_progress': return 'text-blue-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusIcon = () => {
    switch (transfer.status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'cancelled':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      default:
        return transfer.operation === 'upload'
          ? <Upload className="w-4 h-4" />
          : <Download className="w-4 h-4" />;
    }
  };

  const getProgressColor = () => {
    switch (transfer.status) {
      case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      case 'cancelled': return 'bg-yellow-500';
      default: return 'bg-blue-500';
    }
  };

  return (
    <div className="border-b border-[var(--color-dark-border)] py-3 px-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="mt-1">
            {getStatusIcon()}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm truncate">{transfer.fileName}</span>
              <span className={`text-xs ${getStatusColor()}`}>
                {transfer.status === 'in_progress' ? 'Transferring' : transfer.status}
              </span>
            </div>

            {/* Progress bar */}
            {(transfer.status === 'in_progress' || transfer.status === 'queued') && (
              <div className="mb-2">
                <Progress
                  value={transfer.progress}
                  className="h-1.5"
                  indicatorClassName={getProgressColor()}
                />
              </div>
            )}

            {/* Transfer info */}
            <div className="flex items-center gap-4 text-xs text-[var(--color-dark-text-muted)]">
              <span>
                {formatFileSize(transfer.bytesTransferred)} / {formatFileSize(transfer.totalBytes)}
              </span>

              {transfer.status === 'in_progress' && transfer.speed > 0 && (
                <>
                  <span>{formatSpeed(transfer.speed)}</span>
                  {eta && <span>ETA: {eta}</span>}
                </>
              )}

              {transfer.status === 'completed' && (
                <span className="text-green-500">Complete</span>
              )}

              {transfer.status === 'failed' && transfer.error && (
                <span className="text-red-500">{transfer.error}</span>
              )}
            </div>
          </div>
        </div>

        {/* Cancel button */}
        {(transfer.status === 'in_progress' || transfer.status === 'queued') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCancel(transfer.id)}
            className="h-7 w-7 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function TransferQueue() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { transfers, cancelTransfer, clearCompleted, getTotalProgress } = useTransferQueue();

  const totalProgress = getTotalProgress();
  const hasActiveTransfers = totalProgress.active > 0;
  const hasCompletedTransfers = transfers.some(t =>
    t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled'
  );

  if (transfers.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[var(--color-dark-bg)] border-t border-[var(--color-dark-border)] shadow-lg z-40">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-[var(--color-dark-hover)]" onClick={() => setIsCollapsed(!isCollapsed)}>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
          >
            {isCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>

          <span className="font-medium text-sm">
            Transfers
            {hasActiveTransfers && (
              <span className="ml-2 text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">
                {totalProgress.active}
              </span>
            )}
          </span>

          {hasActiveTransfers && !isCollapsed && (
            <div className="flex items-center gap-2 text-xs text-[var(--color-dark-text-muted)]">
              <span>{totalProgress.percentage}% complete</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasCompletedTransfers && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                clearCompleted();
              }}
              className="h-7 text-xs"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Clear Completed
            </Button>
          )}
        </div>
      </div>

      {/* Transfer list */}
      {!isCollapsed && (
        <div className="max-h-[200px] overflow-y-auto">
          {transfers.length === 0 ? (
            <div className="py-8 text-center text-sm text-[var(--color-dark-text-muted)]">
              No active transfers
            </div>
          ) : (
            transfers.map(transfer => (
              <TransferItem
                key={transfer.id}
                transfer={transfer}
                onCancel={cancelTransfer}
              />
            ))
          )}
        </div>
      )}

      {/* Total progress bar when collapsed */}
      {isCollapsed && hasActiveTransfers && (
        <div className="px-4 pb-2">
          <Progress
            value={totalProgress.percentage}
            className="h-1"
            indicatorClassName="bg-blue-500"
          />
        </div>
      )}
    </div>
  );
}
