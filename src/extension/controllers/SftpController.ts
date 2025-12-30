// ============================================================================
// SFTP CONTROLLER
// Handles all SFTP and file system operations
// ============================================================================

import * as vscode from 'vscode';
import { BaseController } from './BaseController';
import { SftpService } from '../services/sftpService';
import { LocalFsService } from '../services/localFsService';
import { ClipboardService } from '../services/clipboardService';
import { ArchiveService } from '../services/archiveService';
import { BookmarkService } from '../services/bookmarkService';
import { DiskSpaceService } from '../services/diskSpaceService';
import { FileEntry, Bookmark, DiskSpaceInfo } from '../../common/types';

/**
 * SFTP Controller
 * Manages SFTP and local file system operations
 */
export class SftpController extends BaseController {
	constructor(
		context: vscode.ExtensionContext,
		private readonly sftpService: SftpService,
		private readonly localFsService: LocalFsService,
		private readonly clipboardService: ClipboardService,
		private readonly archiveService: ArchiveService,
		private readonly bookmarkService: BookmarkService,
		private readonly diskSpaceService: DiskSpaceService
	) {
		super(context);
	}

	/**
	 * Lists files in a directory
	 */
	async listFiles(
		hostId: string,
		path: string,
		panelId?: 'left' | 'right',
		fileSystem?: 'local' | 'remote'
	): Promise<{
		files: FileEntry[];
		currentPath: string;
		panelId?: 'left' | 'right';
		fileSystem?: 'local' | 'remote';
	}> {
		let files: FileEntry[];

		if (fileSystem === 'local') {
			files = await this.localFsService.listFiles(path);
		} else {
			files = await this.sftpService.listFiles(hostId, path);
		}

		return { files, currentPath: path, panelId, fileSystem };
	}

	/**
	 * Gets file stats
	 */
	async stat(hostId: string, path: string, fileSystem?: 'local' | 'remote'): Promise<FileEntry> {
		if (fileSystem === 'local') {
			return await this.localFsService.stat(path);
		} else {
			return await this.sftpService.stat(hostId, path);
		}
	}

	/**
	 * Uploads a file
	 */
	async upload(hostId: string, remotePath: string, localPath?: string, fileSystem?: 'local' | 'remote'): Promise<void> {
		// This is handled by transfer service
		this.log(`Upload requested: ${localPath} -> ${remotePath}`);
	}

	/**
	 * Downloads a file
	 */
	async download(hostId: string, remotePath: string, localPath?: string, fileSystem?: 'local' | 'remote'): Promise<void> {
		// This is handled by transfer service
		this.log(`Download requested: ${remotePath} -> ${localPath}`);
	}

	/**
	 * Deletes a file or directory
	 */
	async remove(hostId: string, path: string, fileSystem?: 'local' | 'remote'): Promise<void> {
		if (fileSystem === 'local') {
			await this.localFsService.delete(path);
		} else {
			await this.sftpService.delete(hostId, path);
		}
		this.log(`Deleted: ${path}`);
	}

	/**
	 * Creates a directory
	 */
	async mkdir(hostId: string, path: string, fileSystem?: 'local' | 'remote'): Promise<void> {
		if (fileSystem === 'local') {
			await this.localFsService.mkdir(path);
		} else {
			await this.sftpService.mkdir(hostId, path);
		}
		this.log(`Created directory: ${path}`);
	}

	/**
	 * Renames a file or directory
	 */
	async rename(hostId: string, oldPath: string, newPath: string, fileSystem?: 'local' | 'remote'): Promise<void> {
		if (fileSystem === 'local') {
			await this.localFsService.rename(oldPath, newPath);
		} else {
			await this.sftpService.rename(hostId, oldPath, newPath);
		}
		this.log(`Renamed: ${oldPath} -> ${newPath}`);
	}

	/**
	 * Moves files
	 */
	async move(
		hostId: string,
		sourcePaths: string[],
		targetPath: string,
		sourcePanel?: 'left' | 'right',
		fileSystem?: 'local' | 'remote'
	): Promise<void> {
		if (fileSystem === 'local') {
			// Move each file individually using the service's move method
			for (const sourcePath of sourcePaths) {
				const fileName = sourcePath.split('/').pop() || '';
				const newPath = `${targetPath}/${fileName}`;
				await this.localFsService.move(sourcePath, newPath);
			}
		} else {
			// Remote move - implement via SFTP service
			for (const sourcePath of sourcePaths) {
				const fileName = sourcePath.split('/').pop() || '';
				const newPath = `${targetPath}/${fileName}`;
				await this.sftpService.rename(hostId, sourcePath, newPath);
			}
		}
		this.log(`Moved ${sourcePaths.length} files to: ${targetPath}`);
	}

	/**
	 * Creates a new file
	 */
	async newFile(hostId: string, path: string, fileSystem?: 'local' | 'remote'): Promise<void> {
		if (fileSystem === 'local') {
			await this.localFsService.writeFile(path, '');
		} else {
			// Create empty file remotely - need to create a temp file first
			const fs = require('fs');
			const os = require('os');
			const pathModule = require('path');
			const tmpPath = pathModule.join(os.tmpdir(), `empty_${Date.now()}.txt`);
			fs.writeFileSync(tmpPath, '');
			await this.sftpService.putFile(hostId, tmpPath, path);
			fs.unlinkSync(tmpPath);
		}
		this.log(`Created file: ${path}`);
	}

	/**
	 * Copies files remotely (server-side copy)
	 */
	async remoteCopy(hostId: string, sourcePaths: string[], targetPath: string): Promise<void> {
		for (const sourcePath of sourcePaths) {
			const fileName = sourcePath.split('/').pop() || '';
			const newPath = `${targetPath}/${fileName}`;
			await this.sftpService.copy(hostId, sourcePath, newPath);
		}
		this.log(`Copied ${sourcePaths.length} files to: ${targetPath}`);
	}

	/**
	 * Moves files remotely (server-side move)
	 */
	async remoteMove(hostId: string, sourcePaths: string[], targetPath: string): Promise<void> {
		for (const sourcePath of sourcePaths) {
			const fileName = sourcePath.split('/').pop() || '';
			const newPath = `${targetPath}/${fileName}`;
			await this.sftpService.rename(hostId, sourcePath, newPath);
		}
		this.log(`Moved ${sourcePaths.length} files to: ${targetPath}`);
	}

	/**
	 * Resolves a symlink
	 */
	async resolveSymlink(
		hostId: string,
		symlinkPath: string,
		panelId?: 'left' | 'right',
		fileSystem?: 'local' | 'remote'
	): Promise<{ targetPath: string }> {
		// TODO: Implement symlink resolution
		// For now, just return the path as-is
		this.log(`Symlink resolution not yet implemented: ${symlinkPath}`);
		return { targetPath: symlinkPath };
	}

	/**
	 * Copies files locally
	 */
	async localCopy(sourcePaths: string[], targetPath: string): Promise<void> {
		// Copy each file individually
		for (const sourcePath of sourcePaths) {
			const fileName = sourcePath.split('/').pop() || '';
			const newPath = `${targetPath}/${fileName}`;
			await this.localFsService.copy(sourcePath, newPath);
		}
		this.log(`Local copy: ${sourcePaths.length} files to ${targetPath}`);
	}

	/**
	 * Moves files locally
	 */
	async localMove(sourcePaths: string[], targetPath: string): Promise<void> {
		// Move each file individually
		for (const sourcePath of sourcePaths) {
			const fileName = sourcePath.split('/').pop() || '';
			const newPath = `${targetPath}/${fileName}`;
			await this.localFsService.move(sourcePath, newPath);
		}
		this.log(`Local move: ${sourcePaths.length} files to ${targetPath}`);
	}

	/**
	 * Opens a local file
	 */
	async openLocalFile(path: string): Promise<void> {
		const uri = vscode.Uri.file(path);
		await vscode.commands.executeCommand('vscode.open', uri);
	}

	/**
	 * Clipboard copy
	 */
	async clipboardCopy(
		files: FileEntry[],
		sourceHostId: string,
		system: 'local' | 'remote',
		operation: 'copy' | 'cut'
	): Promise<void> {
		this.clipboardService.copy(files, sourceHostId, system, operation);
		this.log(`Clipboard ${operation}: ${files.length} files`);
	}

	/**
	 * Clipboard paste
	 */
	async clipboardPaste(targetPath: string, targetSystem: 'local' | 'remote', hostId: string): Promise<void> {
		// TODO: Implement clipboard paste
		this.log(`Clipboard paste not yet implemented: ${targetPath}`);
	}

	/**
	 * Extracts an archive
	 */
	async extractArchive(hostId: string, archivePath: string, fileSystem: 'local' | 'remote'): Promise<void> {
		await this.archiveService.extract(archivePath, undefined, fileSystem, hostId);
		this.showInfo(`Archive extracted: ${archivePath}`);
	}

	/**
	 * Compresses files into an archive
	 */
	async compressFiles(
		hostId: string,
		paths: string[],
		archiveName: string,
		archiveType: 'zip' | 'tar' | 'tar.gz',
		fileSystem: 'local' | 'remote'
	): Promise<void> {
		await this.archiveService.compress(paths, archiveName, archiveType, fileSystem, hostId);
		this.showInfo(`Archive created: ${archiveName}`);
	}

	/**
	 * Searches files
	 */
	async searchFiles(
		hostId: string,
		path: string,
		fileSystem: 'local' | 'remote',
		pattern?: string,
		content?: string,
		recursive: boolean = true
	): Promise<{ results: FileEntry[] }> {
		// TODO: Implement file search
		this.log(`File search not yet implemented: ${path}`);
		return { results: [] };
	}

	/**
	 * Lists bookmarks
	 */
	async listBookmarks(hostId: string): Promise<Bookmark[]> {
		return this.bookmarkService.getBookmarks(hostId);
	}

	/**
	 * Adds a bookmark
	 */
	async addBookmark(bookmark: Omit<Bookmark, 'id' | 'createdAt'>): Promise<void> {
		const { v4: uuid } = require('uuid');
		const newBookmark: Bookmark = {
			...bookmark,
			id: uuid(),
			createdAt: Date.now()
		};
		await this.bookmarkService.addBookmark(bookmark.hostId || 'local', newBookmark);
		this.log(`Bookmark added: ${bookmark.label}`);
	}

	/**
	 * Removes a bookmark
	 */
	async removeBookmark(bookmarkId: string, hostId: string): Promise<void> {
		await this.bookmarkService.removeBookmark(hostId, bookmarkId);
		this.log(`Bookmark removed: ${bookmarkId}`);
	}

	/**
	 * Gets disk space information
	 */
	async getDiskSpace(hostId: string, path: string, fileSystem: 'local' | 'remote'): Promise<DiskSpaceInfo> {
		return await this.diskSpaceService.getDiskSpace(hostId, path, fileSystem);
	}

	/**
	 * Opens file in system explorer
	 */
	async openInExplorer(hostId: string, path: string, fileSystem: 'local' | 'remote'): Promise<void> {
		if (fileSystem === 'local') {
			const uri = vscode.Uri.file(path);
			await vscode.commands.executeCommand('revealFileInOS', uri);
		} else {
			// For remote files, download to temp and reveal
			const tempPath = require('path').join(require('os').tmpdir(), require('path').basename(path));
			await this.sftpService.getFile(hostId, path, tempPath);
			const uri = vscode.Uri.file(tempPath);
			await vscode.commands.executeCommand('revealFileInOS', uri);
		}
	}

	/**
	 * Opens file with default application
	 */
	async openWithDefault(hostId: string, path: string, fileSystem: 'local' | 'remote'): Promise<void> {
		if (fileSystem === 'local') {
			const uri = vscode.Uri.file(path);
			await vscode.env.openExternal(uri);
		} else {
			// For remote files, download to temp and open
			const tempPath = require('path').join(require('os').tmpdir(), require('path').basename(path));
			await this.sftpService.getFile(hostId, path, tempPath);
			const uri = vscode.Uri.file(tempPath);
			await vscode.env.openExternal(uri);
		}
	}

	/**
	 * Calculates file checksum
	 */
	async calculateChecksum(
		hostId: string,
		path: string,
		fileSystem: 'local' | 'remote',
		algorithm: 'md5' | 'sha1' | 'sha256'
	): Promise<{ checksum: string; algorithm: string; filename: string }> {
		let checksum: string;
		const filename = require('path').basename(path);

		if (fileSystem === 'local') {
			checksum = await this.localFsService.calculateChecksum(path, algorithm);
		} else {
			checksum = await this.sftpService.calculateChecksum(hostId, path, algorithm);
		}

		return { checksum, algorithm, filename };
	}

	/**
	 * Copies path to clipboard
	 */
	async copyPath(path: string, type: 'name' | 'fullPath' | 'url', hostId?: string): Promise<void> {
		let textToCopy: string;

		if (type === 'name') {
			textToCopy = require('path').basename(path);
		} else if (type === 'fullPath') {
			textToCopy = path;
		} else if (type === 'url' && hostId) {
			// Need to get host info - this would require HostService
			textToCopy = `sftp://${hostId}${path}`;
		} else {
			textToCopy = path;
		}

		await vscode.env.clipboard.writeText(textToCopy);
		this.showInfo(`Copied to clipboard: ${textToCopy}`);
	}

	/**
	 * Creates a symbolic link
	 */
	async createSymlink(hostId: string, sourcePath: string, targetPath: string, fileSystem: 'local' | 'remote'): Promise<void> {
		if (fileSystem === 'local') {
			await this.localFsService.createSymlink(sourcePath, targetPath);
		} else {
			await this.sftpService.createSymlink(hostId, sourcePath, targetPath);
		}
		this.showInfo(`Symbolic link created successfully`);
	}

	/**
	 * Bulk rename files
	 */
	async bulkRename(
		hostId: string,
		operations: { oldPath: string; newPath: string }[],
		fileSystem: 'local' | 'remote'
	): Promise<void> {
		for (const { oldPath, newPath } of operations) {
			if (fileSystem === 'local') {
				await this.localFsService.rename(oldPath, newPath);
			} else {
				await this.sftpService.rename(hostId, oldPath, newPath);
			}
		}
		this.showInfo(`Renamed ${operations.length} files`);
	}
}
