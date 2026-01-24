import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, FilePlus, FolderPlus, Upload, Search, ArrowLeftRight, Terminal } from 'lucide-react';

interface MenuButtonProps {
	onNewFile: () => void;
	onNewFolder: () => void;
	onUpload: () => void;
	onOpenTerminal?: () => void;
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
	onOpenTerminal,
	onDeepSearch,
	onOpenSync,
	isLoading,
	isCommanderMode
}) => {
	const [isOpen, setIsOpen] = useState(false);
	const [focusedIndex, setFocusedIndex] = useState(0);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);
	const menuItemRefs = useRef<(HTMLDivElement | null)[]>([]);

	// Build menu items list for keyboard navigation
	const menuItems = [
		{ label: 'New File', icon: FilePlus, action: onNewFile },
		{ label: 'New Folder', icon: FolderPlus, action: onNewFolder },
		{ label: 'Upload File', icon: Upload, action: onUpload },
		...(onOpenTerminal ? [{ label: 'Open Terminal Here', icon: Terminal, action: onOpenTerminal }] : []),
		...(onDeepSearch ? [{ label: 'Find Files (Deep Search)', icon: Search, action: onDeepSearch }] : []),
		...(onOpenSync && isCommanderMode ? [{ label: 'Synchronize Directories', icon: ArrowLeftRight, action: onOpenSync }] : [])
	];

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

	// Focus first menu item when dropdown opens
	useEffect(() => {
		if (isOpen && menuItemRefs.current[0]) {
			setFocusedIndex(0);
			menuItemRefs.current[0]?.focus();
		}
	}, [isOpen]);

	const handleMenuItemClick = (action: () => void) => {
		action();
		setIsOpen(false);
		buttonRef.current?.focus();
	};

	// Keyboard navigation for the menu button (Subphase 5.6 Req #2)
	const handleButtonKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			setIsOpen(!isOpen);
		} else if (e.key === 'ArrowDown' && !isOpen) {
			e.preventDefault();
			setIsOpen(true);
		}
	};

	// Keyboard navigation for menu items (Subphase 5.6 Req #2)
	const handleMenuKeyDown = (e: React.KeyboardEvent, index: number) => {
		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				const nextIndex = (index + 1) % menuItems.length;
				setFocusedIndex(nextIndex);
				menuItemRefs.current[nextIndex]?.focus();
				break;
			case 'ArrowUp':
				e.preventDefault();
				const prevIndex = (index - 1 + menuItems.length) % menuItems.length;
				setFocusedIndex(prevIndex);
				menuItemRefs.current[prevIndex]?.focus();
				break;
			case 'Enter':
			case ' ':
				e.preventDefault();
				menuItems[index].action();
				setIsOpen(false);
				buttonRef.current?.focus();
				break;
			case 'Escape':
				e.preventDefault();
				setIsOpen(false);
				buttonRef.current?.focus();
				break;
		}
	};

	return (
		<div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
			<button
				ref={buttonRef}
				className="toolbar-btn"
				onClick={() => setIsOpen(!isOpen)}
				onKeyDown={handleButtonKeyDown}
				disabled={isLoading}
				title="Actions menu"
				aria-label="Open actions menu"
				aria-expanded={isOpen}
				aria-haspopup="true"
			>
				<MoreVertical size={16} />
			</button>

			{isOpen && (
				<div
					className="toolbar-dropdown action-menu-dropdown"
					role="menu"
					aria-label="File actions"
				>
					{menuItems.map((item, index) => {
						const Icon = item.icon;
						// Add divider before Open Terminal Here item
						const needsDividerBefore = index === 3 && onOpenTerminal;

						return (
							<React.Fragment key={index}>
								{needsDividerBefore && <div className="toolbar-dropdown-divider" />}
								<div
									ref={(el) => (menuItemRefs.current[index] = el)}
									className="toolbar-dropdown-item"
									onClick={() => handleMenuItemClick(item.action)}
									onKeyDown={(e) => handleMenuKeyDown(e, index)}
									tabIndex={0}
									role="menuitem"
									aria-label={item.label}
								>
									<Icon size={14} />
									<span>{item.label}</span>
								</div>
							</React.Fragment>
						);
					})}
				</div>
			)}
		</div>
	);
};
