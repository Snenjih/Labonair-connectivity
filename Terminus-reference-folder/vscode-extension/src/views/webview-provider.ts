import * as fs from 'fs';
import * as vscode from 'vscode';
import * as path from 'path';
import { SSHHost } from '../types';
import { ApiClient } from '../utils/api-client';

/**
 * WebviewProvider manages webview panels for host sessions.
 * Each host opens in a separate editor tab with the React app in single-session mode.
 */
export class WebviewProvider {
    private panels = new Map<number, vscode.WebviewPanel>();

    constructor(
        private context: vscode.ExtensionContext,
        private backendPort: number,
        private apiClient: ApiClient,
        private outputChannel: vscode.OutputChannel
    ) {
        this.outputChannel.appendLine(`WebviewProvider initialized with backend port: ${backendPort}`);
    }

    /**
     * Opens a host in a new webview panel (or reveals existing panel)
     */
    public openHost(host: SSHHost): void {
        // Check if panel already exists
        if (this.panels.has(host.id)) {
            const existingPanel = this.panels.get(host.id);
            if (existingPanel) {
                existingPanel.reveal(vscode.ViewColumn.One);
                this.outputChannel.appendLine(`Revealed existing panel for host: ${host.hostname} (ID: ${host.id})`);
                return;
            }
        }

        this.outputChannel.appendLine(`Opening new panel for host: ${host.hostname} (ID: ${host.id})`);

        // Create new webview panel
        const panel = vscode.window.createWebviewPanel(
            'terminus-host',
            `${host.hostname} - Terminus`,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.file(
                        path.join(this.context.extensionPath, 'dist', 'frontend')
                    )
                ]
            }
        );

        // Set webview HTML
        panel.webview.html = this.getWebviewContent(panel.webview, host);

        // Handle panel disposal
        panel.onDidDispose(() => {
            this.panels.delete(host.id);
            this.outputChannel.appendLine(`Panel closed for host: ${host.hostname} (ID: ${host.id})`);
        });

        // Store panel reference
        this.panels.set(host.id, panel);
        this.outputChannel.appendLine(`Panel created successfully for host: ${host.hostname}`);
    }

    /**
     * Closes a host's webview panel
     */
    public closeHost(hostId: number): void {
        const panel = this.panels.get(hostId);
        if (panel) {
            panel.dispose();
            this.panels.delete(hostId);
        }
    }

    /**
     * Closes all open panels
     */
    public closeAll(): void {
        for (const panel of this.panels.values()) {
            panel.dispose();
        }
        this.panels.clear();
    }

    /**
     * Dispose method for cleanup (called by extension.ts on deactivation)
     */
    public dispose(): void {
        this.outputChannel.appendLine('Disposing WebviewProvider - closing all panels...');
        this.closeAll();
        this.outputChannel.appendLine('WebviewProvider disposed');
    }

    /**
     * Updates backend port for all panels
     */
    public updateBackendPort(port: number): void {
        this.backendPort = port;

        // Reload all panels with new port
        for (const [hostId, panel] of this.panels.entries()) {
            // Extract host info from panel title
            // This is a simplified approach - in production you'd want to store host data
            const hostTitle = panel.title.replace(' - Terminus', '');

            // Note: We don't have the full host object here
            // For now, we'll just log that panels need manual refresh
            console.log(`Backend port changed. Panel ${hostTitle} may need refresh.`);
        }
    }

    /**
     * Generates HTML content for webview
     */
    private getWebviewContent(webview: vscode.Webview, host: SSHHost): string {
        // Get URIs for frontend assets
        const distPath = path.join(this.context.extensionPath, 'dist', 'frontend');

        // Try to find the actual asset files (Vite generates hashed filenames)
        const scriptUri = this.getAssetUri(webview, distPath, 'index', '.js');
        const styleUri = this.getAssetUri(webview, distPath, 'index', '.css');

        // Generate nonce for CSP
        const nonce = this.getNonce();

        // Build CSP directives
        const csp = [
            `default-src 'none'`,
            `script-src ${webview.cspSource} 'nonce-${nonce}'`,
            `style-src ${webview.cspSource} 'unsafe-inline'`,
            `img-src ${webview.cspSource} data: https:`,
            `font-src ${webview.cspSource}`,
            `connect-src http://localhost:* ws://localhost:* http://127.0.0.1:* ws://127.0.0.1:*`
        ].join('; ');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <link href="${styleUri}" rel="stylesheet">
    <title>${host.hostname} - Terminus</title>
    <script nonce="${nonce}">
        // Inject environment variables for single-session mode
        window.IS_VSCODE = true;
        window.BACKEND_PORT = ${this.backendPort};
        window.SINGLE_SESSION_MODE = true;
        window.HOST_CONFIG = ${JSON.stringify(host)};
    </script>
</head>
<body>
    <div id="root"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }

    /**
     * Gets webview URI for an asset file
     * Handles both direct filenames and Vite-generated hashed filenames
     */
    private getAssetUri(
        webview: vscode.Webview,
        distPath: string,
        baseName: string,
        extension: string
    ): vscode.Uri {
        const assetsPath = path.join(distPath, 'assets');

        try {
            // First try direct filename
            const directPath = path.join(assetsPath, `${baseName}${extension}`);
            if (fs.existsSync(directPath)) {
                return webview.asWebviewUri(vscode.Uri.file(directPath));
            }

            // Try to find hashed filename (e.g., index-abc123.js)
            if (fs.existsSync(assetsPath)) {
                const files = fs.readdirSync(assetsPath);
                const matchingFile = files.find((file: string) =>
                    file.startsWith(baseName) && file.endsWith(extension)
                );

                if (matchingFile) {
                    return webview.asWebviewUri(
                        vscode.Uri.file(path.join(assetsPath, matchingFile))
                    );
                }
            }

            // Fallback to direct path (will fail to load but shows the attempted path)
            console.warn(`Asset not found: ${baseName}${extension} in ${assetsPath}`);
            return webview.asWebviewUri(vscode.Uri.file(directPath));
        } catch (error) {
            console.error(`Error finding asset ${baseName}${extension}:`, error);
            return webview.asWebviewUri(
                vscode.Uri.file(path.join(assetsPath, `${baseName}${extension}`))
            );
        }
    }

    /**
     * Generates a random nonce for CSP
     */
    private getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    /**
     * Gets the number of open panels
     */
    public getPanelCount(): number {
        return this.panels.size;
    }

    /**
     * Gets all open host IDs
     */
    public getOpenHostIds(): number[] {
        return Array.from(this.panels.keys());
    }
}
