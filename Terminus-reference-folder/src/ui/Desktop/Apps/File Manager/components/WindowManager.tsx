import React, { useState, useCallback, useRef } from "react";

export interface WindowInstance {
  id: string;
  title: string;
  component: React.ReactNode | ((windowId: string) => React.ReactNode);
  x: number;
  y: number;
  width: number;
  height: number;
  isMaximized: boolean;
  isMinimized: boolean;
  zIndex: number;
}

interface WindowManagerProps {
  children?: React.ReactNode;
}

interface WindowManagerContextType {
  windows: WindowInstance[];
  openWindow: (window: Omit<WindowInstance, "id" | "zIndex">) => string;
  closeWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  updateWindow: (id: string, updates: Partial<WindowInstance>) => void;
}

const WindowManagerContext =
  React.createContext<WindowManagerContextType | null>(null);

export function WindowManager({ children }: WindowManagerProps) {
  const [windows, setWindows] = useState<WindowInstance[]>([]);
  const nextZIndex = useRef(1000);
  const windowCounter = useRef(0);

  const openWindow = useCallback(
    (windowData: Omit<WindowInstance, "id" | "zIndex">) => {
      const id = `window-${++windowCounter.current}`;
      const zIndex = ++nextZIndex.current;

      const offset = (windows.length % 5) * 20;
      let adjustedX = windowData.x + offset;
      let adjustedY = windowData.y + offset;

      const maxX = Math.max(0, window.innerWidth - windowData.width - 20);
      const maxY = Math.max(0, window.innerHeight - windowData.height - 20);

      adjustedX = Math.max(20, Math.min(adjustedX, maxX));
      adjustedY = Math.max(20, Math.min(adjustedY, maxY));

      const newWindow: WindowInstance = {
        ...windowData,
        id,
        zIndex,
        x: adjustedX,
        y: adjustedY,
      };

      setWindows((prev) => [...prev, newWindow]);
      return id;
    },
    [windows.length],
  );

  const closeWindow = useCallback((id: string) => {
    setWindows((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const minimizeWindow = useCallback((id: string) => {
    setWindows((prev) =>
      prev.map((w) =>
        w.id === id ? { ...w, isMinimized: !w.isMinimized } : w,
      ),
    );
  }, []);

  const maximizeWindow = useCallback((id: string) => {
    setWindows((prev) =>
      prev.map((w) =>
        w.id === id ? { ...w, isMaximized: !w.isMaximized } : w,
      ),
    );
  }, []);

  const focusWindow = useCallback((id: string) => {
    setWindows((prev) => {
      const targetWindow = prev.find((w) => w.id === id);
      if (!targetWindow) return prev;

      // Normalize z-indices to prevent unbounded growth
      // Sort windows by current z-index
      const sortedWindows = [...prev].sort((a, b) => a.zIndex - b.zIndex);

      // Re-assign z-indices starting from 1000 with increments of 10
      const BASE_Z_INDEX = 1000;
      const Z_INDEX_INCREMENT = 10;

      const normalizedWindows = sortedWindows.map((w, index) => ({
        ...w,
        zIndex: BASE_Z_INDEX + index * Z_INDEX_INCREMENT,
      }));

      // Assign the focused window the highest z-index
      const maxZIndex = BASE_Z_INDEX + (normalizedWindows.length - 1) * Z_INDEX_INCREMENT;
      nextZIndex.current = maxZIndex + Z_INDEX_INCREMENT;

      return normalizedWindows.map((w) =>
        w.id === id ? { ...w, zIndex: nextZIndex.current } : w,
      );
    });
  }, []);

  const updateWindow = useCallback(
    (id: string, updates: Partial<WindowInstance>) => {
      setWindows((prev) =>
        prev.map((w) => (w.id === id ? { ...w, ...updates } : w)),
      );
    },
    [],
  );

  const contextValue: WindowManagerContextType = {
    windows,
    openWindow,
    closeWindow,
    minimizeWindow,
    maximizeWindow,
    focusWindow,
    updateWindow,
  };

  return (
    <WindowManagerContext.Provider value={contextValue}>
      {children}
      <div className="window-container">
        {windows.map((window) => (
          <div key={window.id}>
            {typeof window.component === "function"
              ? window.component(window.id)
              : window.component}
          </div>
        ))}
      </div>
    </WindowManagerContext.Provider>
  );
}

export function useWindowManager() {
  const context = React.useContext(WindowManagerContext);
  if (!context) {
    throw new Error("useWindowManager must be used within a WindowManager");
  }
  return context;
}
