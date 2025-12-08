import { Client } from "ssh2";
import { sshLogger } from "../utils/logger.js";

/**
 * Metrics Collector
 * Executes SSH commands to collect server metrics
 */

export interface MetricsData {
  cpuUsage?: number;
  memoryUsage?: number;
  diskUsage?: any;
  networkData?: any;
  uptime?: string;
  processes?: any[];
  systemInfo?: string;
  sshLogins?: any[];
}

/**
 * Execute SSH command and return output
 */
async function executeSSHCommand(
  sshClient: Client,
  command: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    sshClient.exec(command, (err, stream) => {
      if (err) {
        reject(err);
        return;
      }

      let stdout = "";
      let stderr = "";

      stream.on("close", (code: number) => {
        if (code !== 0 && stderr) {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        } else {
          resolve(stdout.trim());
        }
      });

      stream.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      stream.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });
    });
  });
}

/**
 * Collect CPU usage percentage
 * Uses top command to get current CPU usage
 */
export async function collectCPUUsage(
  sshClient: Client,
): Promise<number | null> {
  try {
    const command =
      "top -bn1 | grep \"Cpu(s)\" | sed \"s/.*, *\\([0-9.]*\\)%* id.*/\\1/\" | awk '{print 100 - $1}'";
    const output = await executeSSHCommand(sshClient, command);
    const cpuUsage = parseFloat(output);
    return isNaN(cpuUsage) ? null : cpuUsage;
  } catch (error) {
    sshLogger.error("Failed to collect CPU usage:", error);
    return null;
  }
}

/**
 * Collect memory usage percentage
 * Uses free command to get memory statistics
 */
export async function collectMemoryUsage(
  sshClient: Client,
): Promise<number | null> {
  try {
    const command = "free -m | awk 'NR==2{printf \"%.2f\", $3*100/$2 }'";
    const output = await executeSSHCommand(sshClient, command);
    const memoryUsage = parseFloat(output);
    return isNaN(memoryUsage) ? null : memoryUsage;
  } catch (error) {
    sshLogger.error("Failed to collect memory usage:", error);
    return null;
  }
}

/**
 * Collect disk usage information
 * Returns disk usage for all mounted partitions
 */
export async function collectDiskUsage(
  sshClient: Client,
): Promise<any | null> {
  try {
    const command = "df -h | awk 'NR>1 {print $1, $2, $3, $4, $5, $6}'";
    const output = await executeSSHCommand(sshClient, command);
    const lines = output.split("\n").filter((line) => line.trim() !== "");

    const diskData = lines.map((line) => {
      const parts = line.trim().split(/\s+/);
      return {
        filesystem: parts[0],
        size: parts[1],
        used: parts[2],
        available: parts[3],
        usedPercent: parts[4],
        mountedOn: parts[5],
      };
    });

    return diskData;
  } catch (error) {
    sshLogger.error("Failed to collect disk usage:", error);
    return null;
  }
}

/**
 * Collect network interface statistics
 */
export async function collectNetworkData(
  sshClient: Client,
): Promise<any | null> {
  try {
    const command = "ip -s a";
    const output = await executeSSHCommand(sshClient, command);
    return { raw: output };
  } catch (error) {
    sshLogger.error("Failed to collect network data:", error);
    return null;
  }
}

/**
 * Collect system uptime
 */
export async function collectUptime(sshClient: Client): Promise<string | null> {
  try {
    const command = "uptime -p";
    const output = await executeSSHCommand(sshClient, command);
    return output || null;
  } catch (error) {
    sshLogger.error("Failed to collect uptime:", error);
    return null;
  }
}

/**
 * Collect top processes by CPU and memory
 */
export async function collectProcesses(
  sshClient: Client,
): Promise<any[] | null> {
  try {
    const command =
      "ps -eo comm,pid,user,%cpu,%mem --sort=-%cpu | head -n 6";
    const output = await executeSSHCommand(sshClient, command);
    const lines = output.split("\n").filter((line) => line.trim() !== "");

    // Skip header line
    const processes = lines.slice(1).map((line) => {
      const parts = line.trim().split(/\s+/);
      return {
        command: parts[0],
        pid: parts[1],
        user: parts[2],
        cpu: parts[3],
        memory: parts[4],
      };
    });

    return processes;
  } catch (error) {
    sshLogger.error("Failed to collect processes:", error);
    return null;
  }
}

/**
 * Collect system information
 */
export async function collectSystemInfo(
  sshClient: Client,
): Promise<string | null> {
  try {
    const command = "uname -a";
    const output = await executeSSHCommand(sshClient, command);
    return output || null;
  } catch (error) {
    sshLogger.error("Failed to collect system info:", error);
    return null;
  }
}

/**
 * Collect SSH login statistics
 */
export async function collectSSHLogins(
  sshClient: Client,
): Promise<any[] | null> {
  try {
    const command = "last | head -n 5";
    const output = await executeSSHCommand(sshClient, command);
    const lines = output.split("\n").filter((line) => line.trim() !== "");

    const logins = lines.map((line) => {
      return { raw: line };
    });

    return logins;
  } catch (error) {
    sshLogger.error("Failed to collect SSH logins:", error);
    return null;
  }
}

/**
 * Collect all enabled metrics
 */
export async function collectMetrics(
  sshClient: Client,
  enabledWidgets: string[],
): Promise<MetricsData> {
  const metrics: MetricsData = {};

  if (enabledWidgets.includes("cpu")) {
    metrics.cpuUsage = (await collectCPUUsage(sshClient)) || undefined;
  }

  if (enabledWidgets.includes("memory")) {
    metrics.memoryUsage = (await collectMemoryUsage(sshClient)) || undefined;
  }

  if (enabledWidgets.includes("disk")) {
    metrics.diskUsage = (await collectDiskUsage(sshClient)) || undefined;
  }

  if (enabledWidgets.includes("network")) {
    metrics.networkData = (await collectNetworkData(sshClient)) || undefined;
  }

  if (enabledWidgets.includes("uptime")) {
    metrics.uptime = (await collectUptime(sshClient)) || undefined;
  }

  if (enabledWidgets.includes("processes")) {
    metrics.processes = (await collectProcesses(sshClient)) || undefined;
  }

  if (enabledWidgets.includes("system")) {
    metrics.systemInfo = (await collectSystemInfo(sshClient)) || undefined;
  }

  if (enabledWidgets.includes("ssh_logins")) {
    metrics.sshLogins = (await collectSSHLogins(sshClient)) || undefined;
  }

  return metrics;
}
