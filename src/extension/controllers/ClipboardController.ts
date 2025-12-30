// ============================================================================
// CLIPBOARD CONTROLLER
// Handles clipboard operations for file copy/paste across local and remote systems
// ============================================================================

import * as vscode from 'vscode';
import { BaseController } from './BaseController';
import { ClipboardService } from '../services/clipboardService';
import { TransferService } from '../services/transferService';
import { LocalFsService } from '../services/localFsService';
import { FileEntry } from '../../common/types';

/**
 * Clipboard Controller
 * Manages clipboard operations and integrates with OS clipboard
 */
export class ClipboardController extends BaseController {
	constructor(
		context: vscode.ExtensionContext,
		private readonly clipboardService: ClipboardService,
		private readonly transferService: TransferService,
		private readonly localFsService: LocalFsService
	) {
		super(context);
	}

	/**
	 * Copies files to clipboard
	 * - For local files: Writes file paths to OS clipboard
	 * - For remote files: Stores in internal clipboard only
	 */
	async copy(
		files: FileEntry[],
		sourceHostId: string,
		system: 'local' | 'remote',
		operation: 'copy' | 'cut'
	): Promise<void> {
		// Store in internal clipboard
		await this.clipboardService.copy(files, sourceHostId, system, operation);

		// Also write to OS clipboard for external paste
		if (system === 'local') {
			// For local files, write file:// URIs to clipboard
			const filePaths = files.map(f => f.path).join('\n');
			await vscode.env.clipboard.writeText(filePaths);
			this.log(`Copied ${files.length} local file(s) to clipboard`);
		} else {
			// For remote files, write paths as text (not usable in OS file manager)
			const remotePaths = files.map(f => `${sourceHostId}:${f.path}`).join('\n');
			await vscode.env.clipboard.writeText(remotePaths);
			this.log(`Copied ${files.length} remote file(s) to internal clipboard`);
		}

		this.showInfo(`${operation === 'cut' ? 'Cut' : 'Copied'} ${files.length} file(s)`);
	}

	/**
	 * Pastes files from clipboard to target location
	 * Handles:
	 * - Local -> Local: fs.copy
	 * - Local -> Remote: TransferService.upload
	 * - Remote -> Local: TransferService.download
	 * - Remote -> Remote: SFTP copy/move
	 * - OS Clipboard -> Target: Parse file paths and upload
	 */
	async paste(
		targetPath: string,
		targetSystem: 'local' | 'remote',
		hostId: string
	): Promise<void> {
		// First check internal clipboard
		const clipboardState = this.clipboardService.getClipboard();

		if (clipboardState && clipboardState.files.length > 0) {
			// Internal clipboard has content
			const { files, sourceHostId, system: sourceSystem, operation } = clipboardState;

			this.log(`Pasting ${files.length} files from ${sourceSystem} to ${targetSystem}`);

			// Determine transfer type
			if (sourceSystem === 'local' && targetSystem === 'local') {
				// Local -> Local: Use fs operations
				for (const file of files) {
					const fileName = file.name;
					const destPath = `${targetPath}/${fileName}`;

					if (operation === 'copy') {
						await this.localFsService.copy(file.path, destPath);
					} else {
						await this.localFsService.move(file.path, destPath);
					}
				}
			} else if (sourceSystem === 'local' && targetSystem === 'remote') {
				// Local -> Remote: Upload
				for (const file of files) {
					const remotePath = `${targetPath}/${file.name}`;
					this.transferService.addJob({
						type: 'upload',
						hostId,
						localPath: file.path,
						remotePath
					});
				}
			} else if (sourceSystem === 'remote' && targetSystem === 'local') {
				// Remote -> Local: Download
				for (const file of files) {
					const localPath = `${targetPath}/${file.name}`;
					this.transferService.addJob({
						type: 'download',
						hostId: sourceHostId,
						remotePath: file.path,
						localPath
					});
				}
			} else {
				// Remote -> Remote: Handle via SFTP controller
				// This would require access to SftpController, so we'll indicate it needs higher-level handling
				throw new Error('Remote to remote copy/move should be handled by SFTP operations');
			}

			// Clear clipboard if it was a cut operation
			if (operation === 'cut') {
				this.clipboardService.clear();
			}

			this.showInfo(`Pasted ${files.length} file(s)`);
		} else {
			// Try reading from OS clipboard
			const osClipboardText = await vscode.env.clipboard.readText();

			if (!osClipboardText || osClipboardText.trim() === '') {
				this.showWarning('Clipboard is empty');
				return;
			}

			// Parse clipboard text - could be file paths
			const paths = osClipboardText.split('\n').map(p => p.trim()).filter(p => p.length > 0);

			if (paths.length === 0) {
				this.showWarning('No valid file paths in clipboard');
				return;
			}

			// Attempt to paste from OS clipboard
			// These are likely local file paths
			if (targetSystem === 'remote') {
				// Upload local files from clipboard to remote
				for (const localPath of paths) {
					try {
						// Check if path exists locally
						const stats = await this.localFsService.stat(localPath);
						const remotePath = `${targetPath}/${stats.name}`;
						this.transferService.addJob({
							type: 'upload',
							hostId,
							localPath,
							remotePath
						});
					} catch (error) {
						this.log(`Failed to process clipboard path ${localPath}: ${error}`);
					}
				}
				this.showInfo(`Uploading ${paths.length} file(s) from OS clipboard`);
			} else {
				// Copy local files to local target
				for (const sourcePath of paths) {
					try {
						const stats = await this.localFsService.stat(sourcePath);
						const destPath = `${targetPath}/${stats.name}`;
						await this.localFsService.copy(sourcePath, destPath);
					} catch (error) {
						this.log(`Failed to copy file from ${sourcePath}: ${error}`);
					}
				}
				this.showInfo(`Copied ${paths.length} file(s) from OS clipboard`);
			}
		}
	}

	/**
	 * Gets current clipboard state
	 */
	getClipboardState() {
		return this.clipboardService.getClipboard();
	}

	/**
	 * Clears the clipboard
	 */
	clear(): void {
		this.clipboardService.clear();
		this.log('Clipboard cleared');
	}
}
