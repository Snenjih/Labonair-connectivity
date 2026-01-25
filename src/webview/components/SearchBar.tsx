import React, { useRef, useMemo, forwardRef } from 'react';
import { Search, Plug, X } from 'lucide-react';

interface SearchBarProps {
	value: string;
	onChange: (value: string) => void;
	onQuickConnect?: (connectionString: string) => void;
}

const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(({ value, onChange, onQuickConnect }, ref) => {
	const internalRef = useRef<HTMLInputElement>(null);
	const inputRef = (ref as React.RefObject<HTMLInputElement>) || internalRef;

	// SSH Regex: ^(?:([^@]+)@)?([^:]+)(?::(\d+))?$
	// Matches: [user@]host[:port]
	const sshRegex = /^(?:([^@]+)@)?([^:]+)(?::(\d+))?$/;

	const isConnectMode = useMemo(() => {
		if (!value || !value.trim()) return false;
		return sshRegex.test(value.trim());
	}, [value]);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' && isConnectMode && onQuickConnect) {
			e.preventDefault();
			onQuickConnect(value.trim());
		}
	};

	const handleClearClick = () => {
		onChange('');
		if (inputRef.current) {
			inputRef.current.focus();
		}
	};

	const handleIconClick = () => {
		if (isConnectMode && onQuickConnect) {
			onQuickConnect(value.trim());
		}
	};

	const IconComponent = isConnectMode ? Plug : Search;
	const iconColor = isConnectMode
		? 'var(--vscode-button-background)'
		: 'var(--terminus-text-muted)';

	return (
		<div className="search-bar">
			<button
				className="search-icon-btn"
				onClick={handleIconClick}
				disabled={!isConnectMode}
				title={isConnectMode ? `Click to connect to ${value}` : 'Search icon'}
				style={{
					position: 'absolute',
					left: '24px',
					top: '50%',
					transform: 'translateY(-50%)',
					background: 'none',
					border: 'none',
					padding: '4px',
					cursor: isConnectMode ? 'pointer' : 'default',
					color: iconColor
				}}
			>
				<IconComponent size={16} />
			</button>
			<input
				ref={inputRef}
				type="text"
				placeholder="Find Host or ssh user@hostname..."
				value={value}
				onChange={e => onChange(e.target.value)}
				onKeyDown={handleKeyDown}
				title={isConnectMode ? `Press Enter to connect to ${value}` : 'Search hosts...'}
				tabIndex={1}
			/>
			{value && (
				<button
					className="search-clear-btn"
					onClick={handleClearClick}
					title="Clear search"
					style={{
						position: 'absolute',
						right: '24px',
						top: '50%',
						transform: 'translateY(-50%)',
						background: 'none',
						border: 'none',
						padding: '4px',
						cursor: 'pointer',
						color: 'var(--terminus-text-muted)',
						borderRadius: 'var(--terminus-radius-sm)'
					}}
					onMouseEnter={(e) => {
						e.currentTarget.style.backgroundColor = 'var(--terminus-hover)';
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.backgroundColor = 'transparent';
					}}
				>
					<X size={16} />
				</button>
			)}
		</div>
	);
});

SearchBar.displayName = 'SearchBar';

export default SearchBar;
