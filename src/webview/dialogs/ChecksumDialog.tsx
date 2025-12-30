import React, { useState } from 'react';
import { Check, X, Copy } from 'lucide-react';
import '../styles/checksumDialog.css';

interface ChecksumDialogProps {
	filename: string;
	checksum: string;
	algorithm: string;
	onClose: () => void;
}

const ChecksumDialog: React.FC<ChecksumDialogProps> = ({ filename, checksum, algorithm, onClose }) => {
	const [compareValue, setCompareValue] = useState('');
	const [showMatch, setShowMatch] = useState(false);
	const [isMatch, setIsMatch] = useState(false);

	/**
	 * Handles comparison
	 */
	const handleCompare = () => {
		const normalizedChecksum = checksum.toLowerCase().trim();
		const normalizedCompare = compareValue.toLowerCase().trim();
		const match = normalizedChecksum === normalizedCompare;

		setIsMatch(match);
		setShowMatch(true);
	};

	/**
	 * Copies checksum to clipboard
	 */
	const handleCopy = () => {
		// @ts-ignore - vscode is available in webview context
		vscode.postMessage({
			command: 'COPY_TO_CLIPBOARD',
			payload: { text: checksum }
		});
	};

	/**
	 * Handles dialog backdrop click
	 */
	const handleBackdropClick = (e: React.MouseEvent) => {
		if (e.target === e.currentTarget) {
			onClose();
		}
	};

	/**
	 * Formats checksum for display (adds spaces every 8 characters for readability)
	 */
	const formatChecksum = (hash: string): string => {
		return hash.match(/.{1,8}/g)?.join(' ') || hash;
	};

	return (
		<div className="modal-overlay" onClick={handleBackdropClick}>
			<div className="modal-content checksum-dialog">
				<div className="modal-header">
					<h3>File Checksum</h3>
					<button className="close-button" onClick={onClose}>×</button>
				</div>

				<div className="checksum-content">
					{/* File Info */}
					<div className="checksum-info">
						<div className="info-row">
							<span className="info-label">File:</span>
							<span className="info-value">{filename}</span>
						</div>
						<div className="info-row">
							<span className="info-label">Algorithm:</span>
							<span className="info-value">{algorithm.toUpperCase()}</span>
						</div>
					</div>

					{/* Checksum Display */}
					<div className="checksum-value-section">
						<label>Checksum:</label>
						<div className="checksum-display">
							<code className="checksum-hash">{formatChecksum(checksum)}</code>
							<button
								className="copy-button"
								onClick={handleCopy}
								title="Copy to clipboard"
							>
								<Copy size={16} />
							</button>
						</div>
					</div>

					{/* Compare Section */}
					<div className="checksum-compare-section">
						<label htmlFor="compare-input">Compare with known checksum:</label>
						<div className="compare-input-group">
							<input
								id="compare-input"
								type="text"
								className="compare-input"
								placeholder={`Paste ${algorithm.toUpperCase()} checksum here...`}
								value={compareValue}
								onChange={(e) => {
									setCompareValue(e.target.value);
									setShowMatch(false);
								}}
							/>
							<button
								className="vscode-button"
								onClick={handleCompare}
								disabled={!compareValue.trim()}
							>
								Compare
							</button>
						</div>

						{/* Match Result */}
						{showMatch && (
							<div className={`match-result ${isMatch ? 'match-success' : 'match-fail'}`}>
								{isMatch ? (
									<>
										<Check size={18} />
										<span>Checksums match! File integrity verified.</span>
									</>
								) : (
									<>
										<X size={18} />
										<span>Checksums do not match! File may be corrupted or modified.</span>
									</>
								)}
							</div>
						)}
					</div>

					{/* Info Note */}
					<div className="checksum-note">
						<p>
							<strong>Note:</strong> Checksums verify file integrity. If you received this file from
							another source, compare the checksum to ensure the file hasn't been corrupted or tampered with.
						</p>
					</div>
				</div>

				<div className="modal-footer">
					<button className="vscode-button" onClick={onClose}>
						Close
					</button>
				</div>
			</div>
		</div>
	);
};

export default ChecksumDialog;
