import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as os from 'os';

const execAsync = promisify(exec);

/**
 * SSH Agent Service
 * Detects and manages SSH agent connections across platforms
 */
export class SshAgentService {
	/**
	 * Checks if an SSH agent is running
	 * - On Unix/macOS: Checks for SSH_AUTH_SOCK environment variable
	 * - On Windows: Checks for Pageant or OpenSSH Authentication Agent
	 */
	public async isAgentRunning(): Promise<boolean> {
		try {
			const status = await this.getAgentStatus();
			return status.running;
		} catch (error) {
			console.error('[SshAgentService] Error checking agent status:', error);
			return false;
		}
	}

	/**
	 * Gets detailed SSH agent status including socket path
	 */
	public async getAgentStatus(): Promise<{ running: boolean; socket?: string; pid?: number }> {
		const platform = os.platform();

		if (platform === 'win32') {
			return this.getWindowsAgentStatus();
		} else {
			return this.getUnixAgentStatus();
		}
	}

	/**
	 * Gets the SSH agent socket path or identifier
	 * Returns the appropriate value to use for ssh2's agent config
	 */
	public async getAgentSocket(): Promise<string | undefined> {
		const status = await this.getAgentStatus();
		return status.running ? status.socket : undefined;
	}

	/**
	 * Checks for SSH agent on Unix/macOS systems
	 */
	private async getUnixAgentStatus(): Promise<{ running: boolean; socket?: string; pid?: number }> {
		try {
			// Check SSH_AUTH_SOCK environment variable
			const authSock = process.env.SSH_AUTH_SOCK;

			if (!authSock) {
				console.log('[SshAgentService] SSH_AUTH_SOCK not set');
				return { running: false };
			}

			// Check if the socket file exists
			if (!fs.existsSync(authSock)) {
				console.log('[SshAgentService] SSH agent socket file does not exist:', authSock);
				return { running: false };
			}

			// Try to get agent PID
			let pid: number | undefined;
			const agentPid = process.env.SSH_AGENT_PID;
			if (agentPid) {
				pid = parseInt(agentPid, 10);
			}

			// Verify agent is responsive by listing keys
			try {
				await execAsync('ssh-add -l', { timeout: 2000 });
				console.log(`[SshAgentService] SSH agent is running (socket: ${authSock})`);
				return { running: true, socket: authSock, pid };
			} catch (error: any) {
				// Exit code 1 means "no identities", which is still a running agent
				// Exit code 2 means "could not connect to agent"
				if (error.code === 1) {
					console.log(`[SshAgentService] SSH agent is running with no identities (socket: ${authSock})`);
					return { running: true, socket: authSock, pid };
				}
				console.log('[SshAgentService] SSH agent not responsive:', error.message);
				return { running: false };
			}
		} catch (error) {
			console.error('[SshAgentService] Error checking Unix SSH agent:', error);
			return { running: false };
		}
	}

	/**
	 * Checks for SSH agent on Windows systems
	 * Looks for:
	 * 1. OpenSSH Authentication Agent service
	 * 2. Pageant (PuTTY agent) process
	 * 3. SSH_AUTH_SOCK (from Git Bash or WSL)
	 */
	private async getWindowsAgentStatus(): Promise<{ running: boolean; socket?: string; pid?: number }> {
		try {
			// Check for OpenSSH Authentication Agent service (preferred)
			try {
				const { stdout } = await execAsync('sc query ssh-agent', { timeout: 2000 });
				if (stdout.includes('RUNNING')) {
					console.log('[SshAgentService] OpenSSH Authentication Agent is running');
					// On Windows with OpenSSH agent, we use a named pipe
					return { running: true, socket: '\\\\.\\pipe\\openssh-ssh-agent' };
				}
			} catch (error) {
				console.log('[SshAgentService] OpenSSH Authentication Agent not running');
			}

			// Check for Pageant process
			try {
				const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq pageant.exe" /NH', { timeout: 2000 });
				if (stdout.toLowerCase().includes('pageant.exe')) {
					console.log('[SshAgentService] Pageant is running');
					// Pageant uses a special identifier
					return { running: true, socket: 'pageant' };
				}
			} catch (error) {
				console.log('[SshAgentService] Pageant not found');
			}

			// Check SSH_AUTH_SOCK for Windows OpenSSH (Git Bash or WSL)
			const authSock = process.env.SSH_AUTH_SOCK;
			if (authSock) {
				try {
					await execAsync('ssh-add -l', { timeout: 2000 });
					console.log(`[SshAgentService] SSH agent detected via SSH_AUTH_SOCK: ${authSock}`);
					return { running: true, socket: authSock };
				} catch (error: any) {
					if (error.code === 1) {
						console.log(`[SshAgentService] SSH agent running with no identities (socket: ${authSock})`);
						return { running: true, socket: authSock };
					}
				}
			}

			console.log('[SshAgentService] No SSH agent found on Windows');
			return { running: false };
		} catch (error) {
			console.error('[SshAgentService] Error checking Windows SSH agent:', error);
			return { running: false };
		}
	}
}
