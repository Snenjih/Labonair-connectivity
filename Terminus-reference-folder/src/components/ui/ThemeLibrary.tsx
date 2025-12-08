import React, { useState } from "react";
import { DEFAULT_THEMES, type ThemeDefinition } from "@/ui/constants/default-themes.ts";
import { Button } from "./button";
import { Input } from "./input";
import { Badge } from "./badge";
import { Download, Search, X } from "lucide-react";
import { cn } from "@/lib/utils.ts";

interface ThemeLibraryProps {
  onInstallTheme: (theme: ThemeDefinition) => void;
  onClose: () => void;
}

type CategoryFilter = "all" | "dark" | "light" | "colorful" | "minimal" | "accessibility";

export function ThemeLibrary({ onInstallTheme, onClose }: ThemeLibraryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>("all");

  // Filter themes based on search and category
  const filteredThemes = DEFAULT_THEMES.filter((theme) => {
    const matchesSearch =
      theme.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      theme.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      theme.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory =
      selectedCategory === "all" ||
      theme.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const categories: { id: CategoryFilter; label: string; count: number }[] = [
    { id: "all", label: "All Themes", count: DEFAULT_THEMES.length },
    { id: "dark", label: "Dark", count: DEFAULT_THEMES.filter(t => t.category === "dark").length },
    { id: "light", label: "Light", count: DEFAULT_THEMES.filter(t => t.category === "light").length },
    { id: "colorful", label: "Colorful", count: DEFAULT_THEMES.filter(t => t.category === "colorful").length },
    { id: "minimal", label: "Minimal", count: DEFAULT_THEMES.filter(t => t.category === "minimal").length },
    { id: "accessibility", label: "Accessibility", count: DEFAULT_THEMES.filter(t => t.category === "accessibility").length },
  ];

  const handleInstall = (theme: ThemeDefinition) => {
    onInstallTheme(theme);
  };

  return (
    <div
      className="fixed inset-0 z-[999999] flex items-center justify-center"
      style={{
        backdropFilter: "blur(8px)",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
      }}
      onClick={onClose}
    >
      <div
        className="flex flex-col rounded-lg border-2 border-[var(--color-dark-border)] bg-[var(--color-dark-bg)] shadow-2xl max-h-[90vh] overflow-hidden w-full max-w-6xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-[var(--color-dark-border)]">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-2xl font-semibold text-white">Theme Library</h2>
              <p className="text-sm text-gray-400 mt-1">
                Browse and install professionally designed themes
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={onClose}
              className="border-[var(--color-dark-border)] bg-[var(--color-dark-bg-button)] hover:bg-[var(--color-dark-hover)]"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search themes by name, description, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-[var(--color-dark-bg-input)] border-[var(--color-dark-border)] text-white"
            />
          </div>
        </div>

        {/* Category Filter */}
        <div className="px-6 py-4 border-b border-[var(--color-dark-border)] overflow-x-auto">
          <div className="flex gap-2">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors",
                  selectedCategory === category.id
                    ? "bg-[var(--color-primary)] text-[var(--color-dark-bg)]"
                    : "bg-[var(--color-dark-bg-button)] text-gray-400 hover:text-white hover:bg-[var(--color-dark-hover)]"
                )}
              >
                {category.label}
                <span className="ml-2 opacity-70">({category.count})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Theme Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredThemes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-gray-400 mb-2">No themes found</p>
              <p className="text-sm text-gray-500">
                Try adjusting your search or filter criteria
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredThemes.map((theme, index) => (
                <div
                  key={index}
                  className="rounded-lg border-2 border-[var(--color-dark-border)] bg-[var(--color-sidebar-bg)] p-4 hover:border-[var(--color-primary)]/50 transition-all"
                >
                  {/* Theme Name & Category */}
                  <div className="mb-3">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-lg font-semibold text-white">
                        {theme.name}
                      </h3>
                      <Badge
                        className={cn(
                          "text-xs",
                          theme.category === "accessibility" && "bg-green-500/20 text-green-400",
                          theme.category === "dark" && "bg-blue-500/20 text-blue-400",
                          theme.category === "light" && "bg-yellow-500/20 text-yellow-400",
                          theme.category === "colorful" && "bg-purple-500/20 text-purple-400",
                          theme.category === "minimal" && "bg-gray-500/20 text-gray-400"
                        )}
                      >
                        {theme.category}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-400 leading-relaxed">
                      {theme.description}
                    </p>
                  </div>

                  {/* Color Swatches */}
                  <div className="flex gap-1.5 mb-3">
                    {Object.values(theme.colors).slice(0, 8).map((color, colorIndex) => (
                      <div
                        key={colorIndex}
                        className="flex-1 h-10 rounded border-2 border-[var(--color-dark-border)]"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {theme.tags.slice(0, 3).map((tag, tagIndex) => (
                      <span
                        key={tagIndex}
                        className="text-xs px-2 py-1 rounded bg-[var(--color-dark-bg)] text-gray-400"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Install Button */}
                  <Button
                    size="sm"
                    className="w-full bg-blue-600 text-white hover:bg-blue-700"
                    onClick={() => handleInstall(theme)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Install Theme
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--color-dark-border)] bg-[var(--color-sidebar-bg)]">
          <p className="text-xs text-gray-400 text-center">
            All themes meet WCAG AA accessibility standards
          </p>
        </div>
      </div>
    </div>
  );
}
