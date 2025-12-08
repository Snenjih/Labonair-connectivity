import React from 'react';

interface SearchBarProps {
	value: string;
	onChange: (value: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ value, onChange }) => {
	return (
		<div className="search-bar">
			<i className="codicon codicon-search"></i>
			<input
				type="text"
				placeholder="Search hosts..."
				value={value}
				onChange={e => onChange(e.target.value)}
			/>
		</div>
	);
};

export default SearchBar;
