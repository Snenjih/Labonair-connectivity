import * as vscode from 'vscode';
import { SshSession } from '../services/sshSession';
import { LocalPtyService } from '../services/localPtyService';
import { HostService } from '../hostService';
import { CredentialService } from '../credentialService';
import { HostKeyService } from '../security/hostKeyService';
import { SessionTracker } from '../sessionTracker';
import { Message, Host } from '../../common/types';

// Common interface for both SSH and Local sessions
interface ITerminalSession {
	connect(): Promise<void>;
	write(data: string): void;
	resize(cols: number, rows: number): void;
	dispose(): void;
	connected: boolean;
	checkFileExists(path: string): Promise<boolean>;
	readFile(path: string): Promise<string>;
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
	private _sessions: Map<number, ITerminalSession> = new Map();
	private _splitMode: 'none' | 'vertical' | 'horizontal' = 'none';

	/**
	 * Creates or shows the terminal panel for a host
	 */
	public static createOrShow(
		extensionUri: vscode.Uri,
		hostId: string,
		host: Host,
		hostService: HostService,
		credentialService: CredentialService,
		hostKeyService: HostKeyService,
		sessionTracker?: SessionTracker
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
			credentialService,
			hostKeyService,
			sessionTracker
		);

		TerminalPanel.panels.set(hostId, terminalPanel);
		return terminalPanel;
	}

	/**
	 * Broadcasts a host configuration update to the terminal panel for that host
	 * This enables live updates when terminal settings are changed
	 */
	public static broadcastHostConfigUpdate(hostId: string, host: Host): void {
		const panel = TerminalPanel.panels.get(hostId);
		if (panel && panel._panel) {
			panel._panel.webview.postMessage({
				command: 'HOST_CONFIG_UPDATED',
				payload: { hostId, host }
			});
		}
	}

	private constructor(
		panel: vscode.WebviewPanel,
		extensionUri: vscode.Uri,
		hostId: string,
		host: Host,
		private readonly _hostService: HostService,
		private readonly _credentialService: CredentialService,
		private readonly _hostKeyService: HostKeyService,
		private readonly _sessionTracker?: SessionTracker
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

		// Register with session tracker
		if (this._sessionTracker) {
			this._sessionTracker.registerPanel(this._hostId, {
				hostId: this._hostId,
				splitMode: this._splitMode,
				type: 'terminal',
				timestamp: Date.now()
			});
		}

		// Initialize main SSH session (splitId = 1)
		this._initializeSession(1);
	}

	/**
	 * Initializes a terminal session (SSH or Local PTY)
	 * @param splitId - ID of the split pane (1 = main, 2 = split)
	 */
	private async _initializeSession(splitId: number): Promise<void> {
		try {
			// Get terminal defaults from configuration
			const terminalConfig = vscode.workspace.getConfiguration('labonair.terminal');
			const terminalDefaults = {
				fontSize: terminalConfig.get<number>('fontSize', 16),
				fontWeight: terminalConfig.get<string>('fontWeight', '500'),
				lineHeight: terminalConfig.get<number>('lineHeight', 1.5),
				letterSpacing: terminalConfig.get<number>('letterSpacing', 2),
				cursorStyle: terminalConfig.get<string>('cursorStyle', 'block'),
				cursorBlink: terminalConfig.get<boolean>('cursorBlink', true),
				pasteThreshold: terminalConfig.get<number>('pasteThreshold', 10)
			};

			// Send initial state to webview
			this._panel.webview.postMessage({
				command: 'UPDATE_DATA',
				payload: {
					view: 'terminal',
					hostId: this._hostId,
					hosts: [this._host],
					terminalDefaults
				}
			});

			// Check if this is a local shell connection
			const isLocalShell = this._host.protocol === 'local' || this._host.protocol === 'wsl';

			let session: ITerminalSession;

			if (isLocalShell) {
				// Create local PTY session
				session = new LocalPtyService(
					this._host,
					(data: string) => {
						// Send data to webview with splitId
						this._panel.webview.postMessage({
							command: 'TERM_DATA',
							payload: { data, splitId }
						});
					},
					(status: 'connecting' | 'connected' | 'disconnected' | 'error', message?: string) => {
						// Send status to webview with splitId
						this._panel.webview.postMessage({
							command: 'TERM_STATUS',
							payload: { status, message, splitId }
						});
					}
				);
			} else {
				// Create SSH session
				session = new SshSession(
					this._host,
					this._hostService,
					this._credentialService,
					this._hostKeyService,
					(data: string) => {
						// Send data to webview with splitId
						this._panel.webview.postMessage({
							command: 'TERM_DATA',
							payload: { data, splitId }
						});
					},
					(status: 'connecting' | 'connected' | 'disconnected' | 'error', message?: string) => {
						// Send status to webview with splitId
						this._panel.webview.postMessage({
							command: 'TERM_STATUS',
							payload: { status, message, splitId }
						});
					}
				);
			}

			// Store session in map
			this._sessions.set(splitId, session);

			// Connect
			await session.connect();

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
				const splitId = message.payload.splitId || 1;
				const session = this._sessions.get(splitId);
				if (session) {
					session.write(message.payload.data);
				}
				break;
			}

			case 'TERM_RESIZE': {
				// Terminal resize
				const splitId = message.payload.splitId || 1;
				const session = this._sessions.get(splitId);
				if (session) {
					session.resize(message.payload.cols, message.payload.rows);
				}
				break;
			}

			case 'TERM_RECONNECT': {
				// Reconnect to host - dispose all sessions and reinit main
				this._sessions.forEach(session => session.dispose());
				this._sessions.clear();
				this._splitMode = 'none';
				await this._initializeSession(1);
				break;
			}

			case 'TERMINAL_SPLIT': {
				// Create a split pane with new session
				if (this._sessions.size < 2) {
					this._splitMode = message.payload.mode;
					await this._initializeSession(2);
					// Notify webview of split mode
					this._panel.webview.postMessage({
						command: 'UPDATE_DATA',
						payload: {
							view: 'terminal',
							splitMode: this._splitMode
						}
					});
					// Update session tracker with new split mode
					if (this._sessionTracker) {
						this._sessionTracker.registerPanel(this._hostId, {
							hostId: this._hostId,
							splitMode: this._splitMode,
							type: 'terminal',
							timestamp: Date.now()
						});
					}
				}
				break;
			}

			case 'TERMINAL_CLOSE_SPLIT': {
				// Close a split pane
				const splitId = message.payload.splitId;
				const session = this._sessions.get(splitId);
				if (session) {
					session.dispose();
					this._sessions.delete(splitId);
				}
				if (this._sessions.size === 1) {
					this._splitMode = 'none';
					// Update session tracker with new split mode
					if (this._sessionTracker) {
						this._sessionTracker.registerPanel(this._hostId, {
							hostId: this._hostId,
							splitMode: this._splitMode,
							type: 'terminal',
							timestamp: Date.now()
						});
					}
				}
				break;
			}

			case 'SAVE_TERMINAL_CONFIG': {
				// Save terminal configuration to global state
				// This would be handled by storing in VS Code's globalState
				// For now, just acknowledge
				break;
			}

			case 'CHANGE_ENCODING': {
				// Change encoding for a specific session
				// This would require updating SshSession to support encoding changes
				// For now, just acknowledge
				break;
			}

			case 'OPEN_SFTP': {
				// Open SFTP panel
				vscode.commands.executeCommand('labonair.openSFTP', this._hostId);
				break;
			}

			case 'CHECK_FILE': {
				// Check if file exists and open it - use first available session
				const session = this._sessions.get(1);
				if (session && session.connected) {
					const exists = await session.checkFileExists(message.payload.path);
					if (exists) {
						try {
							const content = await session.readFile(message.payload.path);
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

		// Unregister from session tracker
		if (this._sessionTracker) {
			this._sessionTracker.unregisterPanel(this._hostId);
		}

		// Clean up resources
		this._panel.dispose();

		while (this._disposables.length) {
			const disposable = this._disposables.pop();
			if (disposable) {
				disposable.dispose();
			}
		}

		// Close all SSH sessions
		this._sessions.forEach(session => session.dispose());
		this._sessions.clear();
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
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data: blob:; font-src ${webview.cspSource} data:; connect-src ${webview.cspSource} https:;">
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
