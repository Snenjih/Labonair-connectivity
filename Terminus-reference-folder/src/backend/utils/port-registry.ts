/**
 * Central port registry for all backend servers.
 * Allows services to share their assigned ports with each other.
 */

class PortRegistry {
  private static instance: PortRegistry;
  private ports: Map<string, number> = new Map();

  private constructor() {}

  static getInstance(): PortRegistry {
    if (!PortRegistry.instance) {
      PortRegistry.instance = new PortRegistry();
    }
    return PortRegistry.instance;
  }

  /**
   * Register a port for a specific service
   */
  setPort(serviceName: string, port: number): void {
    this.ports.set(serviceName, port);
  }

  /**
   * Get the port for a specific service
   */
  getPort(serviceName: string): number | undefined {
    return this.ports.get(serviceName);
  }

  /**
   * Get the port for a service, with a fallback value
   */
  getPortWithFallback(serviceName: string, fallback: number): number {
    return this.ports.get(serviceName) || fallback;
  }

  /**
   * Check if a service port has been registered
   */
  hasPort(serviceName: string): boolean {
    return this.ports.has(serviceName);
  }

  /**
   * Get all registered ports
   */
  getAllPorts(): Map<string, number> {
    return new Map(this.ports);
  }
}

export const portRegistry = PortRegistry.getInstance();

// Service name constants
export const SERVICE_NAMES = {
  MAIN_API: "main-api",
  SSH_TERMINAL: "ssh-terminal",
  SSH_TUNNEL: "ssh-tunnel",
  SSH_FILE_MANAGER: "ssh-file-manager",
  SERVER_STATS: "server-stats",
  LOCAL_TERMINAL: "local-terminal",
  LOCAL_FILE_MANAGER: "local-file-manager",
  TRANSFER_PROGRESS: "transfer-progress",
  EXTERNAL_EDITOR: "external-editor",
} as const;
