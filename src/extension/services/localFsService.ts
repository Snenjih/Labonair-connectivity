import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { FileEntry } from '../../common/types';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Local File System Service
 * Provides file system operations for the local machine
 * Returns data in the same format as SftpService for consistency
 */
export class LocalFsService {
	/**
	 * Lists files in a local directory
	 * Returns FileEntry[] matching the SFTP format
	 */
	public async listFiles(dirPath: string): Promise<FileEntry[]> {
		// Resolve home directory
		const resolvedPath = this.resolvePath(dirPath);

		// Handle Windows root/drives listing
		if (process.platform === 'win32' && (resolvedPath === '' || resolvedPath === '/' || resolvedPath === '\\')) {
			return this.getWindowsDrives();
		}

		// Read directory with file types
		const entries = await fs.promises.readdir(resolvedPath, { withFileTypes: true });
		const files: FileEntry[] = [];

		for (const entry of entries) {
			const fullPath = path.join(resolvedPath, entry.name);

			try {
				const stats = await fs.promises.stat(fullPath);

				// Determine file type
				let type: 'd' | '-' | 'l' = '-';
				if (entry.isDirectory()) {
					type = 'd';
				} else if (entry.isSymbolicLink()) {
					type = 'l';
				}

				// Build permissions string (Unix-style)
				const permissions = this.buildPermissionsString(stats.mode);

				const fileEntry: FileEntry = {
					name: entry.name,
					path: this.normalizePath(fullPath),
					size: stats.size,
					type,
					modTime: stats.mtime,
					permissions,
					owner: String(stats.uid || ''),
					group: String(stats.gid || '')
				};

				// Resolve symlink target if it's a symlink
				if (type === 'l') {
					try {
						fileEntry.symlinkTarget = await fs.promises.readlink(fullPath);
					} catch (error) {
						fileEntry.symlinkTarget = '(unresolved)';
					}
				}

				files.push(fileEntry);
			} catch (error) {
				// Skip files we can't stat (permission denied, etc.)
				console.warn(`Failed to stat ${fullPath}:`, error);
			}
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

		return files;
	}

	/**
	 * Gets detailed file information
	 */
	public async stat(filePath: string): Promise<FileEntry> {
		const resolvedPath = this.resolvePath(filePath);
		const stats = await fs.promises.stat(resolvedPath);

		// Determine type
		let type: 'd' | '-' | 'l' = '-';
		if (stats.isDirectory()) {
			type = 'd';
		} else if (stats.isSymbolicLink()) {
			type = 'l';
		}

		// Build permissions string
		const permissions = this.buildPermissionsString(stats.mode);

		// Get file name from path
		const name = path.basename(resolvedPath);

		const fileEntry: FileEntry = {
			name,
			path: this.normalizePath(resolvedPath),
			size: stats.size,
			type,
			modTime: stats.mtime,
			permissions,
			owner: String(stats.uid || ''),
			group: String(stats.gid || '')
		};

		// Resolve symlink target if it's a symlink
		if (type === 'l') {
			try {
				fileEntry.symlinkTarget = await fs.promises.readlink(resolvedPath);
			} catch (error) {
				fileEntry.symlinkTarget = '(unresolved)';
			}
		}

		return fileEntry;
	}

	/**
	 * Deletes a file or directory
	 */
	public async delete(filePath: string): Promise<void> {
		const resolvedPath = this.resolvePath(filePath);
		const stats = await fs.promises.stat(resolvedPath);

		if (stats.isDirectory()) {
			// Remove directory recursively
			await fs.promises.rm(resolvedPath, { recursive: true, force: true });
		} else {
			// Remove file
			await fs.promises.unlink(resolvedPath);
		}
	}

	/**
	 * Creates a directory
	 */
	public async mkdir(dirPath: string): Promise<void> {
		const resolvedPath = this.resolvePath(dirPath);
		await fs.promises.mkdir(resolvedPath, { recursive: false });
	}

	/**
	 * Renames or moves a file/directory
	 */
	public async rename(oldPath: string, newPath: string): Promise<void> {
		const resolvedOldPath = this.resolvePath(oldPath);
		const resolvedNewPath = this.resolvePath(newPath);
		await fs.promises.rename(resolvedOldPath, resolvedNewPath);
	}

	/**
	 * Returns the home directory path
	 */
	public getHomeDir(): string {
		return os.homedir();
	}

	/**
	 * Resolves ~ to home directory and handles path normalization
	 */
	private resolvePath(filePath: string): string {
		if (filePath === '~' || filePath.startsWith('~/')) {
			return filePath.replace('~', os.homedir());
		}

		// Handle empty path or root
		if (filePath === '' || filePath === '/') {
			if (process.platform === 'win32') {
				return ''; // Will trigger drives listing
			}
			return '/';
		}

		// Normalize the path (handles .., ., etc.)
		return path.normalize(filePath);
	}

	/**
	 * Normalizes path for frontend (use forward slashes)
	 * Backend will convert back when needed
	 */
	private normalizePath(filePath: string): string {
		// Convert backslashes to forward slashes for consistency in UI
		return filePath.replace(/\\/g, '/');
	}

	/**
	 * Gets Windows drive letters
	 */
	private async getWindowsDrives(): Promise<FileEntry[]> {
		if (process.platform !== 'win32') {
			return [];
		}

		try {
			// Use wmic to get drive letters
			const { stdout } = await execAsync('wmic logicaldisk get name');
			const lines = stdout.split('\n').map(line => line.trim()).filter(line => line && line !== 'Name');

			const drives: FileEntry[] = [];

			for (const drive of lines) {
				// drive is like "C:"
				const drivePath = drive + '\\';

				try {
					const stats = await fs.promises.stat(drivePath);

					drives.push({
						name: drive,
						path: drive + '/',  // Normalize to forward slash
						size: 0,
						type: 'd',
						modTime: stats.mtime,
						permissions: 'drwxr-xr-x', // Mock permissions for Windows drives
						owner: '',
						group: ''
					});
				} catch (error) {
					// Skip drives we can't access
					console.warn(`Failed to access drive ${drive}:`, error);
				}
			}

			return drives;
		} catch (error) {
			console.error('Failed to get Windows drives:', error);
			return [];
		}
	}

	/**
	 * Builds a Unix-style permissions string from mode bits
	 * On Windows, this provides a reasonable approximation
	 */
	private buildPermissionsString(mode: number): string {
		const types = ['---', '--x', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx'];

		// Determine type character
		let typeChar = '-';
		if ((mode & fs.constants.S_IFMT) === fs.constants.S_IFDIR) {
			typeChar = 'd';
		} else if ((mode & fs.constants.S_IFMT) === fs.constants.S_IFLNK) {
			typeChar = 'l';
		}

		// On Windows, permission bits may not be meaningful, so provide defaults
		if (process.platform === 'win32') {
			// Check if file is read-only (write bit not set)
			const isReadOnly = !(mode & fs.constants.S_IWUSR);
			if (typeChar === 'd') {
				return 'drwxr-xr-x'; // Directories are typically accessible
			}
			return isReadOnly ? '-r-xr-xr-x' : '-rwxr-xr-x';
		}

		// Unix/Mac: Extract permission bits
		const owner = types[(mode >> 6) & 7];
		const group = types[(mode >> 3) & 7];
		const other = types[mode & 7];

		return typeChar + owner + group + other;
	}

	/**
	 * Changes file/directory permissions (Unix/Mac only)
	 */
	public async chmod(filePath: string, mode: string): Promise<void> {
		if (process.platform === 'win32') {
			throw new Error('chmod is not supported on Windows');
		}

		const resolvedPath = this.resolvePath(filePath);
		const modeNum = parseInt(mode, 8);
		await fs.promises.chmod(resolvedPath, modeNum);
	}

	/**
	 * Changes permissions recursively for a directory (Unix/Mac only)
	 */
	public async chmodRecursive(
		dirPath: string,
		mode: string,
		onProgress?: (current: number, total: number, path: string) => void
	): Promise<void> {
		if (process.platform === 'win32') {
			throw new Error('chmod is not supported on Windows');
		}

		const resolvedPath = this.resolvePath(dirPath);
		const modeNum = parseInt(mode, 8);

		// Collect all paths
		const allPaths: string[] = [];

		const walkDirectory = async (currentPath: string): Promise<void> => {
			const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
			allPaths.push(currentPath);

			for (const entry of entries) {
				const fullPath = path.join(currentPath, entry.name);

				if (entry.isDirectory()) {
					await walkDirectory(fullPath);
				} else {
					allPaths.push(fullPath);
				}
			}
		};

		// Walk the directory tree
		await walkDirectory(resolvedPath);

		// Apply chmod to all collected paths
		let current = 0;
		const total = allPaths.length;

		for (const itemPath of allPaths) {
			try {
				await fs.promises.chmod(itemPath, modeNum);
				current++;
				if (onProgress) {
					onProgress(current, total, itemPath);
				}
			} catch (error) {
				console.warn(`Failed to chmod ${itemPath}:`, error);
			}
		}
	}

	/**
	 * Copies a file from source to destination
	 */
	public async copyFile(sourcePath: string, destPath: string): Promise<void> {
		const resolvedSource = this.resolvePath(sourcePath);
		const resolvedDest = this.resolvePath(destPath);
		await fs.promises.copyFile(resolvedSource, resolvedDest);
	}

	/**
	 * Reads file content as string
	 */
	public async readFile(filePath: string, encoding: BufferEncoding = 'utf-8'): Promise<string> {
		const resolvedPath = this.resolvePath(filePath);
		return fs.promises.readFile(resolvedPath, encoding);
	}

	/**
	 * Writes content to a file
	 */
	public async writeFile(filePath: string, content: string, encoding: BufferEncoding = 'utf-8'): Promise<void> {
		const resolvedPath = this.resolvePath(filePath);
		await fs.promises.writeFile(resolvedPath, content, encoding);
	}
}
