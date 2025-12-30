import React, { useState, useEffect } from 'react';
import { RefreshCw, ArrowRight, ArrowLeft, Minus, AlertTriangle, Play, X } from 'lucide-react';
import { SyncItem, SyncOptions, SyncDirection } from '../../common/types';
import '../styles/forms.css';
import '../styles/syncDialog.css';

interface SyncDialogProps {
	hostId: string;
	leftPath: string;
	leftSystem: 'local' | 'remote';
	rightPath: string;
	rightSystem: 'local' | 'remote';
	onClose: () => void;
	onExecute: (items: SyncItem[]) => void;
	onStartCompare: (options: SyncOptions) => void;
}

const SyncDialog: React.FC<SyncDialogProps> = ({
	hostId,
	leftPath,
	leftSystem,
	rightPath,
	rightSystem,
	onClose,
	onExecute,
	onStartCompare
}) => {
	// Comparison options
	const [compareSize, setCompareSize] = useState(true);
	const [compareDate, setCompareDate] = useState(true);
	const [compareContent, setCompareContent] = useState(false);
	const [includePattern, setIncludePattern] = useState('');
	const [excludePattern, setExcludePattern] = useState('');

	// Comparison state
	const [isComparing, setIsComparing] = useState(false);
	const [items, setItems] = useState<SyncItem[]>([]);
	const [hasCompared, setHasCompared] = useState(false);

	// Selection state
	const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());

	// Listen for comparison results from extension
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data;

			switch (message.command) {
				case 'SYNC_COMPARE_RESULT':
					setItems(message.payload.items);
					setHasCompared(true);
					setIsComparing(false);
					// Select all items by default
					setSelectedItems(new Set(message.payload.items.map((_: SyncItem, index: number) => index)));
					break;

				case 'SYNC_PROGRESS':
					// Could show progress here if needed
					break;
			}
		};

		window.addEventListener('message', handleMessage);
		return () => window.removeEventListener('message', handleMessage);
	}, []);

	/**
	 * Start comparison
	 */
	const handleCompare = () => {
		const options: SyncOptions = {
			compareSize,
			compareDate,
			compareContent,
			includePattern: includePattern.trim() || undefined,
			excludePattern: excludePattern.trim() || undefined
		};

		setIsComparing(true);
		setHasCompared(false);
		onStartCompare(options);
	};

	/**
	 * Execute synchronization
	 */
	const handleExecute = () => {
		const selectedSyncItems = items.filter((_, index) => selectedItems.has(index));
		onExecute(selectedSyncItems);
		onClose();
	};

	/**
	 * Toggle item selection
	 */
	const toggleSelection = (index: number) => {
		setSelectedItems(prev => {
			const newSet = new Set(prev);
			if (newSet.has(index)) {
				newSet.delete(index);
			} else {
				newSet.add(index);
			}
			return newSet;
		});
	};

	/**
	 * Select/deselect all items
	 */
	const toggleSelectAll = () => {
		if (selectedItems.size === items.length) {
			setSelectedItems(new Set());
		} else {
			setSelectedItems(new Set(items.map((_, index) => index)));
		}
	};

	/**
	 * Change sync direction for an item
	 */
	const changeDirection = (index: number) => {
		setItems(prev => {
			const newItems = [...prev];
			const item = newItems[index];

			// Cycle through directions: left-to-right -> right-to-left -> skip
			let newDirection: SyncDirection;
			if (item.direction === 'left-to-right') {
				newDirection = 'right-to-left';
			} else if (item.direction === 'right-to-left') {
				newDirection = 'skip';
			} else {
				newDirection = 'left-to-right';
			}

			newItems[index] = { ...item, direction: newDirection };
			return newItems;
		});
	};

	/**
	 * Get icon for sync direction
	 */
	const getDirectionIcon = (direction: SyncDirection) => {
		switch (direction) {
			case 'left-to-right':
				return <ArrowRight size={16} className="sync-icon sync-icon-right" />;
			case 'right-to-left':
				return <ArrowLeft size={16} className="sync-icon sync-icon-left" />;
			case 'bidirectional':
				return <RefreshCw size={16} className="sync-icon sync-icon-bidirectional" />;
			case 'conflict':
				return <AlertTriangle size={16} className="sync-icon sync-icon-conflict" />;
			case 'skip':
				return <Minus size={16} className="sync-icon sync-icon-skip" />;
			default:
				return null;
		}
	};

	/**
	 * Format file size
	 */
	const formatSize = (bytes: number | undefined): string => {
		if (!bytes) {
			return '-';
		}
		if (bytes < 1024) {
			return `${bytes} B`;
		}
		if (bytes < 1024 * 1024) {
			return `${(bytes / 1024).toFixed(1)} KB`;
		}
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	};

	/**
	 * Format modification time
	 */
	const formatTime = (date: Date | undefined): string => {
		if (!date) {
			return '-';
		}
		return new Date(date).toLocaleString();
	};

	return (
		<div className="modal-overlay" onClick={onClose}>
			<div className="modal-content sync-dialog" onClick={(e) => e.stopPropagation()}>
				<div className="modal-header">
					<h3>
						<RefreshCw size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
						Directory Synchronization
					</h3>
					<button className="close-button" onClick={onClose}>
						<X size={16} />
					</button>
				</div>

				<div className="modal-body">
					{/* Comparison Settings */}
					<div className="sync-settings">
						<div className="sync-paths">
							<div className="sync-path-item">
								<label>Left:</label>
								<span className={leftSystem === 'local' ? 'path-local' : 'path-remote'}>
									{leftPath} ({leftSystem})
								</span>
							</div>
							<div className="sync-path-item">
								<label>Right:</label>
								<span className={rightSystem === 'local' ? 'path-local' : 'path-remote'}>
									{rightPath} ({rightSystem})
								</span>
							</div>
						</div>

						<div className="sync-options">
							<label className="option-label">Comparison Options:</label>
							<div className="option-checkboxes">
								<label>
									<input
										type="checkbox"
										checked={compareSize}
										onChange={(e) => setCompareSize(e.target.checked)}
										disabled={isComparing}
									/>
									Compare Size
								</label>
								<label>
									<input
										type="checkbox"
										checked={compareDate}
										onChange={(e) => setCompareDate(e.target.checked)}
										disabled={isComparing}
									/>
									Compare Date
								</label>
								<label>
									<input
										type="checkbox"
										checked={compareContent}
										onChange={(e) => setCompareContent(e.target.checked)}
										disabled={isComparing}
										title="Content comparison using checksums (slower)"
									/>
									Compare Content (Checksum)
								</label>
							</div>
						</div>

						<div className="sync-filters">
							<div className="form-group">
								<label htmlFor="include-pattern">Include Pattern (e.g., *.js, *.json)</label>
								<input
									type="text"
									id="include-pattern"
									className="vscode-input"
									value={includePattern}
									onChange={(e) => setIncludePattern(e.target.value)}
									placeholder="*.* (all files)"
									disabled={isComparing}
								/>
							</div>
							<div className="form-group">
								<label htmlFor="exclude-pattern">Exclude Pattern (e.g., node_modules/*, *.log)</label>
								<input
									type="text"
									id="exclude-pattern"
									className="vscode-input"
									value={excludePattern}
									onChange={(e) => setExcludePattern(e.target.value)}
									placeholder="Leave empty to include all"
									disabled={isComparing}
								/>
							</div>
						</div>

						<button
							className="vscode-button"
							onClick={handleCompare}
							disabled={isComparing || (!compareSize && !compareDate && !compareContent)}
						>
							<RefreshCw size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
							{isComparing ? 'Comparing...' : 'Compare Directories'}
						</button>
					</div>

					{/* Comparison Results */}
					{hasCompared && (
						<div className="sync-results">
							<div className="sync-results-header">
								<h4>
									Comparison Results ({items.length} difference{items.length !== 1 ? 's' : ''} found)
								</h4>
								<div className="sync-results-actions">
									<button className="vscode-button secondary" onClick={toggleSelectAll}>
										{selectedItems.size === items.length ? 'Deselect All' : 'Select All'}
									</button>
								</div>
							</div>

							{items.length === 0 ? (
								<div className="sync-no-differences">
									<p>No differences found. The directories are in sync.</p>
								</div>
							) : (
								<div className="sync-items-list">
									<div className="sync-items-header">
										<div className="sync-col-select">Select</div>
										<div className="sync-col-file">File</div>
										<div className="sync-col-direction">Direction</div>
										<div className="sync-col-left">Left</div>
										<div className="sync-col-right">Right</div>
										<div className="sync-col-reason">Reason</div>
									</div>
									<div className="sync-items-body">
										{items.map((item, index) => (
											<div
												key={index}
												className={`sync-item ${selectedItems.has(index) ? 'selected' : ''} ${item.direction === 'conflict' ? 'conflict' : ''}`}
											>
												<div className="sync-col-select">
													<input
														type="checkbox"
														checked={selectedItems.has(index)}
														onChange={() => toggleSelection(index)}
													/>
												</div>
												<div className="sync-col-file">
													<span className="file-name">{item.name}</span>
													<span className="file-type">{item.type === 'd' ? 'DIR' : 'FILE'}</span>
												</div>
												<div
													className="sync-col-direction"
													onClick={() => changeDirection(index)}
													title="Click to change direction"
												>
													{getDirectionIcon(item.direction)}
												</div>
												<div className="sync-col-left">
													<div className="file-info">
														<span className="file-size">{formatSize(item.leftSize)}</span>
														<span className="file-time">{formatTime(item.leftModTime)}</span>
													</div>
												</div>
												<div className="sync-col-right">
													<div className="file-info">
														<span className="file-size">{formatSize(item.rightSize)}</span>
														<span className="file-time">{formatTime(item.rightModTime)}</span>
													</div>
												</div>
												<div className="sync-col-reason">
													{item.reason}
												</div>
											</div>
										))}
									</div>
								</div>
							)}
						</div>
					)}
				</div>

				<div className="modal-footer">
					<button type="button" className="vscode-button secondary" onClick={onClose}>
						Cancel
					</button>
					{hasCompared && items.length > 0 && (
						<button
							type="button"
							className="vscode-button"
							onClick={handleExecute}
							disabled={selectedItems.size === 0}
						>
							<Play size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
							Synchronize ({selectedItems.size} {selectedItems.size === 1 ? 'file' : 'files'})
						</button>
					)}
				</div>
			</div>
		</div>
	);
};

export default SyncDialog;
