import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface PasteModalProps {
	content: string;
	onConfirm: () => void;
	onCancel: () => void;
}

const PasteModal: React.FC<PasteModalProps> = ({ content, onConfirm, onCancel }) => {
	const lineCount = content.split('\n').length;
	const preview = content.substring(0, 500) + (content.length > 500 ? '...' : '');

	return (
		<div className="paste-modal-overlay">
			<div className="paste-modal">
				<div className="paste-modal-header">
					<AlertTriangle size={24} color="var(--vscode-editorWarning-foreground)" />
					<h3>Paste Multiple Lines?</h3>
				</div>

				<div className="paste-modal-body">
					<p>
						You are about to paste <strong>{lineCount} line(s)</strong> into the terminal.
						This may execute multiple commands.
					</p>

					<div className="paste-modal-preview">
						<div className="paste-modal-preview-header">Preview:</div>
						<pre className="paste-modal-preview-content">{preview}</pre>
					</div>
				</div>

				<div className="paste-modal-actions">
					<button
						className="paste-modal-button paste-modal-button-cancel"
						onClick={onCancel}
					>
						Cancel
					</button>
					<button
						className="paste-modal-button paste-modal-button-confirm"
						onClick={onConfirm}
					>
						Paste
					</button>
				</div>
			</div>
		</div>
	);
};

export default PasteModal;
