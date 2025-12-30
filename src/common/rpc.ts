// ============================================================================
// RPC PROTOCOL DEFINITIONS
// Type-safe Remote Procedure Call system for Extension <-> Webview communication
// ============================================================================

import {
	Host,
	Credential,
	FileEntry,
	TransferJob,
	TransferQueueSummary,
	Bookmark,
	DiskSpaceInfo,
	FolderConfig,
	HostStatus
} from './types';

/**
 * Base RPC Request structure
 */
export interface RpcRequest<T = any> {
	id: string;
	method: string;
	params: T;
}

/**
 * Base RPC Response structure
 */
export interface RpcResponse<T = any> {
	id: string;
	result?: T;
	error?: {
		code: number;
		message: string;
		data?: any;
	};
}

/**
 * RPC Protocol Definition
 * Maps method names to their request parameters and response types
 */
export interface RpcProtocol {
	// ============================================================
	// DATA FETCHING
	// ============================================================
	'data.fetch': {
		params: void;
		result: {
			hosts: Host[];
			credentials: Credential[];
			activeSessionHostIds: string[];
			hostStatuses: Record<string, HostStatus>;
		};
	};

	// ============================================================
	// HOST OPERATIONS
	// ============================================================
	'host.list': {
		params: void;
		result: Host[];
	};

	'host.get': {
		params: { id: string };
		result: Host | null;
	};

	'host.save': {
		params: { host: Host; password?: string; keyPath?: string };
		result: void;
	};

	'host.delete': {
		params: { id: string };
		result: void;
	};

	'host.clone': {
		params: { id: string };
		result: Host;
	};

	'host.togglePin': {
		params: { id: string };
		result: boolean;
	};

	'host.updateLastUsed': {
		params: { id: string };
		result: void;
	};

	// ============================================================
	// FOLDER OPERATIONS
	// ============================================================
	'folder.rename': {
		params: { oldName: string; newName: string };
		result: { updated: number };
	};

	'folder.moveHost': {
		params: { hostId: string; folder: string };
		result: void;
	};

	'folder.saveConfig': {
		params: { config: FolderConfig };
		result: void;
	};

	// ============================================================
	// BULK OPERATIONS
	// ============================================================
	'bulk.deleteHosts': {
		params: { ids: string[] };
		result: { success: number; failed: number };
	};

	'bulk.moveToFolder': {
		params: { ids: string[]; folder: string };
		result: { success: number; failed: number };
	};

	'bulk.assignTags': {
		params: { ids: string[]; tags: string[]; mode: 'add' | 'replace' };
		result: { success: number; failed: number };
	};

	// ============================================================
	// IMPORT / EXPORT
	// ============================================================
	'import.hosts': {
		params: { hosts: Partial<Host>[] };
		result: { success: number; failed: number };
	};

	'export.hosts': {
		params: { ids?: string[] };
		result: { hosts: Host[] };
	};

	// ============================================================
	// CREDENTIALS
	// ============================================================
	'credential.list': {
		params: void;
		result: Credential[];
	};

	'credential.save': {
		params: { credential: Credential; secret: string };
		result: void;
	};

	'credential.delete': {
		params: { id: string };
		result: void;
	};

	// ============================================================
	// SFTP OPERATIONS
	// ============================================================
	'sftp.ls': {
		params: {
			hostId: string;
			path: string;
			panelId?: 'left' | 'right';
			fileSystem?: 'local' | 'remote';
		};
		result: {
			files: FileEntry[];
			currentPath: string;
			panelId?: 'left' | 'right';
			fileSystem?: 'local' | 'remote';
		};
	};

	'sftp.stat': {
		params: {
			hostId: string;
			path: string;
			fileSystem?: 'local' | 'remote';
		};
		result: FileEntry;
	};

	'sftp.upload': {
		params: {
			hostId: string;
			remotePath: string;
			localPath?: string;
			fileSystem?: 'local' | 'remote';
		};
		result: void;
	};

	'sftp.download': {
		params: {
			hostId: string;
			remotePath: string;
			localPath?: string;
			fileSystem?: 'local' | 'remote';
		};
		result: void;
	};

	'sftp.rm': {
		params: {
			hostId: string;
			path: string;
			fileSystem?: 'local' | 'remote';
		};
		result: void;
	};

	'sftp.mkdir': {
		params: {
			hostId: string;
			path: string;
			fileSystem?: 'local' | 'remote';
		};
		result: void;
	};

	'sftp.rename': {
		params: {
			hostId: string;
			oldPath: string;
			newPath: string;
			fileSystem?: 'local' | 'remote';
		};
		result: void;
	};

	'sftp.move': {
		params: {
			hostId: string;
			sourcePaths: string[];
			targetPath: string;
			sourcePanel?: 'left' | 'right';
			fileSystem?: 'local' | 'remote';
		};
		result: void;
	};

	'sftp.newFile': {
		params: {
			hostId: string;
			path: string;
			fileSystem?: 'local' | 'remote';
		};
		result: void;
	};

	'sftp.remoteCopy': {
		params: {
			hostId: string;
			sourcePaths: string[];
			targetPath: string;
		};
		result: void;
	};

	'sftp.remoteMove': {
		params: {
			hostId: string;
			sourcePaths: string[];
			targetPath: string;
		};
		result: void;
	};

	'sftp.resolveSymlink': {
		params: {
			hostId: string;
			symlinkPath: string;
			panelId?: 'left' | 'right';
			fileSystem?: 'local' | 'remote';
		};
		result: { targetPath: string };
	};

	// ============================================================
	// LOCAL FILE SYSTEM
	// ============================================================
	'local.copy': {
		params: {
			sourcePaths: string[];
			targetPath: string;
		};
		result: void;
	};

	'local.move': {
		params: {
			sourcePaths: string[];
			targetPath: string;
		};
		result: void;
	};

	'local.openFile': {
		params: { path: string };
		result: void;
	};

	// ============================================================
	// CLIPBOARD OPERATIONS
	// ============================================================
	'clipboard.copy': {
		params: {
			files: FileEntry[];
			sourceHostId: string;
			system: 'local' | 'remote';
			operation: 'copy' | 'cut';
		};
		result: void;
	};

	'clipboard.paste': {
		params: {
			targetPath: string;
			targetSystem: 'local' | 'remote';
			hostId: string;
		};
		result: void;
	};

	// ============================================================
	// TRANSFER OPERATIONS
	// ============================================================
	'transfer.addJob': {
		params: { job: Partial<TransferJob> };
		result: void;
	};

	'transfer.pauseJob': {
		params: { jobId: string };
		result: void;
	};

	'transfer.resumeJob': {
		params: { jobId: string };
		result: void;
	};

	'transfer.cancelJob': {
		params: { jobId: string };
		result: void;
	};

	'transfer.clearCompleted': {
		params: void;
		result: void;
	};

	'transfer.getAllJobs': {
		params: void;
		result: { jobs: TransferJob[]; summary: TransferQueueSummary };
	};

	'transfer.resolveConflict': {
		params: {
			transferId: string;
			action: 'overwrite' | 'resume' | 'rename' | 'skip';
			applyToAll?: boolean;
		};
		result: void;
	};

	// ============================================================
	// ARCHIVE OPERATIONS
	// ============================================================
	'archive.extract': {
		params: {
			hostId: string;
			archivePath: string;
			fileSystem: 'local' | 'remote';
		};
		result: void;
	};

	'archive.compress': {
		params: {
			hostId: string;
			paths: string[];
			archiveName: string;
			archiveType: 'zip' | 'tar' | 'tar.gz';
			fileSystem: 'local' | 'remote';
		};
		result: void;
	};

	// ============================================================
	// SEARCH OPERATIONS
	// ============================================================
	'search.files': {
		params: {
			hostId: string;
			path: string;
			fileSystem: 'local' | 'remote';
			pattern?: string;
			content?: string;
			recursive: boolean;
		};
		result: { results: FileEntry[] };
	};

	// ============================================================
	// BOOKMARKS
	// ============================================================
	'bookmark.list': {
		params: { hostId: string };
		result: Bookmark[];
	};

	'bookmark.add': {
		params: { bookmark: Omit<Bookmark, 'id' | 'createdAt'> };
		result: void;
	};

	'bookmark.remove': {
		params: { bookmarkId: string; hostId: string };
		result: void;
	};

	// ============================================================
	// DISK SPACE
	// ============================================================
	'disk.getSpace': {
		params: {
			hostId: string;
			path: string;
			fileSystem: 'local' | 'remote';
		};
		result: DiskSpaceInfo;
	};

	// ============================================================
	// ADVANCED CONTEXT ACTIONS
	// ============================================================
	'context.openInExplorer': {
		params: {
			hostId: string;
			path: string;
			fileSystem: 'local' | 'remote';
		};
		result: void;
	};

	'context.openWithDefault': {
		params: {
			hostId: string;
			path: string;
			fileSystem: 'local' | 'remote';
		};
		result: void;
	};

	'context.calculateChecksum': {
		params: {
			hostId: string;
			path: string;
			fileSystem: 'local' | 'remote';
			algorithm: 'md5' | 'sha1' | 'sha256';
		};
		result: { checksum: string; algorithm: string; filename: string };
	};

	'context.copyPath': {
		params: {
			path: string;
			type: 'name' | 'fullPath' | 'url';
			hostId?: string;
		};
		result: void;
	};

	'context.createSymlink': {
		params: {
			hostId: string;
			sourcePath: string;
			targetPath: string;
			fileSystem: 'local' | 'remote';
		};
		result: void;
	};

	// ============================================================
	// BROADCAST OPERATIONS
	// ============================================================
	'broadcast.command': {
		params: {
			hostIds: string[];
			command: string;
		};
		result: void;
	};

	// ============================================================
	// PERMISSIONS
	// ============================================================
	'permissions.save': {
		params: {
			hostId: string;
			path: string;
			octal: string;
			recursive: boolean;
		};
		result: void;
	};

	// ============================================================
	// BULK RENAME
	// ============================================================
	'bulk.rename': {
		params: {
			hostId: string;
			operations: { oldPath: string; newPath: string }[];
			fileSystem: 'local' | 'remote';
		};
		result: void;
	};

	// ============================================================
	// PANEL STATE
	// ============================================================
	'panel.saveState': {
		params: {
			hostId: string;
			state: {
				left: { system: 'local' | 'remote'; path: string };
				right: { system: 'local' | 'remote'; path: string };
				active: 'left' | 'right';
				layoutMode?: 'explorer' | 'commander';
				viewMode?: 'list' | 'grid';
			};
		};
		result: void;
	};

	'panel.getState': {
		params: { hostId: string };
		result: {
			state?: {
				left: { system: 'local' | 'remote'; path: string };
				right: { system: 'local' | 'remote'; path: string };
				active: 'left' | 'right';
				layoutMode?: 'explorer' | 'commander';
				viewMode?: 'list' | 'grid';
			};
		};
	};
}

/**
 * Helper type to extract parameter type from protocol
 */
export type RpcParams<K extends keyof RpcProtocol> = RpcProtocol[K]['params'];

/**
 * Helper type to extract result type from protocol
 */
export type RpcResult<K extends keyof RpcProtocol> = RpcProtocol[K]['result'];

/**
 * Error codes
 */
export enum RpcErrorCode {
	PARSE_ERROR = -32700,
	INVALID_REQUEST = -32600,
	METHOD_NOT_FOUND = -32601,
	INVALID_PARAMS = -32602,
	INTERNAL_ERROR = -32603,
	// Custom error codes
	HOST_NOT_FOUND = -32001,
	CREDENTIAL_NOT_FOUND = -32002,
	CONNECTION_FAILED = -32003,
	PERMISSION_DENIED = -32004,
	FILE_NOT_FOUND = -32005,
	OPERATION_FAILED = -32006
}
