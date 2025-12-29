import React, { useState } from 'react';
import { Search } from 'lucide-react';
import '../styles/forms.css';

interface SearchDialogProps {
	onSearch: (pattern: string, content: string, recursive: boolean) => void;
	onClose: () => void;
}

const SearchDialog: React.FC<SearchDialogProps> = ({ onSearch, onClose }) => {
	const [filenamePattern, setFilenamePattern] = useState('');
	const [contentText, setContentText] = useState('');
	const [recursive, setRecursive] = useState(true);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		// At least one search criterion must be provided
		if (!filenamePattern.trim() && !contentText.trim()) {
			return;
		}

		onSearch(filenamePattern.trim(), contentText.trim(), recursive);
		onClose();
	};

	return (
		<div className="modal-overlay" onClick={onClose}>
			<div className="modal-content" onClick={(e) => e.stopPropagation()}>
				<div className="modal-header">
					<h3>
						<Search size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
						Find Files
					</h3>
				</div>
				<form onSubmit={handleSubmit}>
					<div className="modal-body">
						<div className="form-group">
							<label htmlFor="filename-pattern">Filename Pattern (e.g., *.ts, *.json)</label>
							<input
								type="text"
								id="filename-pattern"
								className="vscode-input"
								value={filenamePattern}
								onChange={(e) => setFilenamePattern(e.target.value)}
								placeholder="*.ts"
								autoFocus
							/>
							<small style={{ color: 'var(--vscode-descriptionForeground)', display: 'block', marginTop: '4px' }}>
								Use wildcards: * (any characters), ? (single character)
							</small>
						</div>

						<div className="form-group" style={{ marginTop: '16px' }}>
							<label htmlFor="content-text">Content (Text to search within files)</label>
							<input
								type="text"
								id="content-text"
								className="vscode-input"
								value={contentText}
								onChange={(e) => setContentText(e.target.value)}
								placeholder="Search text inside files..."
							/>
						</div>

						<div className="form-group" style={{ marginTop: '16px' }}>
							<label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
								<input
									type="checkbox"
									checked={recursive}
									onChange={(e) => setRecursive(e.target.checked)}
									style={{ marginRight: '8px' }}
								/>
								Search in subdirectories (recursive)
							</label>
						</div>

						{!filenamePattern.trim() && !contentText.trim() && (
							<div style={{
								marginTop: '12px',
								padding: '8px 12px',
								background: 'var(--vscode-inputValidation-warningBackground)',
								border: '1px solid var(--vscode-inputValidation-warningBorder)',
								borderRadius: '3px',
								fontSize: '12px'
							}}>
								Please provide at least a filename pattern or content text to search.
							</div>
						)}
					</div>
					<div className="modal-footer">
						<button type="button" className="vscode-button secondary" onClick={onClose}>
							Cancel
						</button>
						<button
							type="submit"
							className="vscode-button"
							disabled={!filenamePattern.trim() && !contentText.trim()}
						>
							<Search size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
							Search
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};

export default SearchDialog;
