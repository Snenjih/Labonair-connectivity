import * as vscode from 'vscode';
import { SftpService } from '../services/sftpService';
import { HostService } from '../hostService';
import { Message, FileEntry } from '../../common/types';

/**
 * SFTP Panel Manager
 * Manages SFTP file browser panels (WebviewPanel instances)
 */
export class SftpPanel {
	public static currentPanel: SftpPanel | undefined;
	private static readonly viewType = 'labonairSftpPanel';

	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private readonly _hostId: string;
	private _disposables: vscode.Disposable[] = [];
	private _currentPath: string = '';

	/**
	 * Creates or shows the SFTP panel for a host
	 */
	public static createOrShow(
		extensionUri: vscode.Uri,
		hostId: string,
		sftpService: SftpService,
		hostService: HostService
	): SftpPanel {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		// If we already have a panel, show it
		if (SftpPanel.currentPanel) {
			SftpPanel.currentPanel._panel.reveal(column);
			return SftpPanel.currentPanel;
		}

		// Otherwise, create a new panel
		const panel = vscode.window.createWebviewPanel(
			SftpPanel.viewType,
			'SFTP File Manager',
			column || vscode.ViewColumn.One,
			{
				enableScripts: true,
				localResourceRoots: [extensionUri],
				retainContextWhenHidden: true
			}
		);

		SftpPanel.currentPanel = new SftpPanel(panel, extensionUri, hostId, sftpService, hostService);
		return SftpPanel.currentPanel;
	}

	private constructor(
		panel: vscode.WebviewPanel,
		extensionUri: vscode.Uri,
		hostId: string,
		private readonly _sftpService: SftpService,
		private readonly _hostService: HostService
	) {
		this._panel = panel;
		this._extensionUri = extensionUri;
		this._hostId = hostId;

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

		// Initialize with home directory
		this._initializeFileManager();
	}

	/**
	 * Initializes the file manager with the host's default path or home directory
	 */
	private async _initializeFileManager(): Promise<void> {
		try {
			const host = this._hostService.getHostById(this._hostId);
			if (!host) {
				vscode.window.showErrorMessage('Host not found');
				return;
			}

			// Use default path or home directory
			const initialPath = host.defaultPath || '~';
			this._currentPath = initialPath;

			// Update panel title
			this._panel.title = `SFTP: ${host.name || host.host}`;

			// Send initial state to webview
			this._panel.webview.postMessage({
				command: 'UPDATE_DATA',
				payload: {
					view: 'fileManager',
					hostId: this._hostId,
					currentPath: this._currentPath,
					hosts: [host]
				}
			});

			// Load initial directory listing
			await this._listFiles(this._currentPath);
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to initialize file manager: ${error}`);
		}
	}

	/**
	 * Handles messages from the webview
	 */
	private async _handleMessage(message: Message): Promise<void> {
		switch (message.command) {
			case 'SFTP_LS': {
				await this._listFiles(message.payload.path);
				break;
			}

			case 'SFTP_DOWNLOAD': {
				await this._downloadFile(message.payload.remotePath);
				break;
			}

			case 'SFTP_UPLOAD': {
				await this._uploadFile(message.payload.remotePath);
				break;
			}

			case 'SFTP_RM': {
				await this._deleteFile(message.payload.path);
				break;
			}

			case 'SFTP_MKDIR': {
				await this._createDirectory(message.payload.path);
				break;
			}

			case 'FETCH_DATA': {
				// Re-send current state
				const host = this._hostService.getHostById(this._hostId);
				if (host) {
					this._panel.webview.postMessage({
						command: 'UPDATE_DATA',
						payload: {
							view: 'fileManager',
							hostId: this._hostId,
							currentPath: this._currentPath,
							hosts: [host]
						}
					});
				}
				break;
			}
		}
	}

	/**
	 * Lists files in a directory
	 */
	private async _listFiles(path: string): Promise<void> {
		try {
			const files = await this._sftpService.listFiles(this._hostId, path);
			this._currentPath = path;

			this._panel.webview.postMessage({
				command: 'SFTP_LS_RESPONSE',
				payload: {
					files,
					currentPath: path
				}
			});
		} catch (error) {
			this._panel.webview.postMessage({
				command: 'SFTP_ERROR',
				payload: {
					message: `Failed to list directory: ${error}`
				}
			});
		}
	}

	/**
	 * Downloads a file from remote to local
	 */
	private async _downloadFile(remotePath: string): Promise<void> {
		try {
			// Prompt user for save location
			const fileName = remotePath.split('/').pop() || 'file';
			const uri = await vscode.window.showSaveDialog({
				defaultUri: vscode.Uri.file(fileName),
				saveLabel: 'Download'
			});

			if (!uri) {
				return;
			}

			// Download the file with progress
			await this._sftpService.getFile(
				this._hostId,
				remotePath,
				uri.fsPath,
				(progress, speed) => {
					this._panel.webview.postMessage({
						command: 'SFTP_TRANSFER_PROGRESS',
						payload: {
							filename: fileName,
							progress,
							speed,
							type: 'download'
						}
					});
				}
			);

			vscode.window.showInformationMessage(`Downloaded: ${fileName}`);

			// Refresh directory listing
			await this._listFiles(this._currentPath);
		} catch (error) {
			this._panel.webview.postMessage({
				command: 'SFTP_ERROR',
				payload: {
					message: `Download failed: ${error}`
				}
			});
		}
	}

	/**
	 * Uploads a file from local to remote
	 */
	private async _uploadFile(remotePath: string): Promise<void> {
		try {
			// Prompt user to select file
			const uris = await vscode.window.showOpenDialog({
				canSelectMany: false,
				openLabel: 'Upload'
			});

			if (!uris || uris.length === 0) {
				return;
			}

			const localPath = uris[0].fsPath;
			const fileName = localPath.split(/[\\/]/).pop() || 'file';
			const targetPath = remotePath.endsWith('/')
				? remotePath + fileName
				: remotePath + '/' + fileName;

			// Upload the file with progress
			await this._sftpService.putFile(
				this._hostId,
				localPath,
				targetPath,
				(progress, speed) => {
					this._panel.webview.postMessage({
						command: 'SFTP_TRANSFER_PROGRESS',
						payload: {
							filename: fileName,
							progress,
							speed,
							type: 'upload'
						}
					});
				}
			);

			vscode.window.showInformationMessage(`Uploaded: ${fileName}`);

			// Refresh directory listing
			await this._listFiles(this._currentPath);
		} catch (error) {
			this._panel.webview.postMessage({
				command: 'SFTP_ERROR',
				payload: {
					message: `Upload failed: ${error}`
				}
			});
		}
	}

	/**
	 * Deletes a file or directory
	 */
	private async _deleteFile(path: string): Promise<void> {
		try {
			const fileName = path.split('/').pop() || '';
			const confirm = await vscode.window.showWarningMessage(
				`Delete ${fileName}?`,
				{ modal: true },
				'Delete'
			);

			if (confirm !== 'Delete') {
				return;
			}

			await this._sftpService.delete(this._hostId, path);
			vscode.window.showInformationMessage(`Deleted: ${fileName}`);

			// Refresh directory listing
			await this._listFiles(this._currentPath);
		} catch (error) {
			this._panel.webview.postMessage({
				command: 'SFTP_ERROR',
				payload: {
					message: `Delete failed: ${error}`
				}
			});
		}
	}

	/**
	 * Creates a new directory
	 */
	private async _createDirectory(path: string): Promise<void> {
		try {
			const dirName = await vscode.window.showInputBox({
				prompt: 'Enter directory name',
				placeHolder: 'new-folder'
			});

			if (!dirName) {
				return;
			}

			const newPath = path.endsWith('/') ? path + dirName : path + '/' + dirName;
			await this._sftpService.mkdir(this._hostId, newPath);
			vscode.window.showInformationMessage(`Created directory: ${dirName}`);

			// Refresh directory listing
			await this._listFiles(this._currentPath);
		} catch (error) {
			this._panel.webview.postMessage({
				command: 'SFTP_ERROR',
				payload: {
					message: `Failed to create directory: ${error}`
				}
			});
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
		SftpPanel.currentPanel = undefined;

		// Clean up resources
		this._panel.dispose();

		while (this._disposables.length) {
			const disposable = this._disposables.pop();
			if (disposable) {
				disposable.dispose();
			}
		}

		// Close SFTP session
		this._sftpService.closeSession(this._hostId);
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
				<title>SFTP File Manager</title>
			</head>
			<body>
				<div id="root"></div>
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
