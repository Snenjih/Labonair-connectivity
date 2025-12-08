import React, { useState, useEffect } from "react";
import { HostManagerViewer } from "@/ui/Desktop/Apps/Host Manager/HostManagerViewer.tsx";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { HostManagerEditor } from "@/ui/Desktop/Apps/Host Manager/HostManagerEditor.tsx";
import { CredentialsManager } from "@/ui/Desktop/Apps/Credentials/CredentialsManager.tsx";
import { CredentialEditor } from "@/ui/Desktop/Apps/Credentials/CredentialEditor.tsx";
import { useTranslation } from "react-i18next";
import type { SSHHost, HostManagerProps } from "../../../types/index";

export function HostManager({
  onSelectView,
  isTopbarOpen,
}: HostManagerProps): React.ReactElement {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("host_viewer");
  const [editingHost, setEditingHost] = useState<SSHHost | null>(null);

  const [editingCredential, setEditingCredential] = useState<any | null>(null);

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

  const handleEditHost = (host: SSHHost) => {
    setEditingHost(host);
    setActiveTab("add_host");
  };

  const handleFormSubmit = (updatedHost?: SSHHost) => {
    setEditingHost(null);
    setActiveTab("host_viewer");
  };

  const handleEditCredential = (credential: any) => {
    setEditingCredential(credential);
    setActiveTab("add_credential");
  };

  const handleCredentialFormSubmit = () => {
    setEditingCredential(null);
    setActiveTab("credentials");
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value !== "add_host") {
      setEditingHost(null);
    }
    if (value !== "add_credential") {
      setEditingCredential(null);
    }
  };

  const topMarginPx = tabBarHeightPx;
  const leftMarginPx = 0;
  const bottomMarginPx = 0;

  return (
    <div>
      <div className="w-full">
        <div
          className="bg-dark-bg text-white flex flex-col min-h-0 overflow-hidden"
          style={{
            marginLeft: leftMarginPx,
            marginRight: leftMarginPx,
            marginTop: topMarginPx,
            marginBottom: bottomMarginPx,
            padding: "8px",
            height: `calc(100vh - ${topMarginPx + bottomMarginPx}px)`,
          }}
        >
          <Tabs
            value={activeTab}
            onValueChange={handleTabChange}
            className="flex-1 flex flex-col h-full min-h-0"
          >
            <TabsList className="bg-dark-bg border-2 border-dark-border mt-1.5 overflow-x-auto flex justify-start whitespace-nowrap scrollbar-thin w-full">
              <TabsTrigger value="host_viewer" className="text-xs sm:text-sm flex-shrink-0">
                {t("hosts.hostViewer")}
              </TabsTrigger>
              <TabsTrigger value="add_host" className="text-xs sm:text-sm flex-shrink-0">
                {editingHost
                  ? editingHost.id
                    ? t("hosts.editHost")
                    : t("hosts.cloneHost")
                  : t("hosts.addHost")}
              </TabsTrigger>
              <div className="h-6 w-px bg-dark-border mx-1 hidden sm:block"></div>
              <TabsTrigger value="credentials" className="text-xs sm:text-sm flex-shrink-0">
                {t("credentials.credentialsViewer")}
              </TabsTrigger>
              <TabsTrigger value="add_credential" className="text-xs sm:text-sm flex-shrink-0">
                {editingCredential
                  ? t("credentials.editCredential")
                  : t("credentials.addCredential")}
              </TabsTrigger>
            </TabsList>
            <TabsContent
              value="host_viewer"
              className="flex-1 flex flex-col h-full min-h-0"
            >
              <Separator className="p-0.25 -mt-0.5 mb-1" />
              <HostManagerViewer onEditHost={handleEditHost} />
            </TabsContent>
            <TabsContent
              value="add_host"
              className="flex-1 flex flex-col h-full min-h-0"
            >
              <Separator className="p-0.25 -mt-0.5 mb-1" />
              <div className="flex flex-col h-full min-h-0">
                <HostManagerEditor
                  editingHost={editingHost}
                  onFormSubmit={handleFormSubmit}
                />
              </div>
            </TabsContent>
            <TabsContent
              value="credentials"
              className="flex-1 flex flex-col h-full min-h-0"
            >
              <Separator className="p-0.25 -mt-0.5 mb-1" />
              <div className="flex flex-col h-full min-h-0 overflow-auto">
                <CredentialsManager onEditCredential={handleEditCredential} />
              </div>
            </TabsContent>
            <TabsContent
              value="add_credential"
              className="flex-1 flex flex-col h-full min-h-0"
            >
              <Separator className="p-0.25 -mt-0.5 mb-1" />
              <div className="flex flex-col h-full min-h-0">
                <CredentialEditor
                  editingCredential={editingCredential}
                  onFormSubmit={handleCredentialFormSubmit}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
