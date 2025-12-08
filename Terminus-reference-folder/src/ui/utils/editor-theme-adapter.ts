/**
 * Editor Theme Adapter
 *
 * Generates dynamic Monaco Editor and CodeMirror themes from application CSS variables.
 * This ensures code editors match the application's selected color scheme.
 */

import type { editor } from 'monaco-editor';
import { EditorView } from '@codemirror/view';
import { Extension } from '@codemirror/state';

/**
 * Reads a CSS variable value from the document root
 */
function getCSSVariable(name: string): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();

  // Convert OKLCH to hex if needed (for Monaco compatibility)
  if (value.startsWith('oklch(')) {
    // For now, return a fallback color
    // Full OKLCH conversion would require a color conversion library
    return convertOKLCHToHex(value);
  }

  return value;
}

/**
 * Simplified OKLCH to Hex converter
 * Returns fallback colors for common values
 */
function convertOKLCHToHex(oklch: string): string {
  // Extract lightness value for basic dark/light detection
  const match = oklch.match(/oklch\(([\d.]+)/);
  const lightness = match ? parseFloat(match[1]) : 0.5;

  // Return appropriate colors based on lightness
  if (lightness > 0.8) return '#f5f5f5'; // Very light
  if (lightness > 0.5) return '#e5e5e5'; // Light
  if (lightness > 0.3) return '#3a3a3a'; // Medium dark
  if (lightness > 0.15) return '#2a2a2a'; // Dark
  return '#1a1a1a'; // Very dark
}

/**
 * Converts any color format to hex
 */
function toHex(color: string): string {
  if (color.startsWith('#')) return color;
  if (color.startsWith('oklch(')) return convertOKLCHToHex(color);

  // For rgb/rgba, create a temporary element to get computed color
  const temp = document.createElement('div');
  temp.style.color = color;
  document.body.appendChild(temp);
  const computed = getComputedStyle(temp).color;
  document.body.removeChild(temp);

  // Convert rgb to hex
  const rgb = computed.match(/\d+/g);
  if (rgb && rgb.length >= 3) {
    return '#' + rgb.slice(0, 3).map(x => {
      const hex = parseInt(x).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }

  return '#1e1e1e'; // Fallback
}

/**
 * Generates a Monaco Editor theme from current CSS variables
 */
export function generateMonacoTheme(): editor.IStandaloneThemeData {
  const background = getCSSVariable('--color-dark-bg-darkest') || getCSSVariable('--background');
  const foreground = getCSSVariable('--foreground');
  const selection = getCSSVariable('--color-dark-bg-active') || getCSSVariable('--primary');
  const lineHighlight = getCSSVariable('--color-dark-bg-input') || getCSSVariable('--muted');
  const border = getCSSVariable('--color-dark-border') || getCSSVariable('--border');
  const comment = getCSSVariable('--color-muted-foreground') || getCSSVariable('--muted-foreground');
  const primary = getCSSVariable('--accent-color') || getCSSVariable('--primary');

  return {
    base: 'vs-dark', // Base theme to extend
    inherit: true,   // Inherit base theme rules
    rules: [
      { token: '', foreground: toHex(foreground).substring(1) },
      { token: 'comment', foreground: toHex(comment).substring(1), fontStyle: 'italic' },
      { token: 'keyword', foreground: toHex(primary).substring(1), fontStyle: 'bold' },
      { token: 'string', foreground: '98c379' }, // Green
      { token: 'number', foreground: 'd19a66' }, // Orange
      { token: 'function', foreground: '61afef' }, // Blue
      { token: 'variable', foreground: toHex(foreground).substring(1) },
      { token: 'type', foreground: 'e5c07b' }, // Yellow
    ],
    colors: {
      'editor.background': toHex(background),
      'editor.foreground': toHex(foreground),
      'editor.lineHighlightBackground': toHex(lineHighlight),
      'editor.selectionBackground': toHex(selection) + '40', // 25% opacity
      'editor.inactiveSelectionBackground': toHex(selection) + '20', // 12% opacity
      'editorLineNumber.foreground': toHex(comment),
      'editorLineNumber.activeForeground': toHex(foreground),
      'editorCursor.foreground': toHex(primary),
      'editor.findMatchBackground': toHex(primary) + '40',
      'editor.findMatchHighlightBackground': toHex(primary) + '20',
      'editorWidget.background': toHex(background),
      'editorWidget.border': toHex(border),
      'editorSuggestWidget.background': toHex(background),
      'editorSuggestWidget.border': toHex(border),
      'editorSuggestWidget.selectedBackground': toHex(selection),
      'editorHoverWidget.background': toHex(background),
      'editorHoverWidget.border': toHex(border),
    },
  };
}

/**
 * Generates a CodeMirror theme extension from current CSS variables
 */
export function generateCodeMirrorTheme(): Extension {
  const background = getCSSVariable('--color-dark-bg-darkest') || getCSSVariable('--background');
  const foreground = getCSSVariable('--foreground');
  const selection = getCSSVariable('--color-dark-bg-active') || getCSSVariable('--primary');
  const cursor = getCSSVariable('--accent-color') || getCSSVariable('--primary');
  const border = getCSSVariable('--color-dark-border') || getCSSVariable('--border');
  const comment = getCSSVariable('--color-muted-foreground') || getCSSVariable('--muted-foreground');

  return EditorView.theme({
    '&': {
      color: toHex(foreground),
      backgroundColor: toHex(background),
    },
    '.cm-content': {
      caretColor: toHex(cursor),
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: toHex(cursor),
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: toHex(selection) + '40', // 25% opacity
    },
    '.cm-activeLine': {
      backgroundColor: toHex(selection) + '20', // 12% opacity
    },
    '.cm-gutters': {
      backgroundColor: toHex(background),
      color: toHex(comment),
      border: 'none',
    },
    '.cm-activeLineGutter': {
      backgroundColor: toHex(selection) + '20',
      color: toHex(foreground),
    },
    '.cm-lineNumbers .cm-gutterElement': {
      color: toHex(comment),
    },
  }, { dark: true });
}

/**
 * Registers a custom Monaco theme with the current CSS variables
 * @param themeName - Name for the custom theme (default: 'terminus-dynamic')
 * @returns The theme name that was registered
 */
export function registerMonacoTheme(
  monaco: typeof import('monaco-editor'),
  themeName: string = 'terminus-dynamic'
): string {
  const themeData = generateMonacoTheme();
  monaco.editor.defineTheme(themeName, themeData);
  return themeName;
}
