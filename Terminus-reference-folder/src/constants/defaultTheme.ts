/**
 * Default Theme Colors
 *
 * These are the default color values from the Terminus application.
 * This theme is always available, read-only, and cannot be deleted.
 */

export const DEFAULT_THEME_ID = -1; // Special ID for default theme

export const DEFAULT_THEME_COLORS = {
  // Base shadcn/ui Semantic Colors
  "--background": "oklch(0.141 0.005 285.823)", // Dark background
  "--foreground": "oklch(0.985 0 0)", // Light text
  "--card": "oklch(0.21 0.006 285.885)", // Dark card background
  "--card-foreground": "oklch(0.985 0 0)", // Light card text
  "--popover": "oklch(0.21 0.006 285.885)", // Dark popover background
  "--popover-foreground": "oklch(0.985 0 0)", // Light popover text

  // Interactive Colors
  "--primary": "oklch(0.92 0.004 286.32)", // Lighter primary for dark mode
  "--primary-foreground": "oklch(0.21 0.006 285.885)", // Dark text on primary
  "--secondary": "oklch(0.274 0.006 286.033)", // Muted secondary
  "--secondary-foreground": "oklch(0.985 0 0)", // Light text on secondary
  "--muted": "oklch(0.274 0.006 286.033)", // Dark muted background
  "--muted-foreground": "oklch(0.705 0.015 286.067)", // Muted gray text
  "--accent": "oklch(0.274 0.006 286.033)", // Dark accent
  "--accent-foreground": "oklch(0.985 0 0)", // Light text on accent

  // Status Colors
  "--destructive": "oklch(0.704 0.191 22.216)", // Softer red for dark mode
  "--border": "oklch(1 0 0 / 10%)", // Subtle light borders
  "--input": "oklch(1 0 0 / 15%)", // Slightly lighter input backgrounds
  "--ring": "oklch(0.552 0.016 285.938)", // Focus ring color

  // Custom Background Colors - Application-specific
  "--color-dark-bg": "#18181b", // Main application surface
  "--color-dark-bg-darker": "#0e0e10", // Sidebar & secondary panels
  "--color-dark-bg-darkest": "#09090b", // Terminal & code backgrounds
  "--color-dark-bg-input": "#222225", // Text inputs & form fields
  "--color-dark-bg-button": "#23232a", // Secondary button backgrounds
  "--color-dark-bg-active": "#1d1d1f", // Active/selected items
  "--color-dark-bg-header": "#131316", // Top navbar & headers
  "--color-dark-bg-light": "#141416", // Light variant surface
  "--color-dark-bg-very-light": "#101014", // Very light variant surface
  "--color-dark-bg-panel": "#1b1b1e", // Panel backgrounds
  "--color-dark-bg-panel-hover": "#232327", // Hovered panel backgrounds

  // Custom Border & State Colors
  "--color-dark-border": "#303032", // Panel & window borders
  "--color-dark-border-active": "#2d2d30", // Active element borders
  "--color-dark-border-hover": "#434345", // Hovered element borders
  "--color-dark-border-light": "#5a5a5d", // Light border variant
  "--color-dark-border-medium": "#373739", // Medium border variant
  "--color-dark-border-panel": "#222224", // Panel borders
  "--color-dark-hover": "#2d2d30", // Element hover backgrounds
  "--color-dark-hover-alt": "#2a2a2d", // Alternative hover state
  "--color-dark-active": "#2a2a2c", // Active element backgrounds
  "--color-dark-pressed": "#1a1a1c", // Pressed/clicked state

  // Brand Accent Colors
  "--accent-color": "#3b82f6", // Links & brand highlights
  "--accent-color-hover": "#2563eb", // Hovered brand elements
  "--accent-color-light": "#60a5fa", // Light accent variant
  "--accent-color-dark": "#1d4ed8", // Dark accent variant
};

export const DEFAULT_THEME = {
  id: DEFAULT_THEME_ID,
  name: "Default Theme",
  colors: DEFAULT_THEME_COLORS,
  isActive: false,
  userId: "system",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  author: "Terminus",
  description: "The default Terminus color scheme",
  isDefault: true, // Special flag to identify default theme
};
