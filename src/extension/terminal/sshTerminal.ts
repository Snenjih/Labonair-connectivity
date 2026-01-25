import * as vscode from 'vscode';
import { Client, ClientChannel } from 'ssh2';
import * as fs from 'fs';
import { Host } from '../../common/types';
import { HostService } from '../hostService';
import { CredentialService } from '../credentialService';

/**
 * SSH Pseudoterminal
 * Implements the VS Code Pseudoterminal interface for SSH connections
 */
export class SshTerminal implements vscode.Pseudoterminal {
	private writeEmitter = new vscode.EventEmitter<string>();
	private closeEmitter = new vscode.EventEmitter<number>();

	public onDidWrite: vscode.Event<string> = this.writeEmitter.event;
	public onDidClose?: vscode.Event<number> = this.closeEmitter.event;

	private client: Client | null = null;
	private stream: ClientChannel | null = null;
	private dimensions: vscode.TerminalDimensions | undefined;

	constructor(
		private readonly host: Host,
		private readonly hostService: HostService,
		private readonly credentialService: CredentialService,
		private readonly onClientReady: (client: Client) => void,
		private readonly onSessionEnd: () => void
	) { }

	/**
	 * Opens the terminal and initiates SSH connection
	 */
	public async open(initialDimensions: vscode.TerminalDimensions | undefined): Promise<void> {
		this.dimensions = initialDimensions;

		// Display connecting message
		this.writeEmitter.fire(`\r\nConnecting to ${this.host.name || this.host.host}...\r\n`);

		try {
			// Retrieve authentication credentials
			const authConfig = await this.getAuthConfig();

			// Initialize SSH client
			this.client = new Client();

			// Setup event handlers
			this.setupClientHandlers();

			// Connect
			const config = vscode.workspace.getConfiguration('labonair.connection');
			const keepaliveInterval = this.host.keepAlive ? config.get<number>('keepaliveInterval', 30000) : undefined;
			const readyTimeout = config.get<number>('readyTimeout', 20000);

			this.client.connect({
				host: this.host.host,
				port: this.host.port,
				username: this.host.username,
				...authConfig,
				keepaliveInterval,
				readyTimeout
			});

		} catch (error) {
			this.handleError(error);
		}
	}

	/**
	 * Handles user input from the terminal
	 */
	public handleInput(data: string): void {
		if (this.stream) {
			this.stream.write(data);
		}
	}

	/**
	 * Handles terminal window resizing
	 */
	public setDimensions(dimensions: vscode.TerminalDimensions): void {
		this.dimensions = dimensions;
		if (this.stream) {
			this.stream.setWindow(dimensions.rows, dimensions.columns, 0, 0);
		}
	}

	/**
	 * Closes the terminal and SSH connection
	 */
	public close(): void {
		if (this.stream) {
			this.stream.end();
			this.stream = null;
		}
		if (this.client) {
			this.client.end();
			this.client = null;
		}
		this.onSessionEnd();
	}

	/**
	 * Retrieves authentication configuration based on host settings
	 */
	private async getAuthConfig(): Promise<any> {
		const authConfig: any = {};

		switch (this.host.authType) {
			case 'password': {
				const password = await this.hostService.getPassword(this.host.id);
				if (password) {
					authConfig.password = password;
				} else {
					throw new Error('Password authentication configured but no password found');
				}
				break;
			}

			case 'key': {
				const keyPath = await this.hostService.getKeyPath(this.host.id);
				if (keyPath) {
					try {
						const privateKey = fs.readFileSync(keyPath, 'utf8');
						authConfig.privateKey = privateKey;

						// Check if key has a passphrase (optional: prompt user if needed)
						// For now, we'll attempt connection and let SSH2 handle it
					} catch (error) {
						throw new Error(`Failed to read private key from ${keyPath}: ${error}`);
					}
				} else {
					throw new Error('Key authentication configured but no key path found');
				}
				break;
			}

			case 'agent': {
				authConfig.agent = process.env.SSH_AUTH_SOCK;
				if (!authConfig.agent) {
					throw new Error('SSH agent authentication configured but SSH_AUTH_SOCK not found');
				}
				break;
			}

			case 'credential': {
				if (!this.host.credentialId) {
					throw new Error('Credential authentication configured but no credential ID specified');
				}

				const secret = await this.credentialService.getSecret(this.host.credentialId);
				if (!secret) {
					throw new Error(`Credential not found: ${this.host.credentialId}`);
				}

				// Determine if secret is password or key path
				// If it starts with a path-like pattern or contains "BEGIN", treat as key
				if (secret.includes('BEGIN') || secret.includes('PRIVATE KEY')) {
					authConfig.privateKey = secret;
				} else if (secret.startsWith('/') || secret.startsWith('~')) {
					// It's a file path
					try {
						const privateKey = fs.readFileSync(secret, 'utf8');
						authConfig.privateKey = privateKey;
					} catch (error) {
						throw new Error(`Failed to read private key from ${secret}: ${error}`);
					}
				} else {
					// Treat as password
					authConfig.password = secret;
				}
				break;
			}

			default:
				throw new Error(`Unsupported authentication type: ${this.host.authType}`);
		}

		return authConfig;
	}

	/**
	 * Sets up SSH client event handlers
	 */
	private setupClientHandlers(): void {
		if (!this.client) {
			return;
		}

		// Connection ready
		this.client.on('ready', () => {
			this.writeEmitter.fire('\x1b[32m✓ Connected\x1b[0m\r\n\r\n');

			// Notify parent service
			if (this.client) {
				this.onClientReady(this.client);
			}

			// Request shell
			this.client!.shell(
				{
					term: 'xterm-256color',
					cols: this.dimensions?.columns || 80,
					rows: this.dimensions?.rows || 24
				},
				(err: Error | undefined, stream: ClientChannel) => {
					if (err) {
						this.handleError(err);
						return;
					}

					this.stream = stream;

					// Pipe SSH stream data to terminal
					stream.on('data', (data: Buffer) => {
						this.writeEmitter.fire(data.toString('utf8'));
					});

					// Handle stream close
					stream.on('close', () => {
						this.writeEmitter.fire('\r\n\x1b[33mSession ended\x1b[0m\r\n');
						this.closeEmitter.fire(0);
						this.close();
					});

					// Handle stream errors
					stream.stderr.on('data', (data: Buffer) => {
						this.writeEmitter.fire('\x1b[31m' + data.toString('utf8') + '\x1b[0m');
					});
				}
			);
		});

		// Connection errors
		this.client.on('error', (err: Error) => {
			this.handleError(err);
		});

		// Connection closed
		this.client.on('close', () => {
			if (this.stream) {
				// Already handled in stream close
				return;
			}
			this.writeEmitter.fire('\r\n\x1b[33mConnection closed\x1b[0m\r\n');
			this.closeEmitter.fire(0);
			this.close();
		});

		// Connection timeout
		this.client.on('timeout', () => {
			this.writeEmitter.fire('\r\n\x1b[31m✗ Connection timeout\x1b[0m\r\n');
			this.closeEmitter.fire(1);
			this.close();
		});
	}

	/**
	 * Handles connection errors with formatted messages
	 */
	private handleError(error: any): void {
		let errorMessage = 'Unknown error';

		if (error.code === 'ECONNREFUSED') {
			errorMessage = `Connection refused to ${this.host.host}:${this.host.port}`;
		} else if (error.code === 'ENOTFOUND') {
			errorMessage = `Host not found: ${this.host.host}`;
		} else if (error.code === 'ETIMEDOUT') {
			errorMessage = `Connection timeout to ${this.host.host}:${this.host.port}`;
		} else if (error.level === 'client-authentication') {
			errorMessage = 'Authentication failed. Please check your credentials.';
		} else if (error.message) {
			errorMessage = error.message;
		}

		this.writeEmitter.fire(`\r\n\x1b[31m✗ Error: ${errorMessage}\x1b[0m\r\n`);
		this.closeEmitter.fire(1);
		this.close();
	}
}
