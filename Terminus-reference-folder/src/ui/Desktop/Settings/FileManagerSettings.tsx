import React, { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { getSetting, saveSetting, validateEditorPath, listLocalFiles } from "@/ui/main-axios.ts";
import { toast } from "sonner";
import { Check, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMounted } from "@/hooks/useIsMounted";

interface FileManagerSettingsProps {}

export function FileManagerSettings({}: FileManagerSettingsProps) {
  const isMounted = useIsMounted();
  const [fileManagerDesign, setFileManagerDesign] = useState<string>("explorer");
  const [editorType, setEditorType] = useState<string>("internal");
  const [editorPath, setEditorPath] = useState<string>("");
  const [defaultLayout, setDefaultLayout] = useState<string>("grid");
  const [localDefaultPath, setLocalDefaultPath] = useState<string>("");
  const [showType, setShowType] = useState<boolean>(true);
  const [showSize, setShowSize] = useState<boolean>(true);
  const [showModified, setShowModified] = useState<boolean>(true);
  const [showPermissions, setShowPermissions] = useState<boolean>(true);
  const [showOwner, setShowOwner] = useState<boolean>(true);
  const [displaySize, setDisplaySize] = useState<string>("medium");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isValidatingEditor, setIsValidatingEditor] = useState<boolean>(false);
  const [pathValidation, setPathValidation] = useState<"valid" | "invalid" | "unchecked">("unchecked");

  useEffect(() => {
    loadFileManagerDesignSetting();
    loadEditorTypeSetting();
    loadEditorPathSetting();
    loadDefaultLayoutSetting();
    loadLocalDefaultPathSetting();
    loadColumnVisibilitySettings();
    loadDisplaySizeSetting();
  }, []);

  const loadFileManagerDesignSetting = async () => {
    try {
      if (isMounted()) setIsLoading(true);
      const response = await getSetting("file_manager_design");
      if (isMounted()) {
        setFileManagerDesign(response.value || "explorer");
      }
    } catch (error) {
      console.error("Failed to load file manager design setting:", error);
      // Default to explorer if setting doesn't exist
      if (isMounted()) {
        setFileManagerDesign("explorer");
      }
    } finally {
      if (isMounted()) setIsLoading(false);
    }
  };

  const handleFileManagerDesignChange = async (value: string) => {
    setFileManagerDesign(value);
    try {
      await saveSetting("file_manager_design", value);
    } catch (error) {
      console.error("Failed to save file manager design setting:", error);
      // Revert on error
      await loadFileManagerDesignSetting();
    }
  };

  const loadEditorTypeSetting = async () => {
    try {
      const response = await getSetting("file_editor_type");
      if (isMounted()) {
        setEditorType(response.value || "internal");
      }
    } catch (error) {
      console.error("Failed to load file editor type setting:", error);
      // Default to internal if setting doesn't exist
      if (isMounted()) {
        setEditorType("internal");
      }
    }
  };

  const handleEditorTypeChange = async (value: string) => {
    setEditorType(value);
    try {
      await saveSetting("file_editor_type", value);
    } catch (error) {
      console.error("Failed to save file editor type setting:", error);
      // Revert on error
      await loadEditorTypeSetting();
    }
  };

  const loadEditorPathSetting = async () => {
    try {
      const response = await getSetting("file_editor_path");
      if (isMounted()) {
        setEditorPath(response.value || "");
      }
    } catch (error) {
      console.error("Failed to load file editor path setting:", error);
      // Default to empty string if setting doesn't exist
      if (isMounted()) {
        setEditorPath("");
      }
    }
  };

  const handleEditorPathChange = async (value: string) => {
    setEditorPath(value);
    try {
      await saveSetting("file_editor_path", value);
    } catch (error) {
      console.error("Failed to save file editor path setting:", error);
      // Revert on error
      await loadEditorPathSetting();
    }
  };

  const loadDefaultLayoutSetting = async () => {
    try {
      const response = await getSetting("file_manager_default_layout");
      if (isMounted()) {
        setDefaultLayout(response.value || "grid");
      }
    } catch (error) {
      console.error("Failed to load default layout setting:", error);
      // Default to grid if setting doesn't exist
      if (isMounted()) {
        setDefaultLayout("grid");
      }
    }
  };

  const handleDefaultLayoutChange = async (value: string) => {
    setDefaultLayout(value);
    try {
      await saveSetting("file_manager_default_layout", value);
    } catch (error) {
      console.error("Failed to save default layout setting:", error);
      // Revert on error
      await loadDefaultLayoutSetting();
    }
  };

  const loadLocalDefaultPathSetting = async () => {
    try {
      const response = await getSetting("file_manager_local_default_path");
      if (isMounted()) {
        setLocalDefaultPath(response.value || "");
      }
    } catch (error) {
      console.error("Failed to load local default path setting:", error);
      // Default to empty string if setting doesn't exist
      if (isMounted()) {
        setLocalDefaultPath("");
      }
    }
  };

  const validateLocalPath = async (path: string) => {
    if (!path) {
      if (isMounted()) setPathValidation("unchecked");
      return;
    }

    try {
      await listLocalFiles(path);
      if (isMounted()) {
        setPathValidation("valid");
      }
    } catch (error) {
      if (isMounted()) {
        setPathValidation("invalid");
      }
    }
  };

  const handleLocalDefaultPathChange = async (value: string) => {
    setLocalDefaultPath(value);
    setPathValidation("unchecked");

    try {
      await saveSetting("file_manager_local_default_path", value);
      // Validate the path after saving
      await validateLocalPath(value);
    } catch (error) {
      console.error("Failed to save local default path setting:", error);
      // Revert on error
      await loadLocalDefaultPathSetting();
    }
  };

  const loadColumnVisibilitySettings = async () => {
    try {
      const typeRes = await getSetting("file_manager_show_type");
      if (isMounted()) {
        setShowType(typeRes.value === "true" || typeRes.value === undefined);
      }
    } catch (error) {
      if (isMounted()) {
        setShowType(true);
      }
    }

    try {
      const sizeRes = await getSetting("file_manager_show_size");
      if (isMounted()) {
        setShowSize(sizeRes.value === "true" || sizeRes.value === undefined);
      }
    } catch (error) {
      if (isMounted()) {
        setShowSize(true);
      }
    }

    try {
      const modifiedRes = await getSetting("file_manager_show_modified");
      if (isMounted()) {
        setShowModified(modifiedRes.value === "true" || modifiedRes.value === undefined);
      }
    } catch (error) {
      if (isMounted()) {
        setShowModified(true);
      }
    }

    try {
      const permissionsRes = await getSetting("file_manager_show_permissions");
      if (isMounted()) {
        setShowPermissions(permissionsRes.value === "true" || permissionsRes.value === undefined);
      }
    } catch (error) {
      if (isMounted()) {
        setShowPermissions(true);
      }
    }

    try {
      const ownerRes = await getSetting("file_manager_show_owner");
      if (isMounted()) {
        setShowOwner(ownerRes.value === "true" || ownerRes.value === undefined);
      }
    } catch (error) {
      if (isMounted()) {
        setShowOwner(true);
      }
    }
  };

  const handleColumnVisibilityChange = async (column: string, value: boolean) => {
    try {
      await saveSetting(`file_manager_show_${column}`, value.toString());

      // Update state based on column
      switch (column) {
        case "type":
          setShowType(value);
          break;
        case "size":
          setShowSize(value);
          break;
        case "modified":
          setShowModified(value);
          break;
        case "permissions":
          setShowPermissions(value);
          break;
        case "owner":
          setShowOwner(value);
          break;
      }
    } catch (error) {
      console.error(`Failed to save ${column} visibility setting:`, error);
      // Reload on error
      await loadColumnVisibilitySettings();
    }
  };

  const handleValidateEditorPath = async () => {
    if (!editorPath) {
      toast.error("Please enter an editor path first");
      return;
    }

    if (isMounted()) setIsValidatingEditor(true);
    try {
      const result = await validateEditorPath(editorPath);

      if (result.isValid) {
        toast.success("Editor path is valid and accessible");
      } else {
        toast.error("Editor path not found or not executable");
      }
    } catch (error: any) {
      console.error("Failed to validate editor path:", error);
      toast.error(error.message || "Failed to validate editor path");
    } finally {
      if (isMounted()) setIsValidatingEditor(false);
    }
  };

  const loadDisplaySizeSetting = async () => {
    try {
      const response = await getSetting("file_manager_display_size");
      if (isMounted()) {
        setDisplaySize(response.value || "medium");
      }
    } catch (error) {
      console.error("Failed to load display size setting:", error);
      // Default to medium if setting doesn't exist
      if (isMounted()) {
        setDisplaySize("medium");
      }
    }
  };

  const handleDisplaySizeChange = async (value: string) => {
    setDisplaySize(value);
    try {
      await saveSetting("file_manager_display_size", value);
    } catch (error) {
      console.error("Failed to save display size setting:", error);
      // Revert on error
      await loadDisplaySizeSetting();
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-white">File Manager Settings</h2>
        <p className="text-sm text-gray-400">
          Configure file manager layout and behavior
        </p>
      </div>

      {/* Settings Section */}
      <div className="space-y-4">
        {/* File Manager Design Setting */}
        <div className="p-4 rounded-lg bg-[var(--color-sidebar-bg)] border border-[var(--color-dark-border)]">
          <div className="space-y-3">
            <div className="space-y-0.5">
              <label className="text-sm font-medium text-white">
                File Manager Design
              </label>
              <p className="text-xs text-gray-400">
                Choose between single-panel Explorer or dual-panel Commander layout
              </p>
            </div>
            <Select
              value={fileManagerDesign}
              onValueChange={handleFileManagerDesignChange}
              disabled={isLoading}
            >
              <SelectTrigger className="w-full max-w-xs bg-[var(--color-dark-bg)] border-[var(--color-dark-border)] text-gray-300">
                <SelectValue placeholder="Select layout" />
              </SelectTrigger>
              <SelectContent className="bg-[var(--color-dark-bg)] border-[var(--color-dark-border)]">
                <SelectItem
                  value="explorer"
                  className="text-gray-300 hover:bg-[var(--color-sidebar-accent)] hover:text-white focus:bg-[var(--color-sidebar-accent)] focus:text-white"
                >
                  Explorer (Single Panel)
                </SelectItem>
                <SelectItem
                  value="commander"
                  className="text-gray-300 hover:bg-[var(--color-sidebar-accent)] hover:text-white focus:bg-[var(--color-sidebar-accent)] focus:text-white"
                >
                  Commander (Dual Panel)
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 italic">
              {fileManagerDesign === "explorer"
                ? "Explorer: Traditional single-panel file browser with sidebar navigation"
                : "Commander: Orthodox dual-panel layout for efficient cross-panel file operations"}
            </p>
          </div>
        </div>

        {/* File Editor Type Setting */}
        <div className="p-4 rounded-lg bg-[var(--color-sidebar-bg)] border border-[var(--color-dark-border)]">
          <div className="space-y-3">
            <div className="space-y-0.5">
              <label className="text-sm font-medium text-white">
                File Editor
              </label>
              <p className="text-xs text-gray-400">
                Choose how to edit remote text files
              </p>
            </div>
            <Select
              value={editorType}
              onValueChange={handleEditorTypeChange}
              disabled={isLoading}
            >
              <SelectTrigger className="w-full max-w-xs bg-[var(--color-dark-bg)] border-[var(--color-dark-border)] text-gray-300">
                <SelectValue placeholder="Select editor type" />
              </SelectTrigger>
              <SelectContent className="bg-[var(--color-dark-bg)] border-[var(--color-dark-border)]">
                <SelectItem
                  value="internal"
                  className="text-gray-300 hover:bg-[var(--color-sidebar-accent)] hover:text-white focus:bg-[var(--color-sidebar-accent)] focus:text-white"
                >
                  Internal Monaco Editor
                </SelectItem>
                <SelectItem
                  value="external"
                  className="text-gray-300 hover:bg-[var(--color-sidebar-accent)] hover:text-white focus:bg-[var(--color-sidebar-accent)] focus:text-white"
                >
                  External Application
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 italic">
              {editorType === "internal"
                ? "Internal: Edit files directly in Terminus using the built-in Monaco code editor (VS Code's editor)"
                : "External: Download files and open them in your preferred external text editor"}
            </p>

            {/* External Editor Path Input - Only shown when external editor is selected */}
            {editorType === "external" && (
              <div className="space-y-2 mt-3 pt-3 border-t border-[var(--color-dark-border)]">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium text-white">
                    External Editor Path
                  </label>
                  <p className="text-xs text-gray-400">
                    Path to your preferred text editor executable
                  </p>
                </div>
                <div className="flex gap-2 items-center">
                  <Input
                    type="text"
                    value={editorPath}
                    onChange={(e) => handleEditorPathChange(e.target.value)}
                    placeholder="e.g., code, subl, notepad++, /usr/local/bin/code"
                    disabled={isLoading}
                    className="w-full max-w-md bg-[var(--color-dark-bg)] border-[var(--color-dark-border)] text-gray-300 placeholder:text-gray-500"
                  />
                  <Button
                    onClick={handleValidateEditorPath}
                    disabled={isLoading || isValidatingEditor || !editorPath}
                    variant="outline"
                    size="sm"
                    className="shrink-0 bg-[var(--color-dark-bg)] border-[var(--color-dark-border)] text-gray-300 hover:bg-[var(--color-sidebar-accent)] hover:text-white"
                  >
                    {isValidatingEditor ? "Checking..." : "Validate"}
                  </Button>
                </div>
                <div className="space-y-1 text-xs text-gray-500">
                  <p className="font-medium">Common editors:</p>
                  <ul className="list-disc list-inside space-y-0.5 ml-2">
                    <li>VS Code: <code className="bg-[var(--color-dark-bg)] px-1 py-0.5 rounded">code</code> (if in PATH) or full path</li>
                    <li>Sublime Text: <code className="bg-[var(--color-dark-bg)] px-1 py-0.5 rounded">subl</code> or full path</li>
                    <li>Notepad++: Full path to notepad++.exe (Windows)</li>
                    <li>Vim: <code className="bg-[var(--color-dark-bg)] px-1 py-0.5 rounded">vim</code> or <code className="bg-[var(--color-dark-bg)] px-1 py-0.5 rounded">nvim</code></li>
                    <li>Emacs: <code className="bg-[var(--color-dark-bg)] px-1 py-0.5 rounded">emacs</code></li>
                  </ul>
                  <p className="mt-2 italic">Leave empty to use your system's default editor</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Default Layout Setting */}
        <div className="p-4 rounded-lg bg-[var(--color-sidebar-bg)] border border-[var(--color-dark-border)]">
          <div className="space-y-3">
            <div className="space-y-0.5">
              <label className="text-sm font-medium text-white">
                Default View Layout
              </label>
              <p className="text-xs text-gray-400">
                Choose the default layout when opening file manager
              </p>
            </div>
            <Select
              value={defaultLayout}
              onValueChange={handleDefaultLayoutChange}
              disabled={isLoading}
            >
              <SelectTrigger className="w-full max-w-xs bg-[var(--color-dark-bg)] border-[var(--color-dark-border)] text-gray-300">
                <SelectValue placeholder="Select layout" />
              </SelectTrigger>
              <SelectContent className="bg-[var(--color-dark-bg)] border-[var(--color-dark-border)]">
                <SelectItem
                  value="grid"
                  className="text-gray-300 hover:bg-[var(--color-sidebar-accent)] hover:text-white focus:bg-[var(--color-sidebar-accent)] focus:text-white"
                >
                  Grid View
                </SelectItem>
                <SelectItem
                  value="list"
                  className="text-gray-300 hover:bg-[var(--color-sidebar-accent)] hover:text-white focus:bg-[var(--color-sidebar-accent)] focus:text-white"
                >
                  List View
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 italic">
              {defaultLayout === "grid"
                ? "Grid: Display files and folders in a grid with large icons"
                : "List: Display files and folders in a detailed list with file information"}
            </p>
          </div>
        </div>

        {/* Local Default Path Setting */}
        <div className="p-4 rounded-lg bg-[var(--color-sidebar-bg)] border border-[var(--color-dark-border)]">
          <div className="space-y-3">
            <div className="space-y-0.5">
              <label className="text-sm font-medium text-white">
                Local File Path
              </label>
              <p className="text-xs text-gray-400">
                Default folder path for local file manager panels (e.g., /home/user/Documents)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="text"
                value={localDefaultPath}
                onChange={(e) => handleLocalDefaultPathChange(e.target.value)}
                placeholder="/home/user or leave empty for home directory"
                disabled={isLoading}
                className="w-full max-w-md bg-[var(--color-dark-bg)] border-[var(--color-dark-border)] text-gray-300 placeholder:text-gray-500"
              />
              {pathValidation === "valid" && (
                <div className="flex items-center text-green-500" title="Path is valid">
                  <Check className="w-5 h-5" />
                </div>
              )}
              {pathValidation === "invalid" && (
                <div className="flex items-center text-red-500" title="Path is invalid or does not exist">
                  <X className="w-5 h-5" />
                </div>
              )}
            </div>
            {pathValidation === "invalid" && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Path is invalid or does not exist. Please enter a valid directory path.
              </p>
            )}
            <p className="text-xs text-gray-500 italic">
              Leave empty to use your system's home directory. This path will be used when opening local file manager panels.
            </p>
          </div>
        </div>

        {/* List View Column Visibility Settings */}
        <div className="p-4 rounded-lg bg-[var(--color-sidebar-bg)] border border-[var(--color-dark-border)]">
          <div className="space-y-3">
            <div className="space-y-0.5">
              <label className="text-sm font-medium text-white">
                List View Columns
              </label>
              <p className="text-xs text-gray-400">
                Choose which columns to display in list view
              </p>
            </div>
            <div className="space-y-3">
              {/* Show Type Column */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-sm text-white">Show Type</label>
                  <p className="text-xs text-gray-500">Display file type/extension column</p>
                </div>
                <Switch
                  checked={showType}
                  onCheckedChange={(value) => handleColumnVisibilityChange("type", value)}
                  disabled={isLoading}
                />
              </div>

              {/* Show Size Column */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-sm text-white">Show Size</label>
                  <p className="text-xs text-gray-500">Display file size column</p>
                </div>
                <Switch
                  checked={showSize}
                  onCheckedChange={(value) => handleColumnVisibilityChange("size", value)}
                  disabled={isLoading}
                />
              </div>

              {/* Show Modified Date Column */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-sm text-white">Show Modified Date</label>
                  <p className="text-xs text-gray-500">Display last modification date column</p>
                </div>
                <Switch
                  checked={showModified}
                  onCheckedChange={(value) => handleColumnVisibilityChange("modified", value)}
                  disabled={isLoading}
                />
              </div>

              {/* Show Permissions Column */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-sm text-white">Show Permissions</label>
                  <p className="text-xs text-gray-500">Display file permissions column</p>
                </div>
                <Switch
                  checked={showPermissions}
                  onCheckedChange={(value) => handleColumnVisibilityChange("permissions", value)}
                  disabled={isLoading}
                />
              </div>

              {/* Show Owner Column */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-sm text-white">Show Owner</label>
                  <p className="text-xs text-gray-500">Display file owner column</p>
                </div>
                <Switch
                  checked={showOwner}
                  onCheckedChange={(value) => handleColumnVisibilityChange("owner", value)}
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Display Size Setting */}
        <div className="p-4 rounded-lg bg-[var(--color-sidebar-bg)] border border-[var(--color-dark-border)]">
          <div className="space-y-3">
            <div className="space-y-0.5">
              <label className="text-sm font-medium text-white">
                Display Size
              </label>
              <p className="text-xs text-gray-400">
                Adjust icon size, text size, and spacing in file manager
              </p>
            </div>
            <Select
              value={displaySize}
              onValueChange={handleDisplaySizeChange}
              disabled={isLoading}
            >
              <SelectTrigger className="w-full max-w-xs bg-[var(--color-dark-bg)] border-[var(--color-dark-border)] text-gray-300">
                <SelectValue placeholder="Select size" />
              </SelectTrigger>
              <SelectContent className="bg-[var(--color-dark-bg)] border-[var(--color-dark-border)]">
                <SelectItem
                  value="small"
                  className="text-gray-300 hover:bg-[var(--color-sidebar-accent)] hover:text-white focus:bg-[var(--color-sidebar-accent)] focus:text-white"
                >
                  Small
                </SelectItem>
                <SelectItem
                  value="medium"
                  className="text-gray-300 hover:bg-[var(--color-sidebar-accent)] hover:text-white focus:bg-[var(--color-sidebar-accent)] focus:text-white"
                >
                  Medium
                </SelectItem>
                <SelectItem
                  value="large"
                  className="text-gray-300 hover:bg-[var(--color-sidebar-accent)] hover:text-white focus:bg-[var(--color-sidebar-accent)] focus:text-white"
                >
                  Large
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 italic">
              {displaySize === "small"
                ? "Small: Compact layout with smaller icons and text"
                : displaySize === "medium"
                ? "Medium: Default size with balanced icon and text sizes"
                : "Large: Spacious layout with larger icons and text"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
