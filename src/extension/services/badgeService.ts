import * as vscode from 'vscode';
import { SessionTracker } from '../sessionTracker';
import { TransferService } from './transferService';

/**
 * Badge Service
 * Manages the Activity Bar icon badge count
 * Aggregates counts from active sessions and transfers
 */
export class BadgeService implements vscode.Disposable {
	private _disposables: vscode.Disposable[] = [];
	private _treeView?: vscode.TreeView<any>;

	constructor(
		private readonly sessionTracker: SessionTracker,
		private readonly transferService?: TransferService
	) {
		// Listen to session changes
		this._disposables.push(
			this.sessionTracker.onDidChangeSessions(() => {
				this.updateBadge();
			})
		);

		// Listen to transfer service changes if available
		if (this.transferService) {
			// The TransferService doesn't have an event emitter yet,
			// so we'll update on a timer or add an event emitter to TransferService later
			// For now, we'll update periodically
			const intervalId = setInterval(() => {
				this.updateBadge();
			}, 2000); // Update every 2 seconds

			this._disposables.push({
				dispose: () => clearInterval(intervalId)
			});
		}
	}

	/**
	 * Set the tree view to update badge on
	 */
	public setTreeView(treeView: vscode.TreeView<any>): void {
		this._treeView = treeView;
		this.updateBadge();
	}

	/**
	 * Update the badge count
	 */
	private updateBadge(): void {
		if (!this._treeView) {
			return;
		}

		// Get counts from session tracker
		const terminalCount = this.sessionTracker.getActiveTerminalCount();
		const sftpCount = this.sessionTracker.getActiveSftpCount();

		// Get active transfer count if transfer service is available
		let activeTransferCount = 0;
		if (this.transferService) {
			const summary = this.transferService.getSummary();
			activeTransferCount = summary.activeCount;
		}

		// Calculate total count
		const totalCount = terminalCount + sftpCount + activeTransferCount;

		// Update badge
		if (totalCount > 0) {
			this._treeView.badge = {
				tooltip: `${terminalCount} terminal${terminalCount !== 1 ? 's' : ''}, ${sftpCount} SFTP session${sftpCount !== 1 ? 's' : ''}, ${activeTransferCount} active transfer${activeTransferCount !== 1 ? 's' : ''}`,
				value: totalCount
			};
		} else {
			this._treeView.badge = undefined;
		}
	}

	/**
	 * Dispose the service
	 */
	public dispose(): void {
		for (const disposable of this._disposables) {
			disposable.dispose();
		}
		this._disposables = [];
	}
}
