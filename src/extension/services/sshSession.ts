import { Client, ClientChannel } from 'ssh2';
import { Host } from '../../common/types';
import { HostService } from '../hostService';
import { CredentialService } from '../credentialService';
import { HostKeyService } from '../security/hostKeyService';
import { ConnectionPool } from './connectionPool';

/**
 * SSH Session Manager
 * Wraps an ssh2.Client and manages a shell session for terminal communication
 * Now uses ConnectionPool for shared connections
 */
export class SshSession {
	private client: Client | null = null;
	private stream: ClientChannel | null = null;
	private isConnected: boolean = false;
	private usePooledConnection: boolean = true;
	private hostId: string;

	constructor(
		private readonly host: Host,
		private readonly hostService: HostService,
		private readonly credentialService: CredentialService,
		private readonly hostKeyService: HostKeyService,
		private readonly onData: (data: string) => void,
		private readonly onStatus: (status: 'connecting' | 'connected' | 'disconnected' | 'error', message?: string) => void
	) {
		this.hostId = host.id;
	}

	/**
	 * Connect to the SSH host and start a shell
	 */
	public async connect(): Promise<void> {
		try {
			this.onStatus('connecting', `Connecting to ${this.host.name || this.host.host}...`);

			// Use ConnectionPool for shared connection
			this.client = await ConnectionPool.acquire(
				this.host,
				this.hostService,
				this.credentialService,
				this.hostKeyService
			);

			// Setup shell on the pooled connection
			this.setupShell();

		} catch (error) {
			this.handleError(error);
		}
	}

	/**
	 * Setup shell on the connected client
	 */
	private setupShell(): void {
		if (!this.client) {
			return;
		}

		this.client.shell(
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
				this.onStatus('connected', 'Connected successfully');

				// Pipe SSH stream data to terminal
				stream.on('data', (data: Buffer) => {
					this.onData(data.toString('utf8'));
				});

				// Handle stream close
				stream.on('close', () => {
					this.isConnected = false;
					this.onStatus('disconnected', 'Session ended');
				});

				// Handle stream errors
				stream.stderr.on('data', (data: Buffer) => {
					this.onData('\x1b[31m' + data.toString('utf8') + '\x1b[0m');
				});
			}
		);
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
		
		// Release the connection back to the pool
		if (this.usePooledConnection && this.hostId) {
			ConnectionPool.release(this.hostId);
		}
		
		this.client = null;
		this.isConnected = false;
	}

	public get connected(): boolean {
		return this.isConnected;
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

				const chunks: Buffer[] = [];
				const stream = sftp.createReadStream(path);

				stream.on('data', (chunk: Buffer) => {
					chunks.push(chunk);
				});

				stream.on('error', (err: Error) => {
					sftp.end();
					reject(err);
				});

				stream.on('end', () => {
					sftp.end();
					resolve(Buffer.concat(chunks).toString('utf8'));
				});
			});
		});
	}

}
