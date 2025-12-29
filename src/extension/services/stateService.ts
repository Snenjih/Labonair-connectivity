import * as vscode from 'vscode';

/**
 * FileManagerState - Defines the state structure for panel persistence
 */
export interface FileManagerState {
	left: {
		system: 'local' | 'remote';
		path: string;
	};
	right: {
		system: 'local' | 'remote';
		path: string;
	};
	active: 'left' | 'right';
	layoutMode?: 'explorer' | 'commander';
	viewMode?: 'list' | 'grid';
}

/**
 * StateService - Manages persistent state for File Manager panels
 * Stores and retrieves panel states using VS Code's globalState API
 */
export class StateService {
	private static readonly STATE_KEY_PREFIX = 'labonair.fileManager.state.';

	constructor(private readonly _context: vscode.ExtensionContext) {}

	/**
	 * Saves the file manager state for a specific host
	 * @param hostId - The host identifier
	 * @param state - The file manager state to save
	 */
	public async saveState(hostId: string, state: FileManagerState): Promise<void> {
		try {
			const key = this._getStateKey(hostId);
			await this._context.globalState.update(key, state);
			console.log(`[StateService] Saved state for hostId: ${hostId}`, state);
		} catch (error) {
			console.error(`[StateService] Failed to save state for hostId: ${hostId}`, error);
			throw error;
		}
	}

	/**
	 * Retrieves the file manager state for a specific host
	 * @param hostId - The host identifier
	 * @returns The saved state, or undefined if no state exists
	 */
	public getState(hostId: string): FileManagerState | undefined {
		try {
			const key = this._getStateKey(hostId);
			const state = this._context.globalState.get<FileManagerState>(key);
			console.log(`[StateService] Retrieved state for hostId: ${hostId}`, state);
			return state;
		} catch (error) {
			console.error(`[StateService] Failed to retrieve state for hostId: ${hostId}`, error);
			return undefined;
		}
	}

	/**
	 * Clears the saved state for a specific host
	 * @param hostId - The host identifier
	 */
	public async clearState(hostId: string): Promise<void> {
		try {
			const key = this._getStateKey(hostId);
			await this._context.globalState.update(key, undefined);
			console.log(`[StateService] Cleared state for hostId: ${hostId}`);
		} catch (error) {
			console.error(`[StateService] Failed to clear state for hostId: ${hostId}`, error);
			throw error;
		}
	}

	/**
	 * Gets all stored state keys
	 * @returns Array of all state keys
	 */
	public getAllStateKeys(): string[] {
		const keys = this._context.globalState.keys();
		return keys.filter(key => key.startsWith(StateService.STATE_KEY_PREFIX));
	}

	/**
	 * Clears all saved states
	 */
	public async clearAllStates(): Promise<void> {
		const keys = this.getAllStateKeys();
		for (const key of keys) {
			await this._context.globalState.update(key, undefined);
		}
		console.log(`[StateService] Cleared all states (${keys.length} items)`);
	}

	/**
	 * Generates the storage key for a host
	 * @param hostId - The host identifier
	 * @returns The storage key
	 */
	private _getStateKey(hostId: string): string {
		return `${StateService.STATE_KEY_PREFIX}${hostId}`;
	}
}
