import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import AdmZip = require('adm-zip');
import * as tar from 'tar';
import { SftpService } from './sftpService';

/**
 * ArchiveService - Universal archive operations for both local and remote systems
 * Handles compression and extraction of ZIP and TAR archives
 */
export class ArchiveService {
	constructor(private readonly _sftpService: SftpService) {}

	/**
	 * Extracts an archive
	 * @param archivePath - Path to the archive file
	 * @param targetPath - Path where to extract (defaults to archive's directory)
	 * @param system - 'local' or 'remote'
	 * @param hostId - Required for remote operations
	 */
	public async extract(
		archivePath: string,
		targetPath?: string,
		system: 'local' | 'remote' = 'local',
		hostId?: string
	): Promise<void> {
		if (system === 'local') {
			await this._extractLocal(archivePath, targetPath);
		} else {
			if (!hostId) {
				throw new Error('hostId is required for remote archive operations');
			}
			await this._extractRemote(hostId, archivePath, targetPath);
		}
	}

	/**
	 * Compresses files into an archive
	 * @param sourcePaths - Array of file/directory paths to compress
	 * @param archivePath - Output archive path
	 * @param archiveType - Type of archive: 'zip', 'tar', or 'tar.gz'
	 * @param system - 'local' or 'remote'
	 * @param hostId - Required for remote operations
	 */
	public async compress(
		sourcePaths: string[],
		archivePath: string,
		archiveType: 'zip' | 'tar' | 'tar.gz',
		system: 'local' | 'remote' = 'local',
		hostId?: string
	): Promise<void> {
		if (system === 'local') {
			await this._compressLocal(sourcePaths, archivePath, archiveType);
		} else {
			if (!hostId) {
				throw new Error('hostId is required for remote archive operations');
			}
			await this._compressRemote(hostId, sourcePaths, archivePath, archiveType);
		}
	}

	// ========================================================================
	// Local Archive Operations
	// ========================================================================

	/**
	 * Extracts a local archive using appropriate library
	 */
	private async _extractLocal(archivePath: string, targetPath?: string): Promise<void> {
		try {
			const ext = path.extname(archivePath).toLowerCase();
			const extractTo = targetPath || path.dirname(archivePath);

			// Ensure target directory exists
			if (!fs.existsSync(extractTo)) {
				fs.mkdirSync(extractTo, { recursive: true });
			}

			if (ext === '.zip') {
				// Extract ZIP using adm-zip
				const zip = new AdmZip(archivePath);
				zip.extractAllTo(extractTo, true);
			} else if (ext === '.tar' || ext === '.gz' || ext === '.tgz') {
				// Extract TAR using tar library
				await tar.extract({
					file: archivePath,
					cwd: extractTo
				});
			} else {
				throw new Error(`Unsupported archive format: ${ext}`);
			}

			console.log(`[ArchiveService] Extracted ${archivePath} to ${extractTo}`);
		} catch (error) {
			console.error('[ArchiveService] Local extraction failed:', error);
			throw new Error(`Failed to extract archive: ${error}`);
		}
	}

	/**
	 * Compresses local files into an archive
	 */
	private async _compressLocal(
		sourcePaths: string[],
		archivePath: string,
		archiveType: 'zip' | 'tar' | 'tar.gz'
	): Promise<void> {
		try {
			// Ensure target directory exists
			const targetDir = path.dirname(archivePath);
			if (!fs.existsSync(targetDir)) {
				fs.mkdirSync(targetDir, { recursive: true });
			}

			if (archiveType === 'zip') {
				// Create ZIP using adm-zip
				const zip = new AdmZip();
				for (const sourcePath of sourcePaths) {
					const stats = fs.statSync(sourcePath);
					if (stats.isDirectory()) {
						zip.addLocalFolder(sourcePath, path.basename(sourcePath));
					} else {
						zip.addLocalFile(sourcePath);
					}
				}
				zip.writeZip(archivePath);
			} else if (archiveType === 'tar' || archiveType === 'tar.gz') {
				// Create TAR using tar library
				const gzip = archiveType === 'tar.gz';
				await tar.create(
					{
						file: archivePath,
						gzip,
						cwd: path.dirname(sourcePaths[0])
					},
					sourcePaths.map(p => path.basename(p))
				);
			} else {
				throw new Error(`Unsupported archive type: ${archiveType}`);
			}

			console.log(`[ArchiveService] Created ${archiveType} archive: ${archivePath}`);
		} catch (error) {
			console.error('[ArchiveService] Local compression failed:', error);
			throw new Error(`Failed to create archive: ${error}`);
		}
	}

	// ========================================================================
	// Remote Archive Operations (via SSH commands)
	// ========================================================================

	/**
	 * Extracts a remote archive using existing SftpService methods
	 */
	private async _extractRemote(
		hostId: string,
		archivePath: string,
		targetPath?: string
	): Promise<void> {
		try {
			// Delegate to existing SftpService.extractRemote
			// Note: The existing method extracts to the archive's directory
			await this._sftpService.extractRemote(hostId, archivePath);
			console.log(`[ArchiveService] Remote extraction completed: ${archivePath}`);
		} catch (error) {
			console.error('[ArchiveService] Remote extraction failed:', error);
			throw new Error(`Failed to extract remote archive: ${error}`);
		}
	}

	/**
	 * Compresses remote files using existing SftpService methods
	 */
	private async _compressRemote(
		hostId: string,
		sourcePaths: string[],
		archivePath: string,
		archiveType: 'zip' | 'tar' | 'tar.gz'
	): Promise<void> {
		try {
			// Delegate to existing SftpService.compressRemote
			await this._sftpService.compressRemote(hostId, sourcePaths, archivePath, archiveType);
			console.log(`[ArchiveService] Remote compression completed: ${archivePath}`);
		} catch (error) {
			console.error('[ArchiveService] Remote compression failed:', error);
			throw new Error(`Failed to create remote archive: ${error}`);
		}
	}
}
