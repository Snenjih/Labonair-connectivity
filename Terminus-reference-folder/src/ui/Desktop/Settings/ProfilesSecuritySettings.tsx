import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { User, Shield, AlertCircle, User2 } from "lucide-react";
import { TOTPSetup } from "@/ui/Desktop/User/TOTPSetup.tsx";
import { getUserInfo, logoutUser, deleteAccount, isElectron } from "@/ui/main-axios.ts";
import { PasswordChange } from "@/ui/Desktop/User/PasswordChange.tsx";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/ui/Desktop/User/LanguageSwitcher.tsx";
import { PasswordInput } from "@/components/ui/password-input.tsx";

interface ProfilesSecuritySettingsProps {
  username?: string | null;
}

export function ProfilesSecuritySettings({ username }: ProfilesSecuritySettingsProps) {
  const { t } = useTranslation();
  const [userInfo, setUserInfo] = useState<{
    username: string;
    is_admin: boolean;
    is_oidc: boolean;
    totp_enabled: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    fetchUserInfo();
  }, []);

  const fetchUserInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      const info = await getUserInfo();
      setUserInfo({
        username: info.username,
        is_admin: info.is_admin,
        is_oidc: info.is_oidc,
        totp_enabled: info.totp_enabled || false,
      });
    } catch (err: any) {
      setError(err?.response?.data?.error || t("errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleTOTPStatusChange = (enabled: boolean) => {
    if (userInfo) {
      setUserInfo({ ...userInfo, totp_enabled: enabled });
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      if (isElectron()) {
        localStorage.removeItem("jwt");
      }
      window.location.reload();
    } catch (error) {
      console.error("Logout failed:", error);
      window.location.reload();
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteLoading(true);
    setDeleteError(null);

    if (!deletePassword.trim()) {
      setDeleteError(t("leftSidebar.passwordRequired"));
      setDeleteLoading(false);
      return;
    }

    try {
      await deleteAccount(deletePassword);
      handleLogout();
    } catch (err: any) {
      setDeleteError(
        err?.response?.data?.error || t("leftSidebar.failedToDeleteAccount"),
      );
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-pulse text-gray-300">
          {t("common.loading")}
        </div>
      </div>
    );
  }

  if (error || !userInfo) {
    return (
      <div className="p-6">
        <Alert variant="destructive" className="bg-red-900/20 border-red-500/50">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="text-red-400">{t("common.error")}</AlertTitle>
          <AlertDescription className="text-red-300">
            {error || t("errors.loadFailed")}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* User Profile Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">User Profile</h2>
          <div className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-[var(--color-sidebar-bg)] border border-[var(--color-dark-border)]">
            <User2 className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-white">
              {userInfo.username || username || t("common.account")}
            </span>
          </div>
        </div>

        <Separator className="bg-[var(--color-dark-border)]" />

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="mb-4 bg-[var(--color-sidebar-bg)] border-2 border-[var(--color-dark-border)]">
            <TabsTrigger
              value="profile"
              className="flex items-center gap-2 data-[state=active]:bg-[var(--color-dark-bg)]"
            >
              <User className="w-4 h-4" />
              {t("nav.userProfile")}
            </TabsTrigger>
            {!userInfo.is_oidc && (
              <TabsTrigger
                value="security"
                className="flex items-center gap-2 data-[state=active]:bg-[var(--color-dark-bg)]"
              >
                <Shield className="w-4 h-4" />
                {t("profile.security")}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
            <div className="rounded-lg border-2 border-[var(--color-dark-border)] bg-[var(--color-sidebar-bg)] p-4">
              <h3 className="text-lg font-semibold mb-4 text-white">
                {t("profile.accountInfo")}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-300">
                    {t("common.username")}
                  </Label>
                  <p className="text-lg font-medium mt-1 text-white">
                    {userInfo.username}
                  </p>
                </div>
                <div>
                  <Label className="text-gray-300">{t("profile.role")}</Label>
                  <p className="text-lg font-medium mt-1 text-white">
                    {userInfo.is_admin
                      ? t("interface.administrator")
                      : t("interface.user")}
                  </p>
                </div>
                <div>
                  <Label className="text-gray-300">
                    {t("profile.authMethod")}
                  </Label>
                  <p className="text-lg font-medium mt-1 text-white">
                    {userInfo.is_oidc
                      ? t("profile.external")
                      : t("profile.local")}
                  </p>
                </div>
                <div>
                  <Label className="text-gray-300">
                    {t("profile.twoFactorAuth")}
                  </Label>
                  <p className="text-lg font-medium mt-1">
                    {userInfo.is_oidc ? (
                      <span className="text-gray-400">
                        {t("auth.lockedOidcAuth")}
                      </span>
                    ) : userInfo.totp_enabled ? (
                      <span className="text-green-400 flex items-center gap-1">
                        <Shield className="w-4 h-4" />
                        {t("common.enabled")}
                      </span>
                    ) : (
                      <span className="text-gray-400">
                        {t("common.disabled")}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-[var(--color-dark-border)]">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-gray-300">
                      {t("common.language")}
                    </Label>
                    <p className="text-sm text-gray-400 mt-1">
                      {t("profile.selectPreferredLanguage")}
                    </p>
                  </div>
                  <LanguageSwitcher />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="security" className="space-y-4">
            {!userInfo.is_oidc && <PasswordChange userInfo={userInfo} />}

            <TOTPSetup
              isEnabled={userInfo.totp_enabled}
              onStatusChange={handleTOTPStatusChange}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Account Actions Section */}
      <div className="border-t border-[var(--color-dark-border)] pt-6">
        <h2 className="text-lg font-semibold text-white mb-4">Account Actions</h2>
        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start bg-[var(--color-sidebar-bg)] border-[var(--color-dark-border)] text-gray-300 hover:bg-[var(--color-sidebar-accent)] hover:text-white"
            onClick={handleLogout}
          >
            {t("common.logout")}
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start bg-[var(--color-sidebar-bg)] border-[var(--color-dark-border)] text-red-400 hover:bg-red-500/10 hover:text-red-300"
            onClick={() => setDeleteAccountOpen(true)}
          >
            {t("leftSidebar.deleteAccount")}
          </Button>
        </div>
      </div>

      {/* Delete Account Modal */}
      {deleteAccountOpen && (
        <div
          className="fixed top-0 left-0 right-0 bottom-0 z-[999999] pointer-events-auto isolate flex items-center justify-center"
          style={{
            transform: "translateZ(0)",
            background: "rgba(0, 0, 0, 0.5)",
          }}
          onClick={() => {
            setDeleteAccountOpen(false);
            setDeletePassword("");
            setDeleteError(null);
          }}
        >
          <div
            className="w-[400px] bg-dark-bg border-2 border-dark-border rounded-lg shadow-2xl relative isolate"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-dark-border">
              <h2 className="text-lg font-semibold text-white">
                {t("leftSidebar.deleteAccount")}
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDeleteAccountOpen(false);
                  setDeletePassword("");
                  setDeleteError(null);
                }}
                className="h-8 w-8 p-0 hover:bg-red-500 hover:text-white transition-colors"
              >
                <span className="text-lg font-bold">×</span>
              </Button>
            </div>

            <div className="p-4 space-y-4">
              <div className="text-sm text-gray-300">
                {t("leftSidebar.deleteAccountWarning")}
              </div>

              <Alert variant="destructive">
                <AlertTitle>{t("common.warning")}</AlertTitle>
                <AlertDescription>
                  {t("leftSidebar.deleteAccountWarningDetails")}
                </AlertDescription>
              </Alert>

              {deleteError && (
                <Alert variant="destructive">
                  <AlertTitle>{t("common.error")}</AlertTitle>
                  <AlertDescription>{deleteError}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleDeleteAccount} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="delete-password">
                    {t("leftSidebar.confirmPassword")}
                  </Label>
                  <PasswordInput
                    id="delete-password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder={t("placeholders.confirmPassword")}
                    required
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    type="submit"
                    variant="destructive"
                    className="flex-1"
                    disabled={deleteLoading || !deletePassword.trim()}
                  >
                    {deleteLoading
                      ? t("leftSidebar.deleting")
                      : t("leftSidebar.deleteAccount")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setDeleteAccountOpen(false);
                      setDeletePassword("");
                      setDeleteError(null);
                    }}
                  >
                    {t("leftSidebar.cancel")}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
