import { Terminal, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TerminalErrorStateProps {
  error: string;
  errorCode?: string;
  onRetry?: () => void;
  onClose?: () => void;
}

export function TerminalErrorState({
  error,
  errorCode,
  onRetry,
  onClose,
}: TerminalErrorStateProps) {
  // Provide helpful troubleshooting hints based on error code
  const getTroubleshootingHint = () => {
    if (!errorCode) return null;

    switch (errorCode) {
      case "DATA_LOCKED":
        return "Please log in again to unlock your data and access the terminal.";
      case "SHELL_NOT_FOUND":
        return "The default shell could not be found on your system. Please check your system configuration.";
      case "SHELL_PERMISSION_DENIED":
        return "Permission denied to start the shell. Please check your user permissions.";
      case "PTY_SPAWN_ERROR":
        return "Failed to create a terminal session. This may be due to system resource limitations.";
      case "INTERNAL_ERROR":
        return "An unexpected error occurred. Please try again or contact support if the issue persists.";
      default:
        return "Please try reconnecting or contact support if the issue persists.";
    }
  };

  return (
    <div className="flex items-center justify-center w-full h-full bg-[var(--color-dark-bg)]">
      <div className="flex flex-col items-center gap-6 text-center max-w-md p-8">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-[var(--color-dark-card)] flex items-center justify-center">
            <Terminal
              className="w-10 h-10"
              style={{ color: "var(--color-muted)" }}
            />
          </div>
          <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[var(--color-destructive)] flex items-center justify-center border-2 border-[var(--color-dark-bg)]">
            <AlertCircle className="w-4 h-4 text-white" />
          </div>
        </div>

        <div className="space-y-3">
          <h3
            className="text-lg font-semibold"
            style={{ color: "var(--color-foreground)" }}
          >
            Terminal Connection Error
          </h3>
          <p
            className="text-sm font-medium"
            style={{ color: "var(--color-destructive)" }}
          >
            {error}
          </p>
          {errorCode && (
            <p
              className="text-xs font-mono"
              style={{ color: "var(--color-muted)" }}
            >
              Error Code: {errorCode}
            </p>
          )}
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            {getTroubleshootingHint()}
          </p>
        </div>

        <div className="flex gap-3">
          {onRetry && (
            <Button
              onClick={onRetry}
              variant="default"
              size="sm"
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Retry Connection
            </Button>
          )}
          {onClose && (
            <Button onClick={onClose} variant="outline" size="sm">
              Close Terminal
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
