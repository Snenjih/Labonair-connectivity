import React, { useState, useRef, useEffect } from 'react';
import { Plus, ChevronDown, Upload, Key } from 'lucide-react';

interface SplitButtonProps {
	onPrimaryClick: () => void;
	onImport: () => void;
	onAddCredential: () => void;
}

const SplitButton: React.FC<SplitButtonProps> = ({
	onPrimaryClick,
	onImport,
	onAddCredential
}) => {
	const [showDropdown, setShowDropdown] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setShowDropdown(false);
			}
		};

		if (showDropdown) {
			document.addEventListener('mousedown', handleClickOutside);
			return () => document.removeEventListener('mousedown', handleClickOutside);
		}
	}, [showDropdown]);

	const handleDropdownToggle = (e: React.MouseEvent) => {
		e.stopPropagation();
		setShowDropdown(!showDropdown);
	};

	const handleMenuItemClick = (action: () => void) => {
		setShowDropdown(false);
		action();
	};

	return (
		<div className="split-button" ref={dropdownRef}>
			<button
				className="split-button-primary"
				onClick={onPrimaryClick}
				title="New Host"
				tabIndex={2}
			>
				<Plus size={16} />
				New Host
			</button>
			<div className="split-button-divider" />
			<button
				className="split-button-menu"
				onClick={handleDropdownToggle}
				title="More actions"
				tabIndex={3}
			>
				<ChevronDown size={16} />
			</button>

			{showDropdown && (
				<div className="split-button-dropdown">
					<button
						className="dropdown-item"
						onClick={() => handleMenuItemClick(onImport)}
					>
						<Upload size={14} />
						Import Hosts
					</button>
					<button
						className="dropdown-item"
						onClick={() => handleMenuItemClick(onPrimaryClick)}
					>
						<Plus size={14} />
						New Host
					</button>
					<button
						className="dropdown-item"
						onClick={() => handleMenuItemClick(onAddCredential)}
					>
						<Key size={14} />
						Add Credential
					</button>
				</div>
			)}
		</div>
	);
};

export default SplitButton;
