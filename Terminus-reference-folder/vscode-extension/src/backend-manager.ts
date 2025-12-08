import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import { StorageManager } from './storage-manager';
import axios from 'axios';

export class BackendManager {
    private process: ChildProcess | null = null;
    private healthCheckInterval: NodeJS.Timeout | null = null;
    private restartCount = 0;
    private backendPort = 30001;
    private dataDir: string = '';
    private isShuttingDown = false;

    constructor(
        private context: vscode.ExtensionContext,
        private storageManager: StorageManager,
        private outputChannel: vscode.OutputChannel
    ) {
        // Get configuration
        const config = vscode.workspace.getConfiguration('terminus');
        this.backendPort = config.get<number>('backendPort') || 30001;
    }

    async start(): Promise<number> {
        if (this.process) {
            this.outputChannel.appendLine('Backend is already running');
            return this.backendPort;
        }

        // Prepare data directory
        this.dataDir = path.join(
            this.context.globalStorageUri.fsPath,
            'terminus-data'
        );

        // Ensure data directory exists
        try {
            await vscode.workspace.fs.createDirectory(
                vscode.Uri.file(this.dataDir)
            );
            this.outputChannel.appendLine(`Data directory: ${this.dataDir}`);
        } catch (error) {
            // Directory might already exist
            if (!fs.existsSync(this.dataDir)) {
                throw new Error(`Failed to create data directory: ${this.dataDir}`);
            }
        }

        // Get backend path
        const backendPath = this.context.asAbsolutePath(
            path.join('dist', 'backend', 'backend', 'starter.js')
        );

        if (!fs.existsSync(backendPath)) {
            throw new Error(`Backend not found at: ${backendPath}`);
        }

        this.outputChannel.appendLine(`Backend path: ${backendPath}`);

        // Get secrets from storage or generate new ones
        let jwtSecret = await this.storageManager.getJWTSecret();
        let databaseKey = await this.storageManager.getDatabaseKey();
        let internalAuthToken = await this.storageManager.getInternalAuthToken();

        // Prepare environment variables
        const env = {
            ...process.env,
            DATA_DIR: this.dataDir,
            PORT: this.backendPort.toString(),
            NODE_ENV: 'production',
            // Pass secrets if available
            ...(jwtSecret && { JWT_SECRET: jwtSecret }),
            ...(databaseKey && { DATABASE_KEY: databaseKey }),
            ...(internalAuthToken && { INTERNAL_AUTH_TOKEN: internalAuthToken })
        };

        // Spawn backend process
        this.outputChannel.appendLine(`Spawning backend on port ${this.backendPort}...`);

        this.process = spawn(process.execPath, [backendPath], {
            env,
            stdio: ['ignore', 'pipe', 'pipe'],
            detached: false,  // CRITICAL: Ensure child dies with parent
            cwd: path.dirname(backendPath)
        });

        // Setup stdout handler
        this.process.stdout?.on('data', async (data: Buffer) => {
            const output = data.toString();
            this.outputChannel.appendLine(`[Backend] ${output}`);

            // Capture generated secrets if not already stored
            if (!jwtSecret && output.includes('Generated JWT_SECRET:')) {
                const match = output.match(/JWT_SECRET:\s*(.+)/);
                if (match) {
                    await this.storageManager.setJWTSecret(match[1].trim());
                    this.outputChannel.appendLine('JWT secret stored in SecretStorage');
                }
            }

            if (!databaseKey && output.includes('Generated DATABASE_KEY:')) {
                const match = output.match(/DATABASE_KEY:\s*(.+)/);
                if (match) {
                    await this.storageManager.setDatabaseKey(match[1].trim());
                    this.outputChannel.appendLine('Database key stored in SecretStorage');
                }
            }

            if (!internalAuthToken && output.includes('Generated INTERNAL_AUTH_TOKEN:')) {
                const match = output.match(/INTERNAL_AUTH_TOKEN:\s*(.+)/);
                if (match) {
                    await this.storageManager.setInternalAuthToken(match[1].trim());
                    this.outputChannel.appendLine('Internal auth token stored in SecretStorage');
                }
            }
        });

        // Setup stderr handler
        this.process.stderr?.on('data', (data: Buffer) => {
            const output = data.toString();
            this.outputChannel.appendLine(`[Backend Error] ${output}`);
        });

        // Handle process exit
        this.process.on('exit', (code, signal) => {
            this.outputChannel.appendLine(`Backend exited with code ${code} and signal ${signal}`);
            this.process = null;

            // Auto-restart if not shutting down
            if (!this.isShuttingDown) {
                const config = vscode.workspace.getConfiguration('terminus');
                const autoRestart = config.get<boolean>('autoRestart') || true;
                const maxRestarts = config.get<number>('maxRestarts') || 3;

                if (autoRestart && this.restartCount < maxRestarts) {
                    this.restartCount++;
                    vscode.window.showWarningMessage(
                        `Terminus backend crashed. Restarting (attempt ${this.restartCount}/${maxRestarts})...`
                    );
                    this.outputChannel.appendLine(`Auto-restarting backend (attempt ${this.restartCount}/${maxRestarts})...`);

                    // Restart after 2 seconds
                    setTimeout(() => {
                        this.start().catch(error => {
                            vscode.window.showErrorMessage(
                                `Failed to restart backend: ${error instanceof Error ? error.message : String(error)}`
                            );
                        });
                    }, 2000);
                } else if (this.restartCount >= maxRestarts) {
                    vscode.window.showErrorMessage(
                        `Terminus backend failed to start after ${maxRestarts} attempts. Please check the Output panel.`
                    );
                }
            }
        });

        // Handle process error
        this.process.on('error', (error) => {
            this.outputChannel.appendLine(`Backend process error: ${error.message}`);
            vscode.window.showErrorMessage(`Backend error: ${error.message}`);
        });

        // Wait for backend to be ready (max 10 seconds)
        const ready = await this.waitForBackend(10000);
        if (!ready) {
            await this.stop();
            throw new Error('Backend failed to start within 10 seconds');
        }

        // Start health monitoring
        this.startHealthCheck();

        // Reset restart count on successful start
        this.restartCount = 0;

        return this.backendPort;
    }

    private async waitForBackend(timeoutMs: number): Promise<boolean> {
        const startTime = Date.now();
        const url = `http://localhost:${this.backendPort}/health`;

        this.outputChannel.appendLine(`Waiting for backend at ${url}...`);

        while (Date.now() - startTime < timeoutMs) {
            try {
                const response = await axios.get(url, { timeout: 1000 });
                if (response.status === 200) {
                    this.outputChannel.appendLine('Backend is ready!');
                    return true;
                }
            } catch (error) {
                // Backend not ready yet, wait 500ms and retry
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        this.outputChannel.appendLine('Backend failed to respond within timeout');
        return false;
    }

    private startHealthCheck(): void {
        const config = vscode.workspace.getConfiguration('terminus');
        const interval = config.get<number>('healthCheckInterval') || 30000;

        this.healthCheckInterval = setInterval(async () => {
            if (this.isShuttingDown) {
                return;
            }

            try {
                const response = await axios.get(
                    `http://localhost:${this.backendPort}/health`,
                    { timeout: 5000 }
                );

                if (response.status !== 200) {
                    throw new Error(`Backend unhealthy: status ${response.status}`);
                }
            } catch (error) {
                this.outputChannel.appendLine(
                    `Health check failed: ${error instanceof Error ? error.message : String(error)}`
                );
                // The exit handler will handle restart if configured
            }
        }, interval);
    }

    async stop(): Promise<void> {
        this.isShuttingDown = true;

        // Stop health check
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }

        if (!this.process || this.process.killed) {
            this.outputChannel.appendLine('Backend is not running');
            return;
        }

        this.outputChannel.appendLine('Stopping backend process...');

        return new Promise((resolve) => {
            if (!this.process) {
                resolve();
                return;
            }

            // Set up one-time exit listener
            this.process.once('exit', () => {
                this.outputChannel.appendLine('Backend stopped gracefully');
                this.process = null;
                resolve();
            });

            // Send SIGTERM for graceful shutdown
            this.outputChannel.appendLine('Sending SIGTERM to backend...');
            this.process.kill('SIGTERM');

            // Force kill after 5 seconds if still running
            setTimeout(() => {
                if (this.process && !this.process.killed) {
                    this.outputChannel.appendLine('Backend did not stop, sending SIGKILL...');
                    this.process.kill('SIGKILL');
                    setTimeout(() => {
                        this.process = null;
                        resolve();
                    }, 1000);
                }
            }, 5000);
        });
    }

    getPort(): number {
        return this.backendPort;
    }

    isRunning(): boolean {
        return this.process !== null && !this.process.killed;
    }
}
