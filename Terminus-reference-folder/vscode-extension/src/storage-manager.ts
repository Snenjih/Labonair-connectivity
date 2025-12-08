import * as vscode from 'vscode';

/**
 * StorageManager provides a unified interface for storing sensitive and non-sensitive data
 *
 * Sensitive data (encrypted by VS Code):
 * - JWT secrets
 * - Database encryption keys
 * - Internal authentication tokens
 * - User tokens
 *
 * Non-sensitive data (global state):
 * - Backend port
 * - Configuration settings
 * - Cache data
 */
export class StorageManager {
    constructor(
        private secrets: vscode.SecretStorage,
        private globalState: vscode.Memento
    ) {}

    // ============================================
    // Sensitive Data (SecretStorage API)
    // ============================================

    /**
     * Get JWT secret used for token signing
     */
    async getJWTSecret(): Promise<string | undefined> {
        return await this.secrets.get('terminus.jwt_secret');
    }

    /**
     * Store JWT secret
     */
    async setJWTSecret(secret: string): Promise<void> {
        await this.secrets.store('terminus.jwt_secret', secret);
    }

    /**
     * Get database encryption key
     */
    async getDatabaseKey(): Promise<string | undefined> {
        return await this.secrets.get('terminus.database_key');
    }

    /**
     * Store database encryption key
     */
    async setDatabaseKey(key: string): Promise<void> {
        await this.secrets.store('terminus.database_key', key);
    }

    /**
     * Get internal authentication token
     */
    async getInternalAuthToken(): Promise<string | undefined> {
        return await this.secrets.get('terminus.internal_auth_token');
    }

    /**
     * Store internal authentication token
     */
    async setInternalAuthToken(token: string): Promise<void> {
        await this.secrets.store('terminus.internal_auth_token', token);
    }

    /**
     * Get user authentication token (JWT)
     */
    async getUserToken(): Promise<string | undefined> {
        return await this.secrets.get('terminus.user_token');
    }

    /**
     * Store user authentication token (JWT)
     */
    async setUserToken(token: string): Promise<void> {
        await this.secrets.store('terminus.user_token', token);
    }

    /**
     * Delete user authentication token
     */
    async deleteUserToken(): Promise<void> {
        await this.secrets.delete('terminus.user_token');
    }

    /**
     * Clear all sensitive data
     */
    async clearSensitiveData(): Promise<void> {
        await this.secrets.delete('terminus.jwt_secret');
        await this.secrets.delete('terminus.database_key');
        await this.secrets.delete('terminus.internal_auth_token');
        await this.secrets.delete('terminus.user_token');
    }

    // ============================================
    // Non-Sensitive Data (Global State)
    // ============================================

    /**
     * Get backend port number
     */
    getBackendPort(): number | undefined {
        return this.globalState.get<number>('terminus.backend_port');
    }

    /**
     * Store backend port number
     */
    async setBackendPort(port: number): Promise<void> {
        await this.globalState.update('terminus.backend_port', port);
    }

    /**
     * Get last used username
     */
    getLastUsername(): string | undefined {
        return this.globalState.get<string>('terminus.last_username');
    }

    /**
     * Store last used username
     */
    async setLastUsername(username: string): Promise<void> {
        await this.globalState.update('terminus.last_username', username);
    }

    /**
     * Get whether user completed initial setup
     */
    isSetupComplete(): boolean {
        return this.globalState.get<boolean>('terminus.setup_complete', false);
    }

    /**
     * Mark initial setup as complete
     */
    async setSetupComplete(complete: boolean): Promise<void> {
        await this.globalState.update('terminus.setup_complete', complete);
    }

    /**
     * Get extension version (for migration detection)
     */
    getExtensionVersion(): string | undefined {
        return this.globalState.get<string>('terminus.extension_version');
    }

    /**
     * Store extension version
     */
    async setExtensionVersion(version: string): Promise<void> {
        await this.globalState.update('terminus.extension_version', version);
    }

    /**
     * Get last health check timestamp
     */
    getLastHealthCheck(): number | undefined {
        return this.globalState.get<number>('terminus.last_health_check');
    }

    /**
     * Store last health check timestamp
     */
    async setLastHealthCheck(timestamp: number): Promise<void> {
        await this.globalState.update('terminus.last_health_check', timestamp);
    }

    /**
     * Clear all non-sensitive data
     */
    async clearGlobalState(): Promise<void> {
        const keys = this.globalState.keys();
        for (const key of keys) {
            if (key.startsWith('terminus.')) {
                await this.globalState.update(key, undefined);
            }
        }
    }

    /**
     * Clear all stored data (sensitive and non-sensitive)
     */
    async clearAll(): Promise<void> {
        await this.clearSensitiveData();
        await this.clearGlobalState();
    }

    // ============================================
    // Utility Methods
    // ============================================

    /**
     * Check if user is authenticated (has valid token)
     */
    async isAuthenticated(): Promise<boolean> {
        const token = await this.getUserToken();
        return token !== undefined && token.length > 0;
    }

    /**
     * Get all keys stored in global state (for debugging)
     */
    getGlobalStateKeys(): readonly string[] {
        return this.globalState.keys();
    }
}
