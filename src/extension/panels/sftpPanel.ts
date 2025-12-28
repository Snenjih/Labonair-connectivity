import * as vscode from 'vscode';
import { SftpService } from '../services/sftpService';
import { HostService } from '../hostService';
import { MediaPanel } from './MediaPanel';
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
				await this._listFiles(message.payload.path, message.payload.panelId);
				break;
			}

			case 'SFTP_DOWNLOAD': {
				await this._downloadFile(message.payload.remotePath);
				break;
			}

			case 'SFTP_UPLOAD': {
				await this._uploadFile(message.payload.remotePath, message.payload.localPath);
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

			case 'SFTP_RENAME': {
				await this._renameFile(message.payload.oldPath, message.payload.newPath);
				break;
			}

			case 'SFTP_STAT': {
				await this._statFile(message.payload.path);
				break;
			}

			case 'EDIT_FILE': {
				await this._editFile(message.payload.remotePath);
				break;
			}

			case 'COPY_PATH': {
				await this._copyPath(message.payload.path);
				break;
			}

			case 'FILE_PROPERTIES': {
				await this._showFileProperties(message.payload.path);
				break;
			}

			case 'DIFF_FILES': {
				await this._diffFile(message.payload.remotePath, message.payload.localPath);
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

			case 'PREVIEW_FILE': {
				await this._previewFile(message.payload.remotePath, message.payload.fileType);
				break;
			}

			case 'EXTRACT_ARCHIVE': {
				await this._extractArchive(message.payload.archivePath);
				break;
			}

			case 'COMPRESS_FILES': {
				await this._compressFiles(message.payload.paths, message.payload.archiveName, message.payload.archiveType);
				break;
			}
		}
	}

	/**
	 * Lists files in a directory
	 */
	private async _listFiles(path: string, panelId?: 'left' | 'right'): Promise<void> {
		try {
			const files = await this._sftpService.listFiles(this._hostId, path);
			this._currentPath = path;

			this._panel.webview.postMessage({
				command: 'SFTP_LS_RESPONSE',
				payload: {
					files,
					currentPath: path,
					panelId
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
	private async _uploadFile(remotePath: string, localPath?: string): Promise<void> {
		try {
			let sourceLocalPath = localPath;

			// If no local path provided, prompt user to select file
			if (!sourceLocalPath) {
				const uris = await vscode.window.showOpenDialog({
					canSelectMany: false,
					openLabel: 'Upload'
				});

				if (!uris || uris.length === 0) {
					return;
				}

				sourceLocalPath = uris[0].fsPath;
			}

			const fileName = sourceLocalPath.split(/[\\/]/).pop() || 'file';
			const targetPath = remotePath.endsWith('/')
				? remotePath + fileName
				: remotePath + '/' + fileName;

			// Upload the file with progress
			await this._sftpService.putFile(
				this._hostId,
				sourceLocalPath,
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
	 * Renames a file or directory
	 */
	private async _renameFile(oldPath: string, newPath: string): Promise<void> {
		try {
			let targetPath = newPath;

			// If newPath is empty, prompt for new name
			if (!targetPath) {
				const oldName = oldPath.split('/').pop() || '';
				const newName = await vscode.window.showInputBox({
					prompt: 'Enter new name',
					value: oldName,
					placeHolder: oldName
				});

				if (!newName || newName === oldName) {
					return;
				}

				const parentPath = oldPath.split('/').slice(0, -1).join('/');
				targetPath = parentPath ? `${parentPath}/${newName}` : newName;
			}

			await this._sftpService.rename(this._hostId, oldPath, targetPath);
			vscode.window.showInformationMessage(`Renamed successfully`);

			// Refresh directory listing
			await this._listFiles(this._currentPath);
		} catch (error) {
			this._panel.webview.postMessage({
				command: 'SFTP_ERROR',
				payload: {
					message: `Rename failed: ${error}`
				}
			});
		}
	}

	/**
	 * Gets file stats
	 */
	private async _statFile(path: string): Promise<void> {
		try {
			const fileInfo = await this._sftpService.stat(this._hostId, path);
			this._panel.webview.postMessage({
				command: 'SFTP_STAT_RESPONSE',
				payload: {
					file: fileInfo
				}
			});
		} catch (error) {
			this._panel.webview.postMessage({
				command: 'SFTP_ERROR',
				payload: {
					message: `Stat failed: ${error}`
				}
			});
		}
	}

	/**
	 * Opens a remote file for editing (Edit-on-Fly)
	 * This will be handled by EditHandler which is injected via dependency
	 */
	private async _editFile(remotePath: string): Promise<void> {
		try {
			// Trigger the Edit-on-Fly workflow
			// The actual implementation is in the main.ts which has access to EditHandler
			vscode.commands.executeCommand('labonair.editRemoteFile', this._hostId, remotePath);
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to open file for editing: ${error}`);
		}
	}

	/**
	 * Copies a file path to clipboard
	 */
	private async _copyPath(path: string): Promise<void> {
		try {
			await vscode.env.clipboard.writeText(path);
			vscode.window.showInformationMessage(`Path copied: ${path}`);
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to copy path: ${error}`);
		}
	}

	/**
	 * Shows file properties in a dialog
	 */
	private async _showFileProperties(path: string): Promise<void> {
		try {
			const fileInfo = await this._sftpService.stat(this._hostId, path);

			const formatSize = (bytes: number): string => {
				if (bytes < 1024) return `${bytes} B`;
				if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
				return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
			};

			const message = [
				`Name: ${fileInfo.name}`,
				`Path: ${fileInfo.path}`,
				`Type: ${fileInfo.type === 'd' ? 'Directory' : fileInfo.type === 'l' ? 'Symlink' : 'File'}`,
				fileInfo.type !== 'd' ? `Size: ${formatSize(fileInfo.size)}` : null,
				`Permissions: ${fileInfo.permissions}`,
				`Owner: ${fileInfo.owner || 'unknown'}`,
				`Group: ${fileInfo.group || 'unknown'}`,
				`Modified: ${fileInfo.modTime.toLocaleString()}`,
				fileInfo.symlinkTarget ? `Target: ${fileInfo.symlinkTarget}` : null
			].filter(Boolean).join('\n');

			vscode.window.showInformationMessage(message, { modal: true });
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to get file properties: ${error}`);
		}
	}

	/**
	 * Opens a media preview panel for an image, PDF, or binary file
	 */
	private async _previewFile(remotePath: string, fileType: 'image' | 'pdf' | 'binary'): Promise<void> {
		try {
			await MediaPanel.createOrShow(
				this._extensionUri,
				this._hostId,
				remotePath,
				fileType,
				this._sftpService,
				this._hostService
			);
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to preview file: ${error}`);
		}
	}

	/**
	 * Extracts an archive on the remote server
	 */
	private async _extractArchive(archivePath: string): Promise<void> {
		try {
			const fileName = archivePath.split('/').pop() || 'archive';
			const confirm = await vscode.window.showInformationMessage(
				`Extract ${fileName}?`,
				{ modal: true },
				'Extract Here'
			);

			if (confirm !== 'Extract Here') {
				return;
			}

			vscode.window.showInformationMessage(`Extracting ${fileName}...`);

			await this._sftpService.extractRemote(this._hostId, archivePath);

			vscode.window.showInformationMessage(`Extracted ${fileName} successfully`);

			// Refresh directory listing
			await this._listFiles(this._currentPath);
		} catch (error) {
			this._panel.webview.postMessage({
				command: 'SFTP_ERROR',
				payload: {
					message: `Extraction failed: ${error}`
				}
			});
			vscode.window.showErrorMessage(`Extraction failed: ${error}`);
		}
	}

	/**
	 * Compresses files into an archive on the remote server
	 */
	private async _compressFiles(
		paths: string[],
		archiveName: string,
		archiveType: 'zip' | 'tar' | 'tar.gz'
	): Promise<void> {
		try {
			let finalArchiveName = archiveName;

			// If no archive name provided, prompt user
			if (!finalArchiveName) {
				finalArchiveName = await vscode.window.showInputBox({
					prompt: 'Enter archive name',
					placeHolder: `archive.${archiveType}`,
					value: `archive.${archiveType}`
				}) || '';

				if (!finalArchiveName) {
					return;
				}
			}

			vscode.window.showInformationMessage(`Creating archive ${finalArchiveName}...`);

			await this._sftpService.compressRemote(
				this._hostId,
				paths,
				finalArchiveName,
				archiveType
			);

			vscode.window.showInformationMessage(`Created archive ${finalArchiveName} successfully`);

			// Refresh directory listing
			await this._listFiles(this._currentPath);
		} catch (error) {
			this._panel.webview.postMessage({
				command: 'SFTP_ERROR',
				payload: {
					message: `Compression failed: ${error}`
				}
			});
			vscode.window.showErrorMessage(`Compression failed: ${error}`);
		}
	}

	/**
	 * Compares a remote file with a local file
	 */
	private async _diffFile(remotePath: string, localPath?: string): Promise<void> {
		try {
			const fileName = remotePath.split('/').pop() || 'file';

			// Download remote file to temp location
			const tempDir = require('os').tmpdir();
			const tempPath = require('path').join(tempDir, `remote_${fileName}`);

			await this._sftpService.getFile(this._hostId, remotePath, tempPath);

			let compareWithPath = localPath;

			// If no local path provided, prompt user
			if (!compareWithPath) {
				const uris = await vscode.window.showOpenDialog({
					canSelectMany: false,
					openLabel: 'Compare with',
					title: 'Select local file to compare'
				});

				if (!uris || uris.length === 0) {
					// Clean up temp file
					require('fs').unlinkSync(tempPath);
					return;
				}

				compareWithPath = uris[0].fsPath;
			}

			// Open diff view
			const remoteUri = vscode.Uri.file(tempPath);
			const localUri = vscode.Uri.file(compareWithPath);

			await vscode.commands.executeCommand(
				'vscode.diff',
				localUri,
				remoteUri,
				`Local ↔ Remote: ${fileName}`
			);
		} catch (error) {
			vscode.window.showErrorMessage(`Diff failed: ${error}`);
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
