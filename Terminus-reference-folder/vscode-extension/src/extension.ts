import * as vscode from 'vscode';
import { BackendManager } from './backend-manager';
import { StorageManager } from './storage-manager';
import { HostTreeProvider } from './views/host-tree-provider';
import { WebviewProvider } from './views/webview-provider';
import { registerHostCommands } from './commands/host-commands';
import { ApiClient } from './utils/api-client';

let backendManager: BackendManager | null = null;
let storageManager: StorageManager | null = null;
let hostTreeProvider: HostTreeProvider | null = null;
let webviewProvider: WebviewProvider | null = null;
let outputChannel: vscode.OutputChannel | null = null;

export async function activate(context: vscode.ExtensionContext) {
    console.log('Terminus extension is activating...');

    // Create output channel for logging
    outputChannel = vscode.window.createOutputChannel('Terminus Backend');
    context.subscriptions.push(outputChannel);

    try {
        // Initialize storage manager
        storageManager = new StorageManager(
            context.secrets,
            context.globalState
        );

        // Initialize backend manager
        backendManager = new BackendManager(
            context,
            storageManager,
            outputChannel
        );

        // Start backend process
        outputChannel.appendLine('Starting Terminus backend...');
        const backendPort = await backendManager.start();
        outputChannel.appendLine(`Backend started successfully on port ${backendPort}`);

        // Save backend port to storage
        await storageManager.setBackendPort(backendPort);

        // Initialize API client
        const apiClient = new ApiClient(backendPort, storageManager);

        // Register TreeView provider
        hostTreeProvider = new HostTreeProvider(apiClient, outputChannel);
        vscode.window.registerTreeDataProvider('terminus-hosts', hostTreeProvider);

        // Register Webview provider
        webviewProvider = new WebviewProvider(
            context,
            backendPort,
            apiClient,
            outputChannel
        );

        // Register commands
        registerHostCommands(
            context,
            hostTreeProvider,
            webviewProvider,
            apiClient,
            outputChannel
        );

        // Register refresh command
        context.subscriptions.push(
            vscode.commands.registerCommand('terminus.refreshHosts', () => {
                hostTreeProvider?.refresh();
            })
        );

        vscode.window.showInformationMessage('Terminus extension activated successfully!');
        console.log('Terminus extension activated successfully');

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        outputChannel?.appendLine(`Error activating extension: ${errorMessage}`);
        vscode.window.showErrorMessage(`Failed to activate Terminus: ${errorMessage}`);

        // Attempt cleanup on activation failure
        if (backendManager) {
            await backendManager.stop();
        }

        throw error;
    }
}

export async function deactivate() {
    console.log('Terminus extension is deactivating...');

    if (outputChannel) {
        outputChannel.appendLine('Deactivating Terminus extension...');
    }

    try {
        // Close all webview panels
        if (webviewProvider) {
            webviewProvider.dispose();
        }

        // Stop backend process
        if (backendManager) {
            if (outputChannel) {
                outputChannel.appendLine('Stopping backend process...');
            }
            await backendManager.stop();
            if (outputChannel) {
                outputChannel.appendLine('Backend stopped successfully');
            }
        }

        // Cleanup
        hostTreeProvider = null;
        webviewProvider = null;
        backendManager = null;
        storageManager = null;

        console.log('Terminus extension deactivated successfully');

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (outputChannel) {
            outputChannel.appendLine(`Error during deactivation: ${errorMessage}`);
        }
        console.error('Error during deactivation:', error);
    }
}
