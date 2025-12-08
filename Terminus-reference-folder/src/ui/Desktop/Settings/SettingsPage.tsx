import React, { useState, useEffect } from "react";
import {
  SettingsSidebar,
  type SettingsCategory,
} from "@/ui/Desktop/Settings/SettingsSidebar.tsx";
import { ApplicationSettings } from "@/ui/Desktop/Settings/ApplicationSettings.tsx";
import { TerminalSettings } from "@/ui/Desktop/Settings/TerminalSettings.tsx";
import { FileManagerSettings } from "@/ui/Desktop/Settings/FileManagerSettings.tsx";
import { ColorSchemeSettings } from "@/ui/Desktop/Settings/ColorSchemeSettings.tsx";
import { ProfilesSecuritySettings } from "@/ui/Desktop/Settings/ProfilesSecuritySettings.tsx";

interface SettingsPageProps {
  isTopbarOpen?: boolean;
  username?: string | null;
  isAdmin?: boolean;
}

export function SettingsPage({ isTopbarOpen, username, isAdmin }: SettingsPageProps) {
  const [activeCategory, setActiveCategory] =
    useState<SettingsCategory>("application");

  // Verwende CSS-Variable für dynamische Tab-Bar-Höhe
  const [tabBarHeightPx, setTabBarHeightPx] = useState(38);

  useEffect(() => {
    const updateTabBarHeight = () => {
      const height = getComputedStyle(document.documentElement)
        .getPropertyValue("--tab-bar-height-px")
        .trim();
      const heightNum = parseInt(height) || 38;
      setTabBarHeightPx(heightNum);
    };

    updateTabBarHeight();
    const observer = new MutationObserver(updateTabBarHeight);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style"],
    });

    return () => observer.disconnect();
  }, []);

  const renderSettingsContent = () => {
    switch (activeCategory) {
      case "application":
        return <ApplicationSettings isAdmin={isAdmin} />;
      case "appearance":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Appearance Settings
              </h3>
              <p className="text-gray-400 text-sm">
                Customize the appearance of the application
              </p>
            </div>
            <div className="text-gray-400 text-sm">
              Appearance settings coming soon
            </div>
          </div>
        );
      case "colorScheme":
        return <ColorSchemeSettings />;
      case "profilesSecurity":
        return <ProfilesSecuritySettings username={username} />;
      case "terminal":
        return <TerminalSettings />;
      case "fileManager":
        return <FileManagerSettings />;
      case "hotkeys":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Hotkeys
              </h3>
              <p className="text-gray-400 text-sm">
                Configure keyboard shortcuts
              </p>
            </div>
            <div className="text-gray-400 text-sm">Hotkeys coming soon</div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className="flex w-full bg-[var(--color-dark-bg)]"
      style={{
        marginTop: isTopbarOpen ? `${tabBarHeightPx}px` : "0px",
        height: isTopbarOpen ? `calc(100vh - ${tabBarHeightPx}px)` : "100vh",
      }}
    >
      {/* Left Sidebar */}
      <SettingsSidebar
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
      />

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-4xl">{renderSettingsContent()}</div>
      </div>
    </div>
  );
}
