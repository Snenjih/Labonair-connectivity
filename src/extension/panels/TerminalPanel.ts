import * as vscode from 'vscode';
import { SshSession } from '../services/sshSession';
import { LocalPtyService } from '../services/localPtyService';
import { HostService } from '../hostService';
import { CredentialService } from '../credentialService';
import { Message, Host } from '../../common/types';

// Common interface for both SSH and Local sessions
interface ITerminalSession {
	connect(): Promise<void>;
	write(data: string): void;
	resize(cols: number, rows: number): void;
	dispose(): void;
	connected: boolean;
}

/**
 * Terminal Panel Manager
 * Manages SSH terminal panels (WebviewPanel instances) with xterm.js
 */
export class TerminalPanel {
	private static readonly panels: Map<string, TerminalPanel> = new Map();
	private static readonly viewType = 'labonairTerminal';

	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private readonly _hostId: string;
	private readonly _host: Host;
	private _disposables: vscode.Disposable[] = [];
	private _session: ITerminalSession | null = null;

	/**
	 * Creates or shows the terminal panel for a host
	 */
	public static createOrShow(
		extensionUri: vscode.Uri,
		hostId: string,
		host: Host,
		hostService: HostService,
		credentialService: CredentialService
	): TerminalPanel {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		// If we already have a panel for this host, show it
		const existingPanel = TerminalPanel.panels.get(hostId);
		if (existingPanel) {
			existingPanel._panel.reveal(column);
			return existingPanel;
		}

		// Otherwise, create a new panel
		const isLocalShell = host.protocol === 'local' || host.protocol === 'wsl';
		const panelTitle = isLocalShell 
			? `Local: ${host.name || 'Shell'}`
			: `SSH: ${host.name || host.host}`;

		const panel = vscode.window.createWebviewPanel(
			TerminalPanel.viewType,
			panelTitle,
			column || vscode.ViewColumn.One,
			{
				enableScripts: true,
				localResourceRoots: [extensionUri],
				retainContextWhenHidden: true
			}
		);

		const terminalPanel = new TerminalPanel(
			panel,
			extensionUri,
			hostId,
			host,
			hostService,
			credentialService
		);

		TerminalPanel.panels.set(hostId, terminalPanel);
		return terminalPanel;
	}

	private constructor(
		panel: vscode.WebviewPanel,
		extensionUri: vscode.Uri,
		hostId: string,
		host: Host,
		private readonly _hostService: HostService,
		private readonly _credentialService: CredentialService
	) {
		this._panel = panel;
		this._extensionUri = extensionUri;
		this._hostId = hostId;
		this._host = host;

		// Set the webview's initial html content
		this._update();

		// Listen for when the panel is disposed
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		// Handle messages from the webview
		this._panel.webview.onDidReceiveMessage(
			async (message: Message) => {
				await this._handleMessage(message);
			},
			null,
			this._disposables
		);

		// Initialize SSH session
		this._initializeSession();
	}

	/**
	 * Initializes the terminal session (SSH or Local PTY)
	 */
	private async _initializeSession(): Promise<void> {
		try {
			// Send initial state to webview
			this._panel.webview.postMessage({
				command: 'UPDATE_DATA',
				payload: {
					view: 'terminal',
					hostId: this._hostId,
					hosts: [this._host]
				}
			});

			// Check if this is a local shell connection
			const isLocalShell = this._host.protocol === 'local' || this._host.protocol === 'wsl';

			if (isLocalShell) {
				// Create local PTY session
				this._session = new LocalPtyService(
					this._host,
					(data: string) => {
						// Send data to webview
						this._panel.webview.postMessage({
							command: 'TERM_DATA',
							payload: { data }
						});
					},
					(status: 'connecting' | 'connected' | 'disconnected' | 'error', message?: string) => {
						// Send status to webview
						this._panel.webview.postMessage({
							command: 'TERM_STATUS',
							payload: { status, message }
						});
					}
				);
			} else {
				// Create SSH session
				this._session = new SshSession(
					this._host,
					this._hostService,
					this._credentialService,
					(data: string) => {
						// Send data to webview
						this._panel.webview.postMessage({
							command: 'TERM_DATA',
							payload: { data }
						});
					},
					(status: 'connecting' | 'connected' | 'disconnected' | 'error', message?: string) => {
						// Send status to webview
						this._panel.webview.postMessage({
							command: 'TERM_STATUS',
							payload: { status, message }
						});
					}
				);
			}

			// Connect
			await this._session.connect();

		} catch (error) {
			vscode.window.showErrorMessage(`Failed to initialize terminal: ${error}`);
			this._panel.webview.postMessage({
				command: 'TERM_STATUS',
				payload: {
					status: 'error',
					message: `Failed to connect: ${error}`
				}
			});
		}
	}

	/**
	 * Handles messages from the webview
	 */
	private async _handleMessage(message: Message): Promise<void> {
		switch (message.command) {
			case 'TERM_INPUT': {
				// User input from terminal
				if (this._session) {
					this._session.write(message.payload.data);
				}
				break;
			}

			case 'TERM_RESIZE': {
				// Terminal resize
				if (this._session) {
					this._session.resize(message.payload.cols, message.payload.rows);
				}
				break;
			}

			case 'TERM_RECONNECT': {
				// Reconnect to host
				if (this._session) {
					this._session.dispose();
				}
				await this._initializeSession();
				break;
			}

			case 'OPEN_SFTP': {
				// Open SFTP panel
				vscode.commands.executeCommand('labonair.openSFTP', this._hostId);
				break;
			}

			case 'CHECK_FILE': {
				// Check if file exists and open it
				if (this._session && this._session.connected) {
					const exists = await this._session.checkFileExists(message.payload.path);
					if (exists) {
						try {
							const content = await this._session.readFile(message.payload.path);
							// Create a temporary file and open it
							const tempUri = vscode.Uri.parse(`untitled:${message.payload.path}`);
							const doc = await vscode.workspace.openTextDocument(tempUri);
							const editor = await vscode.window.showTextDocument(doc);
							await editor.edit(editBuilder => {
								editBuilder.insert(new vscode.Position(0, 0), content);
							});
						} catch (error) {
							vscode.window.showErrorMessage(`Failed to open file: ${error}`);
						}
					} else {
						vscode.window.showWarningMessage(`File not found: ${message.payload.path}`);
					}
				}
				break;
			}

			case 'FETCH_DATA': {
				// Re-send current state
				this._panel.webview.postMessage({
					command: 'UPDATE_DATA',
					payload: {
						view: 'terminal',
						hostId: this._hostId,
						hosts: [this._host]
					}
				});
				break;
			}
		}
	}

	/**
	 * Updates the webview content
	 */
	private _update(): void {
		this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
	}

	/**
	 * Disposes the panel
	 */
	public dispose(): void {
		TerminalPanel.panels.delete(this._hostId);

		// Clean up resources
		this._panel.dispose();

		while (this._disposables.length) {
			const disposable = this._disposables.pop();
			if (disposable) {
				disposable.dispose();
			}
		}

		// Close SSH session
		if (this._session) {
			this._session.dispose();
			this._session = null;
		}
	}

	/**
	 * Generates HTML content for the webview
	 */
	private _getHtmlForWebview(webview: vscode.Webview): string {
		const scriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview.js')
		);
		const nonce = this._getNonce();

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>SSH Terminal: ${this._host.name || this._host.host}</title>
			</head>
			<body>
				<div id="root"></div>
				<script nonce="${nonce}">window.LABONAIR_CONTEXT = 'editor';</script>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
	}

	/**
	 * Generates a nonce for CSP
	 */
	private _getNonce(): string {
		let text = '';
		const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		for (let i = 0; i < 32; i++) {
			text += possible.charAt(Math.floor(Math.random() * possible.length));
		}
		return text;
	}
}
