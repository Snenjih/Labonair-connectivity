
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Host } from '../common/types';

export class ImporterService {
	async importHosts(format: 'json' | 'ssh-config'): Promise<Host[]> {
		const options: vscode.OpenDialogOptions = {
			canSelectMany: false,
			openLabel: 'Import'
		};

		if (format === 'json') {
			options.filters = { 'JSON': ['json'] };
		} else {
			options.filters = { 'SSH Config': ['config', 'conf', 'ssh_config'] };
		}

		const fileUri = await vscode.window.showOpenDialog(options);
		if (!fileUri || fileUri.length === 0) {
			return [];
		}

		const content = await fs.promises.readFile(fileUri[0].fsPath, 'utf8');

		if (format === 'json') {
			try {
				return JSON.parse(content) as Host[];
			} catch (e) {
				vscode.window.showErrorMessage('Failed to parse JSON file');
				return [];
			}
		} else {
			return this.parseSSHConfig(content);
		}
	}

	async exportHosts(hosts: Host[]): Promise<void> {
		const fileUri = await vscode.window.showSaveDialog({
			filters: { 'JSON': ['json'] },
			saveLabel: 'Export'
		});

		if (!fileUri) {
			return;
		}

		await fs.promises.writeFile(fileUri.fsPath, JSON.stringify(hosts, null, 2), 'utf8');
		vscode.window.showInformationMessage('Hosts exported successfully');
	}

	private parseSSHConfig(content: string): Host[] {
		const hosts: Host[] = [];
		const lines = content.split('\n');
		let currentHost: Partial<Host> | null = null;

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('#')) continue;

			// Simple parser: first word key, rest value
			const parts = trimmed.split(/\s+/);
			const key = parts[0].toLowerCase();
			const value = parts.slice(1).join(' ');

			if (key === 'host') {
				if (currentHost && currentHost.name) {
					hosts.push(currentHost as Host);
				}
				currentHost = {
					id: crypto.randomUUID(),
					name: value, // Use pattern as name for now
					host: value, // Default to pattern if HostName missing
					port: 22,
					username: 'root', // Default
					osIcon: 'linux',
					group: 'Imported',
					tags: []
				};
			} else if (currentHost) {
				switch (key) {
					case 'hostname':
						currentHost.host = value;
						break;
					case 'user':
						currentHost.username = value;
						break;
					case 'port':
						currentHost.port = parseInt(value) || 22;
						break;
					case 'identityfile':
						// Store in notes or a separate field if needed, but for now we don't map IdentityFile to keys directly in Host object unless we want to pre-fill KeyPath.
						// However, Host object doesn't persist key path. It's separate.
						// For this iteration, we ignore it or add to notes.
						currentHost.notes = (currentHost.notes || '') + `IdentityFile: ${value}\n`;
						break;
				}
			}
		}

		if (currentHost && currentHost.name) {
			hosts.push(currentHost as Host);
		}

		return hosts;
	}
}
