import express from "express";
import { eq, and } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { colorThemes } from "../db/schema.js";
import { AuthManager } from "../../utils/auth-manager.js";
import { apiLogger } from "../../utils/logger.js";
import type { Request, Response } from "express";
import "../../types/express.js";

const router = express.Router();
const authManager = AuthManager.getInstance();
const authenticateJWT = authManager.createAuthMiddleware();

// Constants for validation
const MAX_COLOR_JSON_SIZE = 1024 * 1024; // 1MB max
const COLOR_REGEX = /^(#[0-9a-fA-F]{3,8}|rgb\(|rgba\(|hsl\(|hsla\(|oklch\(|var\()/;

/**
 * Validates color theme data to prevent injection attacks and malformed data
 * @param colors - The colors data (string or object)
 * @returns Validated colors object or error message
 */
function validateColors(colors: any): {
  valid: boolean;
  colors?: Record<string, string>;
  error?: string;
} {
  try {
    // Parse if string
    let colorsObj: any;
    if (typeof colors === "string") {
      // Check size before parsing
      if (colors.length > MAX_COLOR_JSON_SIZE) {
        return { valid: false, error: "Colors JSON exceeds maximum size (1MB)" };
      }
      try {
        colorsObj = JSON.parse(colors);
      } catch {
        return { valid: false, error: "Invalid JSON in colors field" };
      }
    } else if (typeof colors === "object" && colors !== null) {
      colorsObj = colors;
    } else {
      return { valid: false, error: "Colors must be object or JSON string" };
    }

    // Verify it's a flat object
    if (typeof colorsObj !== "object" || Array.isArray(colorsObj)) {
      return { valid: false, error: "Colors must be a flat object" };
    }

    // Validate each key-value pair
    const validatedColors: Record<string, string> = {};
    for (const [key, value] of Object.entries(colorsObj)) {
      // Validate key is a string starting with --
      if (typeof key !== "string" || !key.startsWith("--")) {
        return {
          valid: false,
          error: `Invalid color variable name: ${key}. Must start with '--'`,
        };
      }

      // Validate value is a string
      if (typeof value !== "string") {
        return {
          valid: false,
          error: `Invalid color value for ${key}. Must be a string`,
        };
      }

      // Validate value looks like a color (basic check)
      if (!COLOR_REGEX.test(value.trim())) {
        return {
          valid: false,
          error: `Invalid color format for ${key}: ${value}`,
        };
      }

      validatedColors[key] = value;
    }

    return { valid: true, colors: validatedColors };
  } catch (err) {
    return { valid: false, error: "Failed to validate colors data" };
  }
}

// Route: Get all themes for the current user
// GET /themes
router.get("/", authenticateJWT, async (req: Request, res: Response) => {
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  try {
    const db = getDb();
    const themes = await db
      .select()
      .from(colorThemes)
      .where(eq(colorThemes.userId, userId));

    res.json(themes);
  } catch (err) {
    apiLogger.error("Failed to get themes", err, {
      operation: "get_themes",
      userId,
    });
    res.status(500).json({ error: "Failed to get themes" });
  }
});

// Route: Get a specific theme by ID
// GET /themes/:id
router.get("/:id", authenticateJWT, async (req: Request, res: Response) => {
  const userId = req.userId;
  const themeId = parseInt(req.params.id);

  if (!userId) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  if (isNaN(themeId)) {
    return res.status(400).json({ error: "Invalid theme ID" });
  }

  try {
    const db = getDb();
    const theme = await db
      .select()
      .from(colorThemes)
      .where(
        and(eq(colorThemes.id, themeId), eq(colorThemes.userId, userId))
      );

    if (!theme || theme.length === 0) {
      return res.status(404).json({ error: "Theme not found" });
    }

    res.json(theme[0]);
  } catch (err) {
    apiLogger.error("Failed to get theme", err, {
      operation: "get_theme",
      themeId,
      userId,
    });
    res.status(500).json({ error: "Failed to get theme" });
  }
});

// Route: Create a new theme
// POST /themes
router.post("/", authenticateJWT, async (req: Request, res: Response) => {
  const userId = req.userId;
  const { name, colors, author } = req.body;

  if (!userId) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  if (!name || !colors) {
    return res.status(400).json({ error: "Name and colors are required" });
  }

  // Validate colors data
  const validation = validateColors(colors);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    const db = getDb();

    // Convert validated colors to JSON string
    const colorsString = JSON.stringify(validation.colors);

    const result = await db.insert(colorThemes).values({
      userId,
      name,
      colors: colorsString,
      author: author || null,
      isActive: false,
    });

    apiLogger.success(`Theme created: ${name}`, {
      operation: "create_theme",
      userId,
      name,
    });

    res.status(201).json({
      message: "Theme created successfully",
      id: result.lastInsertRowid,
      name,
    });
  } catch (err) {
    apiLogger.error("Failed to create theme", err, {
      operation: "create_theme",
      userId,
      name,
    });
    res.status(500).json({ error: "Failed to create theme" });
  }
});

// Route: Update a theme
// PUT /themes/:id
router.put("/:id", authenticateJWT, async (req: Request, res: Response) => {
  const userId = req.userId;
  const themeId = parseInt(req.params.id);
  const { name, colors, author } = req.body;

  if (!userId) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  if (isNaN(themeId)) {
    return res.status(400).json({ error: "Invalid theme ID" });
  }

  // Validate colors if provided
  if (colors !== undefined) {
    const validation = validateColors(colors);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
  }

  try {
    const db = getDb();

    // Verify theme belongs to user
    const existingTheme = await db
      .select()
      .from(colorThemes)
      .where(
        and(eq(colorThemes.id, themeId), eq(colorThemes.userId, userId))
      );

    if (!existingTheme || existingTheme.length === 0) {
      return res.status(404).json({ error: "Theme not found" });
    }

    // Build update object - only include fields that were provided
    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = name;
    if (colors !== undefined) {
      // Re-validate and use validated colors
      const validation = validateColors(colors);
      updateData.colors = JSON.stringify(validation.colors);
    }
    if (author !== undefined) updateData.author = author || null;

    await db
      .update(colorThemes)
      .set(updateData)
      .where(
        and(eq(colorThemes.id, themeId), eq(colorThemes.userId, userId))
      );

    apiLogger.success(`Theme updated: ${themeId}`, {
      operation: "update_theme",
      userId,
      themeId,
    });

    res.json({ message: "Theme updated successfully" });
  } catch (err) {
    apiLogger.error("Failed to update theme", err, {
      operation: "update_theme",
      userId,
      themeId,
    });
    res.status(500).json({ error: "Failed to update theme" });
  }
});

// Route: Delete a theme
// DELETE /themes/:id
router.delete("/:id", authenticateJWT, async (req: Request, res: Response) => {
  const userId = req.userId;
  const themeId = parseInt(req.params.id);

  if (!userId) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  if (isNaN(themeId)) {
    return res.status(400).json({ error: "Invalid theme ID" });
  }

  try {
    const db = getDb();

    // Verify theme belongs to user
    const existingTheme = await db
      .select()
      .from(colorThemes)
      .where(
        and(eq(colorThemes.id, themeId), eq(colorThemes.userId, userId))
      );

    if (!existingTheme || existingTheme.length === 0) {
      return res.status(404).json({ error: "Theme not found" });
    }

    await db
      .delete(colorThemes)
      .where(
        and(eq(colorThemes.id, themeId), eq(colorThemes.userId, userId))
      );

    apiLogger.success(`Theme deleted: ${themeId}`, {
      operation: "delete_theme",
      userId,
      themeId,
    });

    res.json({ message: "Theme deleted successfully" });
  } catch (err) {
    apiLogger.error("Failed to delete theme", err, {
      operation: "delete_theme",
      userId,
      themeId,
    });
    res.status(500).json({ error: "Failed to delete theme" });
  }
});

// Route: Activate a theme
// PUT /themes/:id/activate
router.put(
  "/:id/activate",
  authenticateJWT,
  async (req: Request, res: Response) => {
    const userId = req.userId;
    const themeId = parseInt(req.params.id);

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (isNaN(themeId)) {
      return res.status(400).json({ error: "Invalid theme ID" });
    }

    try {
      const db = getDb();

      // Verify theme belongs to user
      const existingTheme = await db
        .select()
        .from(colorThemes)
        .where(
          and(eq(colorThemes.id, themeId), eq(colorThemes.userId, userId))
        );

      if (!existingTheme || existingTheme.length === 0) {
        return res.status(404).json({ error: "Theme not found" });
      }

      // Deactivate all other themes for this user
      await db
        .update(colorThemes)
        .set({ isActive: false })
        .where(eq(colorThemes.userId, userId));

      // Activate the selected theme
      await db
        .update(colorThemes)
        .set({ isActive: true, updatedAt: new Date().toISOString() })
        .where(
          and(eq(colorThemes.id, themeId), eq(colorThemes.userId, userId))
        );

      apiLogger.success(`Theme activated: ${themeId}`, {
        operation: "activate_theme",
        userId,
        themeId,
      });

      res.json({
        message: "Theme activated successfully",
        theme: existingTheme[0],
      });
    } catch (err) {
      apiLogger.error("Failed to activate theme", err, {
        operation: "activate_theme",
        userId,
        themeId,
      });
      res.status(500).json({ error: "Failed to activate theme" });
    }
  }
);

// Route: Import a theme from JSON
// POST /themes/import
router.post(
  "/import",
  authenticateJWT,
  async (req: Request, res: Response) => {
    const userId = req.userId;
    const themeData = req.body;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Validate required fields
    if (!themeData.name || !themeData.colors) {
      return res
        .status(400)
        .json({ error: "Theme name and colors are required" });
    }

    // Validate name length
    if (typeof themeData.name !== "string" || themeData.name.length > 100) {
      return res
        .status(400)
        .json({ error: "Theme name must be a string (max 100 characters)" });
    }

    // Validate colors using the validation function
    const validation = validateColors(themeData.colors);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    try {
      const db = getDb();

      // Check for duplicate name
      const existingTheme = await db
        .select()
        .from(colorThemes)
        .where(
          and(
            eq(colorThemes.userId, userId),
            eq(colorThemes.name, themeData.name)
          )
        );

      let finalName = themeData.name;
      if (existingTheme && existingTheme.length > 0) {
        // Add " (Imported)" suffix to avoid name collision
        finalName = `${themeData.name} (Imported)`;
      }

      // Use validated colors
      const colorsString = JSON.stringify(validation.colors);

      // Validate and parse tags if provided
      let tagsString: string | undefined;
      if (themeData.tags) {
        if (typeof themeData.tags === "string") {
          // Validate it's valid JSON array if string
          try {
            const parsed = JSON.parse(themeData.tags);
            if (Array.isArray(parsed)) {
              tagsString = themeData.tags;
            }
          } catch {
            // Invalid JSON, ignore tags
            apiLogger.warn("Invalid tags JSON in import, ignoring", {
              userId,
              name: finalName,
            });
          }
        } else if (Array.isArray(themeData.tags)) {
          tagsString = JSON.stringify(themeData.tags);
        }
      }

      // Validate optional fields
      const description =
        typeof themeData.description === "string" &&
        themeData.description.length <= 500
          ? themeData.description
          : null;

      const author =
        typeof themeData.author === "string" && themeData.author.length <= 100
          ? themeData.author
          : null;

      const version =
        typeof themeData.version === "string" && themeData.version.length <= 20
          ? themeData.version
          : "1.0.0";

      // Create theme with imported data
      const result = await db.insert(colorThemes).values({
        userId,
        name: finalName,
        colors: colorsString,
        description,
        author,
        version,
        tags: tagsString || null,
        isActive: false,
        isFavorite: false,
        duplicateCount: 0,
      });

      apiLogger.success(`Theme imported: ${finalName}`, {
        operation: "import_theme",
        userId,
        name: finalName,
      });

      res.status(201).json({
        message: "Theme imported successfully",
        id: result.lastInsertRowid,
        name: finalName,
      });
    } catch (err) {
      apiLogger.error("Failed to import theme", err, {
        operation: "import_theme",
        userId,
      });
      res.status(500).json({ error: "Failed to import theme" });
    }
  }
);

// Route: Export a theme with metadata
// GET /themes/:id/export
router.get(
  "/:id/export",
  authenticateJWT,
  async (req: Request, res: Response) => {
    const userId = req.userId;
    const themeId = parseInt(req.params.id);

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (isNaN(themeId)) {
      return res.status(400).json({ error: "Invalid theme ID" });
    }

    try {
      const db = getDb();
      const theme = await db
        .select()
        .from(colorThemes)
        .where(
          and(eq(colorThemes.id, themeId), eq(colorThemes.userId, userId))
        );

      if (!theme || theme.length === 0) {
        return res.status(404).json({ error: "Theme not found" });
      }

      // Parse colors string to object for export
      const colors =
        typeof theme[0].colors === "string"
          ? JSON.parse(theme[0].colors)
          : theme[0].colors;

      // Parse tags if present
      let tags: string[] = [];
      if (theme[0].tags) {
        try {
          tags =
            typeof theme[0].tags === "string"
              ? JSON.parse(theme[0].tags)
              : theme[0].tags;
        } catch {
          tags = [];
        }
      }

      // Create export-ready object
      const exportData = {
        name: theme[0].name,
        colors,
        description: theme[0].description || "",
        author: theme[0].author || "",
        version: theme[0].version || "1.0.0",
        tags,
        exported_at: new Date().toISOString(),
        exported_from: "Terminus",
      };

      res.json(exportData);
    } catch (err) {
      apiLogger.error("Failed to export theme", err, {
        operation: "export_theme",
        userId,
        themeId,
      });
      res.status(500).json({ error: "Failed to export theme" });
    }
  }
);

export default router;
