import React, { useState } from 'react';
import { Credential } from '../../common/types';
import vscode from '../utils/vscode';

interface HostGroupProps {
	name: string;
	count: number;
	credentials?: Credential[];
	children: React.ReactNode;
}

const HostGroup: React.FC<HostGroupProps> = ({ name, count, credentials = [], children }) => {
	const [isOpen, setIsOpen] = useState(true);
	const [showSettings, setShowSettings] = useState(false);
	const [config, setConfig] = useState<{ username?: string, port?: number, credentialId?: string }>({});

	const toggleOpen = () => setIsOpen(!isOpen);

	const handleSettingsClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		setShowSettings(true);
		// Ideally we should fetch existing group config here, but we don't have it in props yet.
		// For now simple implementation: just overwrites.
		// TODO: Fetch current group settings if possible.
	};

	const handleSaveSettings = () => {
		vscode.postMessage({
			command: 'SAVE_GROUP_CONFIG',
			payload: {
				config: {
					name,
					...config
				}
			}
		});
		setShowSettings(false);
	};

	return (
		<div className="host-group">
			<div className="group-header" onClick={toggleOpen}>
				<div className="group-title">
					<i className={`codicon codicon-chevron-${isOpen ? 'down' : 'right'}`}></i>
					<span>{name}</span>
					<span className="badge">{count}</span>
				</div>
				<button className="icon-button" onClick={handleSettingsClick} title="Group Settings">
					<i className="codicon codicon-gear"></i>
				</button>
			</div>
			{isOpen && <div className="group-content">{children}</div>}

			{showSettings && (
				<div className="modal-overlay">
					<div className="modal-content">
						<h3>Settings for {name}</h3>
						<div className="form-group">
							<label>Default Username</label>
							<input
								type="text"
								value={config.username || ''}
								onChange={e => setConfig(prev => ({ ...prev, username: e.target.value }))}
								placeholder="Inherited by hosts in this group"
							/>
						</div>
						<div className="form-group">
							<label>Default Port</label>
							<input
								type="number"
								value={config.port || ''}
								onChange={e => setConfig(prev => ({ ...prev, port: parseInt(e.target.value) || undefined }))}
								placeholder="e.g. 22"
							/>
						</div>
						<div className="form-group">
							<label>Default Identity</label>
							<select
								value={config.credentialId || ''}
								onChange={e => setConfig(prev => ({ ...prev, credentialId: e.target.value }))}
							>
								<option value="">-- None --</option>
								{credentials.map(c => (
									<option key={c.id} value={c.id}>{c.name} ({c.username})</option>
								))}
							</select>
						</div>
						<div className="form-actions">
							<button className="primary-button" onClick={handleSaveSettings}>Save</button>
							<button className="secondary-button" onClick={() => setShowSettings(false)}>Cancel</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default HostGroup;
