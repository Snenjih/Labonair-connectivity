import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
	Download,
	Trash2,
	Edit,
	Info,
	Copy,
	GitCompare,
	FileEdit,
	ArrowRight
} from 'lucide-react';
import { FileEntry } from '../../../common/types';
import { FileIcon } from '../FileIcon';

interface FileListProps {
	files: FileEntry[];
	viewMode: 'list' | 'grid';
	selection: string[];
	focusedFile: string | null;
	searchQuery: string;
	hostId: string;
	panelId?: 'left' | 'right';
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
	onInternalDrop?: (sourcePaths: string[], targetPath: string, sourcePanel?: 'left' | 'right') => void;
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
	panelId,
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
	onInternalDrop
}) => {
	const [contextMenu, setContextMenu] = useState<{
		x: number;
		y: number;
		file: FileEntry;
	} | null>(null);
	const [dragOver, setDragOver] = useState(false);
	const [dragging, setDragging] = useState(false);
	const [scrollTop, setScrollTop] = useState(0);
	const listRef = useRef<HTMLDivElement>(null);
	const bodyRef = useRef<HTMLDivElement>(null);
	const lastSelectedIndex = useRef<number>(-1);

	// Virtual scrolling constants
	const ITEM_HEIGHT = 32; // Height of each row in pixels
	const BUFFER_SIZE = 10; // Number of extra items to render above/below viewport
	const VIRTUAL_THRESHOLD = 1000; // Enable virtual scrolling for files > 1000

	// Filter files based on search query
	const filteredFiles = searchQuery
		? files.filter(f =>
			f.name.toLowerCase().includes(searchQuery.toLowerCase())
		)
		: files;

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
				// Navigate up (parent will handle)
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
			default:
				return;
		}

		if (newIndex !== currentIndex && newIndex >= 0 && newIndex < filteredFiles.length) {
			onFileSelect(filteredFiles[newIndex].path, false, false);
		}
	}, [filteredFiles, focusedFile, selection, onFileSelect, onFileOpen, onFileDelete, onFileRename]);

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
	}, []);

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
	 * Handles drop
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
				onInternalDrop(paths, targetPath, sourcePanel);
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
				{visibleFiles.map((file, index) => (
					<div
						key={file.path}
						className={`file-list-row ${selection.includes(file.path) ? 'selected' : ''} ${focusedFile === file.path ? 'focused' : ''}`}
						onClick={(e) => handleFileClick(file, e)}
						onDoubleClick={(e) => handleFileDoubleClick(file, e)}
						onContextMenu={(e) => handleContextMenu(e, file)}
						draggable
						onDragStart={(e) => handleDragStart(e, file)}
						onDragEnd={handleDragEnd}
						tabIndex={0}
						role="button"
						aria-selected={selection.includes(file.path)}
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
				))}
			</div>
		</div>
	);

	/**
	 * Renders Grid View
	 */
	const renderGridView = () => (
		<div className="file-grid">
			{filteredFiles.map((file) => (
				<div
					key={file.path}
					className={`file-grid-item ${selection.includes(file.path) ? 'selected' : ''} ${focusedFile === file.path ? 'focused' : ''}`}
					onClick={(e) => handleFileClick(file, e)}
					onDoubleClick={(e) => handleFileDoubleClick(file, e)}
					onContextMenu={(e) => handleContextMenu(e, file)}
					draggable
					onDragStart={(e) => handleDragStart(e, file)}
					onDragEnd={handleDragEnd}
					tabIndex={0}
					role="button"
					aria-selected={selection.includes(file.path)}
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
			))}
		</div>
	);

	/**
	 * Renders Context Menu
	 */
	const renderContextMenu = () => {
		if (!contextMenu) {return null;}

		const { x, y, file } = contextMenu;
		const selectedFiles = filteredFiles.filter(f => selection.includes(f.path));
		const isMultiSelect = selectedFiles.length > 1;

		return (
			<div
				className="context-menu"
				style={{ top: y, left: x }}
				onClick={(e) => e.stopPropagation()}
			>
				{file.type !== 'd' && (
					<>
						<button
							className="context-menu-item"
							onClick={() => {
								onFileEdit(file);
								closeContextMenu();
							}}
						>
							<FileEdit size={14} />
							<span>Edit</span>
						</button>
						<button
							className="context-menu-item"
							onClick={() => {
								onFileDownload(file);
								closeContextMenu();
							}}
						>
							<Download size={14} />
							<span>Download</span>
						</button>
						<button
							className="context-menu-item"
							onClick={() => {
								onCompareFile(file);
								closeContextMenu();
							}}
						>
							<GitCompare size={14} />
							<span>Compare with...</span>
						</button>
						<div className="context-menu-separator" />
					</>
				)}
				<button
					className="context-menu-item"
					onClick={() => {
						onFileRename(file);
						closeContextMenu();
					}}
					disabled={isMultiSelect}
				>
					<Edit size={14} />
					<span>Rename</span>
				</button>
				<button
					className="context-menu-item"
					onClick={() => {
						onCopyPath(file.path);
						closeContextMenu();
					}}
				>
					<Copy size={14} />
					<span>Copy Path</span>
				</button>
				<button
					className="context-menu-item"
					onClick={() => {
						onFileProperties(file);
						closeContextMenu();
					}}
					disabled={isMultiSelect}
				>
					<Info size={14} />
					<span>Properties</span>
				</button>
				<div className="context-menu-separator" />
				<button
					className="context-menu-item danger"
					onClick={() => {
						onFileDelete(selectedFiles);
						closeContextMenu();
					}}
				>
					<Trash2 size={14} />
					<span>Delete {isMultiSelect ? `(${selectedFiles.length})` : ''}</span>
				</button>
			</div>
		);
	};

	return (
		<div
			ref={listRef}
			className={`file-list-container ${dragOver ? 'drag-over' : ''} ${dragging ? 'dragging' : ''}`}
			onKeyDown={handleKeyDown}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
			tabIndex={0}
		>
			{filteredFiles.length === 0 ? (
				<div className="empty-state">
					<p>{searchQuery ? 'No files match your search' : 'This directory is empty'}</p>
				</div>
			) : (
				viewMode === 'list' ? renderListView() : renderGridView()
			)}
			{renderContextMenu()}
		</div>
	);
};
