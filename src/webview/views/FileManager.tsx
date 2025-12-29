import React, { useState, useEffect, useCallback } from 'react';
import { FileEntry, TransferStatus } from '../../common/types';
import { Toolbar } from '../components/FileManager/Toolbar';
import { FileList } from '../components/FileManager/FileList';
import FilePropertiesDialog from '../dialogs/FilePropertiesDialog';
import vscode from '../utils/vscode';
import '../styles/fileManager.css';

interface FileManagerProps {
	hostId: string;
	initialPath?: string;
	layout?: 'explorer' | 'commander';
	defaultView?: 'list' | 'grid';
}

interface PanelState {
	currentPath: string;
	files: FileEntry[];
	history: string[];
	historyIndex: number;
	selection: string[];
	focusedFile: string | null;
	searchQuery: string;
	isLoading: boolean;
}

/**
 * FileManager Component
 * Advanced SFTP File Browser with dual-panel support
 */
export const FileManager: React.FC<FileManagerProps> = ({
	hostId,
	initialPath = '~',
	layout: initialLayout = 'explorer',
	defaultView: initialView = 'list'
}) => {
	// Global state
	const [layoutMode, setLayoutMode] = useState<'explorer' | 'commander'>(initialLayout);
	const [viewMode, setViewMode] = useState<'list' | 'grid'>(initialView);
	const [activePanel, setActivePanel] = useState<'left' | 'right'>('left');
	const [syncBrowsing, setSyncBrowsing] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);
	const [transfer, setTransfer] = useState<TransferStatus | null>(null);
	const [propertiesFile, setPropertiesFile] = useState<FileEntry | null>(null);

	// Panel states
	const [leftPanel, setLeftPanel] = useState<PanelState>({
		currentPath: initialPath,
		files: [],
		history: [initialPath],
		historyIndex: 0,
		selection: [],
		focusedFile: null,
		searchQuery: '',
		isLoading: false
	});

	const [rightPanel, setRightPanel] = useState<PanelState>({
		currentPath: initialPath,
		files: [],
		history: [initialPath],
		historyIndex: 0,
		selection: [],
		focusedFile: null,
		searchQuery: '',
		isLoading: false
	});

	const getActiveState = (): PanelState => activePanel === 'left' ? leftPanel : rightPanel;
	const setActiveState = (updater: (prev: PanelState) => PanelState) => {
		if (activePanel === 'left') {
			setLeftPanel(updater);
		} else {
			setRightPanel(updater);
		}
	};

	// Load directory on mount and when path changes
	useEffect(() => {
		loadDirectory(leftPanel.currentPath, 'left');
		if (layoutMode === 'commander') {
			loadDirectory(rightPanel.currentPath, 'right');
		}
	}, []);

	// Listen for messages from extension
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data;

			switch (message.command) {
				case 'SFTP_LS_RESPONSE': {
					const panelId = message.payload.panelId || 'left';
					const setState = panelId === 'left' ? setLeftPanel : setRightPanel;

					setState(prev => ({
						...prev,
						files: message.payload.files,
						currentPath: message.payload.currentPath,
						isLoading: false
					}));
					setError(null);
					break;
				}

				case 'SFTP_TRANSFER_PROGRESS':
					setTransfer(message.payload);
					break;

				case 'SFTP_ERROR':
					setError(message.payload.message);
					setLeftPanel(prev => ({ ...prev, isLoading: false }));
					setRightPanel(prev => ({ ...prev, isLoading: false }));
					setTransfer(null);
					break;

				case 'UPDATE_DATA':
					if (message.payload.currentPath) {
						setLeftPanel(prev => ({ ...prev, currentPath: message.payload.currentPath }));
					}
					break;
			}
		};

		window.addEventListener('message', handleMessage);
		return () => window.removeEventListener('message', handleMessage);
	}, []);

	// Commander hotkeys (Tab, Space, Insert, F-Keys)
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const state = getActiveState();

			// Tab: Toggle focus between panels (Commander mode only)
			if (e.key === 'Tab' && layoutMode === 'commander') {
				e.preventDefault();
				setActivePanel(prev => prev === 'left' ? 'right' : 'left');
				return;
			}

			// Space: Toggle selection of focused file
			if (e.key === ' ' && state.focusedFile) {
				e.preventDefault();
				setActiveState(prev => {
					const isSelected = prev.selection.includes(prev.focusedFile!);
					return {
						...prev,
						selection: isSelected
							? prev.selection.filter(p => p !== prev.focusedFile)
							: [...prev.selection, prev.focusedFile!]
					};
				});
				return;
			}

			// Insert: Toggle selection and move cursor down
			if (e.key === 'Insert' && state.focusedFile) {
				e.preventDefault();
				setActiveState(prev => {
					const currentIndex = prev.files.findIndex(f => f.path === prev.focusedFile);
					const nextIndex = Math.min(currentIndex + 1, prev.files.length - 1);
					const nextFile = prev.files[nextIndex];
					const isSelected = prev.selection.includes(prev.focusedFile!);

					return {
						...prev,
						selection: isSelected
							? prev.selection.filter(p => p !== prev.focusedFile)
							: [...prev.selection, prev.focusedFile!],
						focusedFile: nextFile?.path || prev.focusedFile
					};
				});
				return;
			}

			// F-Keys (only in Commander mode and when files are available)
			if (layoutMode === 'commander' && state.files.length > 0) {
				const selectedFiles = state.files.filter(f => state.selection.includes(f.path));
				const focusedFileEntry = state.files.find(f => f.path === state.focusedFile);

				switch (e.key) {
					case 'F3':
						e.preventDefault();
						// Quick Look (Media Preview) - use focused file or first selected
						if (focusedFileEntry && focusedFileEntry.type === '-') {
							vscode.postMessage({
								command: 'PREVIEW_FILE',
								payload: { hostId, remotePath: focusedFileEntry.path, fileType: 'image' }
							});
						}
						break;

					case 'F4':
						e.preventDefault();
						// Edit - use focused file or first selected
						if (focusedFileEntry && focusedFileEntry.type === '-') {
							handleFileEdit(focusedFileEntry);
						}
						break;

					case 'F5':
						e.preventDefault();
						// Copy to opposite panel
						if (selectedFiles.length > 0) {
							const targetPanel = activePanel === 'left' ? rightPanel : leftPanel;
							handleInternalDrop(
								selectedFiles.map(f => f.path),
								targetPanel.currentPath,
								activePanel
							);
						}
						break;

					case 'F6':
						e.preventDefault();
						// Move to opposite panel
						if (selectedFiles.length > 0) {
							const targetPanel = activePanel === 'left' ? rightPanel : leftPanel;
							vscode.postMessage({
								command: 'SFTP_MOVE',
								payload: {
									hostId,
									sourcePaths: selectedFiles.map(f => f.path),
									targetPath: targetPanel.currentPath,
									sourcePanel: activePanel
								}
							});
							// Clear selection after move
							setActiveState(prev => ({ ...prev, selection: [], focusedFile: null }));
						}
						break;

					case 'F7':
						e.preventDefault();
						// New Folder
						handleNewFolder();
						break;

					case 'F8':
						e.preventDefault();
						// Delete selected files
						if (selectedFiles.length > 0) {
							handleFileDelete(selectedFiles);
						}
						break;
				}
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [layoutMode, activePanel, leftPanel, rightPanel]);

	/**
	 * Loads a directory listing
	 */
	const loadDirectory = (path: string, panelId: 'left' | 'right' = activePanel) => {
		const setState = panelId === 'left' ? setLeftPanel : setRightPanel;

		setState(prev => ({ ...prev, isLoading: true }));
		setError(null);

		vscode.postMessage({
			command: 'SFTP_LS',
			payload: { hostId, path, panelId }
		});
	};

	/**
	 * Navigates to a path
	 */
	const navigateToPath = (path: string, panelId: 'left' | 'right' = activePanel) => {
		const setState = panelId === 'left' ? setLeftPanel : setRightPanel;

		setState(prev => {
			const newHistory = [...prev.history.slice(0, prev.historyIndex + 1), path];
			return {
				...prev,
				currentPath: path,
				history: newHistory,
				historyIndex: newHistory.length - 1,
				selection: [],
				focusedFile: null
			};
		});

		loadDirectory(path, panelId);

		// Mirror navigation to other panel if sync browsing is enabled
		if (syncBrowsing && layoutMode === 'commander') {
			const otherPanelId: 'left' | 'right' = panelId === 'left' ? 'right' : 'left';
			const otherSetState = otherPanelId === 'left' ? setLeftPanel : setRightPanel;

			otherSetState(prev => {
				const newHistory = [...prev.history.slice(0, prev.historyIndex + 1), path];
				return {
					...prev,
					currentPath: path,
					history: newHistory,
					historyIndex: newHistory.length - 1,
					selection: [],
					focusedFile: null
				};
			});

			loadDirectory(path, otherPanelId);
		}
	};

	/**
	 * Navigation handlers
	 */
	const handleNavigateHome = () => {
		navigateToPath('~');
	};

	const handleNavigateUp = () => {
		const state = getActiveState();
		if (state.currentPath === '/' || state.currentPath === '~') {
			return;
		}
		const parentPath = state.currentPath.split('/').slice(0, -1).join('/') || '/';
		navigateToPath(parentPath);
	};

	const handleNavigateBack = () => {
		const state = getActiveState();
		if (state.historyIndex > 0) {
			const newIndex = state.historyIndex - 1;
			const path = state.history[newIndex];

			setActiveState(prev => ({
				...prev,
				historyIndex: newIndex,
				currentPath: path,
				selection: [],
				focusedFile: null
			}));

			loadDirectory(path);
		}
	};

	const handleNavigateForward = () => {
		const state = getActiveState();
		if (state.historyIndex < state.history.length - 1) {
			const newIndex = state.historyIndex + 1;
			const path = state.history[newIndex];

			setActiveState(prev => ({
				...prev,
				historyIndex: newIndex,
				currentPath: path,
				selection: [],
				focusedFile: null
			}));

			loadDirectory(path);
		}
	};

	const handleRefresh = () => {
		loadDirectory(getActiveState().currentPath);
	};

	/**
	 * File operation handlers
	 */
	const handleFileSelect = (filePath: string, ctrlKey: boolean, shiftKey: boolean) => {
		setActiveState(prev => {
			if (shiftKey && prev.focusedFile) {
				// Range selection
				const files = prev.files;
				const startIndex = files.findIndex(f => f.path === prev.focusedFile);
				const endIndex = files.findIndex(f => f.path === filePath);
				const range = files.slice(
					Math.min(startIndex, endIndex),
					Math.max(startIndex, endIndex) + 1
				).map(f => f.path);
				return {
					...prev,
					selection: range,
					focusedFile: filePath
				};
			} else if (ctrlKey) {
				// Multi selection
				const isSelected = prev.selection.includes(filePath);
				return {
					...prev,
					selection: isSelected
						? prev.selection.filter(p => p !== filePath)
						: [...prev.selection, filePath],
					focusedFile: filePath
				};
			} else {
				// Single selection
				return {
					...prev,
					selection: [filePath],
					focusedFile: filePath
				};
			}
		});
	};

	const handleFileOpen = (file: FileEntry) => {
		if (file.type === 'd') {
			// Navigate into directory
			navigateToPath(file.path);
		} else {
			// Edit file (Edit-on-Fly)
			vscode.postMessage({
				command: 'EDIT_FILE',
				payload: { hostId, remotePath: file.path }
			});
		}
	};

	const handleFileEdit = (file: FileEntry) => {
		vscode.postMessage({
			command: 'EDIT_FILE',
			payload: { hostId, remotePath: file.path }
		});
	};

	const handleFileDownload = (file: FileEntry) => {
		vscode.postMessage({
			command: 'SFTP_DOWNLOAD',
			payload: { hostId, remotePath: file.path }
		});
	};

	const handleFileDelete = (files: FileEntry[]) => {
		files.forEach(file => {
			vscode.postMessage({
				command: 'SFTP_RM',
				payload: { hostId, path: file.path }
			});
		});

		// Clear selection
		setActiveState(prev => ({ ...prev, selection: [], focusedFile: null }));

		// Refresh after a short delay
		setTimeout(() => handleRefresh(), 500);
	};

	const handleFileRename = (file: FileEntry) => {
		// This would show a modal/input box in the extension
		vscode.postMessage({
			command: 'SFTP_RENAME',
			payload: { hostId, oldPath: file.path, newPath: '' }
		});
	};

	const handleFileProperties = (file: FileEntry) => {
		setPropertiesFile(file);
	};

	const handleSavePermissions = (octal: string, recursive: boolean) => {
		if (propertiesFile) {
			vscode.postMessage({
				command: 'SAVE_FILE_PERMISSIONS',
				payload: {
					hostId,
					path: propertiesFile.path,
					octal,
					recursive
				}
			});
			// Reload directory to see updated permissions
			loadDirectory(getActiveState().currentPath, activePanel);
		}
	};

	const handleCopyPath = (path: string) => {
		vscode.postMessage({
			command: 'COPY_PATH',
			payload: { path }
		});
	};

	const handleCompareFile = (file: FileEntry) => {
		vscode.postMessage({
			command: 'DIFF_FILES',
			payload: { hostId, remotePath: file.path }
		});
	};

	/**
	 * Upload handlers
	 */
	const handleUpload = () => {
		vscode.postMessage({
			command: 'SFTP_UPLOAD',
			payload: { hostId, remotePath: getActiveState().currentPath }
		});
	};

	const handleNewFolder = () => {
		vscode.postMessage({
			command: 'SFTP_MKDIR',
			payload: { hostId, path: getActiveState().currentPath }
		});
	};

	const handleNewFile = () => {
		// Create a new empty file (implementation depends on backend support)
		vscode.postMessage({
			command: 'SFTP_NEW_FILE',
			payload: { hostId, path: getActiveState().currentPath }
		});
	};

	const handleOpenTerminal = () => {
		// Open terminal in current directory
		vscode.postMessage({
			command: 'OPEN_TERMINAL',
			payload: { hostId, path: getActiveState().currentPath }
		});
	};

	/**
	 * Drag & Drop handlers
	 */
	const handleDrop = (files: FileList, targetPath: string) => {
		// Upload dropped files
		// Note: Browser File objects don't expose the path property for security reasons
		// The backend will prompt for file selection instead
		Array.from(files).forEach(file => {
			vscode.postMessage({
				command: 'SFTP_UPLOAD',
				payload: { hostId, remotePath: targetPath }
			});
		});
	};

	const handleInternalDrop = (sourcePaths: string[], targetPath: string, sourcePanel?: 'left' | 'right') => {
		// Handle move/copy between panels or within same panel
		vscode.postMessage({
			command: 'SFTP_MOVE',
			payload: { hostId, sourcePaths, targetPath, sourcePanel }
		});
	};

	/**
	 * View mode handlers
	 */
	const handleSearchChange = (query: string) => {
		setActiveState(prev => ({ ...prev, searchQuery: query }));
	};

	const handleLayoutModeChange = (mode: 'explorer' | 'commander') => {
		setLayoutMode(mode);
		if (mode === 'commander' && rightPanel.files.length === 0) {
			loadDirectory(rightPanel.currentPath, 'right');
		}
	};

	/**
	 * Renders a single panel
	 */
	const renderPanel = (panelId: 'left' | 'right') => {
		const state = panelId === 'left' ? leftPanel : rightPanel;
		const isActive = activePanel === panelId;

		return (
			<div
				className={`file-manager-panel ${isActive ? 'active' : 'inactive'}`}
				onClick={() => setActivePanel(panelId)}
			>
				<FileList
					files={state.files}
					viewMode={viewMode}
					selection={state.selection}
					focusedFile={state.focusedFile}
					searchQuery={state.searchQuery}
					hostId={hostId}
					panelId={panelId}
					onFileSelect={handleFileSelect}
					onFileOpen={handleFileOpen}
					onFileEdit={handleFileEdit}
					onFileDownload={handleFileDownload}
					onFileDelete={handleFileDelete}
					onFileRename={handleFileRename}
					onFileProperties={handleFileProperties}
					onCopyPath={handleCopyPath}
					onCompareFile={handleCompareFile}
					onDrop={handleDrop}
					onInternalDrop={handleInternalDrop}
				/>

				{state.isLoading && (
					<div className="loading-overlay">
						<div className="spinner" />
						<p>Loading...</p>
					</div>
				)}
			</div>
		);
	};

	return (
		<div className="file-manager">
			{/* Toolbar */}
			<Toolbar
				currentPath={getActiveState().currentPath}
				canGoBack={getActiveState().historyIndex > 0}
				canGoForward={getActiveState().historyIndex < getActiveState().history.length - 1}
				viewMode={viewMode}
				layoutMode={layoutMode}
				syncBrowsing={syncBrowsing}
				isLoading={getActiveState().isLoading}
				searchQuery={getActiveState().searchQuery}
				onNavigateHome={handleNavigateHome}
				onNavigateUp={handleNavigateUp}
				onNavigateBack={handleNavigateBack}
				onNavigateForward={handleNavigateForward}
				onRefresh={handleRefresh}
				onUpload={handleUpload}
				onNewFolder={handleNewFolder}
				onNewFile={handleNewFile}
				onOpenTerminal={handleOpenTerminal}
				onViewModeChange={setViewMode}
				onLayoutModeChange={handleLayoutModeChange}
				onSyncBrowsingChange={setSyncBrowsing}
				onSearchChange={handleSearchChange}
				onPathNavigate={navigateToPath}
			/>

			{/* Error Message */}
			{error && (
				<div className="error-message">
					<span className="error-icon">⚠</span>
					{error}
				</div>
			)}

			{/* File Panels */}
			<div className={`file-manager-panels ${layoutMode === 'commander' ? 'commander-mode' : ''}`}>
				{renderPanel('left')}
				{layoutMode === 'commander' && (
					<>
						<div className="panel-divider" />
						{renderPanel('right')}
					</>
				)}
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

			{/* File Properties Dialog */}
			{propertiesFile && (
				<FilePropertiesDialog
					file={propertiesFile}
					hostId={hostId}
					onSave={handleSavePermissions}
					onClose={() => setPropertiesFile(null)}
				/>
			)}
		</div>
	);
};
