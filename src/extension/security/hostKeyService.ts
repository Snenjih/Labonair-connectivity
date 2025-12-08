import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
// @ts-ignore
// import * as ssh2 from 'ssh2';

export class HostKeyService {
	private readonly knownHostsPath: string;

	constructor() {
		this.knownHostsPath = path.join(os.homedir(), '.ssh', 'known_hosts');
	}



	private getSsh2() {
		return null;
		/*
		try {
			// @ts-ignore
			return require('ssh2');
		} catch (e) {
			console.error('Failed to load ssh2:', e);
			return null;
		}
		*/
	}

	public async verifyHostKey(host: string, port: number, keyAlgo: string, key: Buffer): Promise<'valid' | 'invalid' | 'unknown'> {
		// Basic implementation: read known_hosts manually for now or use ssh2's utils if available.
		// Note: ssh2 doesn't export a high-level known_hosts parser easily in this version.
		// For simplicity/robustness in this context, we'll check if we can parse it line by line.

		// Example usage if we needed ssh2:
		const ssh2 = this.getSsh2();
		if (!ssh2) {
			// Fallback or verify we don't strictly need it for *parsing* text files.
			// But if we used it for hashing/etc, we'd need it.
		}

		if (!fs.existsSync(this.knownHostsPath)) {
			return 'unknown';
		}

		const content = fs.readFileSync(this.knownHostsPath, 'utf8');
		const lines = content.split(/\r?\n/);

		const fingerprint = key.toString('base64');
		const entryPrefix = `[${host}]:${port}`; // rudimentary check, standard compliant parsing is complex

		// Check for exact matches
		for (const line of lines) {
			if (line.startsWith(entryPrefix) || line.startsWith(host)) {
				// Found a matching host entry
				if (line.includes(fingerprint)) {
					return 'valid';
				} else {
					// Host matches but key differs -> Potential MITM or Changed Key
					// We need to be careful about unrelated keys (ecdsa vs rsa) for same host
					// But if we find a mismatch for the *same type* it is invalid.
					// For now, if we see the host but not this key, return invalid to prompt user.
					// Ideally we check key type too.
					return 'invalid';
				}
			}
		}

		return 'unknown';
	}

	public async addHostKey(host: string, port: number, keyAlgo: string, key: Buffer): Promise<void> {
		const entry = `[${host}]:${port} ${keyAlgo} ${key.toString('base64')}\n`;

		if (!fs.existsSync(path.dirname(this.knownHostsPath))) {
			fs.mkdirSync(path.dirname(this.knownHostsPath), { recursive: true });
		}

		fs.appendFileSync(this.knownHostsPath, entry);
	}
}
