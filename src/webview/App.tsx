import React, { useEffect, useState } from 'react';
import vscode from './utils/vscode';
import { Host, WebviewState, Message, Credential } from '../common/types';
import TopNav from './components/TopNav';
import Toolbar from './components/Toolbar';
import HostGroup from './components/HostGroup';
import HostCard from './components/HostCard';
import EditHost from './views/EditHost';
import CredentialsView from './views/CredentialsView';
import HostKeyDialog from './dialogs/HostKeyDialog';
import ScriptList from './components/ScriptList';
import SearchBar from './components/SearchBar';
import TunnelDialog from './dialogs/TunnelDialog';
import EmptyState from './components/EmptyState';

const App: React.FC = () => {
	// ... existing ...
	const [state, setState] = useState<WebviewState>({
		view: 'list',
		hosts: [],
		selectedHost: null,
		credentials: [],
		scripts: [],
		activeSessionHostIds: []
	});

	const [filterText, setFilterText] = useState('');
	const [sortCriteria, setSortCriteria] = useState<'name' | 'lastUsed' | 'group'>('name');

	// Dialogs
	const [tunnelDialogHost, setTunnelDialogHost] = useState<Host | null>(null);
	const [hostKeyRequest, setHostKeyRequest] = useState<{
		host: string;
		port: number;
		fingerprint: string;
		status: 'unknown' | 'invalid';
	} | null>(null);

	useEffect(() => {
		window.addEventListener('message', event => {
			const message: Message = event.data;
			switch (message.command) {
				case 'UPDATE_DATA':
					setState(prev => ({
						...prev,
						hosts: message.payload.hosts || prev.hosts,
						credentials: message.payload.credentials || prev.credentials,
						scripts: message.payload.scripts || prev.scripts,
						activeSessionHostIds: message.payload.activeSessionHostIds !== undefined ? message.payload.activeSessionHostIds : prev.activeSessionHostIds
					}));
					break;
				case 'SESSION_UPDATE':
					setState(prev => ({
						...prev,
						activeSessionHostIds: message.payload.activeHostIds
					}));
					break;
				case 'CHECK_HOST_KEY':
					setHostKeyRequest(message.payload);
					break;
				case 'AVAILABLE_SHELLS':
					setState(prev => ({ ...prev, availableShells: message.payload.shells }));
					break;
			}
		});

		// Initial fetch
		vscode.postMessage({ command: 'FETCH_DATA' });
	}, []);

	const handleHostKeyAccept = (save: boolean) => {
		if (hostKeyRequest) {
			vscode.postMessage({
				command: 'ACCEPT_HOST_KEY',
				payload: {
					host: hostKeyRequest.host,
					port: hostKeyRequest.port,
					fingerprint: hostKeyRequest.fingerprint,
					save
				}
			});
			setHostKeyRequest(null);
		}
	};

	const handleHostKeyDeny = () => {
		vscode.postMessage({ command: 'DENY_HOST_KEY' });
		setHostKeyRequest(null);
	};

	const handleNavigate = (view: 'list' | 'edit' | 'credentials') => {
		setState(prev => ({ ...prev, view }));
		if (view === 'credentials' && (!state.credentials || state.credentials.length === 0)) {
			vscode.postMessage({ command: 'GET_CREDENTIALS' });
		}
	};

	const handleSaveHost = (host: Host, password?: string, keyPath?: string) => {
		vscode.postMessage({ command: 'SAVE_HOST', payload: { host, password, keyPath } });
		setState(prev => ({ ...prev, view: 'list' }));
	};

	const handleDeleteHost = (id: string) => {
		vscode.postMessage({ command: 'DELETE_HOST', payload: { id } });
	};

	const handleConnect = (id: string) => {
		vscode.postMessage({ command: 'CONNECT_SSH', payload: { id } });
	};

	const handleImport = (format: 'json' | 'ssh-config') => {
		vscode.postMessage({ command: 'IMPORT_REQUEST', payload: { format } });
	};

	const handleExport = () => {
		vscode.postMessage({ command: 'EXPORT_REQUEST' });
	};

	const handleRefresh = () => { // Added handleRefresh
		vscode.postMessage({ command: 'FETCH_DATA' });
	};

	// Filtering
	const filteredHosts = state.hosts.filter(h => {
		if (!filterText) return true;
		const lower = filterText.toLowerCase();
		return h.name.toLowerCase().includes(lower) ||
			h.host.toLowerCase().includes(lower) ||
			h.tags.some(t => t.toLowerCase().includes(lower));
	});

	// Sorting
	const sortedHosts = [...filteredHosts].sort((a, b) => {
		if (sortCriteria === 'name') return a.name.localeCompare(b.name);
		if (sortCriteria === 'lastUsed') return (b.lastUsed || 0) - (a.lastUsed || 0);
		if (sortCriteria === 'group') return (a.group || 'Ungrouped').localeCompare(b.group || 'Ungrouped');
		return 0;
	});

	// Grouping
	const groupedHosts: Record<string, Host[]> = {};
	sortedHosts.forEach(host => {
		const group = host.group || 'Ungrouped';
		if (!groupedHosts[group]) groupedHosts[group] = [];
		groupedHosts[group].push(host);
	});

	return (
		<div className="app-container">
			{hostKeyRequest && (
				<HostKeyDialog
					host={hostKeyRequest.host}
					port={hostKeyRequest.port}
					fingerprint={hostKeyRequest.fingerprint}
					status={hostKeyRequest.status}
					onAccept={handleHostKeyAccept}
					onDeny={handleHostKeyDeny}
				/>
			)}
			<TopNav activeView={state.view} onNavigate={handleNavigate} />

			{state.view === 'list' && (
				<>
					<Toolbar
						onRefresh={handleRefresh}
						onImport={handleImport}
						onExport={handleExport}
						onSort={setSortCriteria}
						sortCriteria={sortCriteria}
						onQuickConnect={(input) => {
							// Parse user@host:port
							let user = '';
							let host = input;
							let port = 22;

							if (host.includes('@')) {
								const parts = host.split('@');
								user = parts[0];
								host = parts[1];
							}

							if (host.includes(':')) {
								const parts = host.split(':');
								host = parts[0];
								port = parseInt(parts[1]) || 22;
							}

							const ephemeralHost: Host = {
								id: crypto.randomUUID(),
								name: input,
								group: 'Quick Connect',
								host: host,
								port: port,
								username: user || 'root', // Default to root if no user? Or prompt?
								osIcon: 'linux',
								tags: [],
								authType: 'key' // Default to key? Or try password?
							};

							// Just connect
							vscode.postMessage({ command: 'CONNECT_SSH', payload: { host: ephemeralHost } });
						}}
					/>
					<SearchBar value={filterText} onChange={setFilterText} />
					<div className="host-list">
						{state.hosts.length === 0 ? (
							<EmptyState />
						) : (
							Object.entries(groupedHosts).map(([group, hosts]) => (
								<HostGroup key={group} name={group} count={hosts.length} credentials={state.credentials}>
									{hosts.map(host => (
										<HostCard
											key={host.id}
											host={host}
											isActive={state.activeSessionHostIds?.includes(host.id)}
											onConnect={() => handleConnect(host.id)}
											onDelete={() => handleDeleteHost(host.id)}
											onManageTunnels={() => setTunnelDialogHost(host)}
											onEdit={() => {
												setState(prev => ({ ...prev, view: 'edit', selectedHost: host }));
											}}
										/>
									))}
								</HostGroup>
							))
						)}
					</div>
					<ScriptList scripts={state.scripts || []} />
				</>
			)}

			{state.view === 'edit' && (
				<EditHost
					initialHost={state.selectedHost}
					agentAvailable={state.sshAgentAvailable}
					availableShells={state.availableShells || []}
					onSave={handleSaveHost}
					onCancel={() => setState(prev => ({ ...prev, view: 'list', selectedHost: null }))}
				/>
			)}

			{state.view === 'credentials' && (
				<CredentialsView credentials={state.credentials || []} />
			)}

			{tunnelDialogHost && (
				<TunnelDialog
					host={tunnelDialogHost}
					onSave={(updatedHost) => handleSaveHost(updatedHost)}
					onClose={() => setTunnelDialogHost(null)}
				/>
			)}
		</div>
	);
};

export default App;
