import * as vscode from 'vscode';
import { Client } from 'ssh2';
import { Host } from '../../common/types';
import { HostService } from '../hostService';
import { CredentialService } from '../credentialService';
import { SshTerminal } from '../terminal/sshTerminal';

/**
 * SSH Connection Service
 * Manages SSH connections and terminal sessions
 */
export class SshConnectionService {
	private activeSessions: Map<string, Client> = new Map();

	constructor(
		private readonly hostService: HostService,
		private readonly credentialService: CredentialService
	) { }

	/**
	 * Creates a new SSH terminal session for the given host
	 * @param host The host to connect to
	 * @returns A VS Code Terminal instance
	 */
	public async createSession(host: Host): Promise<vscode.Terminal> {
		// Create pseudoterminal
		const sshTerminal = new SshTerminal(
			host,
			this.hostService,
			this.credentialService,
			(client) => this.activeSessions.set(host.id, client),
			() => this.disconnectSession(host.id)
		);

		// Create VS Code terminal
		const terminal = vscode.window.createTerminal({
			name: `SSH: ${host.name || host.host}`,
			pty: sshTerminal
		});

		return terminal;
	}

	/**
	 * Disconnects an active SSH session
	 * @param hostId The host ID to disconnect
	 */
	public disconnectSession(hostId: string): void {
		const client = this.activeSessions.get(hostId);
		if (client) {
			client.end();
			this.activeSessions.delete(hostId);
		}
	}

	/**
	 * Disconnects all active sessions
	 */
	public dispose(): void {
		for (const [hostId, client] of this.activeSessions.entries()) {
			client.end();
		}
		this.activeSessions.clear();
	}
}
