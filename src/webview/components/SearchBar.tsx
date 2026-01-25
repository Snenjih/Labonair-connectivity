import React, { useRef, useMemo, forwardRef } from 'react';
import { X, Search } from 'lucide-react';

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

	return (
		<div className="search-bar">
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: '8px',
					flex: 1,
					position: 'relative'
				}}
			>
				<Search size={16} style={{ color: 'var(--terminus-text-subtle)', flexShrink: 0 }} />
				<input
					ref={inputRef}
					type="text"
					placeholder="Find Host or ssh user@hostname..."
					value={value}
					onChange={e => onChange(e.target.value)}
					onKeyDown={handleKeyDown}
					title={isConnectMode ? `Press Enter to connect to ${value}` : 'Search hosts...'}
					tabIndex={1}
					style={{
						flex: 1,
						padding: '8px 12px',
						background: 'transparent',
						color: 'var(--terminus-text)',
						border: 'none',
						fontSize: '13px',
						outline: 'none'
					}}
				/>
				{value && (
					<button
						className="search-clear-btn"
						onClick={handleClearClick}
						title="Clear search"
						style={{
							background: 'none',
							border: 'none',
							padding: '4px',
							cursor: 'pointer',
							color: 'var(--terminus-text-muted)',
							borderRadius: 'var(--terminus-radius-sm)',
							flexShrink: 0
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
		</div>
	);
});

SearchBar.displayName = 'SearchBar';

export default SearchBar;
