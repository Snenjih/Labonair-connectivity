import React, { useState } from "react";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Check, Pencil, Download, MoreVertical, FileText, Trash2, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { DEFAULT_THEME_ID } from "@/constants/defaultTheme";

export interface ColorTheme {
  id: number;
  name: string;
  colors: Record<string, string> | string;
  isActive: boolean;
  userId: string;
  createdAt: string | number;
  updatedAt: string | number;
  author?: string;
}

interface ThemeCardProps {
  theme: ColorTheme;
  isActive: boolean;
  onActivate: (themeId: number) => void;
  onEdit: (themeId: number) => void;
  onDuplicate: (themeId: number) => void;
  onExport: (themeId: number) => void;
  onDelete: (themeId: number) => void;
  onRename: (themeId: number, newName: string) => void;
}

export function ThemeCard({
  theme,
  isActive,
  onActivate,
  onEdit,
  onExport,
  onDelete,
  onRename,
}: ThemeCardProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(theme.name);
  const isDefaultTheme = theme.id === DEFAULT_THEME_ID;

  // Parse colors if stored as JSON string
  const colors =
    typeof theme.colors === "string"
      ? JSON.parse(theme.colors)
      : theme.colors;

  const handleRenameSubmit = () => {
    if (newName.trim() && newName !== theme.name) {
      onRename(theme.id, newName.trim());
    }
    setIsRenaming(false);
  };

  const handleRenameCancel = () => {
    setNewName(theme.name);
    setIsRenaming(false);
  };



  // Color variables with labels for tooltips
  const colorVariables = [
    { name: "--background", label: "Background" },
    { name: "--foreground", label: "Foreground" },
    { name: "--primary", label: "Primary" },
    { name: "--secondary", label: "Secondary" },
    { name: "--accent", label: "Accent" },
    { name: "--destructive", label: "Destructive" },
    { name: "--muted", label: "Muted" },
    { name: "--border", label: "Border" },
    { name: "--card", label: "Card" },
    { name: "--input", label: "Input" },
    { name: "--ring", label: "Focus Ring" },
    { name: "--color-dark-bg", label: "Dark BG" },
  ];

  return (
    <div
      className={cn(
        "relative rounded-lg border-2 transition-all duration-200",
        "bg-[var(--color-sidebar-bg)] hover:shadow-lg overflow-hidden",
        isActive
          ? "border-[var(--color-primary)] shadow-md"
          : "border-[var(--color-dark-border)] hover:border-[var(--color-primary)]/50"
      )}
    >
      {/* Theme Preview - Mini UI */}
      <div
        className="relative h-32 p-3 overflow-hidden"
        style={{
          backgroundColor: colors["--background"] || "#0a0a0a",
          color: colors["--foreground"] || "#ffffff",
        }}
      >
        {/* Active Badge */}
        {isActive && (
          <div className="absolute top-2 right-2 z-10">
            <Badge className="bg-[var(--color-primary)] text-white flex items-center gap-1 text-xs">
              <Check className="w-3 h-3" />
              Active
            </Badge>
          </div>
        )}

        {/* Mini UI Preview */}
        <div className="space-y-1.5">
          {/* Mini navbar */}
          <div
            className="h-5 rounded flex items-center px-2 gap-1"
            style={{ backgroundColor: colors["--card"] || colors["--color-dark-bg-darker"] || "#1a1a1a" }}
          >
            <div className="w-1 h-1 rounded-full" style={{ backgroundColor: colors["--primary"] || "#3b82f6" }} />
            <div className="w-1 h-1 rounded-full" style={{ backgroundColor: colors["--secondary"] || "#6b7280" }} />
            <div className="w-1 h-1 rounded-full" style={{ backgroundColor: colors["--accent"] || "#8b5cf6" }} />
          </div>
          {/* Mini content area */}
          <div className="flex gap-1.5">
            <div
              className="flex-1 h-14 rounded border"
              style={{
                backgroundColor: colors["--card"] || colors["--color-dark-bg"] || "#0f0f0f",
                borderColor: colors["--border"] || "#27272a",
              }}
            >
              <div className="p-1.5 space-y-1">
                <div className="h-1.5 rounded" style={{ backgroundColor: colors["--primary"] || "#3b82f6", width: "60%" }} />
                <div className="h-1 rounded" style={{ backgroundColor: colors["--muted"] || "#71717a", width: "40%" }} />
                <div className="h-1 rounded" style={{ backgroundColor: colors["--muted"] || "#71717a", width: "80%" }} />
              </div>
            </div>
            <div className="w-12 space-y-1">
              <div
                className="h-6 rounded flex items-center justify-center text-xs font-medium"
                style={{
                  backgroundColor: colors["--primary"] || "#3b82f6",
                  color: colors["--primary-foreground"] || "#ffffff",
                }}
              >
                <div className="w-3 h-0.5 rounded" style={{ backgroundColor: "currentColor" }} />
              </div>
              <div
                className="h-6 rounded flex items-center justify-center"
                style={{
                  backgroundColor: colors["--secondary"] || "#27272a",
                  color: colors["--secondary-foreground"] || "#ffffff",
                }}
              >
                <div className="w-3 h-0.5 rounded" style={{ backgroundColor: "currentColor" }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Theme Info */}
      <div className="p-3 border-t border-[var(--color-dark-border)]">
        <div className="mb-2">
          {isRenaming ? (
            <div className="flex gap-1">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRenameSubmit();
                  if (e.key === "Escape") handleRenameCancel();
                }}
                className="h-7 text-sm bg-[var(--color-dark-bg-input)] border-[var(--color-dark-border)]"
                autoFocus
              />
              <Button
                size="sm"
                onClick={handleRenameSubmit}
                className="h-7 px-2 bg-[var(--color-primary)]"
              >
                <Check className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <h3 className="text-sm font-semibold text-white truncate">
              {theme.name}
              {isDefaultTheme && (
                <Badge className="ml-2 bg-blue-600 text-white text-xs">
                  Read-only
                </Badge>
              )}
            </h3>
          )}
          {theme.author && !isRenaming && (
            <p className="text-xs text-gray-400 truncate">
              by {theme.author}
            </p>
          )}
        </div>

        {/* Color Palette with Tooltips */}
        <TooltipProvider delayDuration={200}>
          <div className="flex flex-wrap gap-1 mb-3">
            {colorVariables.slice(0, 12).map((variable) => {
              const colorValue = colors[variable.name];
              if (!colorValue) return null;

              return (
                <Tooltip key={variable.name}>
                  <TooltipTrigger asChild>
                    <div
                      className="w-6 h-6 rounded border border-[var(--color-dark-border)] cursor-help transition-transform hover:scale-110"
                      style={{ backgroundColor: colorValue }}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-[var(--color-dark-bg)] border-[var(--color-dark-border)]">
                    <p className="text-xs text-gray-400 font-medium">{variable.label}</p>
                    <p className="text-xs text-gray-400 font-mono">{colorValue}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {isActive ? (
            <>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(theme.id);
                }}
                disabled={isDefaultTheme}
                title={isDefaultTheme ? "Cannot edit default theme" : "Edit theme"}
              >
                <Pencil className="w-3 h-3 mr-1" />
                Edit
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-48 bg-[var(--color-dark-bg)] border-[var(--color-dark-border)]"
                >
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onExport(theme.id);
                    }}
                    className="cursor-pointer hover:bg-[var(--color-dark-hover)] text-white"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsRenaming(true);
                    }}
                    disabled={isDefaultTheme}
                    className="cursor-pointer hover:bg-[var(--color-dark-hover)] text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-[var(--color-dark-border)]" />
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(theme.id);
                    }}
                    disabled={isDefaultTheme}
                    className="cursor-pointer hover:bg-red-600/10 text-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button
                size="sm"
                className="flex-1 text-xs bg-[var(--color-primary)] hover:opacity-90"
                onClick={(e) => {
                  e.stopPropagation();
                  onActivate(theme.id);
                }}
              >
                Apply
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(theme.id);
                }}
                disabled={isDefaultTheme}
                title={isDefaultTheme ? "Cannot edit default theme" : "Edit theme"}
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-48 bg-[var(--color-dark-bg)] border-[var(--color-dark-border)]"
                >
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onActivate(theme.id);
                    }}
                    className="cursor-pointer hover:bg-[var(--color-dark-hover)] text-white"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Apply
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onExport(theme.id);
                    }}
                    className="cursor-pointer hover:bg-[var(--color-dark-hover)] text-white"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsRenaming(true);
                    }}
                    disabled={isDefaultTheme}
                    className="cursor-pointer hover:bg-[var(--color-dark-hover)] text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-[var(--color-dark-border)]" />
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(theme.id);
                    }}
                    disabled={isDefaultTheme}
                    className="cursor-pointer hover:bg-red-600/10 text-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
