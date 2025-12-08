import { Client } from "ssh2";
import { getDb } from "../database/db/index.js";
import { sshData, serverMetrics } from "../database/db/schema.js";
import { eq } from "drizzle-orm";
import { sshLogger } from "../utils/logger.js";
import { collectMetrics } from "./metrics-collector.js";
import { DataCrypto } from "../utils/data-crypto.js";

/**
 * Metrics Service
 * Background service for collecting server metrics at specified intervals
 */

interface MonitoringJob {
  hostId: number;
  userId: string;
  interval: NodeJS.Timeout;
  collectionInterval: number;
}

class MetricsService {
  private monitoringJobs: Map<number, MonitoringJob> = new Map();

  /**
   * Start monitoring for a host
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

      if (!host.metricsMonitoringEnabled) {
        sshLogger.info(`Metrics monitoring not enabled for host ${hostId}`);
        return;
      }

      // Stop existing monitoring if any
      this.stopMonitoring(hostId);

      const collectionInterval = (host.metricsCollectionInterval || 60) * 1000;

      // Create interval timer
      const interval = setInterval(async () => {
        await this.collectMetrics(hostId);
      }, collectionInterval);

      this.monitoringJobs.set(hostId, {
        hostId,
        userId: host.userId,
        interval,
        collectionInterval,
      });

      sshLogger.info(
        `Started metrics monitoring for host ${hostId} with interval ${collectionInterval}ms`,
      );

      // Collect initial metrics immediately
      await this.collectMetrics(hostId);
    } catch (error) {
      sshLogger.error(`Failed to start monitoring for host ${hostId}:`, error);
    }
  }

  /**
   * Stop monitoring for a host
   */
  stopMonitoring(hostId: number): void {
    const job = this.monitoringJobs.get(hostId);
    if (job) {
      clearInterval(job.interval);
      this.monitoringJobs.delete(hostId);
      sshLogger.info(`Stopped metrics monitoring for host ${hostId}`);
    }
  }

  /**
   * Collect metrics for a host
   */
  private async collectMetrics(hostId: number): Promise<void> {
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

      // Parse enabled widgets
      let enabledWidgets: string[] = [];
      try {
        enabledWidgets = JSON.parse(host.enabledWidgets || "[]");
      } catch (error) {
        sshLogger.error(`Failed to parse enabled widgets for host ${hostId}`);
        enabledWidgets = [];
      }

      if (enabledWidgets.length === 0) {
        sshLogger.info(`No widgets enabled for host ${hostId}`);
        return;
      }

      // Create SSH connection
      sshClient = new Client();

      await new Promise<void>((resolve, reject) => {
        sshClient!.on("ready", () => {
          resolve();
        });

        sshClient!.on("error", (err) => {
          reject(err);
        });

        const connectionConfig: any = {
          host: host.ip,
          port: host.port,
          username: host.username,
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

      // Collect metrics
      const metrics = await collectMetrics(sshClient, enabledWidgets);

      // Save metrics to database
      await this.saveMetrics(hostId, host.userId, metrics);

      sshLogger.info(`Collected metrics for host ${hostId}`);
    } catch (error) {
      sshLogger.error(`Failed to collect metrics for host ${hostId}:`, error);
    } finally {
      if (sshClient) {
        sshClient.end();
      }
    }
  }

  /**
   * Save metrics to database
   */
  private async saveMetrics(
    hostId: number,
    userId: string,
    metrics: any,
  ): Promise<void> {
    try {
      const db = getDb();

      await db.insert(serverMetrics).values({
        hostId,
        userId,
        timestamp: Math.floor(Date.now() / 1000),
        cpuUsage: metrics.cpuUsage || null,
        memoryUsage: metrics.memoryUsage || null,
        diskUsage: metrics.diskUsage
          ? JSON.stringify(metrics.diskUsage)
          : null,
        networkData: metrics.networkData
          ? JSON.stringify(metrics.networkData)
          : null,
        uptime: metrics.uptime || null,
        processes: metrics.processes
          ? JSON.stringify(metrics.processes)
          : null,
        systemInfo: metrics.systemInfo || null,
        sshLogins: metrics.sshLogins
          ? JSON.stringify(metrics.sshLogins)
          : null,
      });

      sshLogger.info(`Saved metrics for host ${hostId}`);
    } catch (error) {
      sshLogger.error(`Failed to save metrics for host ${hostId}:`, error);
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
        .where(eq(sshData.metricsMonitoringEnabled, true))
        .all();

      sshLogger.info(
        `Initializing metrics service for ${hosts.length} hosts`,
      );

      for (const host of hosts) {
        await this.startMonitoring(host.id);
      }
    } catch (error) {
      sshLogger.error("Failed to initialize metrics service:", error);
    }
  }

  /**
   * Stop all monitoring jobs
   */
  shutdown(): void {
    sshLogger.info("Shutting down metrics service");
    for (const [hostId] of this.monitoringJobs) {
      this.stopMonitoring(hostId);
    }
  }
}

// Export singleton instance
export const metricsService = new MetricsService();
