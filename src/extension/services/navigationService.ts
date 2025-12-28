import * as vscode from 'vscode';

/**
 * Panel tracking information
 */
interface PanelInfo {
	terminalPanel?: any; // TerminalPanel instance
	sftpPanel?: any;     // SftpPanel instance
}

/**
 * Navigation Service
 * Manages sync navigation between Terminal and SFTP panels
 * Tracks active panels for each host and enables "Open Terminal Here" functionality
 */
export class NavigationService {
	private activePanels: Map<string, PanelInfo> = new Map();

	/**
	 * Registers a terminal panel for a host
	 */
	public registerTerminalPanel(hostId: string, panel: any): void {
		const info = this.activePanels.get(hostId) || {};
		info.terminalPanel = panel;
		this.activePanels.set(hostId, info);
	}

	/**
	 * Registers an SFTP panel for a host
	 */
	public registerSftpPanel(hostId: string, panel: any): void {
		const info = this.activePanels.get(hostId) || {};
		info.sftpPanel = panel;
		this.activePanels.set(hostId, info);
	}

	/**
	 * Unregisters a terminal panel for a host
	 */
	public unregisterTerminalPanel(hostId: string): void {
		const info = this.activePanels.get(hostId);
		if (info) {
			info.terminalPanel = undefined;
			if (!info.sftpPanel) {
				this.activePanels.delete(hostId);
			}
		}
	}

	/**
	 * Unregisters an SFTP panel for a host
	 */
	public unregisterSftpPanel(hostId: string): void {
		const info = this.activePanels.get(hostId);
		if (info) {
			info.sftpPanel = undefined;
			if (!info.terminalPanel) {
				this.activePanels.delete(hostId);
			}
		}
	}

	/**
	 * Gets the terminal panel for a host
	 */
	public getTerminalPanel(hostId: string): any | undefined {
		return this.activePanels.get(hostId)?.terminalPanel;
	}

	/**
	 * Gets the SFTP panel for a host
	 */
	public getSftpPanel(hostId: string): any | undefined {
		return this.activePanels.get(hostId)?.sftpPanel;
	}

	/**
	 * Opens a terminal at the specified path for a host
	 * This is the "Open Terminal Here" functionality
	 *
	 * @param hostId - The host ID
	 * @param currentPath - The current directory path to navigate to
	 * @param createTerminalCallback - Callback to create a new terminal if one doesn't exist
	 */
	public async openTerminalHere(
		hostId: string,
		currentPath: string,
		createTerminalCallback: () => Promise<any>
	): Promise<void> {
		try {
			// Get or create terminal panel
			let terminalPanel = this.getTerminalPanel(hostId);

			if (!terminalPanel || !terminalPanel.isConnected) {
				// Create new terminal
				terminalPanel = await createTerminalCallback();
				this.registerTerminalPanel(hostId, terminalPanel);

				// Wait a bit for the terminal to be ready
				await new Promise(resolve => setTimeout(resolve, 500));
			}

			// Escape path for shell command
			const escapedPath = this.escapeShellPath(currentPath);
			const cdCommand = `cd ${escapedPath}\n`;

			// Send cd command to terminal
			if (terminalPanel.write) {
				terminalPanel.write(cdCommand);
			} else if (terminalPanel.session?.write) {
				terminalPanel.session.write(cdCommand);
			}

			// Focus the terminal panel
			if (terminalPanel.reveal) {
				terminalPanel.reveal();
			} else if (terminalPanel.webviewPanel?.reveal) {
				terminalPanel.webviewPanel.reveal();
			}

			vscode.window.showInformationMessage(`Terminal opened at: ${currentPath}`);
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to open terminal: ${error}`);
			throw error;
		}
	}

	/**
	 * Escapes a path for use in shell commands
	 * Handles special characters and spaces
	 */
	private escapeShellPath(path: string): string {
		// Escape single quotes by replacing ' with '\''
		// Then wrap the whole path in single quotes
		return `'${path.replace(/'/g, "'\\''")}'`;
	}

	/**
	 * Syncs the current directory from terminal to SFTP
	 * (Future enhancement - not implemented in this phase)
	 */
	public syncTerminalToSftp(hostId: string, currentPath: string): void {
		const sftpPanel = this.getSftpPanel(hostId);
		if (sftpPanel && sftpPanel.navigateTo) {
			sftpPanel.navigateTo(currentPath);
		}
	}

	/**
	 * Cleans up all panel references
	 */
	public dispose(): void {
		this.activePanels.clear();
	}
}
