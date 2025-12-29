import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';
import { Bookmark } from '../../common/types';

/**
 * BookmarkService - Manages bookmarks for file navigation
 * Stores user-defined bookmarks for both local and remote paths
 */
export class BookmarkService {
	private static readonly BOOKMARK_KEY_PREFIX = 'labonair.bookmarks.';

	constructor(private readonly _context: vscode.ExtensionContext) {}

	/**
	 * Retrieves all bookmarks for a specific host
	 * @param hostId - The host identifier
	 * @returns Array of bookmarks
	 */
	public getBookmarks(hostId: string): Bookmark[] {
		try {
			const key = this._getBookmarkKey(hostId);
			const bookmarks = this._context.globalState.get<Bookmark[]>(key);
			return bookmarks || [];
		} catch (error) {
			console.error(`[BookmarkService] Failed to retrieve bookmarks for hostId: ${hostId}`, error);
			return [];
		}
	}

	/**
	 * Adds a new bookmark
	 * @param hostId - The host identifier
	 * @param bookmark - The bookmark to add (without id and createdAt)
	 * @returns The created bookmark
	 */
	public async addBookmark(
		hostId: string,
		bookmark: Omit<Bookmark, 'id' | 'createdAt'>
	): Promise<Bookmark> {
		try {
			const bookmarks = this.getBookmarks(hostId);

			// Create new bookmark with id and timestamp
			const newBookmark: Bookmark = {
				...bookmark,
				id: uuidv4(),
				createdAt: Date.now()
			};

			// Add to list
			bookmarks.push(newBookmark);

			// Save
			const key = this._getBookmarkKey(hostId);
			await this._context.globalState.update(key, bookmarks);
			console.log(`[BookmarkService] Added bookmark for hostId: ${hostId}`, newBookmark);

			return newBookmark;
		} catch (error) {
			console.error(`[BookmarkService] Failed to add bookmark for hostId: ${hostId}`, error);
			throw error;
		}
	}

	/**
	 * Removes a bookmark by ID
	 * @param hostId - The host identifier
	 * @param bookmarkId - The bookmark ID to remove
	 * @returns True if removed, false if not found
	 */
	public async removeBookmark(hostId: string, bookmarkId: string): Promise<boolean> {
		try {
			const bookmarks = this.getBookmarks(hostId);
			const initialLength = bookmarks.length;

			// Filter out the bookmark
			const updatedBookmarks = bookmarks.filter(b => b.id !== bookmarkId);

			// If length changed, save
			if (updatedBookmarks.length !== initialLength) {
				const key = this._getBookmarkKey(hostId);
				await this._context.globalState.update(key, updatedBookmarks);
				console.log(`[BookmarkService] Removed bookmark ${bookmarkId} for hostId: ${hostId}`);
				return true;
			}

			console.warn(`[BookmarkService] Bookmark ${bookmarkId} not found for hostId: ${hostId}`);
			return false;
		} catch (error) {
			console.error(`[BookmarkService] Failed to remove bookmark for hostId: ${hostId}`, error);
			throw error;
		}
	}

	/**
	 * Clears all bookmarks for a host
	 * @param hostId - The host identifier
	 */
	public async clearBookmarks(hostId: string): Promise<void> {
		try {
			const key = this._getBookmarkKey(hostId);
			await this._context.globalState.update(key, []);
			console.log(`[BookmarkService] Cleared all bookmarks for hostId: ${hostId}`);
		} catch (error) {
			console.error(`[BookmarkService] Failed to clear bookmarks for hostId: ${hostId}`, error);
			throw error;
		}
	}

	/**
	 * Generates the globalState key for a host's bookmarks
	 * @param hostId - The host identifier
	 * @returns The storage key
	 */
	private _getBookmarkKey(hostId: string): string {
		return `${BookmarkService.BOOKMARK_KEY_PREFIX}${hostId}`;
	}
}
