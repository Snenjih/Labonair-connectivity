import React, { useState } from 'react';
import {
	Home,
	ChevronUp,
	ChevronLeft,
	ChevronRight,
	RefreshCw,
	Upload,
	FolderPlus,
	FilePlus,
	Terminal,
	Grid3x3,
	List,
	Columns,
	Link2,
	Unlink
} from 'lucide-react';

interface ToolbarProps {
	currentPath: string;
	canGoBack: boolean;
	canGoForward: boolean;
	viewMode: 'list' | 'grid';
	layoutMode: 'explorer' | 'commander';
	syncBrowsing?: boolean;
	isLoading: boolean;
	searchQuery: string;
	onNavigateHome: () => void;
	onNavigateUp: () => void;
	onNavigateBack: () => void;
	onNavigateForward: () => void;
	onRefresh: () => void;
	onUpload: () => void;
	onNewFolder: () => void;
	onNewFile: () => void;
	onOpenTerminal?: () => void;
	onViewModeChange: (mode: 'list' | 'grid') => void;
	onLayoutModeChange: (mode: 'explorer' | 'commander') => void;
	onSyncBrowsingChange?: (enabled: boolean) => void;
	onSearchChange: (query: string) => void;
	onPathNavigate?: (path: string) => void;
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
	onNavigateHome,
	onNavigateUp,
	onNavigateBack,
	onNavigateForward,
	onRefresh,
	onUpload,
	onNewFolder,
	onNewFile,
	onOpenTerminal,
	onViewModeChange,
	onLayoutModeChange,
	onSyncBrowsingChange,
	onSearchChange,
	onPathNavigate
}) => {
	const [pathInput, setPathInput] = useState(currentPath);
	const [isEditMode, setIsEditMode] = useState(false);
	const inputRef = React.useRef<HTMLInputElement>(null);

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

	return (
		<div className="file-manager-toolbar">
			{/* Navigation Controls */}
			<div className="toolbar-section toolbar-nav">
				<button
					className="toolbar-btn"
					onClick={onNavigateBack}
					disabled={!canGoBack || isLoading}
					title="Back"
					aria-label="Navigate back"
				>
					<ChevronLeft size={16} />
				</button>
				<button
					className="toolbar-btn"
					onClick={onNavigateForward}
					disabled={!canGoForward || isLoading}
					title="Forward"
					aria-label="Navigate forward"
				>
					<ChevronRight size={16} />
				</button>
				<button
					className="toolbar-btn"
					onClick={onNavigateUp}
					disabled={isLoading || currentPath === '/' || currentPath === '~'}
					title="Up one level"
					aria-label="Navigate up"
				>
					<ChevronUp size={16} />
				</button>
				<button
					className="toolbar-btn"
					onClick={onNavigateHome}
					disabled={isLoading}
					title="Home directory"
					aria-label="Navigate to home"
				>
					<Home size={16} />
				</button>
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

			{/* Breadcrumbs / Path Bar (Merged) */}
			<div className="toolbar-section toolbar-path">
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
					</form>
				) : (
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
				)}
			</div>

			{/* Action Buttons */}
			<div className="toolbar-section toolbar-actions">
				<button
					className="toolbar-btn"
					onClick={onNewFile}
					disabled={isLoading}
					title="New file"
					aria-label="Create new file"
				>
					<FilePlus size={16} />
				</button>
				<button
					className="toolbar-btn"
					onClick={onNewFolder}
					disabled={isLoading}
					title="New folder"
					aria-label="Create new folder"
				>
					<FolderPlus size={16} />
				</button>
				<button
					className="toolbar-btn"
					onClick={onUpload}
					disabled={isLoading}
					title="Upload file"
					aria-label="Upload file"
				>
					<Upload size={16} />
				</button>
				{onOpenTerminal && (
					<button
						className="toolbar-btn"
						onClick={onOpenTerminal}
						disabled={isLoading}
						title="Open terminal here"
						aria-label="Open terminal in current directory"
					>
						<Terminal size={16} />
					</button>
				)}
			</div>

			{/* View Controls */}
			<div className="toolbar-section toolbar-view">
				{/* Search */}
				<input
					type="text"
					className="search-input"
					placeholder="Filter..."
					value={searchQuery}
					onChange={(e) => onSearchChange(e.target.value)}
					disabled={isLoading}
					title="Filter files"
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
