import { WebSocket, WebSocketServer } from "ws";
import { systemLogger } from "../utils/logger.js";
import { findAvailablePort } from "../utils/port-utils.js";
import { portRegistry, SERVICE_NAMES } from "../utils/port-registry.js";

let wss: WebSocketServer | null = null;
const clients: Set<WebSocket> = new Set();

export interface ProgressEvent {
  transferId: string;
  type: 'started' | 'progress' | 'completed' | 'failed' | 'cancelled';
  bytesTransferred: number;
  totalBytes: number;
  timestamp: number;
  error?: string;
}

export async function startTransferProgressServer() {
  if (wss) {
    systemLogger.info("Transfer progress WebSocket server is already running.");
    return;
  }

  // Changed from 30005 to 30007 to resolve port conflict with server-stats.ts
  const preferredPort = 30007;
  const port = await findAvailablePort(preferredPort);
  wss = new WebSocketServer({ port });

  // Register the port in the central registry
  portRegistry.setPort(SERVICE_NAMES.TRANSFER_PROGRESS, port);

  systemLogger.info(`Transfer progress WebSocket server started on port ${port}`, {
    operation: "transfer_progress_server_started",
    port,
  });

  wss.on("connection", (ws) => {
    clients.add(ws);
    systemLogger.info("Transfer progress client connected", {
      operation: "client_connected",
      totalClients: clients.size,
    });

    ws.on("close", () => {
      clients.delete(ws);
      systemLogger.info("Transfer progress client disconnected", {
        operation: "client_disconnected",
        totalClients: clients.size,
      });
    });

    ws.on("error", (error) => {
      systemLogger.error("Transfer progress WebSocket error", error, {
        operation: "websocket_error",
      });
      clients.delete(ws);
    });

    // Handle incoming messages (for cancel requests)
    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === "cancel" && data.transferId) {
          // Emit cancel event that can be handled by upload/download handlers
          emitProgressEvent({
            transferId: data.transferId,
            type: "cancelled",
            bytesTransferred: 0,
            totalBytes: 0,
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        systemLogger.error("Failed to parse WebSocket message", error, {
          operation: "message_parse_error",
        });
      }
    });
  });

  wss.on("error", (error) => {
    systemLogger.error("Transfer progress WebSocket server error", error, {
      operation: "server_error",
    });
  });
}

export function emitProgressEvent(event: ProgressEvent) {
  const message = JSON.stringify(event);

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (error) {
        systemLogger.error("Failed to send progress event to client", error, {
          operation: "send_error",
          transferId: event.transferId,
        });
      }
    }
  });
}

export async function shutdownTransferProgressServer() {
  if (!wss) {
    return;
  }

  systemLogger.info("Shutting down transfer progress WebSocket server...", {
    operation: "shutdown",
  });

  // Close all client connections
  clients.forEach((client) => {
    try {
      client.close();
    } catch (error) {
      systemLogger.error("Error closing client connection", error, {
        operation: "close_client_error",
      });
    }
  });

  clients.clear();

  // Close the server
  await new Promise<void>((resolve) => {
    wss!.close(() => {
      systemLogger.info("Transfer progress WebSocket server shut down successfully", {
        operation: "shutdown_complete",
      });
      wss = null;
      resolve();
    });
  });
}

// Start the server when this module is imported
(async () => {
  try {
    await startTransferProgressServer();
  } catch (error) {
    systemLogger.error("Failed to start transfer progress server", error, {
      operation: "startup_error",
    });
  }
})();
