import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, FilePlus, FolderPlus, Upload, Search, ArrowLeftRight } from 'lucide-react';

interface MenuButtonProps {
	onNewFile: () => void;
	onNewFolder: () => void;
	onUpload: () => void;
	onDeepSearch?: () => void;
	onOpenSync?: () => void;
	isLoading: boolean;
	isCommanderMode: boolean;
}

/**
 * MenuButton Component
 * Dropdown menu for secondary file manager actions
 * Requirement #4: Group actions into a single dropdown menu
 */
export const MenuButton: React.FC<MenuButtonProps> = ({
	onNewFile,
	onNewFolder,
	onUpload,
	onDeepSearch,
	onOpenSync,
	isLoading,
	isCommanderMode
}) => {
	const [isOpen, setIsOpen] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
				setIsOpen(false);
			}
		};

		if (isOpen) {
			document.addEventListener('mousedown', handleClickOutside);
			return () => document.removeEventListener('mousedown', handleClickOutside);
		}
	}, [isOpen]);

	const handleMenuItemClick = (action: () => void) => {
		action();
		setIsOpen(false);
	};

	return (
		<div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
			<button
				className="toolbar-btn"
				onClick={() => setIsOpen(!isOpen)}
				disabled={isLoading}
				title="Actions menu"
				aria-label="Open actions menu"
				aria-expanded={isOpen}
			>
				<MoreVertical size={16} />
			</button>

			{isOpen && (
				<div className="toolbar-dropdown action-menu-dropdown">
					<div
						className="toolbar-dropdown-item"
						onClick={() => handleMenuItemClick(onNewFile)}
					>
						<FilePlus size={14} />
						<span>New File</span>
					</div>

					<div
						className="toolbar-dropdown-item"
						onClick={() => handleMenuItemClick(onNewFolder)}
					>
						<FolderPlus size={14} />
						<span>New Folder</span>
					</div>

					<div
						className="toolbar-dropdown-item"
						onClick={() => handleMenuItemClick(onUpload)}
					>
						<Upload size={14} />
						<span>Upload File</span>
					</div>

					{onDeepSearch && (
						<>
							<div className="toolbar-dropdown-divider" />
							<div
								className="toolbar-dropdown-item"
								onClick={() => handleMenuItemClick(onDeepSearch)}
							>
								<Search size={14} />
								<span>Find Files (Deep Search)</span>
							</div>
						</>
					)}

					{onOpenSync && isCommanderMode && (
						<>
							<div className="toolbar-dropdown-divider" />
							<div
								className="toolbar-dropdown-item"
								onClick={() => handleMenuItemClick(onOpenSync)}
							>
								<ArrowLeftRight size={14} />
								<span>Synchronize Directories</span>
							</div>
						</>
					)}
				</div>
			)}
		</div>
	);
};
