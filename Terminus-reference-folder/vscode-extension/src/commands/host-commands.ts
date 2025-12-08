import * as vscode from 'vscode';
import { HostTreeProvider, HostTreeItem } from '../views/host-tree-provider';
import { WebviewProvider } from '../views/webview-provider';
import { ApiClient } from '../utils/api-client';
import { CreateSSHHostDto, UpdateSSHHostDto } from '../types';

/**
 * Register all host-related commands for the extension
 *
 * Commands registered:
 * - terminus.openHost: Opens a host in the webview editor
 * - terminus.addHost: Creates a new SSH host via interactive prompts
 * - terminus.editHost: Edits host configuration (currently hostname only)
 * - terminus.deleteHost: Deletes a host with confirmation
 * - terminus.duplicateHost: Duplicates a host configuration
 * - terminus.exportHost: Exports host config as JSON file
 * - terminus.quickConnect: Quick picker to select and open a host
 * - terminus.createTunnel: Creates an SSH tunnel for a host
 * - terminus.refreshHosts: Refreshes the tree view (registered in extension.ts)
 *
 * @param context Extension context for subscription management
 * @param treeProvider TreeView provider for refreshing display
 * @param webviewProvider Webview provider for opening hosts
 * @param apiClient API client for backend communication
 * @param outputChannel Output channel for logging
 */
export function registerHostCommands(
    context: vscode.ExtensionContext,
    treeProvider: HostTreeProvider,
    webviewProvider: WebviewProvider,
    apiClient: ApiClient,
    outputChannel: vscode.OutputChannel
) {
    // ============================================
    // Open Host Command
    // ============================================
    context.subscriptions.push(
        vscode.commands.registerCommand('terminus.openHost', (item: HostTreeItem) => {
            try {
                webviewProvider.openHost(item.host);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`Failed to open host: ${errorMessage}`);
                outputChannel.appendLine(`Error opening host: ${errorMessage}`);
            }
        })
    );

    // ============================================
    // Add New Host Command
    // ============================================
    // PHASE 2 TODO: Extend to support:
    // - Folder assignment (user selection)
    // - Tags input (comma-separated)
    // - Notes/description field
    // - Full private key and passphrase handling
    // - Validation of hostname uniqueness
    context.subscriptions.push(
        vscode.commands.registerCommand('terminus.addHost', async () => {
            try {
                // Collect host information via input boxes
                const hostname = await vscode.window.showInputBox({
                    prompt: 'Enter a friendly name for this host',
                    placeHolder: 'e.g., Production Server',
                    validateInput: (value) => {
                        return value && value.trim().length > 0
                            ? null
                            : 'Hostname is required';
                    }
                });

                if (!hostname) return;

                const host = await vscode.window.showInputBox({
                    prompt: 'Enter the server IP address or domain',
                    placeHolder: 'e.g., 192.168.1.100 or server.example.com',
                    validateInput: (value) => {
                        return value && value.trim().length > 0
                            ? null
                            : 'Host address is required';
                    }
                });

                if (!host) return;

                const portStr = await vscode.window.showInputBox({
                    prompt: 'Enter SSH port (default: 22)',
                    placeHolder: '22',
                    value: '22',
                    validateInput: (value) => {
                        const port = parseInt(value);
                        return !isNaN(port) && port > 0 && port <= 65535
                            ? null
                            : 'Port must be a number between 1 and 65535';
                    }
                });

                if (!portStr) return;

                const username = await vscode.window.showInputBox({
                    prompt: 'Enter SSH username',
                    placeHolder: 'e.g., root, ubuntu, admin',
                    validateInput: (value) => {
                        return value && value.trim().length > 0
                            ? null
                            : 'Username is required';
                    }
                });

                if (!username) return;

                // Ask for authentication method
                const authMethod = await vscode.window.showQuickPick(
                    [
                        { label: 'Password', value: 'password' },
                        { label: 'Private Key', value: 'key' },
                        { label: 'None (configure later)', value: 'none' }
                    ],
                    { placeHolder: 'Select authentication method' }
                );

                if (!authMethod) return;

                const newHost: CreateSSHHostDto = {
                    hostname: hostname.trim(),
                    host: host.trim(),
                    port: parseInt(portStr),
                    username: username.trim()
                };

                if (authMethod.value === 'password') {
                    const password = await vscode.window.showInputBox({
                        prompt: 'Enter SSH password (optional, can be configured later)',
                        placeHolder: 'Leave empty to enter password on first connection',
                        password: true
                    });

                    if (password && password.length > 0) {
                        newHost.password = password;
                    }
                }

                // Create the host
                await apiClient.createHost(newHost);
                treeProvider.refresh();
                vscode.window.showInformationMessage(`Host "${hostname}" added successfully!`);
                outputChannel.appendLine(`Created host: ${hostname} (${username}@${host}:${portStr})`);

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`Failed to add host: ${errorMessage}`);
                outputChannel.appendLine(`Error adding host: ${errorMessage}`);
            }
        })
    );

    // ============================================
    // Edit Host Command
    // ============================================
    // PHASE 2 TODO: Upgrade to webview form for:
    // - Edit all fields (host, port, username, password, keys, folder, tags, notes)
    // - Better UX with visual form instead of sequential prompts
    // - Validation and error feedback in UI
    // - Test connection button
    context.subscriptions.push(
        vscode.commands.registerCommand('terminus.editHost', async (item: HostTreeItem) => {
            try {
                const host = item.host;

                // Currently limited to hostname - see Phase 2 TODO above
                // TODO: Display all editable fields in a form
                const newHostname = await vscode.window.showInputBox({
                    prompt: 'Enter new hostname',
                    value: host.hostname,
                    validateInput: (value) => {
                        return value && value.trim().length > 0
                            ? null
                            : 'Hostname is required';
                    }
                });

                if (!newHostname || newHostname === host.hostname) return;

                const updates: UpdateSSHHostDto = {
                    hostname: newHostname.trim()
                };

                await apiClient.updateHost(host.id, updates);
                treeProvider.refresh();
                vscode.window.showInformationMessage(`Host updated successfully!`);
                outputChannel.appendLine(`Updated host: ${host.id} -> ${newHostname}`);

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`Failed to edit host: ${errorMessage}`);
                outputChannel.appendLine(`Error editing host: ${errorMessage}`);
            }
        })
    );

    // ============================================
    // Delete Host Command
    // ============================================
    context.subscriptions.push(
        vscode.commands.registerCommand('terminus.deleteHost', async (item: HostTreeItem) => {
            try {
                const confirm = await vscode.window.showWarningMessage(
                    `Delete host "${item.host.hostname}"?`,
                    { modal: true },
                    'Delete'
                );

                if (confirm === 'Delete') {
                    await apiClient.deleteHost(item.host.id);
                    treeProvider.refresh();
                    vscode.window.showInformationMessage(`Host "${item.host.hostname}" deleted successfully!`);
                    outputChannel.appendLine(`Deleted host: ${item.host.hostname} (ID: ${item.host.id})`);
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`Failed to delete host: ${errorMessage}`);
                outputChannel.appendLine(`Error deleting host: ${errorMessage}`);
            }
        })
    );

    // ============================================
    // Duplicate Host Command
    // ============================================
    context.subscriptions.push(
        vscode.commands.registerCommand('terminus.duplicateHost', async (item: HostTreeItem) => {
            try {
                await apiClient.duplicateHost(item.host.id);
                treeProvider.refresh();
                vscode.window.showInformationMessage(`Host "${item.host.hostname}" duplicated successfully!`);
                outputChannel.appendLine(`Duplicated host: ${item.host.hostname} (ID: ${item.host.id})`);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`Failed to duplicate host: ${errorMessage}`);
                outputChannel.appendLine(`Error duplicating host: ${errorMessage}`);
            }
        })
    );

    // ============================================
    // Export Host Command
    // ============================================
    context.subscriptions.push(
        vscode.commands.registerCommand('terminus.exportHost', async (item: HostTreeItem) => {
            try {
                const hostData = await apiClient.exportHost(item.host.id);
                const json = JSON.stringify(hostData, null, 2);

                // Save to file
                const uri = await vscode.window.showSaveDialog({
                    defaultUri: vscode.Uri.file(`${item.host.hostname}.json`),
                    filters: { 'JSON': ['json'] }
                });

                if (uri) {
                    await vscode.workspace.fs.writeFile(
                        uri,
                        Buffer.from(json, 'utf-8')
                    );
                    vscode.window.showInformationMessage(`Host exported to ${uri.fsPath}`);
                    outputChannel.appendLine(`Exported host to: ${uri.fsPath}`);
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`Failed to export host: ${errorMessage}`);
                outputChannel.appendLine(`Error exporting host: ${errorMessage}`);
            }
        })
    );

    // ============================================
    // Quick Connect Command
    // ============================================
    context.subscriptions.push(
        vscode.commands.registerCommand('terminus.quickConnect', async () => {
            try {
                const hosts = await apiClient.getHosts();

                if (hosts.length === 0) {
                    vscode.window.showInformationMessage('No hosts configured. Add a host first.');
                    return;
                }

                const items = hosts.map(h => ({
                    label: h.hostname,
                    description: `${h.username}@${h.host}:${h.port}`,
                    detail: h.folder || 'Uncategorized',
                    host: h
                }));

                const selected = await vscode.window.showQuickPick(items, {
                    placeHolder: 'Select a host to connect'
                });

                if (selected) {
                    webviewProvider.openHost(selected.host);
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`Failed to load hosts: ${errorMessage}`);
                outputChannel.appendLine(`Error in quick connect: ${errorMessage}`);
            }
        })
    );

    // ============================================
    // Create Tunnel Command
    // ============================================
    // PHASE 2 TODO: Enhance with:
    // - Port availability verification
    // - Tunnel status querying and display
    // - Tunnel management UI for viewing/deleting tunnels
    // - Automatic tunnel refresh after creation
    context.subscriptions.push(
        vscode.commands.registerCommand('terminus.createTunnel', async (item: HostTreeItem) => {
            try {
                const name = await vscode.window.showInputBox({
                    prompt: 'Enter tunnel name',
                    placeHolder: 'e.g., PostgreSQL Tunnel'
                });

                if (!name) return;

                const localPortStr = await vscode.window.showInputBox({
                    prompt: 'Enter local port',
                    placeHolder: 'e.g., 5432',
                    validateInput: (value) => {
                        const port = parseInt(value);
                        return !isNaN(port) && port > 0 && port <= 65535
                            ? null
                            : 'Port must be a number between 1 and 65535';
                    }
                });

                if (!localPortStr) return;

                const remoteHost = await vscode.window.showInputBox({
                    prompt: 'Enter remote host (default: localhost)',
                    placeHolder: 'localhost',
                    value: 'localhost'
                });

                if (!remoteHost) return;

                const remotePortStr = await vscode.window.showInputBox({
                    prompt: 'Enter remote port',
                    placeHolder: 'e.g., 5432',
                    validateInput: (value) => {
                        const port = parseInt(value);
                        return !isNaN(port) && port > 0 && port <= 65535
                            ? null
                            : 'Port must be a number between 1 and 65535';
                    }
                });

                if (!remotePortStr) return;

                await apiClient.createTunnel(item.host.id, {
                    name: name.trim(),
                    localPort: parseInt(localPortStr),
                    remoteHost: remoteHost.trim(),
                    remotePort: parseInt(remotePortStr),
                    type: 'local'
                });

                vscode.window.showInformationMessage(`Tunnel "${name}" created successfully!`);
                outputChannel.appendLine(`Created tunnel: ${name} (${localPortStr}:${remoteHost}:${remotePortStr})`);

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`Failed to create tunnel: ${errorMessage}`);
                outputChannel.appendLine(`Error creating tunnel: ${errorMessage}`);
            }
        })
    );
}
