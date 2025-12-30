// ============================================================================
// HOST CONTROLLER
// Handles all host-related operations
// ============================================================================

import * as vscode from 'vscode';
import { BaseController } from './BaseController';
import { HostService } from '../hostService';
import { CredentialService } from '../credentialService';
import { SessionTracker } from '../sessionTracker';
import { StatusService } from '../statusService';
import { Host, HostStatus, FolderConfig } from '../../common/types';

/**
 * Host Controller
 * Manages host CRUD operations, folders, and bulk operations
 */
export class HostController extends BaseController {
	constructor(
		context: vscode.ExtensionContext,
		private readonly hostService: HostService,
		private readonly credentialService: CredentialService,
		private readonly sessionTracker: SessionTracker,
		private readonly statusService?: StatusService
	) {
		super(context);
	}

	/**
	 * Fetches all data (hosts, credentials, sessions, statuses)
	 */
	async fetchData(): Promise<{
		hosts: Host[];
		credentials: any[];
		activeSessionHostIds: string[];
		hostStatuses: Record<string, HostStatus>;
	}> {
		const hosts = this.hostService.getHosts();
		const credentials = await this.credentialService.getCredentials();
		const activeSessionHostIds = this.sessionTracker.getActiveHostIds();
		const hostStatuses = this.statusService?.getAllStatuses() || {};

		return { hosts, credentials, activeSessionHostIds, hostStatuses };
	}

	/**
	 * Lists all hosts
	 */
	async listHosts(): Promise<Host[]> {
		return this.hostService.getHosts();
	}

	/**
	 * Gets a host by ID
	 */
	async getHost(id: string): Promise<Host | null> {
		return this.hostService.getHostById(id) || null;
	}

	/**
	 * Saves a host
	 */
	async saveHost(host: Host, password?: string, keyPath?: string): Promise<void> {
		await this.hostService.saveHost(host, password, keyPath);
		this.log(`Host saved: ${host.name}`);
	}

	/**
	 * Deletes a host
	 */
	async deleteHost(id: string): Promise<void> {
		await this.hostService.deleteHost(id);
		this.log(`Host deleted: ${id}`);
	}

	/**
	 * Clones a host
	 */
	async cloneHost(id: string): Promise<Host> {
		const cloned = await this.hostService.cloneHost(id);
		if (!cloned) {
			throw new Error('Failed to clone host');
		}
		this.showInfo(`Host "${cloned.name}" cloned successfully.`);
		return cloned;
	}

	/**
	 * Toggles pin status of a host
	 */
	async togglePin(id: string): Promise<boolean> {
		const isPinned = await this.hostService.togglePin(id);
		return isPinned;
	}

	/**
	 * Updates last used timestamp
	 */
	async updateLastUsed(id: string): Promise<void> {
		await this.hostService.updateLastUsed(id);
	}

	/**
	 * Renames a folder
	 */
	async renameFolder(oldName: string, newName: string): Promise<{ updated: number }> {
		const updated = await this.hostService.renameFolder(oldName, newName);
		this.showInfo(`Folder renamed. ${updated} hosts updated.`);
		return { updated };
	}

	/**
	 * Moves a host to a folder
	 */
	async moveHostToFolder(hostId: string, folder: string): Promise<void> {
		await this.hostService.moveHostToFolder(hostId, folder);
		this.log(`Host ${hostId} moved to folder: ${folder}`);
	}

	/**
	 * Saves folder configuration
	 */
	async saveFolderConfig(config: FolderConfig): Promise<void> {
		await this.hostService.saveFolderConfig(config);
		this.log(`Folder config saved: ${config.name}`);
	}

	/**
	 * Bulk deletes hosts
	 */
	async bulkDeleteHosts(ids: string[]): Promise<{ success: number; failed: number }> {
		const result = await this.hostService.bulkDeleteHosts(ids);
		this.showInfo(`Deleted ${result.success} hosts.`);
		return result;
	}

	/**
	 * Bulk moves hosts to folder
	 */
	async bulkMoveToFolder(ids: string[], folder: string): Promise<{ success: number; failed: number }> {
		const result = await this.hostService.bulkMoveToFolder(ids, folder);
		this.showInfo(`Moved ${result.success} hosts to "${folder || 'Uncategorized'}".`);
		return result;
	}

	/**
	 * Bulk assigns tags to hosts
	 */
	async bulkAssignTags(ids: string[], tags: string[], mode: 'add' | 'replace'): Promise<{ success: number; failed: number }> {
		const result = await this.hostService.bulkAssignTags(ids, tags, mode);
		this.showInfo(`Tags assigned to ${result.success} hosts.`);
		return result;
	}

	/**
	 * Imports hosts
	 */
	async importHosts(hosts: Partial<Host>[]): Promise<{ success: number; failed: number }> {
		const result = await this.hostService.importHosts(hosts);
		this.showInfo(`Imported ${result.success} hosts. ${result.failed} failed.`);
		return result;
	}

	/**
	 * Exports hosts
	 */
	async exportHosts(ids?: string[]): Promise<{ hosts: Host[] }> {
		const hosts = this.hostService.exportHosts(ids);
		return { hosts };
	}
}
