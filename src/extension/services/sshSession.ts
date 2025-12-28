import { Client, ClientChannel } from 'ssh2';
import * as net from 'net';
import { Host, Tunnel } from '../../common/types';
import { HostService } from '../hostService';
import { CredentialService } from '../credentialService';
import { HostKeyService } from '../security/hostKeyService';
import { ConnectionPool } from './connectionPool';

/**
 * Tunnel status information
 */
interface TunnelStatus {
	type: 'local' | 'remote';
	srcPort: number;
	dstHost: string;
	dstPort: number;
	status: 'active' | 'error';
	error?: string;
	server?: net.Server; // For local forwarding
}

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
	private tunnelStatuses: TunnelStatus[] = [];

	constructor(
		private readonly host: Host,
		private readonly hostService: HostService,
		private readonly credentialService: CredentialService,
		private readonly hostKeyService: HostKeyService,
		private readonly onData: (data: string) => void,
		private readonly onStatus: (status: 'connecting' | 'connected' | 'disconnected' | 'error', message?: string) => void,
		private readonly onTunnelStatus?: (statuses: TunnelStatus[]) => void
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

			// Setup tunnels if configured
			if (this.host.tunnels && this.host.tunnels.length > 0) {
				await this.setupTunnels();
			}

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

				// Execute post-exec scripts if configured
				if (this.host.postExecScript && this.host.postExecScript.length > 0) {
					// Wait for shell to be ready before executing commands
					setTimeout(() => {
						if (this.stream && this.isConnected) {
							for (const command of this.host.postExecScript!) {
								this.stream.write(command + '\n');
							}
						}
					}, 500);
				}

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
	 * Setup port forwarding tunnels
	 */
	private async setupTunnels(): Promise<void> {
		if (!this.client || !this.host.tunnels) {
			return;
		}

		for (const tunnel of this.host.tunnels) {
			if (tunnel.autoStart !== false) {
				try {
					if (tunnel.type === 'local') {
						await this.setupLocalForward(tunnel);
					} else {
						await this.setupRemoteForward(tunnel);
					}
				} catch (error: any) {
					this.tunnelStatuses.push({
						type: tunnel.type,
						srcPort: tunnel.srcPort,
						dstHost: tunnel.dstHost,
						dstPort: tunnel.dstPort,
						status: 'error',
						error: error.message
					});
				}
			}
		}

		// Report tunnel status
		this.reportTunnelStatus();
	}

	/**
	 * Setup local port forwarding (Local port -> Remote host:port)
	 */
	private async setupLocalForward(tunnel: Tunnel): Promise<void> {
		if (!this.client) {
			throw new Error('SSH client not connected');
		}

		return new Promise((resolve, reject) => {
			const server = net.createServer((socket) => {
				// Forward connection through SSH
				this.client!.forwardOut(
					socket.remoteAddress || '127.0.0.1',
					socket.remotePort || 0,
					tunnel.dstHost,
					tunnel.dstPort,
					(err, stream) => {
						if (err) {
							console.error('Local forward error:', err);
							socket.end();
							return;
						}

						// Pipe socket to SSH stream and vice versa
						socket.pipe(stream);
						stream.pipe(socket);

						socket.on('error', (err: Error) => {
							console.error('Socket error:', err);
							stream.end();
						});

						stream.on('error', (err: Error) => {
							console.error('Stream error:', err);
							socket.end();
						});
					}
				);
			});

			server.on('error', (err) => {
				reject(err);
			});

			server.listen(tunnel.srcPort, '127.0.0.1', () => {
				this.tunnelStatuses.push({
					type: 'local',
					srcPort: tunnel.srcPort,
					dstHost: tunnel.dstHost,
					dstPort: tunnel.dstPort,
					status: 'active',
					server
				});
				console.log(`Local forward active: localhost:${tunnel.srcPort} -> ${tunnel.dstHost}:${tunnel.dstPort}`);
				resolve();
			});
		});
	}

	/**
	 * Setup remote port forwarding (Remote port -> Local host:port)
	 */
	private async setupRemoteForward(tunnel: Tunnel): Promise<void> {
		if (!this.client) {
			throw new Error('SSH client not connected');
		}

		return new Promise((resolve, reject) => {
			this.client!.forwardIn('0.0.0.0', tunnel.srcPort, (err) => {
				if (err) {
					reject(err);
					return;
				}

				this.tunnelStatuses.push({
					type: 'remote',
					srcPort: tunnel.srcPort,
					dstHost: tunnel.dstHost,
					dstPort: tunnel.dstPort,
					status: 'active'
				});

				console.log(`Remote forward active: remote:${tunnel.srcPort} -> ${tunnel.dstHost}:${tunnel.dstPort}`);
				resolve();
			});

			// Handle incoming connections
			this.client!.on('tcp connection', (info, accept) => {
				if (info.destPort === tunnel.srcPort) {
					const stream = accept();
					const socket = net.createConnection(tunnel.dstPort, tunnel.dstHost);

					// Pipe stream to socket and vice versa
					stream.pipe(socket);
					socket.pipe(stream);

					stream.on('error', (err: Error) => {
						console.error('Stream error:', err);
						socket.end();
					});

					socket.on('error', (err: Error) => {
						console.error('Socket error:', err);
						stream.end();
					});
				}
			});
		});
	}

	/**
	 * Report tunnel status to callback
	 */
	private reportTunnelStatus(): void {
		if (this.onTunnelStatus) {
			this.onTunnelStatus(this.tunnelStatuses);
		}
	}

	/**
	 * Gets current tunnel statuses
	 */
	public getTunnelStatuses(): TunnelStatus[] {
		return this.tunnelStatuses;
	}

	/**
	 * Dispose and clean up the session
	 */
	public dispose(): void {
		if (this.stream) {
			this.stream.end();
			this.stream = null;
		}

		// Close all local forwarding servers
		for (const tunnel of this.tunnelStatuses) {
			if (tunnel.server) {
				tunnel.server.close();
			}
		}
		this.tunnelStatuses = [];

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
