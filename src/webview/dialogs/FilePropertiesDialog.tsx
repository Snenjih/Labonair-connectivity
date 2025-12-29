import React, { useState, useEffect } from 'react';
import { FileEntry } from '../../common/types';
import { FileIcon } from '../components/FileIcon';
import { usePermissions } from '../hooks/usePermissions';
import '../styles/fileProperties.css';

interface FilePropertiesDialogProps {
	file: FileEntry;
	hostId: string;
	fileSystem?: 'local' | 'remote';
	onSave: (octal: string, recursive: boolean) => void;
	onClose: () => void;
}

const FilePropertiesDialog: React.FC<FilePropertiesDialogProps> = ({ file, hostId, fileSystem = 'remote', onSave, onClose }) => {
	const [activeTab, setActiveTab] = useState<'general' | 'permissions'>('general');
	const [recursive, setRecursive] = useState(false);
	const isLocal = fileSystem === 'local';
	const { octal, permissions, updatePermission, updateOctal } = usePermissions(
		file.permissions?.slice(-3) || '644'
	);

	/**
	 * Formats file size in human-readable format
	 */
	const formatSize = (bytes: number): string => {
		if (bytes === 0) {return '0 B';}
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
	};

	/**
	 * Infers MIME type from file extension
	 */
	const inferMimeType = (fileName: string): string => {
		const ext = fileName.split('.').pop()?.toLowerCase();
		const mimeTypes: Record<string, string> = {
			// Text
			'txt': 'text/plain',
			'md': 'text/markdown',
			'log': 'text/plain',
			'json': 'application/json',
			'xml': 'application/xml',
			'yaml': 'application/x-yaml',
			'yml': 'application/x-yaml',
			// Code
			'js': 'application/javascript',
			'ts': 'application/typescript',
			'jsx': 'application/javascript',
			'tsx': 'application/typescript',
			'py': 'text/x-python',
			'java': 'text/x-java',
			'c': 'text/x-c',
			'cpp': 'text/x-c++',
			'h': 'text/x-c',
			'go': 'text/x-go',
			'rs': 'text/x-rust',
			'sh': 'application/x-sh',
			'bash': 'application/x-sh',
			// Images
			'png': 'image/png',
			'jpg': 'image/jpeg',
			'jpeg': 'image/jpeg',
			'gif': 'image/gif',
			'svg': 'image/svg+xml',
			'webp': 'image/webp',
			// Archives
			'zip': 'application/zip',
			'tar': 'application/x-tar',
			'gz': 'application/gzip',
			'bz2': 'application/x-bzip2',
			'7z': 'application/x-7z-compressed',
			// Documents
			'pdf': 'application/pdf',
			'doc': 'application/msword',
			'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			// Media
			'mp4': 'video/mp4',
			'mp3': 'audio/mpeg',
			'wav': 'audio/wav'
		};

		return mimeTypes[ext || ''] || 'application/octet-stream';
	};

	/**
	 * Formats date
	 */
	const formatDate = (date: Date): string => {
		return new Date(date).toLocaleString();
	};

	/**
	 * Handles save button click
	 */
	const handleSave = () => {
		onSave(octal, recursive);
		onClose();
	};

	/**
	 * Handles dialog backdrop click
	 */
	const handleBackdropClick = (e: React.MouseEvent) => {
		if (e.target === e.currentTarget) {
			onClose();
		}
	};

	/**
	 * Renders General tab content
	 */
	const renderGeneralTab = () => (
		<div className="file-properties-general">
			<div className="file-info-header">
				<div className="file-icon-large">
					<FileIcon file={file} size={64} />
				</div>
				<div className="file-name-info">
					<h3>{file.name}</h3>
					<span className="file-type-label">
						{file.type === 'd' ? 'Directory' : file.type === 'l' ? 'Symbolic Link' : 'File'}
					</span>
				</div>
			</div>

			<div className="file-properties-grid">
				<div className="property-row">
					<span className="property-label">Full Path:</span>
					<span className="property-value monospace">{file.path}</span>
				</div>

				{file.type !== 'd' && (
					<>
						<div className="property-row">
							<span className="property-label">Size:</span>
							<span className="property-value">
								{formatSize(file.size)} ({file.size.toLocaleString()} bytes)
							</span>
						</div>

						<div className="property-row">
							<span className="property-label">MIME Type:</span>
							<span className="property-value">{inferMimeType(file.name)}</span>
						</div>
					</>
				)}

				<div className="property-row">
					<span className="property-label">Modified:</span>
					<span className="property-value">{formatDate(file.modTime)}</span>
				</div>

				<div className="property-row">
					<span className="property-label">Permissions:</span>
					<span className="property-value monospace">{file.permissions}</span>
				</div>

				{file.owner && (
					<div className="property-row">
						<span className="property-label">Owner:</span>
						<span className="property-value">{file.owner}</span>
					</div>
				)}

				{file.group && (
					<div className="property-row">
						<span className="property-label">Group:</span>
						<span className="property-value">{file.group}</span>
					</div>
				)}

				{file.type === 'l' && file.symlinkTarget && (
					<div className="property-row">
						<span className="property-label">Symlink Target:</span>
						<span className="property-value monospace">{file.symlinkTarget}</span>
					</div>
				)}
			</div>
		</div>
	);

	/**
	 * Renders Permissions tab content
	 */
	const renderPermissionsTab = () => (
		<div className="file-properties-permissions">
			{isLocal && (
				<div style={{
					padding: '16px',
					background: 'var(--vscode-textBlockQuote-background)',
					border: '1px solid var(--vscode-textBlockQuote-border)',
					borderRadius: '4px',
					marginBottom: '16px'
				}}>
					<h4 style={{ marginTop: 0, marginBottom: '8px', fontSize: '13px' }}>
						Local File Permissions
					</h4>
					<p style={{ margin: 0, fontSize: '12px', lineHeight: '1.5' }}>
						Permissions for local files are managed by your operating system.
						On Windows, file permissions use a different system (ACLs) than Unix permissions shown here.
						On macOS/Linux, you can modify permissions using system tools or the command line.
					</p>
					<p style={{ margin: '8px 0 0 0', fontSize: '12px', lineHeight: '1.5', color: 'var(--vscode-descriptionForeground)' }}>
						<strong>Note:</strong> Permission editing is only available for remote SFTP files.
					</p>
				</div>
			)}
			<div className="octal-input-section">
				<label htmlFor="octal-input">Octal Notation:</label>
				<input
					id="octal-input"
					type="text"
					className="octal-input"
					value={octal}
					onChange={(e) => updateOctal(e.target.value)}
					maxLength={3}
					pattern="[0-7]{3}"
					disabled={isLocal}
				/>
				<span className="octal-help">3-digit octal (0-7)</span>
			</div>

			<div className="permissions-matrix">
				<div className="matrix-header">
					<div className="matrix-label"></div>
					<div className="matrix-col-header">Read</div>
					<div className="matrix-col-header">Write</div>
					<div className="matrix-col-header">Execute</div>
				</div>

				{/* Owner Row */}
				<div className="matrix-row">
					<div className="matrix-row-header">Owner</div>
					<div className="matrix-cell">
						<input
							type="checkbox"
							checked={permissions.owner.read}
							onChange={(e) => updatePermission('owner', 'read', e.target.checked)}
							disabled={isLocal}
						/>
					</div>
					<div className="matrix-cell">
						<input
							type="checkbox"
							checked={permissions.owner.write}
							onChange={(e) => updatePermission('owner', 'write', e.target.checked)}
							disabled={isLocal}
						/>
					</div>
					<div className="matrix-cell">
						<input
							type="checkbox"
							checked={permissions.owner.execute}
							onChange={(e) => updatePermission('owner', 'execute', e.target.checked)}
							disabled={isLocal}
						/>
					</div>
				</div>

				{/* Group Row */}
				<div className="matrix-row">
					<div className="matrix-row-header">Group</div>
					<div className="matrix-cell">
						<input
							type="checkbox"
							checked={permissions.group.read}
							onChange={(e) => updatePermission('group', 'read', e.target.checked)}
							disabled={isLocal}
						/>
					</div>
					<div className="matrix-cell">
						<input
							type="checkbox"
							checked={permissions.group.write}
							onChange={(e) => updatePermission('group', 'write', e.target.checked)}
							disabled={isLocal}
						/>
					</div>
					<div className="matrix-cell">
						<input
							type="checkbox"
							checked={permissions.group.execute}
							onChange={(e) => updatePermission('group', 'execute', e.target.checked)}
							disabled={isLocal}
						/>
					</div>
				</div>

				{/* Public Row */}
				<div className="matrix-row">
					<div className="matrix-row-header">Public</div>
					<div className="matrix-cell">
						<input
							type="checkbox"
							checked={permissions.public.read}
							onChange={(e) => updatePermission('public', 'read', e.target.checked)}
							disabled={isLocal}
						/>
					</div>
					<div className="matrix-cell">
						<input
							type="checkbox"
							checked={permissions.public.write}
							onChange={(e) => updatePermission('public', 'write', e.target.checked)}
							disabled={isLocal}
						/>
					</div>
					<div className="matrix-cell">
						<input
							type="checkbox"
							checked={permissions.public.execute}
							onChange={(e) => updatePermission('public', 'execute', e.target.checked)}
							disabled={isLocal}
						/>
					</div>
				</div>
			</div>

			{file.type === 'd' && (
				<div className="recursive-option">
					<label>
						<input
							type="checkbox"
							checked={recursive}
							onChange={(e) => setRecursive(e.target.checked)}
						/>
						<span>Apply to enclosed files and folders (recursive)</span>
					</label>
				</div>
			)}

			<div className="permissions-preview">
				<strong>Resulting Permissions:</strong> <code>{file.permissions.charAt(0) + octal.padStart(3, '0')}</code>
			</div>
		</div>
	);

	return (
		<div className="modal-overlay" onClick={handleBackdropClick}>
			<div className="modal-content file-properties-modal">
				<div className="modal-header">
					<h3>Properties</h3>
					<button className="close-button" onClick={onClose}>×</button>
				</div>

				<div className="tabs-container">
					<div className="tabs-header">
						<button
							className={`tab-button ${activeTab === 'general' ? 'active' : ''}`}
							onClick={() => setActiveTab('general')}
						>
							General
						</button>
						<button
							className={`tab-button ${activeTab === 'permissions' ? 'active' : ''}`}
							onClick={() => setActiveTab('permissions')}
						>
							Permissions
						</button>
					</div>

					<div className="tabs-content">
						{activeTab === 'general' ? renderGeneralTab() : renderPermissionsTab()}
					</div>
				</div>

				<div className="modal-footer">
					<button className="vscode-button secondary" onClick={onClose}>
						Close
					</button>
					{activeTab === 'permissions' && !isLocal && (
						<button className="vscode-button" onClick={handleSave}>
							Save Permissions
						</button>
					)}
				</div>
			</div>
		</div>
	);
};

export default FilePropertiesDialog;
