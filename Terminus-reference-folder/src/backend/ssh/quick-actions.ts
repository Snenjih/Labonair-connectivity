import { Client } from "ssh2";
import { getDb } from "../database/db/index.js";
import { sshData } from "../database/db/schema.js";
import { eq } from "drizzle-orm";
import { sshLogger } from "../utils/logger.js";
import { DataCrypto } from "../utils/data-crypto.js";

/**
 * Quick Actions
 * Execute custom SSH commands on hosts
 */

export interface QuickActionResult {
  success: boolean;
  output?: string;
  error?: string;
}

/**
 * Execute a quick action command on a host
 */
export async function executeQuickAction(
  hostId: number,
  userId: string,
  actionId: string,
): Promise<QuickActionResult> {
  let sshClient: Client | null = null;

  try {
    const db = getDb();
    const host = await db
      .select()
      .from(sshData)
      .where(eq(sshData.id, hostId))
      .get();

    if (!host) {
      return {
        success: false,
        error: "Host not found",
      };
    }

    // Verify user owns the host
    if (host.userId !== userId) {
      return {
        success: false,
        error: "Unauthorized",
      };
    }

    // Parse quick actions
    let quickActions: any[] = [];
    try {
      quickActions = JSON.parse(host.quickActions || "[]");
    } catch (error) {
      return {
        success: false,
        error: "Failed to parse quick actions",
      };
    }

    // Find the action
    const action = quickActions.find((a) => a.id === actionId);
    if (!action) {
      return {
        success: false,
        error: "Quick action not found",
      };
    }

    // Decrypt host data
    const decryptedHost = DataCrypto.decryptRecordForUser(
      "ssh_data",
      host,
      host.userId,
    );

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

    // Execute command
    const output = await new Promise<string>((resolve, reject) => {
      sshClient!.exec(action.command, (err, stream) => {
        if (err) {
          reject(err);
          return;
        }

        let stdout = "";
        let stderr = "";

        stream.on("close", (code: number) => {
          if (code !== 0 && stderr) {
            reject(new Error(stderr));
          } else {
            resolve(stdout);
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

    sshLogger.info(
      `Executed quick action "${action.label}" on host ${hostId}`,
    );

    return {
      success: true,
      output: output.trim(),
    };
  } catch (error: any) {
    sshLogger.error(
      `Failed to execute quick action on host ${hostId}:`,
      error,
    );
    return {
      success: false,
      error: error.message || "Failed to execute command",
    };
  } finally {
    if (sshClient) {
      sshClient.end();
    }
  }
}
