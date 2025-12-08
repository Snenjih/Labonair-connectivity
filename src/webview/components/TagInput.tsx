import React, { useState, KeyboardEvent } from 'react';
import '../styles/forms.css';

interface TagInputProps {
	tags: string[];
	onChange: (tags: string[]) => void;
}

export const TagInput: React.FC<TagInputProps> = ({ tags, onChange }) => {
	const [input, setInput] = useState('');

	const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter' && input.trim()) {
			e.preventDefault();
			if (!tags.includes(input.trim())) {
				onChange([...tags, input.trim()]);
			}
			setInput('');
		} else if (e.key === 'Backspace' && !input && tags.length > 0) {
			onChange(tags.slice(0, -1));
		}
	};

	const removeTag = (tagToRemove: string) => {
		onChange(tags.filter(tag => tag !== tagToRemove));
	};

	return (
		<div className="tag-input-container">
			{tags.map(tag => (
				<span key={tag} className="tag-pill">
					{tag}
					<button type="button" onClick={() => removeTag(tag)} className="tag-remove">×</button>
				</span>
			))}
			<input
				type="text"
				value={input}
				onChange={e => setInput(e.target.value)}
				onKeyDown={handleKeyDown}
				placeholder="Add tag..."
				className="tag-input-field"
			/>
		</div>
	);
};
