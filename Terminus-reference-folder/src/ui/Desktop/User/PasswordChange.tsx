import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { Label } from "@/components/ui/label.tsx";
import { PasswordInput } from "@/components/ui/password-input.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert.tsx";
import { Key, AlertCircle, CheckCircle2 } from "lucide-react";
import { changePassword } from "@/ui/main-axios.ts";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface PasswordChangeProps {
  userInfo: {
    username: string;
    is_admin: boolean;
    is_oidc: boolean;
    totp_enabled: boolean;
  };
}

export function PasswordChange({ userInfo }: PasswordChangeProps) {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allFieldsFilled =
    currentPassword.trim() !== "" &&
    newPassword.trim() !== "" &&
    confirmPassword.trim() !== "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate that new password matches confirm password
    if (newPassword !== confirmPassword) {
      setError(t("common.passwordsDoNotMatch"));
      return;
    }

    // Validate minimum password length
    if (newPassword.length < 6) {
      setError(t("common.passwordMinLength"));
      return;
    }

    setLoading(true);

    try {
      await changePassword(currentPassword, newPassword);
      toast.success("Password changed successfully");
      // Clear all fields on success
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setError(null);
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.error || "Failed to change password";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-[var(--color-sidebar-bg)] border-[var(--color-dark-border)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Key className="w-5 h-5" />
          Change Password
        </CardTitle>
        <CardDescription className="text-gray-400">
          Update your account password. All encrypted data will be re-encrypted
          with the new password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current Password Field */}
          <div className="space-y-2">
            <Label htmlFor="current-password" className="text-gray-300">
              Current Password
            </Label>
            <PasswordInput
              id="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={loading}
              required
              autoComplete="current-password"
              className="bg-[var(--color-dark-bg)] border-[var(--color-dark-border)] text-gray-300"
            />
          </div>

          {/* New Password Field */}
          <div className="space-y-2">
            <Label htmlFor="new-password" className="text-gray-300">
              New Password
            </Label>
            <PasswordInput
              id="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={loading}
              required
              autoComplete="new-password"
              className="bg-[var(--color-dark-bg)] border-[var(--color-dark-border)] text-gray-300"
            />
          </div>

          {/* Confirm Password Field */}
          <div className="space-y-2">
            <Label htmlFor="confirm-password" className="text-gray-300">
              Confirm Password
            </Label>
            <PasswordInput
              id="confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              required
              autoComplete="new-password"
              className="bg-[var(--color-dark-bg)] border-[var(--color-dark-border)] text-gray-300"
            />
          </div>

          {/* Error Alert */}
          {error && (
            <Alert
              variant="destructive"
              className="bg-red-900/20 border-red-500/50"
            >
              <AlertCircle className="h-4 w-4 text-red-400" />
              <AlertTitle className="text-red-400">Error</AlertTitle>
              <AlertDescription className="text-red-300">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={!allFieldsFilled || loading}
            className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin mr-2 h-4 w-4 text-white inline-block"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
                Changing Password...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Change Password
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
