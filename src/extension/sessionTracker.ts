import * as vscode from 'vscode';

export class SessionTracker {
	private activeSessions: Map<vscode.Terminal, string> = new Map();
	private _onDidChangeSessions = new vscode.EventEmitter<string[]>();
	readonly onDidChangeSessions = this._onDidChangeSessions.event;

	constructor(private context: vscode.ExtensionContext) {
		vscode.window.onDidCloseTerminal(term => {
			if (this.activeSessions.has(term)) {
				this.activeSessions.delete(term);
				this.fireUpdate();
			}
		});
	}

	public registerSession(hostId: string, terminal: vscode.Terminal) {
		this.activeSessions.set(terminal, hostId);
		this.fireUpdate();
	}

	public getActiveHostIds(): string[] {
		return Array.from(this.activeSessions.values());
	}

	private fireUpdate() {
		this._onDidChangeSessions.fire(this.getActiveHostIds());
	}
}
