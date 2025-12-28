import React, { useState, useEffect, useRef } from 'react';
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react';

interface SearchWidgetProps {
	onSearch: (term: string, options: SearchOptions) => void;
	onNext: () => void;
	onPrevious: () => void;
	onClose: () => void;
	visible: boolean;
}

export interface SearchOptions {
	caseSensitive: boolean;
	wholeWord: boolean;
	regex: boolean;
}

const SearchWidget: React.FC<SearchWidgetProps> = ({
	onSearch,
	onNext,
	onPrevious,
	onClose,
	visible
}) => {
	const [searchTerm, setSearchTerm] = useState('');
	const [caseSensitive, setCaseSensitive] = useState(false);
	const [wholeWord, setWholeWord] = useState(false);
	const [regex, setRegex] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (visible && inputRef.current) {
			inputRef.current.focus();
		}
	}, [visible]);

	useEffect(() => {
		if (searchTerm) {
			onSearch(searchTerm, { caseSensitive, wholeWord, regex });
		}
	}, [searchTerm, caseSensitive, wholeWord, regex]);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter') {
			if (e.shiftKey) {
				onPrevious();
			} else {
				onNext();
			}
		} else if (e.key === 'Escape') {
			onClose();
		}
	};

	if (!visible) {
		return null;
	}

	return (
		<div className="terminal-search-widget">
			<div className="search-input-container">
				<Search size={14} className="search-icon" />
				<input
					ref={inputRef}
					type="text"
					className="search-input"
					placeholder="Find in terminal..."
					value={searchTerm}
					onChange={(e) => setSearchTerm(e.target.value)}
					onKeyDown={handleKeyDown}
				/>
			</div>

			<div className="search-options">
				<button
					className={`search-option-btn ${caseSensitive ? 'active' : ''}`}
					onClick={() => setCaseSensitive(!caseSensitive)}
					title="Match Case (Alt+C)"
				>
					Aa
				</button>
				<button
					className={`search-option-btn ${wholeWord ? 'active' : ''}`}
					onClick={() => setWholeWord(!wholeWord)}
					title="Match Whole Word (Alt+W)"
				>
					\b
				</button>
				<button
					className={`search-option-btn ${regex ? 'active' : ''}`}
					onClick={() => setRegex(!regex)}
					title="Use Regular Expression (Alt+R)"
				>
					.*
				</button>
			</div>

			<div className="search-navigation">
				<button
					className="search-nav-btn"
					onClick={onPrevious}
					title="Previous Match (Shift+Enter)"
					disabled={!searchTerm}
				>
					<ChevronUp size={14} />
				</button>
				<button
					className="search-nav-btn"
					onClick={onNext}
					title="Next Match (Enter)"
					disabled={!searchTerm}
				>
					<ChevronDown size={14} />
				</button>
			</div>

			<button
				className="search-close-btn"
				onClick={onClose}
				title="Close (Escape)"
			>
				<X size={14} />
			</button>
		</div>
	);
};

export default SearchWidget;
