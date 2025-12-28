import React from 'react';
import { Upload, Download, Pause, Play, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { TransferJob } from '../../common/types';

interface TransferItemProps {
	job: TransferJob;
	onPause: (jobId: string) => void;
	onResume: (jobId: string) => void;
	onCancel: (jobId: string) => void;
}

/**
 * TransferItem Component
 * Displays a single transfer job with progress and controls
 */
export const TransferItem: React.FC<TransferItemProps> = ({ job, onPause, onResume, onCancel }) => {
	/**
	 * Formats bytes to human-readable format
	 */
	const formatBytes = (bytes: number): string => {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
		return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
	};

	/**
	 * Formats speed in bytes/s to human-readable format
	 */
	const formatSpeed = (bytesPerSecond: number): string => {
		if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`;
		if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
		return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
	};

	/**
	 * Truncates path to fit in UI
	 */
	const truncatePath = (path: string, maxLength: number = 40): string => {
		if (path.length <= maxLength) return path;
		const parts = path.split('/');
		if (parts.length <= 2) return '...' + path.slice(-maxLength);
		return parts[0] + '/.../' + parts[parts.length - 1];
	};

	/**
	 * Gets status icon based on job status
	 */
	const getStatusIcon = () => {
		const iconSize = 16;
		switch (job.status) {
			case 'active':
				return <Loader2 size={iconSize} className="spinner" style={{ color: 'var(--vscode-terminal-ansiBlue)' }} />;
			case 'completed':
				return <CheckCircle2 size={iconSize} style={{ color: 'var(--vscode-terminal-ansiGreen)' }} />;
			case 'error':
			case 'cancelled':
				return <AlertCircle size={iconSize} style={{ color: 'var(--vscode-terminal-ansiRed)' }} />;
			case 'paused':
				return <Pause size={iconSize} style={{ color: 'var(--vscode-terminal-ansiYellow)' }} />;
			default:
				return null;
		}
	};

	const sourcePath = job.type === 'upload' ? job.localPath : job.remotePath;
	const destPath = job.type === 'upload' ? job.remotePath : job.localPath;

	return (
		<div className="transfer-item" data-status={job.status}>
			<div className="transfer-header">
				<div className="transfer-type-icon">
					{job.type === 'upload' ? (
						<Upload size={16} style={{ color: 'var(--vscode-terminal-ansiCyan)' }} />
					) : (
						<Download size={16} style={{ color: 'var(--vscode-terminal-ansiGreen)' }} />
					)}
				</div>
				<div className="transfer-info">
					<div className="transfer-filename">{job.filename}</div>
					<div className="transfer-paths">
						<span className="transfer-path">{truncatePath(sourcePath)}</span>
						<span className="transfer-arrow">→</span>
						<span className="transfer-path">{truncatePath(destPath)}</span>
					</div>
				</div>
				<div className="transfer-status-icon">
					{getStatusIcon()}
				</div>
			</div>

			<div className="transfer-progress-container">
				<progress
					className="transfer-progress"
					value={job.progress}
					max={100}
					data-status={job.status}
				/>
				<div className="transfer-stats">
					<span className="transfer-percentage">{job.progress}%</span>
					{job.status === 'active' && (
						<>
							<span className="transfer-separator">•</span>
							<span className="transfer-speed">{formatSpeed(job.speed)}</span>
							<span className="transfer-separator">•</span>
							<span className="transfer-size">
								{formatBytes(job.bytesTransferred)} / {formatBytes(job.size)}
							</span>
						</>
					)}
					{job.status === 'error' && job.error && (
						<>
							<span className="transfer-separator">•</span>
							<span className="transfer-error">{job.error}</span>
						</>
					)}
				</div>
			</div>

			<div className="transfer-controls">
				{job.status === 'active' && (
					<button
						className="transfer-control-btn"
						onClick={() => onPause(job.id)}
						title="Pause"
					>
						<Pause size={14} />
					</button>
				)}
				{job.status === 'paused' && (
					<button
						className="transfer-control-btn"
						onClick={() => onResume(job.id)}
						title="Resume"
					>
						<Play size={14} />
					</button>
				)}
				{(job.status === 'pending' || job.status === 'active' || job.status === 'paused') && (
					<button
						className="transfer-control-btn transfer-cancel-btn"
						onClick={() => onCancel(job.id)}
						title="Cancel"
					>
						<X size={14} />
					</button>
				)}
			</div>
		</div>
	);
};
