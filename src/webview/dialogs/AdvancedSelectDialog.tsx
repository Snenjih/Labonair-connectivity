import React, { useState } from 'react';
import { Filter } from 'lucide-react';
import { SelectionCriteria } from '../../common/types';
import '../styles/forms.css';

interface AdvancedSelectDialogProps {
	onSelect: (criteria: SelectionCriteria) => void;
	onClose: () => void;
}

const AdvancedSelectDialog: React.FC<AdvancedSelectDialogProps> = ({ onSelect, onClose }) => {
	const [pattern, setPattern] = useState('');
	const [newerThanDate, setNewerThanDate] = useState('');
	const [olderThanDate, setOlderThanDate] = useState('');
	const [minSize, setMinSize] = useState('');
	const [maxSize, setMaxSize] = useState('');
	const [minSizeUnit, setMinSizeUnit] = useState<'B' | 'KB' | 'MB'>('KB');
	const [maxSizeUnit, setMaxSizeUnit] = useState<'B' | 'KB' | 'MB'>('MB');
	const [contentContains, setContentContains] = useState('');
	const [recursive, setRecursive] = useState(true);

	/**
	 * Convert size with unit to bytes
	 */
	const convertToBytes = (size: string, unit: 'B' | 'KB' | 'MB'): number | undefined => {
		const numSize = parseFloat(size);
		if (isNaN(numSize) || numSize <= 0) {
			return undefined;
		}

		switch (unit) {
			case 'B':
				return numSize;
			case 'KB':
				return numSize * 1024;
			case 'MB':
				return numSize * 1024 * 1024;
			default:
				return undefined;
		}
	};

	/**
	 * Handle form submission
	 */
	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		// Build criteria
		const criteria: SelectionCriteria = {
			pattern: pattern.trim() || undefined,
			newerThan: newerThanDate ? new Date(newerThanDate) : undefined,
			olderThan: olderThanDate ? new Date(olderThanDate) : undefined,
			minSize: minSize ? convertToBytes(minSize, minSizeUnit) : undefined,
			maxSize: maxSize ? convertToBytes(maxSize, maxSizeUnit) : undefined,
			contentContains: contentContains.trim() || undefined,
			recursive
		};

		// At least one criterion must be provided
		if (!criteria.pattern && !criteria.newerThan && !criteria.olderThan &&
		    !criteria.minSize && !criteria.maxSize && !criteria.contentContains) {
			return;
		}

		onSelect(criteria);
		onClose();
	};

	const hasAnyCriteria = pattern.trim() || newerThanDate || olderThanDate ||
	                        minSize || maxSize || contentContains.trim();

	return (
		<div className="modal-overlay" onClick={onClose}>
			<div className="modal-content" onClick={(e) => e.stopPropagation()}>
				<div className="modal-header">
					<h3>
						<Filter size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
						Advanced File Selection
					</h3>
				</div>
				<form onSubmit={handleSubmit}>
					<div className="modal-body">
						<div className="form-group">
							<label htmlFor="filename-pattern">Filename Pattern</label>
							<input
								type="text"
								id="filename-pattern"
								className="vscode-input"
								value={pattern}
								onChange={(e) => setPattern(e.target.value)}
								placeholder="*.js, *.json, src/**/*.ts"
								autoFocus
							/>
							<small style={{ color: 'var(--vscode-descriptionForeground)', display: 'block', marginTop: '4px' }}>
								Use wildcards: * (any characters), ? (single character)
							</small>
						</div>

						<div className="form-group" style={{ marginTop: '16px' }}>
							<label>Modified Date Range</label>
							<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
								<div>
									<label htmlFor="newer-than" style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground)' }}>
										Newer than:
									</label>
									<input
										type="date"
										id="newer-than"
										className="vscode-input"
										value={newerThanDate}
										onChange={(e) => setNewerThanDate(e.target.value)}
									/>
								</div>
								<div>
									<label htmlFor="older-than" style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground)' }}>
										Older than:
									</label>
									<input
										type="date"
										id="older-than"
										className="vscode-input"
										value={olderThanDate}
										onChange={(e) => setOlderThanDate(e.target.value)}
									/>
								</div>
							</div>
						</div>

						<div className="form-group" style={{ marginTop: '16px' }}>
							<label>File Size Range</label>
							<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
								<div>
									<label htmlFor="min-size" style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground)' }}>
										Minimum size:
									</label>
									<div style={{ display: 'flex', gap: '8px' }}>
										<input
											type="number"
											id="min-size"
											className="vscode-input"
											value={minSize}
											onChange={(e) => setMinSize(e.target.value)}
											placeholder="0"
											min="0"
											step="0.01"
											style={{ flex: 1 }}
										/>
										<select
											className="vscode-input"
											value={minSizeUnit}
											onChange={(e) => setMinSizeUnit(e.target.value as 'B' | 'KB' | 'MB')}
											style={{ width: '80px' }}
										>
											<option value="B">B</option>
											<option value="KB">KB</option>
											<option value="MB">MB</option>
										</select>
									</div>
								</div>
								<div>
									<label htmlFor="max-size" style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground)' }}>
										Maximum size:
									</label>
									<div style={{ display: 'flex', gap: '8px' }}>
										<input
											type="number"
											id="max-size"
											className="vscode-input"
											value={maxSize}
											onChange={(e) => setMaxSize(e.target.value)}
											placeholder="unlimited"
											min="0"
											step="0.01"
											style={{ flex: 1 }}
										/>
										<select
											className="vscode-input"
											value={maxSizeUnit}
											onChange={(e) => setMaxSizeUnit(e.target.value as 'B' | 'KB' | 'MB')}
											style={{ width: '80px' }}
										>
											<option value="B">B</option>
											<option value="KB">KB</option>
											<option value="MB">MB</option>
										</select>
									</div>
								</div>
							</div>
						</div>

						<div className="form-group" style={{ marginTop: '16px' }}>
							<label htmlFor="content-search">Content Contains</label>
							<input
								type="text"
								id="content-search"
								className="vscode-input"
								value={contentContains}
								onChange={(e) => setContentContains(e.target.value)}
								placeholder="Search text inside files..."
							/>
							<small style={{ color: 'var(--vscode-descriptionForeground)', display: 'block', marginTop: '4px' }}>
								Warning: Content search may be slow for large directories
							</small>
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

						{!hasAnyCriteria && (
							<div style={{
								marginTop: '12px',
								padding: '8px 12px',
								background: 'var(--vscode-inputValidation-warningBackground)',
								border: '1px solid var(--vscode-inputValidation-warningBorder)',
								borderRadius: '3px',
								fontSize: '12px'
							}}>
								Please provide at least one selection criterion.
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
							disabled={!hasAnyCriteria}
						>
							<Filter size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
							Select Files
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};

export default AdvancedSelectDialog;
