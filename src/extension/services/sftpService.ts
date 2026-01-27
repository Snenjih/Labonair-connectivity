import { SFTPWrapper } from 'ssh2';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as vscode from 'vscode';
import * as iconv from 'iconv-lite';
import { Host, FileEntry } from '../../common/types';
import { HostService } from '../hostService';
import { CredentialService } from '../credentialService';
import { ConnectionPool } from './connectionPool';
import { HostKeyService } from '../security/hostKeyService';

/**
 * Cache entry for directory listings with LRU metadata
 */
interface DirectoryCacheEntry {
	files: FileEntry[];
	timestamp: number;
	lastAccess: number;
	accessCount: number;
	size: number; // Estimated memory size in bytes
}

/**
 * SFTP operation timeout configuration
 * Longer timeouts for resource-limited systems (Raspberry Pi, NAS, etc.)
 */
interface TimeoutConfig {
	sftpInit: number;      // SFTP subsystem initialization (slower on low-power devices)
	fileOp: number;        // File operations: readdir, stat, etc.
	pathExpand: number;    // Path expansion with OpenSSH extension
}

/**
 * Retry configuration for failed operations
 */
interface RetryConfig {
	maxRetries: number;
	initialDelay: number;  // Initial delay in ms
	maxDelay: number;      // Maximum delay in ms
	backoffFactor: number; // Exponential backoff multiplier
}

/**
 * Connection health metrics for monitoring
 */
interface ConnectionHealth {
	hostId: string;
	lastCheck: number;
	consecutiveFailures: number;
	averageLatency: number;
	latencyHistory: number[];  // Last 10 measurements
	isHealthy: boolean;
	lastError?: string;
}

/**
 * Transfer statistics for adaptive throttling
 */
interface TransferStats {
	startTime: number;
	bytesTransferred: number;
	lastProgressTime: number;
	stallCount: number;  // Number of times transfer stalled
	averageSpeed: number;
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
	private readonly CACHE_TTL: number;
	private readonly CACHE_MAX_SIZE: number; // Max cache size in bytes (default: 50MB)
	private currentCacheSize: number = 0;
	private readonly PAGINATION_THRESHOLD: number;
	private readonly TIMEOUT_CONFIG: TimeoutConfig;
	private readonly RETRY_CONFIG: RetryConfig;

	// Connection health monitoring
	private connectionHealth: Map<string, ConnectionHealth> = new Map();
	private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();
	private readonly HEALTH_CHECK_INTERVAL: number = 30000; // 30s default
	private readonly LATENCY_HISTORY_SIZE: number = 10;
	private readonly STALL_THRESHOLD: number = 5000; // 5s without progress = stall

	constructor(
		private readonly hostService: HostService,
		private readonly credentialService: CredentialService,
		private readonly hostKeyService: HostKeyService
	) {
		// Load transfer settings from configuration
		const config = vscode.workspace.getConfiguration('labonair.transfer');
		this.CACHE_TTL = config.get<number>('cacheTTL', 30000); // Increased to 30s for better performance
		this.CACHE_MAX_SIZE = config.get<number>('cacheMaxSize', 50 * 1024 * 1024); // 50MB default
		this.PAGINATION_THRESHOLD = config.get<number>('paginationThreshold', 1000);

		// Load timeout settings - use generous timeouts for compatibility with all systems
		// (Raspberry Pi, NAS, older servers, high-latency connections)
		const sftpConfig = vscode.workspace.getConfiguration('labonair.sftp');
		this.TIMEOUT_CONFIG = {
			sftpInit: sftpConfig.get<number>('initTimeout', 30000),      // 30s for SFTP subsystem
			fileOp: sftpConfig.get<number>('operationTimeout', 30000),   // 30s for file operations
			pathExpand: sftpConfig.get<number>('pathExpandTimeout', 15000) // 15s for path expansion
		};

		// Load retry settings for robustness
		this.RETRY_CONFIG = {
			maxRetries: sftpConfig.get<number>('maxRetries', 3),
			initialDelay: sftpConfig.get<number>('retryInitialDelay', 1000),  // 1s
			maxDelay: sftpConfig.get<number>('retryMaxDelay', 10000),         // 10s
			backoffFactor: sftpConfig.get<number>('retryBackoffFactor', 2)    // Exponential x2
		};

		console.log(`[SftpService] Timeout configuration: SFTP Init=${this.TIMEOUT_CONFIG.sftpInit}ms, FileOp=${this.TIMEOUT_CONFIG.fileOp}ms, PathExpand=${this.TIMEOUT_CONFIG.pathExpand}ms`);
		console.log(`[SftpService] Retry configuration: MaxRetries=${this.RETRY_CONFIG.maxRetries}, InitialDelay=${this.RETRY_CONFIG.initialDelay}ms, Backoff=${this.RETRY_CONFIG.backoffFactor}x`);
		console.log(`[SftpService] Health monitoring enabled: Check interval=${this.HEALTH_CHECK_INTERVAL}ms`);
	}

	/**
	 * Starts health monitoring for a connection
	 */
	private startHealthMonitoring(hostId: string): void {
		// Don't start if already monitoring
		if (this.healthCheckIntervals.has(hostId)) {
			return;
		}

		// Initialize health metrics
		this.connectionHealth.set(hostId, {
			hostId,
			lastCheck: Date.now(),
			consecutiveFailures: 0,
			averageLatency: 0,
			latencyHistory: [],
			isHealthy: true
		});

		// Start periodic health checks
		const interval = setInterval(() => {
			this.performHealthCheck(hostId).catch(err => {
				console.warn(`[SftpService] Health check failed for ${hostId}:`, err.message);
			});
		}, this.HEALTH_CHECK_INTERVAL);

		this.healthCheckIntervals.set(hostId, interval);
		console.log(`[SftpService] Started health monitoring for ${hostId}`);
	}

	/**
	 * Stops health monitoring for a connection
	 */
	private stopHealthMonitoring(hostId: string): void {
		const interval = this.healthCheckIntervals.get(hostId);
		if (interval) {
			clearInterval(interval);
			this.healthCheckIntervals.delete(hostId);
			this.connectionHealth.delete(hostId);
			console.log(`[SftpService] Stopped health monitoring for ${hostId}`);
		}
	}

	/**
	 * Performs a health check on the connection
	 */
	private async performHealthCheck(hostId: string): Promise<void> {
		const health = this.connectionHealth.get(hostId);
		if (!health) {
			return;
		}

		const startTime = Date.now();

		try {
			// Quick stat operation to check responsiveness
			const sftp = await this.getSftpSession(hostId);

			await new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error('Health check timeout'));
				}, 5000); // 5s timeout for health check

				sftp.stat('.', (err) => {
					clearTimeout(timeout);
					if (err) {
						reject(err);
					} else {
						resolve();
					}
				});
			});

			// Health check successful
			const latency = Date.now() - startTime;

			// Update latency history
			health.latencyHistory.push(latency);
			if (health.latencyHistory.length > this.LATENCY_HISTORY_SIZE) {
				health.latencyHistory.shift();
			}

			// Calculate average latency
			health.averageLatency = health.latencyHistory.reduce((a, b) => a + b, 0) / health.latencyHistory.length;

			// Reset failure count
			health.consecutiveFailures = 0;
			health.isHealthy = true;
			health.lastCheck = Date.now();
			delete health.lastError;

			// Log if latency is high
			if (health.averageLatency > 1000) {
				console.warn(`[SftpService] High latency detected for ${hostId}: ${Math.round(health.averageLatency)}ms average`);
			}

		} catch (error: any) {
			// Health check failed
			health.consecutiveFailures++;
			health.lastCheck = Date.now();
			health.lastError = error.message;

			console.warn(`[SftpService] Health check failed for ${hostId} (${health.consecutiveFailures} consecutive): ${error.message}`);

			// Mark as unhealthy after 3 consecutive failures
			if (health.consecutiveFailures >= 3) {
				health.isHealthy = false;
				console.error(`[SftpService] Connection ${hostId} marked as unhealthy. Clearing session.`);

				// Clear the problematic session to force reconnection
				this.activeSessions.delete(hostId);
				ConnectionPool.release(hostId);
			}
		}
	}

	/**
	 * Gets connection health status
	 */
	public getConnectionHealth(hostId: string): ConnectionHealth | undefined {
		return this.connectionHealth.get(hostId);
	}

	/**
	 * Checks if connection should be preemptively reconnected
	 */
	private shouldReconnect(hostId: string): boolean {
		const health = this.connectionHealth.get(hostId);
		if (!health) {
			return false;
		}

		// Reconnect if marked unhealthy
		if (!health.isHealthy) {
			return true;
		}

		// Reconnect if average latency is very high (>5s)
		if (health.averageLatency > 5000) {
			console.warn(`[SftpService] Preemptive reconnection due to high latency: ${Math.round(health.averageLatency)}ms`);
			return true;
		}

		return false;
	}

	/**
	 * Gets or creates an SFTP session for a host
	 * Uses ConnectionPool for shared SSH connection
	 * Implements fallback and diagnostics for problematic servers
	 */
	private async getSftpSession(hostId: string): Promise<SFTPWrapper> {
		// Check if we should preemptively reconnect
		if (this.shouldReconnect(hostId)) {
			console.log(`[SftpService] Preemptive reconnection for ${hostId}`);
			this.activeSessions.delete(hostId);
			ConnectionPool.release(hostId);
		}

		// Check if session already exists and is still valid
		const existing = this.activeSessions.get(hostId);
		if (existing) {
			// Validate that the session is still responsive
			const isValid = await this.validateSftpSession(existing.sftp, hostId);
			if (isValid) {
				return existing.sftp;
			}
			// Session is dead, will reconnect below
			console.log(`[SftpService] Existing SFTP session for ${hostId} is unresponsive, creating new connection`);
			ConnectionPool.release(hostId);
		}

		// Get shared SSH connection from pool
		const host = await this.getHost(hostId);
		const client = await ConnectionPool.acquire(
			host,
			this.hostService,
			this.credentialService,
			this.hostKeyService
		);

		// Request SFTP subsystem with configurable timeout and retry logic
		return new Promise((resolve, reject) => {
			let timeoutHandle: NodeJS.Timeout | null = null;
			let isResolved = false;

			const cleanup = () => {
				if (timeoutHandle) clearTimeout(timeoutHandle);
				isResolved = true;
			};

			const attemptSftpConnection = (attempt: number = 1) => {
				timeoutHandle = setTimeout(() => {
					isResolved = true;
					const timeoutMs = this.TIMEOUT_CONFIG.sftpInit;

					// On timeout, try to reconnect instead of failing immediately
					if (attempt === 1) {
						console.warn(`[SftpService] SFTP subsystem init attempt ${attempt} timeout after ${timeoutMs}ms, retrying with fresh connection...`);
						ConnectionPool.release(hostId);

						// Force reconnect on next attempt
						ConnectionPool.acquire(
							host,
							this.hostService,
							this.credentialService,
							this.hostKeyService
						).then(newClient => {
							isResolved = false;
							attemptSftpConnection(2);
						}).catch(err => {
							reject(new Error(`Failed to reconnect after SFTP timeout: ${err.message}`));
						});
					} else {
						// Second attempt also failed
						ConnectionPool.release(hostId);
						reject(new Error(`SFTP subsystem failed to initialize after ${timeoutMs}ms (attempt ${attempt}). This typically means: 1) SFTP is disabled on server, 2) Server is overloaded, 3) Firewall/NAT issues. Try increasing sftp.initTimeout in settings or check server logs.`));
					}
				}, this.TIMEOUT_CONFIG.sftpInit);

				client.sftp((err, sftp) => {
					if (isResolved) return; // Ignore callback if already resolved/rejected
					cleanup();

					if (err) {
						console.error(`[SftpService] SFTP subsystem error: ${err.message}`);
						ConnectionPool.release(hostId);
						reject(err);
						return;
					}

					// Cache the SFTP wrapper (Client is managed by ConnectionPool)
					this.activeSessions.set(hostId, { sftp });

					// Start health monitoring for this connection
					this.startHealthMonitoring(hostId);

					resolve(sftp);
				});
			};

			attemptSftpConnection(1);
		});
	}

	/**
	 * Validates that an SFTP session is still responsive
	 * Quick stat check to ensure connection is alive
	 */
	private validateSftpSession(sftp: SFTPWrapper, hostId: string): Promise<boolean> {
		return new Promise((resolve) => {
			const timeout = setTimeout(() => {
				console.warn(`[SftpService] SFTP session validation timed out for ${hostId}`);
				this.activeSessions.delete(hostId);
				resolve(false);
			}, 5000);

			// Try a quick stat on root directory
			sftp.stat('.', (err) => {
				clearTimeout(timeout);
				if (err) {
					console.warn(`[SftpService] SFTP session validation failed: ${err.message}`);
					this.activeSessions.delete(hostId);
					resolve(false);
				} else {
					resolve(true);
				}
			});
		});
	}

	/**
	 * Wraps SFTP operations with a timeout to prevent hanging connections
	 */
	private withTimeout<T>(operation: Promise<T>, timeoutMs: number = 10000, operationName: string = 'SFTP operation'): Promise<T> {
		return Promise.race([
			operation,
			new Promise<T>((_, reject) =>
				setTimeout(() => reject(new Error(`Timeout during ${operationName} - connection may be unresponsive`)), timeoutMs)
			)
		]);
	}

	/**
	 * Checks if an error is retryable (temporary network issues)
	 */
	private isRetryableError(error: any): boolean {
		const errorMessage = error.message || error.toString();
		const retryablePatterns = [
			'ECONNRESET',
			'ETIMEDOUT',
			'ENOTFOUND',
			'EAI_AGAIN',
			'EPIPE',
			'ECONNREFUSED',
			'Connection lost',
			'Connection closed',
			'socket hang up',
			'network error',
			'timeout',
			'timed out'
		];

		return retryablePatterns.some(pattern =>
			errorMessage.toLowerCase().includes(pattern.toLowerCase())
		);
	}

	/**
	 * Retries an operation with exponential backoff
	 * @param operation - Operation to retry
	 * @param operationName - Name for logging
	 * @param attempt - Current attempt number (internal)
	 */
	private async withRetry<T>(
		operation: () => Promise<T>,
		operationName: string,
		attempt: number = 0
	): Promise<T> {
		try {
			return await operation();
		} catch (error: any) {
			// Check if we should retry
			if (attempt < this.RETRY_CONFIG.maxRetries && this.isRetryableError(error)) {
				// Calculate delay with exponential backoff
				const delay = Math.min(
					this.RETRY_CONFIG.initialDelay * Math.pow(this.RETRY_CONFIG.backoffFactor, attempt),
					this.RETRY_CONFIG.maxDelay
				);

				console.warn(`[SftpService] ${operationName} failed (attempt ${attempt + 1}/${this.RETRY_CONFIG.maxRetries}): ${error.message}. Retrying in ${delay}ms...`);

				// Wait before retry
				await new Promise(resolve => setTimeout(resolve, delay));

				// Retry operation
				return this.withRetry(operation, operationName, attempt + 1);
			}

			// No more retries or non-retryable error
			if (attempt > 0) {
				console.error(`[SftpService] ${operationName} failed after ${attempt + 1} attempts: ${error.message}`);
			}
			throw error;
		}
	}

	/**
	 * Expands tilde paths (~, ~/...) to absolute paths using OpenSSH extension
	 * Falls back to '.' (current directory) if expansion fails
	 */
	private async expandPath(sftp: SFTPWrapper, remotePath: string): Promise<string> {
		// Only expand if path starts with tilde
		if (!remotePath.startsWith('~')) {
			return remotePath;
		}

		return new Promise((resolve) => {
			const timeout = setTimeout(() => {
				// Timeout: use fallback (this is common on servers without OpenSSH extension or slow connections)
				console.warn(`Path expansion timeout for '${remotePath}' after ${this.TIMEOUT_CONFIG.pathExpand}ms, using current directory as fallback`);
				resolve('.');
			}, this.TIMEOUT_CONFIG.pathExpand);

			sftp.ext_openssh_expandPath(remotePath, (err, expandedPath) => {
				clearTimeout(timeout);
				if (err) {
					// OpenSSH extension not available or connection error
					// Fallback to current directory which always works
					console.warn(`Failed to expand path '${remotePath}', falling back to current directory:`, err.message);
					resolve('.');
				} else {
					resolve(expandedPath);
				}
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
	 * Note: Directory sizes are set to -1 to indicate they need manual calculation
	 */
	public async listFiles(hostId: string, remotePath: string, useCache: boolean = true): Promise<FileEntry[]> {
		const sftp = await this.getSftpSession(hostId);
		const host = await this.getHost(hostId);
		const encoding = host.encoding || 'utf-8';

		// Expand tilde paths to absolute paths
		const expandedPath = await this.expandPath(sftp, remotePath);

		// Check cache first (use expanded path for cache key)
		const cacheKey = `${hostId}:${expandedPath}`;
		if (useCache) {
			const cached = this.directoryCache.get(cacheKey);
			if (cached && (Date.now() - cached.timestamp < this.CACHE_TTL)) {
				// Update access metadata
				cached.lastAccess = Date.now();
				cached.accessCount++;
				return cached.files;
			}
		}

		return new Promise((resolve, reject) => {
			let timeoutHandle: NodeJS.Timeout | null = null;
			let isResolved = false;

			const cleanup = () => {
				if (timeoutHandle) clearTimeout(timeoutHandle);
				isResolved = true;
			};

			timeoutHandle = setTimeout(() => {
				isResolved = true;
				// Kill the connection on timeout - it's likely in a bad state
				console.warn(`[SftpService] Timeout during readdir for '${expandedPath}', clearing SFTP session cache`);
				this.activeSessions.delete(hostId);
				ConnectionPool.release(hostId);
				reject(new Error(`Timeout listing directory '${expandedPath}' after ${this.TIMEOUT_CONFIG.fileOp}ms - SFTP session may be unresponsive. The connection has been reset. Try again or increase sftp.operationTimeout in settings.`));
			}, this.TIMEOUT_CONFIG.fileOp);

			sftp.readdir(expandedPath, async (err, list) => {
				if (isResolved) return; // Ignore callback if already timed out or resolved
				cleanup();

				if (err) {
					// Check if it's a permission or invalid path error
					const isPermissionError = err.message.includes('Permission') || err.message.includes('permission');
					const isInvalidPath = err.message.includes('No such file') || err.message.includes('not found');

					if (!isPermissionError && !isInvalidPath) {
						// For other errors, clear the session - it might be corrupted
						console.warn(`[SftpService] Clearing SFTP session due to readdir error: ${err.message}`);
						this.activeSessions.delete(hostId);
					}

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
					const filePath = path.posix.join(expandedPath, decodedFilename);

					// For directories, set size to -1 to indicate it needs calculation
					// For files, use actual size
					let fileSize = item.attrs.size || 0;
					if (type === 'd') {
						fileSize = -1; // Mark directories for manual size calculation
					}

					const fileEntry: FileEntry = {
						name: decodedFilename,
						path: filePath,
						size: fileSize,
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

				// Cache the result with LRU metadata
				const cacheEntry: DirectoryCacheEntry = {
					files,
					timestamp: Date.now(),
					lastAccess: Date.now(),
					accessCount: 1,
					size: this.estimateCacheSize(files)
				};

				this.addToCache(cacheKey, cacheEntry);

				resolve(files);
			});
		});
	}

	/**
	 * Reads a symlink target
	 */
	private async readSymlink(sftp: SFTPWrapper, linkPath: string): Promise<string> {
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(new Error(`Timeout reading symlink after ${this.TIMEOUT_CONFIG.fileOp}ms`));
			}, this.TIMEOUT_CONFIG.fileOp);

			sftp.readlink(linkPath, (err, target) => {
				clearTimeout(timeout);
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

		// Expand tilde paths to absolute paths
		const expandedPath = await this.expandPath(sftp, remotePath);

		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(new Error(`Timeout getting file stats for '${expandedPath}' after ${this.TIMEOUT_CONFIG.fileOp}ms - the server may be overloaded. Try increasing sftp.operationTimeout in settings.`));
			}, this.TIMEOUT_CONFIG.fileOp);

			sftp.stat(expandedPath, (err, stats) => {
				clearTimeout(timeout);
				if (err) {
					reject(new Error(`Failed to stat file: ${err.message}`));
					return;
				}

				// Get file name from path
				const name = expandedPath.split('/').pop() || expandedPath;

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
					path: expandedPath,
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
	 * Downloads a file from remote to local with retry support
	 */
	public async getFile(
		hostId: string,
		remotePath: string,
		localPath: string,
		onProgress?: (progress: number, speed: string) => void
	): Promise<void> {
		return this.withRetry(
			() => this._getFileInternal(hostId, remotePath, localPath, onProgress),
			`Download ${remotePath}`
		);
	}

	/**
	 * Internal download implementation (called by retry wrapper)
	 * Supports resuming partial downloads via .part files
	 */
	private async _getFileInternal(
		hostId: string,
		remotePath: string,
		localPath: string,
		onProgress?: (progress: number, speed: string) => void
	): Promise<void> {
		const sftp = await this.getSftpSession(hostId);

		// Expand tilde paths to absolute paths
		const expandedPath = await this.expandPath(sftp, remotePath);

		return new Promise((resolve, reject) => {
			// Get file size for progress tracking
			const timeout = setTimeout(() => {
				reject(new Error(`Timeout getting remote file stats after ${this.TIMEOUT_CONFIG.fileOp}ms - try increasing sftp.operationTimeout in settings`));
			}, this.TIMEOUT_CONFIG.fileOp);

			sftp.stat(expandedPath, async (err, stats) => {
				clearTimeout(timeout);
				if (err) {
					reject(new Error(`Failed to stat remote file: ${err.message}`));
					return;
				}

				const totalSize = stats.size;
				const partPath = localPath + '.part';
				let startPos = 0;

				// Check if partial file exists for resume
				try {
					if (fs.existsSync(partPath)) {
						const partStats = await fs.promises.stat(partPath);
						startPos = partStats.size;

						// Only resume if partial file is smaller than total
						if (startPos >= totalSize) {
							// Partial file is complete or larger, remove and restart
							await fs.promises.unlink(partPath);
							startPos = 0;
						} else {
							console.log(`[SftpService] Resuming download from byte ${startPos} of ${totalSize}`);
						}
					}
				} catch (error) {
					console.warn(`[SftpService] Could not check partial file: ${error}`);
					startPos = 0;
				}

				let transferred = startPos;
				const startTime = Date.now();
				let lastProgressTime = Date.now();
				let lastTransferred = transferred;

				// Stall detection timer
				const stallCheckInterval = setInterval(() => {
					const timeSinceProgress = Date.now() - lastProgressTime;
					const bytesSinceCheck = transferred - lastTransferred;

					// If no progress for STALL_THRESHOLD ms, log warning
					if (timeSinceProgress > this.STALL_THRESHOLD && bytesSinceCheck === 0) {
						console.warn(`[SftpService] Transfer stalled for ${timeSinceProgress}ms at ${transferred}/${totalSize} bytes`);

						// Update connection health
						const health = this.connectionHealth.get(hostId);
						if (health) {
							health.consecutiveFailures++;
						}
					}

					lastTransferred = transferred;
				}, 2000); // Check every 2s

				// Create read stream with start position for resume
				const readStream = sftp.createReadStream(expandedPath, { start: startPos });
				const writeStream = fs.createWriteStream(partPath, { flags: 'a' }); // Append mode

				readStream.on('data', (chunk: Buffer) => {
					transferred += chunk.length;
					lastProgressTime = Date.now(); // Update progress timestamp

					if (onProgress) {
						const progress = Math.round((transferred / totalSize) * 100);
						const elapsed = (Date.now() - startTime) / 1000;
						const speed = this.formatSpeed(transferred / elapsed);
						onProgress(progress, speed);
					}
				});

				readStream.on('error', (err: Error) => {
					clearInterval(stallCheckInterval);
					writeStream.close();
					// Keep .part file for resume
					reject(new Error(`Download failed: ${err.message}`));
				});

				writeStream.on('error', (err: Error) => {
					clearInterval(stallCheckInterval);
					readStream.destroy();
					reject(new Error(`Write failed: ${err.message}`));
				});

				writeStream.on('finish', async () => {
					clearInterval(stallCheckInterval);

					try {
						// Verify file size
						const finalStats = await fs.promises.stat(partPath);
						if (finalStats.size !== totalSize) {
							reject(new Error(`Download incomplete: expected ${totalSize} bytes, got ${finalStats.size} bytes`));
							return;
						}

						// Optional: Verify checksum if enabled
						const config = vscode.workspace.getConfiguration('labonair.transfer');
						const verifyChecksum = config.get<boolean>('verifyChecksum', false);

						if (verifyChecksum) {
							try {
								// Calculate local file checksum
								const localChecksum = await this.calculateLocalChecksum(partPath, 'md5');

								// Calculate remote file checksum
								const remoteChecksum = await this.calculateChecksum(hostId, expandedPath, 'md5');

								if (localChecksum !== remoteChecksum) {
									reject(new Error(`Checksum mismatch: local=${localChecksum}, remote=${remoteChecksum}. File may be corrupted.`));
									return;
								}

								console.log(`[SftpService] Checksum verified: ${localChecksum}`);
							} catch (checksumError) {
								console.warn(`[SftpService] Checksum verification failed: ${checksumError}`);
								// Continue without checksum verification
							}
						}

						// Download complete, rename .part to final name
						await fs.promises.rename(partPath, localPath);
						resolve();
					} catch (error) {
						reject(new Error(`Failed to finalize download: ${error}`));
					}
				});

				readStream.pipe(writeStream);
			});
		});
	}

	/**
	 * Downloads a directory recursively from remote to local
	 * @param hostId - Host identifier
	 * @param remotePath - Remote directory path
	 * @param localPath - Local directory path
	 * @param onProgress - Optional callback for progress updates
	 */
	public async getDirectory(
		hostId: string,
		remotePath: string,
		localPath: string,
		onProgress?: (current: number, total: number, currentFile: string) => void
	): Promise<void> {
		const sftp = await this.getSftpSession(hostId);
		const expandedPath = await this.expandPath(sftp, remotePath);

		// Create local directory
		await fs.promises.mkdir(localPath, { recursive: true });

		let filesProcessed = 0;
		let totalFiles = 0;

		// Count total files first
		const countFiles = async (dirPath: string): Promise<number> => {
			let count = 0;
			const entries = await new Promise<any[]>((resolve, reject) => {
				const timeout = setTimeout(() => reject(new Error('Timeout counting files')), this.TIMEOUT_CONFIG.fileOp);
				sftp.readdir(dirPath, (err, list) => {
					clearTimeout(timeout);
					if (err) {
						reject(err);
					} else {
						resolve(list);
					}
				});
			});

			for (const entry of entries) {
				const entryPath = path.posix.join(dirPath, entry.filename);
				if (entry.attrs.isDirectory()) {
					count += await countFiles(entryPath);
				} else {
					count++;
				}
			}
			return count;
		};

		// Recursively download directory
		const downloadDir = async (remoteDirPath: string, localDirPath: string): Promise<void> => {
			const entries = await new Promise<any[]>((resolve, reject) => {
				const timeout = setTimeout(() => reject(new Error('Timeout reading directory')), this.TIMEOUT_CONFIG.fileOp);
				sftp.readdir(remoteDirPath, (err, list) => {
					clearTimeout(timeout);
					if (err) {
						reject(err);
					} else {
						resolve(list);
					}
				});
			});

			for (const entry of entries) {
				const remoteEntryPath = path.posix.join(remoteDirPath, entry.filename);
				const localEntryPath = path.join(localDirPath, entry.filename);

				if (entry.attrs.isDirectory()) {
					// Create subdirectory
					await fs.promises.mkdir(localEntryPath, { recursive: true });
					// Recursively download subdirectory
					await downloadDir(remoteEntryPath, localEntryPath);
				} else {
					// Download file
					await this.getFile(hostId, remoteEntryPath, localEntryPath);
					filesProcessed++;

					if (onProgress) {
						onProgress(filesProcessed, totalFiles, entry.filename);
					}
				}
			}
		};

		// Count files and download
		totalFiles = await countFiles(expandedPath);
		await downloadDir(expandedPath, localPath);
	}

	/**
	 * Uploads a directory recursively from local to remote
	 * @param hostId - Host identifier
	 * @param localPath - Local directory path
	 * @param remotePath - Remote directory path
	 * @param onProgress - Optional callback for progress updates
	 */
	public async putDirectory(
		hostId: string,
		localPath: string,
		remotePath: string,
		onProgress?: (current: number, total: number, currentFile: string) => void
	): Promise<void> {
		const sftp = await this.getSftpSession(hostId);
		const expandedPath = await this.expandPath(sftp, remotePath);

		let filesProcessed = 0;
		let totalFiles = 0;

		// Count total files first
		const countLocalFiles = async (dirPath: string): Promise<number> => {
			let count = 0;
			const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

			for (const entry of entries) {
				const entryPath = path.join(dirPath, entry.name);
				if (entry.isDirectory()) {
					count += await countLocalFiles(entryPath);
				} else {
					count++;
				}
			}
			return count;
		};

		// Create remote directory
		await new Promise<void>((resolve, reject) => {
			const timeout = setTimeout(() => reject(new Error('Timeout creating directory')), this.TIMEOUT_CONFIG.fileOp);
			sftp.mkdir(expandedPath, (err) => {
				clearTimeout(timeout);
				if (err && !err.message.includes('File exists')) {
					reject(err);
				} else {
					resolve();
				}
			});
		});

		// Recursively upload directory
		const uploadDir = async (localDirPath: string, remoteDirPath: string): Promise<void> => {
			const entries = await fs.promises.readdir(localDirPath, { withFileTypes: true });

			for (const entry of entries) {
				const localEntryPath = path.join(localDirPath, entry.name);
				const remoteEntryPath = path.posix.join(remoteDirPath, entry.name);

				if (entry.isDirectory()) {
					// Create remote subdirectory
					await new Promise<void>((resolve, reject) => {
						const timeout = setTimeout(() => reject(new Error('Timeout creating subdirectory')), this.TIMEOUT_CONFIG.fileOp);
						sftp.mkdir(remoteEntryPath, (err) => {
							clearTimeout(timeout);
							if (err && !err.message.includes('File exists')) {
								reject(err);
							} else {
								resolve();
							}
						});
					});
					// Recursively upload subdirectory
					await uploadDir(localEntryPath, remoteEntryPath);
				} else {
					// Upload file
					await this.putFile(hostId, localEntryPath, remoteEntryPath);
					filesProcessed++;

					if (onProgress) {
						onProgress(filesProcessed, totalFiles, entry.name);
					}
				}
			}
		};

		// Count files and upload
		totalFiles = await countLocalFiles(localPath);
		await uploadDir(localPath, expandedPath);
	}

	/**
	 * Uploads a file from local to remote with retry support
	 */
	public async putFile(
		hostId: string,
		localPath: string,
		remotePath: string,
		onProgress?: (progress: number, speed: string) => void
	): Promise<void> {
		return this.withRetry(
			() => this._putFileInternal(hostId, localPath, remotePath, onProgress),
			`Upload ${localPath}`
		);
	}

	/**
	 * Internal upload implementation (called by retry wrapper)
	 */
	private async _putFileInternal(
		hostId: string,
		localPath: string,
		remotePath: string,
		onProgress?: (progress: number, speed: string) => void
	): Promise<void> {
		const sftp = await this.getSftpSession(hostId);

		// Expand tilde paths to absolute paths
		const expandedPath = await this.expandPath(sftp, remotePath);

		// Get local file size (async)
		const stats = await fs.promises.stat(localPath);
		const totalSize = stats.size;

		return new Promise((resolve, reject) => {
			let transferred = 0;
			const startTime = Date.now();
			let lastProgressTime = Date.now();
			let lastTransferred = 0;

			// Stall detection timer
			const stallCheckInterval = setInterval(() => {
				const timeSinceProgress = Date.now() - lastProgressTime;
				const bytesSinceCheck = transferred - lastTransferred;

				// If no progress for STALL_THRESHOLD ms, log warning
				if (timeSinceProgress > this.STALL_THRESHOLD && bytesSinceCheck === 0) {
					console.warn(`[SftpService] Upload stalled for ${timeSinceProgress}ms at ${transferred}/${totalSize} bytes`);

					// Update connection health
					const health = this.connectionHealth.get(hostId);
					if (health) {
						health.consecutiveFailures++;
					}
				}

				lastTransferred = transferred;
			}, 2000); // Check every 2s

			const readStream = fs.createReadStream(localPath);
			const writeStream = sftp.createWriteStream(expandedPath);

			readStream.on('data', (chunk: Buffer) => {
				transferred += chunk.length;
				lastProgressTime = Date.now(); // Update progress timestamp

				if (onProgress) {
					const progress = Math.round((transferred / totalSize) * 100);
					const elapsed = (Date.now() - startTime) / 1000;
					const speed = this.formatSpeed(transferred / elapsed);
					onProgress(progress, speed);
				}
			});

			readStream.on('error', (err: Error) => {
				clearInterval(stallCheckInterval);
				writeStream.end();
				reject(new Error(`Read failed: ${err.message}`));
			});

			writeStream.on('error', (err: Error) => {
				clearInterval(stallCheckInterval);
				readStream.destroy();
				reject(new Error(`Upload failed: ${err.message}`));
			});

			writeStream.on('finish', () => {
				clearInterval(stallCheckInterval);
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

		// Expand tilde paths to absolute paths
		const expandedPath = await this.expandPath(sftp, remotePath);

		return new Promise((resolve, reject) => {
			// First check if it's a directory
			const timeout = setTimeout(() => {
				reject(new Error(`Timeout checking file type after ${this.TIMEOUT_CONFIG.fileOp}ms - try increasing sftp.operationTimeout in settings`));
			}, this.TIMEOUT_CONFIG.fileOp);

			sftp.stat(expandedPath, (statErr, stats) => {
				clearTimeout(timeout);
				if (statErr) {
					reject(new Error(`Failed to stat path: ${statErr.message}`));
					return;
				}

				if (stats.isDirectory()) {
					// Remove directory
					const rmTimeout = setTimeout(() => {
						reject(new Error(`Timeout removing directory after ${this.TIMEOUT_CONFIG.fileOp}ms - try increasing sftp.operationTimeout in settings`));
					}, this.TIMEOUT_CONFIG.fileOp);

					sftp.rmdir(expandedPath, (err) => {
						clearTimeout(rmTimeout);
						if (err) {
							reject(new Error(`Failed to remove directory: ${err.message}`));
						} else {
							resolve();
						}
					});
				} else {
					// Remove file
					const rmTimeout = setTimeout(() => {
						reject(new Error(`Timeout removing file after ${this.TIMEOUT_CONFIG.fileOp}ms - try increasing sftp.operationTimeout in settings`));
					}, this.TIMEOUT_CONFIG.fileOp);

					sftp.unlink(expandedPath, (err) => {
						clearTimeout(rmTimeout);
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

		// Expand tilde paths to absolute paths
		const expandedPath = await this.expandPath(sftp, remotePath);

		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(new Error(`Timeout creating directory after ${this.TIMEOUT_CONFIG.fileOp}ms - try increasing sftp.operationTimeout in settings`));
			}, this.TIMEOUT_CONFIG.fileOp);

			sftp.mkdir(expandedPath, (err) => {
				clearTimeout(timeout);
				if (err) {
					reject(new Error(`Failed to create directory: ${err.message}`));
				} else {
					// Invalidate directory cache for parent directory
					this.invalidatePath(hostId, expandedPath);
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

		// Expand tilde paths to absolute paths
		const expandedOldPath = await this.expandPath(sftp, oldPath);
		const expandedNewPath = await this.expandPath(sftp, newPath);

		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(new Error(`Timeout renaming file after ${this.TIMEOUT_CONFIG.fileOp}ms - try increasing sftp.operationTimeout in settings`));
			}, this.TIMEOUT_CONFIG.fileOp);

			sftp.rename(expandedOldPath, expandedNewPath, (err) => {
				clearTimeout(timeout);
				if (err) {
					reject(new Error(`Failed to rename: ${err.message}`));
				} else {
					// Invalidate cache for both old and new parent directories
					this.invalidatePath(hostId, expandedOldPath);
					this.invalidatePath(hostId, expandedNewPath);
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
		const sftp = await this.getSftpSession(hostId);

		// Expand tilde paths to absolute paths
		const expandedSourcePath = await this.expandPath(sftp, sourcePath);
		const expandedDestPath = await this.expandPath(sftp, destPath);

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
				const command = `cp -r "${expandedSourcePath}" "${expandedDestPath}"`;

				const timeout = setTimeout(() => {
					console.warn('SSH shell copy timeout, falling back to SFTP method');
					this.copyViaSftp(hostId, expandedSourcePath, expandedDestPath).then(resolve).catch(reject);
				}, this.TIMEOUT_CONFIG.fileOp);

				client.exec(command, (err, stream) => {
					if (err) {
						clearTimeout(timeout);
						// Shell not available, fall back to SFTP method
						console.warn('SSH shell copy failed, falling back to SFTP method:', err);
						this.copyViaSftp(hostId, expandedSourcePath, expandedDestPath).then(resolve).catch(reject);
						return;
					}

					let errorOutput = '';

					stream.stderr.on('data', (data: Buffer) => {
						errorOutput += data.toString();
					});

					stream.on('close', (code: number) => {
						clearTimeout(timeout);
						if (code === 0) {
							// Clear cache for target directory
							this.invalidatePath(hostId, expandedDestPath);
							resolve();
						} else {
							// Shell command failed, try SFTP fallback
							console.warn(`SSH shell copy failed with code ${code}, falling back to SFTP method:`, errorOutput);
							this.copyViaSftp(hostId, expandedSourcePath, expandedDestPath).then(resolve).catch(reject);
						}
					});
				});
			});
		} catch (error) {
			// Connection failed, try SFTP fallback
			console.warn('Failed to acquire SSH connection for copy, falling back to SFTP method:', error);
			return this.copyViaSftp(hostId, expandedSourcePath, expandedDestPath);
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
						this.invalidatePath(hostId, destPath);
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
		this.invalidatePath(hostId, destPath);
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
	 * Estimates the memory size of a cache entry
	 */
	private estimateCacheSize(files: FileEntry[]): number {
		// Rough estimation: JSON string length as proxy for memory usage
		return JSON.stringify(files).length;
	}

	/**
	 * Adds entry to cache with LRU eviction if needed
	 */
	private addToCache(key: string, entry: DirectoryCacheEntry): void {
		// Check if we need to evict entries
		while (this.currentCacheSize + entry.size > this.CACHE_MAX_SIZE && this.directoryCache.size > 0) {
			this.evictLRU();
		}

		// Remove old entry if exists
		const oldEntry = this.directoryCache.get(key);
		if (oldEntry) {
			this.currentCacheSize -= oldEntry.size;
		}

		// Add new entry
		this.directoryCache.set(key, entry);
		this.currentCacheSize += entry.size;
	}

	/**
	 * Evicts the least recently used cache entry
	 */
	private evictLRU(): void {
		let oldestKey: string | null = null;
		let oldestAccess = Date.now();

		for (const [key, entry] of this.directoryCache.entries()) {
			if (entry.lastAccess < oldestAccess) {
				oldestAccess = entry.lastAccess;
				oldestKey = key;
			}
		}

		if (oldestKey) {
			const entry = this.directoryCache.get(oldestKey);
			if (entry) {
				this.currentCacheSize -= entry.size;
			}
			this.directoryCache.delete(oldestKey);
			console.log(`[SftpService] Evicted LRU cache entry: ${oldestKey}`);
		}
	}

	/**
	 * Smart cache invalidation - only invalidates affected paths
	 * @param hostId - Host identifier
	 * @param affectedPath - Path that was modified
	 */
	private invalidatePath(hostId: string, affectedPath: string): void {
		const parentPath = affectedPath.split('/').slice(0, -1).join('/') || '/';
		const cacheKey = `${hostId}:${parentPath}`;

		const entry = this.directoryCache.get(cacheKey);
		if (entry) {
			this.currentCacheSize -= entry.size;
			this.directoryCache.delete(cacheKey);
		}
	}

	/**
	 * Clears the directory cache for a specific path or all paths
	 */
	public clearCache(hostId?: string, remotePath?: string): void {
		if (hostId && remotePath) {
			const cacheKey = `${hostId}:${remotePath}`;
			const entry = this.directoryCache.get(cacheKey);
			if (entry) {
				this.currentCacheSize -= entry.size;
			}
			this.directoryCache.delete(cacheKey);
		} else if (hostId) {
			// Clear all cache entries for this host
			for (const key of this.directoryCache.keys()) {
				if (key.startsWith(`${hostId}:`)) {
					const entry = this.directoryCache.get(key);
					if (entry) {
						this.currentCacheSize -= entry.size;
					}
					this.directoryCache.delete(key);
				}
			}
		} else {
			// Clear entire cache
			this.directoryCache.clear();
			this.currentCacheSize = 0;
		}
	}

	/**
	 * Closes a specific SFTP session
	 * Releases the connection back to the pool
	 */
	public closeSession(hostId: string): void {
		const session = this.activeSessions.get(hostId);
		if (session) {
			// Stop health monitoring
			this.stopHealthMonitoring(hostId);

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
		// Stop all health monitoring
		for (const hostId of this.healthCheckIntervals.keys()) {
			this.stopHealthMonitoring(hostId);
		}

		// Release all connections
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
		const sftp = await this.getSftpSession(hostId);

		// Expand tilde paths to absolute paths
		const expandedArchivePath = await this.expandPath(sftp, archivePath);

		const client = await ConnectionPool.acquire(
			host,
			this.hostService,
			this.credentialService,
			this.hostKeyService
		);

		return new Promise((resolve, reject) => {
			// Detect archive type
			const ext = expandedArchivePath.toLowerCase();
			let command: string;

			if (ext.endsWith('.zip')) {
				// Extract zip file
				command = `unzip -o '${expandedArchivePath}' -d '${expandedArchivePath.substring(0, expandedArchivePath.lastIndexOf('/'))}'`;
			} else if (ext.endsWith('.tar.gz') || ext.endsWith('.tgz')) {
				// Extract tar.gz file
				command = `tar -xzf '${expandedArchivePath}' -C '${expandedArchivePath.substring(0, expandedArchivePath.lastIndexOf('/'))}'`;
			} else if (ext.endsWith('.tar')) {
				// Extract tar file
				command = `tar -xf '${expandedArchivePath}' -C '${expandedArchivePath.substring(0, expandedArchivePath.lastIndexOf('/'))}'`;
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
		const sftp = await this.getSftpSession(hostId);

		// Expand tilde paths to absolute paths for all input paths
		const expandedPaths = await Promise.all(paths.map(p => this.expandPath(sftp, p)));
		const expandedArchiveName = await this.expandPath(sftp, archiveName);

		const client = await ConnectionPool.acquire(
			host,
			this.hostService,
			this.credentialService,
			this.hostKeyService
		);

		return new Promise((resolve, reject) => {
			if (expandedPaths.length === 0) {
				reject(new Error('No paths specified for compression'));
				return;
			}

			// Build command based on archive type
			let command: string;
			const quotedPaths = expandedPaths.map(p => `'${p}'`).join(' ');

			if (archiveType === 'zip') {
				// Create zip archive
				command = `zip -r '${expandedArchiveName}' ${quotedPaths}`;
			} else if (archiveType === 'tar.gz') {
				// Create tar.gz archive
				command = `tar -czf '${expandedArchiveName}' ${quotedPaths}`;
			} else if (archiveType === 'tar') {
				// Create tar archive
				command = `tar -cf '${expandedArchiveName}' ${quotedPaths}`;
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

		// Expand tilde paths to absolute paths
		const expandedPath = await this.expandPath(sftp, path);

		// Convert octal string to number
		const modeNum = parseInt(mode, 8);

		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(new Error(`Timeout changing permissions after ${this.TIMEOUT_CONFIG.fileOp}ms - try increasing sftp.operationTimeout in settings`));
			}, this.TIMEOUT_CONFIG.fileOp);

			sftp.chmod(expandedPath, modeNum, (err) => {
				clearTimeout(timeout);
				if (err) {
					reject(new Error(`Failed to change permissions: ${err.message}`));
				} else {
					// Invalidate cache for parent directory
					this.invalidatePath(hostId, expandedPath);
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

		// Expand tilde paths to absolute paths
		const expandedDirPath = await this.expandPath(sftp, dirPath);

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
		await walkDirectory(expandedDirPath);

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
	 * Calculates checksum for a local file
	 * @param localPath - Path to the local file
	 * @param algorithm - Hash algorithm (md5, sha1, sha256)
	 * @returns The hex-encoded checksum string
	 */
	private async calculateLocalChecksum(localPath: string, algorithm: 'md5' | 'sha1' | 'sha256'): Promise<string> {
		return new Promise((resolve, reject) => {
			const hash = crypto.createHash(algorithm);
			const stream = fs.createReadStream(localPath);

			stream.on('data', (chunk) => {
				hash.update(chunk);
			});

			stream.on('end', () => {
				resolve(hash.digest('hex'));
			});

			stream.on('error', (err) => {
				reject(new Error(`Failed to calculate local checksum: ${err.message}`));
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
		const sftp = await this.getSftpSession(hostId);

		// Expand tilde paths to absolute paths
		const expandedSourcePath = await this.expandPath(sftp, sourcePath);
		const expandedTargetPath = await this.expandPath(sftp, targetPath);

		const command = `ln -s '${expandedSourcePath}' '${expandedTargetPath}'`;
		await this.executeCommand(hostId, command);

		// Invalidate cache for parent directory
		this.invalidatePath(hostId, expandedTargetPath);
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
		const sftp = await this.getSftpSession(hostId);

		// Expand tilde paths to absolute paths
		const expandedBasePath = await this.expandPath(sftp, basePath);

		const results: FileEntry[] = [];

		// Build find command
		let findCmd = `find '${expandedBasePath}'`;

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
			const sftp = await this.getSftpSession(hostId);

			// Expand tilde paths to absolute paths
			const expandedSymlinkPath = await this.expandPath(sftp, symlinkPath);

			// Use readlink -f to follow the symlink chain and get the absolute path
			const command = `readlink -f '${expandedSymlinkPath}'`;
			const output = await this.executeCommand(hostId, command);

			return output.trim();
		} catch (error) {
			throw new Error(`Failed to resolve symlink ${symlinkPath}: ${error}`);
		}
	}

	/**
	 * Changes file/directory ownership on the remote server
	 * @param hostId - The host identifier
	 * @param remotePath - Path to the file/directory
	 * @param owner - Owner user (username or UID)
	 * @param group - Group (group name or GID), optional
	 * @param recursive - Whether to apply recursively for directories
	 */
	public async chown(
		hostId: string,
		remotePath: string,
		owner: string,
		group?: string,
		recursive: boolean = false
	): Promise<void> {
		try {
			const sftp = await this.getSftpSession(hostId);

			// Expand tilde paths to absolute paths
			const expandedRemotePath = await this.expandPath(sftp, remotePath);

			// Build chown command
			const ownerGroup = group ? `${owner}:${group}` : owner;
			const recursiveFlag = recursive ? '-R ' : '';
			const command = `chown ${recursiveFlag}'${ownerGroup}' '${expandedRemotePath}'`;

			await this.executeCommand(hostId, command);
		} catch (error) {
			throw new Error(`Failed to change ownership for ${remotePath}: ${error}`);
		}
	}

	/**
	 * Calculates the size of a directory recursively
	 * This operation can be slow for large directories
	 *
	 * @param hostId - The host identifier
	 * @param directoryPath - Path to the directory
	 * @param maxDepth - Maximum recursion depth (default: unlimited)
	 * @param onProgress - Optional callback for progress updates
	 * @returns Total size in bytes
	 */
	public async calculateDirectorySize(
		hostId: string,
		directoryPath: string,
		maxDepth: number = -1,
		onProgress?: (current: number, scanned: number) => void
	): Promise<number> {
		const sftp = await this.getSftpSession(hostId);
		const expandedPath = await this.expandPath(sftp, directoryPath);

		let totalSize = 0;
		let filesScanned = 0;

		const scanDirectory = async (currentPath: string, depth: number = 0): Promise<void> => {
			// Check depth limit
			if (maxDepth !== -1 && depth > maxDepth) {
				return;
			}

			try {
				const entries = await new Promise<any[]>((resolve, reject) => {
					const timeout = setTimeout(() => {
						reject(new Error(`Timeout reading directory ${currentPath}`));
					}, this.TIMEOUT_CONFIG.fileOp);

					sftp.readdir(currentPath, (err, list) => {
						clearTimeout(timeout);
						if (err) {
							reject(err);
						} else {
							resolve(list);
						}
					});
				});

				for (const entry of entries) {
					const entryPath = path.posix.join(currentPath, entry.filename);
					filesScanned++;

					if (entry.attrs.isDirectory()) {
						// Recursively scan subdirectory
						await scanDirectory(entryPath, depth + 1);
					} else {
						// Add file size
						totalSize += entry.attrs.size || 0;
					}

					// Report progress every 10 files
					if (onProgress && filesScanned % 10 === 0) {
						onProgress(totalSize, filesScanned);
					}
				}
			} catch (error) {
				console.warn(`Failed to scan directory ${currentPath}:`, error);
				// Continue with other directories even if one fails
			}
		};

		await scanDirectory(expandedPath);

		// Final progress update
		if (onProgress) {
			onProgress(totalSize, filesScanned);
		}

		return totalSize;
	}
}
