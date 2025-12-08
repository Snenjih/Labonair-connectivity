import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import type { TabContextTab } from "../../../../types/index.js";
import {
  getSessionState,
  saveSessionState,
  deleteSessionState,
  getSetting,
} from "../../../main-axios.js";
import { getAuthToken } from "../../../../utils/auth-utils.js";

export type Tab = TabContextTab;

interface TabContextType {
  tabs: Tab[];
  currentTab: number | null;
  allSplitScreenTab: number[];
  addTab: (tab: Omit<Tab, "id">) => number;
  removeTab: (tabId: number) => void;
  setCurrentTab: (tabId: number) => void;
  setSplitScreenTab: (tabId: number) => void;
  getTab: (tabId: number) => Tab | undefined;
  updateHostConfig: (hostId: number, newHostConfig: any) => void;
  reorderTabs: (oldIndex: number, newIndex: number) => void;
}

const TabContext = createContext<TabContextType | undefined>(undefined);

export function useTabs() {
  const context = useContext(TabContext);
  if (context === undefined) {
    throw new Error("useTabs must be used within a TabProvider");
  }
  return context;
}

interface TabProviderProps {
  children: ReactNode;
}

export function TabProvider({ children }: TabProviderProps) {
  const { t } = useTranslation();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [currentTab, setCurrentTab] = useState<number | null>(null);
  const [allSplitScreenTab, setAllSplitScreenTab] = useState<number[]>([]);
  const nextTabId = useRef(1);
  const [sessionRestored, setSessionRestored] = useState(false);
  const autoOpenAttempted = useRef(false);

  function computeUniqueTitle(
    tabType: Tab["type"],
    desiredTitle: string | undefined,
  ): string {
    const defaultTitle =
      tabType === "server"
        ? t("nav.serverStats")
        : tabType === "file_manager"
          ? t("nav.fileManager")
          : tabType === "remote_editor"
            ? "File"
            : t("nav.terminal");
    const baseTitle = (desiredTitle || defaultTitle).trim();
    const match = baseTitle.match(/^(.*) \((\d+)\)$/);
    const root = match ? match[1] : baseTitle;

    const usedNumbers = new Set<number>();
    let rootUsed = false;
    tabs.forEach((t) => {
      if (!t.title) return;
      if (t.title === root) {
        rootUsed = true;
        return;
      }
      const m = t.title.match(
        new RegExp(
          `^${root.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")} \\((\\d+)\\)$`,
        ),
      );
      if (m) {
        const n = parseInt(m[1], 10);
        if (!isNaN(n)) usedNumbers.add(n);
      }
    });

    if (!rootUsed) return root;
    let n = 2;
    while (usedNumbers.has(n)) n += 1;
    return `${root} (${n})`;
  }

  const addTab = useCallback((tabData: Omit<Tab, "id">): number => {
    const id = nextTabId.current++;
    const needsUniqueTitle =
      tabData.type === "terminal" ||
      tabData.type === "local_terminal" ||
      tabData.type === "server" ||
      tabData.type === "file_manager" ||
      tabData.type === "remote_editor";
    const effectiveTitle = needsUniqueTitle
      ? computeUniqueTitle(tabData.type, tabData.title)
      : tabData.title || "";
    const newTab: Tab = {
      ...tabData,
      id,
      title: effectiveTitle,
      terminalRef:
        tabData.type === "terminal" || tabData.type === "local_terminal"
          ? React.createRef<any>()
          : undefined,
    };
    setTabs((prev) => [...prev, newTab]);
    setCurrentTab(id);
    setAllSplitScreenTab((prev) => prev.filter((tid) => tid !== id));
    return id;
  }, [tabs]);

  const removeTab = useCallback((tabId: number) => {
    const tab = tabs.find((t) => t.id === tabId);

    if (
      tab &&
      tab.terminalRef?.current &&
      typeof tab.terminalRef.current.disconnect === "function"
    ) {
      tab.terminalRef.current.disconnect();
    }

    setTabs((prev) => prev.filter((tab) => tab.id !== tabId));
    setAllSplitScreenTab((prev) => prev.filter((id) => id !== tabId));

    if (currentTab === tabId) {
      const remainingTabs = tabs.filter((tab) => tab.id !== tabId);
      if (remainingTabs.length > 0) {
        setCurrentTab(remainingTabs[0].id);
      } else {
        // If no tabs remain, set currentTab to null to show HostManager
        setCurrentTab(null);
      }
    }
  }, [tabs, currentTab]);

  const setSplitScreenTab = useCallback((tabId: number) => {
    setAllSplitScreenTab((prev) => {
      if (prev.includes(tabId)) {
        return prev.filter((id) => id !== tabId);
      } else if (prev.length < 3) {
        return [...prev, tabId];
      }
      return prev;
    });
  }, []);

  const getTab = useCallback((tabId: number) => {
    return tabs.find((tab) => tab.id === tabId);
  }, [tabs]);

  const updateHostConfig = useCallback((hostId: number, newHostConfig: any) => {
    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.hostConfig && tab.hostConfig.id === hostId) {
          return {
            ...tab,
            hostConfig: newHostConfig,
            title: newHostConfig.name?.trim()
              ? newHostConfig.name
              : `${newHostConfig.username}@${newHostConfig.ip}:${newHostConfig.port}`,
          };
        }
        return tab;
      }),
    );
  }, []);

  const reorderTabs = useCallback((oldIndex: number, newIndex: number) => {
    setTabs((prev) => {
      const newTabs = [...prev];
      const [movedTab] = newTabs.splice(oldIndex, 1);
      newTabs.splice(newIndex, 0, movedTab);
      return newTabs;
    });
  }, []);

  // Restore session state on mount
  useEffect(() => {
    const restoreSession = async () => {
      try {
        // Check if user is authenticated before attempting to restore session
        const token = getAuthToken();
        if (!token) {
          // No JWT token, skip session restoration
          setSessionRestored(true);
          return;
        }

        // Check if session restoration is enabled
        try {
          const restoreSetting = await getSetting("terminal_restore_sessions");
          const restoreEnabled = restoreSetting.value === "true" || restoreSetting.value === undefined;
          if (!restoreEnabled) {
            // Session restoration disabled, skip restoration
            setSessionRestored(true);
            return;
          }
        } catch (error) {
          // If setting doesn't exist, default to enabled (backward compatibility)
          console.debug("Session restore setting not found, defaulting to enabled");
        }

        const sessionData = await getSessionState();

        if (sessionData && sessionData.sessionData && sessionData.sessionData.length > 0) {
          const restoredTabs = sessionData.sessionData;

          if (restoredTabs.length > 0) {
            // Find max ID to set nextTabId correctly
            const maxId = Math.max(...restoredTabs.map((tab: any) => tab.id));
            nextTabId.current = maxId + 1;

            // Restore tabs with terminalRef for terminal/local_terminal types
            const tabsWithRefs = restoredTabs.map((tab: any) => ({
              ...tab,
              terminalRef:
                tab.type === "terminal" || tab.type === "local_terminal"
                  ? React.createRef<any>()
                  : undefined,
            }));

            setTabs(tabsWithRefs);

            // Set the first restored tab as current if available
            if (tabsWithRefs.length > 0) {
              setCurrentTab(tabsWithRefs[0].id);
            }

            // Clear the saved state after successful restoration
            await deleteSessionState();
          }
        }
      } catch (error) {
        // Silently fail if session restoration fails (e.g., auth error, network error)
        // This prevents error spam when user is not logged in
        console.debug("Session restoration skipped:", error);
      } finally {
        setSessionRestored(true);
      }
    };

    restoreSession();
  }, [t]);

  // Auto-open local terminal on startup if enabled
  useEffect(() => {
    // Only run once after session is restored
    if (!sessionRestored || autoOpenAttempted.current) return;

    const autoOpenLocalTerminal = async () => {
      try {
        // Check if user is authenticated before calling API
        const token = getAuthToken();
        if (!token) {
          // No JWT token, skip auto-open
          autoOpenAttempted.current = true;
          return;
        }

        const autoOpenSetting = await getSetting("terminal_auto_open_local");
        const autoOpenEnabled = autoOpenSetting.value === "true";

        if (autoOpenEnabled) {
          // Use a snapshot of current tabs to check if local terminal already exists
          // This check happens at the time of execution, not as a dependency
          const hasLocalTerminal = tabs.some(tab => tab.type === "local_terminal");

          if (!hasLocalTerminal) {
            // Add a local terminal tab
            addTab({ type: "local_terminal", title: t("nav.localTerminal") });
          }
        }

        // Mark that we've attempted auto-open to prevent re-running
        autoOpenAttempted.current = true;
      } catch (error) {
        // Setting doesn't exist or error occurred, skip auto-open
        console.debug("Auto-open local terminal setting not found or error:", error);
        autoOpenAttempted.current = true;
      }
    };

    autoOpenLocalTerminal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionRestored]);

  // Save session state when tabs change (but only after session has been restored)
  useEffect(() => {
    if (!sessionRestored) return;

    const saveSession = async () => {
      try {
        // Check if user is authenticated before saving session
        const token = getAuthToken();
        if (!token) {
          // No JWT token, skip session save
          return;
        }

        // Serialize tabs, excluding terminalRef
        const serializableTabs = tabs.map((tab) => {
          const { terminalRef, ...rest } = tab;
          return rest;
        });

        // Only save if we have tabs to save
        if (serializableTabs.length > 0) {
          await saveSessionState(serializableTabs);
        } else {
          // Delete session if no tabs to save
          await deleteSessionState();
        }
      } catch (error) {
        // Silently fail if session save fails (e.g., auth error, network error)
        console.debug("Session save skipped:", error);
      }
    };

    // Debounce the save operation
    const timeoutId = setTimeout(saveSession, 500);
    return () => clearTimeout(timeoutId);
  }, [tabs, sessionRestored]);

  // Save session on window/app close
  useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        // Check if user is authenticated before saving session
        const token = getAuthToken();
        if (!token) {
          // No JWT token, skip session save
          return;
        }

        // Serialize tabs, excluding terminalRef
        const serializableTabs = tabs.map((tab) => {
          const { terminalRef, ...rest } = tab;
          return rest;
        });

        // Use synchronous storage for beforeunload to ensure it completes
        if (serializableTabs.length > 0) {
          // Send a synchronous beacon request to save the session
          const data = JSON.stringify({ sessionData: serializableTabs });
          const blob = new Blob([data], { type: "application/json" });

          if (navigator.sendBeacon) {
            // Use sendBeacon for reliable data transmission during page unload
            // The backend accepts JWT as query parameter for sendBeacon compatibility
            const baseUrl = import.meta.env.VITE_API_URL || `http://localhost:${import.meta.env.VITE_API_PORT || 30001}`;
            const url = `${baseUrl}/session?token=${encodeURIComponent(token)}`;
            navigator.sendBeacon(url, blob);
          }
        }
      } catch (error) {
        console.debug("Session save on beforeunload skipped:", error);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [tabs]);

  const value: TabContextType = useMemo(() => ({
    tabs,
    currentTab,
    allSplitScreenTab,
    addTab,
    removeTab,
    setCurrentTab,
    setSplitScreenTab,
    getTab,
    updateHostConfig,
    reorderTabs,
  }), [tabs, currentTab, allSplitScreenTab, addTab, removeTab, setSplitScreenTab, getTab, updateHostConfig, reorderTabs]);

  return <TabContext.Provider value={value}>{children}</TabContext.Provider>;
}
