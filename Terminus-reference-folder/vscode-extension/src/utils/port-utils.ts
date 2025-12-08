/**
 * Port utilities for detecting and managing available ports
 */

import * as net from 'net';

/**
 * Checks if a port is available
 * @param port The port number to check
 * @returns Promise<boolean> True if port is available, false otherwise
 */
export async function isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const server = net.createServer();

        server.once('error', (err: NodeJS.ErrnoException) => {
            if (err.code === 'EADDRINUSE') {
                resolve(false);
            } else {
                resolve(false);
            }
        });

        server.once('listening', () => {
            server.close();
            resolve(true);
        });

        try {
            server.listen(port, '127.0.0.1');
        } catch {
            resolve(false);
        }
    });
}

/**
 * Finds the first available port starting from a given port
 * @param startPort The starting port number
 * @param maxAttempts Maximum number of ports to check (default: 10)
 * @returns Promise<number> The first available port found
 * @throws Error if no available port is found within maxAttempts
 */
export async function findAvailablePort(
    startPort: number = 30001,
    maxAttempts: number = 10
): Promise<number> {
    for (let i = 0; i < maxAttempts; i++) {
        const port = startPort + i;
        if (await isPortAvailable(port)) {
            return port;
        }
    }

    throw new Error(
        `No available port found in range ${startPort}-${startPort + maxAttempts - 1}`
    );
}

/**
 * Waits for a port to become available (useful for server startup verification)
 * @param port The port number to wait for
 * @param timeout Maximum time to wait in milliseconds (default: 30000)
 * @param checkInterval Interval between checks in milliseconds (default: 100)
 * @returns Promise<void> Resolves when port is available
 * @throws Error if timeout is exceeded
 */
export async function waitForPort(
    port: number,
    timeout: number = 30000,
    checkInterval: number = 100
): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        if (await isPortAvailable(port)) {
            return;
        }

        await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }

    throw new Error(
        `Timeout waiting for port ${port} to become available (${timeout}ms)`
    );
}

/**
 * Checks if a port is in use (reverse of isPortAvailable)
 * @param port The port number to check
 * @returns Promise<boolean> True if port is in use, false otherwise
 */
export async function isPortInUse(port: number): Promise<boolean> {
    return !(await isPortAvailable(port));
}

/**
 * Gets a range of available ports
 * @param count Number of consecutive ports needed
 * @param startPort Starting port number (default: 30001)
 * @returns Promise<number[]> Array of available ports
 * @throws Error if not enough consecutive ports are found
 */
export async function getAvailablePorts(
    count: number,
    startPort: number = 30001
): Promise<number[]> {
    const ports: number[] = [];
    let currentPort = startPort;
    let consecutiveAvailable = 0;

    // Search for enough consecutive ports
    while (consecutiveAvailable < count && currentPort < startPort + 1000) {
        if (await isPortAvailable(currentPort)) {
            ports.push(currentPort);
            consecutiveAvailable++;
        } else {
            ports.length = 0;
            consecutiveAvailable = 0;
        }
        currentPort++;
    }

    if (ports.length < count) {
        throw new Error(
            `Could not find ${count} consecutive available ports starting from ${startPort}`
        );
    }

    return ports;
}
