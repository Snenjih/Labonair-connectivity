import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Home, User, ChevronDown, ChevronUp, LogOut, Shield, Settings } from "lucide-react";
import { Tab } from "@/ui/Desktop/Navigation/Tabs/Tab.tsx";
import { useTabs } from "@/ui/Desktop/Navigation/Tabs/TabContext.tsx";
import { useTranslation } from "react-i18next";
import { TabDropdown } from "@/ui/Desktop/Navigation/Tabs/TabDropdown.tsx";
import { isElectron, getUserInfo, logoutUser } from "@/ui/main-axios.ts";
import { getAuthToken } from "@/utils/auth-utils.ts";
import { WindowControls } from "@/ui/Desktop/Navigation/WindowControls.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";

interface TopNavbarProps {
  isTopbarOpen: boolean;
  setIsTopbarOpen: (open: boolean) => void;
  onOpenQuickConnect?: () => void;
}

export function TopNavbar({
  isTopbarOpen,
  setIsTopbarOpen,
  onOpenQuickConnect,
}: TopNavbarProps): React.ReactElement {
  const {
    tabs,
    currentTab,
    setCurrentTab,
    setSplitScreenTab,
    removeTab,
    allSplitScreenTab,
    addTab,
    reorderTabs,
  } = useTabs() as any;
  const { t } = useTranslation();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
      },
    })
  );

  const [platform, setPlatform] = useState<string | null>(null);
  const [username, setUsername] = useState<string>("User");
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState<boolean>(false);

  useEffect(() => {
    if (isElectron() && window.electronAPI?.getPlatform) {
      window.electronAPI.getPlatform().then((p: string) => {
        setPlatform(p);
      });
    }
  }, []);

  useEffect(() => {
    // Load user information only if authenticated
    const token = getAuthToken();
    if (!token) {
      // No token - user is not authenticated, skip API call
      return;
    }

    getUserInfo()
      .then((userInfo) => {
        setUsername(userInfo.username || "User");
        setIsAdmin(!!userInfo.is_admin);
      })
      .catch((error) => {
        console.error("Failed to load user info:", error);
      });
  }, []);

  // Dynamische Berechnung der Tab-Bar-Dimensionen basierend auf der Plattform
  const getTabBarDimensions = () => {
    const isMac = platform === "darwin";
    const isWin = platform === "win32";
    const isLinux = !isMac && !isWin && platform !== null;

    if (isMac) {
      return {
        height: "38px",
        leftPadding: "90px", // Platz für macOS Traffic Lights
        topOffset: "0rem",
        useFlexLayout: true,
      };
    } else if (isWin) {
      return {
        height: "38px",
        leftPadding: "0px",
        topOffset: "0rem",
        useFlexLayout: false,
      };
    } else {
      // Linux oder Browser
      return {
        height: "38px",
        leftPadding: "0px",
        topOffset: "0rem",
        useFlexLayout: false,
      };
    }
  };

  const dimensions = getTabBarDimensions();

  // Setze CSS-Variable für die Tab-Bar-Höhe, damit andere Komponenten sie nutzen können
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--tab-bar-height",
      dimensions.height
    );
    // Extrahiere die numerische Höhe für Berechnungen
    const heightValue = parseInt(dimensions.height);
    document.documentElement.style.setProperty(
      "--tab-bar-height-px",
      `${heightValue}`
    );
  }, [dimensions.height]);

  // Double-click handler for maximize/restore
  const handleHeaderDoubleClick = () => {
    if (isElectron() && window.electronAPI?.windowMaximize) {
      window.electronAPI.windowMaximize();
    }
  };

  const handleTabActivate = (tabId: number) => {
    setCurrentTab(tabId);
  };

  const handleTabSplit = (tabId: number) => {
    setSplitScreenTab(tabId);
  };

  const handleTabClose = (tabId: number) => {
    removeTab(tabId);
  };

  const handleTabRename = (tabId: number, newTitle: string) => {
    const tab = tabs.find((t: any) => t.id === tabId);
    if (tab) {
      tab.title = newTitle;
    }
  };

  const handleTabDuplicate = (tabId: number) => {
    const tab = tabs.find((t: any) => t.id === tabId);
    if (tab) {
      const newTab = { ...tab, id: undefined, title: tab.title };
      const id = addTab(newTab);
      setCurrentTab(id);
    }
  };

  const handleCloseOtherTabs = (keepTabId: number) => {
    tabs.forEach((tab: any) => {
      if (
        tab.id !== keepTabId &&
        (tab.type === "terminal" ||
          tab.type === "local_terminal" ||
          tab.type === "server" ||
          tab.type === "file_manager" ||
          tab.type === "admin" ||
          tab.type === "user_profile" ||
          tab.type === "settings" ||
          tab.type === "remote_editor")
      ) {
        removeTab(tab.id);
      }
    });
  };

  const isSplitScreenActive =
    Array.isArray(allSplitScreenTab) && allSplitScreenTab.length > 0;
  const currentTabObj = tabs.find((t: any) => t.id === currentTab);
  const currentTabIsHome = currentTabObj?.type === "home";
  const currentTabIsAdmin = currentTabObj?.type === "admin";
  const currentTabIsUserProfile = currentTabObj?.type === "user_profile";
  const currentTabIsSettings = currentTabObj?.type === "settings";

  const openHostManager = () => {
    if (isSplitScreenActive) return;
    // Set currentTab to null to show HostManager (no tab needed)
    setCurrentTab(null);
  };

  const settingsTab = tabs.find((t: any) => t.type === "settings");
  const openSettingsTab = () => {
    if (isSplitScreenActive) return;
    if (settingsTab) {
      setCurrentTab(settingsTab.id);
      return;
    }
    const id = addTab({ type: "settings", title: "Settings" } as any);
    setCurrentTab(id);
  };

  const adminTab = tabs.find((t: any) => t.type === "admin");
  const openAdminTab = () => {
    if (isSplitScreenActive) return;
    if (adminTab) {
      setCurrentTab(adminTab.id);
      return;
    }
    const id = addTab({ type: "admin" } as any);
    setCurrentTab(id);
  };

  const handleLogout = async () => {
    try {
      // Use the centralized logout function from main-axios.ts
      // This handles all cleanup and page reload
      await logoutUser();
    } catch (error) {
      // logoutUser already handles cleanup and reload even on error
      console.error("Logout error:", error);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = tabs.findIndex((tab: any) => tab.id === active.id);
      const newIndex = tabs.findIndex((tab: any) => tab.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        reorderTabs(oldIndex, newIndex);
      }
    }
  };

  return (
    <div>
      <div
        className="fixed z-10 w-[100%] bg-background transition-all duration-200 ease-linear flex flex-row transform-none m-0 p-0"
        style={{
          height: dimensions.height,
          top: dimensions.topOffset,
          WebkitAppRegion: isElectron() ? "drag" : "none",
        } as React.CSSProperties}
        onDoubleClick={handleHeaderDoubleClick}
      >
        {/* macOS Traffic Lights Placeholder */}
        {isElectron() && platform === "darwin" && (
          <div
            className="h-full flex items-center justify-start pl-3"
            style={{
              width: dimensions.leftPadding,
              WebkitAppRegion: "no-drag",
            } as React.CSSProperties}
          >
            {/* Placeholder for macOS traffic lights - they are rendered by the OS */}
          </div>
        )}

        {/* Tab Container - passt sich an die Plattform an */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={tabs.map((tab: any) => tab.id)}
            strategy={horizontalListSortingStrategy}
          >
            <div
              className="h-full pr-2 border-r-2 border-dark-border flex-1 flex items-center overflow-x-auto overflow-y-hidden gap-0 thin-scrollbar"
              style={{
                WebkitAppRegion: isElectron() ? "drag" : "none",
                marginLeft: !isElectron() || platform !== "darwin" ? "0" : "0", // Kein extra Margin, da leftPadding bereits den Platz schafft
                scrollBehavior: "smooth",
                userSelect: "none",
                WebkitUserSelect: "none"
              } as React.CSSProperties}
            >
              {tabs.map((tab: any) => {
            const isActive = tab.id === currentTab;
            const isSplit =
              Array.isArray(allSplitScreenTab) &&
              allSplitScreenTab.includes(tab.id);
            const isTerminal = tab.type === "terminal";
            const isLocalTerminal = tab.type === "local_terminal";
            const isServer = tab.type === "server";
            const isFileManager = tab.type === "file_manager";
            const isRemoteEditor = tab.type === "remote_editor";
            const isAdmin = tab.type === "admin";
            const isUserProfile = tab.type === "user_profile";
            const isSettings = tab.type === "settings";
            const isSplittable = isTerminal || isServer || isFileManager;
            const isSplitButtonDisabled =
              (isActive && !isSplitScreenActive) ||
              ((allSplitScreenTab?.length || 0) >= 3 && !isSplit);
            const disableSplit =
              !isSplittable ||
              isSplitButtonDisabled ||
              isActive ||
              currentTabIsHome ||
              currentTabIsAdmin ||
              currentTabIsUserProfile ||
              currentTabIsSettings;
            const disableActivate =
              isSplit ||
              ((tab.type === "home" ||
                tab.type === "admin" ||
                tab.type === "user_profile" ||
                tab.type === "settings") &&
                isSplitScreenActive);
            const disableClose = (isSplitScreenActive && isActive) || isSplit;
            const canClose =
              isTerminal ||
              isLocalTerminal ||
              isServer ||
              isFileManager ||
              isRemoteEditor ||
              isAdmin ||
              isUserProfile ||
              isSettings;
            return (
              <Tab
                key={tab.id}
                id={tab.id}
                tabType={tab.type}
                title={tab.title}
                isActive={isActive}
                onActivate={() => handleTabActivate(tab.id)}
                onClose={
                  canClose
                    ? () => handleTabClose(tab.id)
                    : undefined
                }
                onSplit={
                  isSplittable ? () => handleTabSplit(tab.id) : undefined
                }
                onRename={(newTitle) => handleTabRename(tab.id, newTitle)}
                onDuplicate={canClose ? () => handleTabDuplicate(tab.id) : undefined}
                onCloseOthers={() => handleCloseOtherTabs(tab.id)}
                canSplit={isSplittable}
                canClose={canClose}
                disableActivate={disableActivate}
                disableSplit={disableSplit}
                disableClose={disableClose}
                tabBarHeight={dimensions.height}
              />
            );
          })}
            </div>
          </SortableContext>
        </DndContext>

        {/* Action Buttons Container - passt sich dynamisch an */}
        <div
          className="flex items-center justify-center gap-1.5 px-2"
          style={{
            height: dimensions.height,
            WebkitAppRegion: "no-drag",
          } as React.CSSProperties}
        >
          {/* Home / Host Manager Button */}
          <Button
            variant="ghost"
            className="w-[24px] h-[24px] p-0 flex items-center justify-center hover:bg-transparent"
            title={t("nav.hostManager")}
            onClick={openHostManager}
            disabled={isSplitScreenActive}
          >
            <Home className="h-3.5 w-3.5" />
          </Button>

          {/* Profile Button with Dropdown */}
          <DropdownMenu open={profileDropdownOpen} onOpenChange={setProfileDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center gap-2 px-2 h-[24px] hover:bg-transparent"
                disabled={isSplitScreenActive}
              >
                <User className="h-3.5 w-3.5" />
                <span className="text-sm">{username}</span>
                {profileDropdownOpen ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48 bg-sidebar-accent text-sidebar-accent-foreground border border-border rounded-md shadow-2xl p-1"
              style={{ zIndex: "var(--z-dropdown)" }}
            >
              <DropdownMenuItem
                className="rounded px-2 py-1.5 hover:bg-white/15 hover:text-accent-foreground focus:bg-white/20 focus:text-accent-foreground cursor-pointer focus:outline-none text-sm flex items-center gap-2"
                onClick={openSettingsTab}
              >
                <Settings className="h-3.5 w-3.5" />
                Settings
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem
                  className="rounded px-2 py-1.5 hover:bg-white/15 hover:text-accent-foreground focus:bg-white/20 focus:text-accent-foreground cursor-pointer focus:outline-none text-sm flex items-center gap-2"
                  onClick={openAdminTab}
                >
                  <Shield className="h-3.5 w-3.5" />
                  Admin Panel
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator className="my-1 bg-white/10" />
              <DropdownMenuItem
                className="rounded px-2 py-1.5 hover:bg-destructive/20 focus:bg-destructive/30 cursor-pointer focus:outline-none text-sm flex items-center gap-2 text-[var(--destructive)]"
                onClick={handleLogout}
              >
                <LogOut className="h-3.5 w-3.5" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Tab Dropdown */}
          <TabDropdown />
        </div>

        {/* Windows Controls integrated in header - dynamische Höhe */}
        {isElectron() && platform === "win32" && (
          <div style={{ height: dimensions.height }}>
            <WindowControls />
          </div>
        )}
      </div>
    </div>
  );
}
