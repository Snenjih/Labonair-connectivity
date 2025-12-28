import React, { useState } from 'react';
import { AlertTriangle, File } from 'lucide-react';
import vscode from '../utils/vscode';

interface ConflictDialogProps {
	transferId: string;
	sourceFile: string;
	sourceSize?: number;
	targetStats: {
		size: number;
		modTime: Date;
	};
	onClose: () => void;
}

const ConflictDialog: React.FC<ConflictDialogProps> = ({
	transferId,
	sourceFile,
	sourceSize,
	targetStats,
	onClose
}) => {
	const [applyToAll, setApplyToAll] = useState(false);

	const formatSize = (bytes: number): string => {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
		if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
		return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
	};

	const formatDate = (date: Date): string => {
		return new Date(date).toLocaleString();
	};

	const handleResolve = (action: 'overwrite' | 'resume' | 'rename' | 'skip') => {
		vscode.postMessage({
			command: 'RESOLVE_CONFLICT',
			payload: {
				transferId,
				action,
				applyToAll
			}
		});
		onClose();
	};

	const isSourceNewer = sourceSize && targetStats.size ? sourceSize > targetStats.size : false;
	const isTargetNewer = !isSourceNewer && sourceSize && targetStats.size ? targetStats.size > sourceSize : false;

	return (
		<div className="conflict-dialog-overlay">
			<div className="conflict-dialog">
				<div className="conflict-dialog-header">
					<AlertTriangle size={24} className="conflict-icon" />
					<h2>File Conflict</h2>
				</div>

				<div className="conflict-dialog-body">
					<p className="conflict-message">
						The file <strong>{sourceFile}</strong> already exists at the destination.
					</p>

					<div className="conflict-comparison">
						<div className="conflict-file-info">
							<div className="conflict-file-header">
								<File size={16} />
								<span>Source File</span>
							</div>
							<div className="conflict-file-details">
								{sourceSize && (
									<div className="conflict-detail">
										<span className="conflict-label">Size:</span>
										<span className={`conflict-value ${isSourceNewer ? 'highlight' : ''}`}>
											{formatSize(sourceSize)}
										</span>
									</div>
								)}
							</div>
						</div>

						<div className="conflict-file-info">
							<div className="conflict-file-header">
								<File size={16} />
								<span>Destination File</span>
							</div>
							<div className="conflict-file-details">
								<div className="conflict-detail">
									<span className="conflict-label">Size:</span>
									<span className={`conflict-value ${isTargetNewer ? 'highlight' : ''}`}>
										{formatSize(targetStats.size)}
									</span>
								</div>
								<div className="conflict-detail">
									<span className="conflict-label">Modified:</span>
									<span className="conflict-value">
										{formatDate(targetStats.modTime)}
									</span>
								</div>
							</div>
						</div>
					</div>

					<div className="conflict-options">
						<label className="conflict-checkbox">
							<input
								type="checkbox"
								checked={applyToAll}
								onChange={(e) => setApplyToAll(e.target.checked)}
							/>
							<span>Apply to all conflicts for this queue</span>
						</label>
					</div>
				</div>

				<div className="conflict-dialog-actions">
					<button
						className="conflict-button conflict-button-secondary"
						onClick={() => handleResolve('skip')}
					>
						Skip
					</button>
					<button
						className="conflict-button conflict-button-secondary"
						onClick={() => handleResolve('rename')}
					>
						Rename
					</button>
					<button
						className="conflict-button conflict-button-secondary"
						onClick={() => handleResolve('resume')}
					>
						Resume/Append
					</button>
					<button
						className="conflict-button conflict-button-primary"
						onClick={() => handleResolve('overwrite')}
					>
						Overwrite
					</button>
				</div>
			</div>
		</div>
	);
};

export default ConflictDialog;
