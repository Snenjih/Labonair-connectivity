import React, { useEffect, useState, useCallback, useMemo } from 'react';
import vscode from './utils/vscode';
import { Host, WebviewState, Message, Credential, ViewType, HostStatus } from '../common/types';
import { useHostStore } from './store/useHostStore';
import Toolbar from './components/Toolbar';
import HostGroup from './components/HostGroup';
import HostCard from './components/HostCard';
import EditHost from './views/EditHost';
import CredentialsView from './views/CredentialsView';
import { FileManager } from './views/FileManager';
import TerminalView from './views/TerminalView';
import { TransferQueue } from './views/TransferQueue';
import HostKeyDialog from './dialogs/HostKeyDialog';
import SearchBar from './components/SearchBar';
import TunnelDialog from './dialogs/TunnelDialog';
import EmptyState from './components/EmptyState';
import './styles/main.css';
import './styles/transferQueue.css';

// Declare global window type for LABONAIR_CONTEXT
declare global {
	interface Window {
		LABONAIR_CONTEXT?: 'sidebar' | 'editor' | 'queue';
	}
}

const App: React.FC = () => {
	// Zustand store for hosts, credentials, sessions
	const hosts = useHostStore(state => state.hosts);
	const credentials = useHostStore(state => state.credentials);
	const activeSessionHostIds = useHostStore(state => state.activeSessionHostIds);
	const hostStatuses = useHostStore(state => state.hostStatuses);
	const selectedHostIds = useHostStore(state => state.selectedHostIds);
	const sshAgentAvailable = useHostStore(state => state.sshAgentAvailable);
	const availableShells = useHostStore(state => state.availableShells);

	// Store actions
	const setHosts = useHostStore(state => state.setHosts);
	const setCredentials = useHostStore(state => state.setCredentials);
	const setActiveSessionHostIds = useHostStore(state => state.setActiveSessionHostIds);
	const setHostStatuses = useHostStore(state => state.setHostStatuses);
	const setSelectedHostIds = useHostStore(state => state.setSelectedHostIds);
	const setSshAgentAvailable = useHostStore(state => state.setSshAgentAvailable);
	const setAvailableShells = useHostStore(state => state.setAvailableShells);
	const toggleHostSelection = useHostStore(state => state.toggleHostSelection);
	const toggleGroupSelection = useHostStore(state => state.toggleGroupSelection);
	const clearSelection = useHostStore(state => state.clearSelection);

	// Local UI state (view navigation, editing, dialogs)
	const [view, setView] = useState<ViewType>('hosts');
	const [selectedHost, setSelectedHost] = useState<Host | null>(null);
	const [hostId, setHostId] = useState<string | undefined>(undefined);
	const [currentPath, setCurrentPath] = useState<string | undefined>(undefined);

	const [filterText, setFilterText] = useState('');
	const [sortCriteria, setSortCriteria] = useState<'name' | 'lastUsed' | 'group'>('name');
	const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
	const searchBarRef = React.useRef<HTMLInputElement>(null);

	// Check if we're in editor context (Terminal/SFTP panel) vs sidebar
	const isEditorContext = window.LABONAIR_CONTEXT === 'editor';
	const isQueueContext = window.LABONAIR_CONTEXT === 'queue';

	// Dialogs
	const [tunnelDialogHost, setTunnelDialogHost] = useState<Host | null>(null);
	const [hostKeyRequest, setHostKeyRequest] = useState<{
		host: string;
		port: number;
		fingerprint: string;
		status: 'unknown' | 'invalid';
	} | null>(null);

	// Load expanded groups from localStorage on mount
	useEffect(() => {
		const saved = localStorage.getItem('labonair-expanded-groups');
		if (saved) {
			try {
				setExpandedGroups(JSON.parse(saved));
			} catch (e) {
				console.error('Failed to parse saved expanded groups', e);
			}
		}
	}, []);

	// Restore view state from vscode state (Phase 6.6Extend)
	useEffect(() => {
		const savedState = vscode.getState();
		if (savedState) {
			if (savedState.view) setView(savedState.view);
			if (savedState.filterText) setFilterText(savedState.filterText);
			if (savedState.selectedHostId) {
				const host = hosts.find(h => h.id === savedState.selectedHostId);
				if (host) setSelectedHost(host);
			}
		}
	}, []);

	// Persist view state to vscode state when it changes (Phase 6.6Extend)
	useEffect(() => {
		vscode.setState({
			view,
			filterText,
			selectedHostId: selectedHost?.id
		});
	}, [view, filterText, selectedHost]);

	// Auto-focus search bar on mount when in hosts view (Phase 6.6Extend)
	useEffect(() => {
		if (view === 'hosts' && searchBarRef.current) {
			// Small delay to ensure the component is fully rendered
			setTimeout(() => {
				searchBarRef.current?.focus();
			}, 100);
		}
	}, [view]);

	// Save expanded groups to localStorage when they change
	useEffect(() => {
		localStorage.setItem('labonair-expanded-groups', JSON.stringify(expandedGroups));
	}, [expandedGroups]);

	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message: Message = event.data;
			switch (message.command) {
				case 'UPDATE_DATA':
					// Update Zustand stores
					if (message.payload.hosts) setHosts(message.payload.hosts);
					if (message.payload.credentials) setCredentials(message.payload.credentials);
					if (message.payload.activeSessionHostIds !== undefined) {
						setActiveSessionHostIds(message.payload.activeSessionHostIds);
					}
					if (message.payload.hostStatuses) setHostStatuses(message.payload.hostStatuses);

					// Update local UI state
					if (message.payload.view) setView(message.payload.view);
					if (message.payload.hostId) setHostId(message.payload.hostId);
					if (message.payload.currentPath) setCurrentPath(message.payload.currentPath);
					break;

				case 'SESSION_UPDATE':
					setActiveSessionHostIds(message.payload.activeHostIds);
					break;

				case 'HOST_STATUS_UPDATE':
					setHostStatuses(message.payload.statuses);
					break;

				case 'CHECK_HOST_KEY':
					setHostKeyRequest(message.payload);
					break;

				case 'AVAILABLE_SHELLS':
					setAvailableShells(message.payload.shells);
					break;
			}
		};

		window.addEventListener('message', handleMessage);
		vscode.postMessage({ command: 'FETCH_DATA' });

		return () => window.removeEventListener('message', handleMessage);
	}, [setHosts, setCredentials, setActiveSessionHostIds, setHostStatuses, setAvailableShells]);

	// Focus tracking for keybinding context and keyboard shortcuts
	useEffect(() => {
		const handleFocus = () => {
			vscode.postMessage({
				command: 'SET_CONTEXT',
				payload: { key: 'labonairFocus', value: true }
			});
		};

		const handleBlur = () => {
			vscode.postMessage({
				command: 'SET_CONTEXT',
				payload: { key: 'labonairFocus', value: false }
			});
		};

		window.addEventListener('focus', handleFocus);
		window.addEventListener('blur', handleBlur);

		// Set initial focus state
		if (document.hasFocus()) {
			handleFocus();
		}

		return () => {
			window.removeEventListener('focus', handleFocus);
			window.removeEventListener('blur', handleBlur);
		};
	}, []);

	// Keyboard shortcuts - Phase 6.4Extend & 6.5Extend
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const isMod = e.metaKey || e.ctrlKey;

			// Mod+N: New Host (only when in hosts view)
			if (isMod && e.key === 'n' && view === 'hosts') {
				e.preventDefault();
				setView('addHost');
				setSelectedHost(null);
			}

			// Mod+F: Focus Search Bar (only when in hosts view)
			if (isMod && e.key === 'f' && view === 'hosts') {
				e.preventDefault();
				if (searchBarRef.current) {
					searchBarRef.current.focus();
				}
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [view]);

	// ============================================================
	// NAVIGATION
	// ============================================================
	const handleNavigate = useCallback((newView: ViewType) => {
		setView(newView);
		if (newView === 'hosts') {
			setSelectedHost(null);
		}
		if (newView === 'credentials') {
			vscode.postMessage({ command: 'GET_CREDENTIALS' });
		}
	}, []);

	// ============================================================
	// HOST ACTIONS
	// ============================================================
	const handleSaveHost = useCallback((host: Host, password?: string, keyPath?: string) => {
		vscode.postMessage({ command: 'SAVE_HOST', payload: { host, password, keyPath } });
		setView('hosts');
		setSelectedHost(null);
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
		setView('addHost');
		setSelectedHost(host);
	}, []);

	// ============================================================
	// BULK ACTIONS
	// ============================================================
	const handleToggleSelection = useCallback((id: string) => {
		toggleHostSelection(id);
	}, [toggleHostSelection]);

	const handleSelectAll = useCallback((ids: string[]) => {
		setSelectedHostIds(ids);
	}, [setSelectedHostIds]);

	const handleClearSelection = useCallback(() => {
		clearSelection();
	}, [clearSelection]);

	const handleBulkDelete = useCallback(() => {
		if (selectedHostIds && selectedHostIds.length > 0) {
			vscode.postMessage({ command: 'BULK_DELETE_HOSTS', payload: { ids: selectedHostIds } });
			clearSelection();
		}
	}, [selectedHostIds, clearSelection]);

	const handleBulkMoveToFolder = useCallback((folder: string) => {
		if (selectedHostIds && selectedHostIds.length > 0) {
			vscode.postMessage({ command: 'BULK_MOVE_TO_FOLDER', payload: { ids: selectedHostIds, folder } });
			clearSelection();
		}
	}, [selectedHostIds, clearSelection]);

	const handleBulkAssignTags = useCallback((tags: string[], mode: 'add' | 'replace') => {
		if (selectedHostIds && selectedHostIds.length > 0) {
			vscode.postMessage({ command: 'BULK_ASSIGN_TAGS', payload: { ids: selectedHostIds, tags, mode } });
			clearSelection();
		}
	}, [selectedHostIds, clearSelection]);

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
		if (selectedHostIds && selectedHostIds.length > 0) {
			vscode.postMessage({ command: 'EXPORT_HOSTS', payload: { ids: selectedHostIds } });
		}
	}, [selectedHostIds]);

	const handleExportHost = useCallback((hostId: string) => {
		vscode.postMessage({ command: 'EXPORT_HOSTS', payload: { ids: [hostId] } });
	}, []);

	const handleRefresh = useCallback(() => {
		vscode.postMessage({ command: 'FETCH_DATA' });
	}, []);

	const handleToggleGroupExpanded = useCallback((folderName: string, expanded: boolean) => {
		setExpandedGroups(prev => ({ ...prev, [folderName]: expanded }));
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
		return hosts.filter(h => {
			if (!filterText) return true;
			const lower = filterText.toLowerCase();
			return h.name.toLowerCase().includes(lower) ||
				h.host.toLowerCase().includes(lower) ||
				h.tags.some(t => t.toLowerCase().includes(lower)) ||
				(h.folder && h.folder.toLowerCase().includes(lower));
		});
	}, [hosts, filterText]);

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
		return Array.from(new Set(hosts.map(h => h.folder).filter(Boolean))) as string[];
	}, [hosts]);

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

	// Render Transfer Queue view
	if (isQueueContext) {
		return <TransferQueue />;
	}

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

			{view === 'hosts' && (
				<>
					<SearchBar
						ref={searchBarRef}
						value={filterText}
						onChange={setFilterText}
						onQuickConnect={handleQuickConnect}
					/>
					<Toolbar
						onAddHost={() => handleNavigate('addHost')}
						onImport={handleImport}
						onAddCredential={() => handleNavigate('credentials')}
						onSort={setSortCriteria}
						sortCriteria={sortCriteria}
						selectedCount={selectedHostIds?.length || 0}
						onBulkDelete={handleBulkDelete}
						onClearSelection={handleClearSelection}
					/>
					<div className="host-list">
						{hosts.length === 0 ? (
							<EmptyState onCreateHost={() => handleNavigate('addHost')} />
						) : (
							Object.entries(groupedHosts).map(([folder, folderHosts]) => (
								<HostGroup
									key={folder}
									name={folder}
									count={folderHosts.length}
									credentials={credentials}
									selectedHostIds={selectedHostIds || []}
									onToggleGroupSelection={() => {
										const groupHostIds = folderHosts.map(h => h.id);
										toggleGroupSelection(groupHostIds);
									}}
									onRenameFolder={handleRenameFolder}
									isExpanded={expandedGroups[folder] !== false}
									onToggleExpanded={handleToggleGroupExpanded}
								>
									{folderHosts.map(host => (
										<HostCard
											key={host.id}
											host={host}
											isActive={activeSessionHostIds?.includes(host.id)}
											isSelected={selectedHostIds?.includes(host.id) || false}
											status={hostStatuses?.[host.id] || 'unknown'}
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
				</>
			)}

			{view === 'addHost' && (
				<EditHost
					initialHost={selectedHost}
					agentAvailable={sshAgentAvailable}
					availableShells={availableShells || []}
					existingFolders={existingFolders}
					credentials={credentials || []}
					onSave={handleSaveHost}
					onCancel={() => handleNavigate('hosts')}
				/>
			)}

			{view === 'credentials' && (
				<CredentialsView
					credentials={credentials || []}
					onNavigateBack={() => handleNavigate('hosts')}
				/>
			)}

			{view === 'fileManager' && hostId && (
				<FileManager
					hostId={hostId}
					initialPath={currentPath}
				/>
			)}

			{view === 'terminal' && hostId && (
				<TerminalView
					hostId={hostId}
					host={hosts.find(h => h.id === hostId)}
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

