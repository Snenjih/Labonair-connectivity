
import * as vscode from 'vscode';
import { Host } from '../common/types';
import { HostService } from './hostService';

export function registerCommands(context: vscode.ExtensionContext, hostService: HostService) {
	context.subscriptions.push(
		vscode.commands.registerCommand('labonair.quickConnect', async () => {
			const hosts = hostService.getHosts();

			const items: vscode.QuickPickItem[] = hosts.map(host => ({
				label: `$(server) ${host.name}`,
				description: `$(chevron-right) ${host.username}@${host.host}`,
				detail: host.group,
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
}
