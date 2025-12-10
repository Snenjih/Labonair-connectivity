import * as os from 'os';
import * as fs from 'fs';
import { Host } from '../../common/types';

// node-pty types
interface IPty {
	write(data: string): void;
	resize(cols: number, rows: number): void;
	kill(signal?: string): void;
	onData: (callback: (data: string) => void) => void;
	onExit: (callback: (code: { exitCode: number; signal?: number }) => void) => void;
}

interface INodePty {
	spawn(file: string, args: string[], options: {
		name?: string;
		cols?: number;
		rows?: number;
		cwd?: string;
		env?: { [key: string]: string | undefined };
	}): IPty;
}

// Dynamically import node-pty to handle cases where it's not installed
let pty: INodePty | null = null;
try {
	pty = require('node-pty');
} catch (e) {
	console.warn('[LocalPtyService] node-pty not available:', e);
}

/**
 * Local PTY Service
 * Provides local shell sessions using node-pty
 * Implements the same interface as SshSession for seamless switching
 */
export class LocalPtyService {
	private ptyProcess: IPty | null = null;
	private isConnected: boolean = false;

	constructor(
		private readonly host: Host,
		private readonly onData: (data: string) => void,
		private readonly onStatus: (status: 'connecting' | 'connected' | 'disconnected' | 'error', message?: string) => void
	) {}

	/**
	 * Connect to local shell
	 */
	public async connect(): Promise<void> {
		try {
			this.onStatus('connecting', 'Starting local shell...');

			if (!pty) {
				throw new Error('node-pty is not available. Please install it with: npm install node-pty');
			}

			// Determine shell based on platform and host configuration
			const shellInfo = this.getShellInfo();

			// Spawn the PTY process
			this.ptyProcess = pty.spawn(shellInfo.shell, shellInfo.args, {
				name: 'xterm-256color',
				cols: 80,
				rows: 24,
				cwd: os.homedir(),
				env: process.env as { [key: string]: string }
			});

			// Handle data from PTY
			this.ptyProcess.onData((data: string) => {
				this.onData(data);
			});

			// Handle PTY exit
			this.ptyProcess.onExit(({ exitCode, signal }) => {
				this.isConnected = false;
				this.onStatus('disconnected', `Shell exited with code ${exitCode}`);
			});

			this.isConnected = true;
			this.onStatus('connected', `Connected to ${shellInfo.shell}`);

		} catch (error) {
			this.handleError(error);
		}
	}

	/**
	 * Write data to the PTY
	 */
	public write(data: string): void {
		if (this.ptyProcess && this.isConnected) {
			this.ptyProcess.write(data);
		}
	}

	/**
	 * Resize the terminal window
	 */
	public resize(cols: number, rows: number): void {
		if (this.ptyProcess && this.isConnected) {
			this.ptyProcess.resize(cols, rows);
		}
	}

	/**
	 * Dispose and clean up the session
	 */
	public dispose(): void {
		if (this.ptyProcess) {
			this.ptyProcess.kill();
			this.ptyProcess = null;
		}
		this.isConnected = false;
	}

	public get connected(): boolean {
		return this.isConnected;
	}

	/**
	 * Check if a file exists locally
	 */
	public async checkFileExists(path: string): Promise<boolean> {
		try {
			await fs.promises.access(path);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Read a file's contents locally
	 */
	public async readFile(path: string): Promise<string> {
		return fs.promises.readFile(path, 'utf8');
	}

	/**
	 * Get shell information based on platform and host configuration
	 */
	private getShellInfo(): { shell: string; args: string[] } {
		const platform = os.platform();

		// Check for WSL configuration
		if (this.host.protocol === 'wsl' || this.host.wsl) {
			return {
				shell: 'wsl.exe',
				args: []
			};
		}

		// Use configured shell if available
		if (this.host.shell && this.host.shell !== 'default') {
			return {
				shell: this.host.shell,
				args: []
			};
		}

		// Default shells based on platform
		if (platform === 'win32') {
			// Check for PowerShell
			const shell = process.env.COMSPEC || 'cmd.exe';
			// Prefer PowerShell if available
			try {
				require('child_process').execSync('powershell.exe -Command "echo test"', { stdio: 'ignore' });
				return {
					shell: 'powershell.exe',
					args: ['-NoLogo']
				};
			} catch {
				return {
					shell: shell,
					args: []
				};
			}
		} else {
			// Unix-like systems (macOS, Linux)
			const shell = process.env.SHELL || '/bin/bash';
			return {
				shell: shell,
				args: ['-l'] // Login shell
			};
		}
	}

	/**
	 * Handle errors
	 */
	private handleError(error: any): void {
		let errorMessage = 'Unknown error';

		if (error.message) {
			errorMessage = error.message;
		}

		this.isConnected = false;
		this.onStatus('error', errorMessage);
		this.dispose();
	}
}
