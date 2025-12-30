// ============================================================================
// BASE CONTROLLER
// Abstract base class for all controllers
// ============================================================================

import * as vscode from 'vscode';

/**
 * Base Controller
 * Provides common functionality for all controllers
 */
export abstract class BaseController {
	protected context: vscode.ExtensionContext;

	constructor(context: vscode.ExtensionContext) {
		this.context = context;
	}

	/**
	 * Gets global state
	 */
	protected getGlobalState<T>(key: string): T | undefined {
		return this.context.globalState.get<T>(key);
	}

	/**
	 * Sets global state
	 */
	protected async setGlobalState<T>(key: string, value: T): Promise<void> {
		await this.context.globalState.update(key, value);
	}

	/**
	 * Gets workspace state
	 */
	protected getWorkspaceState<T>(key: string): T | undefined {
		return this.context.workspaceState.get<T>(key);
	}

	/**
	 * Sets workspace state
	 */
	protected async setWorkspaceState<T>(key: string, value: T): Promise<void> {
		await this.context.workspaceState.update(key, value);
	}

	/**
	 * Shows an error message
	 */
	protected showError(message: string): void {
		vscode.window.showErrorMessage(message);
	}

	/**
	 * Shows an information message
	 */
	protected showInfo(message: string): void {
		vscode.window.showInformationMessage(message);
	}

	/**
	 * Shows a warning message
	 */
	protected showWarning(message: string): void {
		vscode.window.showWarningMessage(message);
	}

	/**
	 * Logs to console with controller prefix
	 */
	protected log(message: string, ...args: any[]): void {
		console.log(`[${this.constructor.name}]`, message, ...args);
	}

	/**
	 * Logs error to console with controller prefix
	 */
	protected logError(message: string, error?: any): void {
		console.error(`[${this.constructor.name}]`, message, error);
	}
}
