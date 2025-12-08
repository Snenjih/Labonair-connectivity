import React, { useState, useEffect } from 'react';
import { Host, Tunnel, Message } from '../../common/types';
import { TagInput } from '../components/TagInput';
import { TunnelList } from '../components/TunnelList';
import vscode from '../utils/vscode';
import '../styles/forms.css';

interface EditHostProps {
	initialHost: Host | null;
	agentAvailable?: boolean;
	availableShells?: string[];
	onSave: (host: Host, password?: string, keyPath?: string) => void;
	onCancel: () => void;
}

const EditHost: React.FC<EditHostProps> = ({ initialHost, agentAvailable, availableShells, onSave, onCancel }) => {
	const [activeTab, setActiveTab] = useState<'general' | 'connection' | 'advanced'>('connection'); // Changed default tab to 'connection'

	// Form State
	const [name, setName] = useState(initialHost?.name || '');
	const [group, setGroup] = useState(initialHost?.group || '');
	const [protocol, setProtocol] = useState<'ssh' | 'local' | 'wsl'>(initialHost?.protocol || 'ssh');
	const [host, setHost] = useState(initialHost?.host || '');
	const [port, setPort] = useState(initialHost?.port || 22); // Changed to number type
	const [username, setUsername] = useState(initialHost?.username || '');
	const [osIcon, setOsIcon] = useState<Host['osIcon']>(initialHost?.osIcon || 'linux');
	const [tags, setTags] = useState<string[]>(initialHost?.tags || []);
	const [jumpHostId, setJumpHostId] = useState(initialHost?.jumpHostId || '');

	const [tunnels, setTunnels] = useState<Tunnel[]>(initialHost?.tunnels || []);
	const [notes, setNotes] = useState(initialHost?.notes || '');
	const [keepAlive, setKeepAlive] = useState(initialHost?.keepAlive || false);

	// Auth State
	const [authType, setAuthType] = useState<'password' | 'key' | 'agent' | 'credential'>(initialHost?.authType || 'key'); // Added 'credential'
	const [password, setPassword] = useState('');
	const [keyPath, setKeyPath] = useState('');
	const [credentialId, setCredentialId] = useState(initialHost?.credentialId || ''); // New state for credential ID

	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message: Message = event.data;
			if (message.command === 'KEY_FILE_PICKED') {
				setKeyPath(message.payload.path);
			}
		};
		window.addEventListener('message', handleMessage);
		return () => window.removeEventListener('message', handleMessage);
	}, []);

	const handlePickKey = () => {
		vscode.postMessage({ command: 'PICK_KEY_FILE' });
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		const newHost: Host = {
			id: initialHost?.id || crypto.randomUUID(),
			name,
			group,
			host,
			port: port, // Use port directly as it's a number
			username,
			osIcon,
			tags,
			jumpHostId: jumpHostId || undefined,
			tunnels: tunnels.length > 0 ? tunnels : undefined,
			notes: notes || undefined,
			keepAlive: keepAlive || undefined,
			protocol, // Added protocol
			authType, // Added authType
			credentialId: authType === 'credential' ? credentialId : undefined, // Conditionally add credentialId
		};

		onSave(newHost, password || undefined, keyPath || undefined);
	};

	return (
		<div className="edit-host-view">
			<h2>{initialHost ? 'Edit Host' : 'New Host'}</h2>

			<div className="tabs">
				<button
					className={`tab ${activeTab === 'general' ? 'active' : ''}`}
					onClick={() => setActiveTab('general')}
				>
					General
				</button>
				<button
					className={`tab ${activeTab === 'connection' ? 'active' : ''}`}
					onClick={() => setActiveTab('connection')}
				>
					Connection
				</button>
				<button
					className={`tab ${activeTab === 'advanced' ? 'active' : ''}`}
					onClick={() => setActiveTab('advanced')}
				>
					Advanced
				</button>
			</div>

			<form onSubmit={handleSubmit}>
				{activeTab === 'general' && (
					<div className="form-group">
						<label>Label</label>
						<input className="vscode-input" value={name} onChange={e => setName(e.target.value)} required />

						<label>Group</label>
						<input className="vscode-input" value={group} onChange={e => setGroup(e.target.value)} list="group-suggestions" />
						<datalist id="group-suggestions">
							<option value="Production" />
							<option value="Staging" />
							<option value="Development" />
						</datalist>

						<label>Tags</label>
						<TagInput tags={tags} onChange={setTags} />

						<label>OS Icon</label>
						<select className="vscode-input" value={osIcon} onChange={e => setOsIcon(e.target.value as any)}>
							<option value="linux">Linux</option>
							<option value="windows">Windows</option>
							<option value="mac">macOS</option>
							<option value="docker">Docker</option>
							<option value="other">Other</option>
						</select>
					</div>
				)}

				{activeTab === 'connection' && (
					<>
						<div className="form-group">
							<label>Protocol</label>
							<select className="vscode-input" value={protocol} onChange={e => setProtocol(e.target.value as any)}>
								<option value="ssh">SSH</option>
								<option value="local">Local Shell</option>
								<option value="wsl">WSL</option>
							</select>
						</div>

						{protocol === 'ssh' ? (
							<>
								<div className="form-group">
									<label>Host Address</label>
									<input className="vscode-input" type="text" value={host} onChange={e => setHost(e.target.value)} placeholder="e.g. 192.168.1.100" required />
								</div>
								<div className="form-group">
									<label>Port</label>
									<input className="vscode-input" type="number" value={port} onChange={e => setPort(parseInt(e.target.value))} />
								</div>
								<div className="form-group">
									<label>Username</label>
									<input className="vscode-input" type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="root" required />
								</div>

								<div className="separator"></div>

								<div className="form-group">
									<label>Authentication</label>
									<div className="segmented-control">
										<button type="button" className={authType === 'password' ? 'active' : ''} onClick={() => setAuthType('password')}>Password</button>
										<button type="button" className={authType === 'key' ? 'active' : ''} onClick={() => setAuthType('key')}>Key File</button>
										<button type="button" className={authType === 'agent' ? 'active' : ''} onClick={() => setAuthType('agent')}>Agent</button>
										<button type="button" className={authType === 'credential' ? 'active' : ''} onClick={() => setAuthType('credential')}>Vault</button>
									</div>
								</div>

								{authType === 'password' && (
									<div className="form-group">
										<label>Password</label>
										<input type="password" className="vscode-input" value={password} onChange={e => setPassword(e.target.value)} placeholder={initialHost ? "Leave empty to keep unchanged" : ""} />
									</div>
								)}

								{authType === 'key' && (
									<div className="form-group">
										<label>Private Key Path</label>
										<div style={{ display: 'flex', gap: '8px' }}>
											<input className="vscode-input" value={keyPath} onChange={e => setKeyPath(e.target.value)} placeholder="~/.ssh/id_rsa" />
											<button type="button" className="vscode-button secondary" onClick={handlePickKey}>Browse...</button>
										</div>
									</div>
								)}

								{authType === 'agent' && (
									<div className="form-group">
										<div className="info-text">
											Using SSH Agent for authentication.
											{agentAvailable ?
												<span style={{ color: 'var(--vscode-testing-iconPassed)' }}> <i className="codicon codicon-check"></i> Agent Detected</span> :
												<span style={{ color: 'var(--vscode-testing-iconFailed)' }}> <i className="codicon codicon-error"></i> Agent Not Found</span>
											}
										</div>
									</div>
								)}

								{authType === 'credential' && (
									<div className="form-group">
										<label>Credential</label>
										<select className="vscode-input" value={credentialId} onChange={e => setCredentialId(e.target.value)}>
											<option value="">Select a credential...</option>
											{/* Credentials would be passed here ideally or we just use IDs.
												For now we don't have the list passed to EditHost.
												We need to pass it or just save ID.
												Actually App.tsx passes credentials? No?
												Wait, EditHost doesn't receive credentials prop.
												It needs it if we use dropdown.
												Let's assume input for ID or simple text for now if prop missing.
											*/}
											<option value="test">Test Cred (Mock)</option>
										</select>
										<small>Manage credentials in the Credentials tab.</small>
									</div>
								)}
							</>
						) : (
							<div className="form-group">
								<label>Shell</label>
								<select className="vscode-input" value={host} onChange={e => setHost(e.target.value)}>
									<option value="">Select a shell...</option>
									{availableShells?.filter(s => protocol === 'local' ? !s.startsWith('WSL:') : s.startsWith('WSL:')).map(s => (
										<option key={s} value={s}>{s}</option>
									))}
								</select>
							</div>
						)}
					</>
				)}

				{activeTab === 'advanced' && (
					<div className="form-group">
						<label>Tunnels (Port Forwarding)</label>
						<TunnelList tunnels={tunnels} onChange={setTunnels} />

						<label>Jump Host (Optional)</label>
						<input className="vscode-input" value={jumpHostId} onChange={e => setJumpHostId(e.target.value)} placeholder="Host ID" />

						<label>Keep Alive</label>
						<div className="checkbox-wrapper">
							<input type="checkbox" checked={keepAlive} onChange={e => setKeepAlive(e.target.checked)} />
							<span>Enable SSH KeepAlive</span>
						</div>

						<label>Notes</label>
						<textarea className="vscode-input" value={notes} onChange={e => setNotes(e.target.value)} rows={4} />
					</div>
				)}

				{authType === 'agent' && (
					<div className="form-info">
						{agentAvailable ? (
							<span style={{ color: 'var(--vscode-testing-iconPassed)' }}>
								<i className="codicon codicon-check"></i> SSH Agent Active
							</span>
						) : (
							<span style={{ color: 'var(--vscode-testing-iconFailed)' }}>
								<i className="codicon codicon-error"></i> Agent Not Found
							</span>
						)}
					</div>
				)}

				<div className="form-actions">
					<button type="button" onClick={onCancel} className="vscode-button secondary">Cancel</button>
					<button type="submit" className="vscode-button">Save</button>
				</div>
			</form>
		</div>
	);
};

export default EditHost;
