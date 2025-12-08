import express from "express";
import type { Request, Response } from "express";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { databaseLogger } from "../../utils/logger.js";

const router = express.Router();

// Server start time for uptime calculation
const serverStartTime = Date.now();

// Route: Get server uptime
// GET /system/uptime
router.get("/uptime", async (req: Request, res: Response) => {
  try {
    const currentTime = Date.now();
    const uptimeMs = currentTime - serverStartTime;
    const uptimeSeconds = Math.floor(uptimeMs / 1000);

    res.json({
      startTime: serverStartTime,
      currentTime: currentTime,
      uptimeMs: uptimeMs,
      uptimeSeconds: uptimeSeconds,
      uptimeFormatted: formatUptime(uptimeSeconds),
    });
  } catch (err) {
    databaseLogger.error("Failed to get system uptime", err);
    res.status(500).json({ error: "Failed to get system uptime" });
  }
});

// Route: Get database health status
// GET /system/health
router.get("/health", async (req: Request, res: Response) => {
  const healthData: any = {
    status: "healthy",
    checks: [],
    timestamp: Date.now(),
  };

  try {
    // Check 1: Database connection
    try {
      const result = await db.select().from(users).limit(1);
      healthData.checks.push({
        name: "database_connection",
        status: "healthy",
        message: "Database connection successful",
      });
    } catch (dbError) {
      healthData.status = "unhealthy";
      healthData.checks.push({
        name: "database_connection",
        status: "unhealthy",
        message: "Database connection failed",
        error: (dbError as Error).message,
      });
    }

    // Check 2: Database file size
    try {
      const dbPath = process.env.DATA_DIR
        ? `${process.env.DATA_DIR}/database.db`
        : "./db/data/database.db";

      const fs = await import("fs/promises");
      const stats = await fs.stat(dbPath);
      const fileSizeInBytes = stats.size;
      const fileSizeInMB = (fileSizeInBytes / (1024 * 1024)).toFixed(2);

      healthData.checks.push({
        name: "database_file_size",
        status: "healthy",
        sizeBytes: fileSizeInBytes,
        sizeMB: fileSizeInMB,
      });
    } catch (fsError) {
      healthData.checks.push({
        name: "database_file_size",
        status: "warning",
        message: "Could not determine database file size",
        error: (fsError as Error).message,
      });
    }

    // Check 3: Record counts
    try {
      const userCount = await db.select().from(users);
      healthData.checks.push({
        name: "database_records",
        status: "healthy",
        userCount: userCount.length,
      });
    } catch (countError) {
      healthData.checks.push({
        name: "database_records",
        status: "warning",
        message: "Could not count database records",
        error: (countError as Error).message,
      });
    }

    res.json(healthData);
  } catch (err) {
    databaseLogger.error("Failed to get system health", err);
    res.status(500).json({
      status: "error",
      error: "Failed to get system health",
      checks: healthData.checks,
    });
  }
});

// Helper function to format uptime in human-readable format
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} day${days !== 1 ? "s" : ""}`);
  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? "s" : ""}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? "s" : ""}`);
  if (secs > 0 && parts.length === 0) parts.push(`${secs} second${secs !== 1 ? "s" : ""}`);

  return parts.join(", ") || "0 seconds";
}

export default router;
