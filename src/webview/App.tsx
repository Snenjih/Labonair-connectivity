import React, { useEffect, useState, useCallback, useMemo } from 'react';
import vscode from './utils/vscode';
import { Host, WebviewState, Message, Credential, ViewType, HostStatus } from '../common/types';
import TopNav from './components/TopNav';
import Toolbar from './components/Toolbar';
import HostGroup from './components/HostGroup';
import HostCard from './components/HostCard';
import EditHost from './views/EditHost';
import CredentialsView from './views/CredentialsView';
import { FileManager } from './views/FileManager';
import TerminalView from './views/TerminalView';
import HostKeyDialog from './dialogs/HostKeyDialog';
import ScriptList from './components/ScriptList';
import SearchBar from './components/SearchBar';
import TunnelDialog from './dialogs/TunnelDialog';
import EmptyState from './components/EmptyState';
import './styles/main.css';

const App: React.FC = () => {
	const [state, setState] = useState<WebviewState>({
		view: 'hosts',
		hosts: [],
		selectedHost: null,
		credentials: [],
		scripts: [],
		activeSessionHostIds: [],
		hostStatuses: {},
		selectedHostIds: [],
		editingCredential: null
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
		const handleMessage = (event: MessageEvent) => {
			const message: Message = event.data;
			switch (message.command) {
				case 'UPDATE_DATA':
					setState(prev => ({
						...prev,
						view: message.payload.view || prev.view,
						hosts: message.payload.hosts || prev.hosts,
						credentials: message.payload.credentials || prev.credentials,
						scripts: message.payload.scripts || prev.scripts,
						activeSessionHostIds: message.payload.activeSessionHostIds !== undefined ? message.payload.activeSessionHostIds : prev.activeSessionHostIds,
						hostStatuses: message.payload.hostStatuses || prev.hostStatuses,
						hostId: message.payload.hostId || prev.hostId,
						currentPath: message.payload.currentPath || prev.currentPath
					}));
					break;
				case 'SESSION_UPDATE':
					setState(prev => ({
						...prev,
						activeSessionHostIds: message.payload.activeHostIds
					}));
					break;
				case 'HOST_STATUS_UPDATE':
					setState(prev => ({
						...prev,
						hostStatuses: message.payload.statuses
					}));
					break;
				case 'CHECK_HOST_KEY':
					setHostKeyRequest(message.payload);
					break;
				case 'AVAILABLE_SHELLS':
					setState(prev => ({ ...prev, availableShells: message.payload.shells }));
					break;
			}
		};

		window.addEventListener('message', handleMessage);
		vscode.postMessage({ command: 'FETCH_DATA' });

		return () => window.removeEventListener('message', handleMessage);
	}, []);

	// ============================================================
	// NAVIGATION
	// ============================================================
	const handleNavigate = useCallback((view: ViewType) => {
		setState(prev => ({
			...prev,
			view,
			selectedHost: view === 'hosts' ? null : prev.selectedHost,
			editingCredential: view === 'credentials' ? null : prev.editingCredential
		}));
		if (view === 'credentials') {
			vscode.postMessage({ command: 'GET_CREDENTIALS' });
		}
	}, []);

	// ============================================================
	// HOST ACTIONS
	// ============================================================
	const handleSaveHost = useCallback((host: Host, password?: string, keyPath?: string) => {
		vscode.postMessage({ command: 'SAVE_HOST', payload: { host, password, keyPath } });
		setState(prev => ({ ...prev, view: 'hosts', selectedHost: null }));
	}, []);

	const handleDeleteHost = useCallback((id: string) => {
		vscode.postMessage({ command: 'DELETE_HOST', payload: { id } });
	}, []);

	const handleConnect = useCallback((id: string) => {
		vscode.postMessage({ command: 'CONNECT_SSH', payload: { id } });
	}, []);

	const handleTogglePin = useCallback((id: string) => {
		vscode.postMessage({ command: 'TOGGLE_PIN', payload: { id } });
	}, []);

	const handleCloneHost = useCallback((id: string) => {
		vscode.postMessage({ command: 'CLONE_HOST', payload: { id } });
	}, []);

	const handleEditHost = useCallback((host: Host) => {
		setState(prev => ({ ...prev, view: 'addHost', selectedHost: host }));
	}, []);

	// ============================================================
	// BULK ACTIONS
	// ============================================================
	const handleToggleSelection = useCallback((id: string) => {
		setState(prev => {
			const selected = new Set(prev.selectedHostIds || []);
			if (selected.has(id)) {
				selected.delete(id);
			} else {
				selected.add(id);
			}
			return { ...prev, selectedHostIds: Array.from(selected) };
		});
	}, []);

	const handleSelectAll = useCallback((ids: string[]) => {
		setState(prev => ({ ...prev, selectedHostIds: ids }));
	}, []);

	const handleClearSelection = useCallback(() => {
		setState(prev => ({ ...prev, selectedHostIds: [] }));
	}, []);

	const handleBulkDelete = useCallback(() => {
		if (state.selectedHostIds && state.selectedHostIds.length > 0) {
			vscode.postMessage({ command: 'BULK_DELETE_HOSTS', payload: { ids: state.selectedHostIds } });
			handleClearSelection();
		}
	}, [state.selectedHostIds, handleClearSelection]);

	const handleBulkMoveToFolder = useCallback((folder: string) => {
		if (state.selectedHostIds && state.selectedHostIds.length > 0) {
			vscode.postMessage({ command: 'BULK_MOVE_TO_FOLDER', payload: { ids: state.selectedHostIds, folder } });
			handleClearSelection();
		}
	}, [state.selectedHostIds, handleClearSelection]);

	const handleBulkAssignTags = useCallback((tags: string[], mode: 'add' | 'replace') => {
		if (state.selectedHostIds && state.selectedHostIds.length > 0) {
			vscode.postMessage({ command: 'BULK_ASSIGN_TAGS', payload: { ids: state.selectedHostIds, tags, mode } });
			handleClearSelection();
		}
	}, [state.selectedHostIds, handleClearSelection]);

	// ============================================================
	// FOLDER ACTIONS
	// ============================================================
	const handleRenameFolder = useCallback((oldName: string, newName: string) => {
		vscode.postMessage({ command: 'RENAME_FOLDER', payload: { oldName, newName } });
	}, []);

	const handleMoveHostToFolder = useCallback((hostId: string, folder: string) => {
		vscode.postMessage({ command: 'MOVE_HOST_TO_FOLDER', payload: { hostId, folder } });
	}, []);

	// ============================================================
	// IMPORT / EXPORT
	// ============================================================
	const handleImport = useCallback((format: 'json' | 'ssh-config') => {
		vscode.postMessage({ command: 'IMPORT_REQUEST', payload: { format } });
	}, []);

	const handleExport = useCallback(() => {
		vscode.postMessage({ command: 'EXPORT_REQUEST' });
	}, []);

	const handleExportSelected = useCallback(() => {
		if (state.selectedHostIds && state.selectedHostIds.length > 0) {
			vscode.postMessage({ command: 'EXPORT_HOSTS', payload: { ids: state.selectedHostIds } });
		}
	}, [state.selectedHostIds]);

	const handleExportHost = useCallback((hostId: string) => {
		vscode.postMessage({ command: 'EXPORT_HOSTS', payload: { ids: [hostId] } });
	}, []);

	const handleRefresh = useCallback(() => {
		vscode.postMessage({ command: 'FETCH_DATA' });
	}, []);

	// ============================================================
	// HOST KEY DIALOG
	// ============================================================
	const handleHostKeyAccept = useCallback((save: boolean) => {
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
	}, [hostKeyRequest]);

	const handleHostKeyDeny = useCallback(() => {
		vscode.postMessage({ command: 'DENY_HOST_KEY' });
		setHostKeyRequest(null);
	}, []);

	// ============================================================
	// SFTP / STATS (TODO)
	// ============================================================
	const handleOpenSftp = useCallback((id: string) => {
		// TODO: Implement SFTP
		vscode.postMessage({ command: 'OPEN_SFTP', payload: { id } });
	}, []);

	const handleOpenStats = useCallback((id: string) => {
		// TODO: Implement Stats
		vscode.postMessage({ command: 'OPEN_STATS', payload: { id } });
	}, []);

	// ============================================================
	// FILTERING & SORTING
	// ============================================================
	const filteredHosts = useMemo(() => {
		return state.hosts.filter(h => {
			if (!filterText) return true;
			const lower = filterText.toLowerCase();
			return h.name.toLowerCase().includes(lower) ||
				h.host.toLowerCase().includes(lower) ||
				h.tags.some(t => t.toLowerCase().includes(lower)) ||
				(h.folder && h.folder.toLowerCase().includes(lower));
		});
	}, [state.hosts, filterText]);

	const sortedHosts = useMemo(() => {
		return [...filteredHosts].sort((a, b) => {
			// Pinned first
			if (a.pin && !b.pin) return -1;
			if (!a.pin && b.pin) return 1;

			// Then by criteria
			if (sortCriteria === 'name') return a.name.localeCompare(b.name);
			if (sortCriteria === 'lastUsed') return (b.lastUsed || 0) - (a.lastUsed || 0);
			if (sortCriteria === 'group') return (a.folder || 'Uncategorized').localeCompare(b.folder || 'Uncategorized');
			return 0;
		});
	}, [filteredHosts, sortCriteria]);

	// Group by folder
	const groupedHosts = useMemo(() => {
		const grouped: Record<string, Host[]> = {};
		sortedHosts.forEach(host => {
			const folder = host.folder || 'Uncategorized';
			if (!grouped[folder]) grouped[folder] = [];
			grouped[folder].push(host);
		});

		// Sort folders: Uncategorized first, then alphabetical
		const sortedFolders = Object.keys(grouped).sort((a, b) => {
			if (a === 'Uncategorized') return -1;
			if (b === 'Uncategorized') return 1;
			return a.localeCompare(b);
		});

		const result: Record<string, Host[]> = {};
		sortedFolders.forEach(f => { result[f] = grouped[f]; });
		return result;
	}, [sortedHosts]);

	const existingFolders = useMemo(() => {
		return Array.from(new Set(state.hosts.map(h => h.folder).filter(Boolean))) as string[];
	}, [state.hosts]);

	// ============================================================
	// QUICK CONNECT
	// ============================================================
	const handleQuickConnect = useCallback((input: string) => {
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
			folder: 'Quick Connect',
			host: host,
			port: port,
			username: user || 'root',
			osIcon: 'linux',
			tags: [],
			authType: 'key',
			enableTerminal: true,
			enableFileManager: true,
		};

		vscode.postMessage({ command: 'CONNECT_SSH', payload: { host: ephemeralHost } });
	}, []);

	// ============================================================
	// RENDER
	// ============================================================
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

			{state.view === 'hosts' && (
				<>
					<Toolbar
						onImport={handleImport}
						onSort={setSortCriteria}
						sortCriteria={sortCriteria}
						onQuickConnect={handleQuickConnect}
						selectedCount={state.selectedHostIds?.length || 0}
						onBulkDelete={handleBulkDelete}
					/>
					<SearchBar value={filterText} onChange={setFilterText} />
					<div className="host-list">
						{state.hosts.length === 0 ? (
							<EmptyState />
						) : (
							Object.entries(groupedHosts).map(([folder, hosts]) => (
								<HostGroup
									key={folder}
									name={folder}
									count={hosts.length}
									credentials={state.credentials}
									selectedHostIds={state.selectedHostIds || []}
									onSelectAll={(selected) => {
										if (selected) {
											handleSelectAll([...(state.selectedHostIds || []), ...hosts.map(h => h.id)]);
										} else {
											const hostIds = new Set(hosts.map(h => h.id));
											setState(prev => ({
												...prev,
												selectedHostIds: (prev.selectedHostIds || []).filter(id => !hostIds.has(id))
											}));
										}
									}}
									onRenameFolder={handleRenameFolder}
								>
									{hosts.map(host => (
										<HostCard
											key={host.id}
											host={host}
											isActive={state.activeSessionHostIds?.includes(host.id)}
											isSelected={state.selectedHostIds?.includes(host.id) || false}
											status={state.hostStatuses?.[host.id] || 'unknown'}
											onConnect={() => handleConnect(host.id)}
											onDelete={() => handleDeleteHost(host.id)}
											onManageTunnels={() => setTunnelDialogHost(host)}
											onEdit={() => handleEditHost(host)}
											onTogglePin={() => handleTogglePin(host.id)}
											onToggleSelect={() => handleToggleSelection(host.id)}
											onOpenSftp={() => handleOpenSftp(host.id)}
											onClone={() => handleCloneHost(host.id)}
											onExport={() => handleExportHost(host.id)}
											onMoveToFolder={handleMoveHostToFolder}
										/>
									))}
								</HostGroup>
							))
						)}
					</div>
					<ScriptList scripts={state.scripts || []} />
				</>
			)}

			{state.view === 'addHost' && (
				<EditHost
					initialHost={state.selectedHost}
					agentAvailable={state.sshAgentAvailable}
					availableShells={state.availableShells || []}
					existingFolders={existingFolders}
					credentials={state.credentials || []}
					onSave={handleSaveHost}
					onCancel={() => handleNavigate('hosts')}
				/>
			)}

			{state.view === 'credentials' && (
				<CredentialsView
					credentials={state.credentials || []}
				/>
			)}

			{state.view === 'fileManager' && state.hostId && (
				<FileManager
					hostId={state.hostId}
					initialPath={state.currentPath}
				/>
			)}

			{state.view === 'terminal' && state.hostId && (
				<TerminalView
					hostId={state.hostId}
					host={state.hosts.find(h => h.id === state.hostId)}
				/>
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

