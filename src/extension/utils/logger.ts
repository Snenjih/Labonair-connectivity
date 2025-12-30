import * as vscode from 'vscode';

/**
 * Logger Service
 * Provides centralized logging to VS Code Output panel
 */
export class Logger {
	private outputChannel: vscode.OutputChannel;
	private verboseMode: boolean = false;

	constructor(channelName: string = 'Labonair Connectivity') {
		this.outputChannel = vscode.window.createOutputChannel(channelName);
	}

	/**
	 * Enable verbose mode for detailed logging
	 */
	public setVerbose(enabled: boolean): void {
		this.verboseMode = enabled;
		if (enabled) {
			this.info('Verbose logging enabled');
		}
	}

	/**
	 * Log an info message
	 */
	public info(message: string): void {
		const timestamp = this.getTimestamp();
		this.outputChannel.appendLine(`[INFO] [${timestamp}] ${message}`);
	}

	/**
	 * Log a warning message
	 */
	public warn(message: string): void {
		const timestamp = this.getTimestamp();
		this.outputChannel.appendLine(`[WARN] [${timestamp}] ${message}`);
	}

	/**
	 * Log an error message
	 */
	public error(message: string, error?: Error): void {
		const timestamp = this.getTimestamp();
		this.outputChannel.appendLine(`[ERROR] [${timestamp}] ${message}`);
		if (error) {
			this.outputChannel.appendLine(`  ${error.message}`);
			if (error.stack && this.verboseMode) {
				this.outputChannel.appendLine(`  Stack trace:\n${error.stack}`);
			}
		}
	}

	/**
	 * Log a debug message (only in verbose mode)
	 */
	public debug(message: string): void {
		if (this.verboseMode) {
			const timestamp = this.getTimestamp();
			this.outputChannel.appendLine(`[DEBUG] [${timestamp}] ${message}`);
		}
	}

	/**
	 * Log SSH connection events
	 */
	public ssh(message: string): void {
		const timestamp = this.getTimestamp();
		this.outputChannel.appendLine(`[SSH] [${timestamp}] ${message}`);
	}

	/**
	 * Log SFTP operations
	 */
	public sftp(message: string): void {
		if (this.verboseMode) {
			const timestamp = this.getTimestamp();
			this.outputChannel.appendLine(`[SFTP] [${timestamp}] ${message}`);
		}
	}

	/**
	 * Log transfer operations
	 */
	public transfer(message: string): void {
		const timestamp = this.getTimestamp();
		this.outputChannel.appendLine(`[TRANSFER] [${timestamp}] ${message}`);
	}

	/**
	 * Show the output channel
	 */
	public show(): void {
		this.outputChannel.show();
	}

	/**
	 * Hide the output channel
	 */
	public hide(): void {
		this.outputChannel.hide();
	}

	/**
	 * Clear all logs
	 */
	public clear(): void {
		this.outputChannel.clear();
	}

	/**
	 * Dispose the output channel
	 */
	public dispose(): void {
		this.outputChannel.dispose();
	}

	/**
	 * Get formatted timestamp
	 */
	private getTimestamp(): string {
		const now = new Date();
		return now.toLocaleTimeString('en-US', { hour12: false });
	}
}

// Singleton instance
let loggerInstance: Logger | undefined;

/**
 * Get the logger instance
 */
export function getLogger(): Logger {
	if (!loggerInstance) {
		loggerInstance = new Logger();
	}
	return loggerInstance;
}

/**
 * Initialize the logger
 */
export function initLogger(channelName?: string): Logger {
	loggerInstance = new Logger(channelName);
	return loggerInstance;
}

/**
 * Dispose the logger
 */
export function disposeLogger(): void {
	if (loggerInstance) {
		loggerInstance.dispose();
		loggerInstance = undefined;
	}
}
