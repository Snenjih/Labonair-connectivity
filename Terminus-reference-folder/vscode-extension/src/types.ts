/**
 * Type definitions for Terminus VS Code Extension
 */

export interface SSHHost {
    id: number;
    hostname: string;
    host: string;
    port: number;
    username: string;
    password?: string;
    privateKey?: string;
    passphrase?: string;
    folder?: string;
    tags?: string[];
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateSSHHostDto {
    hostname: string;
    host: string;
    port?: number;
    username: string;
    password?: string;
    privateKey?: string;
    passphrase?: string;
    folder?: string;
    tags?: string[];
    notes?: string;
}

export interface UpdateSSHHostDto {
    hostname?: string;
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    privateKey?: string;
    passphrase?: string;
    folder?: string;
    tags?: string[];
    notes?: string;
}

export interface UserLoginDto {
    username: string;
    password: string;
}

export interface UserRegisterDto {
    username: string;
    password: string;
    email?: string;
}

export interface AuthResponse {
    token: string;
    user: {
        id: number;
        username: string;
        email?: string;
    };
}

export interface SSHTunnel {
    id: number;
    hostId: number;
    name: string;
    localPort: number;
    remoteHost: string;
    remotePort: number;
    type: 'local' | 'remote';
    status: 'active' | 'inactive' | 'error';
    createdAt: string;
}

export interface FileManagerItem {
    name: string;
    path: string;
    type: 'file' | 'directory' | 'link';
    size: number;
    permissions: string;
    owner: string;
    group: string;
    modifiedAt: string;
}

export interface ServerStats {
    cpu: {
        usage: number;
        cores: number;
    };
    memory: {
        total: number;
        used: number;
        free: number;
        percentage: number;
    };
    disk: {
        total: number;
        used: number;
        free: number;
        percentage: number;
    };
    uptime: number;
}
