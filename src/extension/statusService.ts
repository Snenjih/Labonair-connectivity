import * as net from 'net';
import { Host, HostStatus } from '../common/types';

/**
 * StatusService - Checks host online status via TCP port check
 */
export class StatusService {
    private hostStatuses: Map<string, HostStatus> = new Map();
    private checkInterval: NodeJS.Timeout | null = null;
    private onStatusChange?: (statuses: Record<string, HostStatus>) => void;

    constructor(onStatusChange?: (statuses: Record<string, HostStatus>) => void) {
        this.onStatusChange = onStatusChange;
    }

    /**
     * Check if a host is reachable via TCP port
     */
    public async checkHostStatus(host: string, port: number, timeout: number = 3000): Promise<boolean> {
        return new Promise((resolve) => {
            const socket = new net.Socket();
            let resolved = false;

            const cleanup = () => {
                if (!resolved) {
                    resolved = true;
                    socket.destroy();
                }
            };

            socket.setTimeout(timeout);

            socket.on('connect', () => {
                cleanup();
                resolve(true);
            });

            socket.on('timeout', () => {
                cleanup();
                resolve(false);
            });

            socket.on('error', () => {
                cleanup();
                resolve(false);
            });

            socket.on('close', () => {
                if (!resolved) {
                    resolved = true;
                    resolve(false);
                }
            });

            try {
                socket.connect(port, host);
            } catch {
                cleanup();
                resolve(false);
            }
        });
    }

    /**
     * Check status for a single host and update the status map
     */
    public async checkHost(host: Host): Promise<HostStatus> {
        try {
            const isOnline = await this.checkHostStatus(host.host, host.port);
            const status: HostStatus = isOnline ? 'online' : 'offline';
            this.hostStatuses.set(host.id, status);
            return status;
        } catch {
            this.hostStatuses.set(host.id, 'unknown');
            return 'unknown';
        }
    }

    /**
     * Check status for all hosts
     */
    public async checkAllHosts(hosts: Host[]): Promise<Record<string, HostStatus>> {
        const promises = hosts.map(async (host) => {
            const status = await this.checkHost(host);
            return { id: host.id, status };
        });

        await Promise.all(promises);
        return this.getAllStatuses();
    }

    /**
     * Start periodic status checks
     */
    public startPeriodicCheck(hosts: Host[], intervalMs: number = 30000): void {
        this.stopPeriodicCheck();

        // Initial check
        this.checkAllHosts(hosts).then((statuses) => {
            if (this.onStatusChange) {
                this.onStatusChange(statuses);
            }
        });

        // Periodic check
        this.checkInterval = setInterval(async () => {
            const statuses = await this.checkAllHosts(hosts);
            if (this.onStatusChange) {
                this.onStatusChange(statuses);
            }
        }, intervalMs);
    }

    /**
     * Stop periodic status checks
     */
    public stopPeriodicCheck(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    /**
     * Get status for a specific host
     */
    public getStatus(hostId: string): HostStatus {
        return this.hostStatuses.get(hostId) || 'unknown';
    }

    /**
     * Get all statuses as a record
     */
    public getAllStatuses(): Record<string, HostStatus> {
        const statuses: Record<string, HostStatus> = {};
        this.hostStatuses.forEach((status, id) => {
            statuses[id] = status;
        });
        return statuses;
    }

    /**
     * Clear all statuses
     */
    public clearStatuses(): void {
        this.hostStatuses.clear();
    }

    /**
     * Dispose of the service
     */
    public dispose(): void {
        this.stopPeriodicCheck();
        this.clearStatuses();
    }
}
