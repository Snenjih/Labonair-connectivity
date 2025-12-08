import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button.tsx";
import { useTranslation } from "react-i18next";
import {
  Home,
  X,
  Terminal as TerminalIcon,
  Server as ServerIcon,
  Folder as FolderIcon,
  User as UserIcon,
  Cog as CogIcon,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@radix-ui/react-dropdown-menu";
import { getSetting } from "@/ui/main-axios.ts";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface TabProps {
  id: number;
  tabType: string;
  title?: string;
  isActive?: boolean;
  onActivate?: () => void;
  onClose?: () => void;
  onSplit?: () => void;
  onRename?: (newTitle: string) => void;
  onDuplicate?: () => void;
  onCloseOthers?: () => void;
  canSplit?: boolean;
  canClose?: boolean;
  disableActivate?: boolean;
  disableSplit?: boolean;
  disableClose?: boolean;
  tabBarHeight?: string; // Optionale dynamische Höhe
}

export function Tab({
  id,
  tabType,
  title,
  isActive,
  onActivate,
  onClose,
  onRename,
  onDuplicate,
  onCloseOthers,
  canClose = false,
  disableActivate = false,
  disableClose = false,
  tabBarHeight = "38px", // Standard-Höhe
}: TabProps): React.ReactElement {
  const { t } = useTranslation();
  const [hideCloseButton, setHideCloseButton] = useState<boolean>(false);
  const [hideOptionsButton, setHideOptionsButton] = useState<boolean>(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(title || "");

  // Sortable setup
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: id });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [hideClose, hideOptions] = await Promise.all([
          getSetting("hide_close_button").catch(() => ({ value: "false" })),
          getSetting("hide_options_button").catch(() => ({ value: "false" })),
        ]);
        setHideCloseButton(hideClose.value === "true");
        setHideOptionsButton(hideOptions.value === "true");
      } catch (error) {
        console.error("Failed to load tab settings:", error);
      }
    };
    loadSettings();

    // Listen for settings changes
    const handleSettingsChange = (event: CustomEvent) => {
      const { setting, value } = event.detail;
      switch (setting) {
        case "hide_close_button":
          setHideCloseButton(value === true || value === "true");
          break;
        case "hide_options_button":
          setHideOptionsButton(value === true || value === "true");
          break;
      }
    };

    window.addEventListener("tab-settings-changed", handleSettingsChange as EventListener);

    return () => {
      window.removeEventListener("tab-settings-changed", handleSettingsChange as EventListener);
    };
  }, []);

  const handleRenameSubmit = () => {
    if (renameValue.trim() && onRename) {
      onRename(renameValue.trim());
    }
    setRenaming(false);
  };

  const handleRenameCancel = () => {
    setRenameValue(title || "");
    setRenaming(false);
  };

  const getTabIcon = () => {
    switch (tabType) {
      case "home":
        return <Home className="h-4 w-4" />;
      case "terminal":
      case "local_terminal":
        return <TerminalIcon className="h-4 w-4" />;
      case "server":
        return <ServerIcon className="h-4 w-4" />;
      case "file_manager":
      case "remote_editor":
        return <FolderIcon className="h-4 w-4" />;
      case "user_profile":
        return <UserIcon className="h-4 w-4" />;
      case "admin":
      case "settings":
        return <CogIcon className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getTabTitle = () => {
    if (title) return title;
    switch (tabType) {
      case "home":
        return t("nav.home");
      case "terminal":
      case "local_terminal":
        return t("nav.terminal");
      case "server":
        return t("nav.serverStats");
      case "file_manager":
        return t("nav.fileManager");
      case "remote_editor":
        return "Editor";
      case "user_profile":
        return t("nav.userProfile");
      case "admin":
        return t("nav.admin");
      case "settings":
        return "Settings";
      default:
        return "Tab";
    }
  };

  // Firefox-style floating active tab
  const activeTabStyle = isActive ? {
    marginTop: "-4px",
    height: `calc(${tabBarHeight} + 4px)`,
    borderTopLeftRadius: "8px",
    borderTopRightRadius: "8px",
    boxShadow: "0 -2px 4px rgba(0, 0, 0, 0.1)",
    borderBottom: "2px solid var(--color-primary)",
    backgroundColor: "var(--color-dark-bg)",
    position: "relative" as const,
    zIndex: 10,
  } : {
    backgroundColor: "var(--color-dark-bg-darkest)",
  };

  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const tabStyle = {
    ...activeTabStyle,
    ...sortableStyle,
    height: tabBarHeight,
    flex: "1 1 0",
    minWidth: "120px",
    maxWidth: "300px",
    WebkitAppRegion: "no-drag"
  } as React.CSSProperties;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`group flex items-center gap-2 px-3 border-t-[1px] border-[var(--color-dark-border)] cursor-pointer transition-all ${!isActive ? "hover:bg-[var(--color-dark-bg-active)]" : ""}`}
      style={tabStyle}
      onClick={!disableActivate ? onActivate : undefined}
    >
      {renaming ? (
        <input
          type="text"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleRenameSubmit();
            if (e.key === "Escape") handleRenameCancel();
          }}
          onBlur={handleRenameSubmit}
          autoFocus
          className="flex-1 bg-[var(--color-dark-bg)] border border-[var(--color-dark-border)] rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-[var(--color-primary)]"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <>
          {getTabIcon()}
          <span className="text-sm text-white truncate flex-1">{getTabTitle()}</span>

          {canClose && !hideOptionsButton && onRename && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="p-1 hover:bg-[var(--color-sidebar-accent)] rounded transition-all opacity-0 group-hover:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                  title="Tab Options"
                >
                  <MoreHorizontal className="h-3.5 w-3.5 text-gray-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="bottom"
                align="end"
                sideOffset={6}
                className="min-w-[160px] bg-sidebar-accent text-sidebar-accent-foreground border border-border rounded-md shadow-2xl p-1 z-[9999]"
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownMenuItem
                  className="rounded px-2 py-1.5 hover:bg-white/15 hover:text-accent-foreground focus:bg-white/20 focus:text-accent-foreground cursor-pointer focus:outline-none text-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenaming(true);
                  }}
                >
                  Rename
                </DropdownMenuItem>
                {onDuplicate && (
                  <DropdownMenuItem
                    className="rounded px-2 py-1.5 hover:bg-white/15 hover:text-accent-foreground focus:bg-white/20 focus:text-accent-foreground cursor-pointer focus:outline-none text-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicate();
                    }}
                  >
                    Duplicate
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  className="rounded px-2 py-1.5 hover:bg-white/15 hover:text-accent-foreground focus:bg-white/20 focus:text-accent-foreground cursor-pointer focus:outline-none text-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onClose) onClose();
                  }}
                >
                  Close
                </DropdownMenuItem>
                {onCloseOthers && (
                  <DropdownMenuItem
                    className="rounded px-2 py-1.5 hover:bg-white/15 hover:text-accent-foreground focus:bg-white/20 focus:text-accent-foreground cursor-pointer focus:outline-none text-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseOthers();
                    }}
                  >
                    Close Other Tabs
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {canClose && !hideCloseButton && onClose && (
            <button
              className="p-1 hover:bg-red-500/20 rounded transition-all opacity-0 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                if (!disableClose) onClose();
              }}
              disabled={disableClose}
              title="Close Tab"
            >
              <X className="h-3.5 w-3.5 text-gray-400 hover:text-red-400" />
            </button>
          )}
        </>
      )}
    </div>
  );
}
