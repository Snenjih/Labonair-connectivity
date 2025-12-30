import * as vscode from 'vscode';
import * as path from 'path';
import { minimatch } from 'minimatch';
import { SftpService } from './sftpService';
import { LocalFsService } from './localFsService';
import { TransferService } from './transferService';
import { FileEntry, SyncItem, SyncOptions, SyncDirection, SyncAction, SelectionCriteria } from '../../common/types';
import { getLogger } from '../utils/logger';

/**
 * SyncService
 * Handles directory synchronization between local and remote file systems
 */
export class SyncService {
	private logger = getLogger();

	constructor(
		private sftpService: SftpService,
		private localFsService: LocalFsService,
		private transferService: TransferService
	) {}

	/**
	 * Compare two directories and generate sync items
	 */
	public async comparePaths(
		hostId: string,
		leftPath: string,
		leftSystem: 'local' | 'remote',
		rightPath: string,
		rightSystem: 'local' | 'remote',
		options: SyncOptions,
		progressCallback?: (message: string) => void
	): Promise<SyncItem[]> {
		this.logger.info(`Starting sync comparison: ${leftPath} (${leftSystem}) <-> ${rightPath} (${rightSystem})`);

		try {
			// Get file listings from both sides
			progressCallback?.('Loading left directory...');
			const leftFiles = await this.getFileList(hostId, leftPath, leftSystem, true);

			progressCallback?.('Loading right directory...');
			const rightFiles = await this.getFileList(hostId, rightPath, rightSystem, true);

			// Build file maps for faster lookups
			const leftMap = new Map<string, FileEntry>();
			const rightMap = new Map<string, FileEntry>();

			// Apply include/exclude filters
			const filteredLeftFiles = this.filterFiles(leftFiles, options);
			const filteredRightFiles = this.filterFiles(rightFiles, options);

			for (const file of filteredLeftFiles) {
				const relativePath = path.relative(leftPath, file.path);
				leftMap.set(relativePath, file);
			}

			for (const file of filteredRightFiles) {
				const relativePath = path.relative(rightPath, file.path);
				rightMap.set(relativePath, file);
			}

			progressCallback?.('Comparing files...');
			const syncItems: SyncItem[] = [];

			// Get all unique file paths
			const allPaths = new Set([...leftMap.keys(), ...rightMap.keys()]);

			for (const relativePath of allPaths) {
				const leftFile = leftMap.get(relativePath);
				const rightFile = rightMap.get(relativePath);

				const syncItem = this.compareFiles(
					leftFile,
					rightFile,
					relativePath,
					leftPath,
					rightPath,
					options
				);

				if (syncItem) {
					syncItems.push(syncItem);
				}
			}

			this.logger.info(`Comparison complete: ${syncItems.length} differences found`);
			return syncItems;
		} catch (error) {
			this.logger.error('Sync comparison failed', error as Error);
			throw error;
		}
	}

	/**
	 * Execute synchronization based on sync items
	 */
	public async executeSynchronization(
		hostId: string,
		items: SyncItem[],
		progressCallback?: (current: number, total: number, currentFile: string) => void
	): Promise<void> {
		this.logger.info(`Starting synchronization: ${items.length} operations`);

		let completed = 0;
		const total = items.length;

		for (const item of items) {
			if (item.action === 'skip') {
				completed++;
				continue;
			}

			progressCallback?.(completed, total, item.name);

			try {
				await this.executeSyncItem(hostId, item);
				completed++;
				this.logger.debug(`Completed: ${item.name}`);
			} catch (error) {
				this.logger.error(`Failed to sync ${item.name}`, error as Error);
				throw error;
			}
		}

		this.logger.info('Synchronization complete');
	}

	/**
	 * Advanced file selection based on criteria
	 */
	public async advancedSelect(
		hostId: string,
		basePath: string,
		fileSystem: 'local' | 'remote',
		criteria: SelectionCriteria
	): Promise<string[]> {
		this.logger.info(`Advanced select in ${basePath} (${fileSystem})`);

		try {
			// Get file list
			const files = await this.getFileList(hostId, basePath, fileSystem, criteria.recursive);

			// Apply filters
			const selectedFiles = files.filter(file => {
				// Pattern filter
				if (criteria.pattern && !minimatch(file.name, criteria.pattern)) {
					return false;
				}

				// Date filters
				if (criteria.newerThan && file.modTime < criteria.newerThan) {
					return false;
				}
				if (criteria.olderThan && file.modTime > criteria.olderThan) {
					return false;
				}

				// Size filters
				if (criteria.minSize && file.size < criteria.minSize) {
					return false;
				}
				if (criteria.maxSize && file.size > criteria.maxSize) {
					return false;
				}

				return true;
			});

			// Content filter (requires reading files)
			if (criteria.contentContains) {
				const contentMatches: string[] = [];
				for (const file of selectedFiles) {
					if (file.type === '-') {  // Only check files, not directories
						try {
							const hasContent = await this.fileContainsText(
								hostId,
								file.path,
								fileSystem,
								criteria.contentContains
							);
							if (hasContent) {
								contentMatches.push(file.path);
							}
						} catch (error) {
							this.logger.debug(`Could not search content in ${file.path}: ${error}`);
						}
					}
				}
				return contentMatches;
			}

			return selectedFiles.map(f => f.path);
		} catch (error) {
			this.logger.error('Advanced select failed', error as Error);
			throw error;
		}
	}

	/**
	 * Get file list from local or remote system
	 */
	private async getFileList(
		hostId: string,
		basePath: string,
		fileSystem: 'local' | 'remote',
		recursive: boolean
	): Promise<FileEntry[]> {
		const files: FileEntry[] = [];

		const listDirectory = async (dirPath: string): Promise<void> => {
			let entries: FileEntry[];

			if (fileSystem === 'local') {
				entries = await this.localFsService.listFiles(dirPath);
			} else {
				entries = await this.sftpService.listFiles(hostId, dirPath);
			}

			for (const entry of entries) {
				files.push(entry);

				if (recursive && entry.type === 'd' && entry.name !== '.' && entry.name !== '..') {
					await listDirectory(entry.path);
				}
			}
		};

		await listDirectory(basePath);
		return files;
	}

	/**
	 * Filter files based on include/exclude patterns
	 */
	private filterFiles(files: FileEntry[], options: SyncOptions): FileEntry[] {
		return files.filter(file => {
			// Apply include pattern
			if (options.includePattern && !minimatch(file.name, options.includePattern)) {
				return false;
			}

			// Apply exclude pattern
			if (options.excludePattern && minimatch(file.name, options.excludePattern)) {
				return false;
			}

			return true;
		});
	}

	/**
	 * Compare two files and generate sync item
	 */
	private compareFiles(
		leftFile: FileEntry | undefined,
		rightFile: FileEntry | undefined,
		relativePath: string,
		leftBasePath: string,
		rightBasePath: string,
		options: SyncOptions
	): SyncItem | null {
		const name = relativePath;

		// File exists only on left
		if (leftFile && !rightFile) {
			return {
				leftPath: leftFile.path,
				name,
				direction: 'left-to-right',
				action: 'copy',
				reason: 'File exists only on left side',
				leftSize: leftFile.size,
				leftModTime: leftFile.modTime,
				type: leftFile.type
			};
		}

		// File exists only on right
		if (!leftFile && rightFile) {
			return {
				rightPath: rightFile.path,
				name,
				direction: 'right-to-left',
				action: 'copy',
				reason: 'File exists only on right side',
				rightSize: rightFile.size,
				rightModTime: rightFile.modTime,
				type: rightFile.type
			};
		}

		// Both files exist - compare them
		if (leftFile && rightFile) {
			// Type mismatch (directory vs file)
			if (leftFile.type !== rightFile.type) {
				return {
					leftPath: leftFile.path,
					rightPath: rightFile.path,
					name,
					direction: 'conflict',
					action: 'skip',
					reason: 'Type mismatch (file vs directory)',
					leftSize: leftFile.size,
					rightSize: rightFile.size,
					leftModTime: leftFile.modTime,
					rightModTime: rightFile.modTime,
					type: leftFile.type
				};
			}

			// For directories, no further comparison needed
			if (leftFile.type === 'd') {
				return null;
			}

			let isDifferent = false;
			let reason = '';

			// Compare size
			if (options.compareSize && leftFile.size !== rightFile.size) {
				isDifferent = true;
				reason = `Size differs (L: ${leftFile.size} bytes, R: ${rightFile.size} bytes)`;
			}

			// Compare modification time
			if (options.compareDate && !isDifferent) {
				const leftTime = new Date(leftFile.modTime).getTime();
				const rightTime = new Date(rightFile.modTime).getTime();
				const timeDiff = Math.abs(leftTime - rightTime);

				// Consider files different if time difference > 2 seconds (to account for filesystem precision)
				if (timeDiff > 2000) {
					isDifferent = true;
					const newer = leftTime > rightTime ? 'left' : 'right';
					reason = `Modification time differs (${newer} is newer)`;
				}
			}

			// Compare content (checksum) - would require reading files, expensive operation
			// For now, we'll skip this and rely on size/date comparison

			if (isDifferent) {
				// Determine direction based on modification time
				const leftTime = new Date(leftFile.modTime).getTime();
				const rightTime = new Date(rightFile.modTime).getTime();
				const direction: SyncDirection = leftTime > rightTime ? 'left-to-right' : 'right-to-left';

				return {
					leftPath: leftFile.path,
					rightPath: rightFile.path,
					name,
					direction,
					action: 'update',
					reason,
					leftSize: leftFile.size,
					rightSize: rightFile.size,
					leftModTime: leftFile.modTime,
					rightModTime: rightFile.modTime,
					type: leftFile.type
				};
			}

			// Files are identical
			return null;
		}

		return null;
	}

	/**
	 * Execute a single sync item
	 */
	private async executeSyncItem(hostId: string, item: SyncItem): Promise<void> {
		switch (item.action) {
			case 'copy':
				if (item.direction === 'left-to-right' && item.leftPath) {
					// Copy from left to right
					if (item.leftPath.includes('local')) {
						// Upload
						await this.transferService.addJob({
							type: 'upload',
							hostId,
							localPath: item.leftPath,
							remotePath: item.rightPath || '',
							filename: item.name,
							size: item.leftSize || 0,
							priority: 5
						});
					} else {
						// Remote to remote copy
						await this.sftpService.copy(hostId, item.leftPath, item.rightPath || '');
					}
				} else if (item.direction === 'right-to-left' && item.rightPath) {
					// Copy from right to left
					if (item.rightPath.includes('remote')) {
						// Download
						await this.transferService.addJob({
							type: 'download',
							hostId,
							remotePath: item.rightPath,
							localPath: item.leftPath || '',
							filename: item.name,
							size: item.rightSize || 0,
							priority: 5
						});
					} else {
						// Local to local copy
						await this.localFsService.copyFile(item.rightPath, item.leftPath || '');
					}
				}
				break;

			case 'update':
				// Update is essentially a copy operation
				await this.executeSyncItem(hostId, { ...item, action: 'copy' });
				break;

			case 'delete':
				// Delete operation - be careful with this!
				if (item.leftPath) {
					await this.deleteFile(hostId, item.leftPath, 'local');
				}
				if (item.rightPath) {
					await this.deleteFile(hostId, item.rightPath, 'remote');
				}
				break;
		}
	}

	/**
	 * Delete a file
	 */
	private async deleteFile(hostId: string, filePath: string, fileSystem: 'local' | 'remote'): Promise<void> {
		if (fileSystem === 'local') {
			await this.localFsService.delete(filePath);
		} else {
			await this.sftpService.delete(hostId, filePath);
		}
	}

	/**
	 * Check if file contains text
	 * TODO: Implement proper file content reading for remote files
	 */
	private async fileContainsText(
		hostId: string,
		filePath: string,
		fileSystem: 'local' | 'remote',
		searchText: string
	): Promise<boolean> {
		try {
			if (fileSystem === 'local') {
				const content = await this.localFsService.readFile(filePath);
				return content.includes(searchText);
			} else {
				// TODO: Implement remote file content reading
				// For now, skip content search for remote files
				this.logger.debug(`Content search not yet supported for remote files: ${filePath}`);
				return false;
			}
		} catch (error) {
			// If file cannot be read (binary, too large, permissions), return false
			return false;
		}
	}
}
