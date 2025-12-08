import { createServer } from "net";
import { systemLogger } from "./logger.js";

/**
 * Finds an available port starting from the preferred port.
 * If the preferred port is in use, it will try subsequent ports.
 *
 * @param preferredPort - The port to try first
 * @param maxAttempts - Maximum number of ports to try (default: 10)
 * @returns Promise resolving to an available port number
 * @throws Error if no available port is found after maxAttempts
 */
export async function findAvailablePort(
  preferredPort: number,
  maxAttempts: number = 10,
): Promise<number> {
  let currentPort = preferredPort;
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const isAvailable = await checkPortAvailability(currentPort);
      if (isAvailable) {
        if (currentPort !== preferredPort) {
          systemLogger.info(
            `Preferred port ${preferredPort} was in use, using port ${currentPort} instead`,
            {
              operation: "port_fallback",
              preferredPort,
              actualPort: currentPort,
            },
          );
        }
        return currentPort;
      }
    } catch (error) {
      systemLogger.debug(`Port ${currentPort} check failed`, {
        operation: "port_check_error",
        port: currentPort,
        error,
      });
    }

    currentPort++;
    attempts++;
  }

  throw new Error(
    `Could not find an available port after trying ${maxAttempts} ports starting from ${preferredPort}`,
  );
}

/**
 * Checks if a specific port is available for use.
 *
 * @param port - The port number to check
 * @returns Promise resolving to true if port is available, false otherwise
 */
function checkPortAvailability(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();

    server.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        resolve(false);
      } else {
        resolve(false);
      }
    });

    server.once("listening", () => {
      server.close(() => {
        resolve(true);
      });
    });

    server.listen(port);
  });
}
