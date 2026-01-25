import React from 'react';
import { Search } from 'lucide-react';

interface SearchBarProps {
	value: string;
	onChange: (value: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ value, onChange }) => {
	return (
		<div className="search-bar">
			<Search size={16} className="search-icon" style={{ position: 'absolute', left: '28px', top: '50%', transform: 'translateY(-50%)', color: 'var(--terminus-text-muted)', pointerEvents: 'none' }} />
			<input
				type="text"
				placeholder="Search hosts by name, IP, username, or tags..."
				value={value}
				onChange={e => onChange(e.target.value)}
			/>
		</div>
	);
};

export default SearchBar;
