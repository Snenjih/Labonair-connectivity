import React, { useState, useEffect } from 'react';
import { Settings, Terminal, Files, Lock, Key, Activity, Shield, Info, Check, XCircle, Folder, SplitSquareHorizontal, List, Grid3x3, Save, X } from 'lucide-react';
import { Host, Tunnel, Message, Credential } from '../../common/types';
import { TagInput } from '../components/TagInput';
import { TunnelList } from '../components/TunnelList';
import vscode from '../utils/vscode';
import '../styles/forms.css';

interface EditHostProps {
	initialHost: Host | null;
	agentAvailable?: boolean;
	availableShells?: string[];
	existingFolders?: string[];
	credentials?: Credential[];
	onSave: (host: Host, password?: string, keyPath?: string) => void;
	onCancel: () => void;
}

const EditHost: React.FC<EditHostProps> = ({
	initialHost,
	agentAvailable,
	availableShells,
	existingFolders = [],
	credentials = [],
	onSave,
	onCancel
}) => {
	const [activeTab, setActiveTab] = useState<'general' | 'terminal' | 'filemanager' | 'advanced'>('general');

	// Form State - General
	const [name, setName] = useState(initialHost?.name || '');
	const [folder, setFolder] = useState(initialHost?.folder || '');
	const [protocol, setProtocol] = useState<'ssh' | 'local' | 'wsl'>(initialHost?.protocol || 'ssh');
	const [host, setHost] = useState(initialHost?.host || '');
	const [port, setPort] = useState(initialHost?.port || 22);
	const [username, setUsername] = useState(initialHost?.username || '');
	const [osIcon, setOsIcon] = useState<Host['osIcon']>(initialHost?.osIcon || 'linux');
	const [tags, setTags] = useState<string[]>(initialHost?.tags || []);
	const [jumpHostId, setJumpHostId] = useState(initialHost?.jumpHostId || '');
	const [pin, setPin] = useState(initialHost?.pin || false);

	// Auth State
	const [authType, setAuthType] = useState<'password' | 'key' | 'agent' | 'credential'>(initialHost?.authType || 'key');
	const [password, setPassword] = useState('');
	const [keyPath, setKeyPath] = useState('');
	const [credentialId, setCredentialId] = useState(initialHost?.credentialId || '');

	// Terminal Settings
	const [cursorStyle, setCursorStyle] = useState<'bar' | 'block' | 'underline'>(initialHost?.terminalCursorStyle || 'block');
	const [cursorBlink, setCursorBlink] = useState(initialHost?.terminalCursorBlink ?? true);
	const [terminalFontSize, setTerminalFontSize] = useState(initialHost?.terminalFontSize || 14);
	const [terminalFontWeight, setTerminalFontWeight] = useState(initialHost?.terminalFontWeight || 'normal');
	const [terminalLineHeight, setTerminalLineHeight] = useState(initialHost?.terminalLineHeight || 1.0);
	const [terminalLetterSpacing, setTerminalLetterSpacing] = useState(initialHost?.terminalLetterSpacing || 0);

	// File Manager Settings
	const [fileManagerLayout, setFileManagerLayout] = useState<'explorer' | 'commander'>(initialHost?.fileManagerLayout || 'explorer');
	const [defaultView, setDefaultView] = useState<'grid' | 'list'>(initialHost?.fileManagerDefaultView || 'list');
	const [localPath, setLocalPath] = useState(initialHost?.fileManagerLocalPath || '');
	const [remotePath, setRemotePath] = useState(initialHost?.defaultPath || '');

	// Advanced
	const [tunnels, setTunnels] = useState<Tunnel[]>(initialHost?.tunnels || []);
	const [notes, setNotes] = useState(initialHost?.notes || '');
	const [keepAlive, setKeepAlive] = useState(initialHost?.keepAlive || false);

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
			folder,
			host,
			port,
			username,
			osIcon,
			tags,
			pin,
			jumpHostId: jumpHostId || undefined,
			tunnels: tunnels.length > 0 ? tunnels : undefined,
			notes: notes || undefined,
			keepAlive: keepAlive || undefined,
			protocol,
			authType,
			credentialId: authType === 'credential' ? credentialId : undefined,
			enableTerminal: true,
			enableFileManager: true,
			// Terminal settings
			terminalCursorStyle: cursorStyle,
			terminalCursorBlink: cursorBlink,
			terminalFontSize,
			terminalFontWeight,
			terminalLineHeight,
			terminalLetterSpacing,
			// File Manager settings
			fileManagerLayout,
			fileManagerDefaultView: defaultView,
			fileManagerLocalPath: localPath || undefined,
			defaultPath: remotePath || undefined,
		};

		onSave(newHost, password || undefined, keyPath || undefined);
	};

	return (
		<div className="edit-host-view">
			<div className="view-header">
				<h2>{initialHost ? 'Edit Host' : 'New Host'}</h2>
				<button
					type="button"
					className="icon-button close-button"
					onClick={onCancel}
					title="Close"
				>
					<X size={20} />
				</button>
			</div>

			<div className="tabs">
				<button
					className={`tab ${activeTab === 'general' ? 'active' : ''}`}
					onClick={() => setActiveTab('general')}
				>
					<Settings size={16} />
					General
				</button>
				<button
					className={`tab ${activeTab === 'terminal' ? 'active' : ''}`}
					onClick={() => setActiveTab('terminal')}
				>
					<Terminal size={16} />
					Terminal
				</button>
				<button
					className={`tab ${activeTab === 'filemanager' ? 'active' : ''}`}
					onClick={() => setActiveTab('filemanager')}
				>
					<Files size={16} />
					File Manager
				</button>
				<button
					className={`tab ${activeTab === 'advanced' ? 'active' : ''}`}
					onClick={() => setActiveTab('advanced')}
				>
					<Settings size={16} />
					Advanced
				</button>
			</div>

			<form onSubmit={handleSubmit}>
				{/* ============ GENERAL TAB ============ */}
				{activeTab === 'general' && (
					<>
						<div className="form-section">
							<h3>Host Information</h3>
							<div className="form-group">
								<label>Label</label>
								<input className="vscode-input" value={name} onChange={e => setName(e.target.value)} placeholder="My Server" />
							</div>

							<div className="form-row">
								<div className="form-group">
									<label>Folder</label>
									<input className="vscode-input" value={folder} onChange={e => setFolder(e.target.value)} list="folder-suggestions" placeholder="Production" />
									<datalist id="folder-suggestions">
										{existingFolders.map(f => (
											<option key={f} value={f} />
										))}
										<option value="Production" />
										<option value="Staging" />
										<option value="Development" />
									</datalist>
								</div>
								<div className="form-group">
									<label>OS Icon</label>
									<select className="vscode-input" value={osIcon} onChange={e => setOsIcon(e.target.value as any)}>
										<option value="linux">Linux</option>
										<option value="windows">Windows</option>
										<option value="mac">macOS</option>
										<option value="docker">Docker</option>
										<option value="other">Other</option>
									</select>
								</div>
							</div>

							<div className="form-group">
								<label>Tags</label>
								<TagInput tags={tags} onChange={setTags} />
							</div>

							<label className="checkbox-label">
								<input type="checkbox" checked={pin} onChange={e => setPin(e.target.checked)} />
								Pin this host
							</label>
						</div>

						<div className="form-section">
							<h3>Connection</h3>
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
									<div className="form-row">
										<div className="form-group flex-2">
											<label>Host Address</label>
											<input className="vscode-input" type="text" value={host} onChange={e => setHost(e.target.value)} placeholder="192.168.1.100" required />
										</div>
										<div className="form-group flex-1">
											<label>Port</label>
											<input className="vscode-input" type="number" value={port} onChange={e => setPort(parseInt(e.target.value))} />
										</div>
									</div>
									<div className="form-group">
										<label>Username</label>
										<input className="vscode-input" type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="root" required />
									</div>

									<div className="form-group">
										<label>Authentication</label>
										<div className="segmented-control">
											<button type="button" className={authType === 'password' ? 'active' : ''} onClick={() => setAuthType('password')}>
												<Lock size={16} />
												Password
											</button>
											<button type="button" className={authType === 'key' ? 'active' : ''} onClick={() => setAuthType('key')}>
												<Key size={16} />
												Key File
											</button>
											<button type="button" className={authType === 'agent' ? 'active' : ''} onClick={() => setAuthType('agent')}>
												<Activity size={16} />
												Agent
											</button>
											<button type="button" className={authType === 'credential' ? 'active' : ''} onClick={() => setAuthType('credential')}>
												<Shield size={16} />
												Vault
											</button>
										</div>
									</div>

									{authType === 'password' && (
										<div className="form-group">
											<label>Password</label>
											<input type="password" className="vscode-input" value={password} onChange={e => setPassword(e.target.value)} placeholder={initialHost ? "Leave empty to keep unchanged" : "Enter password"} />
										</div>
									)}

									{authType === 'key' && (
										<div className="form-group">
											<label>Private Key Path</label>
											<div className="input-with-button">
												<input className="vscode-input" value={keyPath} onChange={e => setKeyPath(e.target.value)} placeholder="~/.ssh/id_rsa" />
												<button type="button" className="secondary-button" onClick={handlePickKey}>Browse...</button>
											</div>
										</div>
									)}

									{authType === 'agent' && (
										<div className="form-group">
											<div className="info-box">
												<Info size={16} />
												<span>Using SSH Agent for authentication.</span>
												{agentAvailable ?
													<span className="status-success"><Check size={16} /> Agent Detected</span> :
													<span className="status-error"><XCircle size={16} /> Agent Not Found</span>
												}
											</div>
										</div>
									)}

									{authType === 'credential' && (
										<div className="form-group">
											<label>Credential</label>
											<select className="vscode-input" value={credentialId} onChange={e => setCredentialId(e.target.value)}>
												<option value="">Select a credential...</option>
												{credentials.map(c => (
													<option key={c.id} value={c.id}>{c.name} ({c.username})</option>
												))}
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
						</div>
					</>
				)}

				{/* ============ TERMINAL TAB ============ */}
				{activeTab === 'terminal' && (
					<div className="form-section">
						<h3>Terminal Settings</h3>
						<p className="section-description">Configure the SSH terminal appearance for this host.</p>

						<div className="form-group">
							<label>Cursor Style</label>
							<div className="segmented-control">
								<button type="button" className={cursorStyle === 'bar' ? 'active' : ''} onClick={() => setCursorStyle('bar')}>
									<span className="cursor-preview cursor-bar">|</span>
									Bar
								</button>
								<button type="button" className={cursorStyle === 'block' ? 'active' : ''} onClick={() => setCursorStyle('block')}>
									<span className="cursor-preview cursor-block">█</span>
									Block
								</button>
								<button type="button" className={cursorStyle === 'underline' ? 'active' : ''} onClick={() => setCursorStyle('underline')}>
									<span className="cursor-preview cursor-underline">_</span>
									Underline
								</button>
							</div>
						</div>

						<div className="form-group">
							<label className="checkbox-label">
								<input type="checkbox" checked={cursorBlink} onChange={e => setCursorBlink(e.target.checked)} />
								Enable cursor blinking
							</label>
						</div>

						<h3>Typography</h3>
						<p className="section-description">Customize font appearance and spacing for optimal readability.</p>

						<div className="form-row">
							<div className="form-group flex-1">
								<label>Font Size</label>
								<input
									className="vscode-input"
									type="number"
									value={terminalFontSize}
									onChange={e => setTerminalFontSize(parseInt(e.target.value) || 14)}
									min="8"
									max="32"
									placeholder="14"
								/>
								<small>Font size in pixels (8-32)</small>
							</div>
							<div className="form-group flex-1">
								<label>Font Weight</label>
								<select className="vscode-input" value={terminalFontWeight} onChange={e => setTerminalFontWeight(e.target.value)}>
									<option value="normal">Normal</option>
									<option value="bold">Bold</option>
									<option value="100">Thin (100)</option>
									<option value="300">Light (300)</option>
									<option value="500">Medium (500)</option>
									<option value="600">Semi-Bold (600)</option>
									<option value="700">Bold (700)</option>
									<option value="900">Black (900)</option>
								</select>
							</div>
						</div>

						<div className="form-row">
							<div className="form-group flex-1">
								<label>Line Height</label>
								<input
									className="vscode-input"
									type="number"
									value={terminalLineHeight}
									onChange={e => setTerminalLineHeight(parseFloat(e.target.value) || 1.0)}
									min="0.5"
									max="3.0"
									step="0.1"
									placeholder="1.0"
								/>
								<small>Line height multiplier (0.5-3.0)</small>
							</div>
							<div className="form-group flex-1">
								<label>Letter Spacing</label>
								<input
									className="vscode-input"
									type="number"
									value={terminalLetterSpacing}
									onChange={e => setTerminalLetterSpacing(parseInt(e.target.value) || 0)}
									min="-5"
									max="10"
									placeholder="0"
								/>
								<small>Letter spacing in pixels (-5 to 10)</small>
							</div>
						</div>
					</div>
				)}

				{/* ============ FILE MANAGER TAB ============ */}
				{activeTab === 'filemanager' && (
					<div className="form-section">
						<h3>File Manager Settings</h3>
						<p className="section-description">Configure the SFTP file manager for this host.</p>

						<div className="form-group">
							<label>File Manager Layout</label>
							<div className="segmented-control">
								<button type="button" className={fileManagerLayout === 'explorer' ? 'active' : ''} onClick={() => setFileManagerLayout('explorer')}>
									<Folder size={16} />
									Explorer
									<span className="option-desc">Single panel, remote files only</span>
								</button>
								<button type="button" className={fileManagerLayout === 'commander' ? 'active' : ''} onClick={() => setFileManagerLayout('commander')}>
									<SplitSquareHorizontal size={16} />
									Commander
									<span className="option-desc">Dual panel, local + remote</span>
								</button>
							</div>
						</div>

						<div className="form-group">
							<label>Default View</label>
							<div className="segmented-control">
								<button type="button" className={defaultView === 'grid' ? 'active' : ''} onClick={() => setDefaultView('grid')}>
									<Grid3x3 size={16} />
									Grid View
								</button>
								<button type="button" className={defaultView === 'list' ? 'active' : ''} onClick={() => setDefaultView('list')}>
									<List size={16} />
									List View
								</button>
							</div>
						</div>

						{fileManagerLayout === 'commander' && (
							<div className="form-group">
								<label>Default Local Path</label>
								<input className="vscode-input" value={localPath} onChange={e => setLocalPath(e.target.value)} placeholder="C:\Users\username or /home/user" />
								<small>The local directory to open by default in Commander mode.</small>
							</div>
						)}

						<div className="form-group">
							<label>Default Remote Path</label>
							<input className="vscode-input" value={remotePath} onChange={e => setRemotePath(e.target.value)} placeholder="/home/user or /var/www" />
							<small>The remote directory to open by default when connecting.</small>
						</div>
					</div>
				)}

				{/* ============ ADVANCED TAB ============ */}
				{activeTab === 'advanced' && (
					<div className="form-section">
						<h3>Advanced Settings</h3>

						<div className="form-group">
							<label>Port Forwarding (Tunnels)</label>
							<TunnelList tunnels={tunnels} onChange={setTunnels} />
						</div>

						<div className="form-group">
							<label>Jump Host (Optional)</label>
							<input className="vscode-input" value={jumpHostId} onChange={e => setJumpHostId(e.target.value)} placeholder="Host ID for proxy jump" />
							<small>Connect through another host as a jump/proxy server.</small>
						</div>

						<div className="form-group">
							<label className="checkbox-label">
								<input type="checkbox" checked={keepAlive} onChange={e => setKeepAlive(e.target.checked)} />
								Enable SSH KeepAlive
							</label>
							<small>Send periodic keep-alive messages to prevent connection timeout.</small>
						</div>

						<div className="form-group">
							<label>Notes</label>
							<textarea className="vscode-input" value={notes} onChange={e => setNotes(e.target.value)} rows={4} placeholder="Add notes about this host..." />
						</div>
					</div>
				)}

				<div className="form-actions">
					<button type="button" onClick={onCancel} className="secondary-button">Cancel</button>
					<button type="submit" className="primary-button">
						<Save size={16} />
						Save Host
					</button>
				</div>
			</form>
		</div>
	);
};

export default EditHost;
