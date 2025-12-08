import React from "react";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";
import {
  Settings,
  Palette,
  Paintbrush,
  Terminal,
  Folder,
  Keyboard,
  Shield,
  type LucideIcon,
} from "lucide-react";

export type SettingsCategory =
  | "application"
  | "appearance"
  | "colorScheme"
  | "profilesSecurity"
  | "terminal"
  | "fileManager"
  | "hotkeys";

interface SettingsSidebarProps {
  activeCategory: SettingsCategory;
  onCategoryChange: (category: SettingsCategory) => void;
}

export function SettingsSidebar({
  activeCategory,
  onCategoryChange,
}: SettingsSidebarProps) {
  const categories: {
    id: SettingsCategory;
    label: string;
    icon: LucideIcon;
  }[] = [
    { id: "application", label: "Application", icon: Settings },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "colorScheme", label: "Color Scheme", icon: Paintbrush },
    { id: "profilesSecurity", label: "Profiles & Security", icon: Shield },
    { id: "terminal", label: "Terminal", icon: Terminal },
    { id: "fileManager", label: "File Manager", icon: Folder },
    { id: "hotkeys", label: "Hotkeys", icon: Keyboard },
  ];

  return (
    <div className="w-56 bg-[var(--color-sidebar-bg)] border-r-2 border-[var(--color-dark-border)] h-full overflow-y-auto">
      <div className="p-4">
        <h2 className="text-lg font-semibold text-white mb-4">Settings</h2>
        <nav className="space-y-1">
          {categories.map((category) => {
            const Icon = category.icon;
            return (
              <Button
                key={category.id}
                variant="ghost"
                className={cn(
                  "w-full justify-start text-left px-3 py-2 gap-2",
                  activeCategory === category.id
                    ? "bg-[var(--color-sidebar-accent)] text-white"
                    : "text-gray-400 hover:bg-[var(--color-sidebar-accent)] hover:text-white",
                )}
                onClick={() => onCategoryChange(category.id)}
              >
                <Icon className="w-4 h-4" />
                {category.label}
              </Button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
