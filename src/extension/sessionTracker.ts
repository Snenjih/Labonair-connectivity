import * as vscode from 'vscode';

/**
 * Session info for persistence
 */
export interface SessionInfo {
	hostId: string;
	splitMode: 'none' | 'vertical' | 'horizontal';
	type: 'terminal' | 'sftp';
	timestamp: number; // Unix timestamp when session was last persisted
}

/**
 * Session Tracker
 * Tracks active terminal panels and SFTP panels
 * Supports session persistence and restoration
 */
export class SessionTracker {
	private activeSessions: Map<vscode.Terminal, string> = new Map();
	private activePanels: Map<string, SessionInfo> = new Map(); // panelId -> SessionInfo
	private _onDidChangeSessions = new vscode.EventEmitter<string[]>();
	readonly onDidChangeSessions = this._onDidChangeSessions.event;

	private static readonly STORAGE_KEY = 'labonair.openSessions';

	constructor(private context: vscode.ExtensionContext) {
		vscode.window.onDidCloseTerminal(term => {
			if (this.activeSessions.has(term)) {
				this.activeSessions.delete(term);
				this.fireUpdate();
			}
		});
	}

	/**
	 * Register a legacy terminal session (for backwards compatibility)
	 */
	public registerSession(hostId: string, terminal: vscode.Terminal) {
		this.activeSessions.set(terminal, hostId);
		this.fireUpdate();
	}

	/**
	 * Register a panel (Terminal or SFTP)
	 */
	public registerPanel(panelId: string, sessionInfo: SessionInfo): void {
		// Add timestamp to session info
		const sessionWithTimestamp: SessionInfo = {
			...sessionInfo,
			timestamp: Date.now()
		};
		this.activePanels.set(panelId, sessionWithTimestamp);
		this.persistSessions();
		this.fireUpdate();
	}

	/**
	 * Unregister a panel
	 */
	public unregisterPanel(panelId: string): void {
		this.activePanels.delete(panelId);
		this.persistSessions();
		this.fireUpdate();
	}

	/**
	 * Get all active host IDs (from both terminals and panels)
	 */
	public getActiveHostIds(): string[] {
		const terminalHostIds = Array.from(this.activeSessions.values());
		const panelHostIds = Array.from(this.activePanels.values()).map(info => info.hostId);
		return [...terminalHostIds, ...panelHostIds];
	}

	/**
	 * Get active terminal count
	 */
	public getActiveTerminalCount(): number {
		return Array.from(this.activePanels.values()).filter(info => info.type === 'terminal').length;
	}

	/**
	 * Get active SFTP count
	 */
	public getActiveSftpCount(): number {
		return Array.from(this.activePanels.values()).filter(info => info.type === 'sftp').length;
	}

	/**
	 * Persist current sessions to globalState
	 */
	private persistSessions(): void {
		const sessions = Array.from(this.activePanels.values());
		this.context.globalState.update(SessionTracker.STORAGE_KEY, sessions);
	}

	/**
	 * Get persisted sessions
	 */
	public getPersistedSessions(): SessionInfo[] {
		return this.context.globalState.get<SessionInfo[]>(SessionTracker.STORAGE_KEY, []);
	}

	/**
	 * Clear persisted sessions
	 */
	public clearPersistedSessions(): void {
		this.context.globalState.update(SessionTracker.STORAGE_KEY, []);
	}

	private fireUpdate() {
		this._onDidChangeSessions.fire(this.getActiveHostIds());
	}
}
