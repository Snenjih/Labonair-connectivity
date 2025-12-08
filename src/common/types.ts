export interface Tunnel {
	type: 'local' | 'remote';
	srcPort: number;
	dstHost: string;
	dstPort: number;
}

export interface Host {
	id: string;
	name: string;
	group: string;
	username: string;
	host: string;
	port: number;
	osIcon: 'linux' | 'windows' | 'mac' | 'docker' | 'other';
	tags: string[];
	jumpHostId?: string;
	tunnels?: Tunnel[];
	notes?: string;
	keepAlive?: boolean;
	authType?: 'password' | 'key' | 'agent' | 'credential';
	credentialId?: string;
	lastUsed?: number;
	protocol?: 'ssh' | 'local' | 'wsl';
}

export interface Credential {
	id: string;
	name: string;
	username: string;
	type: 'password' | 'key';
	folder?: string;
}

export interface Script {
	id: string;
	name: string;
	content: string;
	shell?: string;
}

export interface WebviewState {
	view: 'list' | 'edit' | 'credentials';
	hosts: Host[];
	selectedHost: Host | null;
	credentials?: Credential[];
	scripts?: Script[];
	sshAgentAvailable?: boolean;
	activeSessionHostIds?: string[];
	availableShells?: string[];
}

export interface GroupConfig {
	name: string;
	username?: string;
	port?: number;
	credentialId?: string;
}

export type Message =
	| { command: 'FETCH_DATA' }
	| { command: 'UPDATE_DATA', payload: { hosts: Host[], credentials?: Credential[], scripts?: Script[], activeSessionHostIds?: string[] } }
	| { command: 'SAVE_HOST', payload: { host: Host, password?: string, keyPath?: string } }
	| { command: 'DELETE_HOST', payload: { id: string } }
	| { command: 'CONNECT_SSH', payload: { id?: string; host?: Host } }
	| { command: 'PICK_KEY_FILE' }
	| { command: 'KEY_FILE_PICKED', payload: { path: string } }
	| { command: 'IMPORT_REQUEST', payload: { format: 'json' | 'ssh-config' } }
	| { command: 'EXPORT_REQUEST' }
	| { command: 'GET_CREDENTIALS' }
	| { command: 'SAVE_CREDENTIAL', payload: { credential: Credential, secret: string } }
	| { command: 'DELETE_CREDENTIAL', payload: { id: string } }
	| { command: 'RUN_SCRIPT', payload: { scriptId: string, hostId: string } }
	| { command: 'SAVE_SCRIPT', payload: { script: Script } }
	| { command: 'DELETE_SCRIPT', payload: { id: string } }
	| { command: 'SESSION_UPDATE', payload: { activeHostIds: string[] } }
	| { command: 'AGENT_STATUS', payload: { available: boolean } }
	| { command: 'GET_CONFIG', payload: { hostId: string } }
	| { command: 'GET_CONFIG', payload: { hostId: string } }
	| { command: 'SAVE_GROUP_CONFIG', payload: { config: GroupConfig } }
	| { command: 'CHECK_HOST_KEY', payload: { host: string, port: number, fingerprint: string, status: 'unknown' | 'invalid' } }
	| { command: 'CHECK_HOST_KEY', payload: { host: string, port: number, fingerprint: string, status: 'unknown' | 'invalid' } }
	| { command: 'ACCEPT_HOST_KEY', payload: { host: string, port: number, fingerprint: string, save: boolean } }
	| { command: 'DENY_HOST_KEY' }
	| { command: 'AVAILABLE_SHELLS', payload: { shells: string[] } };


