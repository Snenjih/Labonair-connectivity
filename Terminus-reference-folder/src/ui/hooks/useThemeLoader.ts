import { useEffect } from "react";
import { getThemes } from "../main-axios";
import { systemLogger } from "../../lib/frontend-logger";

/**
 * Hook to load and apply the active theme after authentication
 * Fetches themes from the backend and applies CSS variables to the document root
 * @param isAuthenticated - Whether the user is currently authenticated
 */
export function useThemeLoader(isAuthenticated: boolean) {
  useEffect(() => {
    // Only load theme if user is authenticated
    if (!isAuthenticated) {
      return;
    }

    const loadAndApplyTheme = async () => {
      try {
        // Fetch all themes for the current user
        const themes = await getThemes();

        // Find the active theme
        const activeTheme = themes.find((theme) => theme.isActive);

        if (!activeTheme) {
          systemLogger.info("No active theme found, using default CSS variables");
          return;
        }

        // Parse the colors JSON
        const colors =
          typeof activeTheme.colors === "string"
            ? JSON.parse(activeTheme.colors)
            : activeTheme.colors;

        // Apply each color variable to the document root
        Object.entries(colors).forEach(([key, value]) => {
          if (typeof value === "string") {
            document.documentElement.style.setProperty(key, value);
          }
        });

        systemLogger.success(`Theme "${activeTheme.name}" loaded and applied`, {
          themeId: activeTheme.id,
          colorCount: Object.keys(colors).length,
        });
      } catch (error) {
        systemLogger.error("Failed to load active theme", error, {
          operation: "useThemeLoader",
        });
      }
    };

    loadAndApplyTheme();
  }, [isAuthenticated]); // Run when authentication state changes
}
