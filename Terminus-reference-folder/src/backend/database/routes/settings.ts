import express from "express";
import { eq, and } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { settings } from "../db/schema.js";
import { AuthManager } from "../../utils/auth-manager.js";
import { apiLogger } from "../../utils/logger.js";
import type { Request, Response } from "express";

const router = express.Router();
const authManager = AuthManager.getInstance();
const authenticateJWT = authManager.createAuthMiddleware();

// Default settings configuration
const DEFAULT_SETTINGS: Record<string, string> = {
  // Terminal settings
  terminal_restore_sessions: "true",
  terminal_auto_open_local: "false",
  terminal_font_size: "14",
  terminal_cursor_style: "block",
  terminal_cursor_blink: "false",
  terminal_letter_spacing: "0",
  terminal_line_height: "1.2",
  terminal_font_family: "Caskaydia Cove Nerd Font Mono",
  terminal_scrollback_lines: "10000",

  // File Manager display settings
  file_manager_show_type: "true",
  file_manager_show_size: "true",
  file_manager_show_modified: "true",
  file_manager_show_permissions: "false",
  file_manager_show_owner: "false",
  file_manager_display_size: "comfortable",
  file_manager_design: "explorer",

  // UI customization settings
  hide_close_button: "false",
  hide_options_button: "false",
  auto_update_check: "true",
};

// Helper function to get or create settings with defaults
async function getOrCreateSetting(
  key: string
): Promise<{ key: string; value: string } | null> {
  const db = getDb();

  // Try to get existing setting
  const existing = await db
    .select()
    .from(settings)
    .where(eq(settings.key, key))
    .get();

  if (existing) {
    return existing;
  }

  // If no setting exists and we have a default, create it
  if (DEFAULT_SETTINGS[key] !== undefined) {
    const newSetting = await db
      .insert(settings)
      .values({
        key,
        value: DEFAULT_SETTINGS[key],
      })
      .returning()
      .get();

    apiLogger.info(`Created default setting: ${key} = ${DEFAULT_SETTINGS[key]}`, {
      operation: "create_default_setting",
      key,
    });

    return newSetting;
  }

  return null;
}

// Route: Get a specific setting by key
// GET /settings/:key
router.get("/:key", authenticateJWT, async (req: Request, res: Response) => {
  const { key } = req.params;

  try {
    const setting = await getOrCreateSetting(key);

    if (!setting) {
      return res.status(404).json({ error: "Setting not found" });
    }

    res.json({
      key: setting.key,
      value: setting.value,
    });
  } catch (err) {
    apiLogger.error("Failed to get setting", err, {
      operation: "get_setting",
      key,
    });
    res.status(500).json({ error: "Failed to get setting" });
  }
});

// Route: Get all settings
// GET /settings
router.get("/", authenticateJWT, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const allSettings = await db.select().from(settings);

    const settingsMap: Record<string, string> = {};
    allSettings.forEach((setting) => {
      settingsMap[setting.key] = setting.value;
    });

    res.json(settingsMap);
  } catch (err) {
    apiLogger.error("Failed to get all settings", err, {
      operation: "get_all_settings",
    });
    res.status(500).json({ error: "Failed to get settings" });
  }
});

// Route: Save or update a setting
// POST /settings
router.post("/", authenticateJWT, async (req: Request, res: Response) => {
  const { key, value } = req.body;

  if (!key || value === undefined) {
    return res.status(400).json({ error: "Key and value are required" });
  }

  try {
    const db = getDb();

    // Check if setting exists
    const existing = await db
      .select()
      .from(settings)
      .where(eq(settings.key, key));

    if (existing && existing.length > 0) {
      // Update existing setting
      await db
        .update(settings)
        .set({ value: value.toString() })
        .where(eq(settings.key, key));
    } else {
      // Insert new setting
      await db.insert(settings).values({
        key,
        value: value.toString(),
      });
    }

    apiLogger.success(`Setting saved: ${key} = ${value}`, {
      operation: "save_setting",
      key,
    });

    res.json({
      message: "Setting saved successfully",
      key,
      value: value.toString(),
    });
  } catch (err) {
    apiLogger.error("Failed to save setting", err, {
      operation: "save_setting",
      key,
    });
    res.status(500).json({ error: "Failed to save setting" });
  }
});

// Route: Delete a setting
// DELETE /settings/:key
router.delete("/:key", authenticateJWT, async (req: Request, res: Response) => {
  const { key } = req.params;

  try {
    const db = getDb();
    await db.delete(settings).where(eq(settings.key, key));

    apiLogger.success(`Setting deleted: ${key}`, {
      operation: "delete_setting",
      key,
    });

    res.json({ message: "Setting deleted successfully" });
  } catch (err) {
    apiLogger.error("Failed to delete setting", err, {
      operation: "delete_setting",
      key,
    });
    res.status(500).json({ error: "Failed to delete setting" });
  }
});

// Route: Initialize all default settings
// POST /settings/initialize-defaults
router.post("/initialize-defaults", authenticateJWT, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const initialized: string[] = [];

    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      // Check if setting already exists
      const existing = await db
        .select()
        .from(settings)
        .where(eq(settings.key, key))
        .get();

      if (!existing) {
        await db.insert(settings).values({ key, value });
        initialized.push(key);
      }
    }

    apiLogger.success(`Initialized ${initialized.length} default settings`, {
      operation: "initialize_defaults",
      initialized,
    });

    res.json({
      success: true,
      initialized,
      message: `Initialized ${initialized.length} default settings`,
    });
  } catch (err) {
    apiLogger.error("Failed to initialize defaults", err, {
      operation: "initialize_defaults",
    });
    res.status(500).json({ error: "Failed to initialize defaults" });
  }
});

export default router;
