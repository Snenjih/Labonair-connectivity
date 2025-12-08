/**
 * WCAG Contrast Checker Utility
 *
 * Calculates color contrast ratios according to WCAG 2.1 guidelines.
 *
 * WCAG Standards:
 * - AA: 4.5:1 for normal text, 3:1 for large text (18pt+ or 14pt+ bold)
 * - AAA: 7:1 for normal text, 4.5:1 for large text
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface ContrastResult {
  ratio: number;
  level: "AAA" | "AA" | "AA Large" | "Fail";
  passes: boolean;
  passesBoldText: boolean;
  recommendation?: string;
}

/**
 * Convert hex color to RGB
 * @param hex - Hex color string (e.g., "#FF0000" or "FF0000")
 * @returns RGB object or null if invalid
 */
export function hexToRgb(hex: string): RGB | null {
  // Remove # if present
  hex = hex.replace(/^#/, "");

  // Handle 3-character hex codes
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((char) => char + char)
      .join("");
  }

  // Validate hex
  if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
    return null;
  }

  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  return { r, g, b };
}

/**
 * Calculate relative luminance of a color
 * Formula from WCAG 2.1: https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 * @param r - Red value (0-255)
 * @param g - Green value (0-255)
 * @param b - Blue value (0-255)
 * @returns Relative luminance (0-1)
 */
export function getLuminance(r: number, g: number, b: number): number {
  // Convert to 0-1 range
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });

  // Calculate luminance
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 * Formula from WCAG 2.1: (L1 + 0.05) / (L2 + 0.05)
 * where L1 is the lighter color and L2 is the darker color
 * @param color1 - First color (hex)
 * @param color2 - Second color (hex)
 * @returns Contrast ratio (1-21)
 */
export function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  if (!rgb1 || !rgb2) {
    return 0;
  }

  const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Get WCAG level based on contrast ratio
 * @param ratio - Contrast ratio
 * @returns WCAG level
 */
export function getWCAGLevel(ratio: number): "AAA" | "AA" | "AA Large" | "Fail" {
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "AA Large";
  return "Fail";
}

/**
 * Check color pair contrast and return detailed results
 * @param foreground - Foreground color (hex)
 * @param background - Background color (hex)
 * @returns Contrast result with recommendations
 */
export function checkColorPair(
  foreground: string,
  background: string,
): ContrastResult {
  const ratio = getContrastRatio(foreground, background);
  const level = getWCAGLevel(ratio);

  const passes = ratio >= 4.5; // AA standard for normal text
  const passesBoldText = ratio >= 3; // AA standard for large/bold text

  let recommendation: string | undefined;

  if (level === "AAA") {
    recommendation = "Excellent contrast! Great for accessibility.";
  } else if (level === "AA") {
    recommendation = "Good contrast. Meets WCAG AA standards.";
  } else if (level === "AA Large") {
    recommendation = "Acceptable for large or bold text only.";
  } else {
    recommendation =
      "Poor contrast. May be difficult to read. Consider adjusting colors.";
  }

  return {
    ratio: Math.round(ratio * 100) / 100,
    level,
    passes,
    passesBoldText,
    recommendation,
  };
}

/**
 * Format contrast ratio for display
 * @param ratio - Contrast ratio
 * @returns Formatted string (e.g., "4.52:1")
 */
export function formatContrastRatio(ratio: number): string {
  return `${ratio.toFixed(2)}:1`;
}

/**
 * Get recommended foreground color for a background
 * Returns black or white, whichever has better contrast
 * @param backgroundColor - Background color (hex)
 * @returns Recommended foreground color (hex)
 */
export function getRecommendedForeground(backgroundColor: string): string {
  const whiteRatio = getContrastRatio("#FFFFFF", backgroundColor);
  const blackRatio = getContrastRatio("#000000", backgroundColor);

  return whiteRatio > blackRatio ? "#FFFFFF" : "#000000";
}
