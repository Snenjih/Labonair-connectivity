import * as vscode from 'vscode';
import { SftpService } from '../services/sftpService';
import { LocalFsService } from '../services/localFsService';
import { ClipboardService } from '../services/clipboardService';
import { StateService, FileManagerState } from '../services/stateService';
import { ArchiveService } from '../services/archiveService';
import { SyncService } from '../services/syncService';
import { HostService } from '../hostService';
import { CredentialService } from '../credentialService';
import { HostKeyService } from '../security/hostKeyService';
import { ConsoleService } from '../services/consoleService';
import { SessionTracker } from '../sessionTracker';
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
		localFsService: LocalFsService,
		clipboardService: ClipboardService,
		stateService: StateService,
		archiveService: ArchiveService,
		syncService: SyncService,
		hostService: HostService,
		credentialService: CredentialService,
		hostKeyService: HostKeyService,
		sessionTracker?: SessionTracker
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

		SftpPanel.currentPanel = new SftpPanel(panel, extensionUri, hostId, sftpService, localFsService, clipboardService, stateService, archiveService, syncService, hostService, credentialService, hostKeyService, sessionTracker);
		return SftpPanel.currentPanel;
	}

	private _consoleService: ConsoleService | undefined;

	private constructor(
		panel: vscode.WebviewPanel,
		extensionUri: vscode.Uri,
		hostId: string,
		private readonly _sftpService: SftpService,
		private readonly _localFsService: LocalFsService,
		private readonly _clipboardService: ClipboardService,
		private readonly _stateService: StateService,
		private readonly _archiveService: ArchiveService,
		private readonly _syncService: SyncService,
		private readonly _hostService: HostService,
		private readonly _credentialService: CredentialService,
		private readonly _hostKeyService: HostKeyService,
		private readonly _sessionTracker?: SessionTracker
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

		// Register with session tracker
		if (this._sessionTracker) {
			this._sessionTracker.registerPanel(this._hostId, {
				hostId: this._hostId,
				splitMode: 'none',
				type: 'sftp'
			});
		}

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
				await this._listFiles(message.payload.path, message.payload.panelId, message.payload.fileSystem);
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

			case 'SAVE_FILE_PERMISSIONS': {
				await this._saveFilePermissions(
					message.payload.path,
					message.payload.octal,
					message.payload.recursive
				);
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

			case 'OPEN_LOCAL_FILE': {
				await this._openLocalFile(message.payload.path);
				break;
			}

			// Universal Transfer Matrix Operations (Subphase 4.2)
			case 'FS_LOCAL_COPY': {
				await this._localCopy(message.payload.sourcePaths, message.payload.targetPath);
				break;
			}

			case 'FS_LOCAL_MOVE': {
				await this._localMove(message.payload.sourcePaths, message.payload.targetPath);
				break;
			}

			case 'SFTP_REMOTE_COPY': {
				await this._remoteCopy(message.payload.sourcePaths, message.payload.targetPath);
				break;
			}

			case 'SFTP_REMOTE_MOVE': {
				await this._remoteMove(message.payload.sourcePaths, message.payload.targetPath);
				break;
			}

			// Clipboard Operations (Subphase 4.2)
			case 'CLIPBOARD_COPY': {
				await this._clipboardCopy(
					message.payload.files,
					message.payload.sourceHostId,
					message.payload.system,
					message.payload.operation
				);
				break;
			}

			case 'CLIPBOARD_PASTE': {
				await this._clipboardPaste(
					message.payload.targetPath,
					message.payload.targetSystem,
					message.payload.hostId
				);
				break;
			}

			// Context-Aware Terminal (Subphase 4.2)
			case 'OPEN_TERMINAL': {
				await this._openTerminal(message.payload.path, message.payload.fileSystem);
				break;
			}

			// Panel State Persistence (Subphase 4.3)
			case 'SAVE_PANEL_STATE': {
				await this._savePanelState(message.payload.state);
				break;
			}

			case 'GET_PANEL_STATE': {
				await this._getPanelState();
				break;
			}

			// Archive Operations (Subphase 4.3)
			case 'ARCHIVE_OP': {
				await this._handleArchiveOperation(message.payload);
				break;
			}

			// Deep Search (Subphase 4.3)
			case 'SEARCH_FILES': {
				await this._handleSearch(message.payload);
				break;
			}

			// Integrated Console (Subphase 4.4)
			case 'CONSOLE_NAVIGATE': {
				await this._handleConsoleNavigate(message.payload.path, message.payload.fileSystem);
				break;
			}

			case 'CONSOLE_INPUT': {
				await this._handleConsoleInput(message.payload.data);
				break;
			}

			case 'CONSOLE_RESIZE': {
				await this._handleConsoleResize(message.payload.cols, message.payload.rows);
				break;
			}

			// Bulk Rename (Subphase 4.4)
			case 'BULK_RENAME': {
				await this._handleBulkRename(message.payload.operations, message.payload.fileSystem);
				break;
			}
		}
	}

	/**
	 * Lists files in a directory
	 */
	private async _listFiles(path: string, panelId?: 'left' | 'right', fileSystem?: 'local' | 'remote'): Promise<void> {
		try {
			let files: FileEntry[];

			// Route to appropriate service based on fileSystem
			if (fileSystem === 'local') {
				files = await this._localFsService.listFiles(path);
			} else {
				// Default to remote (SFTP)
				files = await this._sftpService.listFiles(this._hostId, path);
			}

			this._currentPath = path;

			this._panel.webview.postMessage({
				command: 'SFTP_LS_RESPONSE',
				payload: {
					files,
					currentPath: path,
					panelId,
					fileSystem
				}
			});
		} catch (error) {
			this._panel.webview.postMessage({
				command: 'SFTP_ERROR',
				payload: {
					message: `Failed to list directory: ${error}`,
					panelId
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
	 * Saves file permissions
	 */
	private async _saveFilePermissions(path: string, octal: string, recursive: boolean): Promise<void> {
		try {
			const fileName = path.split('/').pop() || 'file';

			if (recursive) {
				// Show progress for recursive permission changes
				await vscode.window.withProgress({
					location: vscode.ProgressLocation.Notification,
					title: `Changing permissions for ${fileName}...`,
					cancellable: false
				}, async (progress) => {
					await this._sftpService.chmodRecursive(
						this._hostId,
						path,
						octal,
						(current, total, itemPath) => {
							const percent = Math.round((current / total) * 100);
							progress.report({
								message: `${current}/${total} files`,
								increment: (1 / total) * 100
							});

							// Also send progress to webview
							this._panel.webview.postMessage({
								command: 'PERMISSIONS_PROGRESS',
								payload: {
									current,
									total,
									path: itemPath
								}
							});
						}
					);
				});

				vscode.window.showInformationMessage(`Permissions changed for ${fileName} and all enclosed files`);
			} else {
				// Single file/directory permission change
				await this._sftpService.chmod(this._hostId, path, octal);
				vscode.window.showInformationMessage(`Permissions changed for ${fileName}`);
			}

			// Refresh directory listing to see updated permissions
			await this._listFiles(this._currentPath);
		} catch (error) {
			this._panel.webview.postMessage({
				command: 'SFTP_ERROR',
				payload: {
					message: `Failed to change permissions: ${error}`
				}
			});
			vscode.window.showErrorMessage(`Failed to change permissions: ${error}`);
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
	 * Opens a local file in VS Code editor
	 */
	private async _openLocalFile(filePath: string): Promise<void> {
		try {
			const uri = vscode.Uri.file(filePath);
			await vscode.window.showTextDocument(uri);
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to open local file: ${error}`);
		}
	}

	// ========================================================================
	// Universal Transfer Matrix Operations (Subphase 4.2)
	// ========================================================================

	/**
	 * Copies files/directories locally (Local -> Local)
	 */
	private async _localCopy(sourcePaths: string[], targetPath: string): Promise<void> {
		try {
			for (const sourcePath of sourcePaths) {
				const fileName = sourcePath.split('/').pop() || 'file';
				const destPath = targetPath + '/' + fileName;
				await this._localFsService.copy(sourcePath, destPath);
			}
			vscode.window.showInformationMessage(`Copied ${sourcePaths.length} item(s)`);
			// Refresh directory listing
			await this._listFiles(this._currentPath);
		} catch (error) {
			vscode.window.showErrorMessage(`Local copy failed: ${error}`);
		}
	}

	/**
	 * Moves files/directories locally (Local -> Local)
	 */
	private async _localMove(sourcePaths: string[], targetPath: string): Promise<void> {
		try {
			for (const sourcePath of sourcePaths) {
				const fileName = sourcePath.split('/').pop() || 'file';
				const destPath = targetPath + '/' + fileName;
				await this._localFsService.move(sourcePath, destPath);
			}
			vscode.window.showInformationMessage(`Moved ${sourcePaths.length} item(s)`);
			// Refresh directory listing
			await this._listFiles(this._currentPath);
		} catch (error) {
			vscode.window.showErrorMessage(`Local move failed: ${error}`);
		}
	}

	/**
	 * Copies files/directories remotely (Remote -> Remote)
	 */
	private async _remoteCopy(sourcePaths: string[], targetPath: string): Promise<void> {
		try {
			for (const sourcePath of sourcePaths) {
				const fileName = sourcePath.split('/').pop() || 'file';
				const destPath = targetPath + '/' + fileName;
				await this._sftpService.copy(this._hostId, sourcePath, destPath);
			}
			vscode.window.showInformationMessage(`Copied ${sourcePaths.length} item(s)`);
			// Refresh directory listing
			await this._listFiles(this._currentPath);
		} catch (error) {
			vscode.window.showErrorMessage(`Remote copy failed: ${error}`);
		}
	}

	/**
	 * Moves files/directories remotely (Remote -> Remote)
	 */
	private async _remoteMove(sourcePaths: string[], targetPath: string): Promise<void> {
		try {
			for (const sourcePath of sourcePaths) {
				const fileName = sourcePath.split('/').pop() || 'file';
				const destPath = targetPath + '/' + fileName;
				await this._sftpService.move(this._hostId, sourcePath, destPath);
			}
			vscode.window.showInformationMessage(`Moved ${sourcePaths.length} item(s)`);
			// Refresh directory listing
			await this._listFiles(this._currentPath);
		} catch (error) {
			vscode.window.showErrorMessage(`Remote move failed: ${error}`);
		}
	}

	// ========================================================================
	// Clipboard Operations (Subphase 4.2)
	// ========================================================================

	/**
	 * Copies files to clipboard
	 */
	private async _clipboardCopy(
		files: FileEntry[],
		sourceHostId: string,
		system: 'local' | 'remote',
		operation: 'copy' | 'cut'
	): Promise<void> {
		try {
			await this._clipboardService.copy(files, sourceHostId, system, operation);
			const opLabel = operation === 'copy' ? 'Copied' : 'Cut';
			vscode.window.showInformationMessage(`${opLabel} ${files.length} item(s) to clipboard`);
		} catch (error) {
			vscode.window.showErrorMessage(`Clipboard operation failed: ${error}`);
		}
	}

	/**
	 * Pastes files from clipboard
	 */
	private async _clipboardPaste(
		targetPath: string,
		targetSystem: 'local' | 'remote',
		hostId: string
	): Promise<void> {
		try {
			const clipboard = this._clipboardService.getClipboard();
			if (!clipboard) {
				vscode.window.showInformationMessage('Clipboard is empty');
				return;
			}

			const { files, sourceHostId, system: sourceSystem, operation } = clipboard;

			// Use Universal Transfer Matrix to handle the paste operation
			const sourcePaths = files.map(f => f.path);

			if (sourceSystem === 'local' && targetSystem === 'local') {
				// Local -> Local
				if (operation === 'copy') {
					await this._localCopy(sourcePaths, targetPath);
				} else {
					await this._localMove(sourcePaths, targetPath);
					this._clipboardService.clear();
				}
			} else if (sourceSystem === 'remote' && targetSystem === 'remote') {
				// Remote -> Remote
				if (operation === 'copy') {
					await this._remoteCopy(sourcePaths, targetPath);
				} else {
					await this._remoteMove(sourcePaths, targetPath);
					this._clipboardService.clear();
				}
			} else if (sourceSystem === 'local' && targetSystem === 'remote') {
				// Local -> Remote: Upload
				for (const localPath of sourcePaths) {
					await this._uploadFile(targetPath, localPath);
				}
			} else if (sourceSystem === 'remote' && targetSystem === 'local') {
				// Remote -> Local: Download
				for (const remotePath of sourcePaths) {
					const fileName = remotePath.split('/').pop() || 'file';
					const localPath = targetPath + '/' + fileName;
					await this._sftpService.getFile(sourceHostId, remotePath, localPath);
				}
				vscode.window.showInformationMessage(`Downloaded ${sourcePaths.length} item(s)`);
			}

			// Refresh directory listing
			await this._listFiles(this._currentPath);
		} catch (error) {
			vscode.window.showErrorMessage(`Paste failed: ${error}`);
		}
	}

	// ========================================================================
	// Panel State Persistence (Subphase 4.3)
	// ========================================================================

	/**
	 * Saves the panel state to persistent storage
	 */
	private async _savePanelState(state: FileManagerState): Promise<void> {
		try {
			await this._stateService.saveState(this._hostId, state);
		} catch (error) {
			console.error('[SftpPanel] Failed to save panel state:', error);
		}
	}

	/**
	 * Retrieves and sends the saved panel state to the webview
	 */
	private async _getPanelState(): Promise<void> {
		try {
			const state = this._stateService.getState(this._hostId);
			this._panel.webview.postMessage({
				command: 'PANEL_STATE_RESPONSE',
				payload: { state }
			});
		} catch (error) {
			console.error('[SftpPanel] Failed to get panel state:', error);
			// Send empty response to trigger default initialization
			this._panel.webview.postMessage({
				command: 'PANEL_STATE_RESPONSE',
				payload: { state: undefined }
			});
		}
	}

	// ========================================================================
	// Archive Operations (Subphase 4.3)
	// ========================================================================

	/**
	 * Handles archive operations (extract/compress)
	 */
	private async _handleArchiveOperation(payload: any): Promise<void> {
		try {
			const { operation, files, fileSystem, archivePath } = payload;

			if (operation === 'extract') {
				// Extract archive
				await this._archiveService.extract(
					archivePath || files[0],
					undefined,
					fileSystem,
					fileSystem === 'remote' ? this._hostId : undefined
				);
				vscode.window.showInformationMessage(`Extracted archive successfully`);
			} else if (operation === 'compress') {
				// Prompt for archive name and type
				const archiveName = await vscode.window.showInputBox({
					prompt: 'Enter archive name',
					placeHolder: 'archive.zip',
					value: 'archive.zip'
				});

				if (!archiveName) {
					return;
				}

				// Determine archive type from extension
				let archiveType: 'zip' | 'tar' | 'tar.gz' = 'zip';
				if (archiveName.endsWith('.tar.gz') || archiveName.endsWith('.tgz')) {
					archiveType = 'tar.gz';
				} else if (archiveName.endsWith('.tar')) {
					archiveType = 'tar';
				}

				// Get target directory (same as first file's directory)
				const targetDir = files[0].substring(0, files[0].lastIndexOf('/'));
				const archiveFullPath = `${targetDir}/${archiveName}`;

				await this._archiveService.compress(
					files,
					archiveFullPath,
					archiveType,
					fileSystem,
					fileSystem === 'remote' ? this._hostId : undefined
				);
				vscode.window.showInformationMessage(`Created archive: ${archiveName}`);
			}

			// Refresh directory listing
			await this._listFiles(this._currentPath);
		} catch (error) {
			this._panel.webview.postMessage({
				command: 'SFTP_ERROR',
				payload: {
					message: `Archive operation failed: ${error}`
				}
			});
			vscode.window.showErrorMessage(`Archive operation failed: ${error}`);
		}
	}

	/**
	 * Handles deep search operations
	 */
	private async _handleSearch(payload: any): Promise<void> {
		try {
			const { path, fileSystem, pattern, content, recursive } = payload;
			let results: FileEntry[] = [];

			if (fileSystem === 'local') {
				// Local file search
				results = await this._searchLocal(path, pattern, content, recursive);
			} else {
				// Remote file search via SSH
				results = await this._searchRemote(path, pattern, content, recursive);
			}

			// Send results back to webview
			this._panel.webview.postMessage({
				command: 'SEARCH_RESULTS',
				payload: {
					results,
					searchQuery: pattern || content || 'files'
				}
			});
		} catch (error) {
			this._panel.webview.postMessage({
				command: 'SFTP_ERROR',
				payload: {
					message: `Search failed: ${error}`
				}
			});
			vscode.window.showErrorMessage(`Search failed: ${error}`);
		}
	}

	/**
	 * Search local filesystem
	 */
	private async _searchLocal(basePath: string, pattern?: string, content?: string, recursive: boolean = true): Promise<FileEntry[]> {
		const results: FileEntry[] = [];
		const fs = require('fs').promises;
		const pathModule = require('path');
		const { minimatch } = require('minimatch');

		const searchDirectory = async (dir: string) => {
			try {
				const entries = await fs.readdir(dir, { withFileTypes: true });

				for (const entry of entries) {
					const fullPath = pathModule.join(dir, entry.name);
					const relativePath = pathModule.relative(basePath, fullPath);

					// Check filename pattern match
					const patternMatches = !pattern || minimatch(entry.name, pattern);

					if (entry.isFile()) {
						let contentMatches = !content;

						// Check content match if content search is requested
						if (content && patternMatches) {
							try {
								const fileContent = await fs.readFile(fullPath, 'utf8');
								contentMatches = fileContent.includes(content);
							} catch {
								// Skip files that can't be read (binary, permissions, etc.)
								contentMatches = false;
							}
						}

						// Add to results if matches criteria
						if (patternMatches && contentMatches) {
							const stats = await fs.stat(fullPath);
							results.push({
								name: entry.name,
								path: fullPath,
								type: '-',
								size: stats.size,
								permissions: '',
								owner: '',
								group: '',
								modTime: stats.mtime
							});
						}
					} else if (entry.isDirectory() && recursive) {
						// Recursively search subdirectories
						await searchDirectory(fullPath);
					}
				}
			} catch (error) {
				// Skip directories we can't access
			}
		};

		await searchDirectory(basePath);
		return results;
	}

	/**
	 * Search remote filesystem via SSH
	 * Note: This is a simplified implementation that performs recursive directory traversal
	 * using SFTP operations. For better performance with large directories,
	 * consider implementing SSH command execution.
	 */
	private async _searchRemote(basePath: string, pattern?: string, content?: string, recursive: boolean = true): Promise<FileEntry[]> {
		const results: FileEntry[] = [];

		// Helper function to check if a filename matches the pattern
		const matchesPattern = (filename: string, pattern?: string): boolean => {
			if (!pattern) {return true;}
			const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
			return regex.test(filename);
		};

		// Recursive search function using SFTP
		const searchDirectory = async (dirPath: string) => {
			try {
				const entries = await this._sftpService.listFiles(this._hostId, dirPath, false);

				for (const entry of entries) {
					// Skip . and ..
					if (entry.name === '.' || entry.name === '..') {
						continue;
					}

					const fullPath = `${dirPath}/${entry.name}`.replace(/\/+/g, '/');

					if (entry.type === '-') {
						// It's a file - check if it matches our criteria
						const filenameMatches = matchesPattern(entry.name, pattern);

						// For content search on remote files, we'd need to download and search
						// For now, we only support filename pattern search
						// Content search would require SSH command execution or downloading files
						if (filenameMatches && !content) {
							results.push({
								name: entry.name,
								path: fullPath,
								type: '-',
								size: entry.size,
								permissions: entry.permissions,
								owner: entry.owner,
								group: entry.group,
								modTime: entry.modTime
							});
						}
					} else if (entry.type === 'd' && recursive) {
						// Recursively search subdirectories
						await searchDirectory(fullPath);
					}
				}
			} catch (error) {
				// Skip directories we can't access
			}
		};

		// If content search is requested for remote, show a message
		if (content) {
			vscode.window.showWarningMessage(
				'Content search on remote files is not yet supported. Searching by filename only.'
			);
		}

		await searchDirectory(basePath);
		return results;
	}

	// ========================================================================
	// Context-Aware Terminal (Subphase 4.2)
	// ========================================================================

	/**
	 * Opens a terminal at the specified path
	 * Context-aware: spawns Local PTY or SSH terminal based on fileSystem
	 */
	private async _openTerminal(path: string, fileSystem?: 'local' | 'remote'): Promise<void> {
		try {
			if (fileSystem === 'local') {
				// Open local terminal
				const terminal = vscode.window.createTerminal({
					cwd: path,
					name: 'Local Terminal'
				});
				terminal.show();
			} else {
				// Open remote SSH terminal
				// This requires the NavigationService or SSH terminal panel to be available
				// For now, show a message
				vscode.window.showInformationMessage(
					`Opening SSH terminal for remote path: ${path} (To be implemented with TerminalPanel integration)`
				);
				// TODO: Integrate with existing SSH terminal opening logic
				// This would typically call something like:
				// await vscode.commands.executeCommand('labonair.openTerminal', { hostId: this._hostId, path });
			}
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to open terminal: ${error}`);
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

		// Unregister from session tracker
		if (this._sessionTracker) {
			this._sessionTracker.unregisterPanel(this._hostId);
		}

		// Dispose console service
		if (this._consoleService) {
			this._consoleService.dispose();
			this._consoleService = undefined;
		}

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
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data: blob:; font-src ${webview.cspSource} data:; connect-src ${webview.cspSource} https:;">
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
	 * Handle console navigation (auto-cd when directory changes)
	 */
	private async _handleConsoleNavigate(path: string, fileSystem: 'local' | 'remote'): Promise<void> {
		try {
			const host = this._hostService.getHostById(this._hostId);
			if (!host) {
				return;
			}

			// Initialize console service if not exists
			if (!this._consoleService) {
				this._consoleService = new ConsoleService(
					this._hostId,
					host,
					this._panel.webview,
					this._hostService,
					this._credentialService,
					this._hostKeyService
				);
			}

			// Switch mode and navigate
			await this._consoleService.switchMode(fileSystem, path);
		} catch (error) {
			vscode.window.showErrorMessage(`Console navigation failed: ${error}`);
		}
	}

	/**
	 * Handle console input (user typing in terminal)
	 */
	private async _handleConsoleInput(data: string): Promise<void> {
		if (this._consoleService) {
			this._consoleService.write(data);
		}
	}

	/**
	 * Handle console resize
	 */
	private async _handleConsoleResize(cols: number, rows: number): Promise<void> {
		if (this._consoleService) {
			this._consoleService.resize(cols, rows);
		}
	}

	/**
	 * Handle bulk rename operations
	 */
	private async _handleBulkRename(operations: { oldPath: string; newPath: string }[], fileSystem: 'local' | 'remote'): Promise<void> {
		try {
			for (const op of operations) {
				if (fileSystem === 'local') {
					// Local file rename
					await this._localFsService.rename(op.oldPath, op.newPath);
				} else {
					// Remote file rename
					await this._sftpService.rename(this._hostId, op.oldPath, op.newPath);
				}
			}

			vscode.window.showInformationMessage(`Successfully renamed ${operations.length} file(s)`);
		} catch (error) {
			this._panel.webview.postMessage({
				command: 'SFTP_ERROR',
				payload: {
					message: `Bulk rename failed: ${error}`
				}
			});
			vscode.window.showErrorMessage(`Bulk rename failed: ${error}`);
		}
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
