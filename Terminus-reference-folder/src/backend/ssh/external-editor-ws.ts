import { WebSocket, WebSocketServer } from "ws";
import { systemLogger } from "../utils/logger.js";
import * as tempFileManager from "../local/temp-file-manager.js";
import { findAvailablePort } from "../utils/port-utils.js";
import { portRegistry, SERVICE_NAMES } from "../utils/port-registry.js";

let wss: WebSocketServer | null = null;
const clients: Set<WebSocket> = new Set();

export interface ExternalEditorEvent {
  watcherId: string;
  type: 'file_changed' | 'editor_opened' | 'editor_closed';
  filePath: string;
  remotePath: string;
  sessionId: string;
  timestamp: number;
  content?: string;
}

export async function startExternalEditorServer() {
  if (wss) {
    systemLogger.info("External editor WebSocket server is already running.");
    return;
  }

  const preferredPort = 30008;
  const port = await findAvailablePort(preferredPort);
  wss = new WebSocketServer({ port });

  // Register the port in the central registry
  portRegistry.setPort(SERVICE_NAMES.EXTERNAL_EDITOR, port);

  systemLogger.info(`External editor WebSocket server started on port ${port}`, {
    operation: "external_editor_server_started",
    port,
  });

  wss.on("connection", (ws) => {
    clients.add(ws);
    systemLogger.info("External editor client connected", {
      operation: "client_connected",
      totalClients: clients.size,
    });

    ws.on("close", () => {
      clients.delete(ws);
      systemLogger.info("External editor client disconnected", {
        operation: "client_disconnected",
        totalClients: clients.size,
      });
    });

    ws.on("error", (error) => {
      systemLogger.error("External editor WebSocket error", error, {
        operation: "websocket_error",
      });
      clients.delete(ws);
    });

    // Handle incoming messages
    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message.toString());

        // Handle ping/pong for connection keep-alive
        if (data.type === "ping") {
          ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
        }
      } catch (error) {
        systemLogger.error("Failed to parse WebSocket message", error, {
          operation: "message_parse_error",
        });
      }
    });
  });

  wss.on("error", (error) => {
    systemLogger.error("External editor WebSocket server error", error, {
      operation: "server_error",
    });
  });
}

export function emitExternalEditorEvent(event: ExternalEditorEvent) {
  const message = JSON.stringify(event);

  let sentCount = 0;
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
        sentCount++;
      } catch (error) {
        systemLogger.error("Failed to send external editor event to client", error, {
          operation: "send_error",
          watcherId: event.watcherId,
        });
      }
    }
  });

  systemLogger.info("External editor event broadcasted", {
    operation: "event_broadcasted",
    eventType: event.type,
    watcherId: event.watcherId,
    clientsSent: sentCount,
  });
}

export async function shutdownExternalEditorServer() {
  if (!wss) {
    return;
  }

  systemLogger.info("Shutting down external editor WebSocket server...", {
    operation: "shutdown_start",
  });

  // Close all client connections
  clients.forEach((client) => {
    try {
      client.close();
    } catch (error) {
      systemLogger.error("Error closing client connection", error, {
        operation: "client_close_error",
      });
    }
  });
  clients.clear();

  // Close the server
  return new Promise<void>((resolve, reject) => {
    if (wss) {
      wss.close((err) => {
        if (err) {
          systemLogger.error("Error closing external editor WebSocket server", err, {
            operation: "server_close_error",
          });
          reject(err);
        } else {
          systemLogger.info("External editor WebSocket server closed successfully", {
            operation: "shutdown_complete",
          });
          wss = null;
          resolve();
        }
      });
    } else {
      resolve();
    }
  });
}

// Start the server automatically when this module is imported
(async () => {
  try {
    await startExternalEditorServer();
  } catch (error) {
    systemLogger.error("Failed to start external editor server", error, {
      operation: "startup_error",
    });
  }
})();
