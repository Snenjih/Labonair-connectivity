import * as vscode from 'vscode';
import { Host, FolderConfig, BulkTagMode } from '../common/types';

export class HostService {
	private context: vscode.ExtensionContext;
	private readonly STORAGE_KEY = 'labonair.hosts';
	private readonly FOLDERS_KEY = 'labonair.folders';

	constructor(context: vscode.ExtensionContext) {
		this.context = context;
	}

	// ============================================================================
	// HOST CRUD OPERATIONS
	// ============================================================================

	public getHosts(): Host[] {
		return this.context.globalState.get<Host[]>(this.STORAGE_KEY, []);
	}

	public getHostById(id: string): Host | undefined {
		return this.getHosts().find(h => h.id === id);
	}

	public async saveHost(host: Host, password?: string, keyPath?: string): Promise<Host> {
		const hosts = this.getHosts();
		const index = hosts.findIndex(h => h.id === host.id);
		const now = new Date().toISOString();
		const isUpdate = index !== -1;

		if (isUpdate) {
			host.updatedAt = now;
			hosts[index] = host;
		} else {
			host.createdAt = now;
			host.updatedAt = now;
			hosts.push(host);
		}

		await this.context.globalState.update(this.STORAGE_KEY, hosts);

		if (password) {
			await this.context.secrets.store(`pwd.${host.id}`, password);
		}

		if (keyPath) {
			await this.context.secrets.store(`keypath.${host.id}`, keyPath);
		}

		// Subphase 6.4Extend: Broadcast config update to active terminal sessions
		// This enables live font updates without reconnecting
		if (isUpdate) {
			// Dynamically import to avoid circular dependency
			const { TerminalPanel } = await import('./panels/TerminalPanel');
			TerminalPanel.broadcastHostConfigUpdate(host.id, host);
		}

		return host;
	}

	public async deleteHost(id: string): Promise<void> {
		const hosts = this.getHosts().filter(h => h.id !== id);
		await this.context.globalState.update(this.STORAGE_KEY, hosts);
		await this.context.secrets.delete(`pwd.${id}`);
		await this.context.secrets.delete(`keypath.${id}`);
	}

	public async cloneHost(id: string): Promise<Host | null> {
		const original = this.getHostById(id);
		if (!original) {
			return null;
		}

		const cloned: Host = {
			...original,
			id: this.generateId(),
			name: `${original.name} (Copy)`,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			lastUsed: undefined
		};

		await this.saveHost(cloned);
		return cloned;
	}

	public async togglePin(id: string): Promise<boolean> {
		const hosts = this.getHosts();
		const index = hosts.findIndex(h => h.id === id);
		if (index === -1) {
			return false;
		}

		hosts[index].pin = !hosts[index].pin;
		hosts[index].updatedAt = new Date().toISOString();
		await this.context.globalState.update(this.STORAGE_KEY, hosts);
		return hosts[index].pin || false;
	}

	public async updateLastUsed(hostId: string): Promise<void> {
		const hosts = this.getHosts();
		const hostIndex = hosts.findIndex(h => h.id === hostId);
		if (hostIndex !== -1) {
			hosts[hostIndex].lastUsed = Date.now();
			await this.context.globalState.update(this.STORAGE_KEY, hosts);
		}
	}

	// ============================================================================
	// FOLDER OPERATIONS
	// ============================================================================

	public getFolders(): string[] {
		const hosts = this.getHosts();
		const folders = new Set<string>();
		hosts.forEach(h => {
			if (h.folder && h.folder.trim() !== '') {
				folders.add(h.folder);
			}
		});
		return Array.from(folders).sort();
	}

	public getFolderConfigs(): Record<string, FolderConfig> {
		return this.context.globalState.get<Record<string, FolderConfig>>(this.FOLDERS_KEY, {});
	}

	public async saveFolderConfig(config: FolderConfig): Promise<void> {
		const folders = this.getFolderConfigs();
		folders[config.name] = config;
		await this.context.globalState.update(this.FOLDERS_KEY, folders);
	}

	public async renameFolder(oldName: string, newName: string): Promise<number> {
		const hosts = this.getHosts();
		let updated = 0;

		for (const host of hosts) {
			if (host.folder === oldName) {
				host.folder = newName;
				host.updatedAt = new Date().toISOString();
				updated++;
			}
		}

		await this.context.globalState.update(this.STORAGE_KEY, hosts);

		// Also rename folder config if exists
		const folderConfigs = this.getFolderConfigs();
		if (folderConfigs[oldName]) {
			folderConfigs[newName] = { ...folderConfigs[oldName], name: newName };
			delete folderConfigs[oldName];
			await this.context.globalState.update(this.FOLDERS_KEY, folderConfigs);
		}

		return updated;
	}

	public async moveHostToFolder(hostId: string, folder: string): Promise<boolean> {
		const hosts = this.getHosts();
		const index = hosts.findIndex(h => h.id === hostId);
		if (index === -1) {
			return false;
		}

		hosts[index].folder = folder;
		hosts[index].updatedAt = new Date().toISOString();
		await this.context.globalState.update(this.STORAGE_KEY, hosts);
		return true;
	}

	// ============================================================================
	// BULK OPERATIONS
	// ============================================================================

	public async bulkDeleteHosts(ids: string[]): Promise<{ success: number; failed: number; errors: string[] }> {
		const hosts = this.getHosts();
		const toDelete = new Set(ids);
		const remaining = hosts.filter(h => !toDelete.has(h.id));
		const deleted = hosts.length - remaining.length;

		await this.context.globalState.update(this.STORAGE_KEY, remaining);

		// Clean up secrets
		for (const id of ids) {
			try {
				await this.context.secrets.delete(`pwd.${id}`);
				await this.context.secrets.delete(`keypath.${id}`);
			} catch (e) {
				// Ignore secret deletion errors
			}
		}

		return {
			success: deleted,
			failed: ids.length - deleted,
			errors: []
		};
	}

	public async bulkMoveToFolder(ids: string[], folder: string): Promise<{ success: number; failed: number; errors: string[] }> {
		const hosts = this.getHosts();
		let success = 0;

		for (const host of hosts) {
			if (ids.includes(host.id)) {
				host.folder = folder;
				host.updatedAt = new Date().toISOString();
				success++;
			}
		}

		await this.context.globalState.update(this.STORAGE_KEY, hosts);

		return {
			success,
			failed: ids.length - success,
			errors: []
		};
	}

	public async bulkAssignTags(ids: string[], tags: string[], mode: BulkTagMode): Promise<{ success: number; failed: number; errors: string[] }> {
		const hosts = this.getHosts();
		let success = 0;

		for (const host of hosts) {
			if (ids.includes(host.id)) {
				if (mode === 'replace') {
					host.tags = [...tags];
				} else {
					// Add mode - merge tags
					const existingTags = new Set(host.tags || []);
					tags.forEach(t => existingTags.add(t));
					host.tags = Array.from(existingTags);
				}
				host.updatedAt = new Date().toISOString();
				success++;
			}
		}

		await this.context.globalState.update(this.STORAGE_KEY, hosts);

		return {
			success,
			failed: ids.length - success,
			errors: []
		};
	}

	// ============================================================================
	// IMPORT / EXPORT
	// ============================================================================

	public async importHosts(hostsData: Partial<Host>[]): Promise<{ success: number; failed: number; errors: string[] }> {
		const existingHosts = this.getHosts();
		const now = new Date().toISOString();
		let success = 0;
		const errors: string[] = [];

		for (const data of hostsData) {
			try {
				// Validate required fields
				if (!data.host || !data.username) {
					errors.push(`Invalid host data: missing host or username`);
					continue;
				}

				const newHost: Host = {
					id: this.generateId(),
					name: data.name || `${data.username}@${data.host}`,
					folder: data.folder || '',
					username: data.username,
					host: data.host,
					port: data.port || 22,
					osIcon: data.osIcon || 'linux',
					tags: data.tags || [],
					pin: data.pin || false,
					authType: data.authType || 'key',
					enableTerminal: data.enableTerminal ?? true,
					enableFileManager: data.enableFileManager ?? true,
					defaultPath: data.defaultPath || '/',
					tunnels: data.tunnels,
					notes: data.notes,
					keepAlive: data.keepAlive,
					jumpHostId: data.jumpHostId,
					credentialId: data.credentialId,
					protocol: data.protocol || 'ssh',
					createdAt: now,
					updatedAt: now
				};

				existingHosts.push(newHost);
				success++;
			} catch (e) {
				errors.push(`Failed to import host: ${e}`);
			}
		}

		await this.context.globalState.update(this.STORAGE_KEY, existingHosts);

		return {
			success,
			failed: hostsData.length - success,
			errors
		};
	}

	public exportHosts(ids?: string[]): Host[] {
		const hosts = this.getHosts();
		if (!ids || ids.length === 0) {
			return hosts;
		}
		return hosts.filter(h => ids.includes(h.id));
	}

	// ============================================================================
	// EFFECTIVE CONFIG (with folder inheritance)
	// ============================================================================

	public async getEffectiveConfig(hostId: string): Promise<Host> {
		const hosts = this.getHosts();
		const host = hosts.find(h => h.id === hostId);
		if (!host) {
			throw new Error(`Host ${hostId} not found`);
		}

		// Start with host config
		let effectiveHost = { ...host };

		// Apply folder defaults if host has a folder
		if (host.folder) {
			const folderConfigs = this.getFolderConfigs();
			const folderConfig = folderConfigs[host.folder];
			if (folderConfig) {
				if (!effectiveHost.username && folderConfig.username) {
					effectiveHost.username = folderConfig.username;
				}
				if (!effectiveHost.port && folderConfig.port) {
					effectiveHost.port = folderConfig.port;
				}
				if (!effectiveHost.credentialId && folderConfig.credentialId) {
					effectiveHost.credentialId = folderConfig.credentialId;
				}
			}
		}

		return effectiveHost;
	}

	// ============================================================================
	// UTILITY
	// ============================================================================

	private generateId(): string {
		return crypto.randomUUID();
	}

	public async getPassword(hostId: string): Promise<string | undefined> {
		return this.context.secrets.get(`pwd.${hostId}`);
	}

	public async getKeyPath(hostId: string): Promise<string | undefined> {
		return this.context.secrets.get(`keypath.${hostId}`);
	}
}

