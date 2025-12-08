import { exec } from "child_process";
import { promisify } from "util";
import { tunnelLogger } from "./logger.js";

const execAsync = promisify(exec);

export interface ProcessInfo {
  pid: number;
  command: string;
}

export interface KillOptions {
  signal?: "TERM" | "KILL";
  gracePeriod?: number; // milliseconds to wait before SIGKILL
}

/**
 * Cross-platform process manager utility
 * Handles process listing and termination on both Windows and Unix systems
 */
export class ProcessManager {
  private static isWindows(): boolean {
    return process.platform === "win32";
  }

  /**
   * Find processes matching a pattern
   * @param pattern - String or RegExp to match against process command line
   * @returns Array of matching process information
   */
  static async findProcesses(pattern: string | RegExp): Promise<ProcessInfo[]> {
    if (this.isWindows()) {
      return this.findProcessesWindows(pattern);
    } else {
      return this.findProcessesUnix(pattern);
    }
  }

  /**
   * Find processes on Windows using tasklist
   */
  private static async findProcessesWindows(
    pattern: string | RegExp,
  ): Promise<ProcessInfo[]> {
    try {
      // Use tasklist with verbose output to get command line
      const { stdout } = await execAsync(
        'tasklist /V /FO CSV /NH',
        { maxBuffer: 1024 * 1024 }
      );

      const processes: ProcessInfo[] = [];
      const lines = stdout.split("\n").filter((line) => line.trim());

      const patternRegex =
        typeof pattern === "string" ? new RegExp(pattern, "i") : pattern;

      for (const line of lines) {
        // Parse CSV format
        const parts = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) || [];
        if (parts.length < 2) continue;

        const imageName = parts[0].replace(/"/g, "").trim();
        const pidStr = parts[1].replace(/"/g, "").trim();
        const pid = parseInt(pidStr, 10);

        if (isNaN(pid)) continue;

        // For SSH processes, also check with WMIC for full command line
        if (imageName.toLowerCase().includes("ssh") || imageName.toLowerCase().includes("node")) {
          try {
            const { stdout: wmicOut } = await execAsync(
              `wmic process where ProcessId=${pid} get CommandLine /FORMAT:LIST`,
              { maxBuffer: 1024 * 1024 }
            );

            const commandMatch = wmicOut.match(/CommandLine=(.*)/);
            const command = commandMatch ? commandMatch[1].trim() : imageName;

            if (patternRegex.test(command)) {
              processes.push({ pid, command });
            }
          } catch (e) {
            // If WMIC fails, fall back to image name matching
            if (patternRegex.test(imageName)) {
              processes.push({ pid, command: imageName });
            }
          }
        } else if (patternRegex.test(imageName)) {
          processes.push({ pid, command: imageName });
        }
      }

      return processes;
    } catch (error) {
      tunnelLogger.error(
        `Failed to find processes on Windows: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      return [];
    }
  }

  /**
   * Find processes on Unix using ps
   */
  private static async findProcessesUnix(
    pattern: string | RegExp,
  ): Promise<ProcessInfo[]> {
    try {
      const { stdout } = await execAsync("ps aux", {
        maxBuffer: 1024 * 1024,
      });

      const processes: ProcessInfo[] = [];
      const lines = stdout.split("\n").slice(1); // Skip header

      const patternRegex =
        typeof pattern === "string" ? new RegExp(pattern) : pattern;

      for (const line of lines) {
        if (!line.trim()) continue;

        const parts = line.trim().split(/\s+/);
        if (parts.length < 11) continue;

        const pid = parseInt(parts[1], 10);
        if (isNaN(pid)) continue;

        const command = parts.slice(10).join(" ");

        if (patternRegex.test(command) && !command.includes("grep")) {
          processes.push({ pid, command });
        }
      }

      return processes;
    } catch (error) {
      tunnelLogger.error(
        `Failed to find processes on Unix: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      return [];
    }
  }

  /**
   * Kill a process by PID
   * @param pid - Process ID to kill
   * @param options - Kill options (signal, grace period)
   */
  static async killProcess(
    pid: number,
    options: KillOptions = {},
  ): Promise<boolean> {
    const { signal = "TERM", gracePeriod = 2000 } = options;

    if (this.isWindows()) {
      return this.killProcessWindows(pid, signal === "KILL");
    } else {
      return this.killProcessUnix(pid, signal, gracePeriod);
    }
  }

  /**
   * Kill a process on Windows using taskkill
   */
  private static async killProcessWindows(
    pid: number,
    force: boolean,
  ): Promise<boolean> {
    try {
      const forceFlag = force ? "/F" : "";
      await execAsync(`taskkill /PID ${pid} ${forceFlag}`);
      return true;
    } catch (error) {
      tunnelLogger.warn(
        `Failed to kill process ${pid} on Windows: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      return false;
    }
  }

  /**
   * Kill a process on Unix using kill command
   */
  private static async killProcessUnix(
    pid: number,
    signal: "TERM" | "KILL",
    gracePeriod: number,
  ): Promise<boolean> {
    try {
      if (signal === "TERM") {
        // Try graceful termination first
        await execAsync(`kill -TERM ${pid}`);

        // Wait for grace period
        await new Promise((resolve) => setTimeout(resolve, gracePeriod));

        // Check if process still exists
        try {
          await execAsync(`kill -0 ${pid}`);
          // Process still exists, force kill
          await execAsync(`kill -9 ${pid}`);
        } catch (e) {
          // Process is gone, success
        }
      } else {
        // Force kill immediately
        await execAsync(`kill -9 ${pid}`);
      }

      return true;
    } catch (error) {
      // If error is "No such process", that's actually success
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("No such process")) {
        return true;
      }

      tunnelLogger.warn(
        `Failed to kill process ${pid} on Unix: ${errorMessage}`,
      );
      return false;
    }
  }

  /**
   * Kill all processes matching a pattern
   * @param pattern - String or RegExp to match against process command line
   * @param options - Kill options
   * @returns Number of processes killed
   */
  static async killProcessesByPattern(
    pattern: string | RegExp,
    options: KillOptions = {},
  ): Promise<number> {
    const processes = await this.findProcesses(pattern);

    if (processes.length === 0) {
      return 0;
    }

    tunnelLogger.info(
      `Found ${processes.length} processes matching pattern, attempting to kill`,
    );

    let killedCount = 0;

    for (const proc of processes) {
      const success = await this.killProcess(proc.pid, options);
      if (success) {
        killedCount++;
      }
    }

    return killedCount;
  }

  /**
   * Kill tunnel process by marker name
   * This is a specialized method for SSH tunnels that handles the marker-based naming
   * @param marker - The unique marker for the tunnel process
   * @param tunnelConfig - Configuration containing ports and endpoints for fallback matching
   */
  static async killTunnelByMarker(
    marker: string,
    tunnelConfig?: {
      endpointPort: number;
      sourcePort: number;
      endpointUsername: string;
      endpointIP: string;
    },
  ): Promise<number> {
    let patterns: (string | RegExp)[] = [];

    if (this.isWindows()) {
      // Windows: Match by marker in command line
      patterns.push(new RegExp(marker, "i"));

      // Fallback: Match by SSH tunnel characteristics
      if (tunnelConfig) {
        patterns.push(
          new RegExp(
            `ssh.*-R.*${tunnelConfig.endpointPort}.*${tunnelConfig.endpointUsername}`,
            "i",
          ),
        );
      }
    } else {
      // Unix: Match by marker (set via exec -a)
      patterns.push(marker);

      // Fallback patterns for processes that might not have the marker
      if (tunnelConfig) {
        patterns.push(
          `ssh.*-R.*${tunnelConfig.endpointPort}:localhost:${tunnelConfig.sourcePort}.*${tunnelConfig.endpointUsername}@${tunnelConfig.endpointIP}`,
        );
        patterns.push(`sshpass.*ssh.*-R.*${tunnelConfig.endpointPort}`);
      }
    }

    let totalKilled = 0;

    for (const pattern of patterns) {
      const killed = await this.killProcessesByPattern(pattern, {
        signal: "TERM",
        gracePeriod: 1000,
      });
      totalKilled += killed;
    }

    return totalKilled;
  }

  /**
   * Verify process is no longer running
   * @param pid - Process ID to check
   * @returns true if process is still running, false otherwise
   */
  static async isProcessRunning(pid: number): Promise<boolean> {
    if (this.isWindows()) {
      try {
        const { stdout } = await execAsync(`tasklist /FI "PID eq ${pid}"`);
        return stdout.includes(String(pid));
      } catch (error) {
        return false;
      }
    } else {
      try {
        await execAsync(`kill -0 ${pid}`);
        return true;
      } catch (error) {
        return false;
      }
    }
  }
}
