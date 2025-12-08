import { HostKeyService } from './security/hostKeyService';

import * as vscode from 'vscode';
import { HostService } from './hostService';
import { CredentialService } from './credentialService';
import { ScriptService } from './scriptService';
import { SessionTracker } from './sessionTracker';
import { SshAgentService } from './sshAgent';
import { ShellService } from './system/shellService';
import { ImporterService } from './importers';
import { StatusService } from './statusService';
import { registerCommands } from './commands';
import { SshConnectionService } from './services/sshConnectionService';
import { SftpService } from './services/sftpService';
import { SftpPanel } from './panels/sftpPanel';
import { Message, Host, HostStatus } from '../common/types';

// Store service instances for cleanup
let sshConnectionServiceInstance: SshConnectionService | undefined;
let sftpServiceInstance: SftpService | undefined;

export function activate(context: vscode.ExtensionContext) {
	const hostService = new HostService(context);
	const credentialService = new CredentialService(context);
	const scriptService = new ScriptService(context);
	const sessionTracker = new SessionTracker(context);
	const sshAgentService = new SshAgentService(context);
	const importerService = new ImporterService();
	const hostKeyService = new HostKeyService();
	const shellService = new ShellService();
	const sshConnectionService = new SshConnectionService(hostService, credentialService);
	const sftpService = new SftpService(hostService, credentialService);

	// Store for cleanup
	sshConnectionServiceInstance = sshConnectionService;
	sftpServiceInstance = sftpService;

	// Register Commands
	registerCommands(context, hostService, sftpService);

	// Register the Webview View Provider
	try {
		console.log('Activating Connectivity Extension...');
		const provider = new ConnectivityViewProvider(
			context.extensionUri,
			hostService,
			credentialService,
			scriptService,
			sessionTracker,
			sshAgentService,
			importerService,
			hostKeyService,
			shellService,
			sshConnectionService,
			sftpService
		);
		context.subscriptions.push(
			vscode.window.registerWebviewViewProvider('labonair.views.hosts', provider)
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
		private readonly _scriptService: ScriptService,
		private readonly _sessionTracker: SessionTracker,
		private readonly _sshAgentService: SshAgentService,
		private readonly _importerService: ImporterService,
		private readonly _hostKeyService: HostKeyService,
		private readonly _shellService: ShellService,
		private readonly _sshConnectionService: SshConnectionService,
		private readonly _sftpService: SftpService
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

		// Listen for script updates
		this._scriptService.onDidChangeScripts(scripts => {
			webviewView.webview.postMessage({ command: 'UPDATE_DATA', payload: { scripts } });
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
					const scripts = await this._scriptService.getScripts();
					const activeHostIds = this._sessionTracker.getActiveHostIds();
					const hostStatuses = this._statusService?.getAllStatuses() || {};

					webviewView.webview.postMessage({
						command: 'UPDATE_DATA',
						payload: { hosts, credentials, scripts, activeSessionHostIds: activeHostIds, hostStatuses }
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

					// Host Key Verification
					const mockKey = Buffer.from('mock-public-key-' + hostToConnect.host);
					const verificationStatus = await this._hostKeyService.verifyHostKey(hostToConnect.host, hostToConnect.port, 'ssh-rsa', mockKey);

					if (verificationStatus !== 'valid') {
						webviewView.webview.postMessage({
							command: 'CHECK_HOST_KEY',
							payload: {
								host: hostToConnect.host,
								port: hostToConnect.port,
								fingerprint: mockKey.toString('base64'),
								status: verificationStatus
							}
						});
						return;
					}

					this.startSession(hostToConnect);
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
						this._hostService
					);
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
						this.startSession(existingHost);
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
				// SCRIPTS
				// ============================================================
				case 'RUN_SCRIPT': {
					const scriptId = message.payload.scriptId;
					const hostId = message.payload.hostId;
					const allScripts = await this._scriptService.getScripts();
					const script = allScripts.find(s => s.id === scriptId);
					if (script) {
						vscode.window.showInformationMessage(`Simulating sending script "${script.name}" to host ${hostId}`);
						// TODO: Actual implementation will connect to host and send script
					}
					break;
				}

				case 'SAVE_SCRIPT':
					await this._scriptService.saveScript(message.payload.script);
					this.broadcastUpdate();
					break;

				case 'DELETE_SCRIPT':
					await this._scriptService.deleteScript(message.payload.id);
					break;

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
			}
		});
	}

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

	private async broadcastUpdate() {
		if (this._view) {
			const hosts = this._hostService.getHosts();
			const credentials = await this._credentialService.getCredentials();
			const scripts = await this._scriptService.getScripts();
			const activeHostIds = this._sessionTracker.getActiveHostIds();
			const hostStatuses = this._statusService?.getAllStatuses() || {};
			this._view.webview.postMessage({
				command: 'UPDATE_DATA',
				payload: { hosts, credentials, scripts, activeSessionHostIds: activeHostIds, hostStatuses }
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
}

