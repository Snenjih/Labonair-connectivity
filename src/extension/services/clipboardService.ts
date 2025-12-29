import * as vscode from 'vscode';
import { FileEntry } from '../../common/types';

/**
 * Clipboard state for internal file operations
 */
interface ClipboardState {
	files: FileEntry[];
	sourceHostId: string;
	system: 'local' | 'remote';
	operation: 'copy' | 'cut';
}

/**
 * Clipboard Service
 * Manages internal clipboard for file operations across local and remote systems
 * Also integrates with OS clipboard for path copying
 */
export class ClipboardService {
	private currentClip: ClipboardState | null = null;

	/**
	 * Copies files to internal clipboard
	 * Also writes file paths to OS clipboard for external use
	 */
	public async copy(
		files: FileEntry[],
		sourceHostId: string,
		system: 'local' | 'remote',
		operation: 'copy' | 'cut'
	): Promise<void> {
		// Store in internal clipboard
		this.currentClip = {
			files,
			sourceHostId,
			system,
			operation
		};

		// Write file paths to OS clipboard (for pasting in external apps)
		const paths = files.map(f => f.path).join('\n');
		await vscode.env.clipboard.writeText(paths);
	}

	/**
	 * Gets the current clipboard state
	 * Returns null if clipboard is empty
	 */
	public getClipboard(): ClipboardState | null {
		return this.currentClip;
	}

	/**
	 * Clears the internal clipboard
	 */
	public clear(): void {
		this.currentClip = null;
	}

	/**
	 * Checks if clipboard has content
	 */
	public hasContent(): boolean {
		return this.currentClip !== null && this.currentClip.files.length > 0;
	}

	/**
	 * Gets clipboard operation type ('copy' or 'cut')
	 */
	public getOperation(): 'copy' | 'cut' | null {
		return this.currentClip?.operation || null;
	}

	/**
	 * Gets clipboard source system ('local' or 'remote')
	 */
	public getSourceSystem(): 'local' | 'remote' | null {
		return this.currentClip?.system || null;
	}

	/**
	 * Gets clipboard source host ID
	 */
	public getSourceHostId(): string | null {
		return this.currentClip?.sourceHostId || null;
	}

	/**
	 * Gets clipboard file count
	 */
	public getFileCount(): number {
		return this.currentClip?.files.length || 0;
	}
}
