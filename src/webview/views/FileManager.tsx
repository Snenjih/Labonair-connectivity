import React, { useState, useEffect } from 'react';
import {
	ChevronUp,
	RefreshCw,
	Upload,
	FolderPlus,
	Download,
	Trash2,
	Home
} from 'lucide-react';
import { FileEntry, TransferStatus } from '../../common/types';
import { FileIcon } from '../components/FileIcon';
import vscode from '../utils/vscode';

interface FileManagerProps {
	hostId: string;
	initialPath?: string;
}

/**
 * FileManager Component
 * SFTP File Browser UI
 */
export const FileManager: React.FC<FileManagerProps> = ({ hostId, initialPath = '~' }) => {
	const [currentPath, setCurrentPath] = useState<string>(initialPath);
	const [files, setFiles] = useState<FileEntry[]>([]);
	const [pathInput, setPathInput] = useState<string>(initialPath);
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);
	const [transfer, setTransfer] = useState<TransferStatus | null>(null);
	const [selectedFile, setSelectedFile] = useState<string | null>(null);

	// Load directory on mount and when path changes
	useEffect(() => {
		loadDirectory(currentPath);
	}, [currentPath]);

	// Listen for messages from extension
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data;

			switch (message.command) {
				case 'SFTP_LS_RESPONSE':
					setFiles(message.payload.files);
					setCurrentPath(message.payload.currentPath);
					setPathInput(message.payload.currentPath);
					setIsLoading(false);
					setError(null);
					break;

				case 'SFTP_TRANSFER_PROGRESS':
					setTransfer(message.payload);
					break;

				case 'SFTP_ERROR':
					setError(message.payload.message);
					setIsLoading(false);
					setTransfer(null);
					break;

				case 'UPDATE_DATA':
					// Initial data load
					if (message.payload.currentPath) {
						setCurrentPath(message.payload.currentPath);
					}
					break;
			}
		};

		window.addEventListener('message', handleMessage);
		return () => window.removeEventListener('message', handleMessage);
	}, []);

	/**
	 * Loads a directory listing
	 */
	const loadDirectory = (path: string) => {
		setIsLoading(true);
		setError(null);
		vscode.postMessage({
			command: 'SFTP_LS',
			payload: { hostId, path }
		});
	};

	/**
	 * Navigates to parent directory
	 */
	const navigateUp = () => {
		if (currentPath === '/' || currentPath === '~') {
			return;
		}
		const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
		setCurrentPath(parentPath);
	};

	/**
	 * Navigates to home directory
	 */
	const navigateHome = () => {
		setCurrentPath('~');
	};

	/**
	 * Refreshes current directory
	 */
	const refresh = () => {
		loadDirectory(currentPath);
	};

	/**
	 * Handles path input submission
	 */
	const handlePathSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setCurrentPath(pathInput);
	};

	/**
	 * Handles file double-click
	 */
	const handleFileDoubleClick = (file: FileEntry) => {
		if (file.type === 'd') {
			// Navigate into directory
			setCurrentPath(file.path);
		} else {
			// Download file
			handleDownload(file);
		}
	};

	/**
	 * Handles file download
	 */
	const handleDownload = (file: FileEntry) => {
		vscode.postMessage({
			command: 'SFTP_DOWNLOAD',
			payload: { hostId, remotePath: file.path }
		});
	};

	/**
	 * Handles file upload
	 */
	const handleUpload = () => {
		vscode.postMessage({
			command: 'SFTP_UPLOAD',
			payload: { hostId, remotePath: currentPath }
		});
	};

	/**
	 * Handles file deletion
	 */
	const handleDelete = (file: FileEntry) => {
		vscode.postMessage({
			command: 'SFTP_RM',
			payload: { hostId, path: file.path }
		});
	};

	/**
	 * Handles new folder creation
	 */
	const handleNewFolder = () => {
		vscode.postMessage({
			command: 'SFTP_MKDIR',
			payload: { hostId, path: currentPath }
		});
	};

	/**
	 * Formats file size
	 */
	const formatSize = (bytes: number): string => {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
	};

	/**
	 * Formats date
	 */
	const formatDate = (date: Date): string => {
		const d = new Date(date);
		return d.toLocaleString();
	};

	/**
	 * Generates breadcrumbs from path
	 */
	const getBreadcrumbs = (): string[] => {
		if (currentPath === '~' || currentPath === '') {
			return ['~'];
		}
		if (currentPath === '/') {
			return ['/'];
		}
		const parts = currentPath.split('/').filter(p => p);
		return ['/', ...parts];
	};

	/**
	 * Handles breadcrumb click
	 */
	const handleBreadcrumbClick = (index: number) => {
		const breadcrumbs = getBreadcrumbs();
		if (index === 0 && breadcrumbs[0] === '/') {
			setCurrentPath('/');
		} else {
			const newPath = '/' + breadcrumbs.slice(1, index + 1).join('/');
			setCurrentPath(newPath);
		}
	};

	return (
		<div className="file-manager">
			{/* Toolbar */}
			<div className="file-manager-toolbar">
				<button
					className="toolbar-button"
					onClick={navigateHome}
					title="Home"
					disabled={isLoading}
				>
					<Home size={16} />
				</button>
				<button
					className="toolbar-button"
					onClick={navigateUp}
					title="Up"
					disabled={isLoading || currentPath === '/' || currentPath === '~'}
				>
					<ChevronUp size={16} />
				</button>
				<button
					className="toolbar-button"
					onClick={refresh}
					title="Refresh"
					disabled={isLoading}
				>
					<RefreshCw size={16} className={isLoading ? 'spinning' : ''} />
				</button>
				<button
					className="toolbar-button"
					onClick={handleUpload}
					title="Upload File"
					disabled={isLoading}
				>
					<Upload size={16} />
				</button>
				<button
					className="toolbar-button"
					onClick={handleNewFolder}
					title="New Folder"
					disabled={isLoading}
				>
					<FolderPlus size={16} />
				</button>

				{/* Path Input */}
				<form onSubmit={handlePathSubmit} className="path-form">
					<input
						type="text"
						className="path-input"
						value={pathInput}
						onChange={(e) => setPathInput(e.target.value)}
						disabled={isLoading}
						placeholder="Enter path..."
					/>
				</form>
			</div>

			{/* Breadcrumbs */}
			<div className="breadcrumbs">
				{getBreadcrumbs().map((crumb, index) => (
					<React.Fragment key={index}>
						<span
							className="breadcrumb"
							onClick={() => handleBreadcrumbClick(index)}
						>
							{crumb}
						</span>
						{index < getBreadcrumbs().length - 1 && (
							<span className="breadcrumb-separator">/</span>
						)}
					</React.Fragment>
				))}
			</div>

			{/* Error Message */}
			{error && (
				<div className="error-message">
					<span className="error-icon">⚠</span>
					{error}
				</div>
			)}

			{/* File List */}
			<div className="file-list">
				{files.length === 0 && !isLoading && !error && (
					<div className="empty-state">
						<p>No files in this directory</p>
					</div>
				)}

				{files.map((file) => (
					<div
						key={file.path}
						className={`file-item ${selectedFile === file.path ? 'selected' : ''}`}
						onClick={() => setSelectedFile(file.path)}
						onDoubleClick={() => handleFileDoubleClick(file)}
					>
						<div className="file-icon">
							<FileIcon file={file} size={20} />
						</div>
						<div className="file-info">
							<div className="file-name">{file.name}</div>
							<div className="file-meta">
								{file.type !== 'd' && (
									<span className="file-size">{formatSize(file.size)}</span>
								)}
								<span className="file-date">{formatDate(file.modTime)}</span>
								<span className="file-permissions">{file.permissions}</span>
							</div>
						</div>
						<div className="file-actions">
							{file.type !== 'd' && (
								<button
									className="action-button"
									onClick={(e) => {
										e.stopPropagation();
										handleDownload(file);
									}}
									title="Download"
								>
									<Download size={14} />
								</button>
							)}
							<button
								className="action-button delete"
								onClick={(e) => {
									e.stopPropagation();
									handleDelete(file);
								}}
								title="Delete"
							>
								<Trash2 size={14} />
							</button>
						</div>
					</div>
				))}
			</div>

			{/* Transfer Progress */}
			{transfer && (
				<div className="transfer-status">
					<div className="transfer-info">
						<span className="transfer-type">
							{transfer.type === 'upload' ? '↑' : '↓'}
						</span>
						<span className="transfer-filename">{transfer.filename}</span>
						<span className="transfer-speed">{transfer.speed}</span>
					</div>
					<div className="progress-bar">
						<div
							className="progress-fill"
							style={{ width: `${transfer.progress}%` }}
						/>
					</div>
					<div className="transfer-percentage">{transfer.progress}%</div>
				</div>
			)}

			{/* Loading Overlay */}
			{isLoading && (
				<div className="loading-overlay">
					<div className="spinner" />
					<p>Loading...</p>
				</div>
			)}
		</div>
	);
};
