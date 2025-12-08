import React from 'react';
import '../styles/forms.css'; // Reuse form styles

interface HostKeyDialogProps {
	host: string;
	port: number;
	fingerprint: string;
	status: 'unknown' | 'invalid';
	onAccept: (save: boolean) => void;
	onDeny: () => void;
}

const HostKeyDialog: React.FC<HostKeyDialogProps> = ({ host, port, fingerprint, status, onAccept, onDeny }) => {
	return (
		<div className="modal-overlay">
			<div className="modal-content">
				<div className="modal-header">
					<h3>
						{status === 'invalid' ? (
							<span style={{ color: 'var(--vscode-testing-iconFailed)' }}>
								<i className="codicon codicon-warning"></i> WARNING: Host Key Changed!
							</span>
						) : (
							<span>Verify Host Key</span>
						)}
					</h3>
				</div>
				<div className="modal-body">
					<p>
						{status === 'invalid'
							? "The host key for this server has changed. This could mean that someone is doing something nasty!"
							: "The authenticity of host cannot be established."}
					</p>
					<div className="key-details">
						<div className="detail-row">
							<span className="label">Host:</span>
							<span className="value">{host}:{port}</span>
						</div>
						<div className="detail-row">
							<span className="label">Fingerprint:</span>
							<code className="value">{fingerprint}</code>
						</div>
					</div>
					<p>Are you sure you want to continue connecting?</p>
				</div>
				<div className="modal-footer">
					<button className="vscode-button secondary" onClick={onDeny}>Cancel Connection</button>
					<button className="vscode-button secondary" onClick={() => onAccept(false)}>Accept Once</button>
					<button className="vscode-button" onClick={() => onAccept(true)}>Accept & Save</button>
				</div>
			</div>
		</div>
	);
};

export default HostKeyDialog;
