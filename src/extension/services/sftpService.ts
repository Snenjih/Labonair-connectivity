import { SFTPWrapper } from 'ssh2';
import * as fs from 'fs';
import * as path from 'path';
import * as iconv from 'iconv-lite';
import { Host, FileEntry } from '../../common/types';
import { HostService } from '../hostService';
import { CredentialService } from '../credentialService';
import { ConnectionPool } from './connectionPool';
import { HostKeyService } from '../security/hostKeyService';

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
		private readonly credentialService: CredentialService,
		private readonly hostKeyService: HostKeyService
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
			this.credentialService,
			this.hostKeyService
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
	 * Decodes a filename using the host's configured encoding
	 */
	private decodeFilename(filename: string, encoding: string): string {
		try {
			// If encoding is UTF-8 or not specified, return as-is
			if (!encoding || encoding.toLowerCase() === 'utf-8' || encoding.toLowerCase() === 'utf8') {
				return filename;
			}

			// Convert filename to buffer and decode with specified encoding
			const buffer = Buffer.from(filename, 'binary');
			return iconv.decode(buffer, encoding);
		} catch (error) {
			console.warn(`Failed to decode filename with encoding ${encoding}:`, error);
			return filename; // Fallback to original
		}
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
		const host = await this.getHost(hostId);
		const encoding = host.encoding || 'utf-8';

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

					// Decode filename using host's encoding
					const decodedFilename = this.decodeFilename(item.filename, encoding);
					const filePath = path.posix.join(remotePath, decodedFilename);
					const fileEntry: FileEntry = {
						name: decodedFilename,
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
	 * Copies a file or directory on the remote server
	 * Optimization: Uses SSH shell command 'cp -r' for instant speed if available
	 * Fallback: Uses SFTP ReadStream -> WriteStream loop (server loopback)
	 */
	public async copy(hostId: string, sourcePath: string, destPath: string): Promise<void> {
		const host = await this.getHost(hostId);

		try {
			// Try to use SSH shell for optimized copy (instant speed)
			const client = await ConnectionPool.acquire(
				host,
				this.hostService,
				this.credentialService,
				this.hostKeyService
			);

			return new Promise((resolve, reject) => {
				// Use 'cp -r' for recursive copy (works for both files and directories)
				const command = `cp -r "${sourcePath}" "${destPath}"`;

				client.exec(command, (err, stream) => {
					if (err) {
						// Shell not available, fall back to SFTP method
						console.warn('SSH shell copy failed, falling back to SFTP method:', err);
						this.copyViaSftp(hostId, sourcePath, destPath).then(resolve).catch(reject);
						return;
					}

					let errorOutput = '';

					stream.stderr.on('data', (data: Buffer) => {
						errorOutput += data.toString();
					});

					stream.on('close', (code: number) => {
						if (code === 0) {
							// Clear cache for target directory
							const parentPath = destPath.split('/').slice(0, -1).join('/') || '/';
							this.directoryCache.delete(`${hostId}:${parentPath}`);
							resolve();
						} else {
							// Shell command failed, try SFTP fallback
							console.warn(`SSH shell copy failed with code ${code}, falling back to SFTP method:`, errorOutput);
							this.copyViaSftp(hostId, sourcePath, destPath).then(resolve).catch(reject);
						}
					});
				});
			});
		} catch (error) {
			// Connection failed, try SFTP fallback
			console.warn('Failed to acquire SSH connection for copy, falling back to SFTP method:', error);
			return this.copyViaSftp(hostId, sourcePath, destPath);
		}
	}

	/**
	 * Copies a file or directory using SFTP (fallback method)
	 * Uses ReadStream -> WriteStream loop for server-side loopback
	 */
	private async copyViaSftp(hostId: string, sourcePath: string, destPath: string): Promise<void> {
		const sftp = await this.getSftpSession(hostId);

		return new Promise((resolve, reject) => {
			// Check if source is a directory or file
			sftp.stat(sourcePath, async (err, stats) => {
				if (err) {
					reject(new Error(`Failed to stat source: ${err.message}`));
					return;
				}

				if (stats.isDirectory()) {
					// Recursive directory copy via SFTP
					try {
						await this.copyDirectoryViaSftp(sftp, sourcePath, destPath, hostId);
						resolve();
					} catch (error: any) {
						reject(new Error(`Failed to copy directory: ${error.message}`));
					}
				} else {
					// Single file copy via SFTP
					const readStream = sftp.createReadStream(sourcePath);
					const writeStream = sftp.createWriteStream(destPath);

					readStream.on('error', (err: Error) => {
						writeStream.end();
						reject(new Error(`Read failed: ${err.message}`));
					});

					writeStream.on('error', (err: Error) => {
						readStream.destroy();
						reject(new Error(`Write failed: ${err.message}`));
					});

					writeStream.on('finish', () => {
						// Clear cache for target directory
						const parentPath = destPath.split('/').slice(0, -1).join('/') || '/';
						this.directoryCache.delete(`${hostId}:${parentPath}`);
						resolve();
					});

					readStream.pipe(writeStream);
				}
			});
		});
	}

	/**
	 * Recursively copies a directory via SFTP
	 */
	private async copyDirectoryViaSftp(sftp: SFTPWrapper, sourcePath: string, destPath: string, hostId: string): Promise<void> {
		// Create destination directory
		await new Promise<void>((resolve, reject) => {
			sftp.mkdir(destPath, (err) => {
				if (err) {
					reject(new Error(`Failed to create directory: ${err.message}`));
				} else {
					resolve();
				}
			});
		});

		// Read all entries in source directory
		const entries = await new Promise<any[]>((resolve, reject) => {
			sftp.readdir(sourcePath, (err, list) => {
				if (err) {
					reject(new Error(`Failed to read directory: ${err.message}`));
				} else {
					resolve(list);
				}
			});
		});

		// Copy each entry
		for (const entry of entries) {
			const srcPath = path.posix.join(sourcePath, entry.filename);
			const dstPath = path.posix.join(destPath, entry.filename);

			if (entry.attrs.isDirectory()) {
				// Recursively copy subdirectory
				await this.copyDirectoryViaSftp(sftp, srcPath, dstPath, hostId);
			} else {
				// Copy file
				await new Promise<void>((resolve, reject) => {
					const readStream = sftp.createReadStream(srcPath);
					const writeStream = sftp.createWriteStream(dstPath);

					readStream.on('error', (err: Error) => {
						writeStream.end();
						reject(new Error(`Read failed: ${err.message}`));
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
			}
		}

		// Clear cache for target directory
		const parentPath = destPath.split('/').slice(0, -1).join('/') || '/';
		this.directoryCache.delete(`${hostId}:${parentPath}`);
	}

	/**
	 * Moves a file or directory on the remote server
	 * This is the main move method for the Universal Transfer Matrix
	 * Uses the existing rename method
	 */
	public async move(hostId: string, sourcePath: string, destPath: string): Promise<void> {
		return this.rename(hostId, sourcePath, destPath);
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

	/**
	 * Extracts an archive on the remote server
	 * Supports .zip, .tar, .tar.gz, .tgz formats
	 */
	public async extractRemote(hostId: string, archivePath: string): Promise<void> {
		const host = await this.getHost(hostId);
		const client = await ConnectionPool.acquire(
			host,
			this.hostService,
			this.credentialService,
			this.hostKeyService
		);

		return new Promise((resolve, reject) => {
			// Detect archive type
			const ext = archivePath.toLowerCase();
			let command: string;

			if (ext.endsWith('.zip')) {
				// Extract zip file
				command = `unzip -o '${archivePath}' -d '${archivePath.substring(0, archivePath.lastIndexOf('/'))}'`;
			} else if (ext.endsWith('.tar.gz') || ext.endsWith('.tgz')) {
				// Extract tar.gz file
				command = `tar -xzf '${archivePath}' -C '${archivePath.substring(0, archivePath.lastIndexOf('/'))}'`;
			} else if (ext.endsWith('.tar')) {
				// Extract tar file
				command = `tar -xf '${archivePath}' -C '${archivePath.substring(0, archivePath.lastIndexOf('/'))}'`;
			} else {
				reject(new Error('Unsupported archive format. Supported formats: .zip, .tar, .tar.gz, .tgz'));
				return;
			}

			client.exec(command, (err, stream) => {
				if (err) {
					reject(new Error(`Failed to execute extraction command: ${err.message}`));
					return;
				}

				let output = '';
				let errorOutput = '';

				stream.on('data', (data: Buffer) => {
					output += data.toString();
				});

				stream.stderr.on('data', (data: Buffer) => {
					errorOutput += data.toString();
				});

				stream.on('close', (code: number) => {
					if (code === 0) {
						resolve();
					} else {
						reject(new Error(`Extraction failed with code ${code}: ${errorOutput || output}`));
					}
				});
			});
		});
	}

	/**
	 * Compresses files/directories on the remote server into an archive
	 * Creates a tar.gz archive by default
	 */
	public async compressRemote(
		hostId: string,
		paths: string[],
		archiveName: string,
		archiveType: 'zip' | 'tar' | 'tar.gz' = 'tar.gz'
	): Promise<void> {
		const host = await this.getHost(hostId);
		const client = await ConnectionPool.acquire(
			host,
			this.hostService,
			this.credentialService,
			this.hostKeyService
		);

		return new Promise((resolve, reject) => {
			if (paths.length === 0) {
				reject(new Error('No paths specified for compression'));
				return;
			}

			// Build command based on archive type
			let command: string;
			const quotedPaths = paths.map(p => `'${p}'`).join(' ');

			if (archiveType === 'zip') {
				// Create zip archive
				command = `zip -r '${archiveName}' ${quotedPaths}`;
			} else if (archiveType === 'tar.gz') {
				// Create tar.gz archive
				command = `tar -czf '${archiveName}' ${quotedPaths}`;
			} else if (archiveType === 'tar') {
				// Create tar archive
				command = `tar -cf '${archiveName}' ${quotedPaths}`;
			} else {
				reject(new Error('Unsupported archive type. Supported types: zip, tar, tar.gz'));
				return;
			}

			client.exec(command, (err, stream) => {
				if (err) {
					reject(new Error(`Failed to execute compression command: ${err.message}`));
					return;
				}

				let output = '';
				let errorOutput = '';

				stream.on('data', (data: Buffer) => {
					output += data.toString();
				});

				stream.stderr.on('data', (data: Buffer) => {
					errorOutput += data.toString();
				});

				stream.on('close', (code: number) => {
					if (code === 0) {
						resolve();
					} else {
						reject(new Error(`Compression failed with code ${code}: ${errorOutput || output}`));
					}
				});
			});
		});
	}

	/**
	 * Changes file/directory permissions
	 */
	public async chmod(hostId: string, path: string, mode: string): Promise<void> {
		const sftp = await this.getSftpSession(hostId);

		// Convert octal string to number
		const modeNum = parseInt(mode, 8);

		return new Promise((resolve, reject) => {
			sftp.chmod(path, modeNum, (err) => {
				if (err) {
					reject(new Error(`Failed to change permissions: ${err.message}`));
				} else {
					// Invalidate cache for parent directory
					const parentPath = path.split('/').slice(0, -1).join('/') || '/';
					this.directoryCache.delete(`${hostId}:${parentPath}`);
					resolve();
				}
			});
		});
	}

	/**
	 * Changes permissions recursively for a directory
	 */
	public async chmodRecursive(
		hostId: string,
		dirPath: string,
		mode: string,
		onProgress?: (current: number, total: number, path: string) => void
	): Promise<void> {
		const sftp = await this.getSftpSession(hostId);
		const modeNum = parseInt(mode, 8);

		// First, collect all paths to change
		const allPaths: string[] = [];

		const walkDirectory = async (currentPath: string): Promise<void> => {
			return new Promise((resolve, reject) => {
				sftp.readdir(currentPath, async (err, list) => {
					if (err) {
						reject(new Error(`Failed to read directory ${currentPath}: ${err.message}`));
						return;
					}

					allPaths.push(currentPath);

					for (const item of list) {
						const itemPath = path.posix.join(currentPath, item.filename);
						const isDirectory = item.attrs.isDirectory();

						if (isDirectory) {
							try {
								await walkDirectory(itemPath);
							} catch (error) {
								console.warn(`Failed to walk directory ${itemPath}:`, error);
							}
						} else {
							allPaths.push(itemPath);
						}
					}

					resolve();
				});
			});
		};

		// Walk the directory tree
		await walkDirectory(dirPath);

		// Apply chmod to all collected paths
		let current = 0;
		const total = allPaths.length;

		for (const itemPath of allPaths) {
			try {
				await new Promise<void>((resolve, reject) => {
					sftp.chmod(itemPath, modeNum, (err) => {
						if (err) {
							console.warn(`Failed to chmod ${itemPath}:`, err);
							// Continue even if one fails
							resolve();
						} else {
							resolve();
						}
					});
				});

				current++;
				if (onProgress) {
					onProgress(current, total, itemPath);
				}
			} catch (error) {
				console.warn(`Error changing permissions for ${itemPath}:`, error);
			}
		}

		// Clear cache for the entire directory tree
		this.clearCache(hostId);
	}

	/**
	 * Executes a shell command on the remote server
	 * @param hostId - The host identifier
	 * @param command - The command to execute
	 * @returns The command output
	 */
	public async executeCommand(hostId: string, command: string): Promise<string> {
		const host = await this.getHost(hostId);
		const client = await ConnectionPool.acquire(
			host,
			this.hostService,
			this.credentialService,
			this.hostKeyService
		);

		return new Promise((resolve, reject) => {
			client.exec(command, (err, stream) => {
				if (err) {
					reject(new Error(`Failed to execute command: ${err.message}`));
					return;
				}

				let output = '';
				let errorOutput = '';

				stream.on('data', (data: Buffer) => {
					output += data.toString();
				});

				stream.stderr.on('data', (data: Buffer) => {
					errorOutput += data.toString();
				});

				stream.on('close', (code: number) => {
					if (code === 0) {
						resolve(output);
					} else {
						reject(new Error(`Command failed with code ${code}: ${errorOutput || output}`));
					}
				});
			});
		});
	}

	/**
	 * Calculates checksum for a remote file using SSH commands
	 * @param hostId - The host identifier
	 * @param remotePath - Path to the remote file
	 * @param algorithm - Hash algorithm (md5, sha1, sha256)
	 * @returns The hex-encoded checksum string
	 */
	public async calculateChecksum(hostId: string, remotePath: string, algorithm: 'md5' | 'sha1' | 'sha256'): Promise<string> {
		// Map algorithm to command
		const commandMap = {
			'md5': 'md5sum',
			'sha1': 'sha1sum',
			'sha256': 'sha256sum'
		};

		const command = `${commandMap[algorithm]} '${remotePath}'`;
		const output = await this.executeCommand(hostId, command);

		// Parse output: "checksum  filename"
		const match = output.match(/^([a-f0-9]+)/i);
		if (!match) {
			throw new Error(`Failed to parse checksum output: ${output}`);
		}

		return match[1].toLowerCase();
	}

	/**
	 * Creates a symbolic link on the remote server
	 * @param hostId - The host identifier
	 * @param sourcePath - Path to the source file/directory (what the symlink points to)
	 * @param targetPath - Path where the symlink should be created
	 */
	public async createSymlink(hostId: string, sourcePath: string, targetPath: string): Promise<void> {
		const command = `ln -s '${sourcePath}' '${targetPath}'`;
		await this.executeCommand(hostId, command);

		// Invalidate cache for parent directory
		const parentPath = targetPath.split('/').slice(0, -1).join('/') || '/';
		this.directoryCache.delete(`${hostId}:${parentPath}`);
	}

	/**
	 * Searches for files on the remote server matching the given pattern and/or content
	 * @param hostId - The host identifier
	 * @param basePath - Directory to start the search
	 * @param pattern - Filename pattern (supports wildcards like *.txt)
	 * @param content - Optional content to search within files
	 * @param recursive - Whether to search subdirectories
	 * @returns Array of matching FileEntry objects
	 */
	public async searchFiles(
		hostId: string,
		basePath: string,
		pattern?: string,
		content?: string,
		recursive: boolean = true
	): Promise<FileEntry[]> {
		const results: FileEntry[] = [];

		// Build find command
		let findCmd = `find '${basePath}'`;

		// Add depth restriction if not recursive
		if (!recursive) {
			findCmd += ' -maxdepth 1';
		}

		// Add filename pattern if provided
		if (pattern) {
			// Escape single quotes in pattern
			const escapedPattern = pattern.replace(/'/g, "'\\''");
			findCmd += ` -name '${escapedPattern}'`;
		}

		// If content search is specified, use grep to filter files
		if (content) {
			// Escape single quotes in content
			const escapedContent = content.replace(/'/g, "'\\''");

			// Find files, then grep for content
			findCmd += ` -type f -exec grep -l '${escapedContent}' {} \\;`;
		} else {
			// Just list all matching files/directories
			findCmd += ' 2>/dev/null';
		}

		try {
			const output = await this.executeCommand(hostId, findCmd);

			if (!output.trim()) {
				return results;
			}

			// Parse output - one path per line
			const paths = output.trim().split('\n');

			// Get detailed info for each file using stat
			for (const filePath of paths) {
				if (!filePath) continue;

				try {
					const fileEntry = await this.stat(hostId, filePath);
					results.push(fileEntry);
				} catch (error) {
					// Skip files we can't stat
					console.warn(`Failed to stat ${filePath}:`, error);
				}
			}
		} catch (error) {
			// If find command fails, return empty results
			console.warn(`Search failed for ${basePath}:`, error);
		}

		return results;
	}

	/**
	 * Resolves a symbolic link on the remote server to its target path
	 * @param hostId - The host identifier
	 * @param symlinkPath - Path to the symbolic link
	 * @returns The resolved target path
	 */
	public async resolveSymlink(hostId: string, symlinkPath: string): Promise<string> {
		try {
			// Use readlink -f to follow the symlink chain and get the absolute path
			const command = `readlink -f '${symlinkPath}'`;
			const output = await this.executeCommand(hostId, command);

			return output.trim();
		} catch (error) {
			throw new Error(`Failed to resolve symlink ${symlinkPath}: ${error}`);
		}
	}
}
