import express from "express";
import { eq } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { sessionState } from "../db/schema.js";
import { AuthManager } from "../../utils/auth-manager.js";
import { apiLogger } from "../../utils/logger.js";
import type { Request, Response, NextFunction } from "express";

const router = express.Router();
const authManager = AuthManager.getInstance();

// Custom auth middleware that accepts JWT from query parameter (for sendBeacon compatibility)
// This is ONLY used for session routes to support navigator.sendBeacon during page unload
const authenticateJWT = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let token = req.cookies?.jwt;

    // Check Authorization header
    if (!token) {
      const authHeader = req.headers["authorization"];
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
      }
    }

    // Check query parameter (only for sendBeacon support)
    if (!token && req.query.token) {
      token = req.query.token as string;
    }

    if (!token) {
      return res.status(401).json({ error: "Missing authentication token" });
    }

    const payload = await authManager.verifyJWTToken(token);

    if (!payload) {
      return res.status(401).json({ error: "Invalid token" });
    }

    (req as any).user = { userId: payload.userId };
    (req as any).userId = payload.userId;
    (req as any).pendingTOTP = payload.pendingTOTP;
    next();
  } catch (error) {
    apiLogger.error("Session authentication failed", error, {
      operation: "session_auth_failed",
    });
    return res.status(401).json({ error: "Authentication failed" });
  }
};

// Route: Get session state for the current user
// GET /session
router.get("/", authenticateJWT, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const db = getDb();
    const session = await db
      .select()
      .from(sessionState)
      .where(eq(sessionState.userId, userId));

    if (!session || session.length === 0) {
      return res.status(404).json({ error: "No session state found" });
    }

    // Safely parse JSON with error handling
    let sessionData;
    try {
      sessionData = JSON.parse(session[0].sessionData);
    } catch (parseError) {
      apiLogger.error("Failed to parse session data", parseError, {
        operation: "parse_session_state",
        userId,
      });
      return res.status(500).json({ error: "Corrupted session data" });
    }

    res.json({
      sessionData,
      updatedAt: session[0].updatedAt,
    });
  } catch (err) {
    apiLogger.error("Failed to get session state", err, {
      operation: "get_session_state",
    });
    res.status(500).json({ error: "Failed to get session state" });
  }
});

// Route: Save or update session state
// POST /session
router.post("/", authenticateJWT, async (req: Request, res: Response) => {
  const { sessionData } = req.body;

  if (!sessionData) {
    return res.status(400).json({ error: "Session data is required" });
  }

  // Validate sessionData is an object or array
  if (typeof sessionData !== "object") {
    return res.status(400).json({ error: "Session data must be an object or array" });
  }

  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const db = getDb();

    // Serialize session data with error handling
    let serializedData;
    try {
      serializedData = JSON.stringify(sessionData);
    } catch (serializeError) {
      apiLogger.error("Failed to serialize session data", serializeError, {
        operation: "serialize_session_state",
        userId,
      });
      return res.status(400).json({ error: "Invalid session data format" });
    }

    // Check if session exists for this user
    const existing = await db
      .select()
      .from(sessionState)
      .where(eq(sessionState.userId, userId));

    if (existing && existing.length > 0) {
      // Update existing session
      await db
        .update(sessionState)
        .set({
          sessionData: serializedData,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(sessionState.userId, userId));
    } else {
      // Insert new session
      await db.insert(sessionState).values({
        userId,
        sessionData: serializedData,
      });
    }

    apiLogger.success("Session state saved", {
      operation: "save_session_state",
      userId,
    });

    res.json({ message: "Session state saved successfully" });
  } catch (err) {
    apiLogger.error("Failed to save session state", err, {
      operation: "save_session_state",
    });
    res.status(500).json({ error: "Failed to save session state" });
  }
});

// Route: Delete session state
// DELETE /session
router.delete("/", authenticateJWT, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const db = getDb();
    await db.delete(sessionState).where(eq(sessionState.userId, userId));

    apiLogger.success("Session state deleted", {
      operation: "delete_session_state",
      userId,
    });

    res.json({ message: "Session state deleted successfully" });
  } catch (err) {
    apiLogger.error("Failed to delete session state", err, {
      operation: "delete_session_state",
    });
    res.status(500).json({ error: "Failed to delete session state" });
  }
});

export default router;
