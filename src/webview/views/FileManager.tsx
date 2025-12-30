import React, { useState, useEffect, useCallback } from 'react';
import { FileEntry, TransferStatus, Bookmark, DiskSpaceInfo } from '../../common/types';
import { Toolbar } from '../components/FileManager/Toolbar';
import { FileList } from '../components/FileManager/FileList';
import { PanelStatus } from '../components/FileManager/PanelStatus';
import FilePropertiesDialog from '../dialogs/FilePropertiesDialog';
import SearchDialog from '../dialogs/SearchDialog';
import BulkRenameDialog from '../dialogs/BulkRenameDialog';
import { Console } from '../components/FileManager/Console';
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
	fileSystem: 'local' | 'remote';
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
	const [stateLoaded, setStateLoaded] = useState<boolean>(false);
	const [showSearchDialog, setShowSearchDialog] = useState<boolean>(false);
	const [searchResults, setSearchResults] = useState<FileEntry[] | null>(null);
	const [searchQuery, setSearchQuery] = useState<string>('');
	const [consoleVisible, setConsoleVisible] = useState<boolean>(false);
	const [consoleHeight, setConsoleHeight] = useState<number>(200);
	const [compareMode, setCompareMode] = useState<boolean>(false);
	const [showBulkRenameDialog, setShowBulkRenameDialog] = useState<boolean>(false);
	const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
	const [leftDiskSpace, setLeftDiskSpace] = useState<DiskSpaceInfo | null>(null);
	const [rightDiskSpace, setRightDiskSpace] = useState<DiskSpaceInfo | null>(null);
	const [diskSpaceLoading, setDiskSpaceLoading] = useState<boolean>(false);

	// Panel states
	const [leftPanel, setLeftPanel] = useState<PanelState>({
		currentPath: '~',
		files: [],
		history: ['~'],
		historyIndex: 0,
		selection: [],
		focusedFile: null,
		searchQuery: '',
		isLoading: false,
		fileSystem: 'local'
	});

	const [rightPanel, setRightPanel] = useState<PanelState>({
		currentPath: initialPath,
		files: [],
		history: [initialPath],
		historyIndex: 0,
		selection: [],
		focusedFile: null,
		searchQuery: '',
		isLoading: false,
		fileSystem: 'remote'
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
		// First, request saved state
		vscode.postMessage({
			command: 'GET_PANEL_STATE',
			payload: { hostId }
		});
	}, [hostId]);

	// Load directories after state is loaded or if no saved state
	useEffect(() => {
		if (stateLoaded) {
			loadDirectory(leftPanel.currentPath, 'left');
			if (layoutMode === 'commander') {
				loadDirectory(rightPanel.currentPath, 'right');
			}
		}
	}, [stateLoaded]);

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

				case 'PANEL_STATE_RESPONSE': {
					if (message.payload.state) {
						// Hydrate panel states from saved data
						const savedState = message.payload.state;

						setLeftPanel(prev => ({
							...prev,
							currentPath: savedState.left.path,
							fileSystem: savedState.left.system,
							history: [savedState.left.path],
							historyIndex: 0
						}));

						setRightPanel(prev => ({
							...prev,
							currentPath: savedState.right.path,
							fileSystem: savedState.right.system,
							history: [savedState.right.path],
							historyIndex: 0
						}));

						setActivePanel(savedState.active);
						if (savedState.layoutMode) {
							setLayoutMode(savedState.layoutMode);
						}
						if (savedState.viewMode) {
							setViewMode(savedState.viewMode);
						}
					}
					// Mark state as loaded (even if no saved state exists)
					setStateLoaded(true);
					break;
				}

				case 'SEARCH_RESULTS': {
					setSearchResults(message.payload.results);
					setSearchQuery(message.payload.searchQuery);
					break;
				}

				case 'BOOKMARKS_RESPONSE': {
					setBookmarks(message.payload.bookmarks);
					break;
				}

				case 'DISK_SPACE_RESPONSE': {
					const panelId = message.payload.fileSystem === leftPanel.fileSystem ? 'left' : 'right';
					if (panelId === 'left') {
						setLeftDiskSpace(message.payload.diskSpace);
					} else {
						setRightDiskSpace(message.payload.diskSpace);
					}
					setDiskSpaceLoading(false);
					break;
				}

				case 'CHECKSUM_RESULT': {
					const { checksum, algorithm, filename } = message.payload;
					// Create a modal/dialog showing the checksum with copy button
					const result = `${algorithm.toUpperCase()} Checksum for ${filename}:\n\n${checksum}`;

					// Copy to clipboard
					navigator.clipboard.writeText(checksum);

					// Show result (you can replace this with a proper dialog later)
					alert(`${result}\n\n(Checksum copied to clipboard)`);
					break;
				}
			}
		};

		window.addEventListener('message', handleMessage);
		return () => window.removeEventListener('message', handleMessage);
	}, []);

	// Auto-save panel state (debounced)
	useEffect(() => {
		// Only save if state has been loaded (to avoid overwriting with default state)
		if (!stateLoaded) {
			return;
		}

		const timeoutId = setTimeout(() => {
			const state = {
				left: {
					system: leftPanel.fileSystem,
					path: leftPanel.currentPath
				},
				right: {
					system: rightPanel.fileSystem,
					path: rightPanel.currentPath
				},
				active: activePanel,
				layoutMode,
				viewMode
			};

			vscode.postMessage({
				command: 'SAVE_PANEL_STATE',
				payload: { hostId, state }
			});
		}, 500); // Debounce for 500ms

		return () => clearTimeout(timeoutId);
	}, [
		leftPanel.currentPath,
		leftPanel.fileSystem,
		rightPanel.currentPath,
		rightPanel.fileSystem,
		activePanel,
		layoutMode,
		viewMode,
		stateLoaded,
		hostId
	]);

	// Request bookmarks on mount
	useEffect(() => {
		vscode.postMessage({
			command: 'GET_BOOKMARKS',
			payload: { hostId }
		});
	}, [hostId]);

	// Request disk space when path or file system changes
	useEffect(() => {
		if (leftPanel.currentPath) {
			setDiskSpaceLoading(true);
			vscode.postMessage({
				command: 'GET_DISK_SPACE',
				payload: {
					hostId,
					path: leftPanel.currentPath,
					fileSystem: leftPanel.fileSystem
				}
			});
		}
	}, [leftPanel.currentPath, leftPanel.fileSystem, hostId]);

	useEffect(() => {
		if (layoutMode === 'commander' && rightPanel.currentPath) {
			setDiskSpaceLoading(true);
			vscode.postMessage({
				command: 'GET_DISK_SPACE',
				payload: {
					hostId,
					path: rightPanel.currentPath,
					fileSystem: rightPanel.fileSystem
				}
			});
		}
	}, [rightPanel.currentPath, rightPanel.fileSystem, layoutMode, hostId]);

	// Commander hotkeys (Tab, Space, Insert, F-Keys, Clipboard)
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const state = getActiveState();

			// Shift+F2: Toggle directory comparison
			if (e.shiftKey && e.key === 'F2') {
				e.preventDefault();
				setCompareMode(prev => !prev);
				return;
			}

			// F2: Bulk rename (if multiple files selected)
			if (e.key === 'F2' && !e.shiftKey && state.selection.length > 1) {
				e.preventDefault();
				setShowBulkRenameDialog(true);
				return;
			}

			// Ctrl+` or Ctrl+Shift+C: Toggle console
			if ((e.ctrlKey || e.metaKey) && (e.key === '`' || (e.shiftKey && e.key === 'c'))) {
				e.preventDefault();
				setConsoleVisible(prev => !prev);
				return;
			}

			// Ctrl+C: Copy selected files to clipboard
			if ((e.ctrlKey || e.metaKey) && e.key === 'c' && state.selection.length > 0) {
				e.preventDefault();
				const selectedFiles = state.files.filter(f => state.selection.includes(f.path));
				vscode.postMessage({
					command: 'CLIPBOARD_COPY',
					payload: {
						files: selectedFiles,
						sourceHostId: hostId,
						system: state.fileSystem,
						operation: 'copy'
					}
				});
				return;
			}

			// Ctrl+X: Cut selected files to clipboard
			if ((e.ctrlKey || e.metaKey) && e.key === 'x' && state.selection.length > 0) {
				e.preventDefault();
				const selectedFiles = state.files.filter(f => state.selection.includes(f.path));
				vscode.postMessage({
					command: 'CLIPBOARD_COPY',
					payload: {
						files: selectedFiles,
						sourceHostId: hostId,
						system: state.fileSystem,
						operation: 'cut'
					}
				});
				return;
			}

			// Ctrl+V: Paste files from clipboard
			if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
				e.preventDefault();
				vscode.postMessage({
					command: 'CLIPBOARD_PASTE',
					payload: {
						targetPath: state.currentPath,
						targetSystem: state.fileSystem,
						hostId
					}
				});
				return;
			}

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
	 * Directory comparison logic
	 * Returns file differences between left and right panels
	 */
	const getFileDifferences = () => {
		if (!compareMode || layoutMode !== 'commander') {
			return { missing: new Set<string>(), newer: new Set<string>() };
		}

		const leftFiles = new Map(leftPanel.files.map(f => [f.name, f]));
		const rightFiles = new Map(rightPanel.files.map(f => [f.name, f]));

		const missing = new Set<string>();
		const newer = new Set<string>();

		// Check for files in left but not in right
		leftFiles.forEach((file, name) => {
			if (!rightFiles.has(name)) {
				missing.add(file.path);
			} else {
				const rightFile = rightFiles.get(name)!;
				// Compare modification times
				if (file.modTime > rightFile.modTime) {
					newer.add(file.path);
				}
			}
		});

		// Check for files in right but not in left
		rightFiles.forEach((file, name) => {
			if (!leftFiles.has(name)) {
				missing.add(file.path);
			}
		});

		return { missing, newer };
	};

	/**
	 * Select all different files (for syncing)
	 */
	const handleSelectDifferent = () => {
		const { missing, newer } = getFileDifferences();
		const state = getActiveState();

		const differentFiles = state.files
			.filter(f => missing.has(f.path) || newer.has(f.path))
			.map(f => f.path);

		setActiveState(prev => ({
			...prev,
			selection: differentFiles
		}));
	};

	/**
	 * Handle bulk rename
	 */
	const handleBulkRename = (operations: { oldPath: string; newPath: string }[]) => {
		const state = getActiveState();

		vscode.postMessage({
			command: 'BULK_RENAME',
			payload: {
				hostId,
				operations,
				fileSystem: state.fileSystem
			}
		});

		// Clear selection after rename
		setActiveState(prev => ({ ...prev, selection: [], focusedFile: null }));

		// Refresh after a short delay
		setTimeout(() => handleRefresh(), 500);
	};

	/**
	 * Handle console navigation (auto-cd when directory changes)
	 */
	useEffect(() => {
		if (consoleVisible) {
			const state = getActiveState();
			vscode.postMessage({
				command: 'CONSOLE_NAVIGATE',
				payload: {
					hostId,
					path: state.currentPath,
					fileSystem: state.fileSystem
				}
			});
		}
	}, [leftPanel.currentPath, rightPanel.currentPath, activePanel, consoleVisible]);

	/**
	 * Loads a directory listing
	 */
	const loadDirectory = (path: string, panelId: 'left' | 'right' = activePanel, overrideFileSystem?: 'local' | 'remote') => {
		const setState = panelId === 'left' ? setLeftPanel : setRightPanel;
		const panel = panelId === 'left' ? leftPanel : rightPanel;

		setState(prev => ({ ...prev, isLoading: true }));
		setError(null);

		// Use override if provided, otherwise use panel's current fileSystem
		const fileSystem = overrideFileSystem !== undefined ? overrideFileSystem : panel.fileSystem;

		vscode.postMessage({
			command: 'SFTP_LS',
			payload: { hostId, path, panelId, fileSystem }
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
		const state = getActiveState();

		if (file.type === 'd') {
			// Navigate into directory
			navigateToPath(file.path);
		} else {
			// Open file based on file system mode
			if (state.fileSystem === 'local') {
				// Open local file directly in VS Code
				vscode.postMessage({
					command: 'OPEN_LOCAL_FILE',
					payload: { path: file.path }
				});
			} else {
				// Edit remote file (Edit-on-Fly)
				vscode.postMessage({
					command: 'EDIT_FILE',
					payload: { hostId, remotePath: file.path }
				});
			}
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

	const handleOpenInExplorer = (file: FileEntry) => {
		vscode.postMessage({
			command: 'OPEN_IN_EXPLORER',
			payload: { hostId, path: file.path, fileSystem: getActiveState().fileSystem }
		});
	};

	const handleOpenWithDefault = (file: FileEntry) => {
		vscode.postMessage({
			command: 'OPEN_WITH_DEFAULT',
			payload: { hostId, path: file.path, fileSystem: getActiveState().fileSystem }
		});
	};

	const handleCalculateChecksum = (file: FileEntry, algorithm: 'md5' | 'sha1' | 'sha256') => {
		vscode.postMessage({
			command: 'CALCULATE_CHECKSUM',
			payload: { hostId, path: file.path, fileSystem: getActiveState().fileSystem, algorithm }
		});
	};

	const handleCopyPathAdvanced = (file: FileEntry, type: 'name' | 'fullPath' | 'url') => {
		vscode.postMessage({
			command: 'COPY_PATH_ADVANCED',
			payload: { path: file.path, type, hostId }
		});
	};

	const handleCreateSymlink = (file: FileEntry) => {
		const currentPath = getActiveState().currentPath;
		const linkName = prompt(`Enter name for symbolic link to ${file.name}:`, `${file.name}_link`);

		if (linkName) {
			const targetPath = `${currentPath}/${linkName}`;
			vscode.postMessage({
				command: 'CREATE_SYMLINK',
				payload: {
					hostId,
					sourcePath: file.path,
					targetPath,
					fileSystem: getActiveState().fileSystem
				}
			});

			// Refresh after a short delay
			setTimeout(() => handleRefresh(), 500);
		}
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

	const handleInternalDrop = (
		sourcePaths: string[],
		targetPath: string,
		sourcePanel?: 'left' | 'right',
		modifierKey?: 'ctrl' | 'alt' | 'none'
	) => {
		// Determine source and target systems
		const sourcePanelState = sourcePanel === 'left' ? leftPanel : (sourcePanel === 'right' ? rightPanel : getActiveState());
		const sourceSystem = sourcePanelState.fileSystem; // 'local' | 'remote'

		// Determine target panel and system
		// If dropping on the same panel, use the active panel's system
		// Otherwise, determine from the drop target
		let targetSystem: 'local' | 'remote' = getActiveState().fileSystem;

		// Check if we can determine target system from panels
		if (leftPanel.currentPath === targetPath || targetPath.startsWith(leftPanel.currentPath)) {
			targetSystem = leftPanel.fileSystem;
		} else if (rightPanel.currentPath === targetPath || targetPath.startsWith(rightPanel.currentPath)) {
			targetSystem = rightPanel.fileSystem;
		}

		// Determine operation type (copy vs move) based on modifier keys
		// Ctrl/Alt = copy, no modifier = move
		const isCopy = modifierKey === 'ctrl' || modifierKey === 'alt';

		// Universal Transfer Matrix Routing
		if (sourceSystem === 'local' && targetSystem === 'local') {
			// Local -> Local: Fast OS-level operations
			if (isCopy) {
				vscode.postMessage({
					command: 'FS_LOCAL_COPY',
					payload: { sourcePaths, targetPath }
				});
			} else {
				vscode.postMessage({
					command: 'FS_LOCAL_MOVE',
					payload: { sourcePaths, targetPath }
				});
			}
		} else if (sourceSystem === 'remote' && targetSystem === 'remote') {
			// Remote -> Remote: Server-side operations
			if (isCopy) {
				vscode.postMessage({
					command: 'SFTP_REMOTE_COPY',
					payload: { hostId, sourcePaths, targetPath }
				});
			} else {
				vscode.postMessage({
					command: 'SFTP_REMOTE_MOVE',
					payload: { hostId, sourcePaths, targetPath }
				});
			}
		} else if (sourceSystem === 'local' && targetSystem === 'remote') {
			// Local -> Remote: Upload (always copy, files remain local)
			sourcePaths.forEach(localPath => {
				vscode.postMessage({
					command: 'SFTP_UPLOAD',
					payload: { hostId, remotePath: targetPath, localPath, fileSystem: targetSystem }
				});
			});
		} else if (sourceSystem === 'remote' && targetSystem === 'local') {
			// Remote -> Local: Download (always copy, files remain remote)
			sourcePaths.forEach(remotePath => {
				vscode.postMessage({
					command: 'SFTP_DOWNLOAD',
					payload: { hostId, remotePath, localPath: targetPath, fileSystem: targetSystem }
				});
			});
		}

		// Clear selection after operation
		setActiveState(prev => ({ ...prev, selection: [], focusedFile: null }));
	};

	/**
	 * Archive operation handlers
	 */
	const handleArchiveExtract = (file: FileEntry) => {
		const state = getActiveState();
		vscode.postMessage({
			command: 'ARCHIVE_OP',
			payload: {
				operation: 'extract',
				files: [file.path],
				panelId: activePanel,
				hostId,
				fileSystem: state.fileSystem,
				archivePath: file.path
			}
		});
	};

	const handleArchiveCompress = (files: FileEntry[]) => {
		const state = getActiveState();
		vscode.postMessage({
			command: 'ARCHIVE_OP',
			payload: {
				operation: 'compress',
				files: files.map(f => f.path),
				panelId: activePanel,
				hostId,
				fileSystem: state.fileSystem
			}
		});
	};

	/**
	 * Deep search handlers
	 */
	const handleDeepSearch = () => {
		setShowSearchDialog(true);
	};

	const handleSearch = (pattern: string, content: string, recursive: boolean) => {
		const state = getActiveState();
		vscode.postMessage({
			command: 'SEARCH_FILES',
			payload: {
				hostId,
				path: state.currentPath,
				fileSystem: state.fileSystem,
				pattern: pattern || undefined,
				content: content || undefined,
				recursive
			}
		});
	};

	const handleClearSearchResults = () => {
		setSearchResults(null);
		setSearchQuery('');
	};

	/**
	 * Bookmark handlers
	 */
	const handleAddBookmark = (label: string, path: string, system: 'local' | 'remote') => {
		vscode.postMessage({
			command: 'ADD_BOOKMARK',
			payload: {
				bookmark: {
					label,
					path,
					system,
					hostId: system === 'remote' ? hostId : undefined
				}
			}
		});

		// Refresh bookmarks
		setTimeout(() => {
			vscode.postMessage({
				command: 'GET_BOOKMARKS',
				payload: { hostId }
			});
		}, 100);
	};

	const handleRemoveBookmark = (bookmarkId: string) => {
		vscode.postMessage({
			command: 'REMOVE_BOOKMARK',
			payload: { bookmarkId, hostId }
		});

		// Refresh bookmarks
		setTimeout(() => {
			vscode.postMessage({
				command: 'GET_BOOKMARKS',
				payload: { hostId }
			});
		}, 100);
	};

	const handleNavigateToBookmark = (path: string) => {
		navigateToPath(path);
	};

	const handleHistoryNavigate = (index: number) => {
		const state = getActiveState();
		const path = state.history[index];

		setActiveState(prev => ({
			...prev,
			historyIndex: index,
			currentPath: path,
			selection: [],
			focusedFile: null
		}));

		loadDirectory(path);
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
	 * File system mode handler
	 */
	const handleFileSystemChange = (mode: 'local' | 'remote') => {
		const state = getActiveState();

		// Don't switch if already in this mode
		if (state.fileSystem === mode) {
			return;
		}

		setActiveState(prev => {
			const newPath = mode === 'local' ? '~' : (initialPath || '/');
			return {
				...prev,
				fileSystem: mode,
				currentPath: newPath,
				history: [newPath],
				historyIndex: 0,
				files: [],
				selection: [],
				focusedFile: null
			};
		});

		// Load the directory for the new file system
		// Pass the new mode directly to avoid race condition with state updates
		const newPath = mode === 'local' ? '~' : (initialPath || '/');
		loadDirectory(newPath, activePanel, mode);
	};

	/**
	 * Renders a single panel
	 */
	const renderPanel = (panelId: 'left' | 'right') => {
		const state = panelId === 'left' ? leftPanel : rightPanel;
		const isActive = activePanel === panelId;
		const { missing, newer } = getFileDifferences();
		const diskSpace = panelId === 'left' ? leftDiskSpace : rightDiskSpace;
		const selectedFiles = state.files.filter(f => state.selection.includes(f.path));

		return (
			<div
				className={`file-manager-panel ${isActive ? 'active' : 'inactive'} ${compareMode ? 'compare-mode' : ''}`}
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
					fileSystem={state.fileSystem}
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
					onArchiveExtract={handleArchiveExtract}
					onArchiveCompress={handleArchiveCompress}
					onOpenInExplorer={handleOpenInExplorer}
					onOpenWithDefault={handleOpenWithDefault}
					onCalculateChecksum={handleCalculateChecksum}
					onCopyPathAdvanced={handleCopyPathAdvanced}
					onCreateSymlink={handleCreateSymlink}
					compareMode={compareMode}
					missingFiles={missing}
					newerFiles={newer}
				/>

				<PanelStatus
					files={state.files}
					selectedFiles={selectedFiles}
					diskSpace={diskSpace}
					isLoading={diskSpaceLoading}
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
				fileSystem={getActiveState().fileSystem}
				bookmarks={bookmarks}
				history={getActiveState().history}
				historyIndex={getActiveState().historyIndex}
				onNavigateHome={handleNavigateHome}
				onNavigateUp={handleNavigateUp}
				onNavigateBack={handleNavigateBack}
				onNavigateForward={handleNavigateForward}
				onRefresh={handleRefresh}
				onUpload={handleUpload}
				onNewFolder={handleNewFolder}
				onNewFile={handleNewFile}
				onOpenTerminal={handleOpenTerminal}
				onDeepSearch={handleDeepSearch}
				onViewModeChange={setViewMode}
				onLayoutModeChange={handleLayoutModeChange}
				onSyncBrowsingChange={setSyncBrowsing}
				onSearchChange={handleSearchChange}
				onPathNavigate={navigateToPath}
				onFileSystemChange={handleFileSystemChange}
				onAddBookmark={handleAddBookmark}
				onRemoveBookmark={handleRemoveBookmark}
				onNavigateToBookmark={handleNavigateToBookmark}
				onHistoryNavigate={handleHistoryNavigate}
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

			{/* Search Results Panel */}
			{searchResults && (
				<div className="search-results-panel">
					<div className="search-results-header">
						<h3>Search Results: {searchQuery}</h3>
						<button className="vscode-button secondary" onClick={handleClearSearchResults}>
							Clear Results
						</button>
					</div>
					<div className="search-results-list">
						{searchResults.length === 0 ? (
							<p style={{ padding: '20px', textAlign: 'center', color: 'var(--vscode-descriptionForeground)' }}>
								No files found matching your search criteria.
							</p>
						) : (
							searchResults.map((file, index) => (
								<div
									key={index}
									className="search-result-item"
									onClick={() => {
										// Navigate to the directory containing the file
										const dirPath = file.path.substring(0, file.path.lastIndexOf('/'));
										navigateToPath(dirPath || '/');
										handleClearSearchResults();
									}}
									style={{
										padding: '8px 12px',
										cursor: 'pointer',
										borderBottom: '1px solid var(--vscode-panel-border)'
									}}
								>
									<div style={{ fontWeight: 500 }}>{file.name}</div>
									<div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)' }}>
										{file.path}
									</div>
								</div>
							))
						)}
					</div>
				</div>
			)}

			{/* File Properties Dialog */}
			{propertiesFile && (
				<FilePropertiesDialog
					file={propertiesFile}
					hostId={hostId}
					fileSystem={getActiveState().fileSystem}
					onSave={handleSavePermissions}
					onClose={() => setPropertiesFile(null)}
				/>
			)}

			{/* Search Dialog */}
			{showSearchDialog && (
				<SearchDialog
					onSearch={handleSearch}
					onClose={() => setShowSearchDialog(false)}
				/>
			)}

			{/* Bulk Rename Dialog */}
			{showBulkRenameDialog && (
				<BulkRenameDialog
					files={getActiveState().files.filter(f => getActiveState().selection.includes(f.path))}
					onRename={handleBulkRename}
					onClose={() => setShowBulkRenameDialog(false)}
				/>
			)}

			{/* Integrated Console */}
			<Console
				hostId={hostId}
				visible={consoleVisible}
				height={consoleHeight}
				onHeightChange={setConsoleHeight}
				onToggle={() => setConsoleVisible(false)}
			/>
		</div>
	);
};
