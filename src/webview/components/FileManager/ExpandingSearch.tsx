import React, { useState, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';

interface ExpandingSearchProps {
	value: string;
	onChange: (value: string) => void;
	disabled?: boolean;
	placeholder?: string;
}

/**
 * ExpandingSearch Component
 * Animated search input that expands from an icon on click
 * Requirement #6: Expanding input field (Icon -> Input on click)
 */
export const ExpandingSearch: React.FC<ExpandingSearchProps> = ({
	value,
	onChange,
	disabled = false,
	placeholder = 'Filter...'
}) => {
	const [isExpanded, setIsExpanded] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	// Auto-focus input when expanded
	useEffect(() => {
		if (isExpanded && inputRef.current) {
			inputRef.current.focus();
		}
	}, [isExpanded]);

	// Handle icon click
	const handleIconClick = () => {
		if (!disabled) {
			setIsExpanded(true);
		}
	};

	// Handle blur - collapse if empty
	const handleBlur = () => {
		if (!value) {
			setIsExpanded(false);
		}
	};

	// Handle input change
	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		onChange(e.target.value);
	};

	return (
		<div className={`expanding-search ${isExpanded ? 'expanded' : 'collapsed'}`}>
			{!isExpanded && (
				<button
					className="toolbar-btn expanding-search-icon"
					onClick={handleIconClick}
					disabled={disabled}
					title="Filter files"
					aria-label="Open filter input"
				>
					<Search size={16} />
				</button>
			)}

			{isExpanded && (
				<input
					ref={inputRef}
					type="text"
					className="expanding-search-input"
					value={value}
					onChange={handleChange}
					onBlur={handleBlur}
					disabled={disabled}
					placeholder={placeholder}
					aria-label="Filter files"
				/>
			)}
		</div>
	);
};
