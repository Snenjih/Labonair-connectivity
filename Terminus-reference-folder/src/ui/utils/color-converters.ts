/**
 * Color conversion utilities to handle OKLCH, RGB, HSL, and Hex formats
 * Ensures compatibility between CSS variables and color picker libraries
 */

/**
 * Converts various color formats to Hex
 * Supports: OKLCH, RGB, RGBA, HSL, HSLA, and Hex formats
 * @param color - Color string in any supported format
 * @returns Hex color string (e.g., "#RRGGBB")
 */
export function ensureHex(color: string): string {
  if (!color || typeof color !== "string") {
    return "#000000"; // Default to black for invalid input
  }

  const trimmedColor = color.trim();

  // Already a hex color
  if (/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(trimmedColor)) {
    // If it has alpha channel, strip it for compatibility with most color pickers
    return trimmedColor.length === 9 ? trimmedColor.substring(0, 7) : trimmedColor;
  }

  // Handle OKLCH format: oklch(L C H) or oklch(L C H / A)
  if (trimmedColor.startsWith("oklch(")) {
    return oklchToHex(trimmedColor);
  }

  // Handle RGB/RGBA format
  if (trimmedColor.startsWith("rgb(") || trimmedColor.startsWith("rgba(")) {
    return rgbToHex(trimmedColor);
  }

  // Handle HSL/HSLA format
  if (trimmedColor.startsWith("hsl(") || trimmedColor.startsWith("hsla(")) {
    return hslToHex(trimmedColor);
  }

  // If we can't parse it, try to get the computed color from a temporary element
  try {
    const tempDiv = document.createElement("div");
    tempDiv.style.color = trimmedColor;
    document.body.appendChild(tempDiv);
    const computed = window.getComputedStyle(tempDiv).color;
    document.body.removeChild(tempDiv);

    if (computed && computed !== trimmedColor) {
      return rgbToHex(computed);
    }
  } catch (error) {
    console.warn(`Could not convert color: ${color}`, error);
  }

  // Fallback to black
  return "#000000";
}

/**
 * Converts OKLCH to Hex
 * Note: This is a simplified conversion. For accurate color space conversion,
 * consider using a library like `culori` or `color.js`
 */
function oklchToHex(oklch: string): string {
  try {
    // Extract values from oklch(L C H) or oklch(L C H / A)
    const match = oklch.match(/oklch\(\s*([0-9.]+%?)\s+([0-9.]+)\s+([0-9.]+)(deg)?\s*(?:\/\s*([0-9.]+%?))?\s*\)/);

    if (!match) {
      return "#000000";
    }

    let [, lStr, cStr, hStr] = match;

    // Convert percentage lightness to 0-1 range
    let l = lStr.endsWith("%") ? parseFloat(lStr) / 100 : parseFloat(lStr);
    let c = parseFloat(cStr);
    let h = parseFloat(hStr);

    // Simplified OKLCH to sRGB conversion
    // For production, use a proper color space conversion library
    // This is a rough approximation

    // Convert OKLCH to LAB (approximation)
    const L = l * 100;
    const a = c * Math.cos((h * Math.PI) / 180);
    const b = c * Math.sin((h * Math.PI) / 180);

    // Convert LAB to XYZ to RGB (simplified)
    const rgb = labToRgb(L, a, b);

    return rgbArrayToHex(rgb);
  } catch (error) {
    console.warn(`Failed to convert OKLCH to Hex: ${oklch}`, error);
    return "#000000";
  }
}

/**
 * Simplified LAB to RGB conversion
 */
function labToRgb(L: number, a: number, b: number): [number, number, number] {
  // This is a simplified conversion
  // For accurate conversion, use a proper color science library

  // LAB to XYZ
  let y = (L + 16) / 116;
  let x = a / 500 + y;
  let z = y - b / 200;

  const xyzToRgbComponent = (t: number) => {
    return t > 0.008856 ? Math.pow(t, 3) : (t - 16 / 116) / 7.787;
  };

  x = 95.047 * xyzToRgbComponent(x);
  y = 100.000 * xyzToRgbComponent(y);
  z = 108.883 * xyzToRgbComponent(z);

  // XYZ to RGB
  x = x / 100;
  y = y / 100;
  z = z / 100;

  let r = x * 3.2406 + y * -1.5372 + z * -0.4986;
  let g = x * -0.9689 + y * 1.8758 + z * 0.0415;
  let bl = x * 0.0557 + y * -0.2040 + z * 1.0570;

  const rgbGamma = (t: number) => {
    return t > 0.0031308 ? 1.055 * Math.pow(t, 1 / 2.4) - 0.055 : 12.92 * t;
  };

  r = Math.max(0, Math.min(1, rgbGamma(r)));
  g = Math.max(0, Math.min(1, rgbGamma(g)));
  bl = Math.max(0, Math.min(1, rgbGamma(bl)));

  return [
    Math.round(r * 255),
    Math.round(g * 255),
    Math.round(bl * 255),
  ];
}

/**
 * Converts RGB/RGBA to Hex
 */
function rgbToHex(rgb: string): string {
  const match = rgb.match(/rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*(?:,\s*([0-9.]+))?\s*\)/);

  if (!match) {
    return "#000000";
  }

  const r = Math.round(parseFloat(match[1]));
  const g = Math.round(parseFloat(match[2]));
  const b = Math.round(parseFloat(match[3]));

  return rgbArrayToHex([r, g, b]);
}

/**
 * Converts HSL/HSLA to Hex
 */
function hslToHex(hsl: string): string {
  const match = hsl.match(/hsla?\(\s*([0-9.]+)(deg)?\s*,\s*([0-9.]+)%\s*,\s*([0-9.]+)%\s*(?:,\s*([0-9.]+))?\s*\)/);

  if (!match) {
    return "#000000";
  }

  let h = parseFloat(match[1]) / 360;
  const s = parseFloat(match[3]) / 100;
  const l = parseFloat(match[4]) / 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l; // Achromatic
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return rgbArrayToHex([
    Math.round(r * 255),
    Math.round(g * 255),
    Math.round(b * 255),
  ]);
}

/**
 * Converts RGB array to Hex string
 */
function rgbArrayToHex(rgb: [number, number, number]): string {
  const componentToHex = (c: number) => {
    const hex = Math.max(0, Math.min(255, c)).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return `#${componentToHex(rgb[0])}${componentToHex(rgb[1])}${componentToHex(rgb[2])}`;
}

/**
 * Validates if a string is a valid hex color
 */
export function isValidHex(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(color);
}

/**
 * Extracts color value from CSS variable or returns as-is
 * Handles cases like "var(--color-name)" by resolving the CSS variable
 */
export function resolveCssVariable(value: string): string {
  if (!value || typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  // Check if it's a CSS variable reference: var(--variable-name)
  const varMatch = trimmed.match(/var\(\s*(--[a-zA-Z0-9-]+)\s*\)/);

  if (varMatch) {
    const varName = varMatch[1];
    // Get the computed value from the document root
    const computedValue = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    return computedValue || value;
  }

  return value;
}
