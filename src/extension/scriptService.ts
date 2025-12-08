import * as vscode from 'vscode';
import { Script } from '../common/types';

export class ScriptService {
	private readonly STORAGE_KEY = 'labonair.scripts';
	private _onDidChangeScripts = new vscode.EventEmitter<Script[]>();
	readonly onDidChangeScripts = this._onDidChangeScripts.event;

	constructor(private context: vscode.ExtensionContext) { }

	async getScripts(): Promise<Script[]> {
		return this.context.globalState.get<Script[]>(this.STORAGE_KEY, []);
	}

	async saveScript(script: Script): Promise<void> {
		const scripts = await this.getScripts();
		const index = scripts.findIndex(s => s.id === script.id);

		if (index !== -1) {
			scripts[index] = script;
		} else {
			scripts.push(script);
		}

		await this.context.globalState.update(this.STORAGE_KEY, scripts);
		this._onDidChangeScripts.fire(scripts);
	}

	async deleteScript(id: string): Promise<void> {
		let scripts = await this.getScripts();
		scripts = scripts.filter(s => s.id !== id);

		await this.context.globalState.update(this.STORAGE_KEY, scripts);
		this._onDidChangeScripts.fire(scripts);
	}
}
