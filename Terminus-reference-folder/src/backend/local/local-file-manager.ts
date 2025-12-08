import express from "express";
import cors from "cors";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import os from "os";
import { fileLogger } from "../utils/logger.js";
import { AuthManager } from "../utils/auth-manager.js";
import * as editorLauncher from "./editor-launcher.js";
import { findAvailablePort } from "../utils/port-utils.js";
import { portRegistry, SERVICE_NAMES } from "../utils/port-registry.js";

const app = express();

/**
 * Normalize path for frontend consumption (convert backslashes to forward slashes)
 * Frontend expects POSIX-style paths regardless of backend OS
 */
function normalizePathForFrontend(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

/**
 * Normalize path from frontend for backend use (convert to platform-specific separators)
 */
function normalizePathFromFrontend(filePath: string): string {
  if (process.platform === "win32") {
    return filePath.replace(/\//g, path.sep);
  }
  return filePath;
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
      ];

      if (origin.startsWith("https://")) {
        return callback(null, true);
      }

      if (origin.startsWith("http://")) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "User-Agent",
      "X-Electron-App",
    ],
  }),
);
app.use(express.json({ limit: "1gb" }));
app.use(express.urlencoded({ limit: "1gb", extended: true }));
app.use(express.raw({ limit: "5gb", type: "application/octet-stream" }));

const authManager = AuthManager.getInstance();
app.use(authManager.createAuthMiddleware());

// Helper function to get safe local path
function getSafeLocalPath(requestedPath: string): string {
  // Normalize path from frontend (convert forward slashes to platform-specific)
  const platformPath = normalizePathFromFrontend(requestedPath);

  // Get user's home directory as base
  const homeDir = os.homedir();

  // If path is absolute and starts with home dir, use it
  if (path.isAbsolute(platformPath)) {
    // Ensure path is within home directory for security
    const normalizedPath = path.normalize(platformPath);
    if (normalizedPath.startsWith(homeDir)) {
      return normalizedPath;
    }
  }

  // Otherwise, resolve relative to home directory
  return path.join(homeDir, platformPath);
}

// Helper function to determine if a file is executable
function isExecutableFile(stats: fsSync.Stats, fileName: string): boolean {
  // Check if file has execute permission
  const hasExecutePermission = (stats.mode & 0o111) !== 0;

  const scriptExtensions = [
    ".sh",
    ".py",
    ".pl",
    ".rb",
    ".js",
    ".php",
    ".bash",
    ".zsh",
    ".fish",
  ];
  const hasScriptExtension = scriptExtensions.some((ext) =>
    fileName.toLowerCase().endsWith(ext),
  );

  const executableExtensions = [".bin", ".exe", ".out"];
  const hasExecutableExtension = executableExtensions.some((ext) =>
    fileName.toLowerCase().endsWith(ext),
  );

  const hasNoExtension = !fileName.includes(".") && hasExecutePermission;

  return (
    hasExecutePermission &&
    (hasScriptExtension || hasExecutableExtension || hasNoExtension)
  );
}

// Helper function to format file permissions
function formatPermissions(stats: fsSync.Stats): string {
  const mode = stats.mode;
  let permissions = "";

  // File type
  if (stats.isDirectory()) permissions += "d";
  else if (stats.isSymbolicLink()) permissions += "l";
  else permissions += "-";

  // Owner permissions
  permissions += (mode & 0o400) ? "r" : "-";
  permissions += (mode & 0o200) ? "w" : "-";
  permissions += (mode & 0o100) ? "x" : "-";

  // Group permissions
  permissions += (mode & 0o040) ? "r" : "-";
  permissions += (mode & 0o020) ? "w" : "-";
  permissions += (mode & 0o010) ? "x" : "-";

  // Others permissions
  permissions += (mode & 0o004) ? "r" : "-";
  permissions += (mode & 0o002) ? "w" : "-";
  permissions += (mode & 0o001) ? "x" : "-";

  return permissions;
}

// LIST LOCAL FILES
app.get("/local/listFiles", async (req, res) => {
  try {
    const requestedPath = (req.query.path as string) || os.homedir();
    const safePath = getSafeLocalPath(requestedPath);

    fileLogger.info(`Listing local files in: ${safePath}`);

    // Check if directory exists
    try {
      const stats = await fs.stat(safePath);
      if (!stats.isDirectory()) {
        return res.status(400).json({ error: "Path is not a directory" });
      }
    } catch (error) {
      return res.status(404).json({ error: "Directory not found" });
    }

    // Read directory
    const entries = await fs.readdir(safePath, { withFileTypes: true });

    const files = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(safePath, entry.name);
        const stats = await fs.lstat(fullPath);

        let fileType: "file" | "directory" | "link" = "file";
        if (entry.isDirectory()) fileType = "directory";
        else if (entry.isSymbolicLink()) fileType = "link";

        const permissions = formatPermissions(stats);
        const executable = fileType === "file" ? isExecutableFile(stats, entry.name) : false;

        return {
          name: entry.name,
          path: normalizePathForFrontend(fullPath),
          type: fileType,
          size: stats.size,
          modifiedTime: stats.mtime.toISOString(),
          permissions: permissions,
          owner: stats.uid.toString(),
          group: stats.gid.toString(),
          executable: executable,
        };
      })
    );

    res.json(files);
  } catch (error: any) {
    fileLogger.error(`Failed to list local files: ${error.message}`, error);
    res.status(500).json({ error: error.message });
  }
});

// CREATE LOCAL FILE
app.post("/local/createFile", async (req, res) => {
  try {
    const { directory, fileName, content = "" } = req.body;

    if (!directory || !fileName) {
      return res.status(400).json({ error: "Directory and fileName are required" });
    }

    const safeDir = getSafeLocalPath(directory);
    const filePath = path.join(safeDir, fileName);

    fileLogger.info(`Creating local file: ${filePath}`);

    // Check if file already exists
    try {
      await fs.access(filePath);
      return res.status(409).json({ error: "File already exists" });
    } catch {
      // File doesn't exist, proceed
    }

    // Create file
    await fs.writeFile(filePath, content, "utf-8");

    res.json({ success: true, path: filePath });
  } catch (error: any) {
    fileLogger.error(`Failed to create local file: ${error.message}`, error);
    res.status(500).json({ error: error.message });
  }
});

// CREATE LOCAL FOLDER
app.post("/local/createFolder", async (req, res) => {
  try {
    const { directory, folderName } = req.body;

    if (!directory || !folderName) {
      return res.status(400).json({ error: "Directory and folderName are required" });
    }

    const safeDir = getSafeLocalPath(directory);
    const folderPath = path.join(safeDir, folderName);

    fileLogger.info(`Creating local folder: ${folderPath}`);

    // Check if folder already exists
    try {
      await fs.access(folderPath);
      return res.status(409).json({ error: "Folder already exists" });
    } catch {
      // Folder doesn't exist, proceed
    }

    // Create folder
    await fs.mkdir(folderPath, { recursive: false });

    res.json({ success: true, path: folderPath });
  } catch (error: any) {
    fileLogger.error(`Failed to create local folder: ${error.message}`, error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE LOCAL ITEM
app.delete("/local/deleteItem", async (req, res) => {
  try {
    const { itemPath, isDirectory } = req.body;

    if (!itemPath) {
      return res.status(400).json({ error: "itemPath is required" });
    }

    const safePath = getSafeLocalPath(itemPath);

    fileLogger.info(`Deleting local item: ${safePath}`);

    // Check if item exists
    try {
      await fs.access(safePath);
    } catch {
      return res.status(404).json({ error: "Item not found" });
    }

    // Delete item
    if (isDirectory) {
      await fs.rm(safePath, { recursive: true, force: true });
    } else {
      await fs.unlink(safePath);
    }

    res.json({ success: true });
  } catch (error: any) {
    fileLogger.error(`Failed to delete local item: ${error.message}`, error);
    res.status(500).json({ error: error.message });
  }
});

// RENAME LOCAL ITEM
app.post("/local/renameItem", async (req, res) => {
  try {
    const { itemPath, newName } = req.body;

    if (!itemPath || !newName) {
      return res.status(400).json({ error: "itemPath and newName are required" });
    }

    const safePath = getSafeLocalPath(itemPath);
    const directory = path.dirname(safePath);
    const newPath = path.join(directory, newName);

    fileLogger.info(`Renaming local item from ${safePath} to ${newPath}`);

    // Check if item exists
    try {
      await fs.access(safePath);
    } catch {
      return res.status(404).json({ error: "Item not found" });
    }

    // Check if target already exists
    try {
      await fs.access(newPath);
      return res.status(409).json({ error: "Target name already exists" });
    } catch {
      // Target doesn't exist, proceed
    }

    // Rename item
    await fs.rename(safePath, newPath);

    res.json({ success: true, newPath });
  } catch (error: any) {
    fileLogger.error(`Failed to rename local item: ${error.message}`, error);
    res.status(500).json({ error: error.message });
  }
});

// MOVE LOCAL ITEM
app.post("/local/moveItem", async (req, res) => {
  try {
    const { sourcePath, targetPath } = req.body;

    if (!sourcePath || !targetPath) {
      return res.status(400).json({ error: "sourcePath and targetPath are required" });
    }

    const safeSrc = getSafeLocalPath(sourcePath);
    const safeTgt = getSafeLocalPath(targetPath);

    fileLogger.info(`Moving local item from ${safeSrc} to ${safeTgt}`);

    // Check if source exists
    try {
      await fs.access(safeSrc);
    } catch {
      return res.status(404).json({ error: "Source item not found" });
    }

    // If target is a directory, append source filename
    let finalTarget = safeTgt;
    try {
      const stats = await fs.stat(safeTgt);
      if (stats.isDirectory()) {
        const fileName = path.basename(safeSrc);
        finalTarget = path.join(safeTgt, fileName);
      }
    } catch {
      // Target doesn't exist or not a directory, use as-is
    }

    // Move item
    await fs.rename(safeSrc, finalTarget);

    res.json({ success: true, newPath: finalTarget });
  } catch (error: any) {
    fileLogger.error(`Failed to move local item: ${error.message}`, error);
    res.status(500).json({ error: error.message });
  }
});

// COPY LOCAL ITEM
app.post("/local/copyItem", async (req, res) => {
  try {
    const { sourcePath, targetDirectory } = req.body;

    if (!sourcePath || !targetDirectory) {
      return res.status(400).json({ error: "sourcePath and targetDirectory are required" });
    }

    const safeSrc = getSafeLocalPath(sourcePath);
    const safeDir = getSafeLocalPath(targetDirectory);
    const fileName = path.basename(safeSrc);
    let targetPath = path.join(safeDir, fileName);

    fileLogger.info(`Copying local item from ${safeSrc} to ${targetPath}`);

    // Check if source exists
    try {
      await fs.access(safeSrc);
    } catch {
      return res.status(404).json({ error: "Source item not found" });
    }

    // Check if source is a directory
    const srcStats = await fs.stat(safeSrc);

    // Handle name collision
    let counter = 1;
    let uniqueName = fileName;
    while (true) {
      try {
        await fs.access(targetPath);
        // File exists, generate unique name
        if (srcStats.isDirectory()) {
          uniqueName = `${fileName}_copy${counter}`;
        } else {
          const ext = path.extname(fileName);
          const base = path.basename(fileName, ext);
          uniqueName = `${base}_copy${counter}${ext}`;
        }
        targetPath = path.join(safeDir, uniqueName);
        counter++;
      } catch {
        // Target doesn't exist, use this name
        break;
      }
    }

    // Copy item
    if (srcStats.isDirectory()) {
      await fs.cp(safeSrc, targetPath, { recursive: true });
    } else {
      await fs.copyFile(safeSrc, targetPath);
    }

    res.json({ success: true, targetPath, uniqueName });
  } catch (error: any) {
    fileLogger.error(`Failed to copy local item: ${error.message}`, error);
    res.status(500).json({ error: error.message });
  }
});

// DOWNLOAD LOCAL FILE (read file content)
app.get("/local/downloadFile", async (req, res) => {
  try {
    const filePath = req.query.path as string;

    if (!filePath) {
      return res.status(400).json({ error: "path is required" });
    }

    const safePath = getSafeLocalPath(filePath);

    fileLogger.info(`Reading local file: ${safePath}`);

    // Check if file exists
    try {
      const stats = await fs.stat(safePath);
      if (stats.isDirectory()) {
        return res.status(400).json({ error: "Path is a directory, not a file" });
      }
    } catch {
      return res.status(404).json({ error: "File not found" });
    }

    // Read file
    const content = await fs.readFile(safePath);
    const base64Content = content.toString("base64");
    const fileName = path.basename(safePath);

    res.json({
      success: true,
      fileName,
      content: base64Content,
      mimeType: "application/octet-stream",
    });
  } catch (error: any) {
    fileLogger.error(`Failed to read local file: ${error.message}`, error);
    res.status(500).json({ error: error.message });
  }
});

// UPLOAD FILE TO LOCAL (save file content)
app.post("/local/uploadFile", async (req, res) => {
  try {
    const { directory, fileName, content } = req.body;

    if (!directory || !fileName || content === undefined) {
      return res.status(400).json({ error: "directory, fileName, and content are required" });
    }

    const safeDir = getSafeLocalPath(directory);
    const filePath = path.join(safeDir, fileName);

    fileLogger.info(`Uploading file to local: ${filePath}`);

    // Decode base64 content
    const buffer = Buffer.from(content, "base64");

    // Write file
    await fs.writeFile(filePath, buffer);

    res.json({ success: true, path: filePath });
  } catch (error: any) {
    fileLogger.error(`Failed to upload file to local: ${error.message}`, error);
    res.status(500).json({ error: error.message });
  }
});

// READ LOCAL FILE (for viewing/editing)
app.get("/local/readFile", async (req, res) => {
  try {
    const filePath = req.query.path as string;

    if (!filePath) {
      return res.status(400).json({ error: "path is required" });
    }

    const safePath = getSafeLocalPath(filePath);

    fileLogger.info(`Reading local file: ${safePath}`);

    // Check if file exists
    try {
      const stats = await fs.stat(safePath);
      if (stats.isDirectory()) {
        return res.status(400).json({ error: "Path is a directory, not a file" });
      }
    } catch {
      return res.status(404).json({ error: "File not found" });
    }

    // Read file as text
    const content = await fs.readFile(safePath, "utf-8");

    res.json({
      success: true,
      content,
      path: safePath,
    });
  } catch (error: any) {
    // If UTF-8 decoding fails, try base64
    try {
      const filePath = req.query.path as string;
      const safePath = getSafeLocalPath(filePath);
      const content = await fs.readFile(safePath);
      const base64Content = content.toString("base64");

      res.json({
        success: true,
        content: base64Content,
        path: safePath,
        isBinary: true,
      });
    } catch (readError: any) {
      fileLogger.error(`Failed to read local file: ${readError.message}`, readError);
      res.status(500).json({ error: readError.message });
    }
  }
});

// Open local file in external editor
app.post("/openInExternalEditor", async (req, res) => {
  try {
    const { filePath, editorPath } = req.body;

    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameter: filePath"
      });
    }

    // Get safe path (validates it's within user's home directory)
    const safePath = getSafeLocalPath(filePath);

    // Check if file exists
    try {
      const stats = await fs.stat(safePath);
      if (!stats.isFile()) {
        return res.status(400).json({
          success: false,
          message: "Path is a directory, not a file"
        });
      }

      // Check file size (10MB limit)
      const fileSizeInMB = stats.size / (1024 * 1024);
      if (fileSizeInMB > 10) {
        return res.status(400).json({
          success: false,
          message: "File too large for editing (max 10MB)"
        });
      }
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: "File not found"
      });
    }

    // Launch external editor
    try {
      await editorLauncher.launchEditor(safePath, editorPath);

      fileLogger.info("Opened local file in external editor", {
        operation: "open_local_in_external_editor",
        filePath: safePath,
      });

      res.json({
        success: true,
        message: "File opened in external editor",
        filePath: safePath
      });
    } catch (editorErr) {
      fileLogger.error("Failed to launch external editor for local file", editorErr, {
        operation: "open_local_in_external_editor",
        filePath: safePath,
        editorPath,
      });

      res.status(500).json({
        success: false,
        message: "Failed to launch external editor",
        error: editorErr instanceof Error ? editorErr.message : String(editorErr)
      });
    }
  } catch (error) {
    fileLogger.error("Unexpected error in openInExternalEditor", error, {
      operation: "open_local_in_external_editor",
    });

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Validate external editor path
app.post("/validateEditorPath", async (req, res) => {
  try {
    const { editorPath } = req.body;

    if (!editorPath) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameter: editorPath",
        isValid: false
      });
    }

    // Validate the editor path
    const isValid = await editorLauncher.validateEditorPath(editorPath);

    res.json({
      success: true,
      isValid,
      message: isValid
        ? "Editor path is valid"
        : "Editor path not found or not executable"
    });
  } catch (error) {
    fileLogger.error("Failed to validate editor path", error, {
      operation: "validate_editor_path",
    });

    res.status(500).json({
      success: false,
      isValid: false,
      message: "Failed to validate editor path",
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Catch-all for debugging 404s
app.use((req, res, next) => {
  fileLogger.error(`[LOCAL FILE MANAGER] 404 - ${req.method} ${req.url}`, {
    operation: "route_not_found",
    method: req.method,
    url: req.url,
    path: req.path,
  });
  res.status(404).json({
    error: "Route not found",
    method: req.method,
    url: req.url,
    hint: "Local file manager routes should start with /local/",
  });
});

async function startServer() {
  return new Promise<void>(async (resolve, reject) => {
    try {
      const preferredPort = 30006;
      const PORT = await findAvailablePort(preferredPort);

      app.listen(PORT, () => {
        // Register the port in the central registry
        portRegistry.setPort(SERVICE_NAMES.LOCAL_FILE_MANAGER, PORT);

        fileLogger.info(`[LOCAL FILE MANAGER] Server listening on port ${PORT}`, {
          operation: "server_start",
          port: PORT,
        });
        fileLogger.info(`[LOCAL FILE MANAGER] Routes registered:`, {
          operation: "routes_info",
        });
        fileLogger.info(`  GET /local/listFiles`);
        fileLogger.info(`  POST /local/createFile`);
        fileLogger.info(`  POST /local/createFolder`);
        fileLogger.info(`  DELETE /local/deleteItem`);
        fileLogger.info(`  POST /local/renameItem`);
        fileLogger.info(`  POST /local/moveItem`);
        fileLogger.info(`  POST /local/copyItem`);
        fileLogger.info(`  GET /local/downloadFile`);
        fileLogger.info(`  POST /local/uploadFile`);
        fileLogger.info(`  GET /local/readFile`);
        fileLogger.info(`  POST /openInExternalEditor`);
        fileLogger.info(`  POST /validateEditorPath`);
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

export { app as localFileApp, startServer as startLocalFileServer };
