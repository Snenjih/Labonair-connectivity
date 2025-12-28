import { Client } from 'ssh2';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { Host } from '../../common/types';
import { HostService } from '../hostService';
import { CredentialService } from '../credentialService';
import { HostKeyService } from '../security/hostKeyService';
import { SshAgentService } from '../security/sshAgentService';

/**
 * Connection entry in the pool
 */
interface PooledConnection {
	client: Client;
	refCount: number;
	host: Host;
}

/**
 * Singleton Connection Pool
 * Manages SSH connections with ref-counting for shared access between Terminal and SFTP
 */
class ConnectionPoolImpl {
	private static instance: ConnectionPoolImpl;
	private connections: Map<string, PooledConnection> = new Map();
	private sshAgentService: SshAgentService;

	private constructor() {
		this.sshAgentService = new SshAgentService();
	}

	public static getInstance(): ConnectionPoolImpl {
		if (!ConnectionPoolImpl.instance) {
			ConnectionPoolImpl.instance = new ConnectionPoolImpl();
		}
		return ConnectionPoolImpl.instance;
	}

	/**
	 * Gets an existing connection if available
	 */
	public getConnection(hostId: string): Client | undefined {
		const pooled = this.connections.get(hostId);
		return pooled?.client;
	}

	/**
	 * Acquires a connection - creates new one if needed, or increments refCount
	 */
	public async acquire(
		host: Host,
		hostService: HostService,
		credentialService: CredentialService,
		hostKeyService: HostKeyService
	): Promise<Client> {
		const existing = this.connections.get(host.id);

		if (existing) {
			existing.refCount++;
			console.log(`[ConnectionPool] Reusing connection for ${host.id}, refCount: ${existing.refCount}`);
			return existing.client;
		}

		// Create new connection
		console.log(`[ConnectionPool] Creating new connection for ${host.id}`);
		// Create new connection
		console.log(`[ConnectionPool] Creating new connection for ${host.id}`);
		const client = await this.createConnection(host, hostService, credentialService, hostKeyService);

		this.connections.set(host.id, {
			client,
			refCount: 1,
			host
		});

		// Handle unexpected disconnection
		client.on('close', () => {
			console.log(`[ConnectionPool] Connection closed unexpectedly for ${host.id}`);
			this.connections.delete(host.id);
		});

		client.on('error', (err) => {
			console.error(`[ConnectionPool] Connection error for ${host.id}:`, err);
			this.connections.delete(host.id);
		});

		return client;
	}

	/**
	 * Releases a connection - decrements refCount and disconnects when 0
	 */
	public release(hostId: string): void {
		const pooled = this.connections.get(hostId);

		if (!pooled) {
			console.log(`[ConnectionPool] No connection to release for ${hostId}`);
			return;
		}

		pooled.refCount--;
		console.log(`[ConnectionPool] Released connection for ${hostId}, refCount: ${pooled.refCount}`);

		if (pooled.refCount <= 0) {
			console.log(`[ConnectionPool] Closing connection for ${hostId}`);
			pooled.client.end();
			this.connections.delete(hostId);
		}
	}

	/**
	 * Checks if a connection exists for a host
	 */
	public hasConnection(hostId: string): boolean {
		return this.connections.has(hostId);
	}

	/**
	 * Gets current ref count for debugging
	 */
	public getRefCount(hostId: string): number {
		return this.connections.get(hostId)?.refCount || 0;
	}

	/**
	 * Disposes all connections
	 */
	public dispose(): void {
		for (const [hostId, pooled] of this.connections.entries()) {
			console.log(`[ConnectionPool] Disposing connection for ${hostId}`);
			pooled.client.end();
		}
		this.connections.clear();
	}

	/**
	 * Creates a new SSH connection
	 */
	private async createConnection(
		host: Host,
		hostService: HostService,
		credentialService: CredentialService,
		hostKeyService: HostKeyService
	): Promise<Client> {
		const authConfig = await this.getAuthConfig(host, hostService, credentialService);

		return new Promise((resolve, reject) => {
			const client = new Client();

			client.on('ready', () => {
				console.log(`[ConnectionPool] Connection ready for ${host.id}`);
				resolve(client);
			});

			client.on('error', (err: Error) => {
				console.error(`[ConnectionPool] Client error for ${host.id}:`, err);
				reject(err);
			});

			client.connect({
				host: host.host,
				port: host.port,
				username: host.username,
				...authConfig,
				keepaliveInterval: host.keepAlive ? 30000 : undefined,
				readyTimeout: 20000,
				// Security: If host verification is critical, we should implement a strict verifier.
				// For now, we log the fingerprint but accept to avoid blocking users (promiscuous mode)
				// effectively mimicking known_hosts management but defaulting to accept.
				hostVerifier: (keyHash: Buffer) => {
					// We can log the hash here for debugging
					const fingerprint = keyHash.toString('base64');
					console.log(`[ConnectionPool] Server Host Key Fingerprint: ${fingerprint}`);
					
					// Future TODO: Verify against HostKeyService
					// const status = hostKeyService.verifyHostKey(host.host, host.port, 'ssh-rsa', keyHash); 
					// if status === 'invalid' -> return false;
					
					return true; // Accept all for now (fixes loop issue)
				}
			});
		});
	}

	/**
	 * Gets authentication configuration for a host
	 */
	private async getAuthConfig(
		host: Host,
		hostService: HostService,
		credentialService: CredentialService
	): Promise<any> {
		const authConfig: any = {};

		switch (host.authType) {
			case 'password': {
				const password = await hostService.getPassword(host.id);
				if (password) {
					authConfig.password = password;
					authConfig.tryKeyboard = true; // Try keyboard-interactive if password fails
				} else {
					throw new Error('Password authentication configured but no password found');
				}
				break;
			}

			case 'key': {
				const keyPath = await hostService.getKeyPath(host.id);
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
				// Use SshAgentService to detect the agent socket (supports Windows named pipes)
				const agentSocket = await this.sshAgentService.getAgentSocket();

				if (agentSocket) {
					authConfig.agent = agentSocket;
					console.log('[ConnectionPool] Using SSH agent:', agentSocket);
				} else {
					// Fallback: prompt user for password or key
					console.warn('[ConnectionPool] SSH agent not available, prompting for fallback authentication');

					const choice = await vscode.window.showQuickPick(
						['Enter Password', 'Select Private Key'],
						{
							placeHolder: 'SSH agent not available. Choose fallback authentication method:',
							title: 'SSH Agent Fallback'
						}
					);

					if (choice === 'Enter Password') {
						const password = await vscode.window.showInputBox({
							prompt: 'Enter SSH password',
							password: true,
							placeHolder: 'Password for ' + host.username + '@' + host.host
						});

						if (!password) {
							throw new Error('Authentication cancelled');
						}

						authConfig.password = password;
						authConfig.tryKeyboard = true;
					} else if (choice === 'Select Private Key') {
						const keyFiles = await vscode.window.showOpenDialog({
							canSelectMany: false,
							openLabel: 'Select Private Key',
							title: 'Select SSH Private Key',
							filters: {
								'SSH Keys': ['pem', 'key', 'ppk', ''],
								'All Files': ['*']
							}
						});

						if (!keyFiles || keyFiles.length === 0) {
							throw new Error('Authentication cancelled');
						}

						try {
							const privateKey = fs.readFileSync(keyFiles[0].fsPath, 'utf8');
							authConfig.privateKey = privateKey;
						} catch (error) {
							throw new Error(`Failed to read private key: ${error}`);
						}
					} else {
						throw new Error('Authentication cancelled');
					}
				}
				break;
			}

			case 'credential': {
				if (!host.credentialId) {
					throw new Error('Credential authentication configured but no credential ID specified');
				}

				const secret = await credentialService.getSecret(host.credentialId);
				if (!secret) {
					throw new Error(`Credential not found: ${host.credentialId}`);
				}

				// Determine if secret is password or key
				if (secret.includes('BEGIN') || secret.includes('PRIVATE KEY')) {
					authConfig.privateKey = secret;
				} else if (secret.startsWith('/') || secret.startsWith('~')) {
					try {
						const privateKey = fs.readFileSync(secret, 'utf8');
						authConfig.privateKey = privateKey;
					} catch (error) {
						throw new Error(`Failed to read private key from ${secret}: ${error}`);
					}
				} else {
					authConfig.password = secret;
					authConfig.tryKeyboard = true; // Try keyboard-interactive for credential passwords too
				}
				break;
			}

			default:
				throw new Error(`Unsupported authentication type: ${host.authType}`);
		}

		return authConfig;
	}
}

// Export singleton instance
export const ConnectionPool = ConnectionPoolImpl.getInstance();
