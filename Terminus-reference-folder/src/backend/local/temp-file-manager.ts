import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';

interface FileWatcher {
  id: string;
  filePath: string;
  remotePath: string;
  sessionId: string;
  hostId: number;
  userId: string;
  watcher: fs.FSWatcher | null;
  debounceTimer: NodeJS.Timeout | null;
  onChange: (newContent: string) => void;
  stop: () => void;
}

// Store active watchers
const activeWatchers = new Map<string, FileWatcher>();

// Temp directory for edited files
const TEMP_DIR = path.join(os.tmpdir(), 'terminus-edit');

// Cleanup interval (24 hours)
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000;

// Ensure temp directory exists
function ensureTempDir(): void {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
}

/**
 * Create a temporary file with the given content
 * @param fileName - Original file name
 * @param content - File content
 * @returns Absolute path to the created temp file
 */
export async function createTempFile(fileName: string, content: string): Promise<string> {
  ensureTempDir();

  // Generate unique ID to avoid conflicts
  const uniqueId = uuidv4().split('-')[0];
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const tempFileName = `${uniqueId}_${safeName}`;
  const tempFilePath = path.join(TEMP_DIR, tempFileName);

  // Write content to temp file
  await fs.promises.writeFile(tempFilePath, content, 'utf8');

  return tempFilePath;
}

/**
 * Watch a temporary file for changes
 * @param filePath - Path to the temp file
 * @param remotePath - Original remote file path
 * @param sessionId - SSH session ID
 * @param hostId - Host ID
 * @param userId - User ID
 * @param onChange - Callback when file changes (debounced)
 * @returns Watcher instance
 */
export function watchTempFile(
  filePath: string,
  remotePath: string,
  sessionId: string,
  hostId: number,
  userId: string,
  onChange: (newContent: string) => void
): FileWatcher {
  const watcherId = uuidv4();

  let debounceTimer: NodeJS.Timeout | null = null;
  let lastModified = 0;

  // Get initial modified time
  try {
    const stats = fs.statSync(filePath);
    lastModified = stats.mtimeMs;
  } catch (error) {
    console.error('Error getting initial file stats:', error);
  }

  const watcher = fs.watch(filePath, (eventType) => {
    if (eventType !== 'change') return;

    // Check if file was actually modified (not just accessed)
    try {
      const stats = fs.statSync(filePath);
      if (stats.mtimeMs <= lastModified) return;
      lastModified = stats.mtimeMs;
    } catch (error) {
      console.error('Error checking file modification:', error);
      return;
    }

    // Debounce changes (500ms)
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(async () => {
      try {
        const newContent = await fs.promises.readFile(filePath, 'utf8');
        onChange(newContent);
      } catch (error) {
        console.error('Error reading changed file:', error);
      }
    }, 500);
  });

  const fileWatcher: FileWatcher = {
    id: watcherId,
    filePath,
    remotePath,
    sessionId,
    hostId,
    userId,
    watcher,
    debounceTimer,
    onChange,
    stop: () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      if (watcher) {
        watcher.close();
      }
      activeWatchers.delete(watcherId);
    }
  };

  activeWatchers.set(watcherId, fileWatcher);

  return fileWatcher;
}

/**
 * Stop watching a temp file
 * @param watcherId - Watcher ID
 */
export function stopWatching(watcherId: string): void {
  const watcher = activeWatchers.get(watcherId);
  if (watcher) {
    watcher.stop();
  }
}

/**
 * Get an active watcher by ID
 * @param watcherId - Watcher ID
 * @returns Watcher instance or undefined
 */
export function getWatcher(watcherId: string): FileWatcher | undefined {
  return activeWatchers.get(watcherId);
}

/**
 * Get all active watchers for a user
 * @param userId - User ID
 * @returns Array of watchers
 */
export function getUserWatchers(userId: string): FileWatcher[] {
  const watchers: FileWatcher[] = [];
  for (const watcher of activeWatchers.values()) {
    if (watcher.userId === userId) {
      watchers.push(watcher);
    }
  }
  return watchers;
}

/**
 * Clean up a temporary file
 * @param filePath - Path to the temp file
 */
export async function cleanupTempFile(filePath: string): Promise<void> {
  try {
    // Stop any watcher for this file
    for (const [id, watcher] of activeWatchers.entries()) {
      if (watcher.filePath === filePath) {
        watcher.stop();
      }
    }

    // Delete the file
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }

    // Clean up empty temp directory if no files remain
    const files = await fs.promises.readdir(TEMP_DIR);
    if (files.length === 0) {
      await fs.promises.rmdir(TEMP_DIR);
    }
  } catch (error) {
    console.error('Error cleaning up temp file:', error);
  }
}

/**
 * Clean up all temp files older than 24 hours
 */
export async function cleanupOldTempFiles(): Promise<void> {
  try {
    ensureTempDir();

    const files = await fs.promises.readdir(TEMP_DIR);
    const now = Date.now();

    for (const file of files) {
      const filePath = path.join(TEMP_DIR, file);

      try {
        const stats = await fs.promises.stat(filePath);
        const fileAge = now - stats.mtimeMs;

        // Delete files older than 24 hours
        if (fileAge > CLEANUP_INTERVAL) {
          await cleanupTempFile(filePath);
        }
      } catch (error) {
        console.error(`Error checking file ${file}:`, error);
      }
    }
  } catch (error) {
    console.error('Error cleaning up old temp files:', error);
  }
}

/**
 * Clean up all temp files and watchers (called on app close)
 */
export async function cleanupAll(): Promise<void> {
  // Stop all watchers
  for (const watcher of activeWatchers.values()) {
    watcher.stop();
  }
  activeWatchers.clear();

  // Delete all temp files
  try {
    if (fs.existsSync(TEMP_DIR)) {
      const files = await fs.promises.readdir(TEMP_DIR);
      for (const file of files) {
        const filePath = path.join(TEMP_DIR, file);
        await fs.promises.unlink(filePath);
      }
      await fs.promises.rmdir(TEMP_DIR);
    }
  } catch (error) {
    console.error('Error cleaning up all temp files:', error);
  }
}

// Start cleanup interval
let cleanupIntervalId: NodeJS.Timeout | null = null;

export function startCleanupInterval(): void {
  if (cleanupIntervalId) return;

  // Run cleanup every hour
  cleanupIntervalId = setInterval(() => {
    cleanupOldTempFiles();
  }, 60 * 60 * 1000);

  // Initial cleanup on start
  cleanupOldTempFiles();
}

export function stopCleanupInterval(): void {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
  }
}

// Handle process exit
process.on('SIGINT', () => {
  cleanupAll().then(() => {
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  cleanupAll().then(() => {
    process.exit(0);
  });
});
