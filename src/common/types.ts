// ============================================================================
// TERMINUS HOST MANAGER - TYPE DEFINITIONS
// ============================================================================

export interface Tunnel {
	type: 'local' | 'remote';
	srcPort: number;
	dstHost: string;
	dstPort: number;
	autoStart?: boolean;
	maxRetries?: number;
	retryInterval?: number;
}

export interface Host {
	id: string;
	name: string;
	folder: string;              // Folder for grouping (was "group")
	username: string;
	host: string;
	port: number;
	osIcon: 'linux' | 'windows' | 'mac' | 'docker' | 'other';
	tags: string[];
	pin?: boolean;               // Pinned hosts appear first
	jumpHostId?: string;
	tunnels?: Tunnel[];
	notes?: string;
	keepAlive?: boolean;
	authType?: 'password' | 'key' | 'agent' | 'credential';
	credentialId?: string;
	lastUsed?: number;
	protocol?: 'ssh' | 'local' | 'wsl';
	enableTerminal?: boolean;    // Enable SSH terminal
	enableFileManager?: boolean; // Enable SFTP file manager
	defaultPath?: string;        // Default path for connections
	status?: 'online' | 'offline' | 'unknown';  // Connection status
	createdAt?: string;
	updatedAt?: string;
	// Terminal settings
	terminalCursorStyle?: 'bar' | 'block' | 'underline';
	terminalCursorBlink?: boolean;
	// File Manager settings
	fileManagerLayout?: 'explorer' | 'commander';
	fileManagerDefaultView?: 'grid' | 'list';
	fileManagerLocalPath?: string;
}


export interface Credential {
	id: string;
	name: string;
	username: string;
	type: 'password' | 'key';
	folder?: string;
	description?: string;
	tags?: string[];
	keyType?: string;
	usageCount?: number;
	lastUsed?: string;
	createdAt?: string;
	updatedAt?: string;
}

export interface Script {
	id: string;
	name: string;
	content: string;
	shell?: string;
}

export type ViewType = 'hosts' | 'addHost' | 'credentials' | 'addCredential';

export interface WebviewState {
	view: ViewType;
	hosts: Host[];
	selectedHost: Host | null;
	credentials?: Credential[];
	scripts?: Script[];
	sshAgentAvailable?: boolean;
	activeSessionHostIds?: string[];
	availableShells?: string[];
	hostStatuses?: Record<string, 'online' | 'offline' | 'unknown'>;
	selectedHostIds?: string[];  // For bulk selection
	editingCredential?: Credential | null;
}

export interface FolderConfig {
	name: string;
	username?: string;
	port?: number;
	credentialId?: string;
}

// ============================================================================
// MESSAGE TYPES - Webview <-> Extension Communication
// ============================================================================

export type Message =
	// Data fetching
	| { command: 'FETCH_DATA' }
	| { command: 'UPDATE_DATA'; payload: { hosts: Host[]; credentials?: Credential[]; scripts?: Script[]; activeSessionHostIds?: string[]; hostStatuses?: Record<string, 'online' | 'offline' | 'unknown'> } }

	// Host CRUD
	| { command: 'SAVE_HOST'; payload: { host: Host; password?: string; keyPath?: string } }
	| { command: 'DELETE_HOST'; payload: { id: string } }
	| { command: 'CLONE_HOST'; payload: { id: string } }
	| { command: 'TOGGLE_PIN'; payload: { id: string } }

	// Folder operations
	| { command: 'RENAME_FOLDER'; payload: { oldName: string; newName: string } }
	| { command: 'MOVE_HOST_TO_FOLDER'; payload: { hostId: string; folder: string } }

	// Bulk operations
	| { command: 'BULK_DELETE_HOSTS'; payload: { ids: string[] } }
	| { command: 'BULK_MOVE_TO_FOLDER'; payload: { ids: string[]; folder: string } }
	| { command: 'BULK_ASSIGN_TAGS'; payload: { ids: string[]; tags: string[]; mode: 'add' | 'replace' } }

	// Import/Export
	| { command: 'IMPORT_REQUEST'; payload: { format: 'json' | 'ssh-config' } }
	| { command: 'IMPORT_HOSTS'; payload: { hosts: Partial<Host>[] } }
	| { command: 'EXPORT_REQUEST' }
	| { command: 'EXPORT_HOSTS'; payload: { ids?: string[] } }

	// Connection actions
	| { command: 'CONNECT_SSH'; payload: { id?: string; host?: Host } }
	| { command: 'OPEN_SFTP'; payload: { id: string } }
	| { command: 'OPEN_STATS'; payload: { id: string } }

	// Host key verification
	| { command: 'CHECK_HOST_KEY'; payload: { host: string; port: number; fingerprint: string; status: 'unknown' | 'invalid' } }
	| { command: 'ACCEPT_HOST_KEY'; payload: { host: string; port: number; fingerprint: string; save: boolean } }
	| { command: 'DENY_HOST_KEY' }

	// Status updates
	| { command: 'SESSION_UPDATE'; payload: { activeHostIds: string[] } }
	| { command: 'HOST_STATUS_UPDATE'; payload: { statuses: Record<string, 'online' | 'offline' | 'unknown'> } }
	| { command: 'AGENT_STATUS'; payload: { available: boolean } }

	// Credentials
	| { command: 'GET_CREDENTIALS' }
	| { command: 'SAVE_CREDENTIAL'; payload: { credential: Credential; secret: string } }
	| { command: 'DELETE_CREDENTIAL'; payload: { id: string } }
	| { command: 'RENAME_CREDENTIAL_FOLDER'; payload: { oldName: string; newName: string } }

	// Scripts
	| { command: 'RUN_SCRIPT'; payload: { scriptId: string; hostId: string } }
	| { command: 'SAVE_SCRIPT'; payload: { script: Script } }
	| { command: 'DELETE_SCRIPT'; payload: { id: string } }

	// Configuration
	| { command: 'GET_CONFIG'; payload: { hostId: string } }
	| { command: 'SAVE_FOLDER_CONFIG'; payload: { config: FolderConfig } }

	// File picker
	| { command: 'PICK_KEY_FILE' }
	| { command: 'KEY_FILE_PICKED'; payload: { path: string } }

	// Shell detection
	| { command: 'AVAILABLE_SHELLS'; payload: { shells: string[] } };

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type HostStatus = 'online' | 'offline' | 'unknown';
export type AuthType = 'password' | 'key' | 'agent' | 'credential';
export type BulkTagMode = 'add' | 'replace';

