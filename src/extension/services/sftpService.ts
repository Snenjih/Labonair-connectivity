import { SFTPWrapper } from 'ssh2';
import * as fs from 'fs';
import * as path from 'path';
import { Host, FileEntry } from '../../common/types';
import { HostService } from '../hostService';
import { CredentialService } from '../credentialService';
import { ConnectionPool } from './connectionPool';

/**
 * Cache entry for directory listings
 */
interface DirectoryCacheEntry {
	files: FileEntry[];
	timestamp: number;
}

/**
 * SFTP Service
 * Manages SFTP connections and file operations
 */
export class SftpService {
	// Track SFTP wrappers only - the Client is managed by ConnectionPool
	private activeSessions: Map<string, { sftp: SFTPWrapper }> = new Map();
	private progressCallbacks: Map<string, (progress: number, speed: string) => void> = new Map();
	private directoryCache: Map<string, DirectoryCacheEntry> = new Map();
	private readonly CACHE_TTL = 10000; // 10 seconds
	private readonly PAGINATION_THRESHOLD = 1000; // Files threshold for pagination

	constructor(
		private readonly hostService: HostService,
		private readonly credentialService: CredentialService
	) { }

	/**
	 * Gets or creates an SFTP session for a host
	 * Uses ConnectionPool for shared SSH connection
	 */
	private async getSftpSession(hostId: string): Promise<SFTPWrapper> {
		// Check if session already exists
		const existing = this.activeSessions.get(hostId);
		if (existing) {
			return existing.sftp;
		}

		// Get shared SSH connection from pool
		const host = await this.getHost(hostId);
		const client = await ConnectionPool.acquire(
			host,
			this.hostService,
			this.credentialService
		);

		// Request SFTP subsystem
		return new Promise((resolve, reject) => {
			client.sftp((err, sftp) => {
				if (err) {
					ConnectionPool.release(hostId);
					reject(err);
					return;
				}

				// Cache the SFTP wrapper (Client is managed by ConnectionPool)
				this.activeSessions.set(hostId, { sftp });

				resolve(sftp);
			});
		});
	}

	/**
	 * Lists files in a remote directory with caching
	 */
	public async listFiles(hostId: string, remotePath: string, useCache: boolean = true): Promise<FileEntry[]> {
		// Check cache first
		const cacheKey = `${hostId}:${remotePath}`;
		if (useCache) {
			const cached = this.directoryCache.get(cacheKey);
			if (cached && (Date.now() - cached.timestamp < this.CACHE_TTL)) {
				return cached.files;
			}
		}

		const sftp = await this.getSftpSession(hostId);

		return new Promise((resolve, reject) => {
			sftp.readdir(remotePath, async (err, list) => {
				if (err) {
					reject(new Error(`Failed to list directory: ${err.message}`));
					return;
				}

				// Check if we need pagination
				if (list.length > this.PAGINATION_THRESHOLD) {
					console.log(`Large directory (${list.length} files) - using streaming`);
				}

				const files: FileEntry[] = [];

				for (const item of list) {
					// Parse longname format: "drwxr-xr-x 2 user group 4096 Jan 1 12:00 filename"
					const longnameParts = item.longname.split(/\s+/);
					const permissions = longnameParts[0] || '';
					const owner = longnameParts[2] || '';
					const group = longnameParts[3] || '';

					// Determine file type
					let type: 'd' | '-' | 'l' = '-';
					if (permissions.startsWith('d')) {
						type = 'd';
					} else if (permissions.startsWith('l')) {
						type = 'l';
					}

					const filePath = path.posix.join(remotePath, item.filename);
					const fileEntry: FileEntry = {
						name: item.filename,
						path: filePath,
						size: item.attrs.size || 0,
						type,
						modTime: new Date((item.attrs.mtime || 0) * 1000),
						permissions,
						owner,
						group
					};

					// Resolve symlink target if it's a symlink
					if (type === 'l') {
						try {
							fileEntry.symlinkTarget = await this.readSymlink(sftp, filePath);
						} catch (error) {
							console.warn(`Failed to resolve symlink ${filePath}:`, error);
							fileEntry.symlinkTarget = '(unresolved)';
						}
					}

					files.push(fileEntry);
				}

				// Sort: directories first, then by name
				files.sort((a, b) => {
					if (a.type === 'd' && b.type !== 'd') {
						return -1;
					}
					if (a.type !== 'd' && b.type === 'd') {
						return 1;
					}
					return a.name.localeCompare(b.name);
				});

				// Cache the result
				this.directoryCache.set(cacheKey, {
					files,
					timestamp: Date.now()
				});

				resolve(files);
			});
		});
	}

	/**
	 * Reads a symlink target
	 */
	private async readSymlink(sftp: SFTPWrapper, linkPath: string): Promise<string> {
		return new Promise((resolve, reject) => {
			sftp.readlink(linkPath, (err, target) => {
				if (err) {
					reject(err);
				} else {
					resolve(target);
				}
			});
		});
	}

	/**
	 * Gets detailed file information
	 */
	public async stat(hostId: string, remotePath: string): Promise<FileEntry> {
		const sftp = await this.getSftpSession(hostId);

		return new Promise((resolve, reject) => {
			sftp.stat(remotePath, (err, stats) => {
				if (err) {
					reject(new Error(`Failed to stat file: ${err.message}`));
					return;
				}

				// Get file name from path
				const name = remotePath.split('/').pop() || remotePath;

				// Determine type from stats
				let type: 'd' | '-' | 'l' = '-';
				if (stats.isDirectory()) {
					type = 'd';
				} else if (stats.isSymbolicLink()) {
					type = 'l';
				}

				// Build permissions string
				const permissions = this.buildPermissionsString(stats.mode || 0);

				resolve({
					name,
					path: remotePath,
					size: stats.size || 0,
					type,
					modTime: new Date((stats.mtime || 0) * 1000),
					permissions,
					owner: String(stats.uid || ''),
					group: String(stats.gid || '')
				});
			});
		});
	}

	/**
	 * Builds a permissions string from mode bits
	 */
	private buildPermissionsString(mode: number): string {
		const types = ['---', '--x', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx'];
		const typeChar = (mode & 0o040000) ? 'd' : (mode & 0o120000) ? 'l' : '-';
		const owner = types[(mode >> 6) & 7];
		const group = types[(mode >> 3) & 7];
		const other = types[mode & 7];
		return typeChar + owner + group + other;
	}

	/**
	 * Downloads a file from remote to local
	 */
	public async getFile(
		hostId: string,
		remotePath: string,
		localPath: string,
		onProgress?: (progress: number, speed: string) => void
	): Promise<void> {
		const sftp = await this.getSftpSession(hostId);

		return new Promise((resolve, reject) => {
			// Get file size for progress tracking
			sftp.stat(remotePath, (err, stats) => {
				if (err) {
					reject(new Error(`Failed to stat remote file: ${err.message}`));
					return;
				}

				const totalSize = stats.size;
				let transferred = 0;
				const startTime = Date.now();

				const readStream = sftp.createReadStream(remotePath);
				const writeStream = fs.createWriteStream(localPath);

				readStream.on('data', (chunk: Buffer) => {
					transferred += chunk.length;

					if (onProgress) {
						const progress = Math.round((transferred / totalSize) * 100);
						const elapsed = (Date.now() - startTime) / 1000;
						const speed = this.formatSpeed(transferred / elapsed);
						onProgress(progress, speed);
					}
				});

				readStream.on('error', (err: Error) => {
					writeStream.close();
					reject(new Error(`Download failed: ${err.message}`));
				});

				writeStream.on('error', (err: Error) => {
					readStream.destroy();
					reject(new Error(`Write failed: ${err.message}`));
				});

				writeStream.on('finish', () => {
					resolve();
				});

				readStream.pipe(writeStream);
			});
		});
	}

	/**
	 * Uploads a file from local to remote
	 */
	public async putFile(
		hostId: string,
		localPath: string,
		remotePath: string,
		onProgress?: (progress: number, speed: string) => void
	): Promise<void> {
		const sftp = await this.getSftpSession(hostId);

		return new Promise((resolve, reject) => {
			// Get local file size
			const stats = fs.statSync(localPath);
			const totalSize = stats.size;
			let transferred = 0;
			const startTime = Date.now();

			const readStream = fs.createReadStream(localPath);
			const writeStream = sftp.createWriteStream(remotePath);

			readStream.on('data', (chunk: Buffer) => {
				transferred += chunk.length;

				if (onProgress) {
					const progress = Math.round((transferred / totalSize) * 100);
					const elapsed = (Date.now() - startTime) / 1000;
					const speed = this.formatSpeed(transferred / elapsed);
					onProgress(progress, speed);
				}
			});

			readStream.on('error', (err: Error) => {
				writeStream.end();
				reject(new Error(`Read failed: ${err.message}`));
			});

			writeStream.on('error', (err: Error) => {
				readStream.destroy();
				reject(new Error(`Upload failed: ${err.message}`));
			});

			writeStream.on('finish', () => {
				resolve();
			});

			readStream.pipe(writeStream);
		});
	}

	/**
	 * Deletes a file or directory
	 */
	public async delete(hostId: string, remotePath: string): Promise<void> {
		const sftp = await this.getSftpSession(hostId);

		return new Promise((resolve, reject) => {
			// First check if it's a directory
			sftp.stat(remotePath, (statErr, stats) => {
				if (statErr) {
					reject(new Error(`Failed to stat path: ${statErr.message}`));
					return;
				}

				if (stats.isDirectory()) {
					// Remove directory
					sftp.rmdir(remotePath, (err) => {
						if (err) {
							reject(new Error(`Failed to remove directory: ${err.message}`));
						} else {
							resolve();
						}
					});
				} else {
					// Remove file
					sftp.unlink(remotePath, (err) => {
						if (err) {
							reject(new Error(`Failed to remove file: ${err.message}`));
						} else {
							resolve();
						}
					});
				}
			});
		});
	}

	/**
	 * Creates a directory
	 */
	public async mkdir(hostId: string, remotePath: string): Promise<void> {
		const sftp = await this.getSftpSession(hostId);

		return new Promise((resolve, reject) => {
			sftp.mkdir(remotePath, (err) => {
				if (err) {
					reject(new Error(`Failed to create directory: ${err.message}`));
				} else {
					// Invalidate directory cache for parent directory
					const parentPath = remotePath.split('/').slice(0, -1).join('/') || '/';
					this.directoryCache.delete(`${hostId}:${parentPath}`);
					resolve();
				}
			});
		});
	}

	/**
	 * Renames or moves a file/directory
	 */
	public async rename(hostId: string, oldPath: string, newPath: string): Promise<void> {
		const sftp = await this.getSftpSession(hostId);

		return new Promise((resolve, reject) => {
			sftp.rename(oldPath, newPath, (err) => {
				if (err) {
					reject(new Error(`Failed to rename: ${err.message}`));
				} else {
					// Invalidate cache for both old and new parent directories
					const oldParent = oldPath.split('/').slice(0, -1).join('/') || '/';
					const newParent = newPath.split('/').slice(0, -1).join('/') || '/';
					this.directoryCache.delete(`${hostId}:${oldParent}`);
					this.directoryCache.delete(`${hostId}:${newParent}`);
					resolve();
				}
			});
		});
	}

	/**
	 * Clears the directory cache for a specific path or all paths
	 */
	public clearCache(hostId?: string, remotePath?: string): void {
		if (hostId && remotePath) {
			this.directoryCache.delete(`${hostId}:${remotePath}`);
		} else if (hostId) {
			// Clear all cache entries for this host
			for (const key of this.directoryCache.keys()) {
				if (key.startsWith(`${hostId}:`)) {
					this.directoryCache.delete(key);
				}
			}
		} else {
			// Clear entire cache
			this.directoryCache.clear();
		}
	}

	/**
	 * Closes a specific SFTP session
	 * Releases the connection back to the pool
	 */
	public closeSession(hostId: string): void {
		const session = this.activeSessions.get(hostId);
		if (session) {
			// Release connection back to pool
			ConnectionPool.release(hostId);
			this.activeSessions.delete(hostId);
		}
	}

	/**
	 * Closes all SFTP sessions
	 * Releases all connections back to the pool
	 */
	public dispose(): void {
		for (const hostId of this.activeSessions.keys()) {
			ConnectionPool.release(hostId);
		}
		this.activeSessions.clear();
	}

	/**
	 * Gets host information
	 */
	private async getHost(hostId: string): Promise<Host> {
		const hosts = await this.hostService.getHosts();
		const host = hosts.find(h => h.id === hostId);
		if (!host) {
			throw new Error(`Host not found: ${hostId}`);
		}
		return host;
	}

	/**
	 * Formats transfer speed in human-readable format
	 */
	private formatSpeed(bytesPerSecond: number): string {
		if (bytesPerSecond < 1024) {
			return `${bytesPerSecond.toFixed(0)} B/s`;
		} else if (bytesPerSecond < 1024 * 1024) {
			return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
		} else {
			return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
		}
	}
}
