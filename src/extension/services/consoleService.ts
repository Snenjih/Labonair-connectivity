import * as vscode from 'vscode';
import { Host } from '../../common/types';
import { SshSession } from './sshSession';
import { LocalPtyService } from './localPtyService';
import { HostService } from '../hostService';
import { CredentialService } from '../credentialService';
import { HostKeyService } from '../security/hostKeyService';

/**
 * Console Service
 * Manages integrated shell sessions for the File Manager
 * Dynamically switches between Local (PTY) and Remote (SSH) based on active panel
 */
export class ConsoleService {
	private session: SshSession | LocalPtyService | null = null;
	private currentMode: 'local' | 'remote' | null = null;
	private currentPath: string = '~';
	private hostId: string;
	private host: Host;

	constructor(
		hostId: string,
		host: Host,
		private readonly webview: vscode.Webview,
		private readonly hostService: HostService,
		private readonly credentialService: CredentialService,
		private readonly hostKeyService: HostKeyService
	) {
		this.hostId = hostId;
		this.host = host;
	}

	/**
	 * Switch to a different file system mode
	 * @param mode The file system mode to switch to
	 * @param path The current working directory
	 */
	public async switchMode(mode: 'local' | 'remote', path: string): Promise<void> {
		// If we're already in this mode, just navigate to the path
		if (this.currentMode === mode && this.session) {
			await this.navigateToPath(path);
			return;
		}

		// Dispose old session
		if (this.session) {
			this.session.dispose();
			this.session = null;
		}

		// Create new session
		this.currentMode = mode;
		this.currentPath = path;

		if (mode === 'local') {
			await this.createLocalSession();
		} else {
			await this.createRemoteSession();
		}

		// Navigate to the path after session is established
		setTimeout(() => {
			this.navigateToPath(path);
		}, 500);
	}

	/**
	 * Create a local PTY session
	 */
	private async createLocalSession(): Promise<void> {
		const onData = (data: string) => {
			this.webview.postMessage({
				command: 'CONSOLE_DATA',
				payload: { data }
			});
		};

		const onStatus = (status: 'connecting' | 'connected' | 'disconnected' | 'error', message?: string) => {
			this.webview.postMessage({
				command: 'CONSOLE_STATUS',
				payload: { status, message }
			});
		};

		this.session = new LocalPtyService(this.host, onData, onStatus);
		await this.session.connect();
	}

	/**
	 * Create a remote SSH session
	 */
	private async createRemoteSession(): Promise<void> {
		const onData = (data: string) => {
			this.webview.postMessage({
				command: 'CONSOLE_DATA',
				payload: { data }
			});
		};

		const onStatus = (status: 'connecting' | 'connected' | 'disconnected' | 'error', message?: string) => {
			this.webview.postMessage({
				command: 'CONSOLE_STATUS',
				payload: { status, message }
			});
		};

		this.session = new SshSession(
			this.host,
			this.hostService,
			this.credentialService,
			this.hostKeyService,
			onData,
			onStatus
		);
		await this.session.connect();
	}

	/**
	 * Navigate to a path (auto-send cd command)
	 */
	public async navigateToPath(path: string): Promise<void> {
		if (!this.session || !this.session.connected) {
			return;
		}

		this.currentPath = path;

		// Expand tilde to home directory
		const expandedPath = path === '~' ? path : path;

		// Send cd command to the shell
		// Use quotes to handle paths with spaces
		const command = `cd "${expandedPath}"\n`;
		this.session.write(command);
	}

	/**
	 * Write data to the console
	 */
	public write(data: string): void {
		if (this.session && this.session.connected) {
			this.session.write(data);
		}
	}

	/**
	 * Resize the console terminal
	 */
	public resize(cols: number, rows: number): void {
		if (this.session && this.session.connected) {
			this.session.resize(cols, rows);
		}
	}

	/**
	 * Get current mode
	 */
	public getMode(): 'local' | 'remote' | null {
		return this.currentMode;
	}

	/**
	 * Get current path
	 */
	public getCurrentPath(): string {
		return this.currentPath;
	}

	/**
	 * Check if session is connected
	 */
	public isConnected(): boolean {
		return this.session !== null && this.session.connected;
	}

	/**
	 * Dispose the console service
	 */
	public dispose(): void {
		if (this.session) {
			this.session.dispose();
			this.session = null;
		}
		this.currentMode = null;
	}
}
