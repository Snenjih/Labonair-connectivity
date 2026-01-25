import React, { useState, useEffect } from 'react';
import { Lock } from 'lucide-react';
import '../styles/forms.css';

interface SudoPromptDialogProps {
	remotePath: string;
	defaultPassword?: string;
	onConfirm: (password: string, remember?: boolean) => void;
	onCancel: () => void;
}

const SudoPromptDialog: React.FC<SudoPromptDialogProps> = ({
	remotePath,
	defaultPassword = '',
	onConfirm,
	onCancel
}) => {
	const [password, setPassword] = useState(defaultPassword);
	const [remember, setRemember] = useState(false);

	useEffect(() => {
		setPassword(defaultPassword);
	}, [defaultPassword]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (password.trim()) {
			onConfirm(password, remember);
		}
	};

	const handleBackdropClick = (e: React.MouseEvent) => {
		if (e.target === e.currentTarget) {
			onCancel();
		}
	};

	return (
		<div className="modal-overlay" onClick={handleBackdropClick}>
			<div className="modal-content">
				<div className="modal-header">
					<h3>
						<span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--vscode-testing-iconFailed)' }}>
							<Lock size={20} /> Permission Denied
						</span>
					</h3>
				</div>
				<div className="modal-body">
					<p>
						The file <code>{remotePath}</code> requires elevated permissions to save.
					</p>
					<p>
						Would you like to save with <strong>sudo</strong>?
					</p>
					<form onSubmit={handleSubmit}>
						<div className="form-group">
							<label htmlFor="sudo-password">Sudo Password:</label>
							<input
								id="sudo-password"
								type="password"
								className="vscode-input"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								placeholder="Enter sudo password"
								autoFocus
								required
							/>
						</div>
						<div className="form-group">
							<label className="checkbox-label">
								<input
									type="checkbox"
									checked={remember}
									onChange={(e) => setRemember(e.target.checked)}
								/>
								<span>Remember password for this session</span>
							</label>
						</div>
					</form>
				</div>
				<div className="modal-footer">
					<button className="vscode-button secondary" onClick={onCancel}>
						Cancel
					</button>
					<button
						className="vscode-button"
						onClick={handleSubmit}
						disabled={!password.trim()}
					>
						Save with Sudo
					</button>
				</div>
			</div>
		</div>
	);
};

export default SudoPromptDialog;
