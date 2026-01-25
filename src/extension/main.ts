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
import { StateService } from './services/stateService';
import { ArchiveService } from './services/archiveService';
import { EditHandler } from './services/editHandler';
import { TransferService } from './services/transferService';
import { BroadcastService } from './services/broadcastService';
import { BadgeService } from './services/badgeService';
import { BookmarkService } from './services/bookmarkService';
import { DiskSpaceService } from './services/diskSpaceService';
import { SyncService } from './services/syncService';
import { SftpPanel } from './panels/sftpPanel';
import { TerminalPanel } from './panels/TerminalPanel';
import { Message, Host, HostStatus, TransferJob, TransferQueueSummary } from '../common/types';
import { initLogger, getLogger } from './utils/logger';

// RPC System imports
import { RpcRouter } from './utils/rpcHandler';
import { RpcRequest } from '../common/rpc';
import { HostController } from './controllers/HostController';
import { SftpController } from './controllers/SftpController';
import { CredentialController } from './controllers/CredentialController';
import { TransferController } from './controllers/TransferController';
import { StateController } from './controllers/StateController';
import { ClipboardController } from './controllers/ClipboardController';

// Store service instances for cleanup
let sshConnectionServiceInstance: SshConnectionService | undefined;
let sftpServiceInstance: SftpService | undefined;
let editHandlerInstance: EditHandler | undefined;
let transferServiceInstance: TransferService | undefined;
let broadcastServiceInstance: BroadcastService | undefined;
let badgeServiceInstance: BadgeService | undefined;

/**
 * Gets terminal default settings from VS Code configuration
 */
function getTerminalDefaults(): Partial<Host> {
	const config = vscode.workspace.getConfiguration('labonair.terminal');
	return {
		terminalFontSize: config.get<number>('fontSize', 16),
		terminalFontWeight: config.get<string>('fontWeight', '500'),
		terminalLineHeight: config.get<number>('lineHeight', 1.5),
		terminalLetterSpacing: config.get<number>('letterSpacing', 2),
		terminalCursorStyle: config.get<string>('cursorStyle', 'block') as 'bar' | 'block' | 'underline',
		terminalCursorBlink: config.get<boolean>('cursorBlink', true)
	};
}

/**
 * Gets file manager default settings from VS Code configuration
 */
function getFileManagerDefaults(): { defaultLayout: 'explorer' | 'commander'; defaultView: 'list' | 'grid' } {
	const config = vscode.workspace.getConfiguration('labonair.fileManager');
	return {
		defaultLayout: config.get<string>('defaultLayout', 'explorer') as 'explorer' | 'commander',
		defaultView: config.get<string>('defaultView', 'list') as 'list' | 'grid'
	};
}

export async function activate(context: vscode.ExtensionContext) {
	// Initialize logger
	const logger = initLogger('Labonair Connectivity');
	logger.info('Activating Labonair Connectivity Extension');

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
	const stateService = new StateService(context);
	const archiveService = new ArchiveService(sftpService);
	const editHandler = new EditHandler(sftpService, hostService, credentialService, context);
	const broadcastService = new BroadcastService();
	const bookmarkService = new BookmarkService(context);
	const diskSpaceService = new DiskSpaceService(sftpService);

	// Transfer Service with callbacks for webview updates (created early for dependencies)
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

	// Sync Service
	const syncService = new SyncService(sftpService, localFsService, transferService);

	// Session Restoration (after all services are initialized)
	await restoreSessions(context, sessionTracker, hostService, credentialService, hostKeyService, sftpService, localFsService, clipboardService, stateService, archiveService, syncService);

	// Store for cleanup
	sshConnectionServiceInstance = sshConnectionService;
	sftpServiceInstance = sftpService;
	editHandlerInstance = editHandler;
	transferServiceInstance = transferService;
	broadcastServiceInstance = broadcastService;
	badgeServiceInstance = badgeService;

	// Register Commands
	registerCommands(context, hostService, credentialService, hostKeyService, sftpService, localFsService, clipboardService, stateService, archiveService, syncService);

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

	// Register Show Logs command
	const showLogsCommand = vscode.commands.registerCommand(
		'labonair.showLogs',
		() => {
			logger.show();
		}
	);
	context.subscriptions.push(showLogsCommand);

	// Register Clear Logs command
	const clearLogsCommand = vscode.commands.registerCommand(
		'labonair.clearLogs',
		() => {
			logger.clear();
			logger.info('Logs cleared');
		}
	);
	context.subscriptions.push(clearLogsCommand);

	// Register Copy command
	const copyCommand = vscode.commands.registerCommand(
		'labonair.copy',
		() => {
			logger.info('Copy command triggered');
		}
	);
	context.subscriptions.push(copyCommand);

	// Register Paste command
	const pasteCommand = vscode.commands.registerCommand(
		'labonair.paste',
		() => {
			logger.info('Paste command triggered');
		}
	);
	context.subscriptions.push(pasteCommand);

	// Register Refresh command
	const refreshCommand = vscode.commands.registerCommand(
		'labonair.refresh',
		() => {
			logger.info('Refresh command triggered');
		}
	);
	context.subscriptions.push(refreshCommand);

	// Register Reset Layout command
	const resetLayoutCommand = vscode.commands.registerCommand(
		'labonair.resetLayout',
		async () => {
			try {
				// Clear all UI state from globalState
				const keys = context.globalState.keys();
				for (const key of keys) {
					if (key.startsWith('labonair.panel.') ||
					    key.startsWith('labonair.fileManager.') ||
					    key.startsWith('labonair.terminal.')) {
						await context.globalState.update(key, undefined);
					}
				}

				vscode.window.showInformationMessage(
					'Layout reset successfully. Please reload the window for changes to take effect.',
					'Reload Window'
				).then(selection => {
					if (selection === 'Reload Window') {
						vscode.commands.executeCommand('workbench.action.reloadWindow');
					}
				});

				logger.info('Layout state cleared');
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				vscode.window.showErrorMessage(`Failed to reset layout: ${errorMessage}`);
				logger.error('Failed to reset layout:', error instanceof Error ? error : new Error(String(error)));
			}
		}
	);
	context.subscriptions.push(resetLayoutCommand);

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
			stateService,
			archiveService,
			syncService,
			broadcastService,
			editHandler,
			bookmarkService,
			diskSpaceService,
			transferService
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
	private _rpcRouter?: RpcRouter;
	private _hostController?: HostController;
	private _sftpController?: SftpController;
	private _credentialController?: CredentialController;
	private _transferController?: TransferController;
	private _stateController?: StateController;
	private _clipboardController?: ClipboardController;

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
		private readonly _stateService: StateService,
		private readonly _archiveService: ArchiveService,
		private readonly _syncService: SyncService,
		private readonly _broadcastService: BroadcastService,
		private readonly _editHandler: EditHandler,
		private readonly _bookmarkService: BookmarkService,
		private readonly _diskSpaceService: DiskSpaceService,
		private readonly _transferService: TransferService
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

		// Initialize RPC Router and Controllers
		this._rpcRouter = new RpcRouter();
		this._rpcRouter.setWebview(webviewView.webview);

		// Get extension context from the services (they all have it)
		const extensionContext = (this._hostService as any).context;

		this._hostController = new HostController(
			extensionContext,
			this._hostService,
			this._credentialService,
			this._sessionTracker,
			this._statusService
		);

		this._sftpController = new SftpController(
			extensionContext,
			this._sftpService,
			this._localFsService,
			this._clipboardService,
			this._archiveService,
			this._bookmarkService,
			this._diskSpaceService
		);

		this._credentialController = new CredentialController(
			extensionContext,
			this._credentialService
		);

		this._clipboardController = new ClipboardController(
			extensionContext,
			this._clipboardService,
			this._transferService,
			this._localFsService
		);

		// Register RPC handlers
		this._registerRpcHandlers();

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

		webviewView.webview.onDidReceiveMessage(async (message: any) => {
			// Check if this is an RPC request
			if (message.type === 'rpc-request' && message.request) {
				const request = message.request as RpcRequest;
				await this._rpcRouter?.handleRequest(request);
				return;
			}

			// Fall back to legacy message handling for backward compatibility
			const legacyMessage = message as Message;
			switch (legacyMessage.command) {
				// ============================================================
				// DATA FETCHING
				// ============================================================
				case 'FETCH_DATA': {
					const hosts = this._hostService.getHosts();
					const credentials = await this._credentialService.getCredentials();
						const activeHostIds = this._sessionTracker.getActiveHostIds();
					const hostStatuses = this._statusService?.getAllStatuses() || {};

					// Get configuration defaults
					const terminalDefaults = getTerminalDefaults();
					const fileManagerDefaults = getFileManagerDefaults();

					webviewView.webview.postMessage({
						command: 'UPDATE_DATA',
						payload: { hosts, credentials, activeSessionHostIds: activeHostIds, hostStatuses, terminalDefaults, fileManagerDefaults }
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
					const savedHost = await this._hostService.saveHost(message.payload.host, message.payload.password, message.payload.keyPath);
					this.broadcastUpdate();
					// Broadcast config update to active terminal panels for live updates
					TerminalPanel.broadcastHostConfigUpdate(savedHost.id, savedHost);
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
						this._stateService,
						this._archiveService,
					this._syncService,
						this._hostService,
						this._credentialService,
						this._hostKeyService,
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
								this._stateService,
								this._archiveService,
						this._syncService,
								this._hostService,
								this._credentialService,
								this._hostKeyService,
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

				// ============================================================
				// BOOKMARKS (Subphase 4.4.1)
				// ============================================================
				case 'GET_BOOKMARKS': {
					const bookmarks = this._bookmarkService.getBookmarks(message.payload.hostId);
					webviewView.webview.postMessage({
						command: 'BOOKMARKS_RESPONSE',
						payload: { bookmarks }
					});
					break;
				}

				case 'ADD_BOOKMARK': {
					await this._bookmarkService.addBookmark(message.payload.bookmark.hostId || 'local', message.payload.bookmark);
					// Send updated bookmarks back
					const bookmarks = this._bookmarkService.getBookmarks(message.payload.bookmark.hostId || 'local');
					webviewView.webview.postMessage({
						command: 'BOOKMARKS_RESPONSE',
						payload: { bookmarks }
					});
					break;
				}

				case 'REMOVE_BOOKMARK': {
					await this._bookmarkService.removeBookmark(message.payload.hostId, message.payload.bookmarkId);
					// Send updated bookmarks back
					const bookmarks = this._bookmarkService.getBookmarks(message.payload.hostId);
					webviewView.webview.postMessage({
						command: 'BOOKMARKS_RESPONSE',
						payload: { bookmarks }
					});
					break;
				}

				// ============================================================
				// DISK SPACE (Subphase 4.4.1)
				// ============================================================
				case 'GET_DISK_SPACE': {
					try {
						const diskSpace = await this._diskSpaceService.getDiskSpace(
							message.payload.hostId,
							message.payload.path,
							message.payload.fileSystem
						);
						webviewView.webview.postMessage({
							command: 'DISK_SPACE_RESPONSE',
							payload: { diskSpace, fileSystem: message.payload.fileSystem }
						});
					} catch (error) {
						console.error('[Main] Failed to get disk space:', error);
						// Send empty response on error
						webviewView.webview.postMessage({
							command: 'DISK_SPACE_RESPONSE',
							payload: {
								diskSpace: { total: 0, free: 0, used: 0 },
								fileSystem: message.payload.fileSystem
							}
						});
					}
					break;
				}

				// ============================================================
				// ADVANCED CONTEXT ACTIONS (Subphase 4.4.2)
				// ============================================================
				case 'OPEN_IN_EXPLORER': {
					try {
						const { path, fileSystem } = message.payload;

						if (fileSystem === 'local') {
							// For local files, reveal in OS file explorer
							const uri = vscode.Uri.file(path);
							await vscode.commands.executeCommand('revealFileInOS', uri);
						} else {
							// For remote files, download to temp and reveal
							const remotePath = path;
							const tempPath = require('path').join(require('os').tmpdir(), require('path').basename(remotePath));

							await this._sftpService.getFile(message.payload.hostId, remotePath, tempPath);
							const uri = vscode.Uri.file(tempPath);
							await vscode.commands.executeCommand('revealFileInOS', uri);
						}
					} catch (error) {
						vscode.window.showErrorMessage(`Failed to open in explorer: ${error}`);
					}
					break;
				}

				case 'OPEN_WITH_DEFAULT': {
					try {
						const { path, fileSystem } = message.payload;

						if (fileSystem === 'local') {
							// For local files, open with default application
							const uri = vscode.Uri.file(path);
							await vscode.env.openExternal(uri);
						} else {
							// For remote files, download to temp and open
							const remotePath = path;
							const tempPath = require('path').join(require('os').tmpdir(), require('path').basename(remotePath));

							await this._sftpService.getFile(message.payload.hostId, remotePath, tempPath);
							const uri = vscode.Uri.file(tempPath);
							await vscode.env.openExternal(uri);
						}
					} catch (error) {
						vscode.window.showErrorMessage(`Failed to open with default application: ${error}`);
					}
					break;
				}

				case 'CALCULATE_CHECKSUM': {
					try {
						const { path, fileSystem, algorithm } = message.payload;
						let checksum: string;
						const filename = require('path').basename(path);

						if (fileSystem === 'local') {
							checksum = await this._localFsService.calculateChecksum(path, algorithm);
						} else {
							checksum = await this._sftpService.calculateChecksum(message.payload.hostId, path, algorithm);
						}

						// Send result back to webview
						webviewView.webview.postMessage({
							command: 'CHECKSUM_RESULT',
							payload: { checksum, algorithm, filename }
						});
					} catch (error) {
						vscode.window.showErrorMessage(`Failed to calculate checksum: ${error}`);
					}
					break;
				}

				case 'COPY_PATH_ADVANCED': {
					try {
						const { path, type, hostId } = message.payload;
						let textToCopy: string;

						if (type === 'name') {
							// Copy just the filename
							textToCopy = require('path').basename(path);
						} else if (type === 'fullPath') {
							// Copy full path
							textToCopy = path;
						} else if (type === 'url') {
							// Copy as SFTP URL (sftp://user@host/path)
							if (hostId) {
								const host = this._hostService.getHostById(hostId);
								if (host) {
									textToCopy = `sftp://${host.username}@${host.host}:${host.port}${path}`;
								} else {
									textToCopy = path;
								}
							} else {
								textToCopy = `file://${path}`;
							}
						} else {
							textToCopy = path;
						}

						await vscode.env.clipboard.writeText(textToCopy);
						vscode.window.showInformationMessage(`Copied to clipboard: ${textToCopy}`);
					} catch (error) {
						vscode.window.showErrorMessage(`Failed to copy path: ${error}`);
					}
					break;
				}

				case 'CREATE_SYMLINK': {
					try {
						const { sourcePath, targetPath, fileSystem } = message.payload;

						if (fileSystem === 'local') {
							await this._localFsService.createSymlink(sourcePath, targetPath);
						} else {
							await this._sftpService.createSymlink(message.payload.hostId, sourcePath, targetPath);
						}

						vscode.window.showInformationMessage(`Symbolic link created successfully`);
					} catch (error) {
						vscode.window.showErrorMessage(`Failed to create symbolic link: ${error}`);
					}
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

	/**
	 * Registers all RPC handlers with the RPC router
	 */
	private _registerRpcHandlers(): void {
		if (!this._rpcRouter || !this._hostController || !this._sftpController || !this._credentialController) {
			console.error('[RPC] Cannot register handlers: controllers not initialized');
			return;
		}

		// ============================================================
		// DATA FETCHING
		// ============================================================
		this._rpcRouter.register('data.fetch', async () => {
			return await this._hostController!.fetchData();
		});

		// ============================================================
		// HOST OPERATIONS
		// ============================================================
		this._rpcRouter.register('host.list', async () => {
			return await this._hostController!.listHosts();
		});

		this._rpcRouter.register('host.get', async (params) => {
			return await this._hostController!.getHost(params.id);
		});

		this._rpcRouter.register('host.save', async (params) => {
			await this._hostController!.saveHost(params.host, params.password, params.keyPath);
			await this.broadcastUpdate();
		});

		this._rpcRouter.register('host.delete', async (params) => {
			await this._hostController!.deleteHost(params.id);
			await this.broadcastUpdate();
		});

		this._rpcRouter.register('host.clone', async (params) => {
			const cloned = await this._hostController!.cloneHost(params.id);
			await this.broadcastUpdate();
			return cloned;
		});

		this._rpcRouter.register('host.togglePin', async (params) => {
			const isPinned = await this._hostController!.togglePin(params.id);
			await this.broadcastUpdate();
			return isPinned;
		});

		this._rpcRouter.register('host.updateLastUsed', async (params) => {
			await this._hostController!.updateLastUsed(params.id);
		});

		// ============================================================
		// FOLDER OPERATIONS
		// ============================================================
		this._rpcRouter.register('folder.rename', async (params) => {
			const result = await this._hostController!.renameFolder(params.oldName, params.newName);
			await this.broadcastUpdate();
			return result;
		});

		this._rpcRouter.register('folder.moveHost', async (params) => {
			await this._hostController!.moveHostToFolder(params.hostId, params.folder);
			await this.broadcastUpdate();
		});

		this._rpcRouter.register('folder.saveConfig', async (params) => {
			await this._hostController!.saveFolderConfig(params.config);
		});

		// ============================================================
		// BULK OPERATIONS
		// ============================================================
		this._rpcRouter.register('bulk.deleteHosts', async (params) => {
			const result = await this._hostController!.bulkDeleteHosts(params.ids);
			await this.broadcastUpdate();
			return result;
		});

		this._rpcRouter.register('bulk.moveToFolder', async (params) => {
			const result = await this._hostController!.bulkMoveToFolder(params.ids, params.folder);
			await this.broadcastUpdate();
			return result;
		});

		this._rpcRouter.register('bulk.assignTags', async (params) => {
			const result = await this._hostController!.bulkAssignTags(params.ids, params.tags, params.mode);
			await this.broadcastUpdate();
			return result;
		});

		// ============================================================
		// IMPORT / EXPORT
		// ============================================================
		this._rpcRouter.register('import.hosts', async (params) => {
			const result = await this._hostController!.importHosts(params.hosts);
			await this.broadcastUpdate();
			return result;
		});

		this._rpcRouter.register('export.hosts', async (params) => {
			return await this._hostController!.exportHosts(params.ids);
		});

		// ============================================================
		// CREDENTIALS
		// ============================================================
		this._rpcRouter.register('credential.list', async () => {
			return await this._credentialController!.listCredentials();
		});

		this._rpcRouter.register('credential.save', async (params) => {
			await this._credentialController!.saveCredential(params.credential, params.secret);
			await this.broadcastUpdate();
		});

		this._rpcRouter.register('credential.delete', async (params) => {
			await this._credentialController!.deleteCredential(params.id);
			await this.broadcastUpdate();
		});

		// ============================================================
		// SFTP OPERATIONS
		// ============================================================
		this._rpcRouter.register('sftp.ls', async (params) => {
			return await this._sftpController!.listFiles(params.hostId, params.path, params.panelId, params.fileSystem);
		});

		this._rpcRouter.register('sftp.stat', async (params) => {
			return await this._sftpController!.stat(params.hostId, params.path, params.fileSystem);
		});

		this._rpcRouter.register('sftp.upload', async (params) => {
			await this._sftpController!.upload(params.hostId, params.remotePath, params.localPath, params.fileSystem);
		});

		this._rpcRouter.register('sftp.download', async (params) => {
			await this._sftpController!.download(params.hostId, params.remotePath, params.localPath, params.fileSystem);
		});

		this._rpcRouter.register('sftp.rm', async (params) => {
			await this._sftpController!.remove(params.hostId, params.path, params.fileSystem);
		});

		this._rpcRouter.register('sftp.mkdir', async (params) => {
			await this._sftpController!.mkdir(params.hostId, params.path, params.fileSystem);
		});

		this._rpcRouter.register('sftp.rename', async (params) => {
			await this._sftpController!.rename(params.hostId, params.oldPath, params.newPath, params.fileSystem);
		});

		this._rpcRouter.register('sftp.move', async (params) => {
			await this._sftpController!.move(params.hostId, params.sourcePaths, params.targetPath, params.sourcePanel, params.fileSystem);
		});

		this._rpcRouter.register('sftp.newFile', async (params) => {
			await this._sftpController!.newFile(params.hostId, params.path, params.fileSystem);
		});

		this._rpcRouter.register('sftp.remoteCopy', async (params) => {
			await this._sftpController!.remoteCopy(params.hostId, params.sourcePaths, params.targetPath);
		});

		this._rpcRouter.register('sftp.remoteMove', async (params) => {
			await this._sftpController!.remoteMove(params.hostId, params.sourcePaths, params.targetPath);
		});

		this._rpcRouter.register('sftp.resolveSymlink', async (params) => {
			return await this._sftpController!.resolveSymlink(params.hostId, params.symlinkPath, params.panelId, params.fileSystem);
		});

		// ============================================================
		// LOCAL FILE SYSTEM
		// ============================================================
		this._rpcRouter.register('local.copy', async (params) => {
			await this._sftpController!.localCopy(params.sourcePaths, params.targetPath);
		});

		this._rpcRouter.register('local.move', async (params) => {
			await this._sftpController!.localMove(params.sourcePaths, params.targetPath);
		});

		this._rpcRouter.register('local.openFile', async (params) => {
			await this._sftpController!.openLocalFile(params.path);
		});

		// ============================================================
		// CLIPBOARD OPERATIONS
		// ============================================================
		this._rpcRouter.register('clipboard.copy', async (params) => {
			await this._sftpController!.clipboardCopy(params.files, params.sourceHostId, params.system, params.operation);
		});

		this._rpcRouter.register('clipboard.paste', async (params) => {
			await this._sftpController!.clipboardPaste(params.targetPath, params.targetSystem, params.hostId);
		});

		// ============================================================
		// ARCHIVE OPERATIONS
		// ============================================================
		this._rpcRouter.register('archive.extract', async (params) => {
			await this._sftpController!.extractArchive(params.hostId, params.archivePath, params.fileSystem);
		});

		this._rpcRouter.register('archive.compress', async (params) => {
			await this._sftpController!.compressFiles(params.hostId, params.paths, params.archiveName, params.archiveType, params.fileSystem);
		});

		// ============================================================
		// SEARCH OPERATIONS
		// ============================================================
		this._rpcRouter.register('search.files', async (params) => {
			return await this._sftpController!.searchFiles(params.hostId, params.path, params.fileSystem, params.pattern, params.content, params.recursive);
		});

		// ============================================================
		// BOOKMARKS
		// ============================================================
		this._rpcRouter.register('bookmark.list', async (params) => {
			return await this._sftpController!.listBookmarks(params.hostId);
		});

		this._rpcRouter.register('bookmark.add', async (params) => {
			await this._sftpController!.addBookmark(params.bookmark);
		});

		this._rpcRouter.register('bookmark.remove', async (params) => {
			await this._sftpController!.removeBookmark(params.bookmarkId, params.hostId);
		});

		// ============================================================
		// DISK SPACE
		// ============================================================
		this._rpcRouter.register('disk.getSpace', async (params) => {
			return await this._sftpController!.getDiskSpace(params.hostId, params.path, params.fileSystem);
		});

		// ============================================================
		// ADVANCED CONTEXT ACTIONS
		// ============================================================
		this._rpcRouter.register('context.openInExplorer', async (params) => {
			await this._sftpController!.openInExplorer(params.hostId, params.path, params.fileSystem);
		});

		this._rpcRouter.register('context.openWithDefault', async (params) => {
			if (params.fileSystem === 'remote') {
				// Use EditHandler for remote files to download and open externally
				await this._editHandler.openFileExternally(params.hostId, params.path);
			} else {
				// Use SftpController for local files
				await this._sftpController!.openWithDefault(params.hostId, params.path, params.fileSystem);
			}
		});

		this._rpcRouter.register('context.calculateChecksum', async (params) => {
			return await this._sftpController!.calculateChecksum(params.hostId, params.path, params.fileSystem, params.algorithm);
		});

		this._rpcRouter.register('context.copyPath', async (params) => {
			await this._sftpController!.copyPath(params.path, params.type, params.hostId);
		});

		this._rpcRouter.register('context.createSymlink', async (params) => {
			await this._sftpController!.createSymlink(params.hostId, params.sourcePath, params.targetPath, params.fileSystem);
		});

		// ============================================================
		// CLIPBOARD OPERATIONS
		// ============================================================
		this._rpcRouter.register('clipboard.copy', async (params) => {
			await this._clipboardController!.copy(params.files, params.sourceHostId, params.system, params.operation);
		});

		this._rpcRouter.register('clipboard.paste', async (params) => {
			await this._clipboardController!.paste(params.targetPath, params.targetSystem, params.hostId);
		});

		// ============================================================
		// BULK RENAME
		// ============================================================
		this._rpcRouter.register('bulk.rename', async (params) => {
			await this._sftpController!.bulkRename(params.hostId, params.operations, params.fileSystem);
		});

		console.log('[RPC] Registered', this._rpcRouter.getRegisteredMethods().length, 'RPC handlers');
	}

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
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data: blob:; font-src ${webview.cspSource} data:; connect-src ${webview.cspSource} https:;">
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
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data: blob:; font-src ${webview.cspSource} data:; connect-src ${webview.cspSource} https:;">
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
 * Automatically restores previous sessions on extension activation based on settings
 */
async function restoreSessions(
	context: vscode.ExtensionContext,
	sessionTracker: SessionTracker,
	hostService: HostService,
	credentialService: CredentialService,
	hostKeyService: HostKeyService,
	sftpService: SftpService,
	localFsService: LocalFsService,
	clipboardService: ClipboardService,
	stateService: StateService,
	archiveService: ArchiveService,
	syncService: SyncService
): Promise<void> {
	// Check if auto-restore is enabled
	const config = vscode.workspace.getConfiguration('labonair.session');
	const autoRestore = config.get<boolean>('autoRestore', true);

	if (!autoRestore) {
		// Auto-restore disabled, clear any persisted sessions
		sessionTracker.clearPersistedSessions();
		return;
	}

	const persistedSessions = sessionTracker.getPersistedSessions();

	if (persistedSessions.length === 0) {
		return;
	}

	// Get max age setting (in days)
	const maxAgeDays = config.get<number>('maxAge', 2);
	const now = Date.now();
	const maxAgeMs = maxAgeDays > 0 ? maxAgeDays * 24 * 60 * 60 * 1000 : Infinity;

	// Filter sessions based on age
	const validSessions = persistedSessions.filter(session => {
		const sessionAge = now - (session.timestamp || 0);
		return sessionAge <= maxAgeMs;
	});

	if (validSessions.length === 0) {
		// All sessions are too old, clear them
		sessionTracker.clearPersistedSessions();
		return;
	}

	// Restore each valid session
	for (const sessionInfo of validSessions) {
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
					stateService,
					archiveService,
					syncService,
					hostService,
					credentialService,
					hostKeyService,
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

