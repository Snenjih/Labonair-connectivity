import React, { useEffect, useRef } from 'react';
import { Server, X, AlertCircle, RotateCw } from 'lucide-react';

export interface ConnectionLog {
	timestamp: number;
	message: string;
	level: 'info' | 'success' | 'error';
}

interface ConnectionOverlayProps {
	status: 'connecting' | 'error';
	logs: ConnectionLog[];
	error?: {
		code: string;
		message: string;
	};
	onCancel: () => void;
	onRetry?: () => void;
	onClose?: () => void;
}

export const ConnectionOverlay: React.FC<ConnectionOverlayProps> = ({
	status,
	logs,
	error,
	onCancel,
	onRetry,
	onClose
}) => {
	const logContainerRef = useRef<HTMLDivElement>(null);

	// Auto-scroll logs to bottom when new logs arrive
	useEffect(() => {
		if (logContainerRef.current) {
			logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
		}
	}, [logs]);

	if (status === 'connecting') {
		return (
			<div className="connection-overlay">
				<div className="connection-overlay-content">
					{/* Animated Icon */}
					<div className="connection-spinner">
						<Server size={48} className="server-icon" />
						<div className="spinner-ring"></div>
					</div>

					<h2>Connecting...</h2>
					<p className="connection-subtitle">Establishing SSH connection</p>

					{/* Log Console */}
					<div className="connection-log-container" ref={logContainerRef}>
						{logs.map((log, index) => (
							<div
								key={index}
								className={`log-entry log-${log.level}`}
								style={{ animationDelay: `${index * 0.05}s` }}
							>
								<span className="log-time">
									{new Date(log.timestamp).toLocaleTimeString()}
								</span>
								<span className="log-message">{log.message}</span>
							</div>
						))}
					</div>

					{/* Cancel Button */}
					<button className="connection-cancel-btn" onClick={onCancel}>
						<X size={16} />
						Cancel
					</button>
				</div>
			</div>
		);
	}

	if (status === 'error') {
		return (
			<div className="connection-overlay">
				<div className="connection-overlay-content">
					{/* Error Icon */}
					<div className="connection-error-icon">
						<AlertCircle size={64} />
					</div>

					<h2>Connection Failed</h2>

					{/* Error Code Badge */}
					{error?.code && (
						<div className="error-code-badge">[{error.code}]</div>
					)}

					{/* Error Message */}
					<p className="error-message">
						{error?.message || 'An unknown error occurred while connecting to the host.'}
					</p>

					{/* Action Buttons */}
					<div className="connection-actions">
						{onRetry && (
							<button className="connection-retry-btn" onClick={onRetry}>
								<RotateCw size={16} />
								Retry Connection
							</button>
						)}
						{onClose && (
							<button className="connection-close-btn" onClick={onClose}>
								<X size={16} />
								Close
							</button>
						)}
					</div>

					{/* Error Logs */}
					{logs.length > 0 && (
						<details className="error-details">
							<summary>Connection Details</summary>
							<div className="connection-log-container" ref={logContainerRef}>
								{logs.map((log, index) => (
									<div key={index} className={`log-entry log-${log.level}`}>
										<span className="log-time">
											{new Date(log.timestamp).toLocaleTimeString()}
										</span>
										<span className="log-message">{log.message}</span>
									</div>
								))}
							</div>
						</details>
					)}
				</div>
			</div>
		);
	}

	return null;
};
