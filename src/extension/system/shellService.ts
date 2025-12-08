import * as os from 'os';
import * as cp from 'child_process';
import * as util from 'util';

const exec = util.promisify(cp.exec);

export class ShellService {
	public async getAvailableShells(): Promise<string[]> {
		const platform = os.platform();
		const shells: string[] = [];

		if (platform === 'win32') {
			shells.push('powershell.exe', 'cmd.exe');

			// Detect Git Bash
			try {
				await exec('git --version');
				// Common path, or assume user adds it to PATH
				shells.push('git-bash.exe');
			} catch (e) { /* ignore */ }

			// Detect WSL distros
			try {
				const { stdout } = await exec('wsl -l -q');
				// Output is UTF-16 usually on Windows, need care?
				// wsl -l -q outputs distro names separated by newlines/CRs
				// But Node's exec decodes it reasonably well usually.
				const lines = stdout.toString().split(/\r?\n/).filter(line => line.trim() !== '');
				// remove UTF-16 artifacts if any (like null bytes)
				const distros = lines.map(l => l.replace(/\0/g, '').trim()).filter(l => l.length > 0);

				distros.forEach(d => shells.push(`WSL: ${d}`));
			} catch (e) {
				console.error('Error listing WSL:', e);
			}
		} else {
			// Mac/Linux
			shells.push('/bin/bash', '/bin/zsh');
			// standard check
			if (platform === 'darwin') {
				// Maybe look for others
			}
		}

		return shells;
	}
}
