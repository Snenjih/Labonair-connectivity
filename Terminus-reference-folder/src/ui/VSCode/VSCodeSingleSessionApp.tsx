import { useState, useRef, useEffect } from "react";
import { Terminal } from "../Desktop/Apps/Terminal/Terminal";
import { FileManager } from "../Desktop/Apps/File Manager/FileManager";
import { ThemeProvider } from "@/components/theme-provider";
import type { SSHHost } from "@/types";
import "./VSCodeSingleSessionApp.css";

interface VSCodeSingleSessionAppProps {
  hostConfig: SSHHost;
}

type ViewType = "terminal" | "files" | "tunnels";

/**
 * VSCodeSingleSessionApp - Stripped-down React app for VS Code single-session mode
 *
 * This component provides a simplified interface for single-host sessions in VS Code.
 * Key differences from DesktopApp:
 * - No internal sidebar (VS Code TreeView handles navigation)
 * - No tab system (VS Code panels handle tabs)
 * - No TopNavbar with window controls
 * - Simple view switcher for terminal/files/tunnels
 * - Single host context (no host switching)
 */
export function VSCodeSingleSessionApp({ hostConfig }: VSCodeSingleSessionAppProps) {
  const [view, setView] = useState<ViewType>("terminal");
  const [isVisible, setIsVisible] = useState(true);
  const terminalRef = useRef<any>(null);

  // Update visibility when view changes
  useEffect(() => {
    setIsVisible(view === "terminal");
  }, [view]);

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vscode-terminus-theme">
      <div className="vscode-single-session">
        {/* Simple top bar with view switcher */}
        <div className="view-switcher">
          <div className="view-buttons">
            <button
              className={`view-button ${view === "terminal" ? "active" : ""}`}
              onClick={() => setView("terminal")}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M13.655 3.56L8.918.75a1.785 1.785 0 0 0-1.82 0L2.363 3.56a1.889 1.889 0 0 0-.921 1.628v5.624a1.889 1.889 0 0 0 .913 1.627l4.736 2.812a1.785 1.785 0 0 0 1.82 0l4.736-2.812a1.888 1.888 0 0 0 .913-1.627V5.188a1.889 1.889 0 0 0-.904-1.627zm-3.669 8.781v.404a.149.149 0 0 1-.07.12l-.239.136a.15.15 0 0 1-.144 0l-.238-.136a.149.149 0 0 1-.07-.12v-.405a.594.594 0 0 1-.224-.437.146.146 0 0 1 .053-.112l.17-.15a.138.138 0 0 1 .134-.03c.088.025.176.038.266.038a.463.463 0 0 0 .213-.044.149.149 0 0 0 .071-.13.166.166 0 0 0-.02-.084.162.162 0 0 0-.063-.059 1.145 1.145 0 0 0-.211-.086l-.062-.02a2.415 2.415 0 0 1-.582-.234.759.759 0 0 1-.255-.25.673.673 0 0 1-.09-.335.707.707 0 0 1 .094-.363.71.71 0 0 1 .278-.27v-.404a.15.15 0 0 1 .07-.12l.238-.137a.15.15 0 0 1 .145 0l.238.137a.15.15 0 0 1 .07.12v.405a.6.6 0 0 1 .224.437.146.146 0 0 1-.053.112l-.17.15a.138.138 0 0 1-.134.03.666.666 0 0 0-.266-.038.463.463 0 0 0-.213.044.149.149 0 0 0-.071.13.166.166 0 0 0 .02.084.162.162 0 0 0 .063.059c.068.031.138.058.211.086l.062.02c.226.076.407.153.582.234a.759.759 0 0 1 .255.25.673.673 0 0 1 .09.335.707.707 0 0 1-.094.363.71.71 0 0 1-.278.27z"/>
              </svg>
              Terminal
            </button>
            <button
              className={`view-button ${view === "files" ? "active" : ""}`}
              onClick={() => setView("files")}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M14.5 2H7.71l-.85-.85L6.51 1h-5l-.5.5v11l.5.5h13l.5-.5v-10l-.5-.5zm-.51 10.49H2V2h4.29l.85.85.35.15H14v9.49z"/>
              </svg>
              Files
            </button>
            <button
              className={`view-button ${view === "tunnels" ? "active" : ""}`}
              onClick={() => setView("tunnels")}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M8.5 3l.5-.5h3l.5.5v3l-.5.5h-3l-.5-.5V3zm.5 3h2V4H9v2zM6 6L3 3 2 4l3 3 1-1zm4 4l3 3 1-1-3-3-1 1zM3 8.5l-.5.5v3l.5.5h3l.5-.5v-3L6 8.5H3zm.5 3v-2h2v2h-2z"/>
              </svg>
              Tunnels
            </button>
          </div>
          <div className="host-info">
            <span className="host-name">{hostConfig.name || hostConfig.ip}</span>
            <span className="host-address">
              {hostConfig.username}@{hostConfig.ip}:{hostConfig.port}
            </span>
          </div>
        </div>

        {/* Content area */}
        <div className="content">
          {view === "terminal" && (
            <div className="terminal-view">
              <Terminal
                ref={terminalRef}
                hostConfig={hostConfig}
                isVisible={isVisible}
              />
            </div>
          )}
          {view === "files" && (
            <div className="files-view">
              <FileManager initialHost={hostConfig} />
            </div>
          )}
          {view === "tunnels" && (
            <div className="tunnels-view">
              <TunnelView host={hostConfig} />
            </div>
          )}
        </div>
      </div>
    </ThemeProvider>
  );
}

/**
 * TunnelView - Placeholder for tunnel management view
 * TODO: Implement full tunnel UI in future iteration
 */
function TunnelView({ host }: { host: SSHHost }) {
  return (
    <div className="tunnel-placeholder">
      <div className="placeholder-content">
        <svg
          width="48"
          height="48"
          viewBox="0 0 16 16"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M8.5 3l.5-.5h3l.5.5v3l-.5.5h-3l-.5-.5V3zm.5 3h2V4H9v2zM6 6L3 3 2 4l3 3 1-1zm4 4l3 3 1-1-3-3-1 1zM3 8.5l-.5.5v3l.5.5h3l.5-.5v-3L6 8.5H3zm.5 3v-2h2v2h-2z"/>
        </svg>
        <h3>SSH Tunnels</h3>
        <p>Tunnel management coming soon for {host.name || host.ip}</p>
        <p className="tunnel-info">
          Create and manage SSH tunnels to forward ports between your local machine and the remote server.
        </p>
      </div>
    </div>
  );
}
