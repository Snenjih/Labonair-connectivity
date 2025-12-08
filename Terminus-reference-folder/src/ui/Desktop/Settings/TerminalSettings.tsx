import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Slider } from "@/components/ui/slider.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { getSetting, saveSetting, getCookie, setCookie } from "@/ui/main-axios.ts";
import { useTabs } from "@/ui/Desktop/Navigation/Tabs/TabContext.tsx";
import { useTranslation } from "react-i18next";

interface TerminalSettingsProps {}

export function TerminalSettings({}: TerminalSettingsProps) {
  const { t } = useTranslation();
  const { tabs } = useTabs() as any;
  const [fontSize, setFontSize] = useState<string>("14");
  const [letterSpacing, setLetterSpacing] = useState<string>("0");
  const [lineHeight, setLineHeight] = useState<string>("1.2");
  const [fontFamily, setFontFamily] = useState<string>("Caskaydia Cove Nerd Font Mono");
  const [scrollback, setScrollback] = useState<number>(10000);
  const [cursorStyle, setCursorStyle] = useState<string>("block");
  const [cursorBlink, setCursorBlink] = useState<boolean>(true);
  const [sessionRestore, setSessionRestore] = useState<boolean>(true);
  const [autoOpenLocal, setAutoOpenLocal] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedTabIds, setSelectedTabIds] = useState<number[]>([]);

  useEffect(() => {
    loadFontSizeSetting();
    loadLetterSpacingSetting();
    loadLineHeightSetting();
    loadFontFamilySetting();
    loadScrollbackSetting();
    loadCursorStyleSetting();
    loadCursorBlinkSetting();
    loadSessionRestoreSetting();
    loadAutoOpenLocalSetting();
  }, []);

  const loadFontSizeSetting = async () => {
    try {
      setIsLoading(true);
      const response = await getSetting("terminal_font_size");
      setFontSize(response.value || "14");
    } catch (error) {
      console.error("Failed to load terminal font size setting:", error);
      // Default to 14 if setting doesn't exist
      setFontSize("14");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow numbers
    if (value === "" || /^\d+$/.test(value)) {
      setFontSize(value);
    }
  };

  const handleFontSizeBlur = async () => {
    // Validate and constrain the value
    let numericValue = parseInt(fontSize, 10);

    if (isNaN(numericValue) || fontSize === "") {
      numericValue = 14;
    } else if (numericValue < 8) {
      numericValue = 8;
    } else if (numericValue > 32) {
      numericValue = 32;
    }

    const finalValue = numericValue.toString();
    setFontSize(finalValue);

    try {
      setIsSaving(true);
      await saveSetting("terminal_font_size", finalValue);
    } catch (error) {
      console.error("Failed to save terminal font size setting:", error);
      // Revert on error
      await loadFontSizeSetting();
    } finally {
      setIsSaving(false);
    }
  };

  const loadLetterSpacingSetting = async () => {
    try {
      const response = await getSetting("terminal_letter_spacing");
      setLetterSpacing(response.value || "0");
    } catch (error) {
      console.error("Failed to load letter spacing setting:", error);
      setLetterSpacing("0");
    }
  };

  const handleLetterSpacingChange = async (value: number[]) => {
    const newValue = value[0].toString();
    setLetterSpacing(newValue);
    try {
      await saveSetting("terminal_letter_spacing", newValue);
    } catch (error) {
      console.error("Failed to save letter spacing setting:", error);
      await loadLetterSpacingSetting();
    }
  };

  const loadLineHeightSetting = async () => {
    try {
      const response = await getSetting("terminal_line_height");
      setLineHeight(response.value || "1.2");
    } catch (error) {
      console.error("Failed to load line height setting:", error);
      setLineHeight("1.2");
    }
  };

  const handleLineHeightChange = async (value: number[]) => {
    const newValue = value[0].toFixed(1);
    setLineHeight(newValue);
    try {
      await saveSetting("terminal_line_height", newValue);
    } catch (error) {
      console.error("Failed to save line height setting:", error);
      await loadLineHeightSetting();
    }
  };

  const loadFontFamilySetting = async () => {
    try {
      const response = await getSetting("terminal_font_family");
      setFontFamily(response.value || "Caskaydia Cove Nerd Font Mono");
    } catch (error) {
      console.error("Failed to load font family setting:", error);
      setFontFamily("Caskaydia Cove Nerd Font Mono");
    }
  };

  const handleFontFamilyChange = async (value: string) => {
    setFontFamily(value);
    try {
      await saveSetting("terminal_font_family", value);
    } catch (error) {
      console.error("Failed to save font family setting:", error);
      await loadFontFamilySetting();
    }
  };

  const loadScrollbackSetting = async () => {
    try {
      const response = await getSetting("terminal_scrollback_lines");
      setScrollback(parseInt(response.value, 10) || 10000);
    } catch (error) {
      console.error("Failed to load scrollback setting:", error);
      setScrollback(10000);
    }
  };

  const handleScrollbackChange = async (value: number[]) => {
    const newValue = value[0];
    setScrollback(newValue);
    try {
      await saveSetting("terminal_scrollback_lines", newValue.toString());
    } catch (error) {
      console.error("Failed to save scrollback setting:", error);
      await loadScrollbackSetting();
    }
  };

  const loadCursorStyleSetting = async () => {
    try {
      const response = await getSetting("terminal_cursor_style");
      setCursorStyle(response.value || "block");
    } catch (error) {
      console.error("Failed to load cursor style setting:", error);
      // Default to block if setting doesn't exist
      setCursorStyle("block");
    }
  };

  const handleCursorStyleChange = async (value: string) => {
    setCursorStyle(value);
    try {
      await saveSetting("terminal_cursor_style", value);
    } catch (error) {
      console.error("Failed to save cursor style setting:", error);
      // Revert on error
      await loadCursorStyleSetting();
    }
  };

  const loadCursorBlinkSetting = async () => {
    try {
      const response = await getSetting("terminal_cursor_blink");
      setCursorBlink(response.value === "true" || response.value === undefined);
    } catch (error) {
      console.error("Failed to load cursor blink setting:", error);
      // Default to true if setting doesn't exist
      setCursorBlink(true);
    }
  };

  const handleCursorBlinkChange = async (value: boolean) => {
    setCursorBlink(value);
    try {
      await saveSetting("terminal_cursor_blink", value.toString());
    } catch (error) {
      console.error("Failed to save cursor blink setting:", error);
      // Revert on error
      await loadCursorBlinkSetting();
    }
  };

  const loadSessionRestoreSetting = async () => {
    try {
      const response = await getSetting("terminal_restore_sessions");
      setSessionRestore(response.value === "true" || response.value === undefined);
    } catch (error) {
      console.error("Failed to load session restore setting:", error);
      // Default to true if setting doesn't exist
      setSessionRestore(true);
    }
  };

  const handleSessionRestoreChange = async (value: boolean) => {
    setSessionRestore(value);
    try {
      await saveSetting("terminal_restore_sessions", value.toString());
    } catch (error) {
      console.error("Failed to save session restore setting:", error);
      // Revert on error
      await loadSessionRestoreSetting();
    }
  };

  const loadAutoOpenLocalSetting = async () => {
    try {
      const response = await getSetting("terminal_auto_open_local");
      setAutoOpenLocal(response.value === "true");
    } catch (error) {
      console.error("Failed to load auto-open local terminal setting:", error);
      // Default to false if setting doesn't exist
      setAutoOpenLocal(false);
    }
  };

  const handleAutoOpenLocalChange = async (value: boolean) => {
    setAutoOpenLocal(value);
    try {
      await saveSetting("terminal_auto_open_local", value.toString());
    } catch (error) {
      console.error("Failed to save auto-open local terminal setting:", error);
      // Revert on error
      await loadAutoOpenLocalSetting();
    }
  };

  const terminalTabs = tabs.filter((tab: any) => tab.type === "terminal");

  const handleTabToggle = (tabId: number) => {
    setSelectedTabIds((prev) =>
      prev.includes(tabId)
        ? prev.filter((id) => id !== tabId)
        : [...prev, tabId],
    );
  };

  const handleStartRecording = () => {
    setIsRecording(true);
    setTimeout(() => {
      const input = document.getElementById(
        "terminal-settings-input",
      ) as HTMLInputElement;
      if (input) input.focus();
    }, 100);
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    setSelectedTabIds([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (selectedTabIds.length === 0) return;

    let commandToSend = "";

    if (e.ctrlKey || e.metaKey) {
      if (e.key === "c") {
        commandToSend = "\x03";
        e.preventDefault();
      } else if (e.key === "d") {
        commandToSend = "\x04";
        e.preventDefault();
      } else if (e.key === "l") {
        commandToSend = "\x0c";
        e.preventDefault();
      } else if (e.key === "u") {
        commandToSend = "\x15";
        e.preventDefault();
      } else if (e.key === "k") {
        commandToSend = "\x0b";
        e.preventDefault();
      } else if (e.key === "a") {
        commandToSend = "\x01";
        e.preventDefault();
      } else if (e.key === "e") {
        commandToSend = "\x05";
        e.preventDefault();
      } else if (e.key === "w") {
        commandToSend = "\x17";
        e.preventDefault();
      }
    } else if (e.key === "Enter") {
      commandToSend = "\n";
      e.preventDefault();
    } else if (e.key === "Backspace") {
      commandToSend = "\x08";
      e.preventDefault();
    } else if (e.key === "Delete") {
      commandToSend = "\x7f";
      e.preventDefault();
    } else if (e.key === "Tab") {
      commandToSend = "\x09";
      e.preventDefault();
    } else if (e.key === "Escape") {
      commandToSend = "\x1b";
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      commandToSend = "\x1b[A";
      e.preventDefault();
    } else if (e.key === "ArrowDown") {
      commandToSend = "\x1b[B";
      e.preventDefault();
    } else if (e.key === "ArrowLeft") {
      commandToSend = "\x1b[D";
      e.preventDefault();
    } else if (e.key === "ArrowRight") {
      commandToSend = "\x1b[C";
      e.preventDefault();
    } else if (e.key === "Home") {
      commandToSend = "\x1b[H";
      e.preventDefault();
    } else if (e.key === "End") {
      commandToSend = "\x1b[F";
      e.preventDefault();
    } else if (e.key === "PageUp") {
      commandToSend = "\x1b[5~";
      e.preventDefault();
    } else if (e.key === "PageDown") {
      commandToSend = "\x1b[6~";
      e.preventDefault();
    } else if (e.key === "Insert") {
      commandToSend = "\x1b[2~";
      e.preventDefault();
    } else if (e.key === "F1") {
      commandToSend = "\x1bOP";
      e.preventDefault();
    } else if (e.key === "F2") {
      commandToSend = "\x1bOQ";
      e.preventDefault();
    } else if (e.key === "F3") {
      commandToSend = "\x1bOR";
      e.preventDefault();
    } else if (e.key === "F4") {
      commandToSend = "\x1bOS";
      e.preventDefault();
    } else if (e.key === "F5") {
      commandToSend = "\x1b[15~";
      e.preventDefault();
    } else if (e.key === "F6") {
      commandToSend = "\x1b[17~";
      e.preventDefault();
    } else if (e.key === "F7") {
      commandToSend = "\x1b[18~";
      e.preventDefault();
    } else if (e.key === "F8") {
      commandToSend = "\x1b[19~";
      e.preventDefault();
    } else if (e.key === "F9") {
      commandToSend = "\x1b[20~";
      e.preventDefault();
    } else if (e.key === "F10") {
      commandToSend = "\x1b[21~";
      e.preventDefault();
    } else if (e.key === "F11") {
      commandToSend = "\x1b[23~";
      e.preventDefault();
    } else if (e.key === "F12") {
      commandToSend = "\x1b[24~";
      e.preventDefault();
    }

    if (commandToSend) {
      selectedTabIds.forEach((tabId) => {
        const tab = tabs.find((t: any) => t.id === tabId);
        if (tab?.terminalRef?.current?.sendInput) {
          tab.terminalRef.current.sendInput(commandToSend);
        }
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (selectedTabIds.length === 0) return;

    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      const char = e.key;
      selectedTabIds.forEach((tabId) => {
        const tab = tabs.find((t: any) => t.id === tabId);
        if (tab?.terminalRef?.current?.sendInput) {
          tab.terminalRef.current.sendInput(char);
        }
      });
    }
  };

  const updateRightClickCopyPaste = (checked: boolean) => {
    setCookie("rightClickCopyPaste", checked.toString());
  };

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-white">Terminal Settings</h2>
        <p className="text-sm text-gray-400">
          Configure terminal behavior and appearance
        </p>
      </div>

      {/* Terminal Preview */}
      <div className="p-4 rounded-lg bg-[var(--color-sidebar-bg)] border border-[var(--color-dark-border)]">
        <div className="space-y-3">
          <label className="text-sm font-medium text-white">Theme Preview</label>
          <div
            className="p-4 rounded border border-[var(--color-dark-border)] font-mono"
            style={{
              backgroundColor: "var(--color-dark-bg)",
              color: "var(--color-text)",
              fontSize: `${fontSize}px`,
              letterSpacing: `${letterSpacing}px`,
              lineHeight: lineHeight,
              fontFamily: fontFamily,
              userSelect: "none",
            }}
          >
            <div style={{ color: "var(--color-primary)" }}>
              <span style={{ color: "#4ade80" }}>user@terminus</span>
              <span>:</span>
              <span style={{ color: "#818cf8" }}>~</span>
              <span>$ ls -la</span>
            </div>
            <div>
              <span style={{ color: "#818cf8" }}>drwxr-xr-x</span>
              <span> 5 user </span>
              <span style={{ color: "#22d3ee" }}>docs</span>
            </div>
            <div>
              <span style={{ color: "#4ade80" }}>-rwxr-xr-x</span>
              <span> 1 user </span>
              <span style={{ color: "#4ade80" }}>script.sh</span>
            </div>
            <div>
              <span>-rw-r--r-- 1 user README.md</span>
            </div>
            <div style={{ color: "var(--color-primary)" }}>
              <span style={{ color: "#4ade80" }}>user@terminus</span>
              <span>:</span>
              <span style={{ color: "#818cf8" }}>~</span>
              <span>$ </span>
              <span
                className="inline-block w-2 bg-white"
                style={{
                  animation: "blink 1s steps(1) infinite",
                }}
              >
                &nbsp;
              </span>
            </div>
          </div>
        </div>
      </div>

      <style>
        {`
          @keyframes blink {
            0%, 49% { opacity: 1; }
            50%, 100% { opacity: 0; }
          }
        `}
      </style>

      {/* Settings Section */}
      <div className="space-y-4">
        {/* Font Size Setting */}
        <div className="p-4 rounded-lg bg-[var(--color-sidebar-bg)] border border-[var(--color-dark-border)]">
          <div className="space-y-3">
            <div className="space-y-0.5">
              <label className="text-sm font-medium text-white">
                Font Size
              </label>
              <p className="text-xs text-gray-400">
                Set the terminal font size in pixels (8-32)
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Slider
                value={[parseInt(fontSize, 10) || 14]}
                onValueChange={(value) => setFontSize(value[0].toString())}
                onValueCommit={async (value) => {
                  const newValue = value[0].toString();
                  try {
                    await saveSetting("terminal_font_size", newValue);
                  } catch (error) {
                    console.error("Failed to save font size:", error);
                    await loadFontSizeSetting();
                  }
                }}
                min={8}
                max={32}
                step={1}
                className="flex-1"
              />
              <span className="text-sm text-gray-400 w-12 text-right">
                {fontSize}px
              </span>
            </div>
          </div>
        </div>

        {/* Letter Spacing Setting */}
        <div className="p-4 rounded-lg bg-[var(--color-sidebar-bg)] border border-[var(--color-dark-border)]">
          <div className="space-y-3">
            <div className="space-y-0.5">
              <label className="text-sm font-medium text-white">
                Letter Spacing
              </label>
              <p className="text-xs text-gray-400">
                Adjust spacing between characters (-2px to 4px)
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Slider
                value={[parseFloat(letterSpacing)]}
                onValueChange={(value) => setLetterSpacing(value[0].toString())}
                onValueCommit={handleLetterSpacingChange}
                min={-2}
                max={4}
                step={0.5}
                className="flex-1"
              />
              <span className="text-sm text-gray-400 w-12 text-right">
                {letterSpacing}px
              </span>
            </div>
          </div>
        </div>

        {/* Line Height Setting */}
        <div className="p-4 rounded-lg bg-[var(--color-sidebar-bg)] border border-[var(--color-dark-border)]">
          <div className="space-y-3">
            <div className="space-y-0.5">
              <label className="text-sm font-medium text-white">
                Line Height
              </label>
              <p className="text-xs text-gray-400">
                Adjust spacing between lines (1.0 to 2.0)
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Slider
                value={[parseFloat(lineHeight)]}
                onValueChange={(value) => setLineHeight(value[0].toFixed(1))}
                onValueCommit={handleLineHeightChange}
                min={1.0}
                max={2.0}
                step={0.1}
                className="flex-1"
              />
              <span className="text-sm text-gray-400 w-12 text-right">
                {lineHeight}
              </span>
            </div>
          </div>
        </div>

        {/* Font Family Setting */}
        <div className="p-4 rounded-lg bg-[var(--color-sidebar-bg)] border border-[var(--color-dark-border)]">
          <div className="space-y-3">
            <div className="space-y-0.5">
              <label className="text-sm font-medium text-white">
                Font Family
              </label>
              <p className="text-xs text-gray-400">
                Choose the terminal font family
              </p>
            </div>
            <Select
              value={fontFamily}
              onValueChange={handleFontFamilyChange}
              disabled={isLoading}
            >
              <SelectTrigger className="w-full bg-[var(--color-dark-bg)] border-[var(--color-dark-border)] text-gray-300">
                <SelectValue placeholder="Select font family" />
              </SelectTrigger>
              <SelectContent className="bg-[var(--color-dark-bg)] border-[var(--color-dark-border)]">
                <SelectItem
                  value="Caskaydia Cove Nerd Font Mono"
                  className="text-gray-300 hover:bg-[var(--color-sidebar-accent)] hover:text-white focus:bg-[var(--color-sidebar-accent)] focus:text-white"
                >
                  Caskaydia Cove Nerd Font Mono
                </SelectItem>
                <SelectItem
                  value="JetBrains Mono"
                  className="text-gray-300 hover:bg-[var(--color-sidebar-accent)] hover:text-white focus:bg-[var(--color-sidebar-accent)] focus:text-white"
                >
                  JetBrains Mono
                </SelectItem>
                <SelectItem
                  value="Fira Code"
                  className="text-gray-300 hover:bg-[var(--color-sidebar-accent)] hover:text-white focus:bg-[var(--color-sidebar-accent)] focus:text-white"
                >
                  Fira Code
                </SelectItem>
                <SelectItem
                  value="Cascadia Code"
                  className="text-gray-300 hover:bg-[var(--color-sidebar-accent)] hover:text-white focus:bg-[var(--color-sidebar-accent)] focus:text-white"
                >
                  Cascadia Code
                </SelectItem>
                <SelectItem
                  value="Source Code Pro"
                  className="text-gray-300 hover:bg-[var(--color-sidebar-accent)] hover:text-white focus:bg-[var(--color-sidebar-accent)] focus:text-white"
                >
                  Source Code Pro
                </SelectItem>
                <SelectItem
                  value="SF Mono"
                  className="text-gray-300 hover:bg-[var(--color-sidebar-accent)] hover:text-white focus:bg-[var(--color-sidebar-accent)] focus:text-white"
                >
                  SF Mono
                </SelectItem>
                <SelectItem
                  value="Consolas"
                  className="text-gray-300 hover:bg-[var(--color-sidebar-accent)] hover:text-white focus:bg-[var(--color-sidebar-accent)] focus:text-white"
                >
                  Consolas
                </SelectItem>
                <SelectItem
                  value="Monaco"
                  className="text-gray-300 hover:bg-[var(--color-sidebar-accent)] hover:text-white focus:bg-[var(--color-sidebar-accent)] focus:text-white"
                >
                  Monaco
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Scrollback Buffer Setting */}
        <div className="p-4 rounded-lg bg-[var(--color-sidebar-bg)] border border-[var(--color-dark-border)]">
          <div className="space-y-3">
            <div className="space-y-0.5">
              <label className="text-sm font-medium text-white">
                Scrollback Buffer
              </label>
              <p className="text-xs text-gray-400">
                Number of lines to keep in terminal history (1,000-50,000)
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Slider
                value={[scrollback]}
                onValueChange={(value) => setScrollback(value[0])}
                onValueCommit={handleScrollbackChange}
                min={1000}
                max={50000}
                step={1000}
                className="flex-1"
              />
              <span className="text-sm text-gray-400 w-20 text-right">
                {scrollback.toLocaleString()} lines
              </span>
            </div>
          </div>
        </div>

        {/* Cursor Style Setting */}
        <div className="p-4 rounded-lg bg-[var(--color-sidebar-bg)] border border-[var(--color-dark-border)]">
          <div className="space-y-3">
            <div className="space-y-0.5">
              <label className="text-sm font-medium text-white">
                Cursor Style
              </label>
              <p className="text-xs text-gray-400">
                Choose the visual style of the terminal cursor
              </p>
            </div>
            <Select
              value={cursorStyle}
              onValueChange={handleCursorStyleChange}
              disabled={isLoading}
            >
              <SelectTrigger className="w-full max-w-xs bg-[var(--color-dark-bg)] border-[var(--color-dark-border)] text-gray-300">
                <SelectValue placeholder="Select cursor style" />
              </SelectTrigger>
              <SelectContent className="bg-[var(--color-dark-bg)] border-[var(--color-dark-border)]">
                <SelectItem
                  value="bar"
                  className="text-gray-300 hover:bg-[var(--color-sidebar-accent)] hover:text-white focus:bg-[var(--color-sidebar-accent)] focus:text-white"
                >
                  Thin Line
                </SelectItem>
                <SelectItem
                  value="block"
                  className="text-gray-300 hover:bg-[var(--color-sidebar-accent)] hover:text-white focus:bg-[var(--color-sidebar-accent)] focus:text-white"
                >
                  Thick Block
                </SelectItem>
                <SelectItem
                  value="underline"
                  className="text-gray-300 hover:bg-[var(--color-sidebar-accent)] hover:text-white focus:bg-[var(--color-sidebar-accent)] focus:text-white"
                >
                  Underscore
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 italic">
              {cursorStyle === "bar"
                ? "Thin Line: A vertical bar cursor, similar to modern text editors"
                : cursorStyle === "block"
                ? "Thick Block: A solid block cursor, classic terminal style (default)"
                : "Underscore: A horizontal line under the character position"}
            </p>
          </div>
        </div>

        {/* Cursor Blinking Setting */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--color-sidebar-bg)] border border-[var(--color-dark-border)]">
          <div className="space-y-0.5">
            <label className="text-sm font-medium text-white">
              Cursor Blinking
            </label>
            <p className="text-xs text-gray-400">
              Enable or disable cursor blinking animation
            </p>
          </div>
          <Switch
            checked={cursorBlink}
            onCheckedChange={handleCursorBlinkChange}
            disabled={isLoading}
          />
        </div>

        {/* Session Restoration Setting */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--color-sidebar-bg)] border border-[var(--color-dark-border)]">
          <div className="space-y-0.5">
            <label className="text-sm font-medium text-white">
              Session Restoration
            </label>
            <p className="text-xs text-gray-400">
              Automatically restore open tabs when starting the application
            </p>
          </div>
          <Switch
            checked={sessionRestore}
            onCheckedChange={handleSessionRestoreChange}
            disabled={isLoading}
          />
        </div>

        {/* Auto-open Local Terminal Setting */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--color-sidebar-bg)] border border-[var(--color-dark-border)]">
          <div className="space-y-0.5">
            <label className="text-sm font-medium text-white">
              Auto-open Local Terminal on Startup
            </label>
            <p className="text-xs text-gray-400">
              Automatically open a local terminal tab when the application starts
            </p>
          </div>
          <Switch
            checked={autoOpenLocal}
            onCheckedChange={handleAutoOpenLocalChange}
            disabled={isLoading}
          />
        </div>

        <Separator className="my-6" />

        {/* SSH Tools / Key Recording Section */}
        <div className="p-4 rounded-lg bg-[var(--color-sidebar-bg)] border border-[var(--color-dark-border)]">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-white mb-1">
                {t("sshTools.keyRecording")}
              </h3>
              <p className="text-xs text-gray-400">
                Send commands to multiple terminal sessions simultaneously
              </p>
            </div>

            <div className="flex gap-2">
              {!isRecording ? (
                <Button
                  onClick={handleStartRecording}
                  className="flex-1"
                  variant="outline"
                >
                  {t("sshTools.startKeyRecording")}
                </Button>
              ) : (
                <Button
                  onClick={handleStopRecording}
                  className="flex-1"
                  variant="destructive"
                >
                  {t("sshTools.stopKeyRecording")}
                </Button>
              )}
            </div>

            {isRecording && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white">
                    {t("sshTools.selectTerminals")}
                  </label>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {terminalTabs.map((tab) => (
                      <Button
                        key={tab.id}
                        type="button"
                        variant="outline"
                        size="sm"
                        className={`rounded-full px-3 py-1 text-xs ${
                          selectedTabIds.includes(tab.id)
                            ? "text-white bg-gray-700"
                            : "text-gray-500"
                        }`}
                        onClick={() => handleTabToggle(tab.id)}
                      >
                        {tab.title}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-white">
                    {t("sshTools.typeCommands")}
                  </label>
                  <Input
                    id="terminal-settings-input"
                    placeholder={t("placeholders.typeHere")}
                    onKeyDown={handleKeyDown}
                    onKeyPress={handleKeyPress}
                    className="font-mono"
                    disabled={selectedTabIds.length === 0}
                    readOnly
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("sshTools.commandsWillBeSent", {
                      count: selectedTabIds.length,
                    })}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right-Click Copy/Paste Setting */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--color-sidebar-bg)] border border-[var(--color-dark-border)]">
          <div className="space-y-0.5">
            <label className="text-sm font-medium text-white">
              {t("sshTools.enableRightClickCopyPaste")}
            </label>
            <p className="text-xs text-gray-400">
              Enable right-click to copy/paste in terminals
            </p>
          </div>
          <Checkbox
            id="enable-copy-paste"
            onCheckedChange={updateRightClickCopyPaste}
            defaultChecked={getCookie("rightClickCopyPaste") === "true"}
          />
        </div>
      </div>
    </div>
  );
}
