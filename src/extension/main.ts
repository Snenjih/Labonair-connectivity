import { HostKeyService } from './security/hostKeyService';
// import { Utils } from 'vscode-uri'; // Removed unused import causing build error

import * as vscode from 'vscode';
import { HostService } from './hostService';
import { CredentialService } from './credentialService';
import { ScriptService } from './scriptService';
import { SessionTracker } from './sessionTracker';
import { SshAgentService } from './sshAgent';
import { ShellService } from './system/shellService';
import { ImporterService } from './importers';
import { registerCommands } from './commands';
import { Message, Host } from '../common/types';

export function activate(context: vscode.ExtensionContext) {
	const hostService = new HostService(context);
	const credentialService = new CredentialService(context);
	const scriptService = new ScriptService(context);
	const sessionTracker = new SessionTracker(context);
	const sshAgentService = new SshAgentService(context);
	const importerService = new ImporterService();

	// Register Commands
	const hostKeyService = new HostKeyService();
	const shellService = new ShellService();

	// Register Commands
	registerCommands(context, hostService);

	// Register the Webview View Provider
	try {
		console.log('Activating Connectivity Extension...');
		const provider = new ConnectivityViewProvider(context.extensionUri, hostService, credentialService, scriptService, sessionTracker, sshAgentService, importerService, hostKeyService, shellService);
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

	constructor(
		private readonly _extensionUri: vscode.Uri,
		private readonly _hostService: HostService,
		private readonly _credentialService: CredentialService,
		private readonly _scriptService: ScriptService,
		private readonly _sessionTracker: SessionTracker,
		private readonly _sshAgentService: SshAgentService,
		private readonly _importerService: ImporterService,
		private readonly _hostKeyService: HostKeyService,
		private readonly _shellService: ShellService
	) { }

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {
		console.log('ConnectivityViewProvider.resolveWebviewView called');
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this._extensionUri]
		};

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
		console.log('Webview HTML set');

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

		webviewView.webview.onDidReceiveMessage(async (message: Message) => {
			switch (message.command) {
				case 'FETCH_DATA':
					// ... fetch data
					const hosts = this._hostService.getHosts();
					const credentials = await this._credentialService.getCredentials();
					const scripts = await this._scriptService.getScripts();
					const activeHostIds = this._sessionTracker.getActiveHostIds();
					webviewView.webview.postMessage({
						command: 'UPDATE_DATA',
						payload: { hosts, credentials, scripts, activeSessionHostIds: activeHostIds }
					});

					// Also check SSH Agent
					const agentAvailable = await this._sshAgentService.isAgentAvailable();
					webviewView.webview.postMessage({ command: 'AGENT_STATUS', payload: { available: agentAvailable } });

					// Get Shells
					const shells = await this._shellService.getAvailableShells();
					webviewView.webview.postMessage({ command: 'AVAILABLE_SHELLS', payload: { shells } });
					break;

				case 'SAVE_HOST':
					await this._hostService.saveHost(message.payload.host, message.payload.password, message.payload.keyPath);
					this.broadcastUpdate();
					break;
				case 'DELETE_HOST':
					await this._hostService.deleteHost(message.payload.id);
					this.broadcastUpdate();
					break;
					break;
				case 'CONNECT_SSH':
					let hostToConnect: Host | undefined;
					if (message.payload.id) {
						hostToConnect = this._hostService.getHosts().find(h => h.id === message.payload.id);
					} else if (message.payload.host) {
						hostToConnect = message.payload.host;
					}

					if (!hostToConnect) {
						vscode.window.showErrorMessage("Host not found.");
						return;
					}

					vscode.window.showInformationMessage(`Connecting to ${hostToConnect.name || hostToConnect.host}...`);

					// Host Key Verification
					// Mock key for simulation.
					const mockKey = Buffer.from('mock-public-key-' + hostToConnect.host);
					const verificationStatus = await this._hostKeyService.verifyHostKey(hostToConnect.host, hostToConnect.port, 'ssh-rsa', mockKey);

					if (verificationStatus !== 'valid') {
						// Ask user to verify
						webviewView.webview.postMessage({
							command: 'CHECK_HOST_KEY',
							payload: {
								host: hostToConnect.host,
								port: hostToConnect.port,
								fingerprint: mockKey.toString('base64'),
								status: verificationStatus
							}
						});
						// We need to store the pending host to continue after acceptance.
						// Currently ACCEPT_HOST_KEY handler tries to refind it.
						// We might need to handle ad-hoc continuation.
						// For now, let's assume ACCEPT_HOST_KEY works by finding host/port.
						return;
					}

					// Proceed if valid
					this.startSession(hostToConnect);
					break;

				case 'ACCEPT_HOST_KEY':
					if (message.payload.save) {
						const keyBuffer = Buffer.from(message.payload.fingerprint, 'base64');
						await this._hostKeyService.addHostKey(message.payload.host, message.payload.port, 'ssh-rsa', keyBuffer);
					}
					// Retry connection
					// For ad-hoc, we don't have the object here easily unless we reconstructed it or stored it.
					// Let's try to find it in store first.
					const existingHost = this._hostService.getHosts().find(h => h.host === message.payload.host && h.port === message.payload.port);
					if (existingHost) {
						this.startSession(existingHost);
					} else {
						// It might be ad-hoc.
						// Simple workaround: We don't have the full host object (credentials, etc) here to restart ad-hoc session fully
						// unless we passed it back and forth.
						// For this iteration, we'll show a message asking user to click connect again.
						vscode.window.showInformationMessage("Host key accepted. Please click connect again.");
					}
					break;

				case 'DENY_HOST_KEY':
					vscode.window.showWarningMessage('Connection aborted by user.');
					break;

				case 'PICK_KEY_FILE':
					const uris = await vscode.window.showOpenDialog({ canSelectFiles: true, canSelectFolders: false });
					if (uris && uris.length > 0) {
						webviewView.webview.postMessage({ command: 'KEY_FILE_PICKED', payload: { path: uris[0].fsPath } });
					}
					break;
				case 'IMPORT_REQUEST':
					const imported = await this._importerService.importHosts(message.payload.format);
					if (imported && imported.length > 0) {
						for (const h of imported) {
							await this._hostService.saveHost(h);
						}
						this.broadcastUpdate();
						vscode.window.showInformationMessage(`Imported ${imported.length} hosts.`);
					}
					break;
				case 'EXPORT_REQUEST':
					const currentHosts = this._hostService.getHosts();
					await this._importerService.exportHosts(currentHosts);
					break;
				case 'GET_CREDENTIALS':
					const creds = await this._credentialService.getCredentials();
					webviewView.webview.postMessage({ command: 'UPDATE_DATA', payload: { hosts: this._hostService.getHosts(), credentials: creds } });
					break;
				case 'SAVE_CREDENTIAL':
					await this._credentialService.saveCredential(message.payload.credential, message.payload.secret);
					this.broadcastUpdate();
					break;
				case 'DELETE_CREDENTIAL':
					await this._credentialService.deleteCredential(message.payload.id);
					this.broadcastUpdate();
					break;
				case 'RUN_SCRIPT':
					const scriptId = message.payload.scriptId;
					const hostId = message.payload.hostId;
					const allScripts = await this._scriptService.getScripts();
					const script = allScripts.find(s => s.id === scriptId);
					if (script) {
						vscode.window.showInformationMessage(`Simulating sending script "${script.name}" to host ${hostId}`);
						// Actual implementation will connect to host and send script
					}
					break;
				case 'SAVE_SCRIPT':
					await this._scriptService.saveScript(message.payload.script);
					this.broadcastUpdate();
					break;
				case 'DELETE_SCRIPT':
					await this._scriptService.deleteScript(message.payload.id);
					break;
			}
		});
	}

	private async startSession(host: Host) {
		const term = vscode.window.createTerminal(`SSH: ${host.name || host.host}`);
		term.show();
		this._sessionTracker.registerSession(host.id, term);

		// If it's a saved host, update last used
		const isSaved = this._hostService.getHosts().some(h => h.id === host.id);
		if (isSaved) {
			await this._hostService.updateLastUsed(host.id);
		} else {
			// Ad-hoc: Offer to save
			const selection = await vscode.window.showInformationMessage(`Connected to ${host.host}. Save this connection?`, 'Yes', 'No');
			if (selection === 'Yes') {
				// We can reuse SAVE_HOST logic if we strip ID? Or keep ID?
				// Just call saveHost
				await this._hostService.saveHost(host);
				vscode.window.showInformationMessage("Host saved.");
				this.broadcastUpdate();
			}
		}
		this.broadcastUpdate();
	}

	private async broadcastUpdate() {
		if (this._view) {
			const hosts = this._hostService.getHosts();
			const credentials = await this._credentialService.getCredentials();
			const scripts = await this._scriptService.getScripts();
			const activeHostIds = this._sessionTracker.getActiveHostIds();
			this._view.webview.postMessage({ command: 'UPDATE_DATA', payload: { hosts, credentials, scripts, activeSessionHostIds: activeHostIds } });
		}
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview.js'));
		const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'styles', 'main.css')); // Keep for now if needed, but style-loader should handle it.

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
