import React, { useState, useEffect } from "react";
import { SketchPicker } from "react-color";
import { Button } from "./button";
import { Copy, RotateCcw, Check, AlertCircle, CheckCircle, Info } from "lucide-react";
import { checkColorPair, getContrastRatio, getWCAGLevel } from "@/ui/utils/contrast-checker.ts";
import { generatePalette, type PaletteType } from "@/ui/utils/palette-generator.ts";
import { ensureHex, resolveCssVariable } from "@/ui/utils/color-converters.ts";
import { cn } from "@/lib/utils.ts";

interface ColorPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  color: string;
  colorName: string;
  onColorChange: (color: string) => void;
  backgroundColor?: string; // For contrast checking
}

const RECENT_COLORS_KEY = "terminus_recent_colors";
const MAX_RECENT_COLORS = 12;

export const ColorPickerModal: React.FC<ColorPickerModalProps> = ({
  isOpen,
  onClose,
  color,
  colorName,
  onColorChange,
  backgroundColor = "#0a0a0a",
}) => {
  const [selectedColor, setSelectedColor] = useState<string>(() => {
    // Convert initial color to hex format for color picker compatibility
    const resolved = resolveCssVariable(color);
    return ensureHex(resolved);
  });
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"picker" | "harmony">("picker");
  const [showWcagTooltip, setShowWcagTooltip] = useState(false);

  useEffect(() => {
    // Convert color to hex format when it changes
    const resolved = resolveCssVariable(color);
    const hexColor = ensureHex(resolved);
    setSelectedColor(hexColor);
  }, [color]);

  useEffect(() => {
    if (isOpen) {
      loadRecentColors();
    }
  }, [isOpen]);

  const loadRecentColors = () => {
    try {
      const stored = localStorage.getItem(RECENT_COLORS_KEY);
      if (stored) {
        setRecentColors(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Failed to load recent colors:", error);
    }
  };

  const saveToRecent = (hex: string) => {
    try {
      const updated = [hex, ...recentColors.filter((c) => c !== hex)].slice(
        0,
        MAX_RECENT_COLORS
      );
      setRecentColors(updated);
      localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error("Failed to save recent color:", error);
    }
  };

  const handleChangeComplete = (color: any) => {
    const hex = color.hex;
    setSelectedColor(hex);
  };

  const handleSave = () => {
    onColorChange(selectedColor);
    saveToRecent(selectedColor);
    onClose();
  };

  const handleCancel = () => {
    setSelectedColor(color);
    onClose();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedColor);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    // Convert to hex when resetting
    const resolved = resolveCssVariable(color);
    const hexColor = ensureHex(resolved);
    setSelectedColor(hexColor);
  };

  // Calculate contrast ratio and WCAG level
  const contrastResult = checkColorPair(selectedColor, backgroundColor);
  const contrastRatio = getContrastRatio(selectedColor, backgroundColor);
  const wcagLevel = getWCAGLevel(contrastRatio);

  // Generate harmonious color palettes
  const monochromaticPalette = generatePalette(selectedColor, "monochromatic");
  const analogousPalette = generatePalette(selectedColor, "analogous");
  const complementaryPalette = generatePalette(selectedColor, "complementary");
  const triadicPalette = generatePalette(selectedColor, "triadic");

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{
        zIndex: "var(--z-popover)",
        backdropFilter: "blur(8px)",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
      }}
      onClick={handleCancel}
    >
      <div
        className="flex flex-col gap-4 rounded-lg border-2 border-[var(--color-dark-border)] bg-[var(--color-dark-bg)] p-6 shadow-2xl max-h-[90vh] overflow-y-auto max-w-[600px]"
        style={{ zIndex: "calc(var(--z-popover) + 1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Choose Color</h3>
            <p className="text-sm text-gray-400">
              {colorName.replace(/--/g, "").replace(/-/g, " ")}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopy}
              className="border-[var(--color-dark-border)] bg-[var(--color-dark-bg-button)] hover:bg-[var(--color-dark-hover)]"
              title="Copy hex code"
            >
              {copied ? (
                <Check className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleReset}
              className="border-[var(--color-dark-border)] bg-[var(--color-dark-bg-button)] hover:bg-[var(--color-dark-hover)]"
              title="Reset to original"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-[var(--color-dark-border)] pb-2">
          <button
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
              activeTab === "picker"
                ? "bg-[var(--color-primary)] text-white"
                : "text-gray-400 hover:text-white hover:bg-[var(--color-dark-hover)]"
            )}
            onClick={() => setActiveTab("picker")}
          >
            Color Picker
          </button>
          <button
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
              activeTab === "harmony"
                ? "bg-[var(--color-primary)] text-white"
                : "text-gray-400 hover:text-white hover:bg-[var(--color-dark-hover)]"
            )}
            onClick={() => setActiveTab("harmony")}
          >
            Harmony
          </button>
        </div>

        {/* Content */}
        {activeTab === "picker" && (
          <div className="flex flex-col gap-4">
            {/* Color Picker */}
            <div className="flex flex-col items-center gap-4">
              <SketchPicker
                color={selectedColor}
                onChangeComplete={handleChangeComplete}
                disableAlpha={false}
                presetColors={[
                  "#ffffff",
                  "#f5f5f5",
                  "#e5e5e5",
                  "#d4d4d4",
                  "#a3a3a3",
                  "#737373",
                  "#525252",
                  "#404040",
                  "#262626",
                  "#171717",
                  "#0a0a0a",
                  "#000000",
                  "#3b82f6",
                  "#8b5cf6",
                  "#ec4899",
                  "#ef4444",
                  "#f97316",
                  "#f59e0b",
                  "#eab308",
                  "#84cc16",
                  "#22c55e",
                  "#10b981",
                  "#14b8a6",
                  "#06b6d4",
                ]}
              />

              {/* Current Color Display */}
              <div className="flex w-full items-center gap-3 rounded-md border border-[var(--color-dark-border)] bg-[var(--color-dark-bg-input)] p-3">
                <div
                  className="h-12 w-12 flex-shrink-0 rounded-md border border-[var(--color-dark-border)]"
                  style={{ backgroundColor: selectedColor }}
                />
                <div className="flex flex-col">
                  <span className="text-xs text-gray-400">Current Color</span>
                  <span className="font-mono text-sm text-white">
                    {selectedColor}
                  </span>
                </div>
              </div>
            </div>

            {/* Contrast Checker */}
            <div className="border-t border-[var(--color-dark-border)] pt-4">
              <h4 className="text-sm font-semibold text-white mb-3">
                Accessibility Check
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Contrast Ratio:</span>
                  <span className="font-mono text-white">
                    {contrastRatio.toFixed(2)}:1
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400">WCAG Level:</span>
                    <div
                      className="relative"
                      onMouseEnter={() => setShowWcagTooltip(true)}
                      onMouseLeave={() => setShowWcagTooltip(false)}
                    >
                      <Info className="w-4 h-4 text-gray-400 hover:text-white cursor-help transition-colors" />
                      {showWcagTooltip && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-[var(--color-dark-bg)] border border-[var(--color-dark-border)] rounded-md shadow-xl" style={{ zIndex: "var(--z-tooltip)" }}>
                          <div className="text-xs text-white space-y-2">
                            <p className="font-semibold">WCAG Contrast Levels:</p>
                            <p><span className="text-green-500">AAA</span>: 7:1+ (Best accessibility)</p>
                            <p><span className="text-green-500">AA</span>: 4.5:1+ (Good accessibility)</p>
                            <p><span className="text-yellow-500">AA Large</span>: 3:1+ (Large text only)</p>
                            <p><span className="text-yellow-500">Fail</span>: Below 3:1 (Poor contrast)</p>
                          </div>
                          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-[var(--color-dark-border)]"></div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {wcagLevel === "AAA" || wcagLevel === "AA" ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-yellow-500" />
                    )}
                    <span
                      className={cn(
                        "font-semibold",
                        wcagLevel === "AAA" || wcagLevel === "AA"
                          ? "text-green-500"
                          : "text-yellow-500"
                      )}
                    >
                      {wcagLevel}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-gray-400 mt-2">
                  {contrastResult.normalText ? "✓" : "✗"} Normal Text (4.5:1) •{" "}
                  {contrastResult.largeText ? "✓" : "✗"} Large Text (3:1)
                </div>
              </div>
            </div>

            {/* Recent Colors */}
            {recentColors.length > 0 && (
              <div className="border-t border-[var(--color-dark-border)] pt-4">
                <h4 className="text-sm font-semibold text-white mb-3">
                  Recent Colors
                </h4>
                <div className="grid grid-cols-6 gap-2">
                  {recentColors.map((recentColor, index) => (
                    <button
                      key={index}
                      className="h-10 w-full rounded border-2 border-[var(--color-dark-border)] hover:border-[var(--color-primary)] transition-colors"
                      style={{ backgroundColor: recentColor }}
                      onClick={() => setSelectedColor(recentColor)}
                      title={recentColor}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "harmony" && (
          <div className="flex flex-col gap-4">
            {/* Monochromatic */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-2">
                Monochromatic
              </h4>
              <p className="text-xs text-gray-400 mb-3">
                Same hue, different lightness
              </p>
              <div className="grid grid-cols-6 gap-2">
                {monochromaticPalette.map((paletteColor, index) => (
                  <button
                    key={index}
                    className="h-12 w-full rounded border-2 border-[var(--color-dark-border)] hover:border-[var(--color-primary)] transition-colors"
                    style={{ backgroundColor: paletteColor }}
                    onClick={() => setSelectedColor(paletteColor)}
                    title={paletteColor}
                  />
                ))}
              </div>
            </div>

            {/* Analogous */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-2">
                Analogous
              </h4>
              <p className="text-xs text-gray-400 mb-3">
                Adjacent hues (±30°)
              </p>
              <div className="grid grid-cols-3 gap-2">
                {analogousPalette.map((paletteColor, index) => (
                  <button
                    key={index}
                    className="h-12 w-full rounded border-2 border-[var(--color-dark-border)] hover:border-[var(--color-primary)] transition-colors"
                    style={{ backgroundColor: paletteColor }}
                    onClick={() => setSelectedColor(paletteColor)}
                    title={paletteColor}
                  />
                ))}
              </div>
            </div>

            {/* Complementary */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-2">
                Complementary
              </h4>
              <p className="text-xs text-gray-400 mb-3">
                Opposite hue (180°)
              </p>
              <div className="grid grid-cols-2 gap-2">
                {complementaryPalette.map((paletteColor, index) => (
                  <button
                    key={index}
                    className="h-12 w-full rounded border-2 border-[var(--color-dark-border)] hover:border-[var(--color-primary)] transition-colors"
                    style={{ backgroundColor: paletteColor }}
                    onClick={() => setSelectedColor(paletteColor)}
                    title={paletteColor}
                  />
                ))}
              </div>
            </div>

            {/* Triadic */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-2">Triadic</h4>
              <p className="text-xs text-gray-400 mb-3">
                Three evenly spaced hues (120° apart)
              </p>
              <div className="grid grid-cols-3 gap-2">
                {triadicPalette.map((paletteColor, index) => (
                  <button
                    key={index}
                    className="h-12 w-full rounded border-2 border-[var(--color-dark-border)] hover:border-[var(--color-primary)] transition-colors"
                    style={{ backgroundColor: paletteColor }}
                    onClick={() => setSelectedColor(paletteColor)}
                    title={paletteColor}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-[var(--color-dark-border)] pt-4">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="border-[var(--color-dark-border)] bg-[var(--color-dark-bg-button)] hover:bg-[var(--color-dark-hover)]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            Apply
          </Button>
        </div>
      </div>
    </div>
  );
};
