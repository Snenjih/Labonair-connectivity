import React, { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Terminal, Folder } from "lucide-react";
import { getSSHHosts } from "@/ui/main-axios.ts";
import { useTabs } from "@/ui/Desktop/Navigation/Tabs/TabContext.tsx";

interface SSHHost {
  id: number;
  name: string;
  ip: string;
  port: number;
  username: string;
  folder: string;
  tags: string[];
  pin: boolean;
  authType: string;
  password?: string;
  key?: string;
  keyPassword?: string;
  keyType?: string;
  enableTerminal: boolean;
  enableTunnel: boolean;
  enableFileManager: boolean;
  defaultPath: string;
  tunnelConnections: any[];
  createdAt: string;
  updatedAt: string;
}

interface QuickConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QuickConnectModal({
  isOpen,
  onClose,
}: QuickConnectModalProps): React.ReactElement | null {
  const { t } = useTranslation();
  const { addTab } = useTabs();
  const [search, setSearch] = useState("");
  const [hosts, setHosts] = useState<SSHHost[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mode, setMode] = useState<"SSH" | "SFTP">("SSH");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setSelectedIndex(0);
      setMode("SSH");

      // Fetch hosts
      getSSHHosts()
        .then((data) => setHosts(data))
        .catch((err) => console.error("Failed to fetch hosts:", err));

      // Focus search input
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const filteredHosts = useMemo(() => {
    if (!search.trim()) return hosts;
    const q = search.trim().toLowerCase();
    return hosts.filter((h) => {
      const searchableText = [
        h.name || "",
        h.username,
        h.ip,
        h.folder || "",
        ...(h.tags || []),
      ]
        .join(" ")
        .toLowerCase();
      return searchableText.includes(q);
    });
  }, [hosts, search]);

  useEffect(() => {
    if (selectedIndex >= filteredHosts.length && filteredHosts.length > 0) {
      setSelectedIndex(filteredHosts.length - 1);
    } else if (filteredHosts.length === 0) {
      setSelectedIndex(0);
    }
  }, [filteredHosts.length, selectedIndex]);

  useEffect(() => {
    // Scroll selected item into view
    if (listRef.current) {
      const selectedElement = listRef.current.children[
        selectedIndex
      ] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({
          block: "nearest",
          behavior: "smooth",
        });
      }
    }
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Tab") {
      e.preventDefault();
      setMode((prev) => (prev === "SSH" ? "SFTP" : "SSH"));
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < filteredHosts.length - 1 ? prev + 1 : prev,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredHosts.length > 0 && filteredHosts[selectedIndex]) {
        handleConnect(filteredHosts[selectedIndex]);
      }
    }
  };

  const handleConnect = (host: SSHHost) => {
    const title = host.name?.trim()
      ? host.name
      : `${host.username}@${host.ip}:${host.port}`;

    if (mode === "SSH") {
      addTab({ type: "terminal", title, hostConfig: host });
    } else {
      addTab({ type: "file_manager", title, hostConfig: host });
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[999999] flex items-center justify-center pointer-events-auto"
      style={{
        backdropFilter: "blur(8px)",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
      }}
      onClick={onClose}
    >
      <div
        className="bg-dark-bg border-2 border-dark-border rounded-lg shadow-2xl w-full max-w-[90vw] min-w-[280px] sm:max-w-md md:max-w-lg lg:max-w-xl max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-3 sm:p-4 border-b-2 border-dark-border">
          <div className="flex-1 relative">
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder={t("placeholders.searchHostsAny")}
              className="w-full px-3 py-2 bg-dark-bg-input border-2 border-dark-border rounded-md text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              autoComplete="off"
            />
          </div>
          <div className="flex items-center justify-center gap-2 px-3 py-2 bg-dark-bg-input border-2 border-dark-border rounded-md whitespace-nowrap">
            <span className="text-sm font-medium text-white">{mode}</span>
            <span className="text-xs text-gray-500 hidden xs:inline">(Tab)</span>
          </div>
        </div>

        {/* Connection List */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto p-2"
          style={{ minHeight: "200px" }}
        >
          {filteredHosts.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              {search.trim()
                ? t("hosts.noHostsFound")
                : t("hosts.noHostsAvailable")}
            </div>
          ) : (
            filteredHosts.map((host, index) => {
              const isSelected = index === selectedIndex;
              const title = host.name?.trim()
                ? host.name
                : `${host.username}@${host.ip}:${host.port}`;
              const subtitle = `${host.username} @ ${host.ip}:${host.port}`;

              return (
                <div
                  key={host.id}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-blue-600/20 border-2 border-blue-500"
                      : "hover:bg-white/10 border-2 border-transparent"
                  }`}
                  onClick={() => handleConnect(host)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  {mode === "SSH" ? (
                    <Terminal className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  ) : (
                    <Folder className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white truncate">
                      {title}
                    </div>
                    <div className="text-sm text-gray-400 truncate">
                      {subtitle}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-2 sm:px-4 border-t-2 border-dark-border bg-dark-bg-darker">
          <div className="flex items-center justify-between gap-1 text-xs text-gray-500 flex-wrap sm:flex-nowrap">
            <span className="hidden sm:inline">↑↓ Navigate</span>
            <span className="hidden md:inline">Tab Switch Mode</span>
            <span>Enter Connect</span>
            <span>Esc Close</span>
          </div>
        </div>
      </div>
    </div>
  );
}
