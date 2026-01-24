import React, { useState } from 'react';
import {
	Home,
	ChevronUp,
	ChevronLeft,
	ChevronRight,
	RefreshCw,
	Grid3x3,
	List,
	Columns,
	Link2,
	Unlink,
	Star,
	Trash2
} from 'lucide-react';
import { Bookmark } from '../../../common/types';
import { MenuButton } from './MenuButton';
import { ExpandingSearch } from './ExpandingSearch';

interface ToolbarProps {
	currentPath: string;
	canGoBack: boolean;
	canGoForward: boolean;
	viewMode: 'list' | 'grid';
	layoutMode: 'explorer' | 'commander';
	syncBrowsing?: boolean;
	isLoading: boolean;
	searchQuery: string;
	fileSystem?: 'local' | 'remote';
	bookmarks?: Bookmark[];
	history?: string[];
	historyIndex?: number;
	onNavigateHome: () => void;
	onNavigateUp: () => void;
	onNavigateBack: () => void;
	onNavigateForward: () => void;
	onRefresh: () => void;
	onUpload: () => void;
	onNewFolder: () => void;
	onNewFile: () => void;
	onOpenTerminal?: () => void;
	onDeepSearch?: () => void;
	onOpenSync?: () => void;
	onViewModeChange: (mode: 'list' | 'grid') => void;
	onLayoutModeChange: (mode: 'explorer' | 'commander') => void;
	onSyncBrowsingChange?: (enabled: boolean) => void;
	onSearchChange: (query: string) => void;
	onPathNavigate?: (path: string) => void;
	onFileSystemChange?: (mode: 'local' | 'remote') => void;
	onAddBookmark?: (label: string, path: string, system: 'local' | 'remote') => void;
	onRemoveBookmark?: (bookmarkId: string) => void;
	onNavigateToBookmark?: (path: string) => void;
	onHistoryNavigate?: (index: number) => void;
}

/**
 * Toolbar Component for File Manager
 * Provides navigation, actions, and view controls
 */
export const Toolbar: React.FC<ToolbarProps> = ({
	currentPath,
	canGoBack,
	canGoForward,
	viewMode,
	layoutMode,
	syncBrowsing = false,
	isLoading,
	searchQuery,
	fileSystem = 'remote',
	bookmarks = [],
	history = [],
	historyIndex = 0,
	onNavigateHome,
	onNavigateUp,
	onNavigateBack,
	onNavigateForward,
	onRefresh,
	onUpload,
	onNewFolder,
	onNewFile,
	onOpenTerminal,
	onDeepSearch,
	onOpenSync,
	onViewModeChange,
	onLayoutModeChange,
	onSyncBrowsingChange,
	onSearchChange,
	onPathNavigate,
	onFileSystemChange,
	onAddBookmark,
	onRemoveBookmark,
	onNavigateToBookmark,
	onHistoryNavigate
}) => {
	const [pathInput, setPathInput] = useState(currentPath);
	const [isEditMode, setIsEditMode] = useState(false);
	const [showBookmarksDropdown, setShowBookmarksDropdown] = useState(false);
	const [showBackHistoryDropdown, setShowBackHistoryDropdown] = useState(false);
	const [showForwardHistoryDropdown, setShowForwardHistoryDropdown] = useState(false);
	const inputRef = React.useRef<HTMLInputElement>(null);
	const bookmarksDropdownRef = React.useRef<HTMLDivElement>(null);
	const backHistoryDropdownRef = React.useRef<HTMLDivElement>(null);
	const forwardHistoryDropdownRef = React.useRef<HTMLDivElement>(null);

	// Update path input when currentPath changes
	React.useEffect(() => {
		setPathInput(currentPath);
	}, [currentPath]);

	// Focus input when entering edit mode
	React.useEffect(() => {
		if (isEditMode && inputRef.current) {
			inputRef.current.focus();
			inputRef.current.select();
		}
	}, [isEditMode]);

	/**
	 * Generates breadcrumb segments from path
	 */
	const getBreadcrumbs = (): Array<{ label: string; path: string }> => {
		if (currentPath === '~' || currentPath === '') {
			return [{ label: '~', path: '~' }];
		}
		if (currentPath === '/') {
			return [{ label: '/', path: '/' }];
		}

		const parts = currentPath.split('/').filter(p => p);
		const breadcrumbs: Array<{ label: string; path: string }> = [{ label: '/', path: '/' }];

		parts.forEach((part, index) => {
			const path = '/' + parts.slice(0, index + 1).join('/');
			breadcrumbs.push({ label: part, path });
		});

		return breadcrumbs;
	};

	/**
	 * Handles breadcrumb click
	 */
	const handleBreadcrumbClick = (path: string) => {
		if (onPathNavigate) {
			onPathNavigate(path);
		}
	};

	/**
	 * Handles path input submission
	 */
	const handlePathSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (onPathNavigate && pathInput !== currentPath) {
			onPathNavigate(pathInput);
		}
		setIsEditMode(false);
	};

	/**
	 * Handles clicking on the breadcrumb container to enter edit mode
	 */
	const handleContainerClick = (e: React.MouseEvent) => {
		// Only enter edit mode if clicking on the container itself, not on breadcrumbs
		if (e.target === e.currentTarget) {
			setIsEditMode(true);
		}
	};

	/**
	 * Handles input blur (exit edit mode)
	 */
	const handleInputBlur = () => {
		setIsEditMode(false);
		setPathInput(currentPath); // Reset to current path if not submitted
	};

	/**
	 * Handles keyboard events in input
	 */
	const handleInputKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Escape') {
			setIsEditMode(false);
			setPathInput(currentPath);
		}
	};

	/**
	 * Close dropdowns when clicking outside
	 */
	React.useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (bookmarksDropdownRef.current && !bookmarksDropdownRef.current.contains(e.target as Node)) {
				setShowBookmarksDropdown(false);
			}
			if (backHistoryDropdownRef.current && !backHistoryDropdownRef.current.contains(e.target as Node)) {
				setShowBackHistoryDropdown(false);
			}
			if (forwardHistoryDropdownRef.current && !forwardHistoryDropdownRef.current.contains(e.target as Node)) {
				setShowForwardHistoryDropdown(false);
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	/**
	 * Handle adding a bookmark
	 */
	const handleAddBookmark = () => {
		if (onAddBookmark) {
			// Generate a label from the current path
			const pathParts = currentPath.split('/').filter(p => p);
			const label = pathParts.length > 0 ? pathParts[pathParts.length - 1] : (currentPath === '/' ? 'Root' : 'Home');
			onAddBookmark(label, currentPath, fileSystem || 'remote');
			setShowBookmarksDropdown(false);
		}
	};

	/**
	 * Handle navigating to a bookmark
	 */
	const handleBookmarkClick = (path: string) => {
		if (onNavigateToBookmark) {
			onNavigateToBookmark(path);
			setShowBookmarksDropdown(false);
		}
	};

	/**
	 * Handle removing a bookmark
	 */
	const handleRemoveBookmark = (e: React.MouseEvent, bookmarkId: string) => {
		e.stopPropagation();
		if (onRemoveBookmark) {
			onRemoveBookmark(bookmarkId);
		}
	};

	/**
	 * Handle history navigation
	 */
	const handleHistoryItemClick = (index: number) => {
		if (onHistoryNavigate) {
			onHistoryNavigate(index);
			setShowBackHistoryDropdown(false);
			setShowForwardHistoryDropdown(false);
		}
	};

	/**
	 * Get history items for back dropdown (items before current index)
	 */
	const getBackHistory = (): Array<{ index: number; path: string }> => {
		return history.slice(0, historyIndex).reverse().slice(0, 10).map((path, i) => ({
			index: historyIndex - i - 1,
			path
		}));
	};

	/**
	 * Get history items for forward dropdown (items after current index)
	 */
	const getForwardHistory = (): Array<{ index: number; path: string }> => {
		return history.slice(historyIndex + 1, historyIndex + 11).map((path, i) => ({
			index: historyIndex + i + 1,
			path
		}));
	};

	/**
	 * Group bookmarks by system type
	 */
	const groupedBookmarks = {
		local: bookmarks.filter(b => b.system === 'local'),
		remote: bookmarks.filter(b => b.system === 'remote')
	};

	return (
		<div className="file-manager-toolbar">
			{/* Location Switcher (Local/Remote) */}
			{onFileSystemChange && (
				<div className="toolbar-section toolbar-location-switcher">
					<div className="location-toggle" role="group" aria-label="File system mode">
						<button
							className={`toolbar-btn location-btn ${fileSystem === 'local' ? 'active' : ''}`}
							onClick={() => onFileSystemChange('local')}
							disabled={isLoading}
							title="Local File System"
							aria-label="Switch to local file system"
							aria-pressed={fileSystem === 'local'}
						>
							💻 Local
						</button>
						<button
							className={`toolbar-btn location-btn ${fileSystem === 'remote' ? 'active' : ''}`}
							onClick={() => onFileSystemChange('remote')}
							disabled={isLoading}
							title="Remote File System (SFTP)"
							aria-label="Switch to remote file system"
							aria-pressed={fileSystem === 'remote'}
						>
							☁️ Remote
						</button>
					</div>
				</div>
			)}

			{/* Navigation Controls */}
			<div className="toolbar-section toolbar-nav">
				{/* Back Button with History Dropdown */}
				<div ref={backHistoryDropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
					<button
						className="toolbar-btn"
						onClick={onNavigateBack}
						onContextMenu={(e) => {
							e.preventDefault();
							if (canGoBack) {
								setShowBackHistoryDropdown(!showBackHistoryDropdown);
							}
						}}
						disabled={!canGoBack || isLoading}
						title="Back (right-click for history)"
						aria-label="Navigate back"
					>
						<ChevronLeft size={16} />
					</button>
					{showBackHistoryDropdown && canGoBack && (
						<div className="toolbar-dropdown">
							{getBackHistory().map((item) => (
								<div
									key={item.index}
									className="toolbar-dropdown-item"
									onClick={() => handleHistoryItemClick(item.index)}
								>
									{item.path}
								</div>
							))}
						</div>
					)}
				</div>

				{/* Forward Button with History Dropdown */}
				<div ref={forwardHistoryDropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
					<button
						className="toolbar-btn"
						onClick={onNavigateForward}
						onContextMenu={(e) => {
							e.preventDefault();
							if (canGoForward) {
								setShowForwardHistoryDropdown(!showForwardHistoryDropdown);
							}
						}}
						disabled={!canGoForward || isLoading}
						title="Forward (right-click for history)"
						aria-label="Navigate forward"
					>
						<ChevronRight size={16} />
					</button>
					{showForwardHistoryDropdown && canGoForward && (
						<div className="toolbar-dropdown">
							{getForwardHistory().map((item) => (
								<div
									key={item.index}
									className="toolbar-dropdown-item"
									onClick={() => handleHistoryItemClick(item.index)}
								>
									{item.path}
								</div>
							))}
						</div>
					)}
				</div>

				<button
					className="toolbar-btn"
					onClick={onNavigateHome}
					disabled={isLoading}
					title="Home directory"
					aria-label="Navigate to home"
				>
					<Home size={16} />
				</button>

				{/* Bookmarks Button */}
				{onAddBookmark && (
					<div ref={bookmarksDropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
						<button
							className="toolbar-btn"
							onClick={() => setShowBookmarksDropdown(!showBookmarksDropdown)}
							disabled={isLoading}
							title="Bookmarks"
							aria-label="Toggle bookmarks"
						>
							<Star size={16} />
						</button>
						{showBookmarksDropdown && (
							<div className="toolbar-dropdown">
								<div
									className="toolbar-dropdown-item toolbar-dropdown-add"
									onClick={handleAddBookmark}
								>
									<Star size={14} />
									<span>Add current folder to Bookmarks</span>
								</div>
								{bookmarks.length > 0 && <div className="toolbar-dropdown-divider" />}

								{groupedBookmarks.local.length > 0 && (
									<>
										<div className="toolbar-dropdown-header">Local</div>
										{groupedBookmarks.local.map((bookmark) => (
											<div
												key={bookmark.id}
												className="toolbar-dropdown-item toolbar-dropdown-bookmark"
												onClick={() => handleBookmarkClick(bookmark.path)}
											>
												<span className="toolbar-dropdown-bookmark-label">{bookmark.label}</span>
												<span className="toolbar-dropdown-bookmark-path">{bookmark.path}</span>
												<button
													className="toolbar-dropdown-bookmark-delete"
													onClick={(e) => handleRemoveBookmark(e, bookmark.id)}
													title="Remove bookmark"
												>
													<Trash2 size={12} />
												</button>
											</div>
										))}
									</>
								)}

								{groupedBookmarks.remote.length > 0 && (
									<>
										<div className="toolbar-dropdown-header">Remote</div>
										{groupedBookmarks.remote.map((bookmark) => (
											<div
												key={bookmark.id}
												className="toolbar-dropdown-item toolbar-dropdown-bookmark"
												onClick={() => handleBookmarkClick(bookmark.path)}
											>
												<span className="toolbar-dropdown-bookmark-label">{bookmark.label}</span>
												<span className="toolbar-dropdown-bookmark-path">{bookmark.path}</span>
												<button
													className="toolbar-dropdown-bookmark-delete"
													onClick={(e) => handleRemoveBookmark(e, bookmark.id)}
													title="Remove bookmark"
												>
													<Trash2 size={12} />
												</button>
											</div>
										))}
									</>
								)}

								{bookmarks.length === 0 && (
									<div className="toolbar-dropdown-item toolbar-dropdown-empty">
										No bookmarks yet
									</div>
								)}
							</div>
						)}
					</div>
				)}

				<button
					className="toolbar-btn"
					onClick={onRefresh}
					disabled={isLoading}
					title="Refresh"
					aria-label="Refresh directory"
				>
					<RefreshCw size={16} className={isLoading ? 'spinning' : ''} />
				</button>
			</div>

			{/* Breadcrumbs / Path Bar with integrated Up button (Req #1) */}
			<div className={`toolbar-section toolbar-path ${fileSystem === 'local' ? 'fs-local' : 'fs-remote'}`}>
				{isEditMode ? (
					<form onSubmit={handlePathSubmit} className="path-input-form">
						<input
							ref={inputRef}
							type="text"
							className="path-input"
							value={pathInput}
							onChange={(e) => setPathInput(e.target.value)}
							onBlur={handleInputBlur}
							onKeyDown={handleInputKeyDown}
							disabled={isLoading}
							placeholder="Enter path..."
							title="Current path"
						/>
						<button
							className="toolbar-btn breadcrumb-up-btn"
							onClick={onNavigateUp}
							disabled={isLoading || currentPath === '/' || currentPath === '~'}
							title="Up one level"
							aria-label="Navigate up"
							type="button"
						>
							<ChevronUp size={16} />
						</button>
					</form>
				) : (
					<div className="breadcrumb-container">
						<div
							className="breadcrumbs"
							onClick={handleContainerClick}
							title="Click here to edit path"
						>
							{getBreadcrumbs().map((crumb, index) => (
								<React.Fragment key={index}>
									<button
										className="breadcrumb"
										onClick={() => handleBreadcrumbClick(crumb.path)}
										disabled={isLoading}
									>
										{crumb.label}
									</button>
									{index < getBreadcrumbs().length - 1 && (
										<span className="breadcrumb-separator">/</span>
									)}
								</React.Fragment>
							))}
						</div>
						<button
							className="toolbar-btn breadcrumb-up-btn"
							onClick={onNavigateUp}
							disabled={isLoading || currentPath === '/' || currentPath === '~'}
							title="Up one level"
							aria-label="Navigate up"
						>
							<ChevronUp size={16} />
						</button>
					</div>
				)}
			</div>

			{/* Action Menu and Quick Actions (Req #4) */}
			<div className="toolbar-section toolbar-actions">
				{/* MenuButton: Groups secondary actions into dropdown */}
				<MenuButton
					onNewFile={onNewFile}
					onNewFolder={onNewFolder}
					onUpload={onUpload}
					onOpenTerminal={onOpenTerminal}
					onDeepSearch={onDeepSearch}
					onOpenSync={onOpenSync}
					isLoading={isLoading}
					isCommanderMode={layoutMode === 'commander'}
				/>
			</div>

			{/* View Controls */}
			<div className="toolbar-section toolbar-view">
				{/* Expanding Search (Req #6) */}
				<ExpandingSearch
					value={searchQuery}
					onChange={onSearchChange}
					disabled={isLoading}
					placeholder="Filter..."
				/>

				{/* View Mode Toggle */}
				<div className="view-toggle" role="group" aria-label="View mode">
					<button
						className={`toolbar-btn ${viewMode === 'list' ? 'active' : ''}`}
						onClick={() => onViewModeChange('list')}
						disabled={isLoading}
						title="List view"
						aria-label="Switch to list view"
						aria-pressed={viewMode === 'list'}
					>
						<List size={16} />
					</button>
					<button
						className={`toolbar-btn ${viewMode === 'grid' ? 'active' : ''}`}
						onClick={() => onViewModeChange('grid')}
						disabled={isLoading}
						title="Grid view"
						aria-label="Switch to grid view"
						aria-pressed={viewMode === 'grid'}
					>
						<Grid3x3 size={16} />
					</button>
				</div>

				{/* Layout Mode Toggle */}
				<button
					className={`toolbar-btn ${layoutMode === 'commander' ? 'active' : ''}`}
					onClick={() => onLayoutModeChange(layoutMode === 'explorer' ? 'commander' : 'explorer')}
					disabled={isLoading}
					title={layoutMode === 'explorer' ? 'Switch to Commander mode (dual panel)' : 'Switch to Explorer mode (single panel)'}
					aria-label={layoutMode === 'explorer' ? 'Switch to dual panel mode' : 'Switch to single panel mode'}
					aria-pressed={layoutMode === 'commander'}
				>
					<Columns size={16} />
				</button>

				{/* Synchronized Browsing Toggle (Commander mode only) */}
				{layoutMode === 'commander' && onSyncBrowsingChange && (
					<button
						className={`toolbar-btn ${syncBrowsing ? 'active' : ''}`}
						onClick={() => onSyncBrowsingChange(!syncBrowsing)}
						disabled={isLoading}
						title={syncBrowsing ? 'Disable synchronized browsing' : 'Enable synchronized browsing'}
						aria-label={syncBrowsing ? 'Disable panel synchronization' : 'Enable panel synchronization'}
						aria-pressed={syncBrowsing}
					>
						{syncBrowsing ? <Link2 size={16} /> : <Unlink size={16} />}
					</button>
				)}
			</div>
		</div>
	);
};
