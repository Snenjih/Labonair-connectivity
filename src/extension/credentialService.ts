import * as vscode from 'vscode';
import { Credential } from '../common/types';

export class CredentialService {
	private readonly STORAGE_KEY = 'labonair.credentials.list';
	private _onDidChangeCredentials = new vscode.EventEmitter<Credential[]>();
	readonly onDidChangeCredentials = this._onDidChangeCredentials.event;

	constructor(private context: vscode.ExtensionContext) { }

	async getCredentials(): Promise<Credential[]> {
		const data = this.context.globalState.get<Credential[]>(this.STORAGE_KEY, []);
		return data;
	}

	async saveCredential(credential: Credential, secret: string): Promise<void> {
		const credentials = await this.getCredentials();
		const index = credentials.findIndex(c => c.id === credential.id);

		if (index !== -1) {
			credentials[index] = credential;
		} else {
			credentials.push(credential);
		}

		await this.context.globalState.update(this.STORAGE_KEY, credentials);
		await this.context.secrets.store(`labonair.credential.${credential.id}`, secret);

		this._onDidChangeCredentials.fire(credentials);
	}

	async deleteCredential(id: string): Promise<void> {
		let credentials = await this.getCredentials();
		credentials = credentials.filter(c => c.id !== id);

		await this.context.globalState.update(this.STORAGE_KEY, credentials);
		await this.context.secrets.delete(`labonair.credential.${id}`);

		this._onDidChangeCredentials.fire(credentials);
	}

	async getSecret(id: string): Promise<string | undefined> {
		return await this.context.secrets.get(`labonair.credential.${id}`);
	}
}
