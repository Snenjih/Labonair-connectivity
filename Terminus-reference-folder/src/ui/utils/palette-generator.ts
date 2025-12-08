/**
 * Color Palette Generator
 * Generates harmonious color palettes based on color theory
 */

import { hexToRgb } from "./contrast-checker.ts";

export type PaletteType = "monochromatic" | "analogous" | "complementary" | "triadic";

interface HSL {
  h: number;
  s: number;
  l: number;
}

/**
 * Convert RGB to HSL
 */
function rgbToHsl(r: number, g: number, b: number): HSL {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * Convert HSL to RGB
 */
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h /= 360;
  s /= 100;
  l /= 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
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

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

/**
 * Convert RGB to hex
 */
function rgbToHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Generate color palette from base color
 * @param baseColor - Base color in hex format
 * @param type - Type of palette to generate
 * @returns Array of hex colors
 */
export function generatePalette(baseColor: string, type: PaletteType): string[] {
  const rgb = hexToRgb(baseColor);
  if (!rgb) return [baseColor];

  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const colors: string[] = [baseColor];

  switch (type) {
    case "monochromatic":
      // Same hue, different lightness
      for (let i = 1; i <= 5; i++) {
        const newL = Math.max(0, Math.min(100, hsl.l + (i - 2.5) * 20));
        const newRgb = hslToRgb(hsl.h, hsl.s, newL);
        colors.push(rgbToHex(newRgb.r, newRgb.g, newRgb.b));
      }
      break;

    case "analogous":
      // Adjacent hues (±30°)
      colors.push(
        rgbToHex(...Object.values(hslToRgb((hsl.h + 30) % 360, hsl.s, hsl.l))),
        rgbToHex(...Object.values(hslToRgb((hsl.h - 30 + 360) % 360, hsl.s, hsl.l)))
      );
      break;

    case "complementary":
      // Opposite hue (180°)
      const compRgb = hslToRgb((hsl.h + 180) % 360, hsl.s, hsl.l);
      colors.push(rgbToHex(compRgb.r, compRgb.g, compRgb.b));
      break;

    case "triadic":
      // Three evenly spaced hues (120° apart)
      for (let i = 1; i <= 2; i++) {
        const newH = (hsl.h + i * 120) % 360;
        const newRgb = hslToRgb(newH, hsl.s, hsl.l);
        colors.push(rgbToHex(newRgb.r, newRgb.g, newRgb.b));
      }
      break;
  }

  return colors;
}
