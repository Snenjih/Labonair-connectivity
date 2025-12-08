import * as vscode from 'vscode';
import * as net from 'net';
import * as os from 'os';

export class SshAgentService {
	constructor(private context: vscode.ExtensionContext) { }

	public async isAgentAvailable(): Promise<boolean> {
		const sockPath = process.env.SSH_AUTH_SOCK;
		const isWin = os.platform() === 'win32';

		if (isWin) {
			return new Promise(resolve => {
				const pipePath = '\\\\.\\pipe\\openssh-ssh-agent';
				const client = net.connect(pipePath, () => {
					client.end();
					resolve(true);
				});
				client.on('error', () => resolve(false));
			});
		} else {
			if (!sockPath) return false;
			return new Promise(resolve => {
				const client = net.connect(sockPath, () => {
					client.end();
					resolve(true);
				});
				client.on('error', () => resolve(false));
			});
		}
	}
}
