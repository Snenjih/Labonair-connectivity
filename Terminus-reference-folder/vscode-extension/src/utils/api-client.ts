import axios, { AxiosInstance } from 'axios';
import { StorageManager } from '../storage-manager';
import {
    SSHHost,
    CreateSSHHostDto,
    UpdateSSHHostDto,
    UserLoginDto,
    UserRegisterDto,
    AuthResponse,
    SSHTunnel,
    FileManagerItem,
    ServerStats
} from '../types';

export class ApiClient {
    private api: AxiosInstance;

    constructor(
        private port: number,
        private storageManager: StorageManager
    ) {
        this.api = axios.create({
            baseURL: `http://localhost:${port}`,
            timeout: 10000
        });

        // Setup request interceptor to add authentication token
        this.api.interceptors.request.use(async (config) => {
            const token = await this.storageManager.getUserToken();
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            return config;
        });

        // Setup response interceptor for error handling
        this.api.interceptors.response.use(
            response => response,
            async error => {
                // Handle 401 - Token expired or invalid
                if (error.response?.status === 401) {
                    await this.storageManager.deleteUserToken();
                    const err = new Error('Authentication failed. Please login again.');
                    err.name = 'AuthenticationError';
                    return Promise.reject(err);
                }

                // Handle 403 - Access denied
                if (error.response?.status === 403) {
                    const err = new Error('Access denied. Check user permissions or data access settings.');
                    err.name = 'ForbiddenError';
                    return Promise.reject(err);
                }

                // Handle network errors
                if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
                    const err = new Error('Cannot connect to backend server. Ensure it is running on port ' + this.port);
                    err.name = 'ConnectionError';
                    return Promise.reject(err);
                }

                // Handle timeout
                if (error.code === 'ECONNABORTED') {
                    const err = new Error('Request timeout. The server took too long to respond.');
                    err.name = 'TimeoutError';
                    return Promise.reject(err);
                }

                return Promise.reject(error);
            }
        );
    }

    // ============================================
    // Authentication
    // ============================================

    async login(credentials: UserLoginDto): Promise<AuthResponse> {
        const response = await this.api.post<AuthResponse>('/users/login', credentials);
        return response.data;
    }

    async register(userData: UserRegisterDto): Promise<AuthResponse> {
        const response = await this.api.post<AuthResponse>('/users/register', userData);
        return response.data;
    }

    async checkHealth(): Promise<boolean> {
        try {
            const response = await this.api.get('/health');
            return response.status === 200;
        } catch {
            return false;
        }
    }

    // ============================================
    // SSH Hosts
    // ============================================

    async getHosts(): Promise<SSHHost[]> {
        const response = await this.api.get<SSHHost[]>('/ssh/hosts');
        return response.data;
    }

    async getHost(id: number): Promise<SSHHost> {
        const response = await this.api.get<SSHHost>(`/ssh/hosts/${id}`);
        return response.data;
    }

    async createHost(host: CreateSSHHostDto): Promise<SSHHost> {
        const response = await this.api.post<SSHHost>('/ssh/hosts', host);
        return response.data;
    }

    async updateHost(id: number, updates: UpdateSSHHostDto): Promise<SSHHost> {
        const response = await this.api.put<SSHHost>(`/ssh/hosts/${id}`, updates);
        return response.data;
    }

    async deleteHost(id: number): Promise<void> {
        await this.api.delete(`/ssh/hosts/${id}`);
    }

    async duplicateHost(id: number): Promise<SSHHost> {
        const response = await this.api.post<SSHHost>(`/ssh/hosts/${id}/duplicate`);
        return response.data;
    }

    async exportHost(id: number): Promise<SSHHost> {
        const response = await this.api.get<SSHHost>(`/ssh/hosts/${id}/export`);
        return response.data;
    }

    async testConnection(id: number): Promise<{ success: boolean; message: string }> {
        const response = await this.api.post(`/ssh/hosts/${id}/test`);
        return response.data;
    }

    // ============================================
    // SSH Tunnels
    // ============================================

    async getTunnels(hostId?: number): Promise<SSHTunnel[]> {
        const url = hostId ? `/ssh/tunnels?hostId=${hostId}` : '/ssh/tunnels';
        const response = await this.api.get<SSHTunnel[]>(url);
        return response.data;
    }

    async createTunnel(hostId: number, tunnel: {
        name: string;
        localPort: number;
        remoteHost: string;
        remotePort: number;
        type: 'local' | 'remote';
    }): Promise<SSHTunnel> {
        const response = await this.api.post<SSHTunnel>('/ssh/tunnels', {
            hostId,
            ...tunnel
        });
        return response.data;
    }

    async deleteTunnel(id: number): Promise<void> {
        await this.api.delete(`/ssh/tunnels/${id}`);
    }

    // ============================================
    // File Manager
    // ============================================

    async listFiles(hostId: number, path: string): Promise<FileManagerItem[]> {
        const response = await this.api.get<FileManagerItem[]>(
            `/ssh/files/${hostId}/list`,
            { params: { path } }
        );
        return response.data;
    }

    async downloadFile(hostId: number, path: string): Promise<Blob> {
        const response = await this.api.get(
            `/ssh/files/${hostId}/download`,
            {
                params: { path },
                responseType: 'blob'
            }
        );
        return response.data;
    }

    async uploadFile(hostId: number, remotePath: string, file: File): Promise<void> {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('path', remotePath);

        await this.api.post(
            `/ssh/files/${hostId}/upload`,
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            }
        );
    }

    async deleteFile(hostId: number, path: string): Promise<void> {
        await this.api.delete(`/ssh/files/${hostId}`, { params: { path } });
    }

    async createDirectory(hostId: number, path: string): Promise<void> {
        await this.api.post(`/ssh/files/${hostId}/mkdir`, { path });
    }

    // ============================================
    // Server Stats
    // ============================================

    async getServerStats(hostId: number): Promise<ServerStats> {
        const response = await this.api.get<ServerStats>(`/ssh/stats/${hostId}`);
        return response.data;
    }

    // ============================================
    // Settings
    // ============================================

    async getSetting(key: string): Promise<string | null> {
        try {
            const response = await this.api.get<{ value: string }>(`/settings/${key}`);
            return response.data.value;
        } catch {
            return null;
        }
    }

    async saveSetting(key: string, value: string): Promise<void> {
        await this.api.post('/settings', { key, value });
    }

    async deleteSetting(key: string): Promise<void> {
        await this.api.delete(`/settings/${key}`);
    }
}
