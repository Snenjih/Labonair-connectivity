import { HostKeyService } from './security/hostKeyService';
import { SessionInfo } from './sessionTracker';

import * as vscode from 'vscode';
import { HostService } from './hostService';
import { CredentialService } from './credentialService';
import { SessionTracker } from './sessionTracker';
import { SshAgentService } from './sshAgent';
import { ShellService } from './system/shellService';
import { ImporterService } from './importers';
import { StatusService } from './statusService';
import { registerCommands } from './commands';
import { SshConnectionService } from './services/sshConnectionService';
import { SftpService } from './services/sftpService';
import { LocalFsService } from './services/localFsService';
import { ClipboardService } from './services/clipboardService';
import { EditHandler } from './services/editHandler';
import { TransferService } from './services/transferService';
import { BroadcastService } from './services/broadcastService';
import { BadgeService } from './services/badgeService';
import { SftpPanel } from './panels/sftpPanel';
import { TerminalPanel } from './panels/TerminalPanel';
import { Message, Host, HostStatus, TransferJob, TransferQueueSummary } from '../common/types';

// Store service instances for cleanup
let sshConnectionServiceInstance: SshConnectionService | undefined;
let sftpServiceInstance: SftpService | undefined;
let editHandlerInstance: EditHandler | undefined;
let transferServiceInstance: TransferService | undefined;
let broadcastServiceInstance: BroadcastService | undefined;
let badgeServiceInstance: BadgeService | undefined;

export async function activate(context: vscode.ExtensionContext) {
	const hostService = new HostService(context);
	const credentialService = new CredentialService(context);
	const sessionTracker = new SessionTracker(context);
	const sshAgentService = new SshAgentService(context);
	const importerService = new ImporterService();
	const hostKeyService = new HostKeyService();
	const shellService = new ShellService();
	const sshConnectionService = new SshConnectionService(hostService, credentialService);
	const sftpService = new SftpService(hostService, credentialService, hostKeyService);
	const localFsService = new LocalFsService();
	const clipboardService = new ClipboardService();
	const editHandler = new EditHandler(sftpService, hostService, credentialService, context);
	const broadcastService = new BroadcastService();

	// Session Restoration
	await restoreSessions(context, sessionTracker, hostService, credentialService, hostKeyService, sftpService, localFsService, clipboardService);

	// Transfer Service with callbacks for webview updates
	let transferQueueViewProvider: TransferQueueViewProvider | undefined;
	const transferService = new TransferService(
		sftpService,
		(job: TransferJob) => {
			// Send job update to Queue View
			transferQueueViewProvider?.postMessage({
				command: 'TRANSFER_UPDATE',
				payload: { job }
			});
		},
		(jobs: TransferJob[], summary: TransferQueueSummary) => {
			// Send queue state update to Queue View
			transferQueueViewProvider?.postMessage({
				command: 'TRANSFER_QUEUE_STATE',
				payload: { jobs, summary }
			});
		},
		(transferId: string, sourceFile: string, targetStats: { size: number; modTime: Date }) => {
			// Send conflict notification to Queue View
			transferQueueViewProvider?.postMessage({
				command: 'TRANSFER_CONFLICT',
				payload: { transferId, sourceFile, targetStats }
			});
		}
	);

	// Badge Service
	const badgeService = new BadgeService(sessionTracker, transferService);

	// Store for cleanup
	sshConnectionServiceInstance = sshConnectionService;
	sftpServiceInstance = sftpService;
	editHandlerInstance = editHandler;
	transferServiceInstance = transferService;
	broadcastServiceInstance = broadcastService;
	badgeServiceInstance = badgeService;

	// Register Commands
	registerCommands(context, hostService, sftpService, localFsService, clipboardService);

	// Register Edit-on-Fly command
	const editRemoteFileCommand = vscode.commands.registerCommand(
		'labonair.editRemoteFile',
		async (hostId: string, remotePath: string) => {
			try {
				await editHandler.openRemoteFile(hostId, remotePath);
			} catch (error) {
				vscode.window.showErrorMessage(`Failed to open remote file: ${error}`);
			}
		}
	);
	context.subscriptions.push(editRemoteFileCommand);

	// Register Backup All command
	const backupAllCommand = vscode.commands.registerCommand(
		'labonair.backupAll',
		async () => {
			try {
				await performBackup(context, hostService, credentialService);
			} catch (error) {
				vscode.window.showErrorMessage(`Failed to create backup: ${error}`);
			}
		}
	);
	context.subscriptions.push(backupAllCommand);

	// Register the Webview View Providers
	try {
		console.log('Activating Connectivity Extension...');

		// Host Manager View
		const provider = new ConnectivityViewProvider(
			context.extensionUri,
			hostService,
			credentialService,
			sessionTracker,
			sshAgentService,
			importerService,
			hostKeyService,
			shellService,
			sshConnectionService,
			sftpService,
			localFsService,
			clipboardService,
			broadcastService,
			editHandler
		);
		context.subscriptions.push(
			vscode.window.registerWebviewViewProvider('labonair.views.hosts', provider)
		);

		// NOTE: Badge service is ready but webview views don't support badges in VS Code API
		// If we need badges, we'd need to convert to a TreeView or use a status bar item
		// For now, the badge service tracks counts internally for future use

		// Transfer Queue View
		transferQueueViewProvider = new TransferQueueViewProvider(
			context.extensionUri,
			transferService
		);
		context.subscriptions.push(
			vscode.window.registerWebviewViewProvider('labonair.views.queue', transferQueueViewProvider)
		);

		console.log('Connectivity Extension Activated Successfully.');
	} catch (e) {
		console.error('Failed to activate Connectivity Extension:', e);
		vscode.window.showErrorMessage('Failed to activate Connectivity Extension: ' + e);
	}
}

class ConnectivityViewProvider implements vscode.WebviewViewProvider {
	private _view?: vscode.WebviewView;
	private _statusService?: StatusService;

	constructor(
		private readonly _extensionUri: vscode.Uri,
		private readonly _hostService: HostService,
		private readonly _credentialService: CredentialService,
		private readonly _sessionTracker: SessionTracker,
		private readonly _sshAgentService: SshAgentService,
		private readonly _importerService: ImporterService,
		private readonly _hostKeyService: HostKeyService,
		private readonly _shellService: ShellService,
		private readonly _sshConnectionService: SshConnectionService,
		private readonly _sftpService: SftpService,
		private readonly _localFsService: LocalFsService,
		private readonly _clipboardService: ClipboardService,
		private readonly _broadcastService: BroadcastService,
		private readonly _editHandler: EditHandler
	) { }

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {
		console.log('ConnectivityViewProvider.resolveWebviewView called');
		this._view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this._extensionUri]
		};

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
		console.log('Webview HTML set');

		// Initialize Status Service with callback
		this._statusService = new StatusService((statuses: Record<string, HostStatus>) => {
			webviewView.webview.postMessage({ command: 'HOST_STATUS_UPDATE', payload: { statuses } });
		});

		// Listen for credential updates
		this._credentialService.onDidChangeCredentials(credentials => {
			webviewView.webview.postMessage({ command: 'UPDATE_DATA', payload: { credentials } });
		});

		// Listen for session updates
		this._sessionTracker.onDidChangeSessions(activeHostIds => {
			webviewView.webview.postMessage({ command: 'SESSION_UPDATE', payload: { activeHostIds } });
		});

		// Clean up status service when view is disposed
		webviewView.onDidDispose(() => {
			this._statusService?.dispose();
		});

		webviewView.webview.onDidReceiveMessage(async (message: Message) => {
			switch (message.command) {
				// ============================================================
				// DATA FETCHING
				// ============================================================
				case 'FETCH_DATA': {
					const hosts = this._hostService.getHosts();
					const credentials = await this._credentialService.getCredentials();
						const activeHostIds = this._sessionTracker.getActiveHostIds();
					const hostStatuses = this._statusService?.getAllStatuses() || {};

					webviewView.webview.postMessage({
						command: 'UPDATE_DATA',
						payload: { hosts, credentials, activeSessionHostIds: activeHostIds, hostStatuses }
					});

					// Check SSH Agent
					const agentAvailable = await this._sshAgentService.isAgentAvailable();
					webviewView.webview.postMessage({ command: 'AGENT_STATUS', payload: { available: agentAvailable } });

					// Get Shells
					const shells = await this._shellService.getAvailableShells();
					webviewView.webview.postMessage({ command: 'AVAILABLE_SHELLS', payload: { shells } });

					// Start status checking
					this._statusService?.startPeriodicCheck(hosts, 30000);
					break;
				}

				// ============================================================
				// HOST CRUD
				// ============================================================
				case 'SAVE_HOST':
					await this._hostService.saveHost(message.payload.host, message.payload.password, message.payload.keyPath);
					this.broadcastUpdate();
					break;

				case 'DELETE_HOST':
					await this._hostService.deleteHost(message.payload.id);
					this.broadcastUpdate();
					break;

				case 'CLONE_HOST': {
					const cloned = await this._hostService.cloneHost(message.payload.id);
					if (cloned) {
						vscode.window.showInformationMessage(`Host "${cloned.name}" cloned successfully.`);
					}
					this.broadcastUpdate();
					break;
				}

				case 'TOGGLE_PIN': {
					const isPinned = await this._hostService.togglePin(message.payload.id);
					this.broadcastUpdate();
					break;
				}

				// ============================================================
				// FOLDER OPERATIONS
				// ============================================================
				case 'RENAME_FOLDER': {
					const updated = await this._hostService.renameFolder(message.payload.oldName, message.payload.newName);
					vscode.window.showInformationMessage(`Folder renamed. ${updated} hosts updated.`);
					this.broadcastUpdate();
					break;
				}

				case 'MOVE_HOST_TO_FOLDER': {
					await this._hostService.moveHostToFolder(message.payload.hostId, message.payload.folder);
					this.broadcastUpdate();
					break;
				}

				case 'SAVE_FOLDER_CONFIG': {
					await this._hostService.saveFolderConfig(message.payload.config);
					break;
				}

				// ============================================================
				// BULK OPERATIONS
				// ============================================================
				case 'BULK_DELETE_HOSTS': {
					const result = await this._hostService.bulkDeleteHosts(message.payload.ids);
					vscode.window.showInformationMessage(`Deleted ${result.success} hosts.`);
					this.broadcastUpdate();
					break;
				}

				case 'BULK_MOVE_TO_FOLDER': {
					const result = await this._hostService.bulkMoveToFolder(message.payload.ids, message.payload.folder);
					vscode.window.showInformationMessage(`Moved ${result.success} hosts to "${message.payload.folder || 'Uncategorized'}".`);
					this.broadcastUpdate();
					break;
				}

				case 'BULK_ASSIGN_TAGS': {
					const result = await this._hostService.bulkAssignTags(message.payload.ids, message.payload.tags, message.payload.mode);
					vscode.window.showInformationMessage(`Tags assigned to ${result.success} hosts.`);
					this.broadcastUpdate();
					break;
				}

				// ============================================================
				// IMPORT / EXPORT
				// ============================================================
				case 'IMPORT_REQUEST': {
					const imported = await this._importerService.importHosts(message.payload.format);
					if (imported && imported.length > 0) {
						for (const h of imported) {
							await this._hostService.saveHost(h);
						}
						this.broadcastUpdate();
						vscode.window.showInformationMessage(`Imported ${imported.length} hosts.`);
					}
					break;
				}

				case 'IMPORT_HOSTS': {
					const result = await this._hostService.importHosts(message.payload.hosts);
					vscode.window.showInformationMessage(`Imported ${result.success} hosts. ${result.failed} failed.`);
					this.broadcastUpdate();
					break;
				}

				case 'EXPORT_REQUEST': {
					const currentHosts = this._hostService.getHosts();
					await this._importerService.exportHosts(currentHosts);
					break;
				}

				case 'EXPORT_HOSTS': {
					const hostsToExport = this._hostService.exportHosts(message.payload.ids);
					const exportData = { hosts: hostsToExport };
					const blob = JSON.stringify(exportData, null, 2);

					const uri = await vscode.window.showSaveDialog({
						saveLabel: 'Export Hosts',
						filters: { 'JSON Files': ['json'] },
						defaultUri: vscode.Uri.file(`ssh-hosts-export-${new Date().toISOString().split('T')[0]}.json`)
					});

					if (uri) {
						await vscode.workspace.fs.writeFile(uri, Buffer.from(blob, 'utf8'));
						vscode.window.showInformationMessage(`Exported ${hostsToExport.length} hosts to ${uri.fsPath}`);
					}
					break;
				}

				// ============================================================
				// CONNECTION ACTIONS
				// ============================================================
				case 'CONNECT_SSH': {
					let hostToConnect: Host | undefined;
					if (message.payload.id) {
						hostToConnect = this._hostService.getHostById(message.payload.id);
					} else if (message.payload.host) {
						hostToConnect = message.payload.host;
					}

					if (!hostToConnect) {
						vscode.window.showErrorMessage("Host not found.");
						return;
					}

					vscode.window.showInformationMessage(`Connecting to ${hostToConnect.name || hostToConnect.host}...`);



					// Open Terminal Panel instead of using Pseudoterminal
					TerminalPanel.createOrShow(
						this._extensionUri,
						hostToConnect.id,
						hostToConnect,
						this._hostService,
						this._credentialService,
						this._hostKeyService,
						this._sessionTracker
					);

					// Note: Session tracking is now handled by TerminalPanel lifecycle
					// No need to register with sessionTracker as the panel manages its own disposal

					// Update last used
					const isSaved = this._hostService.getHostById(hostToConnect.id) !== undefined;
					if (isSaved) {
						await this._hostService.updateLastUsed(hostToConnect.id);
					} else {
						const selection = await vscode.window.showInformationMessage(
							`Connected to ${hostToConnect.host}. Save this connection?`,
							'Yes',
							'No'
						);
						if (selection === 'Yes') {
							await this._hostService.saveHost(hostToConnect);
							vscode.window.showInformationMessage("Host saved.");
							this.broadcastUpdate();
						}
					}
					this.broadcastUpdate();
					break;
				}

				case 'OPEN_SFTP': {
					const hostId = message.payload.id;
					if (!hostId) {
						vscode.window.showErrorMessage('No host ID provided');
						break;
					}

					const host = this._hostService.getHostById(hostId);
					if (!host) {
						vscode.window.showErrorMessage('Host not found');
						break;
					}

					// Open SFTP Panel
					SftpPanel.createOrShow(
						this._extensionUri,
						hostId,
						this._sftpService,
						this._localFsService,
						this._clipboardService,
						this._hostService,
						this._sessionTracker
					);
					break;
				}

				case 'OPEN_REMOTE_RESOURCE': {
					const { path, hostId } = message.payload;
					try {
						// Check if resource exists and get its type
						const stats = await this._sftpService.stat(hostId, path);

						if (stats.type === 'd') {
							// It's a directory - open/navigate SFTP panel
							const panel = SftpPanel.createOrShow(
								this._extensionUri,
								hostId,
								this._sftpService,
								this._localFsService,
								this._clipboardService,
								this._hostService,
								this._sessionTracker
							);
							// Send navigate message to the panel
							// Note: The panel will handle the NAVIGATE message internally
							// We could enhance SftpPanel to expose a navigate method if needed
							vscode.window.showInformationMessage(`Directory: ${path}`);
						} else {
							// It's a file - open with Edit-on-Fly
							await this._editHandler.openRemoteFile(hostId, path);
						}
					} catch (error) {
						// Resource not found or error accessing it
						vscode.window.showWarningMessage(`Cannot open ${path}: ${error}`);
					}
					break;
				}

				case 'OPEN_STATS': {
					// TODO: Implement Server Stats
					vscode.window.showInformationMessage('Server Stats: Coming soon!');
					break;
				}

				// ============================================================
				// HOST KEY VERIFICATION
				// ============================================================
				case 'ACCEPT_HOST_KEY': {
					if (message.payload.save) {
						const keyBuffer = Buffer.from(message.payload.fingerprint, 'base64');
						await this._hostKeyService.addHostKey(message.payload.host, message.payload.port, 'ssh-rsa', keyBuffer);
					}
					const existingHost = this._hostService.getHostById(message.payload.host);
					if (existingHost) {
						// Open Terminal Panel
						TerminalPanel.createOrShow(
							this._extensionUri,
							existingHost.id,
							existingHost,
							this._hostService,
							this._credentialService,
							this._hostKeyService,
							this._sessionTracker
						);

						// Update last used
						await this._hostService.updateLastUsed(existingHost.id);
						this.broadcastUpdate();
					} else {
						vscode.window.showInformationMessage("Host key accepted. Please click connect again.");
					}
					break;
				}

				case 'DENY_HOST_KEY':
					vscode.window.showWarningMessage('Connection aborted by user.');
					break;

				// ============================================================
				// CREDENTIALS
				// ============================================================
				case 'GET_CREDENTIALS': {
					const creds = await this._credentialService.getCredentials();
					webviewView.webview.postMessage({ command: 'UPDATE_DATA', payload: { hosts: this._hostService.getHosts(), credentials: creds } });
					break;
				}

				case 'SAVE_CREDENTIAL':
					await this._credentialService.saveCredential(message.payload.credential, message.payload.secret);
					this.broadcastUpdate();
					break;

				case 'DELETE_CREDENTIAL':
					await this._credentialService.deleteCredential(message.payload.id);
					this.broadcastUpdate();
					break;

				case 'RENAME_CREDENTIAL_FOLDER': {
					// TODO: Implement in credentialService
					vscode.window.showInformationMessage('Credential folder renamed.');
					this.broadcastUpdate();
					break;
				}


				// ============================================================
				// FILE PICKER
				// ============================================================
				case 'PICK_KEY_FILE': {
					const uris = await vscode.window.showOpenDialog({ canSelectFiles: true, canSelectFolders: false });
					if (uris && uris.length > 0) {
						webviewView.webview.postMessage({ command: 'KEY_FILE_PICKED', payload: { path: uris[0].fsPath } });
					}
					break;
				}

				// ============================================================
				// BROADCAST (Subphase 3.5)
				// ============================================================
				case 'BROADCAST_COMMAND': {
					const { hostIds, command } = message.payload;
					vscode.window.showInformationMessage(`Broadcasting command to ${hostIds.length} host(s)...`);

					await this._broadcastService.broadcast(
						hostIds,
						command,
						(hostId: string, success: boolean, output?: string, error?: string) => {
							// Send status update back to webview
							webviewView.webview.postMessage({
								command: 'BROADCAST_STATUS',
								payload: { hostId, success, output, error }
							});
						}
					);

					vscode.window.showInformationMessage(`Broadcast completed`);
					break;
				}

				// ============================================================
				// KEYBINDING CONTEXT
				// ============================================================
				case 'SET_CONTEXT': {
					const { key, value } = message.payload;
					vscode.commands.executeCommand('setContext', key, value);
					break;
				}
			}
		});
	}

	// NOTE: This method is deprecated in favor of TerminalPanel (Phase 3.3)
	// The old Pseudoterminal-based approach has been replaced with a WebviewPanel-based
	// terminal using xterm.js to support custom UI features (HUD, paste protection, etc.)
	// Keeping this here for reference in case we need to support both approaches
	/*
	private async startSession(host: Host) {
		try {
			// Create SSH terminal session using the connection service
			const term = await this._sshConnectionService.createSession(host);
			term.show();

			// Register session with tracker
			this._sessionTracker.registerSession(host.id, term);

			// If it's a saved host, update last used
			const isSaved = this._hostService.getHostById(host.id) !== undefined;
			if (isSaved) {
				await this._hostService.updateLastUsed(host.id);
			} else {
				const selection = await vscode.window.showInformationMessage(`Connected to ${host.host}. Save this connection?`, 'Yes', 'No');
				if (selection === 'Yes') {
					await this._hostService.saveHost(host);
					vscode.window.showInformationMessage("Host saved.");
					this.broadcastUpdate();
				}
			}
			this.broadcastUpdate();
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to connect: ${error}`);
		}
	}
	*/

	private async broadcastUpdate() {
		if (this._view) {
			const hosts = this._hostService.getHosts();
			const credentials = await this._credentialService.getCredentials();
			const activeHostIds = this._sessionTracker.getActiveHostIds();
			const hostStatuses = this._statusService?.getAllStatuses() || {};
			this._view.webview.postMessage({
				command: 'UPDATE_DATA',
				payload: { hosts, credentials, activeSessionHostIds: activeHostIds, hostStatuses }
			});

			// Restart status checking with updated hosts
			this._statusService?.startPeriodicCheck(hosts, 30000);
		}
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview.js'));
		const nonce = getNonce();

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>Labonair Connectivity</title>
			</head>
			<body>
				<div id="root"></div>
				<script nonce="${nonce}">window.LABONAIR_CONTEXT = 'sidebar';</script>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
	}
}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

/**
 * Transfer Queue View Provider
 * Manages the Transfer Queue webview in the sidebar
 */
class TransferQueueViewProvider implements vscode.WebviewViewProvider {
	private _view?: vscode.WebviewView;

	constructor(
		private readonly _extensionUri: vscode.Uri,
		private readonly _transferService: TransferService
	) { }

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {
		this._view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this._extensionUri]
		};

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		// Handle messages from webview
		webviewView.webview.onDidReceiveMessage(async (message: Message) => {
			switch (message.command) {
				case 'FETCH_DATA': {
					// Send initial queue state
					const jobs = this._transferService.getAllJobs();
					const summary = this._transferService.getSummary();
					webviewView.webview.postMessage({
						command: 'TRANSFER_QUEUE_STATE',
						payload: { jobs, summary }
					});
					break;
				}

				case 'TRANSFER_QUEUE': {
					if (message.payload.action === 'pause') {
						this._transferService.pauseJob(message.payload.jobId);
					} else if (message.payload.action === 'resume') {
						this._transferService.resumeJob(message.payload.jobId);
					} else if (message.payload.action === 'cancel') {
						this._transferService.cancelJob(message.payload.jobId);
					} else if (message.payload.action === 'clear_completed') {
						this._transferService.clearCompleted();
					} else if (message.payload.action === 'add' && message.payload.job) {
						this._transferService.addJob(message.payload.job);
					}
					break;
				}

				case 'RESOLVE_CONFLICT': {
					this._transferService.resolveConflict(message.payload.transferId, message.payload.action);
					break;
				}
			}
		});
	}

	/**
	 * Posts a message to the webview
	 */
	public postMessage(message: Message): void {
		this._view?.webview.postMessage(message);
	}

	private _getHtmlForWebview(webview: vscode.Webview): string {
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview.js'));
		const nonce = getNonce();

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>Transfer Queue</title>
			</head>
			<body>
				<div id="root"></div>
				<script nonce="${nonce}">window.LABONAIR_CONTEXT = 'queue';</script>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
	}
}

/**
 * Backup All Settings
 * Exports all hosts, credentials metadata, and configuration
 * Note: Passwords and keys are NOT included (stored in OS Keychain)
 */
async function performBackup(
	context: vscode.ExtensionContext,
	hostService: HostService,
	credentialService: CredentialService
): Promise<void> {
	// Get all data
	const hosts = hostService.getHosts();
	const credentials = await credentialService.getCredentials();

	// Remove sensitive data from credentials (keep only metadata)
	const credentialMetadata = credentials.map(cred => ({
		id: cred.id,
		name: cred.name,
		username: cred.username,
		type: cred.type,
		folder: cred.folder,
		description: cred.description,
		tags: cred.tags,
		keyType: cred.keyType,
		usageCount: cred.usageCount,
		lastUsed: cred.lastUsed,
		createdAt: cred.createdAt,
		updatedAt: cred.updatedAt
	}));

	// Create backup object
	const backup = {
		version: '1.0.0',
		exportDate: new Date().toISOString(),
		hosts: hosts,
		credentials: credentialMetadata,
		warning: {
			message: 'This backup does NOT include passwords or SSH keys (stored securely in OS Keychain).',
			action: 'You will need to re-enter passwords and select SSH key files when importing this backup.',
			affectedHosts: hosts.filter(h => h.authType === 'password' || h.authType === 'key' || h.authType === 'credential').map(h => h.id),
			affectedCredentials: credentials.map(c => c.id)
		}
	};

	// Prompt user for save location
	const uri = await vscode.window.showSaveDialog({
		saveLabel: 'Export Backup',
		filters: { 'JSON Files': ['json'] },
		defaultUri: vscode.Uri.file(`labonair-backup-${new Date().toISOString().split('T')[0]}.json`)
	});

	if (!uri) {
		return; // User cancelled
	}

	// Write backup file
	const backupJson = JSON.stringify(backup, null, 2);
	await vscode.workspace.fs.writeFile(uri, Buffer.from(backupJson, 'utf8'));

	vscode.window.showInformationMessage(
		`Backup created: ${uri.fsPath}\n\nNote: Passwords and SSH keys are NOT included. You will need to re-enter them when importing.`
	);
}

/**
 * Session Restoration Function
 * Prompts user to restore previous sessions on extension activation
 */
async function restoreSessions(
	context: vscode.ExtensionContext,
	sessionTracker: SessionTracker,
	hostService: HostService,
	credentialService: CredentialService,
	hostKeyService: HostKeyService,
	sftpService: SftpService,
	localFsService: LocalFsService,
	clipboardService: ClipboardService
): Promise<void> {
	const persistedSessions = sessionTracker.getPersistedSessions();

	if (persistedSessions.length === 0) {
		return;
	}

	// Prompt user to restore sessions
	const tabCount = persistedSessions.length;
	const answer = await vscode.window.showInformationMessage(
		`Restore previous session? (${tabCount} tab${tabCount > 1 ? 's' : ''})`,
		'Yes',
		'No'
	);

	if (answer !== 'Yes') {
		// Clear persisted sessions if user declines
		sessionTracker.clearPersistedSessions();
		return;
	}

	// Restore each session
	for (const sessionInfo of persistedSessions) {
		try {
			const host = hostService.getHostById(sessionInfo.hostId);
			if (!host) {
				console.warn(`Host not found for session restoration: ${sessionInfo.hostId}`);
				continue;
			}

			if (sessionInfo.type === 'terminal') {
				// Restore terminal panel
				TerminalPanel.createOrShow(
					context.extensionUri,
					sessionInfo.hostId,
					host,
					hostService,
					credentialService,
					hostKeyService,
					sessionTracker
				);
			} else if (sessionInfo.type === 'sftp') {
				// Restore SFTP panel
				SftpPanel.createOrShow(
					context.extensionUri,
					sessionInfo.hostId,
					sftpService,
					localFsService,
					clipboardService,
					hostService,
					sessionTracker
				);
			}
		} catch (error) {
			console.error(`Failed to restore session for ${sessionInfo.hostId}:`, error);
		}
	}

	// Clear persisted sessions after restoration
	sessionTracker.clearPersistedSessions();
}

export function deactivate() {
	// Clean up all active SSH sessions
	if (sshConnectionServiceInstance) {
		sshConnectionServiceInstance.dispose();
		sshConnectionServiceInstance = undefined;
	}

	// Clean up all active SFTP sessions
	if (sftpServiceInstance) {
		sftpServiceInstance.dispose();
		sftpServiceInstance = undefined;
	}

	// Clean up Edit Handler (removes temp files and clears caches)
	if (editHandlerInstance) {
		editHandlerInstance.dispose();
		editHandlerInstance = undefined;
	}

	// Clean up Transfer Service
	if (transferServiceInstance) {
		transferServiceInstance.dispose();
		transferServiceInstance = undefined;
	}

	// Clean up Broadcast Service
	if (broadcastServiceInstance) {
		broadcastServiceInstance.dispose();
		broadcastServiceInstance = undefined;
	}

	// Clean up Badge Service
	if (badgeServiceInstance) {
		badgeServiceInstance.dispose();
		badgeServiceInstance = undefined;
	}
}

