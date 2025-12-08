import * as vscode from 'vscode';
import { Host } from '../common/types';

export class HostService {
	private context: vscode.ExtensionContext;
	private readonly STORAGE_KEY = 'labonair.hosts';
	private readonly GROUPS_KEY = 'labonair.groups';

	constructor(context: vscode.ExtensionContext) {
		this.context = context;
	}

	public getHosts(): Host[] {
		return this.context.globalState.get<Host[]>(this.STORAGE_KEY, []);
	}

	public getGroupConfigs(): Record<string, any> {
		return this.context.globalState.get<Record<string, any>>(this.GROUPS_KEY, {});
	}

	public async saveHost(host: Host, password?: string, keyPath?: string): Promise<void> {
		const hosts = this.getHosts();
		const index = hosts.findIndex(h => h.id === host.id);

		if (index !== -1) {
			hosts[index] = host;
		} else {
			hosts.push(host);
		}

		await this.context.globalState.update(this.STORAGE_KEY, hosts);

		if (password) {
			await this.context.secrets.store(`pwd.${host.id}`, password);
		}
	}

	public async updateLastUsed(hostId: string): Promise<void> {
		const hosts = this.getHosts();
		const hostIndex = hosts.findIndex(h => h.id === hostId);
		if (hostIndex !== -1) {
			hosts[hostIndex].lastUsed = Date.now();
			await this.context.globalState.update(this.STORAGE_KEY, hosts);
		}
	}

	public async deleteHost(id: string): Promise<void> {
		const hosts = this.getHosts().filter(h => h.id !== id);
		await this.context.globalState.update(this.STORAGE_KEY, hosts);
		await this.context.secrets.delete(`pwd.${id}`);
	}

	public async saveGroupConfig(config: { name: string, username?: string, port?: number, credentialId?: string }): Promise<void> {
		const groups = this.getGroupConfigs();
		groups[config.name] = config;
		await this.context.globalState.update(this.GROUPS_KEY, groups);
	}

	public async getEffectiveConfig(hostId: string): Promise<Host> {
		const hosts = this.getHosts();
		const host = hosts.find(h => h.id === hostId);
		if (!host) {
			throw new Error(`Host ${hostId} not found`);
		}

		// Defaults
		let effectiveHost = { ...host };

		if (host.group) {
			const groups = this.getGroupConfigs();
			const groupConfig = groups[host.group];
			if (groupConfig) {
				if (!effectiveHost.username && groupConfig.username) {
					effectiveHost.username = groupConfig.username;
				}
				if (!effectiveHost.port && groupConfig.port) {
					effectiveHost.port = groupConfig.port;
				}
				if (!effectiveHost.credentialId && groupConfig.credentialId) {
					effectiveHost.credentialId = groupConfig.credentialId;
				}
			}
		}

		return effectiveHost;
	}
}
