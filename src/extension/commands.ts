
import * as vscode from 'vscode';
import { Host } from '../common/types';
import { HostService } from './hostService';
import { CredentialService } from './credentialService';
import { HostKeyService } from './security/hostKeyService';
import { SftpService } from './services/sftpService';
import { LocalFsService } from './services/localFsService';
import { ClipboardService } from './services/clipboardService';
import { StateService } from './services/stateService';
import { ArchiveService } from './services/archiveService';
import { SyncService } from './services/syncService';
import { SftpPanel } from './panels/sftpPanel';

export function registerCommands(
	context: vscode.ExtensionContext,
	hostService: HostService,
	credentialService: CredentialService,
	hostKeyService: HostKeyService,
	sftpService: SftpService,
	localFsService: LocalFsService,
	clipboardService: ClipboardService,
	stateService: StateService,
	archiveService: ArchiveService,
	syncService: SyncService
) {
	context.subscriptions.push(
		vscode.commands.registerCommand('labonair.quickConnect', async () => {
			const hosts = hostService.getHosts();

			const items: vscode.QuickPickItem[] = hosts.map(host => ({
				label: `$(server) ${host.name}`,
				description: `$(chevron-right) ${host.username}@${host.host}`,
				detail: host.folder,
				picked: false,
				// store id in a way we can retrieve index or object
				// but QuickPickItem structure is strict.
				// We can augment it if we pass objects to showQuickPick assuming generic support, or just match by label/index.
			}));

			// To map back to host, we can look up by index or create a map. Using map for closure.
			const quickPickHostMap = new Map<vscode.QuickPickItem, Host>();
			items.forEach((item, index) => quickPickHostMap.set(item, hosts[index]));

			const selection = await vscode.window.showQuickPick(items, {
				placeHolder: 'Select a host to connect to',
				matchOnDescription: true,
				matchOnDetail: true
			});

			if (selection) {
				const host = quickPickHostMap.get(selection);
				if (host) {
					vscode.window.showInformationMessage(`Connecting to ${host.name}... (Stub)`);
					// In real implementation, trigger connection logic
				}
			}
		})
	);

	// Register SFTP command
	context.subscriptions.push(
		vscode.commands.registerCommand('labonair.openSFTP', async (hostId?: string) => {
			// If hostId is provided (called from terminal), open directly without asking
			if (hostId) {
				const host = hostService.getHostById(hostId);
				if (host) {
					// Open SFTP Panel directly
					SftpPanel.createOrShow(
						context.extensionUri,
						host.id,
						sftpService,
						localFsService,
						clipboardService,
						stateService,
						archiveService,
						syncService,
						hostService,
						credentialService,
						hostKeyService
					);
				} else {
					vscode.window.showErrorMessage(`Host not found: ${hostId}`);
				}
				return;
			}

			// No hostId provided - show host selection dialog
			const hosts = hostService.getHosts();

			if (hosts.length === 0) {
				vscode.window.showInformationMessage('No hosts configured. Please add a host first.');
				return;
			}

			const items: vscode.QuickPickItem[] = hosts.map(host => ({
				label: `$(server) ${host.name}`,
				description: `$(chevron-right) ${host.username}@${host.host}`,
				detail: host.folder,
				picked: false
			}));

			const quickPickHostMap = new Map<vscode.QuickPickItem, Host>();
			items.forEach((item, index) => quickPickHostMap.set(item, hosts[index]));

			const selection = await vscode.window.showQuickPick(items, {
				placeHolder: 'Select a host to open SFTP File Manager',
				matchOnDescription: true,
				matchOnDetail: true
			});

			if (selection) {
				const host = quickPickHostMap.get(selection);
				if (host) {
					// Open SFTP Panel
					SftpPanel.createOrShow(
						context.extensionUri,
						host.id,
						sftpService,
						localFsService,
						clipboardService,
						stateService,
						archiveService,
						syncService,
						hostService,
						credentialService,
						hostKeyService
					);
				}
			}
		})
	);
}
