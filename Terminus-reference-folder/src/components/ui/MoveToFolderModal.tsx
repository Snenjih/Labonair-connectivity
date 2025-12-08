import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Folder, FolderPlus } from "lucide-react";

interface MoveToFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (folder: string) => void;
  selectedCount: number;
  existingFolders: string[];
}

export function MoveToFolderModal({
  isOpen,
  onClose,
  onConfirm,
  selectedCount,
  existingFolders,
}: MoveToFolderModalProps) {
  const [selectedFolder, setSelectedFolder] = useState<string>("");
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const folders = useMemo(() => {
    const uniqueFolders = Array.from(new Set(existingFolders.filter(Boolean)));
    return ["Uncategorized", ...uniqueFolders];
  }, [existingFolders]);

  const handleConfirm = () => {
    const folderToMove = isCreatingNew ? newFolderName.trim() : selectedFolder;

    if (folderToMove) {
      const actualFolder = folderToMove === "Uncategorized" ? "" : folderToMove;
      onConfirm(actualFolder);
      handleClose();
    }
  };

  const handleClose = () => {
    setSelectedFolder("");
    setIsCreatingNew(false);
    setNewFolderName("");
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      handleClose();
    } else if (e.key === "Enter" && canConfirm) {
      e.preventDefault();
      handleConfirm();
    }
  };

  const canConfirm = isCreatingNew
    ? newFolderName.trim().length > 0
    : selectedFolder.length > 0;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[999999] flex items-center justify-center pointer-events-auto"
      style={{
        backdropFilter: "blur(8px)",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
      }}
      onClick={handleClose}
    >
      <div
        className="bg-dark-bg border-2 border-dark-border rounded-lg shadow-2xl w-full max-w-[90vw] min-w-[280px] sm:max-w-md md:max-w-lg flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-3 py-3 sm:px-4 sm:py-3 md:px-6 md:py-4 border-b-2 border-dark-border">
          <h2 className="text-base sm:text-lg font-semibold text-white">Move Hosts to Folder</h2>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            Move {selectedCount} selected host{selectedCount > 1 ? "s" : ""} to a folder
          </p>
        </div>

        {/* Content */}
        <div className="px-3 py-3 sm:px-4 sm:py-3 md:px-6 md:py-4 space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-3 sm:mb-4">
            <Button
              variant={!isCreatingNew ? "default" : "outline"}
              size="sm"
              onClick={() => setIsCreatingNew(false)}
              className="flex-1 justify-center"
            >
              <Folder className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Existing Folder</span>
              <span className="sm:hidden">Existing</span>
            </Button>
            <Button
              variant={isCreatingNew ? "default" : "outline"}
              size="sm"
              onClick={() => setIsCreatingNew(true)}
              className="flex-1 justify-center"
            >
              <FolderPlus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">New Folder</span>
              <span className="sm:hidden">New</span>
            </Button>
          </div>

          {!isCreatingNew ? (
            <div className="space-y-2">
              <Label htmlFor="folder-select" className="text-white">Select folder</Label>
              <select
                id="folder-select"
                value={selectedFolder}
                onChange={(e) => setSelectedFolder(e.target.value)}
                className="w-full px-3 py-2 bg-dark-bg-input border-2 border-dark-border rounded-md text-white focus:outline-none focus:border-blue-500"
              >
                <option value="" disabled>Choose a folder</option>
                {folders.map((folder) => (
                  <option key={folder} value={folder}>
                    {folder}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="new-folder" className="text-white">New folder name</Label>
              <Input
                id="new-folder"
                placeholder="Enter folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={handleKeyDown}
                className="bg-dark-bg-input border-2 border-dark-border text-white"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-3 sm:px-4 sm:py-3 md:px-6 md:py-4 border-t-2 border-dark-border bg-dark-bg-darker flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            Move to Folder
          </Button>
        </div>
      </div>
    </div>
  );
}
