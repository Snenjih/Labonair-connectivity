import * as vscode from 'vscode';
import { ApiClient } from '../utils/api-client';
import { SSHHost } from '../types';

export class HostTreeProvider implements vscode.TreeDataProvider<TreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    // Cache for hosts to avoid duplicate API calls during tree expansion
    private cachedHosts: SSHHost[] | null = null;
    private cacheTimestamp: number = 0;
    private readonly CACHE_TTL_MS = 5000; // 5 second cache

    constructor(
        private apiClient: ApiClient,
        private outputChannel: vscode.OutputChannel
    ) {}

    /**
     * Refresh tree and invalidate cache
     */
    refresh(): void {
        this.cachedHosts = null;
        this.cacheTimestamp = 0;
        this._onDidChangeTreeData.fire();
    }

    /**
     * Get cached hosts or fetch from API
     * Uses cache to avoid duplicate calls during tree expansion
     */
    private async getHostsFromCache(): Promise<SSHHost[]> {
        const now = Date.now();

        // Return cached data if still valid
        if (this.cachedHosts && now - this.cacheTimestamp < this.CACHE_TTL_MS) {
            return this.cachedHosts;
        }

        // Fetch fresh data
        this.cachedHosts = await this.apiClient.getHosts();
        this.cacheTimestamp = now;
        return this.cachedHosts;
    }

    getTreeItem(element: TreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: TreeItem): Promise<TreeItem[]> {
        try {
            if (!element) {
                // Root level - return folders
                const hosts = await this.getHostsFromCache();
                if (hosts.length === 0) {
                    this.outputChannel.appendLine('No hosts configured');
                    return [];
                }
                return this.groupHostsByFolder(hosts);
            } else if (element instanceof FolderTreeItem) {
                // Folder children - return hosts in that folder
                const hosts = await this.getHostsFromCache();
                const folderHosts = hosts.filter(h =>
                    (h.folder || 'Uncategorized') === element.label
                );
                return folderHosts.map(h => new HostTreeItem(h));
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.outputChannel.appendLine(`Error loading tree items: ${errorMessage}`);

            // Show user-friendly error messages based on error type
            if (errorMessage.includes('Cannot connect')) {
                vscode.window.showErrorMessage('Backend server is not running. Starting it now...');
            } else if (errorMessage.includes('Authentication')) {
                vscode.window.showErrorMessage('Authentication failed. Please login again.');
            } else {
                vscode.window.showErrorMessage(`Failed to load hosts: ${errorMessage}`);
            }
        }

        return [];
    }

    private groupHostsByFolder(hosts: SSHHost[]): TreeItem[] {
        const folders = new Map<string, SSHHost[]>();

        // Group hosts by folder
        for (const host of hosts) {
            const folder = host.folder || 'Uncategorized';
            if (!folders.has(folder)) {
                folders.set(folder, []);
            }
            folders.get(folder)!.push(host);
        }

        // Create folder tree items
        const items: TreeItem[] = [];

        // Sort folders alphabetically, but put "Uncategorized" last
        const sortedFolders = Array.from(folders.keys()).sort((a, b) => {
            if (a === 'Uncategorized') return 1;
            if (b === 'Uncategorized') return -1;
            return a.localeCompare(b);
        });

        for (const folder of sortedFolders) {
            const folderHosts = folders.get(folder)!;
            items.push(new FolderTreeItem(folder, folderHosts.length));
        }

        return items;
    }
}

// Base class for tree items
abstract class TreeItem extends vscode.TreeItem {
    constructor(label: string, collapsibleState: vscode.TreeItemCollapsibleState) {
        super(label, collapsibleState);
    }
}

// Folder tree item
export class FolderTreeItem extends TreeItem {
    constructor(
        public readonly folderName: string,
        public readonly hostCount: number
    ) {
        super(folderName, vscode.TreeItemCollapsibleState.Expanded);

        this.iconPath = new vscode.ThemeIcon('folder');
        this.description = `${hostCount} host${hostCount !== 1 ? 's' : ''}`;
        this.contextValue = 'folder';
        this.tooltip = `${folderName} - ${hostCount} host${hostCount !== 1 ? 's' : ''}`;
    }
}

// Host tree item
export class HostTreeItem extends TreeItem {
    constructor(public readonly host: SSHHost) {
        super(host.hostname, vscode.TreeItemCollapsibleState.None);

        this.description = `${host.username}@${host.host}:${host.port}`;
        this.iconPath = new vscode.ThemeIcon('vm');
        this.contextValue = 'host';
        this.tooltip = this.buildTooltip();

        // Command to open host when clicked
        this.command = {
            command: 'terminus.openHost',
            title: 'Open Host',
            arguments: [host]
        };
    }

    private buildTooltip(): string {
        const lines = [
            `Hostname: ${this.host.hostname}`,
            `Address: ${this.host.username}@${this.host.host}:${this.host.port}`
        ];

        if (this.host.folder) {
            lines.push(`Folder: ${this.host.folder}`);
        }

        if (this.host.tags && this.host.tags.length > 0) {
            lines.push(`Tags: ${this.host.tags.join(', ')}`);
        }

        if (this.host.notes) {
            lines.push(`\nNotes: ${this.host.notes}`);
        }

        return lines.join('\n');
    }
}
