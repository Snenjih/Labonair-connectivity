import React, { useState, useEffect } from 'react';
import { FileEntry } from '../../common/types';

interface BulkRenameDialogProps {
	files: FileEntry[];
	onRename: (operations: { oldPath: string; newPath: string }[]) => void;
	onClose: () => void;
}

/**
 * Bulk Rename Dialog
 * Allows renaming multiple files with regex search and replace
 */
const BulkRenameDialog: React.FC<BulkRenameDialogProps> = ({
	files,
	onRename,
	onClose
}) => {
	const [searchPattern, setSearchPattern] = useState<string>('');
	const [replaceWith, setReplaceWith] = useState<string>('');
	const [useRegex, setUseRegex] = useState<boolean>(false);
	const [caseSensitive, setCaseSensitive] = useState<boolean>(false);
	const [preview, setPreview] = useState<{ oldName: string; newName: string; oldPath: string; newPath: string }[]>([]);

	// Update preview when inputs change
	useEffect(() => {
		if (!searchPattern) {
			setPreview([]);
			return;
		}

		try {
			const previewItems = files.map(file => {
				const oldName = file.name;
				let newName: string;

				if (useRegex) {
					const flags = caseSensitive ? 'g' : 'gi';
					const regex = new RegExp(searchPattern, flags);
					newName = oldName.replace(regex, replaceWith);
				} else {
					const searchValue = caseSensitive ? searchPattern : searchPattern.toLowerCase();
					const targetValue = caseSensitive ? oldName : oldName.toLowerCase();

					if (targetValue.includes(searchValue)) {
						if (caseSensitive) {
							newName = oldName.split(searchPattern).join(replaceWith);
						} else {
							// Case-insensitive replacement
							const regex = new RegExp(escapeRegex(searchPattern), 'gi');
							newName = oldName.replace(regex, replaceWith);
						}
					} else {
						newName = oldName;
					}
				}

				// Calculate new path
				const dirPath = file.path.substring(0, file.path.lastIndexOf('/'));
				const newPath = `${dirPath}/${newName}`;

				return {
					oldName,
					newName,
					oldPath: file.path,
					newPath
				};
			});

			// Only show items that will actually change
			setPreview(previewItems.filter(item => item.oldName !== item.newName));
		} catch (error) {
			// Invalid regex
			setPreview([]);
		}
	}, [searchPattern, replaceWith, useRegex, caseSensitive, files]);

	const escapeRegex = (str: string): string => {
		return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	};

	const handleRename = () => {
		if (preview.length === 0) {
			return;
		}

		const operations = preview.map(item => ({
			oldPath: item.oldPath,
			newPath: item.newPath
		}));

		onRename(operations);
		onClose();
	};

	return (
		<div className="modal-overlay" onClick={onClose}>
			<div
				className="modal-content bulk-rename-dialog"
				onClick={(e) => e.stopPropagation()}
				style={{
					width: '600px',
					maxHeight: '80vh',
					display: 'flex',
					flexDirection: 'column'
				}}
			>
				{/* Header */}
				<div className="modal-header">
					<h2>Bulk Rename</h2>
					<button className="close-button" onClick={onClose}>×</button>
				</div>

				{/* Body */}
				<div className="modal-body" style={{ flex: 1, overflow: 'auto' }}>
					{/* Input Section */}
					<div style={{ marginBottom: '20px' }}>
						<div style={{ marginBottom: '12px' }}>
							<label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
								Search for:
							</label>
							<input
								type="text"
								className="vscode-input"
								value={searchPattern}
								onChange={(e) => setSearchPattern(e.target.value)}
								placeholder={useRegex ? 'Enter regex pattern' : 'Enter text to search'}
								autoFocus
								style={{ width: '100%' }}
							/>
						</div>

						<div style={{ marginBottom: '12px' }}>
							<label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
								Replace with:
							</label>
							<input
								type="text"
								className="vscode-input"
								value={replaceWith}
								onChange={(e) => setReplaceWith(e.target.value)}
								placeholder="Enter replacement text"
								style={{ width: '100%' }}
							/>
						</div>

						{/* Options */}
						<div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
							<label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
								<input
									type="checkbox"
									checked={useRegex}
									onChange={(e) => setUseRegex(e.target.checked)}
								/>
								<span>Use Regular Expression</span>
							</label>

							<label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
								<input
									type="checkbox"
									checked={caseSensitive}
									onChange={(e) => setCaseSensitive(e.target.checked)}
								/>
								<span>Case Sensitive</span>
							</label>
						</div>
					</div>

					{/* Preview Section */}
					<div>
						<h3 style={{ marginBottom: '8px', fontSize: '13px', fontWeight: 600 }}>
							Preview ({preview.length} file{preview.length !== 1 ? 's' : ''} will be renamed):
						</h3>

						{preview.length === 0 ? (
							<div
								style={{
									padding: '20px',
									textAlign: 'center',
									color: 'var(--vscode-descriptionForeground)',
									border: '1px dashed var(--vscode-panel-border)',
									borderRadius: '4px'
								}}
							>
								{searchPattern ? 'No matches found' : 'Enter a search pattern to see preview'}
							</div>
						) : (
							<div
								style={{
									border: '1px solid var(--vscode-panel-border)',
									borderRadius: '4px',
									maxHeight: '300px',
									overflow: 'auto'
								}}
							>
								{preview.map((item, index) => (
									<div
										key={index}
										style={{
											padding: '8px 12px',
											borderBottom: index < preview.length - 1 ? '1px solid var(--vscode-panel-border)' : 'none',
											fontSize: '12px'
										}}
									>
										<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
											<span style={{ color: 'var(--vscode-descriptionForeground)' }}>
												{item.oldName}
											</span>
											<span style={{ color: 'var(--vscode-descriptionForeground)' }}>→</span>
											<span style={{ color: 'var(--vscode-textLink-foreground)', fontWeight: 500 }}>
												{item.newName}
											</span>
										</div>
									</div>
								))}
							</div>
						)}
					</div>
				</div>

				{/* Footer */}
				<div className="modal-footer">
					<button
						className="vscode-button secondary"
						onClick={onClose}
					>
						Cancel
					</button>
					<button
						className="vscode-button primary"
						onClick={handleRename}
						disabled={preview.length === 0}
					>
						Rename {preview.length} File{preview.length !== 1 ? 's' : ''}
					</button>
				</div>
			</div>
		</div>
	);
};

export default BulkRenameDialog;
