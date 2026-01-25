import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
	Download,
	Trash2,
	Edit,
	Info,
	Copy,
	GitCompare,
	FileEdit,
	ArrowRight,
	Archive,
	FolderArchive,
	ExternalLink,
	Hash,
	Link2,
	FolderOpen,
	CornerLeftUp,
	RefreshCw
} from 'lucide-react';
import { FileEntry } from '../../../common/types';
import { FileIcon } from '../FileIcon';
import { ContextMenu, ContextMenuItem } from '../ContextMenu';

interface FileListProps {
	files: FileEntry[];
	viewMode: 'list' | 'grid';
	selection: string[];
	focusedFile: string | null;
	searchQuery: string;
	hostId: string;
	panelId?: 'left' | 'right';
	fileSystem?: 'local' | 'remote';
	currentPath?: string;
	onFileSelect: (filePath: string, ctrlKey: boolean, shiftKey: boolean) => void;
	onFileOpen: (file: FileEntry) => void;
	onFileEdit: (file: FileEntry) => void;
	onFileDownload: (file: FileEntry) => void;
	onFileDelete: (files: FileEntry[]) => void;
	onFileRename: (file: FileEntry) => void;
	onFileProperties: (file: FileEntry) => void;
	onCopyPath: (path: string) => void;
	onCompareFile: (file: FileEntry) => void;
	onDrop?: (files: FileList, targetPath: string) => void;
	onInternalDrop?: (sourcePaths: string[], targetPath: string, sourcePanel?: 'left' | 'right', targetPanel?: 'left' | 'right') => void;
	onArchiveExtract?: (file: FileEntry) => void;
	onArchiveCompress?: (files: FileEntry[]) => void;
	onOpenInExplorer?: (file: FileEntry) => void;
	onOpenWithDefault?: (file: FileEntry) => void;
	onCalculateChecksum?: (file: FileEntry, algorithm: 'md5' | 'sha1' | 'sha256') => void;
	onCopyPathAdvanced?: (file: FileEntry, type: 'name' | 'fullPath' | 'url') => void;
	onCreateSymlink?: (file: FileEntry) => void;
	onNavigateUp?: () => void;
	onNewFile?: () => void;
	onNewFolder?: () => void;
	onRefresh?: () => void;
	compareMode?: boolean;
	missingFiles?: Set<string>;
	newerFiles?: Set<string>;
}

/**
 * FileList Component
 * Displays files in either list or grid view with full interaction support
 */
export const FileList: React.FC<FileListProps> = ({
	files,
	viewMode,
	selection,
	focusedFile,
	searchQuery,
	hostId,
	compareMode = false,
	missingFiles = new Set(),
	newerFiles = new Set(),
	panelId,
	fileSystem = 'remote',
	currentPath,
	onFileSelect,
	onFileOpen,
	onFileEdit,
	onFileDownload,
	onFileDelete,
	onFileRename,
	onFileProperties,
	onCopyPath,
	onCompareFile,
	onDrop,
	onInternalDrop,
	onArchiveExtract,
	onArchiveCompress,
	onOpenInExplorer,
	onOpenWithDefault,
	onCalculateChecksum,
	onCopyPathAdvanced,
	onCreateSymlink,
	onNavigateUp,
	onNewFile,
	onNewFolder,
	onRefresh
}) => {
	const [contextMenu, setContextMenu] = useState<{
		x: number;
		y: number;
		file: FileEntry | null;
		isBackground?: boolean;
	} | null>(null);
	const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
	const [dragOver, setDragOver] = useState(false);
	const [dragging, setDragging] = useState(false);
	const [scrollTop, setScrollTop] = useState(0);
	const [ignorePatterns, setIgnorePatterns] = useState<string[]>(['.git', '.DS_Store', 'node_modules', 'Thumbs.db']);
	const listRef = useRef<HTMLDivElement>(null);
	const bodyRef = useRef<HTMLDivElement>(null);
	const lastSelectedIndex = useRef<number>(-1);
	// Rubberband selection state (Req #13)
	const [isSelecting, setIsSelecting] = useState(false);
	const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
	const [selectionCurrent, setSelectionCurrent] = useState<{ x: number; y: number } | null>(null);
	const [selectionModifier, setSelectionModifier] = useState<'none' | 'ctrl' | 'shift'>('none');

	// Virtual scrolling constants
	const ITEM_HEIGHT = 32; // Height of each row in pixels
	const BUFFER_SIZE = 10; // Number of extra items to render above/below viewport
	const VIRTUAL_THRESHOLD = 1000; // Enable virtual scrolling for files > 1000

	// Listen for config updates
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data;
			if (message.command === 'UPDATE_CONFIG' && message.payload?.ignorePatterns) {
				setIgnorePatterns(message.payload.ignorePatterns);
			}
		};

		window.addEventListener('message', handleMessage);
		return () => window.removeEventListener('message', handleMessage);
	}, []);

	// Check if a file should be ignored
	const isFileIgnored = (fileName: string): boolean => {
		return ignorePatterns.some(pattern => {
			// Simple glob matching - exact match or ends with for extensions
			if (pattern.startsWith('*')) {
				return fileName.endsWith(pattern.slice(1));
			}
			return fileName === pattern || fileName.startsWith(pattern + '/');
		});
	};

	// Filter files based on search query
	const filteredFiles = searchQuery
		? files.filter(f =>
			f.name.toLowerCase().includes(searchQuery.toLowerCase())
		)
		: files;

	// Check if we should show the "..." (previous folder) item
	const isAtRoot = !currentPath || currentPath === '/' || currentPath === '~';
	const showPreviousFolderItem = !isAtRoot && onNavigateUp;

	// Virtual scrolling calculations
	const useVirtualScrolling = viewMode === 'list' && filteredFiles.length > VIRTUAL_THRESHOLD;
	const containerHeight = listRef.current?.clientHeight || 600;
	const visibleCount = Math.ceil(containerHeight / ITEM_HEIGHT);
	const startIndex = useVirtualScrolling ? Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER_SIZE) : 0;
	const endIndex = useVirtualScrolling ? Math.min(filteredFiles.length, startIndex + visibleCount + 2 * BUFFER_SIZE) : filteredFiles.length;
	const visibleFiles = useVirtualScrolling ? filteredFiles.slice(startIndex, endIndex) : filteredFiles;
	const totalHeight = useVirtualScrolling ? filteredFiles.length * ITEM_HEIGHT : 0;
	const offsetY = useVirtualScrolling ? startIndex * ITEM_HEIGHT : 0;

	// Handle scroll for virtual scrolling
	const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
		if (useVirtualScrolling) {
			const target = e.target as HTMLDivElement;
			setScrollTop(target.scrollTop);
		}
	}, [useVirtualScrolling]);

	/**
	 * Handles file click with modifier keys
	 */
	const handleFileClick = (file: FileEntry, event: React.MouseEvent) => {
		event.stopPropagation();
		onFileSelect(file.path, event.ctrlKey || event.metaKey, event.shiftKey);
	};

	/**
	 * Handles file double-click
	 */
	const handleFileDoubleClick = (file: FileEntry, event: React.MouseEvent) => {
		event.stopPropagation();

		// For symlinks, resolve and navigate to target
		if (file.type === 'l' && file.symlinkTarget) {
			// @ts-ignore - vscode is available in webview context
			vscode.postMessage({
				command: 'RESOLVE_SYMLINK',
				payload: {
					hostId,
					symlinkPath: file.path,
					panelId
				}
			});
			return;
		}

		onFileOpen(file);
	};

	/**
	 * Handles keyboard navigation
	 * Enhanced to support Shift+Arrow multi-selection (Subphase 5.6 Req #1)
	 */
	const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
		if (filteredFiles.length === 0) {return;}

		const currentIndex = focusedFile
			? filteredFiles.findIndex(f => f.path === focusedFile)
			: 0;

		let newIndex = currentIndex;

		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				newIndex = Math.min(currentIndex + 1, filteredFiles.length - 1);
				break;
			case 'ArrowUp':
				event.preventDefault();
				newIndex = Math.max(currentIndex - 1, 0);
				break;
			case 'Enter':
				event.preventDefault();
				if (currentIndex >= 0 && currentIndex < filteredFiles.length) {
					onFileOpen(filteredFiles[currentIndex]);
				}
				break;
			case 'Backspace':
				event.preventDefault();
				if (onNavigateUp) {
					onNavigateUp();
				}
				break;
			case 'Delete':
				event.preventDefault();
				const selectedFiles = filteredFiles.filter(f => selection.includes(f.path));
				if (selectedFiles.length > 0) {
					onFileDelete(selectedFiles);
				}
				break;
			case 'F2':
				event.preventDefault();
				if (selection.length === 1) {
					const file = filteredFiles.find(f => f.path === selection[0]);
					if (file) {
						onFileRename(file);
					}
				}
				break;
			case 'a':
			case 'A':
				// Ctrl+A: Select all (skip "..." fake folder)
				if (event.ctrlKey || event.metaKey) {
					event.preventDefault();
					// Select first file without ctrl, then add rest with ctrl
					if (filteredFiles.length > 0) {
						onFileSelect(filteredFiles[0].path, false, false);
						for (let i = 1; i < filteredFiles.length; i++) {
							onFileSelect(filteredFiles[i].path, true, false);
						}
					}
				}
				break;
			default:
				return;
		}

		// Handle navigation with Shift+Arrow for multi-selection (Req #1)
		if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && newIndex !== currentIndex && newIndex >= 0 && newIndex < filteredFiles.length) {
			// Use shiftKey for multi-selection (emulates rubberband with keyboard)
			onFileSelect(filteredFiles[newIndex].path, event.ctrlKey || event.metaKey, event.shiftKey);
		}
	}, [filteredFiles, focusedFile, selection, onFileSelect, onFileOpen, onFileDelete, onFileRename, onNavigateUp]);

	/**
	 * Handles context menu
	 */
	const handleContextMenu = (event: React.MouseEvent, file: FileEntry) => {
		event.preventDefault();
		event.stopPropagation();

		// If right-clicking on a non-selected file, select only that file
		if (!selection.includes(file.path)) {
			onFileSelect(file.path, false, false);
		}

		setContextMenu({
			x: event.clientX,
			y: event.clientY,
			file
		});
	};

	/**
	 * Closes context menu
	 */
	const closeContextMenu = useCallback(() => {
		setContextMenu(null);
		setActiveSubmenu(null);
	}, []);

	/**
	 * Handles click on empty space (Req #14)
	 */
	const handleEmptySpaceClick = (e: React.MouseEvent) => {
		// Only deselect if clicking directly on the container background
		if (e.target === e.currentTarget) {
			onFileSelect('', false, false); // Clear selection
		}
	};

	/**
	 * Handles context menu on empty space (Req #15)
	 */
	const handleEmptySpaceContextMenu = (e: React.MouseEvent) => {
		// Check if right-clicking on empty space
		if (e.target === e.currentTarget) {
			e.preventDefault();
			e.stopPropagation();

			// Show background context menu at cursor position
			setContextMenu({
				x: e.clientX,
				y: e.clientY,
				file: null,
				isBackground: true
			});
		}
	};

	// Close context menu on click outside
	useEffect(() => {
		const handleClick = () => closeContextMenu();
		document.addEventListener('click', handleClick);
		return () => document.removeEventListener('click', handleClick);
	}, [closeContextMenu]);

	/**
	 * Handles drag start (internal drag)
	 */
	const handleDragStart = (event: React.DragEvent, file: FileEntry) => {
		setDragging(true);

		// Set drag data for internal drops
		const draggedPaths = selection.includes(file.path)
			? selection
			: [file.path];

		event.dataTransfer.effectAllowed = 'copyMove';
		event.dataTransfer.setData('application/x-labonair-files', JSON.stringify({
			paths: draggedPaths,
			panelId
		}));
		event.dataTransfer.setData('text/plain', draggedPaths.join('\n'));
	};

	/**
	 * Handles drag end
	 */
	const handleDragEnd = () => {
		setDragging(false);
		setDragOver(false);
	};

	/**
	 * Handles drag over
	 */
	const handleDragOver = (event: React.DragEvent) => {
		event.preventDefault();
		event.stopPropagation();
		setDragOver(true);
		event.dataTransfer.dropEffect = 'copy';
	};

	/**
	 * Handles drag leave
	 */
	const handleDragLeave = (event: React.DragEvent) => {
		event.preventDefault();
		if (event.currentTarget === event.target) {
			setDragOver(false);
		}
	};

	/**
	 * Handles drop (Req #9: Fix Cross-Panel Drag & Drop)
	 * Explicitly uses panelId prop to differentiate Local->Remote vs within-panel moves
	 */
	const handleDrop = (event: React.DragEvent) => {
		event.preventDefault();
		event.stopPropagation();
		setDragOver(false);

		// Check if it's an internal drop
		const internalData = event.dataTransfer.getData('application/x-labonair-files');
		if (internalData && onInternalDrop) {
			try {
				const { paths, panelId: sourcePanel } = JSON.parse(internalData);
				// Get current directory path (parent of files)
				const targetPath = files.length > 0
					? files[0].path.split('/').slice(0, -1).join('/') || '/'
					: '/';
				// Pass both source and target panel IDs to handler
				// This ensures cross-panel detection works properly
				onInternalDrop(paths, targetPath, sourcePanel, panelId);
			} catch (error) {
				console.error('Failed to parse internal drag data:', error);
			}
			return;
		}

		// External file drop
		if (event.dataTransfer.files && event.dataTransfer.files.length > 0 && onDrop) {
			const targetPath = files.length > 0
				? files[0].path.split('/').slice(0, -1).join('/') || '/'
				: '/';
			onDrop(event.dataTransfer.files, targetPath);
		}
	};

	/**
	 * Rubberband Selection Handlers (Req #13)
	 */

	// Smart hit-testing: Check if click is on empty space vs file item
	const isClickOnEmptySpace = (event: React.MouseEvent): boolean => {
		const target = event.target as HTMLElement;
		// Check if clicked directly on container or list background (not on a file item)
		return target.classList.contains('file-list-container') ||
			target.classList.contains('file-list-body') ||
			target.classList.contains('file-grid') ||
			target.classList.contains('file-list-table');
	};

	const handleContainerMouseDown = (event: React.MouseEvent) => {
		// Only start selection on left click on empty space
		if (event.button !== 0) return;
		if (!isClickOnEmptySpace(event)) return;

		event.preventDefault();
		const rect = listRef.current?.getBoundingClientRect();
		if (!rect) return;

		setIsSelecting(true);
		setSelectionStart({ x: event.clientX - rect.left, y: event.clientY - rect.top });
		setSelectionCurrent({ x: event.clientX - rect.left, y: event.clientY - rect.top });

		// Track modifier keys
		if (event.ctrlKey || event.metaKey) {
			setSelectionModifier('ctrl');
		} else if (event.shiftKey) {
			setSelectionModifier('shift');
		} else {
			setSelectionModifier('none');
		}
	};

	const handleGlobalMouseMove = useCallback((event: MouseEvent) => {
		if (!isSelecting || !selectionStart || !listRef.current) return;

		const rect = listRef.current.getBoundingClientRect();
		setSelectionCurrent({
			x: event.clientX - rect.left,
			y: event.clientY - rect.top
		});
	}, [isSelecting, selectionStart]);

	const handleGlobalMouseUp = useCallback(() => {
		if (!isSelecting || !selectionStart || !selectionCurrent) {
			setIsSelecting(false);
			return;
		}

		// Calculate selection box bounds
		const left = Math.min(selectionStart.x, selectionCurrent.x);
		const right = Math.max(selectionStart.x, selectionCurrent.x);
		const top = Math.min(selectionStart.y, selectionCurrent.y);
		const bottom = Math.max(selectionStart.y, selectionCurrent.y);

		// Find intersecting files
		const selectedPaths: string[] = [];
		filteredFiles.forEach((file) => {
			const fileElement = document.querySelector(`[data-file-path="${CSS.escape(file.path)}"]`);
			if (!fileElement) return;

			const fileRect = fileElement.getBoundingClientRect();
			const containerRect = listRef.current?.getBoundingClientRect();
			if (!containerRect) return;

			// Convert to container-relative coordinates
			const fileLeft = fileRect.left - containerRect.left;
			const fileRight = fileRect.right - containerRect.left;
			const fileTop = fileRect.top - containerRect.top;
			const fileBottom = fileRect.bottom - containerRect.top;

			// Check intersection
			const intersects = !(
				fileRight < left ||
				fileLeft > right ||
				fileBottom < top ||
				fileTop > bottom
			);

			if (intersects) {
				selectedPaths.push(file.path);
			}
		});

		// Update selection based on modifier
		if (selectedPaths.length > 0) {
			if (selectionModifier === 'ctrl') {
				// Toggle selection of intersecting items
				selectedPaths.forEach(path => {
					onFileSelect(path, true, false);
				});
			} else if (selectionModifier === 'shift') {
				// Add to selection
				selectedPaths.forEach(path => {
					if (!selection.includes(path)) {
						onFileSelect(path, true, false);
					}
				});
			} else {
				// Replace selection - select first item without ctrl, then add rest with ctrl
				if (selectedPaths.length > 0) {
					onFileSelect(selectedPaths[0], false, false);
					for (let i = 1; i < selectedPaths.length; i++) {
						onFileSelect(selectedPaths[i], true, false);
					}
				}
			}

			// Focus sync (Subphase 5.6 Req #1): Focus the last selected item
			// This ensures keyboard navigation continues from the rubberband selection
			const lastSelectedPath = selectedPaths[selectedPaths.length - 1];
			const lastSelectedElement = document.querySelector(`[data-file-path="${CSS.escape(lastSelectedPath)}"]`) as HTMLElement;
			if (lastSelectedElement) {
				lastSelectedElement.focus();
			}
		}

		// Reset selection state
		setIsSelecting(false);
		setSelectionStart(null);
		setSelectionCurrent(null);
		setSelectionModifier('none');
	}, [isSelecting, selectionStart, selectionCurrent, selectionModifier, filteredFiles, selection, onFileSelect]);

	// Attach global mouse event listeners for rubberband selection
	useEffect(() => {
		if (isSelecting) {
			document.addEventListener('mousemove', handleGlobalMouseMove);
			document.addEventListener('mouseup', handleGlobalMouseUp);
			return () => {
				document.removeEventListener('mousemove', handleGlobalMouseMove);
				document.removeEventListener('mouseup', handleGlobalMouseUp);
			};
		}
	}, [isSelecting, handleGlobalMouseMove, handleGlobalMouseUp]);

	// Reset drag over state when drag ends globally (safety mechanism)
	useEffect(() => {
		const handleGlobalDragEnd = () => {
			setDragOver(false);
			setDragging(false);
		};

		const handleGlobalDrop = () => {
			setDragOver(false);
		};

		document.addEventListener('dragend', handleGlobalDragEnd);
		document.addEventListener('drop', handleGlobalDrop);

		return () => {
			document.removeEventListener('dragend', handleGlobalDragEnd);
			document.removeEventListener('drop', handleGlobalDrop);
		};
	}, []);

	// Render selection box
	const renderSelectionBox = () => {
		if (!isSelecting || !selectionStart || !selectionCurrent) return null;

		const left = Math.min(selectionStart.x, selectionCurrent.x);
		const top = Math.min(selectionStart.y, selectionCurrent.y);
		const width = Math.abs(selectionCurrent.x - selectionStart.x);
		const height = Math.abs(selectionCurrent.y - selectionStart.y);

		return (
			<div
				className="selection-box"
				style={{
					position: 'absolute',
					left: `${left}px`,
					top: `${top}px`,
					width: `${width}px`,
					height: `${height}px`,
					pointerEvents: 'none',
					zIndex: 1000
				}}
			/>
		);
	};

	/**
	 * Formats file size
	 */
	const formatSize = (bytes: number): string => {
		if (bytes === 0) {return '0 B';}
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
		const now = new Date();
		const diffMs = now.getTime() - d.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffDays === 0) {
			return `Today ${d.toLocaleTimeString()}`;
		} else if (diffDays === 1) {
			return `Yesterday ${d.toLocaleTimeString()}`;
		} else if (diffDays < 7) {
			return `${diffDays} days ago`;
		} else {
			return d.toLocaleDateString();
		}
	};

	/**
	 * Renders List View
	 */
	const renderListView = () => (
		<div className="file-list-table" onScroll={handleScroll}>
			<div className="file-list-header">
				<div className="col-name">Name</div>
				<div className="col-size">Size</div>
				<div className="col-modified">Modified</div>
				<div className="col-permissions">Permissions</div>
				<div className="col-owner">Owner</div>
			</div>
			<div
				className="file-list-body"
				ref={bodyRef}
				style={useVirtualScrolling ? { height: totalHeight, position: 'relative' } : undefined}
			>
				{useVirtualScrolling && <div style={{ height: offsetY }} />}

				{/* Virtual "Previous Folder" Row (Req #7) */}
				{/* Not selectable for Delete/Move operations */}
				{showPreviousFolderItem && (
					<div
						key="virtual-parent-folder"
						className="file-list-row file-list-row-parent"
						onClick={(e) => {
							e.stopPropagation();
							// Don't allow selection of parent folder item
						}}
						onDoubleClick={(e) => {
							e.stopPropagation();
							onNavigateUp?.();
						}}
						onKeyDown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								e.stopPropagation();
								onNavigateUp?.();
							}
						}}
						onContextMenu={(e) => {
							e.preventDefault();
							e.stopPropagation();
							// Don't show context menu on parent folder item
						}}
						tabIndex={0}
						role="button"
						title="Previous Folder (Double-click to navigate up)"
						style={{ opacity: 0.7, cursor: 'pointer' }}
					>
						<div className="col-name">
							<div style={{ position: 'relative', display: 'inline-block' }}>
								<CornerLeftUp size={18} />
							</div>
							<span className="file-name">...</span>
						</div>
						<div className="col-size">—</div>
						<div className="col-modified">—</div>
						<div className="col-permissions">—</div>
						<div className="col-owner">—</div>
					</div>
				)}

				{visibleFiles.map((file, index) => {
					const ignored = isFileIgnored(file.name);
					return (
					<div
						key={file.path}
						data-file-path={file.path}
						className={`file-list-row ${selection.includes(file.path) ? 'selected' : ''} ${focusedFile === file.path ? 'focused' : ''} ${compareMode && missingFiles.has(file.path) ? 'compare-missing' : ''} ${compareMode && newerFiles.has(file.path) ? 'compare-newer' : ''}`}
						onClick={(e) => handleFileClick(file, e)}
						onDoubleClick={(e) => handleFileDoubleClick(file, e)}
						onContextMenu={(e) => handleContextMenu(e, file)}
						draggable
						onDragStart={(e) => handleDragStart(e, file)}
						onDragEnd={handleDragEnd}
						tabIndex={0}
						role="button"
						aria-selected={selection.includes(file.path)}
						style={ignored ? { opacity: 0.5, filter: 'grayscale(1)' } : undefined}
					>
						<div className="col-name">
							<div style={{ position: 'relative', display: 'inline-block' }}>
								<FileIcon file={file} size={18} />
								{file.type === 'l' && (
									<ArrowRight size={10} style={{
										position: 'absolute',
										bottom: 0,
										right: -2,
										backgroundColor: 'var(--vscode-editor-background)',
										borderRadius: '2px'
									}} />
								)}
							</div>
							<span className="file-name" style={file.type === 'l' ? { fontStyle: 'italic' } : undefined}>
								{file.name}
								{file.type === 'l' && file.symlinkTarget && (
									<span className="symlink-target"> → {file.symlinkTarget}</span>
								)}
							</span>
						</div>
						<div className="col-size">
							{file.type !== 'd' ? formatSize(file.size) : '—'}
						</div>
						<div className="col-modified">
							{formatDate(file.modTime)}
						</div>
						<div className="col-permissions">
							{file.permissions}
						</div>
						<div className="col-owner">
							{file.owner || '—'}
						</div>
					</div>
					);
				})}
			</div>
		</div>
	);

	/**
	 * Renders Grid View
	 */
	const renderGridView = () => (
		<div className="file-grid">
			{/* Virtual "Previous Folder" Item (Req #7) */}
			{/* Not selectable for Delete/Move operations */}
			{showPreviousFolderItem && (
				<div
					key="virtual-parent-folder"
					className="file-grid-item file-grid-item-parent"
					onClick={(e) => {
						e.stopPropagation();
						// Don't allow selection of parent folder item
					}}
					onDoubleClick={(e) => {
						e.stopPropagation();
						onNavigateUp?.();
					}}
					onKeyDown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							e.stopPropagation();
							onNavigateUp?.();
						}
					}}
					onContextMenu={(e) => {
						e.preventDefault();
						e.stopPropagation();
						// Don't show context menu on parent folder item
					}}
					tabIndex={0}
					role="button"
					title="Previous Folder (Double-click to navigate up)"
					style={{ opacity: 0.7, cursor: 'pointer' }}
				>
					<div className="file-grid-icon">
						<CornerLeftUp size={48} />
					</div>
					<div className="file-grid-name">...</div>
				</div>
			)}

			{filteredFiles.map((file) => {
				const ignored = isFileIgnored(file.name);
				return (
				<div
					key={file.path}
					data-file-path={file.path}
					className={`file-grid-item ${selection.includes(file.path) ? 'selected' : ''} ${focusedFile === file.path ? 'focused' : ''} ${compareMode && missingFiles.has(file.path) ? 'compare-missing' : ''} ${compareMode && newerFiles.has(file.path) ? 'compare-newer' : ''}`}
					onClick={(e) => handleFileClick(file, e)}
					onDoubleClick={(e) => handleFileDoubleClick(file, e)}
					onContextMenu={(e) => handleContextMenu(e, file)}
					draggable
					onDragStart={(e) => handleDragStart(e, file)}
					onDragEnd={handleDragEnd}
					tabIndex={0}
					role="button"
					aria-selected={selection.includes(file.path)}
					style={ignored ? { opacity: 0.5, filter: 'grayscale(1)' } : undefined}
				>
					<div className="file-grid-icon" style={{ position: 'relative' }}>
						<FileIcon file={file} size={48} />
						{file.type === 'l' && (
							<ArrowRight size={16} style={{
								position: 'absolute',
								bottom: 4,
								right: 4,
								backgroundColor: 'var(--vscode-editor-background)',
								borderRadius: '2px'
							}} />
						)}
					</div>
					<div className="file-grid-name" title={file.name} style={file.type === 'l' ? { fontStyle: 'italic' } : undefined}>
						{file.name}
					</div>
					{file.type !== 'd' && (
						<div className="file-grid-size">
							{formatSize(file.size)}
						</div>
					)}
				</div>
				);
			})}
		</div>
	);

	/**
	 * Renders Context Menu using ContextMenu component
	 * Supports both background and file context menus (Req #15)
	 */
	const renderContextMenu = () => {
		if (!contextMenu) {return null;}

		const { x, y, file, isBackground } = contextMenu;

		// Build context menu items
		const menuItems: ContextMenuItem[] = [];

		// Background context menu (Req #15: Empty space context menu)
		if (isBackground || !file) {
			if (onNewFile) {
				menuItems.push({
					label: 'New File',
					icon: FileEdit,
					action: () => onNewFile()
				});
			}
			if (onNewFolder) {
				menuItems.push({
					label: 'New Folder',
					icon: FolderOpen,
					action: () => onNewFolder()
				});
			}
			if ((onNewFile || onNewFolder) && onRefresh) {
				menuItems.push({ label: '', separator: true, action: () => {} });
			}
			if (onRefresh) {
				menuItems.push({
					label: 'Refresh',
					icon: RefreshCw,
					action: () => onRefresh()
				});
			}
			if (currentPath) {
				menuItems.push({ label: '', separator: true, action: () => {} });
				menuItems.push({
					label: 'Copy Path',
					icon: Copy,
					action: () => onCopyPath(currentPath)
				});
			}

			return <ContextMenu x={x} y={y} items={menuItems} onClose={closeContextMenu} />;
		}

		// File context menu
		const selectedFiles = filteredFiles.filter(f => selection.includes(f.path));
		const isMultiSelect = selectedFiles.length > 1;
		const isArchive = file.type === '-' && /\.(zip|tar|gz|tgz)$/i.test(file.name);

		// File-specific actions
		if (file.type !== 'd') {
			menuItems.push(
				{
					label: 'Edit',
					icon: FileEdit,
					action: () => onFileEdit(file)
				},
				{
					label: 'Download',
					icon: Download,
					action: () => onFileDownload(file)
				},
				{
					label: 'Compare with...',
					icon: GitCompare,
					action: () => onCompareFile(file)
				},
				{ label: '', separator: true, action: () => {} }
			);
		}

		// Open With actions
		if (onOpenInExplorer) {
			menuItems.push({
				label: 'Open in System Explorer',
				icon: ExternalLink,
				action: () => onOpenInExplorer(file)
			});
		}
		if (onOpenWithDefault && file.type !== 'd') {
			menuItems.push({
				label: 'Open with System Default',
				icon: ExternalLink,
				action: () => onOpenWithDefault(file)
			});
		}
		if (onOpenInExplorer || onOpenWithDefault) {
			menuItems.push({ label: '', separator: true, action: () => {} });
		}

		// Archive operations
		if (isArchive && onArchiveExtract) {
			menuItems.push(
				{
					label: 'Extract Here...',
					icon: Archive,
					action: () => onArchiveExtract(file)
				},
				{ label: '', separator: true, action: () => {} }
			);
		}
		if (selectedFiles.length > 0 && onArchiveCompress) {
			menuItems.push(
				{
					label: 'Compress to...',
					icon: FolderArchive,
					action: () => onArchiveCompress(selectedFiles)
				},
				{ label: '', separator: true, action: () => {} }
			);
		}

		// Rename
		menuItems.push({
			label: 'Rename',
			icon: Edit,
			action: () => onFileRename(file),
			disabled: isMultiSelect
		});

		// Copy Path (simple version)
		menuItems.push({
			label: 'Copy Path',
			icon: Copy,
			action: () => onCopyPath(file.path)
		});

		// Properties
		menuItems.push({
			label: 'Properties',
			icon: Info,
			action: () => onFileProperties(file),
			disabled: isMultiSelect
		});

		// Create Link
		if (onCreateSymlink && !isMultiSelect) {
			menuItems.push({
				label: 'Create Link',
				icon: Link2,
				action: () => onCreateSymlink(file)
			});
		}

		// Delete
		menuItems.push(
			{ label: '', separator: true, action: () => {} },
			{
				label: `Delete${isMultiSelect ? ` (${selectedFiles.length})` : ''}`,
				icon: Trash2,
				action: () => onFileDelete(selectedFiles),
				danger: true
			}
		);

		return <ContextMenu x={x} y={y} items={menuItems} onClose={closeContextMenu} />;
	};

	return (
		<div
			ref={listRef}
			className={`file-list-container ${dragOver ? 'drag-over' : ''} ${dragging ? 'dragging' : ''}`}
			onKeyDown={handleKeyDown}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
			onClick={handleEmptySpaceClick}
			onContextMenu={handleEmptySpaceContextMenu}
			onMouseDown={handleContainerMouseDown}
			tabIndex={0}
			style={{ position: 'relative' }}
		>
			{filteredFiles.length === 0 ? (
				<>
					{showPreviousFolderItem && (
						viewMode === 'list' ? (
							<div className="file-list-table">
								<div className="file-list-header">
									<div className="col-name">Name</div>
									<div className="col-size">Size</div>
									<div className="col-modified">Modified</div>
									<div className="col-permissions">Permissions</div>
									<div className="col-owner">Owner</div>
								</div>
								<div className="file-list-body">
									<div
										key="virtual-parent-folder"
										className="file-list-row file-list-row-parent"
										onClick={(e) => {
											e.stopPropagation();
											// Don't allow selection of parent folder item
										}}
										onDoubleClick={(e) => {
											e.stopPropagation();
											onNavigateUp?.();
										}}
										onKeyDown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault();
												e.stopPropagation();
												onNavigateUp?.();
											}
										}}
										onContextMenu={(e) => {
											e.preventDefault();
											e.stopPropagation();
											// Don't show context menu on parent folder item
										}}
										tabIndex={0}
										role="button"
										title="Previous Folder (Double-click to navigate up)"
										style={{ opacity: 0.7, cursor: 'pointer' }}
									>
										<div className="col-name">
											<div style={{ position: 'relative', display: 'inline-block' }}>
												<CornerLeftUp size={18} />
											</div>
											<span className="file-name">...</span>
										</div>
										<div className="col-size">—</div>
										<div className="col-modified">—</div>
										<div className="col-permissions">—</div>
										<div className="col-owner">—</div>
									</div>
								</div>
							</div>
						) : (
							<div className="file-grid">
								<div
									key="virtual-parent-folder"
									className="file-grid-item file-grid-item-parent"
									onClick={(e) => {
										e.stopPropagation();
										// Don't allow selection of parent folder item
									}}
									onDoubleClick={(e) => {
										e.stopPropagation();
										onNavigateUp?.();
									}}
									onKeyDown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											e.stopPropagation();
											onNavigateUp?.();
										}
									}}
									onContextMenu={(e) => {
										e.preventDefault();
										e.stopPropagation();
										// Don't show context menu on parent folder item
									}}
									tabIndex={0}
									role="button"
									title="Previous Folder (Double-click to navigate up)"
									style={{ opacity: 0.7, cursor: 'pointer' }}
								>
									<div className="file-grid-icon">
										<CornerLeftUp size={48} />
									</div>
									<div className="file-grid-name">...</div>
								</div>
							</div>
						)
					)}
					<div className="empty-state">
						<p>{searchQuery ? 'No files match your search' : 'This directory is empty'}</p>
					</div>
				</>
			) : (
				viewMode === 'list' ? renderListView() : renderGridView()
			)}
			{renderContextMenu()}
			{renderSelectionBox()}
		</div>
	);
};
