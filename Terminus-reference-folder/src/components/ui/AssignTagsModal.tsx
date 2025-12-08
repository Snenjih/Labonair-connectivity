import React, { useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Label } from "@/components/ui/label.tsx";
import { X } from "lucide-react";

interface AssignTagsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (tags: string[], mode: "add" | "replace") => void;
  selectedCount: number;
}

export function AssignTagsModal({
  isOpen,
  onClose,
  onConfirm,
  selectedCount,
}: AssignTagsModalProps) {
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [mode, setMode] = useState<"add" | "replace">("add");

  const handleAddTag = () => {
    const trimmedTag = tagInput.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  const handleConfirm = () => {
    if (tags.length > 0) {
      onConfirm(tags, mode);
      setTags([]);
      setTagInput("");
      setMode("add");
    }
  };

  const handleCancel = () => {
    setTags([]);
    setTagInput("");
    setMode("add");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center pointer-events-auto"
      style={{
        zIndex: "var(--z-modal-backdrop)",
        backdropFilter: "blur(8px)",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
      }}
      onClick={handleCancel}
    >
      <div
        className="bg-dark-bg border-2 border-dark-border rounded-lg shadow-2xl w-full max-w-[90vw] min-w-[280px] sm:max-w-md md:max-w-lg flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-3 py-3 sm:px-4 sm:py-3 md:px-6 md:py-4 border-b-2 border-dark-border">
          <h2 className="text-base sm:text-lg font-semibold text-white">Assign Tags to Hosts</h2>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            Assign tags to {selectedCount} selected host{selectedCount > 1 ? "s" : ""}
          </p>
        </div>

        {/* Content */}
        <div className="px-3 py-3 sm:px-4 sm:py-3 md:px-6 md:py-4 space-y-3 sm:space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tag-input" className="text-white">Enter tags</Label>
            <div className="flex gap-2">
              <Input
                id="tag-input"
                placeholder="Type a tag and press Enter"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-dark-bg-input border-2 border-dark-border text-white text-sm"
              />
              <Button onClick={handleAddTag} variant="outline" size="sm" className="shrink-0">
                <span className="hidden sm:inline">Add</span>
                <span className="sm:hidden">+</span>
              </Button>
            </div>
          </div>

          {tags.length > 0 && (
            <div className="space-y-2">
              <Label className="text-white">Tags to assign ({tags.length})</Label>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="px-2 py-1 flex items-center gap-1"
                  >
                    {tag}
                    <X
                      className="h-3 w-3 cursor-pointer hover:text-red-500"
                      onClick={() => handleRemoveTag(tag)}
                    />
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <Label className="text-white">Mode</Label>
            <div className="space-y-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === "add"}
                  onChange={() => setMode("add")}
                  className="h-4 w-4"
                />
                <span className="text-white text-sm">Add to existing tags</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === "replace"}
                  onChange={() => setMode("replace")}
                  className="h-4 w-4"
                />
                <span className="text-white text-sm">Replace all existing tags</span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-3 py-3 sm:px-4 sm:py-3 md:px-6 md:py-4 border-t-2 border-dark-border bg-dark-bg-darker flex justify-end gap-2">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={tags.length === 0}>
            Assign Tags
          </Button>
        </div>
      </div>
    </div>
  );
}
