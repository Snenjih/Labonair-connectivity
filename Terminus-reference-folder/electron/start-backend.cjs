const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

let backendProcess = null;

function startBackend(isDev, app) {
  console.log(
    `Starting backend server in ${isDev ? "development" : "production"} mode...`,
  );

  // In Development: Use compiled backend from dist/
  // In Production: Use packaged backend from dist/
  const backendPath = path.join(
    __dirname,
    "..",
    "dist",
    "backend",
    "backend",
    "starter.js",
  );

  if (!fs.existsSync(backendPath)) {
    console.error("Backend starter not found at:", backendPath);
    console.error('Please run "npm run build" before packaging the app');
    return;
  }

  const userDataPath = app.getPath("userData");
  const dataDir = path.join(userDataPath, "data");

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  backendProcess = spawn("node", [backendPath], {
    env: {
      ...process.env,
      PORT: "30001",
      DATA_DIR: dataDir,
      NODE_ENV: "production",
    },
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });

  backendProcess.stdout.on("data", (data) => {
    console.log(`Backend: ${data.toString().trim()}`);
  });

  backendProcess.stderr.on("data", (data) => {
    console.error(`Backend Error: ${data.toString().trim()}`);
  });

  backendProcess.on("error", (err) => {
    console.error("Failed to start backend:", err);
  });

  backendProcess.on("exit", (code, signal) => {
    if (code !== null) {
      console.log(`Backend exited with code ${code}`);
    } else if (signal !== null) {
      console.log(`Backend was killed with signal ${signal}`);
    }
    backendProcess = null;
  });

  return new Promise((resolve) => {
    setTimeout(() => {
      console.log("Backend startup delay completed");
      resolve();
    }, 3000);
  });
}

function stopBackend() {
  if (backendProcess) {
    console.log("Stopping backend server...");
    try {
      backendProcess.kill("SIGTERM");

      setTimeout(() => {
        if (backendProcess) {
          console.log("Force killing backend...");
          backendProcess.kill("SIGKILL");
        }
      }, 5000);
    } catch (err) {
      console.error("Error stopping backend:", err);
    }
    backendProcess = null;
  }
}

module.exports = { startBackend, stopBackend };
