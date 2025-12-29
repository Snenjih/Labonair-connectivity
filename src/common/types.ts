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
	maxAuthTries?: number;           // Maximum authentication attempts (default: 3)
	lastUsed?: number;
	protocol?: 'ssh' | 'local' | 'wsl';
	shell?: string;              // Shell to use for local connections
	wsl?: boolean;               // Use WSL for this host
	enableTerminal?: boolean;    // Enable SSH terminal
	enableFileManager?: boolean; // Enable SFTP file manager
	defaultPath?: string;        // Default path for connections
	encoding?: string;           // Character encoding (default: UTF-8)
	status?: 'online' | 'offline' | 'unknown';  // Connection status
	createdAt?: string;
	updatedAt?: string;
	// Terminal settings
	terminalCursorStyle?: 'bar' | 'block' | 'underline';
	terminalCursorBlink?: boolean;
	terminalCopyOnSelect?: boolean;    // Copy to clipboard when text is selected
	terminalRightClickBehavior?: 'paste' | 'menu'; // Right-click behavior: paste or show context menu
	postExecScript?: string[];         // Commands to execute after shell session starts
	// File Manager settings
	fileManagerLayout?: 'explorer' | 'commander';
	fileManagerDefaultView?: 'grid' | 'list';
	fileManagerLocalPath?: string;
	// Sudo Save Mode: 'credential' uses host password, 'prompt' asks each time, 'cache' caches for session
	sudoSaveMode?: 'credential' | 'prompt' | 'cache';
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


export interface FileEntry {
	name: string;
	path: string;
	size: number;
	type: 'd' | '-' | 'l';  // directory, file, or symlink
	modTime: Date;
	permissions: string;
	owner?: string;         // Owner username
	group?: string;         // Group name
	symlinkTarget?: string; // Target path if type is 'l'
}

export interface TransferStatus {
	filename: string;
	progress: number;  // 0-100
	speed: string;
	type: 'upload' | 'download';
}

// ============================================================================
// TRANSFER ENGINE TYPES (Subphase 3.5)
// ============================================================================

export type TransferJobStatus = 'pending' | 'active' | 'paused' | 'completed' | 'error' | 'cancelled';

export interface BaseTransferJob {
	id: string;
	hostId: string;
	filename: string;
	size: number;
	status: TransferJobStatus;
	progress: number;  // 0-100
	speed: number;     // bytes per second
	bytesTransferred: number;
	error?: string;
	priority: number;  // Higher = more priority
	createdAt: number;
	startedAt?: number;
	completedAt?: number;
}

export interface UploadJob extends BaseTransferJob {
	type: 'upload';
	localPath: string;
	remotePath: string;
}

export interface DownloadJob extends BaseTransferJob {
	type: 'download';
	remotePath: string;
	localPath: string;
}

export type TransferJob = UploadJob | DownloadJob;

export interface TransferQueueSummary {
	activeCount: number;
	totalSpeed: number;  // Total speed in bytes/s across all active transfers
	queuedCount: number;
}

export type ViewType = 'hosts' | 'addHost' | 'credentials' | 'addCredential' | 'fileManager' | 'terminal';

export interface WebviewState {
	view: ViewType;
	hosts: Host[];
	selectedHost: Host | null;
	credentials?: Credential[];
	sshAgentAvailable?: boolean;
	activeSessionHostIds?: string[];
	availableShells?: string[];
	hostStatuses?: Record<string, 'online' | 'offline' | 'unknown'>;
	selectedHostIds?: string[];  // For bulk selection
	editingCredential?: Credential | null;
	// File Manager specific
	hostId?: string;
	currentPath?: string;
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
	| { command: 'UPDATE_DATA'; payload: { view?: ViewType; hosts?: Host[]; credentials?: Credential[]; activeSessionHostIds?: string[]; hostStatuses?: Record<string, 'online' | 'offline' | 'unknown'>; hostId?: string; currentPath?: string } }

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

	// Configuration
	| { command: 'GET_CONFIG'; payload: { hostId: string } }
	| { command: 'SAVE_FOLDER_CONFIG'; payload: { config: FolderConfig } }

	// File picker
	| { command: 'PICK_KEY_FILE' }
	| { command: 'KEY_FILE_PICKED'; payload: { path: string } }

	// Shell detection
	| { command: 'AVAILABLE_SHELLS'; payload: { shells: string[] } }

	// SFTP File Manager
	| { command: 'SFTP_LS'; payload: { hostId: string; path: string; panelId?: 'left' | 'right' } }
	| { command: 'SFTP_LS_RESPONSE'; payload: { files: FileEntry[]; currentPath: string; panelId?: 'left' | 'right' } }
	| { command: 'SFTP_UPLOAD'; payload: { hostId: string; remotePath: string; localPath?: string } }
	| { command: 'SFTP_DOWNLOAD'; payload: { hostId: string; remotePath: string; localPath?: string } }
	| { command: 'SFTP_RM'; payload: { hostId: string; path: string } }
	| { command: 'SFTP_MKDIR'; payload: { hostId: string; path: string } }
	| { command: 'SFTP_RENAME'; payload: { hostId: string; oldPath: string; newPath: string } }
	| { command: 'SFTP_STAT'; payload: { hostId: string; path: string } }
	| { command: 'SFTP_STAT_RESPONSE'; payload: { file: FileEntry } }
	| { command: 'SFTP_TRANSFER_PROGRESS'; payload: TransferStatus }
	| { command: 'SFTP_ERROR'; payload: { message: string } }
	| { command: 'NAVIGATE'; payload: { path: string; panelId?: 'left' | 'right' } }
	| { command: 'RESOLVE_SYMLINK'; payload: { hostId: string; symlinkPath: string; panelId?: 'left' | 'right' } }

	// Edit-on-Fly
	| { command: 'EDIT_FILE'; payload: { hostId: string; remotePath: string } }
	| { command: 'FILE_OPENED'; payload: { localUri: string; remotePath: string } }
	| { command: 'FILE_SAVED'; payload: { localUri: string; remotePath: string; success: boolean; error?: string } }
	| { command: 'UPLOAD_PROGRESS'; payload: { remotePath: string; progress: number } }
	| { command: 'SUDO_SAVE_REQUIRED'; payload: { remotePath: string; error: string } }
	| { command: 'SUDO_SAVE_CONFIRM'; payload: { remotePath: string; password?: string } }

	// File Operations
	| { command: 'COPY_PATH'; payload: { path: string } }
	| { command: 'FILE_PROPERTIES'; payload: { hostId: string; path: string } }
	| { command: 'DIFF_FILES'; payload: { hostId: string; remotePath: string; localPath?: string } }
	| { command: 'SFTP_NEW_FILE'; payload: { hostId: string; path: string } }
	| { command: 'SFTP_MOVE'; payload: { hostId: string; sourcePaths: string[]; targetPath: string; sourcePanel?: 'left' | 'right' } }
	| { command: 'OPEN_TERMINAL'; payload: { hostId: string; path: string } }

	// SSH Terminal
	| { command: 'TERM_DATA'; payload: { data: string; splitId?: number } }
	| { command: 'TERM_INPUT'; payload: { data: string; splitId?: number } }
	| { command: 'TERM_RESIZE'; payload: { cols: number; rows: number; splitId?: number } }
	| { command: 'TERM_STATUS'; payload: { status: 'connecting' | 'connected' | 'disconnected' | 'error'; message?: string; splitId?: number } }
	| { command: 'TERM_RECONNECT'; payload: { hostId: string } }
	| { command: 'CHECK_FILE'; payload: { path: string; hostId: string } }
	| { command: 'OPEN_REMOTE_FILE'; payload: { hostId: string; remotePath: string; content: string } }
	| { command: 'OPEN_REMOTE_RESOURCE'; payload: { path: string; hostId: string } }
	| { command: 'TERMINAL_SPLIT'; payload: { mode: 'vertical' | 'horizontal' } }
	| { command: 'TERMINAL_CLOSE_SPLIT'; payload: { splitId: number } }
	| { command: 'SAVE_TERMINAL_CONFIG'; payload: { fontSize: number; encoding: string; colorScheme: string } }
	| { command: 'CHANGE_ENCODING'; payload: { encoding: string; splitId?: number } }

	// Transfer Engine (Subphase 3.5)
	| { command: 'TRANSFER_QUEUE'; payload: { action: 'add'; job: Partial<TransferJob> } }
	| { command: 'TRANSFER_QUEUE'; payload: { action: 'pause' | 'resume' | 'cancel'; jobId: string } }
	| { command: 'TRANSFER_QUEUE'; payload: { action: 'clear_completed' } }
	| { command: 'TRANSFER_UPDATE'; payload: { job: TransferJob } }
	| { command: 'TRANSFER_QUEUE_STATE'; payload: { jobs: TransferJob[]; summary: TransferQueueSummary } }
	| { command: 'TRANSFER_CONFLICT'; payload: { transferId: string; sourceFile: string; targetStats: { size: number; modTime: Date } } }
	| { command: 'RESOLVE_CONFLICT'; payload: { transferId: string; action: 'overwrite' | 'resume' | 'rename' | 'skip'; applyToAll?: boolean } }

	// Media Preview (Subphase 3.5)
	| { command: 'PREVIEW_FILE'; payload: { hostId: string; remotePath: string; fileType: 'image' | 'pdf' | 'binary' } }

	// Archive Handling (Subphase 3.5)
	| { command: 'EXTRACT_ARCHIVE'; payload: { hostId: string; archivePath: string } }
	| { command: 'COMPRESS_FILES'; payload: { hostId: string; paths: string[]; archiveName: string; archiveType: 'zip' | 'tar' | 'tar.gz' } }
	| { command: 'PROMPT_SMART_UPLOAD'; payload: { fileCount: number; totalSize: number; targetPath: string } }
	| { command: 'SMART_UPLOAD_RESPONSE'; payload: { accept: boolean } }

	// Broadcast (Subphase 3.5)
	| { command: 'BROADCAST_COMMAND'; payload: { hostIds: string[]; command: string } }
	| { command: 'BROADCAST_STATUS'; payload: { hostId: string; success: boolean; output?: string; error?: string } }

	// Tunnel Management (Subphase 3.6)
	| { command: 'TUNNEL_STATUS'; payload: { hostId: string; tunnels: Array<{ type: 'local' | 'remote'; srcPort: number; dstHost: string; dstPort: number; status: 'active' | 'error'; error?: string }> } }

	// File Permissions (Subphase 3.9)
	| { command: 'SAVE_FILE_PERMISSIONS'; payload: { hostId: string; path: string; octal: string; recursive: boolean } }
	| { command: 'PERMISSIONS_PROGRESS'; payload: { current: number; total: number; path: string } }

	// Sudo Save (Subphase 3.9)
	| { command: 'PROMPT_SUDO'; payload: { remotePath: string; defaultPassword?: string } }
	| { command: 'SUDO_RESPONSE'; payload: { password: string; remember?: boolean } };

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type HostStatus = 'online' | 'offline' | 'unknown';
export type AuthType = 'password' | 'key' | 'agent' | 'credential';
export type BulkTagMode = 'add' | 'replace';

