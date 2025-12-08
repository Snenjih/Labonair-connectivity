import { StrictMode, useEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import DesktopApp from "./ui/Desktop/DesktopApp.tsx";
import { MobileApp } from "./ui/Mobile/MobileApp.tsx";
import { VSCodeSingleSessionApp } from "./ui/VSCode/VSCodeSingleSessionApp.tsx";
import { ThemeProvider } from "@/components/theme-provider";
import "./i18n/i18n";
import { isElectron, isVSCode, isSingleSessionMode } from "./ui/main-axios.ts";

function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const lastSwitchTime = useRef(0);
  const isCurrentlyMobile = useRef(window.innerWidth < 768);
  const hasSwitchedOnce = useRef(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const newWidth = window.innerWidth;
        const newIsMobile = newWidth < 768;
        const now = Date.now();

        if (hasSwitchedOnce.current && now - lastSwitchTime.current < 10000) {
          setWidth(newWidth);
          return;
        }

        if (
          newIsMobile !== isCurrentlyMobile.current &&
          now - lastSwitchTime.current > 5000
        ) {
          lastSwitchTime.current = now;
          isCurrentlyMobile.current = newIsMobile;
          hasSwitchedOnce.current = true;
          setWidth(newWidth);
          setIsMobile(newIsMobile);
        } else {
          setWidth(newWidth);
        }
      }, 2000);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return width;
}

function RootApp() {
  const width = useWindowWidth();
  const isMobile = width < 768;

  // Check if running in VS Code single-session mode
  const isSingleSession = isSingleSessionMode();
  const hostConfig = (window as any).HOST_CONFIG;

  // VS Code: Single session mode with host config
  if (isVSCode() && isSingleSession && hostConfig) {
    return <VSCodeSingleSessionApp hostConfig={hostConfig} />;
  }

  // Electron: Always desktop layout
  if (isElectron()) {
    return <DesktopApp />;
  }

  // Web: Responsive mobile/desktop
  return isMobile ? <MobileApp key="mobile" /> : <DesktopApp key="desktop" />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <RootApp />
    </ThemeProvider>
  </StrictMode>,
);
