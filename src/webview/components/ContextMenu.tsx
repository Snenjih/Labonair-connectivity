import React, { useEffect, useRef } from 'react';
import { LucideIcon } from 'lucide-react';

export interface ContextMenuItem {
	label: string;
	icon?: LucideIcon;
	action: () => void;
	separator?: boolean;
	danger?: boolean;
	disabled?: boolean;
}

interface ContextMenuProps {
	x: number;
	y: number;
	items: ContextMenuItem[];
	onClose: () => void;
}

/**
 * ContextMenu Component
 * Reusable right-click context menu with VS Code theme styling
 * Subphase 6.3: Custom Context Menu (Req #15)
 */
export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
	const menuRef = useRef<HTMLDivElement>(null);

	// Close on click outside or Escape key
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				onClose();
			}
		};

		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				onClose();
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		document.addEventListener('keydown', handleEscape);

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
			document.removeEventListener('keydown', handleEscape);
		};
	}, [onClose]);

	// Adjust position if menu would go off screen
	useEffect(() => {
		if (menuRef.current) {
			const menu = menuRef.current;
			const rect = menu.getBoundingClientRect();
			const viewportWidth = window.innerWidth;
			const viewportHeight = window.innerHeight;

			let adjustedX = x;
			let adjustedY = y;

			// Adjust horizontal position if menu overflows right edge
			if (rect.right > viewportWidth) {
				adjustedX = viewportWidth - rect.width - 5;
			}

			// Adjust vertical position if menu overflows bottom edge
			if (rect.bottom > viewportHeight) {
				adjustedY = viewportHeight - rect.height - 5;
			}

			// Apply adjusted position
			menu.style.left = `${adjustedX}px`;
			menu.style.top = `${adjustedY}px`;
		}
	}, [x, y]);

	const handleItemClick = (item: ContextMenuItem) => {
		if (!item.disabled) {
			item.action();
			onClose();
		}
	};

	return (
		<div
			ref={menuRef}
			className="context-menu"
			style={{
				position: 'fixed',
				left: `${x}px`,
				top: `${y}px`,
				zIndex: 10000
			}}
			role="menu"
		>
			{items.map((item, index) => {
				if (item.separator) {
					return <div key={`separator-${index}`} className="context-menu-separator" />;
				}

				const Icon = item.icon;

				return (
					<div
						key={index}
						className={`context-menu-item ${item.danger ? 'danger' : ''} ${item.disabled ? 'disabled' : ''}`}
						onClick={() => handleItemClick(item)}
						role="menuitem"
						aria-disabled={item.disabled}
					>
						{Icon && (
							<span className="context-menu-icon">
								<Icon size={14} />
							</span>
						)}
						<span className="context-menu-label">{item.label}</span>
					</div>
				);
			})}
		</div>
	);
};
