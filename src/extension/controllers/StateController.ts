// ============================================================================
// STATE CONTROLLER
// Handles panel state persistence and other state operations
// ============================================================================

import * as vscode from 'vscode';
import { BaseController } from './BaseController';
import { StateService } from '../services/stateService';
import { BroadcastService } from '../services/broadcastService';

/**
 * State Controller
 * Manages panel state persistence and broadcast operations
 */
export class StateController extends BaseController {
	constructor(
		context: vscode.ExtensionContext,
		private readonly stateService: StateService,
		private readonly broadcastService?: BroadcastService
	) {
		super(context);
	}

	/**
	 * Saves panel state for a host
	 */
	async savePanelState(
		hostId: string,
		state: {
			left: { system: 'local' | 'remote'; path: string };
			right: { system: 'local' | 'remote'; path: string };
			active: 'left' | 'right';
			layoutMode?: 'explorer' | 'commander';
			viewMode?: 'list' | 'grid';
		}
	): Promise<void> {
		// TODO: Implement panel state persistence
		// For now, just store in workspace state
		await this.setWorkspaceState(`panelState_${hostId}`, state);
		this.log(`Panel state saved for host: ${hostId}`);
	}

	/**
	 * Gets panel state for a host
	 */
	async getPanelState(hostId: string): Promise<{
		state?: {
			left: { system: 'local' | 'remote'; path: string };
			right: { system: 'local' | 'remote'; path: string };
			active: 'left' | 'right';
			layoutMode?: 'explorer' | 'commander';
			viewMode?: 'list' | 'grid';
		};
	}> {
		const state = this.getWorkspaceState<{
			left: { system: 'local' | 'remote'; path: string };
			right: { system: 'local' | 'remote'; path: string };
			active: 'left' | 'right';
			layoutMode?: 'explorer' | 'commander';
			viewMode?: 'list' | 'grid';
		}>(`panelState_${hostId}`);
		return { state };
	}

	/**
	 * Broadcasts a command to multiple hosts
	 */
	async broadcastCommand(hostIds: string[], command: string): Promise<void> {
		if (!this.broadcastService) {
			throw new Error('Broadcast service not available');
		}

		this.showInfo(`Broadcasting command to ${hostIds.length} host(s)...`);

		await this.broadcastService.broadcast(
			hostIds,
			command,
			(hostId: string, success: boolean, output?: string, error?: string) => {
				this.log(`Broadcast result for ${hostId}: ${success ? 'success' : 'failed'}`);
			}
		);

		this.showInfo('Broadcast completed');
	}

	/**
	 * Saves file permissions
	 */
	async savePermissions(hostId: string, path: string, octal: string, recursive: boolean): Promise<void> {
		// This would need to be implemented via SSH exec or SFTP
		// For now, just log
		this.log(`Save permissions: ${path} -> ${octal} (recursive: ${recursive})`);
		throw new Error('savePermissions not yet implemented in controller');
	}
}
