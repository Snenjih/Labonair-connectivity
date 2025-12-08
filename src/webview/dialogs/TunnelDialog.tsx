import React, { useState } from 'react';
import { Host, Tunnel } from '../../common/types';
import { TunnelList } from '../components/TunnelList';
import '../styles/forms.css';

interface TunnelDialogProps {
	host: Host;
	onSave: (updatedHost: Host) => void;
	onClose: () => void;
}

const TunnelDialog: React.FC<TunnelDialogProps> = ({ host, onSave, onClose }) => {
	const [tunnels, setTunnels] = useState<Tunnel[]>(host.tunnels || []);

	const handleSave = () => {
		const updatedHost: Host = {
			...host,
			tunnels: tunnels.length > 0 ? tunnels : undefined
		};
		onSave(updatedHost);
		onClose();
	};

	return (
		<div className="modal-overlay">
			<div className="modal-content" style={{ width: '600px' }}>
				<div className="modal-header">
					<h3>Manage Tunnels: {host.name}</h3>
					<button className="vscode-button secondary icon-only" onClick={onClose}>
						<i className="codicon codicon-close"></i>
					</button>
				</div>
				<div className="modal-body">
					<p style={{ marginBottom: '16px', color: 'var(--vscode-descriptionForeground)' }}>
						Configure local and remote port forwarding for this host.
					</p>
					<TunnelList tunnels={tunnels} onChange={setTunnels} />
				</div>
				<div className="modal-footer">
					<button className="vscode-button secondary" onClick={onClose}>Cancel</button>
					<button className="vscode-button" onClick={handleSave}>Save Tunnels</button>
				</div>
			</div>
		</div>
	);
};

export default TunnelDialog;
