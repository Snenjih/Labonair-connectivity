import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { SftpService } from '../services/sftpService';
import { HostService } from '../hostService';

/**
 * Media Preview Panel
 * Displays media files (images, PDFs) and binary files from remote hosts
 */
export class MediaPanel {
	private static activePanels: Map<string, MediaPanel> = new Map();

	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private readonly _hostId: string;
	private readonly _remotePath: string;
	private readonly _fileType: 'image' | 'pdf' | 'binary';
	private _localTempPath: string | null = null;
	private _disposables: vscode.Disposable[] = [];

	/**
	 * Creates or shows a media preview panel
	 */
	public static async createOrShow(
		extensionUri: vscode.Uri,
		hostId: string,
		remotePath: string,
		fileType: 'image' | 'pdf' | 'binary',
		sftpService: SftpService,
		hostService: HostService
	): Promise<MediaPanel> {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		// Use remote path as unique key
		const panelKey = `${hostId}:${remotePath}`;

		// If panel already exists, reveal it
		const existingPanel = MediaPanel.activePanels.get(panelKey);
		if (existingPanel) {
			existingPanel._panel.reveal(column);
			return existingPanel;
		}

		// Create new panel
		const fileName = remotePath.split('/').pop() || 'preview';
		const panel = vscode.window.createWebviewPanel(
			'labonairMediaPreview',
			`Preview: ${fileName}`,
			column || vscode.ViewColumn.One,
			{
				enableScripts: true,
				localResourceRoots: [
					extensionUri,
					vscode.Uri.file(os.tmpdir())
				],
				retainContextWhenHidden: true
			}
		);

		const mediaPanel = new MediaPanel(
			panel,
			extensionUri,
			hostId,
			remotePath,
			fileType,
			sftpService,
			hostService
		);

		MediaPanel.activePanels.set(panelKey, mediaPanel);

		return mediaPanel;
	}

	private constructor(
		panel: vscode.WebviewPanel,
		extensionUri: vscode.Uri,
		hostId: string,
		remotePath: string,
		fileType: 'image' | 'pdf' | 'binary',
		private readonly _sftpService: SftpService,
		private readonly _hostService: HostService
	) {
		this._panel = panel;
		this._extensionUri = extensionUri;
		this._hostId = hostId;
		this._remotePath = remotePath;
		this._fileType = fileType;

		// Listen for panel disposal
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		// Load and preview the file
		this._loadAndPreview();
	}

	/**
	 * Downloads the remote file and displays preview
	 */
	private async _loadAndPreview(): Promise<void> {
		try {
			// Show loading state
			this._panel.webview.html = this._getLoadingHtml();

			// Download file to temp directory
			const fileName = this._remotePath.split('/').pop() || 'file';
			const tempDir = os.tmpdir();
			const tempPath = path.join(tempDir, `labonair_preview_${Date.now()}_${fileName}`);

			await this._sftpService.getFile(
				this._hostId,
				this._remotePath,
				tempPath
			);

			this._localTempPath = tempPath;

			// Get file stats
			const stats = fs.statSync(tempPath);
			const fileSize = stats.size;

			// Display preview based on file type
			switch (this._fileType) {
				case 'image':
					this._panel.webview.html = this._getImagePreviewHtml(tempPath, fileName);
					break;
				case 'pdf':
					this._panel.webview.html = this._getPdfPreviewHtml(tempPath, fileName);
					break;
				case 'binary':
					this._panel.webview.html = this._getBinaryInfoHtml(fileName, fileSize);
					break;
			}

		} catch (error: any) {
			this._panel.webview.html = this._getErrorHtml(error.message || 'Failed to load file');
		}
	}

	/**
	 * Generates loading HTML
	 */
	private _getLoadingHtml(): string {
		return `<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<style>
				body {
					display: flex;
					align-items: center;
					justify-content: center;
					height: 100vh;
					margin: 0;
					background: var(--vscode-editor-background);
					color: var(--vscode-editor-foreground);
					font-family: var(--vscode-font-family);
				}
				.loading {
					text-align: center;
				}
				.spinner {
					border: 3px solid var(--vscode-editorWidget-background);
					border-top: 3px solid var(--vscode-progressBar-background);
					border-radius: 50%;
					width: 40px;
					height: 40px;
					animation: spin 1s linear infinite;
					margin: 0 auto 16px;
				}
				@keyframes spin {
					0% { transform: rotate(0deg); }
					100% { transform: rotate(360deg); }
				}
			</style>
		</head>
		<body>
			<div class="loading">
				<div class="spinner"></div>
				<div>Loading preview...</div>
			</div>
		</body>
		</html>`;
	}

	/**
	 * Generates image preview HTML
	 */
	private _getImagePreviewHtml(localPath: string, fileName: string): string {
		const imageUri = this._panel.webview.asWebviewUri(vscode.Uri.file(localPath));

		return `<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Image Preview: ${fileName}</title>
			<style>
				body {
					margin: 0;
					padding: 20px;
					background: var(--vscode-editor-background);
					color: var(--vscode-editor-foreground);
					font-family: var(--vscode-font-family);
					display: flex;
					flex-direction: column;
					align-items: center;
					justify-content: center;
					min-height: 100vh;
				}
				.header {
					margin-bottom: 16px;
					font-size: 14px;
					color: var(--vscode-descriptionForeground);
				}
				.image-container {
					max-width: 100%;
					max-height: 80vh;
					display: flex;
					align-items: center;
					justify-content: center;
					overflow: auto;
				}
				img {
					max-width: 100%;
					max-height: 80vh;
					object-fit: contain;
					border: 1px solid var(--vscode-panel-border);
					border-radius: 4px;
					cursor: zoom-in;
				}
				img.zoomed {
					max-width: none;
					max-height: none;
					cursor: zoom-out;
				}
			</style>
		</head>
		<body>
			<div class="header">${fileName}</div>
			<div class="image-container">
				<img src="${imageUri}" alt="${fileName}" id="preview-image" />
			</div>
			<script>
				const img = document.getElementById('preview-image');
				img.addEventListener('click', () => {
					img.classList.toggle('zoomed');
				});
			</script>
		</body>
		</html>`;
	}

	/**
	 * Generates PDF preview HTML
	 */
	private _getPdfPreviewHtml(localPath: string, fileName: string): string {
		const pdfUri = this._panel.webview.asWebviewUri(vscode.Uri.file(localPath));

		return `<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>PDF Preview: ${fileName}</title>
			<style>
				body {
					margin: 0;
					padding: 0;
					background: var(--vscode-editor-background);
					height: 100vh;
					display: flex;
					flex-direction: column;
				}
				.header {
					padding: 12px 20px;
					background: var(--vscode-sideBar-background);
					border-bottom: 1px solid var(--vscode-panel-border);
					color: var(--vscode-foreground);
					font-family: var(--vscode-font-family);
					font-size: 13px;
				}
				iframe {
					flex: 1;
					border: none;
					width: 100%;
				}
			</style>
		</head>
		<body>
			<div class="header">${fileName}</div>
			<iframe src="${pdfUri}" type="application/pdf"></iframe>
		</body>
		</html>`;
	}

	/**
	 * Generates binary file info HTML
	 */
	private _getBinaryInfoHtml(fileName: string, fileSize: number): string {
		const formatBytes = (bytes: number): string => {
			if (bytes < 1024) return `${bytes} B`;
			if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
			if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
			return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
		};

		return `<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Binary File: ${fileName}</title>
			<style>
				body {
					margin: 0;
					padding: 40px;
					background: var(--vscode-editor-background);
					color: var(--vscode-editor-foreground);
					font-family: var(--vscode-font-family);
					display: flex;
					align-items: center;
					justify-content: center;
					min-height: 100vh;
				}
				.info-container {
					text-align: center;
					max-width: 500px;
				}
				.icon {
					font-size: 64px;
					margin-bottom: 24px;
				}
				.title {
					font-size: 18px;
					font-weight: 500;
					margin-bottom: 8px;
				}
				.filename {
					font-size: 14px;
					color: var(--vscode-descriptionForeground);
					margin-bottom: 24px;
					word-break: break-all;
				}
				.size {
					font-size: 13px;
					color: var(--vscode-descriptionForeground);
					margin-bottom: 24px;
				}
				.message {
					font-size: 12px;
					color: var(--vscode-descriptionForeground);
					line-height: 1.6;
				}
			</style>
		</head>
		<body>
			<div class="info-container">
				<div class="icon">📦</div>
				<div class="title">Binary File</div>
				<div class="filename">${fileName}</div>
				<div class="size">${formatBytes(fileSize)}</div>
				<div class="message">
					This is a binary file that cannot be previewed directly.<br>
					Use the SFTP File Manager to download it to your local system.
				</div>
			</div>
		</body>
		</html>`;
	}

	/**
	 * Generates error HTML
	 */
	private _getErrorHtml(errorMessage: string): string {
		return `<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<style>
				body {
					margin: 0;
					padding: 40px;
					background: var(--vscode-editor-background);
					color: var(--vscode-editor-foreground);
					font-family: var(--vscode-font-family);
					display: flex;
					align-items: center;
					justify-content: center;
					min-height: 100vh;
				}
				.error-container {
					text-align: center;
					max-width: 500px;
				}
				.icon {
					font-size: 64px;
					margin-bottom: 24px;
				}
				.title {
					font-size: 18px;
					font-weight: 500;
					margin-bottom: 16px;
					color: var(--vscode-errorForeground);
				}
				.message {
					font-size: 13px;
					color: var(--vscode-descriptionForeground);
					line-height: 1.6;
				}
			</style>
		</head>
		<body>
			<div class="error-container">
				<div class="icon">⚠️</div>
				<div class="title">Failed to Load Preview</div>
				<div class="message">${errorMessage}</div>
			</div>
		</body>
		</html>`;
	}

	/**
	 * Disposes the panel and cleans up resources
	 */
	public dispose(): void {
		const panelKey = `${this._hostId}:${this._remotePath}`;
		MediaPanel.activePanels.delete(panelKey);

		// Clean up temp file
		if (this._localTempPath && fs.existsSync(this._localTempPath)) {
			try {
				fs.unlinkSync(this._localTempPath);
			} catch (error) {
				console.error('Failed to delete temp file:', error);
			}
		}

		// Dispose panel
		this._panel.dispose();

		// Dispose subscriptions
		while (this._disposables.length) {
			const disposable = this._disposables.pop();
			if (disposable) {
				disposable.dispose();
			}
		}
	}
}
