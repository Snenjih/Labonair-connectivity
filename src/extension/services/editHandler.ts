import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { SftpService } from './sftpService';
import { HostService } from '../hostService';
import { CredentialService } from '../credentialService';

/**
 * Represents a tracked remote file that's being edited locally
 */
interface RemoteFileMapping {
	localUri: vscode.Uri;
	hostId: string;
	remotePath: string;
	permissions: string;
	originalContent?: string;
	lastSaved?: number;
}

/**
 * Edit Handler Service
 * Manages the Edit-on-Fly workflow:
 * - Downloads remote files to temp directory
 * - Opens them in VS Code
 * - Watches for saves and auto-uploads changes
 * - Handles sudo save for permission-denied files
 */
export class EditHandler {
	private remoteFileMap: Map<string, RemoteFileMapping> = new Map();
	private tempDir: string;
	private disposables: vscode.Disposable[] = [];
	private sudoPasswordCache: Map<string, string> = new Map(); // hostId -> password
	private readonly FILE_SIZE_SOFT_LIMIT = 5 * 1024 * 1024; // 5 MB
	private readonly FILE_SIZE_HARD_LIMIT = 100 * 1024 * 1024; // 100 MB

	constructor(
		private readonly sftpService: SftpService,
		private readonly hostService: HostService,
		private readonly credentialService: CredentialService,
		private readonly context: vscode.ExtensionContext
	) {
		// Create temp directory
		this.tempDir = path.join(os.tmpdir(), 'labonair', context.globalState.get('sessionId', Date.now().toString()));
		this.ensureTempDir();

		// Register file save watcher
		this.registerFileWatcher();

		// Register text document close listener for cleanup
		this.registerCloseListener();
	}

	/**
	 * Ensures the temp directory exists
	 */
	private ensureTempDir(): void {
		if (!fs.existsSync(this.tempDir)) {
			fs.mkdirSync(this.tempDir, { recursive: true });
		}
	}

	/**
	 * Opens a remote file for editing
	 */
	public async openRemoteFile(hostId: string, remotePath: string): Promise<void> {
		try {
			// Get file stats first to check size
			const fileInfo = await this.sftpService.stat(hostId, remotePath);

			// Check file size limits
			if (fileInfo.size > this.FILE_SIZE_HARD_LIMIT) {
				vscode.window.showErrorMessage(
					`File is too large (${this.formatSize(fileInfo.size)}). Maximum size for editing is ${this.formatSize(this.FILE_SIZE_HARD_LIMIT)}. Please download the file instead.`
				);
				return;
			}

			if (fileInfo.size > this.FILE_SIZE_SOFT_LIMIT) {
				const choice = await vscode.window.showWarningMessage(
					`File is large (${this.formatSize(fileInfo.size)}). Opening it may slow down VS Code. Continue?`,
					'Download Instead',
					'Edit Anyway'
				);

				if (choice !== 'Edit Anyway') {
					// TODO: Trigger download action
					vscode.window.showInformationMessage('Please use the Download button to save the file locally.');
					return;
				}
			}

			// Create a unique temp file path
			const fileName = path.basename(remotePath);
			const sanitizedPath = remotePath.replace(/\//g, '_');
			const tempFilePath = path.join(this.tempDir, `${hostId}_${sanitizedPath}`);

			// Download the file
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Downloading ${fileName}...`,
				cancellable: false
			}, async () => {
				await this.sftpService.getFile(hostId, remotePath, tempFilePath);
			});

			// Read original content for comparison
			const originalContent = fs.readFileSync(tempFilePath, 'utf8');

			// Open the file in VS Code
			const localUri = vscode.Uri.file(tempFilePath);
			const document = await vscode.workspace.openTextDocument(localUri);
			await vscode.window.showTextDocument(document);

			// Track the mapping
			this.remoteFileMap.set(tempFilePath, {
				localUri,
				hostId,
				remotePath,
				permissions: fileInfo.permissions,
				originalContent,
				lastSaved: Date.now()
			});

			vscode.window.showInformationMessage(`Editing remote file: ${remotePath}`);
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to open remote file: ${error}`);
			throw error;
		}
	}

	/**
	 * Registers file save watcher
	 */
	private registerFileWatcher(): void {
		const saveWatcher = vscode.workspace.onDidSaveTextDocument(async (document) => {
			const localPath = document.uri.fsPath;
			const mapping = this.remoteFileMap.get(localPath);

			if (!mapping) {
				return; // Not a tracked remote file
			}

			try {
				await this.uploadChanges(mapping, document);
			} catch (error: any) {
				// Check if it's a permission error
				if (this.isPermissionError(error)) {
					await this.handleSudoSave(mapping, document, error);
				} else {
					vscode.window.showErrorMessage(`Failed to upload changes: ${error.message}`);
				}
			}
		});

		this.disposables.push(saveWatcher);
	}

	/**
	 * Registers text document close listener for cleanup
	 */
	private registerCloseListener(): void {
		const closeListener = vscode.workspace.onDidCloseTextDocument(async (document) => {
			const localPath = document.uri.fsPath;
			const mapping = this.remoteFileMap.get(localPath);

			if (!mapping) {
				return;
			}

			// Clean up temp file
			try {
				if (fs.existsSync(localPath)) {
					fs.unlinkSync(localPath);
				}
				this.remoteFileMap.delete(localPath);
			} catch (error) {
				console.error(`Failed to clean up temp file ${localPath}:`, error);
			}
		});

		this.disposables.push(closeListener);
	}

	/**
	 * Uploads changes to remote server
	 */
	private async uploadChanges(mapping: RemoteFileMapping, document: vscode.TextDocument): Promise<void> {
		const localPath = mapping.localUri.fsPath;

		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Uploading ${path.basename(mapping.remotePath)}...`,
			cancellable: false
		}, async () => {
			await this.sftpService.putFile(
				mapping.hostId,
				localPath,
				mapping.remotePath
			);
		});

		// Update last saved timestamp
		mapping.lastSaved = Date.now();
		vscode.window.showInformationMessage(`✓ Saved: ${mapping.remotePath}`);
	}

	/**
	 * Checks if an error is a permission error
	 */
	private isPermissionError(error: any): boolean {
		const errorMessage = error.message?.toLowerCase() || '';
		return errorMessage.includes('permission denied') ||
		       errorMessage.includes('eacces') ||
		       errorMessage.includes('access denied');
	}

	/**
	 * Handles sudo save for permission-denied files
	 */
	private async handleSudoSave(mapping: RemoteFileMapping, document: vscode.TextDocument, error: any): Promise<void> {
		const host = this.hostService.getHostById(mapping.hostId);
		if (!host) {
			vscode.window.showErrorMessage('Host not found');
			return;
		}

		const sudoMode = host.sudoSaveMode || 'prompt';
		let sudoPassword: string | undefined;

		// Determine sudo password based on mode
		switch (sudoMode) {
			case 'credential':
				// Use host's credential
				if (host.authType === 'password') {
					sudoPassword = await this.hostService.getPassword(mapping.hostId);
				} else if (host.authType === 'credential' && host.credentialId) {
					sudoPassword = await this.credentialService.getSecret(host.credentialId);
					// If it's a key path, we can't use it for sudo
					if (sudoPassword?.startsWith('/') || sudoPassword?.includes('BEGIN')) {
						sudoPassword = undefined;
					}
				}
				break;

			case 'cache':
				// Check cache first
				sudoPassword = this.sudoPasswordCache.get(mapping.hostId);
				if (!sudoPassword) {
					// Prompt and cache
					sudoPassword = await vscode.window.showInputBox({
						prompt: 'Enter sudo password',
						password: true,
						placeHolder: 'sudo password'
					});
					if (sudoPassword) {
						this.sudoPasswordCache.set(mapping.hostId, sudoPassword);
					}
				}
				break;

			case 'prompt':
			default:
				// Always prompt
				sudoPassword = await vscode.window.showInputBox({
					prompt: 'File requires sudo to save. Enter sudo password:',
					password: true,
					placeHolder: 'sudo password'
				});
				break;
		}

		if (!sudoPassword) {
			vscode.window.showWarningMessage('Save cancelled - sudo password required');
			return;
		}

		try {
			await this.sudoUpload(mapping, document, sudoPassword);
			vscode.window.showInformationMessage(`✓ Saved with sudo: ${mapping.remotePath}`);
		} catch (sudoError) {
			vscode.window.showErrorMessage(`Sudo save failed: ${sudoError}`);
			// Clear cached password if it failed
			if (sudoMode === 'cache') {
				this.sudoPasswordCache.delete(mapping.hostId);
			}
		}
	}

	/**
	 * Uploads a file using sudo
	 */
	private async sudoUpload(mapping: RemoteFileMapping, document: vscode.TextDocument, sudoPassword: string): Promise<void> {
		// Strategy: Upload to /tmp first, then use sudo mv
		const tmpPath = `/tmp/labonair_upload_${Date.now()}_${path.basename(mapping.remotePath)}`;
		const localPath = mapping.localUri.fsPath;

		// Upload to temp location
		await this.sftpService.putFile(mapping.hostId, localPath, tmpPath);

		// Use SSH to execute sudo mv
		// Note: This requires SSH session access - we'll need to add this to SftpService or create a separate SSH command executor
		// For now, we'll use a simplified approach

		const host = this.hostService.getHostById(mapping.hostId);
		if (!host) {
			throw new Error('Host not found');
		}

		// Create an SSH connection to execute the sudo command
		const { Client } = require('ssh2');
		const client = new Client();

		return new Promise((resolve, reject) => {
			client.on('ready', () => {
				const command = `echo '${sudoPassword}' | sudo -S mv '${tmpPath}' '${mapping.remotePath}'`;

				client.exec(command, (err: any, stream: any) => {
					if (err) {
						client.end();
						reject(err);
						return;
					}

					let stderr = '';
					stream.on('close', (code: number) => {
						client.end();
						if (code === 0) {
							resolve();
						} else {
							reject(new Error(`Sudo command failed: ${stderr}`));
						}
					}).on('data', () => {
						// stdout - ignore
					}).stderr.on('data', (data: Buffer) => {
						stderr += data.toString();
					});
				});
			});

			client.on('error', (err: Error) => {
				reject(err);
			});

			// Connect using the same config as SFTP
			this.connectSsh(client, host, sudoPassword);
		});
	}

	/**
	 * Connects SSH client (helper method)
	 */
	private async connectSsh(client: any, host: any, password?: string): Promise<void> {
		const config: any = {
			host: host.host,
			port: host.port,
			username: host.username
		};

		// Simplified auth - use password if provided or get from host service
		if (password) {
			config.password = password;
		} else if (host.authType === 'password') {
			config.password = await this.hostService.getPassword(host.id);
		}
		// Add more auth types as needed

		client.connect(config);
	}

	/**
	 * Formats file size in human-readable format
	 */
	private formatSize(bytes: number): string {
		if (bytes < 1024) {
			return `${bytes} B`;
		} else if (bytes < 1024 * 1024) {
			return `${(bytes / 1024).toFixed(1)} KB`;
		} else {
			return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
		}
	}

	/**
	 * Gets all currently tracked remote files
	 */
	public getTrackedFiles(): RemoteFileMapping[] {
		return Array.from(this.remoteFileMap.values());
	}

	/**
	 * Clears sudo password cache
	 */
	public clearSudoCache(hostId?: string): void {
		if (hostId) {
			this.sudoPasswordCache.delete(hostId);
		} else {
			this.sudoPasswordCache.clear();
		}
	}

	/**
	 * Cleanup on extension deactivation
	 */
	public dispose(): void {
		// Dispose all listeners
		this.disposables.forEach(d => d.dispose());
		this.disposables = [];

		// Clean up temp directory
		try {
			if (fs.existsSync(this.tempDir)) {
				fs.rmSync(this.tempDir, { recursive: true, force: true });
			}
		} catch (error) {
			console.error('Failed to clean up temp directory:', error);
		}

		// Clear all caches
		this.remoteFileMap.clear();
		this.sudoPasswordCache.clear();
	}
}
