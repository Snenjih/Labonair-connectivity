import * as vscode from 'vscode';
import { SshSession } from './sshSession';

/**
 * Broadcast Service
 * Manages broadcast commands to multiple SSH sessions simultaneously
 * Used for cluster/multi-host command execution
 */
export class BroadcastService {
	private sessionRegistry: Map<string, SshSession> = new Map();

	/**
	 * Registers an SSH session
	 */
	public registerSession(hostId: string, session: SshSession): void {
		this.sessionRegistry.set(hostId, session);
	}

	/**
	 * Unregisters an SSH session
	 */
	public unregisterSession(hostId: string): void {
		this.sessionRegistry.delete(hostId);
	}

	/**
	 * Gets a session by host ID
	 */
	public getSession(hostId: string): SshSession | undefined {
		return this.sessionRegistry.get(hostId);
	}

	/**
	 * Gets all registered host IDs
	 */
	public getRegisteredHostIds(): string[] {
		return Array.from(this.sessionRegistry.keys());
	}

	/**
	 * Broadcasts a command to multiple hosts
	 * @param hostIds Array of host IDs to send command to
	 * @param command The command to execute
	 * @param onProgress Optional callback for progress updates
	 * @returns Results for each host
	 */
	public async broadcast(
		hostIds: string[],
		command: string,
		onProgress?: (hostId: string, success: boolean, output?: string, error?: string) => void
	): Promise<Map<string, { success: boolean; output?: string; error?: string }>> {
		const results = new Map<string, { success: boolean; output?: string; error?: string }>();

		// Validate that all target hosts have active sessions
		const validHostIds = hostIds.filter(id => {
			const session = this.sessionRegistry.get(id);
			if (!session) {
				const error = 'No active session';
				results.set(id, { success: false, error });
				onProgress?.(id, false, undefined, error);
				return false;
			}
			if (!session.connected) {
				const error = 'Session not connected';
				results.set(id, { success: false, error });
				onProgress?.(id, false, undefined, error);
				return false;
			}
			return true;
		});

		// Execute command on all valid sessions concurrently
		const promises = validHostIds.map(async (hostId) => {
			const session = this.sessionRegistry.get(hostId)!;

			try {
				// Write command to the session
				session.write(command + '\n');

				// Note: We don't wait for output in broadcast mode
				// The terminal will display the output directly
				results.set(hostId, { success: true });
				onProgress?.(hostId, true);
			} catch (error: any) {
				const errorMsg = error.message || 'Unknown error';
				results.set(hostId, { success: false, error: errorMsg });
				onProgress?.(hostId, false, undefined, errorMsg);
			}
		});

		await Promise.allSettled(promises);

		return results;
	}

	/**
	 * Broadcasts a command to all registered sessions
	 * @param command The command to execute
	 * @param onProgress Optional callback for progress updates
	 * @returns Results for each host
	 */
	public async broadcastAll(
		command: string,
		onProgress?: (hostId: string, success: boolean, output?: string, error?: string) => void
	): Promise<Map<string, { success: boolean; output?: string; error?: string }>> {
		const allHostIds = this.getRegisteredHostIds();
		return this.broadcast(allHostIds, command, onProgress);
	}

	/**
	 * Gets the count of active sessions
	 */
	public get activeSessionCount(): number {
		return this.sessionRegistry.size;
	}

	/**
	 * Checks if a host has an active session
	 */
	public hasActiveSession(hostId: string): boolean {
		const session = this.sessionRegistry.get(hostId);
		return session !== undefined && session.connected;
	}

	/**
	 * Disposes the broadcast service
	 */
	public dispose(): void {
		this.sessionRegistry.clear();
	}
}
