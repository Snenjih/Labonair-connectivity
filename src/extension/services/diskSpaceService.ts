import { DiskSpaceInfo } from '../../common/types';
import { SftpService } from './sftpService';
import { execSync } from 'child_process';
import * as path from 'path';
import * as os from 'os';

/**
 * DiskSpaceService - Handles disk space detection for both local and remote systems
 */
export class DiskSpaceService {
	constructor(private readonly _sftpService: SftpService) {}

	/**
	 * Gets disk space information for a local path
	 * @param localPath - The local path to check
	 * @returns Disk space information
	 */
	public async getLocalDiskSpace(localPath: string): Promise<DiskSpaceInfo> {
		try {
			const platform = os.platform();

			if (platform === 'win32') {
				// Windows: Use wmic
				const drive = path.parse(localPath).root;
				const output = execSync(`wmic logicaldisk where "DeviceID='${drive.replace('\\', '')}'" get Size,FreeSpace /format:csv`, {
					encoding: 'utf8'
				});

				// Parse CSV output (format: Node,FreeSpace,Size)
				const lines = output.trim().split('\n').filter(l => l.trim());
				if (lines.length >= 2) {
					const parts = lines[1].split(',');
					const free = parseInt(parts[1], 10);
					const total = parseInt(parts[2], 10);
					return {
						total,
						free,
						used: total - free
					};
				}
			} else {
				// Unix-like systems: Use df
				const output = execSync(`df -k "${localPath}" | tail -1`, {
					encoding: 'utf8'
				});

				// Parse df output (1k-blocks)
				const parts = output.trim().split(/\s+/);
				if (parts.length >= 4) {
					const total = parseInt(parts[1], 10) * 1024; // Convert to bytes
					const used = parseInt(parts[2], 10) * 1024;
					const free = parseInt(parts[3], 10) * 1024;
					return {
						total,
						free,
						used
					};
				}
			}

			// Fallback
			return {
				total: 0,
				free: 0,
				used: 0
			};
		} catch (error) {
			console.error('[DiskSpaceService] Failed to get local disk space:', error);
			return {
				total: 0,
				free: 0,
				used: 0
			};
		}
	}

	/**
	 * Gets disk space information for a remote path via SSH
	 * @param hostId - The host identifier
	 * @param remotePath - The remote path to check
	 * @returns Disk space information
	 */
	public async getRemoteDiskSpace(hostId: string, remotePath: string): Promise<DiskSpaceInfo> {
		try {
			// Execute df command via SSH
			const command = `df -k "${remotePath}" | tail -1`;
			const output = await this._sftpService.executeCommand(hostId, command);

			// Parse df output (1k-blocks)
			const parts = output.trim().split(/\s+/);
			if (parts.length >= 4) {
				const total = parseInt(parts[1], 10) * 1024; // Convert to bytes
				const used = parseInt(parts[2], 10) * 1024;
				const free = parseInt(parts[3], 10) * 1024;
				return {
					total,
					free,
					used
				};
			}

			// Fallback
			return {
				total: 0,
				free: 0,
				used: 0
			};
		} catch (error) {
			console.error('[DiskSpaceService] Failed to get remote disk space:', error);
			return {
				total: 0,
				free: 0,
				used: 0
			};
		}
	}

	/**
	 * Gets disk space for either local or remote based on fileSystem type
	 * @param hostId - The host identifier
	 * @param path - The path to check
	 * @param fileSystem - The file system type ('local' or 'remote')
	 * @returns Disk space information
	 */
	public async getDiskSpace(
		hostId: string,
		path: string,
		fileSystem: 'local' | 'remote'
	): Promise<DiskSpaceInfo> {
		if (fileSystem === 'local') {
			return this.getLocalDiskSpace(path);
		} else {
			return this.getRemoteDiskSpace(hostId, path);
		}
	}
}
