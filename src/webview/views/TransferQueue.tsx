import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { TransferItem } from '../components/TransferItem';
import { TransferJob, TransferQueueSummary, Message } from '../../common/types';
import vscode from '../utils/vscode';

/**
 * TransferQueue View
 * Displays the transfer queue with active, pending, and completed transfers
 */
export const TransferQueue: React.FC = () => {
	const [jobs, setJobs] = useState<TransferJob[]>([]);
	const [summary, setSummary] = useState<TransferQueueSummary>({
		activeCount: 0,
		totalSpeed: 0,
		queuedCount: 0
	});

	useEffect(() => {
		// Listen for messages from extension
		const messageHandler = (event: MessageEvent<Message>) => {
			const message = event.data;

			switch (message.command) {
				case 'TRANSFER_UPDATE':
					// Update specific job
					setJobs(prev => {
						const index = prev.findIndex(j => j.id === message.payload.job.id);
						if (index !== -1) {
							const newJobs = [...prev];
							newJobs[index] = message.payload.job;
							return newJobs;
						}
						return [...prev, message.payload.job];
					});
					break;

				case 'TRANSFER_QUEUE_STATE':
					// Update entire queue state
					setJobs(message.payload.jobs);
					setSummary(message.payload.summary);
					break;
			}
		};

		window.addEventListener('message', messageHandler);

		// Request initial state
		vscode.postMessage({ command: 'FETCH_DATA' });

		return () => {
			window.removeEventListener('message', messageHandler);
		};
	}, []);

	/**
	 * Handles pause action
	 */
	const handlePause = (jobId: string) => {
		vscode.postMessage({
			command: 'TRANSFER_QUEUE',
			payload: { action: 'pause', jobId }
		});
	};

	/**
	 * Handles resume action
	 */
	const handleResume = (jobId: string) => {
		vscode.postMessage({
			command: 'TRANSFER_QUEUE',
			payload: { action: 'resume', jobId }
		});
	};

	/**
	 * Handles cancel action
	 */
	const handleCancel = (jobId: string) => {
		vscode.postMessage({
			command: 'TRANSFER_QUEUE',
			payload: { action: 'cancel', jobId }
		});
	};

	/**
	 * Handles clear completed action
	 */
	const handleClearCompleted = () => {
		vscode.postMessage({
			command: 'TRANSFER_QUEUE',
			payload: { action: 'clear_completed' }
		});
	};

	/**
	 * Formats speed in bytes/s to human-readable format
	 */
	const formatSpeed = (bytesPerSecond: number): string => {
		if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`;
		if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
		return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
	};

	// Separate jobs by status
	const activeJobs = jobs.filter(j => j.status === 'active');
	const queuedJobs = jobs.filter(j => j.status === 'pending' || j.status === 'paused');
	const completedJobs = jobs.filter(j => j.status === 'completed' || j.status === 'error' || j.status === 'cancelled');

	// Calculate overall progress if there are active jobs
	const overallProgress = activeJobs.length > 0
		? activeJobs.reduce((sum, job) => sum + job.progress, 0) / activeJobs.length
		: 0;

	return (
		<div className="transfer-queue-view">
			{/* Header with global progress */}
			<div className="transfer-queue-header">
				<div className="transfer-summary">
					<div className="transfer-summary-text">
						{summary.activeCount > 0 ? (
							<>
								<span className="transfer-summary-count">{summary.activeCount} Active</span>
								<span className="transfer-summary-separator">•</span>
								<span className="transfer-summary-speed">{formatSpeed(summary.totalSpeed)}</span>
							</>
						) : (
							<span className="transfer-summary-idle">No active transfers</span>
						)}
					</div>
					{completedJobs.length > 0 && (
						<button
							className="clear-completed-btn"
							onClick={handleClearCompleted}
							title="Clear completed transfers"
						>
							<Trash2 size={14} />
							<span>Clear</span>
						</button>
					)}
				</div>

				{summary.activeCount > 0 && (
					<div className="transfer-global-progress-container">
						<progress
							className="transfer-global-progress"
							value={overallProgress}
							max={100}
						/>
					</div>
				)}
			</div>

			{/* Transfer Lists */}
			<div className="transfer-lists">
				{/* Active Transfers */}
				{activeJobs.length > 0 && (
					<div className="transfer-section">
						<div className="transfer-section-header">
							Active ({activeJobs.length})
						</div>
						<div className="transfer-section-content">
							{activeJobs.map(job => (
								<TransferItem
									key={job.id}
									job={job}
									onPause={handlePause}
									onResume={handleResume}
									onCancel={handleCancel}
								/>
							))}
						</div>
					</div>
				)}

				{/* Queued Transfers */}
				{queuedJobs.length > 0 && (
					<div className="transfer-section">
						<div className="transfer-section-header">
							Queued ({queuedJobs.length})
						</div>
						<div className="transfer-section-content">
							{queuedJobs.map(job => (
								<TransferItem
									key={job.id}
									job={job}
									onPause={handlePause}
									onResume={handleResume}
									onCancel={handleCancel}
								/>
							))}
						</div>
					</div>
				)}

				{/* Completed Transfers */}
				{completedJobs.length > 0 && (
					<div className="transfer-section">
						<div className="transfer-section-header">
							Completed ({completedJobs.length})
						</div>
						<div className="transfer-section-content">
							{completedJobs.map(job => (
								<TransferItem
									key={job.id}
									job={job}
									onPause={handlePause}
									onResume={handleResume}
									onCancel={handleCancel}
								/>
							))}
						</div>
					</div>
				)}

				{/* Empty State */}
				{jobs.length === 0 && (
					<div className="transfer-empty-state">
						<div className="transfer-empty-icon">📦</div>
						<div className="transfer-empty-title">No transfers</div>
						<div className="transfer-empty-description">
							File transfers will appear here
						</div>
					</div>
				)}
			</div>
		</div>
	);
};
