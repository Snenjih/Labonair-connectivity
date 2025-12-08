import http from "http";

interface ServiceCheck {
  name: string;
  port: number;
  path: string;
}

const SERVICES: ServiceCheck[] = [
  { name: "Main API", port: 30001, path: "/users/me" },
  { name: "Local File Manager", port: 30006, path: "/local/listFiles" },
  { name: "Server Stats", port: 30005, path: "/" },
];

export async function performStartupChecks(): Promise<void> {
  console.log("[STARTUP] Running service checks...");

  for (const service of SERVICES) {
    try {
      const result = await checkService(service);
      if (result) {
        console.log(`[STARTUP] ✓ ${service.name} on port ${service.port}`);
      } else {
        console.error(`[STARTUP] ✗ ${service.name} on port ${service.port} - Not responding`);
      }
    } catch (error) {
      console.error(`[STARTUP] ✗ ${service.name} check failed:`, error);
    }
  }

  console.log("[STARTUP] Service checks complete");
}

async function checkService(service: ServiceCheck): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: "localhost",
        port: service.port,
        path: service.path,
        method: "GET",
        timeout: 5000,
      },
      (res) => {
        // Consider any response status < 500 as "up" (including 401, 404, etc.)
        // We just want to know if the service is running
        resolve(res.statusCode !== undefined && res.statusCode < 500);
      }
    );

    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}
