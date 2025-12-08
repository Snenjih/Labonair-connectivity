import { WebSocket, WebSocketServer, type RawData } from "ws";
import os from "os";
import pty, { type IPty } from "node-pty";
import { parse as parseUrl } from "url";
import { systemLogger } from "../utils/logger.js";
import { AuthManager } from "../utils/auth-manager.js";
import { UserCrypto } from "../utils/user-crypto.js";
import { findAvailablePort } from "../utils/port-utils.js";
import { portRegistry, SERVICE_NAMES } from "../utils/port-registry.js";

const authManager = AuthManager.getInstance();
const userCrypto = UserCrypto.getInstance();

let wss: WebSocketServer | null = null;

// Track active PTY sessions per user to prevent abuse
const userSessions = new Map<string, Set<WebSocket>>();
const MAX_SESSIONS_PER_USER = 10;

export async function startLocalTerminalServer() {
  if (wss) {
    systemLogger.info("Local terminal WebSocket server is already running.", {
      operation: "local_terminal_server_start",
      status: "already_running",
    });
    return;
  }

  const preferredPort = 30003;
  let port: number;

  try {
    // Find an available port starting from the preferred port
    port = await findAvailablePort(preferredPort);

    wss = new WebSocketServer({
      port,
      verifyClient: async (info) => {
        try {
          const url = parseUrl(info.req.url!, true);
          const token = url.query.token as string;

          if (!token) {
            systemLogger.warn(
              "Local terminal WebSocket connection rejected: missing token",
              {
                operation: "local_terminal_auth_reject",
                reason: "missing_token",
                ip: info.req.socket.remoteAddress,
              },
            );
            return false;
          }

          const payload = await authManager.verifyJWTToken(token);

          if (!payload) {
            systemLogger.warn(
              "Local terminal WebSocket connection rejected: invalid token",
              {
                operation: "local_terminal_auth_reject",
                reason: "invalid_token",
                ip: info.req.socket.remoteAddress,
              },
            );
            return false;
          }

          if (payload.pendingTOTP) {
            systemLogger.warn(
              "Local terminal WebSocket connection rejected: TOTP verification pending",
              {
                operation: "local_terminal_auth_reject",
                reason: "totp_pending",
                userId: payload.userId,
                ip: info.req.socket.remoteAddress,
              },
            );
            return false;
          }

          // Check session limit per user
          const existingSessions = userSessions.get(payload.userId);
          if (
            existingSessions &&
            existingSessions.size >= MAX_SESSIONS_PER_USER
          ) {
            systemLogger.warn(
              "Local terminal WebSocket connection rejected: too many sessions",
              {
                operation: "local_terminal_auth_reject",
                reason: "session_limit",
                userId: payload.userId,
                currentSessions: existingSessions.size,
                ip: info.req.socket.remoteAddress,
              },
            );
            return false;
          }

          return true;
        } catch (error) {
          systemLogger.error("Local terminal WebSocket authentication error", error, {
            operation: "local_terminal_auth_error",
            ip: info.req.socket.remoteAddress,
          });
          return false;
        }
      },
    });

    wss.on("connection", async (ws: WebSocket, req) => {
      let userId: string | undefined;
      let ptyProcess: IPty | null = null;
      let pingInterval: NodeJS.Timeout | null = null;

      try {
        // Verify JWT token again
        const url = parseUrl(req.url!, true);
        const token = url.query.token as string;

        if (!token) {
          systemLogger.warn(
            "Local terminal connection rejected: missing token in connection",
            {
              operation: "local_terminal_connection_reject",
              reason: "missing_token",
              ip: req.socket.remoteAddress,
            },
          );
          ws.close(1008, "Authentication required");
          return;
        }

        const payload = await authManager.verifyJWTToken(token);
        if (!payload) {
          systemLogger.warn(
            "Local terminal connection rejected: invalid token in connection",
            {
              operation: "local_terminal_connection_reject",
              reason: "invalid_token",
              ip: req.socket.remoteAddress,
            },
          );
          ws.close(1008, "Authentication required");
          return;
        }

        userId = payload.userId;

        // Verify user data key (data must be unlocked)
        const dataKey = userCrypto.getUserDataKey(userId);
        if (!dataKey) {
          systemLogger.warn(
            "Local terminal connection rejected: data locked",
            {
              operation: "local_terminal_data_locked",
              userId,
              ip: req.socket.remoteAddress,
            },
          );
          ws.send(
            JSON.stringify({
              type: "error",
              message: "Data locked - re-authenticate with password",
              code: "DATA_LOCKED",
            }),
          );
          ws.close(1008, "Data access required");
          return;
        }

        // Track user session
        if (!userSessions.has(userId)) {
          userSessions.set(userId, new Set());
        }
        const userWs = userSessions.get(userId)!;
        userWs.add(ws);

        systemLogger.info("Local terminal WebSocket connection established", {
          operation: "local_terminal_connected",
          userId,
          sessionCount: userWs.size,
        });

        // Cleanup function
        const cleanup = () => {
          try {
            if (pingInterval) {
              clearInterval(pingInterval);
              pingInterval = null;
            }

            if (ptyProcess) {
              try {
                ptyProcess.kill();
                systemLogger.info("PTY process killed", {
                  operation: "local_terminal_pty_killed",
                  userId,
                });
              } catch (error) {
                systemLogger.error("Error killing PTY process", error, {
                  operation: "local_terminal_pty_kill_error",
                  userId,
                });
              }
              ptyProcess = null;
            }

            // Remove from user sessions
            if (userId) {
              const userWs = userSessions.get(userId);
              if (userWs) {
                userWs.delete(ws);
                if (userWs.size === 0) {
                  userSessions.delete(userId);
                }
              }
            }
          } catch (error) {
            systemLogger.error("Error during cleanup", error, {
              operation: "local_terminal_cleanup_error",
              userId,
            });
          }
        };

        // Handle WebSocket close
        ws.on("close", (code, reason) => {
          systemLogger.info("Local terminal WebSocket connection closed", {
            operation: "local_terminal_disconnected",
            userId,
            code,
            reason: reason.toString(),
          });
          cleanup();
        });

        // Handle WebSocket error
        ws.on("error", (error) => {
          systemLogger.error("Local terminal WebSocket error", error, {
            operation: "local_terminal_ws_error",
            userId,
          });
          cleanup();
        });

        // Handle incoming messages
        ws.on("message", (msg: RawData) => {
          try {
            // Check data access still valid
            const currentDataKey = userCrypto.getUserDataKey(userId);
            if (!currentDataKey) {
              systemLogger.warn(
                "Local terminal message rejected: data access expired",
                {
                  operation: "local_terminal_message_rejected",
                  userId,
                  reason: "data_access_expired",
                },
              );
              ws.send(
                JSON.stringify({
                  type: "error",
                  message: "Data access expired - please re-authenticate",
                  code: "DATA_EXPIRED",
                }),
              );
              ws.close(1008, "Data access expired");
              return;
            }

            let parsed: any;
            try {
              parsed = JSON.parse(msg.toString());
            } catch (e) {
              systemLogger.error("Invalid JSON received", e, {
                operation: "local_terminal_invalid_json",
                userId,
                messageLength: msg.toString().length,
              });
              ws.send(
                JSON.stringify({
                  type: "error",
                  message: "Invalid JSON",
                  code: "INVALID_JSON",
                }),
              );
              return;
            }

            const { type, data } = parsed;

            switch (type) {
              case "connect":
                handleConnect(data);
                break;

              case "input":
                if (ptyProcess) {
                  try {
                    ptyProcess.write(data);
                  } catch (error) {
                    systemLogger.error("Error writing to PTY", error, {
                      operation: "local_terminal_pty_write_error",
                      userId,
                    });
                    ws.send(
                      JSON.stringify({
                        type: "error",
                        message: "Failed to write to terminal",
                        code: "PTY_WRITE_ERROR",
                      }),
                    );
                  }
                } else {
                  systemLogger.warn("PTY not initialized for input", {
                    operation: "local_terminal_no_pty",
                    userId,
                  });
                }
                break;

              case "resize":
                if (ptyProcess && data && typeof data.cols === "number" && typeof data.rows === "number") {
                  try {
                    ptyProcess.resize(data.cols, data.rows);
                    systemLogger.debug("PTY resized", {
                      operation: "local_terminal_pty_resize",
                      userId,
                      cols: data.cols,
                      rows: data.rows,
                    });
                  } catch (error) {
                    systemLogger.error("Error resizing PTY", error, {
                      operation: "local_terminal_pty_resize_error",
                      userId,
                      cols: data.cols,
                      rows: data.rows,
                    });
                  }
                }
                break;

              case "ping":
                ws.send(JSON.stringify({ type: "pong" }));
                break;

              case "disconnect":
                systemLogger.info("Client requested disconnect", {
                  operation: "local_terminal_client_disconnect",
                  userId,
                });
                cleanup();
                ws.close(1000, "Client requested disconnect");
                break;

              default:
                systemLogger.warn("Unknown message type received", {
                  operation: "local_terminal_unknown_message_type",
                  userId,
                  messageType: type,
                });
            }
          } catch (error) {
            systemLogger.error("Error processing message", error, {
              operation: "local_terminal_message_processing_error",
              userId,
            });
          }
        });

        // Handle connect message to spawn PTY
        function handleConnect(data: { cols?: number; rows?: number; cwd?: string }) {
          if (ptyProcess) {
            systemLogger.warn("PTY already spawned for this connection", {
              operation: "local_terminal_pty_already_spawned",
              userId,
            });
            return;
          }

          // Determine shell based on platform (declare outside try block for error handling)
          let shell: string;
          const shellArgs: string[] = [];

          try {
            const cols = data?.cols || 80;
            const rows = data?.rows || 24;
            const cwd = data?.cwd || process.env.HOME || os.homedir();

            if (os.platform() === "win32") {
              shell = process.env.COMSPEC || "cmd.exe";
              // Try PowerShell if available
              const powerShell = process.env.WINDIR
                ? `${process.env.WINDIR}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`
                : "powershell.exe";
              try {
                shell = powerShell;
              } catch {
                // Fall back to cmd.exe
              }
            } else {
              // Unix-like systems
              shell = process.env.SHELL || "/bin/bash";
            }

            systemLogger.info("Spawning PTY process", {
              operation: "local_terminal_pty_spawn",
              userId,
              shell,
              cols,
              rows,
              cwd,
              platform: os.platform(),
            });

            ptyProcess = pty.spawn(shell, shellArgs, {
              name: "xterm-256color",
              cols,
              rows,
              cwd,
              env: {
                ...process.env,
                TERM: "xterm-256color",
                COLORTERM: "truecolor",
              } as any,
            });

            // Handle PTY data output
            ptyProcess.onData((data: string) => {
              try {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ type: "output", data }));
                }
              } catch (error) {
                systemLogger.error("Failed to send PTY data to WebSocket", error, {
                  operation: "local_terminal_send_data_error",
                  userId,
                });
              }
            });

            // Handle PTY exit
            ptyProcess.onExit(({ exitCode, signal }) => {
              systemLogger.info("PTY process exited", {
                operation: "local_terminal_pty_exit",
                userId,
                exitCode,
                signal,
              });

              try {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(
                    JSON.stringify({
                      type: "exit",
                      exitCode,
                      signal,
                    }),
                  );
                }
              } catch (error) {
                systemLogger.error("Failed to send exit message", error, {
                  operation: "local_terminal_send_exit_error",
                  userId,
                });
              }

              cleanup();
            });

            // Setup ping interval to keep connection alive
            pingInterval = setInterval(() => {
              if (ws.readyState === WebSocket.OPEN) {
                try {
                  ws.send(JSON.stringify({ type: "ping" }));
                } catch (error) {
                  systemLogger.error("Failed to send ping", error, {
                    operation: "local_terminal_ping_error",
                    userId,
                  });
                  cleanup();
                }
              } else {
                cleanup();
              }
            }, 30000); // Ping every 30 seconds

            // Send connected message
            ws.send(
              JSON.stringify({
                type: "connected",
                message: "Local terminal connected",
                shell,
                cwd,
              }),
            );

            systemLogger.info("PTY process spawned successfully", {
              operation: "local_terminal_pty_spawned",
              userId,
              shell,
              pid: ptyProcess.pid,
            });
          } catch (error) {
            const shellName = shell || "unknown";
            systemLogger.error("Failed to spawn PTY process", error, {
              operation: "local_terminal_pty_spawn_error",
              userId,
              platform: os.platform(),
              shell: shellName,
            });

            let errorMessage = "Failed to start terminal";
            let errorCode = "PTY_SPAWN_ERROR";

            if (error instanceof Error) {
              if (error.message.includes("ENOENT")) {
                errorMessage = `Shell not found: ${shellName}`;
                errorCode = "SHELL_NOT_FOUND";
              } else if (error.message.includes("EACCES")) {
                errorMessage = "Permission denied to start shell";
                errorCode = "SHELL_PERMISSION_DENIED";
              } else {
                errorMessage = `Terminal error: ${error.message}`;
              }
            }

            ws.send(
              JSON.stringify({
                type: "error",
                message: errorMessage,
                code: errorCode,
              }),
            );
          }
        }
      } catch (error) {
        systemLogger.error("Unexpected error in local terminal connection", error, {
          operation: "local_terminal_unexpected_error",
          userId,
        });

        try {
          ws.send(
            JSON.stringify({
              type: "error",
              message: "Internal server error",
              code: "INTERNAL_ERROR",
            }),
          );
          ws.close(1011, "Internal server error");
        } catch {
          // Failed to send error, connection likely already closed
        }
      }
    });

    wss.on("error", (error) => {
      systemLogger.error(
        `Local terminal WebSocket server error on port ${port}`,
        error,
        {
          operation: "local_terminal_server_error",
          port,
        },
      );
    });

    // Register the port in the central registry
    portRegistry.setPort(SERVICE_NAMES.LOCAL_TERMINAL, port);

    systemLogger.info(`Local terminal WebSocket server started on port ${port}`, {
      operation: "local_terminal_server_started",
      port,
    });
  } catch (error) {
    systemLogger.error("Failed to start local terminal WebSocket server", error, {
      operation: "local_terminal_server_start_error",
      port,
    });
    wss = null;
    throw error;
  }
}

export async function shutdownLocalTerminalServer(): Promise<void> {
  if (wss) {
    systemLogger.info("Shutting down local terminal WebSocket server...", {
      operation: "local_terminal_server_shutdown_start",
    });

    return new Promise((resolve) => {
      try {
        // Close all active connections
        wss!.clients.forEach((client) => {
          try {
            client.close(1001, "Server shutting down");
          } catch (error) {
            systemLogger.error("Error closing client connection", error, {
              operation: "local_terminal_client_close_error",
            });
          }
        });

        wss!.close(() => {
          systemLogger.info("Local terminal WebSocket server has been shut down.", {
            operation: "local_terminal_server_shutdown_complete",
          });
          wss = null;
          userSessions.clear();
          resolve();
        });
      } catch (error) {
        systemLogger.error("Error during server shutdown", error, {
          operation: "local_terminal_server_shutdown_error",
        });
        wss = null;
        userSessions.clear();
        resolve();
      }
    });
  } else {
    systemLogger.info("Local terminal WebSocket server is not running", {
      operation: "local_terminal_server_shutdown_not_running",
    });
  }
}
