import React, { useState, useRef, useEffect } from 'react';
import { ChevronUp } from 'lucide-react';

interface BreadcrumbBarProps {
	currentPath: string;
	isLoading: boolean;
	fileSystem?: 'local' | 'remote';
	onNavigateUp: () => void;
	onPathNavigate?: (path: string) => void;
}

/**
 * BreadcrumbBar Component
 * "Fusion Breadcrumb" - Merges path navigation with Up button in unified control
 * Subphase 6.2Extend: Complex Toolbar Widgets (Req #1)
 */
export const BreadcrumbBar: React.FC<BreadcrumbBarProps> = ({
	currentPath,
	isLoading,
	fileSystem = 'remote',
	onNavigateUp,
	onPathNavigate
}) => {
	const [pathInput, setPathInput] = useState(currentPath);
	const [isEditMode, setIsEditMode] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	// Update path input when currentPath changes
	useEffect(() => {
		setPathInput(currentPath);
	}, [currentPath]);

	// Focus input when entering edit mode
	useEffect(() => {
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

	const isAtRoot = currentPath === '/' || currentPath === '~';

	return (
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
						disabled={isLoading || isAtRoot}
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
						disabled={isLoading || isAtRoot}
						title="Up one level"
						aria-label="Navigate up"
					>
						<ChevronUp size={16} />
					</button>
				</div>
			)}
		</div>
	);
};
