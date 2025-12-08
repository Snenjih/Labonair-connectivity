import React, { useState, useEffect } from "react";
import { Minus, Square, X, Copy } from "lucide-react";

export function WindowControls(): React.ReactElement {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (window.electronAPI?.windowIsMaximized) {
      window.electronAPI.windowIsMaximized().then((maximized: boolean) => {
        setIsMaximized(maximized);
      });
    }
  }, []);

  const handleMinimize = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent double-click handler on header
    if (window.electronAPI?.windowMinimize) {
      window.electronAPI.windowMinimize();
    }
  };

  const handleMaximize = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent double-click handler on header
    if (window.electronAPI?.windowMaximize) {
      window.electronAPI.windowMaximize();
      setIsMaximized(!isMaximized);
    }
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent double-click handler on header
    if (window.electronAPI?.windowClose) {
      window.electronAPI.windowClose();
    }
  };

  return (
    <div
      className="flex items-center h-full"
      style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
    >
      <button
        onClick={handleMinimize}
        className="h-full w-[46px] flex items-center justify-center hover:bg-white/10 transition-colors"
        title="Minimize"
      >
        <Minus className="h-3.5 w-3.5 text-white" />
      </button>
      <button
        onClick={handleMaximize}
        className="h-full w-[46px] flex items-center justify-center hover:bg-white/10 transition-colors"
        title={isMaximized ? "Restore" : "Maximize"}
      >
        {isMaximized ? (
          <Copy className="h-3 w-3 text-white" />
        ) : (
          <Square className="h-3.5 w-3.5 text-white" />
        )}
      </button>
      <button
        onClick={handleClose}
        className="h-full w-[46px] flex items-center justify-center hover:bg-red-600 transition-colors"
        title="Close"
      >
        <X className="h-3.5 w-3.5 text-white" />
      </button>
    </div>
  );
}
