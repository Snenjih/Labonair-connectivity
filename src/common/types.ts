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
	terminalFontSize?: number;         // Font size in pixels (default: 14)
	terminalFontWeight?: string;       // Font weight: 'normal', 'bold', '100'-'900'
	terminalLineHeight?: number;       // Line height (default: 1.0)
	terminalLetterSpacing?: number;    // Letter spacing in pixels (default: 0)
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

export interface Bookmark {
	id: string;
	label: string;
	path: string;
	system: 'local' | 'remote';
	hostId?: string;  // Only for remote bookmarks
	createdAt: number;
}

export interface DiskSpaceInfo {
	total: number;    // Total space in bytes
	free: number;     // Free space in bytes
	used: number;     // Used space in bytes
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
	| { command: 'UPDATE_DATA'; payload: { view?: ViewType; hosts?: Host[]; credentials?: Credential[]; activeSessionHostIds?: string[]; hostStatuses?: Record<string, 'online' | 'offline' | 'unknown'>; hostId?: string; currentPath?: string; terminalDefaults?: any; fileManagerDefaults?: any } }

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

	// File Manager (Local & Remote)
	| { command: 'SFTP_LS'; payload: { hostId: string; path: string; panelId?: 'left' | 'right'; fileSystem?: 'local' | 'remote' } }
	| { command: 'SFTP_LS_RESPONSE'; payload: { files: FileEntry[]; currentPath: string; panelId?: 'left' | 'right'; fileSystem?: 'local' | 'remote' } }
	| { command: 'SFTP_UPLOAD'; payload: { hostId: string; remotePath: string; localPath?: string; fileSystem?: 'local' | 'remote' } }
	| { command: 'SFTP_DOWNLOAD'; payload: { hostId: string; remotePath: string; localPath?: string; fileSystem?: 'local' | 'remote' } }
	| { command: 'SFTP_RM'; payload: { hostId: string; path: string; fileSystem?: 'local' | 'remote' } }
	| { command: 'SFTP_MKDIR'; payload: { hostId: string; path: string; fileSystem?: 'local' | 'remote' } }
	| { command: 'SFTP_RENAME'; payload: { hostId: string; oldPath: string; newPath: string; fileSystem?: 'local' | 'remote' } }
	| { command: 'SFTP_STAT'; payload: { hostId: string; path: string; fileSystem?: 'local' | 'remote' } }
	| { command: 'SFTP_STAT_RESPONSE'; payload: { file: FileEntry; fileSystem?: 'local' | 'remote' } }
	| { command: 'SFTP_TRANSFER_PROGRESS'; payload: TransferStatus }
	| { command: 'SFTP_ERROR'; payload: { message: string; panelId?: 'left' | 'right' } }
	| { command: 'NAVIGATE'; payload: { path: string; panelId?: 'left' | 'right'; fileSystem?: 'local' | 'remote' } }
	| { command: 'RESOLVE_SYMLINK'; payload: { hostId: string; symlinkPath: string; panelId?: 'left' | 'right'; fileSystem?: 'local' | 'remote' } }

	// Local File System specific
	| { command: 'OPEN_LOCAL_FILE'; payload: { path: string } }

	// Edit-on-Fly
	| { command: 'EDIT_FILE'; payload: { hostId: string; remotePath: string } }
	| { command: 'FILE_OPENED'; payload: { localUri: string; remotePath: string } }
	| { command: 'FILE_SAVED'; payload: { localUri: string; remotePath: string; success: boolean; error?: string } }
	| { command: 'UPLOAD_PROGRESS'; payload: { remotePath: string; progress: number } }
	| { command: 'SUDO_SAVE_REQUIRED'; payload: { remotePath: string; error: string } }
	| { command: 'SUDO_SAVE_CONFIRM'; payload: { remotePath: string; password?: string } }

	// File Operations
	| { command: 'COPY_PATH'; payload: { path: string } }
	| { command: 'FILE_PROPERTIES'; payload: { hostId: string; path: string; fileSystem?: 'local' | 'remote' } }
	| { command: 'DIFF_FILES'; payload: { hostId: string; remotePath: string; localPath?: string; fileSystem?: 'local' | 'remote' } }
	| { command: 'SFTP_NEW_FILE'; payload: { hostId: string; path: string; fileSystem?: 'local' | 'remote' } }
	| { command: 'SFTP_MOVE'; payload: { hostId: string; sourcePaths: string[]; targetPath: string; sourcePanel?: 'left' | 'right'; fileSystem?: 'local' | 'remote' } }
	| { command: 'OPEN_TERMINAL'; payload: { hostId: string; path: string; fileSystem?: 'local' | 'remote' } }

	// Universal Transfer Matrix Operations (Subphase 4.2)
	| { command: 'FS_LOCAL_COPY'; payload: { sourcePaths: string[]; targetPath: string } }
	| { command: 'FS_LOCAL_MOVE'; payload: { sourcePaths: string[]; targetPath: string } }
	| { command: 'SFTP_REMOTE_COPY'; payload: { hostId: string; sourcePaths: string[]; targetPath: string } }
	| { command: 'SFTP_REMOTE_MOVE'; payload: { hostId: string; sourcePaths: string[]; targetPath: string } }

	// Clipboard Operations (Subphase 4.2)
	| { command: 'CLIPBOARD_COPY'; payload: { files: FileEntry[]; sourceHostId: string; system: 'local' | 'remote'; operation: 'copy' | 'cut' } }
	| { command: 'CLIPBOARD_PASTE'; payload: { targetPath: string; targetSystem: 'local' | 'remote'; hostId: string } }

	// SSH Terminal
	| { command: 'TERM_DATA'; payload: { data: string; splitId?: number } }
	| { command: 'TERM_INPUT'; payload: { data: string; splitId?: number } }
	| { command: 'TERM_RESIZE'; payload: { cols: number; rows: number; splitId?: number } }
	| { command: 'TERM_STATUS'; payload: { status: 'connecting' | 'connected' | 'disconnected' | 'error'; message?: string; splitId?: number } }
	| { command: 'TERM_RECONNECT'; payload: { hostId: string } }
	| { command: 'HOST_CONFIG_UPDATED'; payload: { hostId: string; host: Host } }
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
	| { command: 'CHANGE_OWNERSHIP'; payload: { hostId: string; path: string; owner: string; group: string; recursive: boolean } }

	// Sudo Save (Subphase 3.9)
	| { command: 'PROMPT_SUDO'; payload: { remotePath: string; defaultPassword?: string } }
	| { command: 'SUDO_RESPONSE'; payload: { password: string; remember?: boolean } }

	// Keybinding Context (Subphase 3.11)
	| { command: 'SET_CONTEXT'; payload: { key: string; value: boolean } }

	// Panel State Persistence (Subphase 4.3)
	| { command: 'SAVE_PANEL_STATE'; payload: { hostId: string; state: { left: { system: 'local' | 'remote'; path: string }; right: { system: 'local' | 'remote'; path: string }; active: 'left' | 'right'; layoutMode?: 'explorer' | 'commander'; viewMode?: 'list' | 'grid' } } }
	| { command: 'GET_PANEL_STATE'; payload: { hostId: string } }
	| { command: 'PANEL_STATE_RESPONSE'; payload: { state?: { left: { system: 'local' | 'remote'; path: string }; right: { system: 'local' | 'remote'; path: string }; active: 'left' | 'right'; layoutMode?: 'explorer' | 'commander'; viewMode?: 'list' | 'grid' } } }

	// Universal Archive Operations (Subphase 4.3)
	| { command: 'ARCHIVE_OP'; payload: { operation: 'extract' | 'compress'; files: string[]; panelId: 'left' | 'right'; hostId: string; fileSystem: 'local' | 'remote'; archivePath?: string; archiveName?: string; archiveType?: 'zip' | 'tar' | 'tar.gz' } }

	// Universal Deep Search (Subphase 4.3)
	| { command: 'SEARCH_FILES'; payload: { hostId: string; path: string; fileSystem: 'local' | 'remote'; pattern?: string; content?: string; recursive: boolean } }
	| { command: 'SEARCH_RESULTS'; payload: { results: FileEntry[]; searchQuery: string } }

	// Integrated Console (Subphase 4.4)
	| { command: 'CONSOLE_NAVIGATE'; payload: { hostId: string; path: string; fileSystem: 'local' | 'remote' } }
	| { command: 'CONSOLE_INPUT'; payload: { hostId: string; data: string } }
	| { command: 'CONSOLE_RESIZE'; payload: { hostId: string; cols: number; rows: number } }
	| { command: 'CONSOLE_DATA'; payload: { data: string } }
	| { command: 'CONSOLE_STATUS'; payload: { status: 'connecting' | 'connected' | 'disconnected' | 'error'; message?: string } }

	// Bulk Rename (Subphase 4.4)
	| { command: 'BULK_RENAME'; payload: { hostId: string; operations: { oldPath: string; newPath: string }[]; fileSystem: 'local' | 'remote' } }

	// Bookmarks (Subphase 4.4.1)
	| { command: 'GET_BOOKMARKS'; payload: { hostId: string } }
	| { command: 'BOOKMARKS_RESPONSE'; payload: { bookmarks: Bookmark[] } }
	| { command: 'ADD_BOOKMARK'; payload: { bookmark: Omit<Bookmark, 'id' | 'createdAt'> } }
	| { command: 'REMOVE_BOOKMARK'; payload: { bookmarkId: string; hostId: string } }

	// Disk Space (Subphase 4.4.1)
	| { command: 'GET_DISK_SPACE'; payload: { hostId: string; path: string; fileSystem: 'local' | 'remote' } }
	| { command: 'DISK_SPACE_RESPONSE'; payload: { diskSpace: DiskSpaceInfo; fileSystem: 'local' | 'remote' } }

	// Advanced Context Actions (Subphase 4.4.2)
	| { command: 'OPEN_IN_EXPLORER'; payload: { hostId: string; path: string; fileSystem: 'local' | 'remote' } }
	| { command: 'OPEN_WITH_DEFAULT'; payload: { hostId: string; path: string; fileSystem: 'local' | 'remote' } }
	| { command: 'CALCULATE_CHECKSUM'; payload: { hostId: string; path: string; fileSystem: 'local' | 'remote'; algorithm: 'md5' | 'sha1' | 'sha256' } }
	| { command: 'CHECKSUM_RESULT'; payload: { checksum: string; algorithm: string; filename: string } }
	| { command: 'COPY_PATH_ADVANCED'; payload: { path: string; type: 'name' | 'fullPath' | 'url'; hostId?: string } }
	| { command: 'CREATE_SYMLINK'; payload: { hostId: string; sourcePath: string; targetPath: string; fileSystem: 'local' | 'remote' } }

	// Directory Synchronization (Subphase 4.8)
	| { command: 'START_SYNC'; payload: { hostId: string; leftPath: string; leftSystem: 'local' | 'remote'; rightPath: string; rightSystem: 'local' | 'remote'; options: SyncOptions } }
	| { command: 'SYNC_COMPARE_RESULT'; payload: { items: SyncItem[] } }
	| { command: 'EXECUTE_SYNC'; payload: { items: SyncItem[] } }
	| { command: 'SYNC_PROGRESS'; payload: { current: number; total: number; currentFile: string } }
	| { command: 'GET_SYNC_STATE'; payload: { hostId: string } }
	| { command: 'SYNC_STATE_RESPONSE'; payload: { state?: SyncState } }
	| { command: 'SAVE_SYNC_STATE'; payload: { hostId: string; state: SyncState } }

	// Advanced Selection (Subphase 4.8)
	| { command: 'ADVANCED_SELECT'; payload: { hostId: string; criteria: SelectionCriteria; fileSystem: 'local' | 'remote' } }
	| { command: 'ADVANCED_SELECT_RESULT'; payload: { selectedPaths: string[] } }

	// Directory Size Calculation
	| { command: 'CALCULATE_DIR_SIZE'; payload: { hostId: string; path: string; fileSystem: 'local' | 'remote' } }
	| { command: 'DIR_SIZE_RESULT'; payload: { path: string; size: number; filesScanned: number } }
	| { command: 'DIR_SIZE_PROGRESS'; payload: { path: string; currentSize: number; filesScanned: number } }

	// Logging (Subphase 4.8)
	| { command: 'SHOW_LOGS' }
	| { command: 'CLEAR_LOGS' }
	| { command: 'SET_VERBOSE_LOGGING'; payload: { enabled: boolean } };

// ============================================================================
// SYNC TYPES (Subphase 4.8)
// ============================================================================

export interface SyncOptions {
	compareSize: boolean;
	compareDate: boolean;
	compareContent: boolean;
	includePattern?: string;  // Glob pattern for files to include
	excludePattern?: string;  // Glob pattern for files to exclude
}

export type SyncDirection = 'left-to-right' | 'right-to-left' | 'bidirectional' | 'skip' | 'conflict';
export type SyncAction = 'copy' | 'delete' | 'update' | 'skip';

export interface SyncItem {
	leftPath?: string;
	rightPath?: string;
	name: string;
	direction: SyncDirection;
	action: SyncAction;
	reason: string;  // Explanation of why this action is needed
	leftSize?: number;
	rightSize?: number;
	leftModTime?: Date;
	rightModTime?: Date;
	type: 'd' | '-' | 'l';  // directory, file, or symlink
}

export interface SyncState {
	leftPath: string;
	leftSystem: 'local' | 'remote';
	rightPath: string;
	rightSystem: 'local' | 'remote';
	options: SyncOptions;
	items?: SyncItem[];
	timestamp: number;
}

export interface SelectionCriteria {
	pattern?: string;        // File name pattern (*.js, src/**/*.ts)
	newerThan?: Date;        // Files modified after this date
	olderThan?: Date;        // Files modified before this date
	minSize?: number;        // Minimum file size in bytes
	maxSize?: number;        // Maximum file size in bytes
	contentContains?: string;  // Files containing this text
	recursive: boolean;      // Search in subdirectories
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type HostStatus = 'online' | 'offline' | 'unknown';
export type AuthType = 'password' | 'key' | 'agent' | 'credential';
export type BulkTagMode = 'add' | 'replace';

