import { Client, ClientChannel } from 'ssh2';
import * as vscode from 'vscode';
import * as fs from 'fs';
import { Host } from '../../common/types';
import { HostService } from '../hostService';
import { CredentialService } from '../credentialService';

/**
 * SSH Session Manager
 * Wraps an ssh2.Client and manages a shell session for terminal communication
 */
export class SshSession {
	private client: Client | null = null;
	private stream: ClientChannel | null = null;
	private isConnected: boolean = false;

	constructor(
		private readonly host: Host,
		private readonly hostService: HostService,
		private readonly credentialService: CredentialService,
		private readonly onData: (data: string) => void,
		private readonly onStatus: (status: 'connecting' | 'connected' | 'disconnected' | 'error', message?: string) => void
	) { }

	/**
	 * Connect to the SSH host and start a shell
	 */
	public async connect(): Promise<void> {
		try {
			this.onStatus('connecting', `Connecting to ${this.host.name || this.host.host}...`);

			// Get authentication configuration
			const authConfig = await this.getAuthConfig();

			// Initialize SSH client
			this.client = new Client();

			// Setup event handlers
			this.setupClientHandlers();

			// Connect
			this.client.connect({
				host: this.host.host,
				port: this.host.port,
				username: this.host.username,
				...authConfig,
				keepaliveInterval: this.host.keepAlive ? 30000 : undefined,
				readyTimeout: 20000
			});

		} catch (error) {
			this.handleError(error);
		}
	}

	/**
	 * Write data to the SSH stream
	 */
	public write(data: string): void {
		if (this.stream && this.isConnected) {
			this.stream.write(data);
		}
	}

	/**
	 * Resize the terminal window
	 */
	public resize(cols: number, rows: number): void {
		if (this.stream && this.isConnected) {
			this.stream.setWindow(rows, cols, 0, 0);
		}
	}

	/**
	 * Dispose and clean up the session
	 */
	public dispose(): void {
		if (this.stream) {
			this.stream.end();
			this.stream = null;
		}
		if (this.client) {
			this.client.end();
			this.client = null;
		}
		this.isConnected = false;
	}

	/**
	 * Check if session is connected
	 */
	public get connected(): boolean {
		return this.isConnected;
	}

	/**
	 * Get authentication configuration
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

				// Determine if secret is password or key
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
	 * Setup SSH client event handlers
	 */
	private setupClientHandlers(): void {
		if (!this.client) {
			return;
		}

		// Connection ready
		this.client.on('ready', () => {
			this.onStatus('connected', 'Connected successfully');

			// Request shell
			this.client!.shell(
				{
					term: 'xterm-256color',
					cols: 80,
					rows: 24
				},
				(err: Error | undefined, stream: ClientChannel) => {
					if (err) {
						this.handleError(err);
						return;
					}

					this.stream = stream;
					this.isConnected = true;

					// Pipe SSH stream data to terminal
					stream.on('data', (data: Buffer) => {
						this.onData(data.toString('utf8'));
					});

					// Handle stream close
					stream.on('close', () => {
						this.isConnected = false;
						this.onStatus('disconnected', 'Session ended');
						this.dispose();
					});

					// Handle stream errors
					stream.stderr.on('data', (data: Buffer) => {
						this.onData('\x1b[31m' + data.toString('utf8') + '\x1b[0m');
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
			if (!this.stream) {
				this.isConnected = false;
				this.onStatus('disconnected', 'Connection closed');
			}
		});

		// Connection timeout
		this.client.on('timeout', () => {
			this.isConnected = false;
			this.onStatus('error', 'Connection timeout');
			this.dispose();
		});
	}

	/**
	 * Handle connection errors
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

		this.isConnected = false;
		this.onStatus('error', errorMessage);
		this.dispose();
	}

	/**
	 * Execute a command to check if a file exists
	 */
	public async checkFileExists(path: string): Promise<boolean> {
		return new Promise((resolve) => {
			if (!this.client || !this.isConnected) {
				resolve(false);
				return;
			}

			this.client.exec(`test -f "${path}" && echo "EXISTS" || echo "NOT_EXISTS"`, (err, stream) => {
				if (err) {
					resolve(false);
					return;
				}

				let output = '';
				stream.on('data', (data: Buffer) => {
					output += data.toString();
				});

				stream.on('close', () => {
					resolve(output.trim().includes('EXISTS'));
				});
			});
		});
	}

	/**
	 * Read a file's contents via SFTP
	 */
	public async readFile(path: string): Promise<string> {
		return new Promise((resolve, reject) => {
			if (!this.client || !this.isConnected) {
				reject(new Error('Not connected'));
				return;
			}

			this.client.sftp((err, sftp) => {
				if (err) {
					reject(err);
					return;
				}

				sftp.readFile(path, 'utf8', (err, data) => {
					sftp.end();
					if (err) {
						reject(err);
					} else {
						resolve(data.toString());
					}
				});
			});
		});
	}
}
