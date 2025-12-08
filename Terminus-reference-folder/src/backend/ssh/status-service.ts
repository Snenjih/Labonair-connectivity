import { Client } from "ssh2";
import { getDb } from "../database/db/index.js";
import { sshData } from "../database/db/schema.js";
import { eq } from "drizzle-orm";
import { sshLogger } from "../utils/logger.js";
import { DataCrypto } from "../utils/data-crypto.js";

/**
 * Status Service
 * Background service for checking host availability
 */

interface StatusCheckJob {
  hostId: number;
  userId: string;
  interval: NodeJS.Timeout;
  checkInterval: number;
}

class StatusService {
  private checkJobs: Map<number, StatusCheckJob> = new Map();

  /**
   * Start status checking for a host
   */
  async startMonitoring(hostId: number): Promise<void> {
    try {
      const db = getDb();
      const host = await db
        .select()
        .from(sshData)
        .where(eq(sshData.id, hostId))
        .get();

      if (!host) {
        sshLogger.error(`Host ${hostId} not found`);
        return;
      }

      if (!host.statusMonitoringEnabled) {
        sshLogger.info(`Status monitoring not enabled for host ${hostId}`);
        return;
      }

      // Stop existing monitoring if any
      this.stopMonitoring(hostId);

      const checkInterval = (host.statusCheckInterval || 30) * 1000;

      // Create interval timer
      const interval = setInterval(async () => {
        await this.checkStatus(hostId);
      }, checkInterval);

      this.checkJobs.set(hostId, {
        hostId,
        userId: host.userId,
        interval,
        checkInterval,
      });

      sshLogger.info(
        `Started status monitoring for host ${hostId} with interval ${checkInterval}ms`,
      );

      // Check initial status immediately
      await this.checkStatus(hostId);
    } catch (error) {
      sshLogger.error(
        `Failed to start status monitoring for host ${hostId}:`,
        error,
      );
    }
  }

  /**
   * Stop status checking for a host
   */
  stopMonitoring(hostId: number): void {
    const job = this.checkJobs.get(hostId);
    if (job) {
      clearInterval(job.interval);
      this.checkJobs.delete(hostId);
      sshLogger.info(`Stopped status monitoring for host ${hostId}`);
    }
  }

  /**
   * Check host status
   */
  private async checkStatus(hostId: number): Promise<void> {
    let sshClient: Client | null = null;

    try {
      const db = getDb();
      const host = await db
        .select()
        .from(sshData)
        .where(eq(sshData.id, hostId))
        .get();

      if (!host) {
        sshLogger.error(`Host ${hostId} not found`);
        this.stopMonitoring(hostId);
        return;
      }

      // Decrypt host data
      const decryptedHost = DataCrypto.decryptRecordForUser(
        "ssh_data",
        host,
        host.userId,
      );

      // Create SSH connection
      sshClient = new Client();

      const isOnline = await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          resolve(false);
        }, 10000); // 10 second timeout

        sshClient!.on("ready", () => {
          clearTimeout(timeout);
          // Execute simple echo command to verify connection
          sshClient!.exec("echo ok", (err, stream) => {
            if (err) {
              resolve(false);
              return;
            }

            let output = "";
            stream.on("data", (data: Buffer) => {
              output += data.toString();
            });

            stream.on("close", () => {
              resolve(output.trim() === "ok");
            });
          });
        });

        sshClient!.on("error", () => {
          clearTimeout(timeout);
          resolve(false);
        });

        const connectionConfig: any = {
          host: host.ip,
          port: host.port,
          username: host.username,
          readyTimeout: 10000,
        };

        if (host.authType === "password") {
          connectionConfig.password = decryptedHost.password;
        } else if (host.authType === "key") {
          connectionConfig.privateKey = decryptedHost.key;
          if (decryptedHost.keyPassword) {
            connectionConfig.passphrase = decryptedHost.keyPassword;
          }
        }

        sshClient!.connect(connectionConfig);
      });

      // Update host status
      const newStatus = isOnline ? "online" : "offline";
      await db
        .update(sshData)
        .set({
          status: newStatus,
          lastStatusCheck: Math.floor(Date.now() / 1000),
        })
        .where(eq(sshData.id, hostId));

      sshLogger.info(`Host ${hostId} status: ${newStatus}`);
    } catch (error) {
      sshLogger.error(`Failed to check status for host ${hostId}:`, error);

      // Update status to offline on error
      try {
        const db = getDb();
        await db
          .update(sshData)
          .set({
            status: "offline",
            lastStatusCheck: Math.floor(Date.now() / 1000),
          })
          .where(eq(sshData.id, hostId));
      } catch (updateError) {
        sshLogger.error(
          `Failed to update status for host ${hostId}:`,
          updateError,
        );
      }
    } finally {
      if (sshClient) {
        sshClient.end();
      }
    }
  }

  /**
   * Initialize service and start monitoring for all enabled hosts
   */
  async initialize(): Promise<void> {
    try {
      const db = getDb();
      const hosts = await db
        .select()
        .from(sshData)
        .where(eq(sshData.statusMonitoringEnabled, true))
        .all();

      sshLogger.info(`Initializing status service for ${hosts.length} hosts`);

      for (const host of hosts) {
        await this.startMonitoring(host.id);
      }
    } catch (error) {
      sshLogger.error("Failed to initialize status service:", error);
    }
  }

  /**
   * Stop all monitoring jobs
   */
  shutdown(): void {
    sshLogger.info("Shutting down status service");
    for (const [hostId] of this.checkJobs) {
      this.stopMonitoring(hostId);
    }
  }
}

// Export singleton instance
export const statusService = new StatusService();
