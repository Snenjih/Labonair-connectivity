import React from "react";
import { Button } from "./button";
import { AlertTriangle, Copy, RefreshCw, Home } from "lucide-react";
import { toast } from "sonner";

interface ErrorDisplayProps {
  error: Error | string;
  errorInfo?: React.ErrorInfo | any;
  componentName?: string;
  onRetry?: () => void;
  onGoHome?: () => void;
  showLogs?: boolean;
  additionalInfo?: Record<string, any>;
}

export function ErrorDisplay({
  error,
  errorInfo,
  componentName = "Application",
  onRetry,
  onGoHome,
  showLogs = true,
  additionalInfo,
}: ErrorDisplayProps) {
  const errorMessage = typeof error === "string" ? error : error.message;
  const errorStack =
    typeof error === "string" ? undefined : error.stack;

  const errorDetails = {
    component: componentName,
    error: errorMessage,
    stack: errorStack,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href,
    ...additionalInfo,
    ...(errorInfo && { componentStack: errorInfo.componentStack }),
  };

  const handleCopyError = () => {
    const errorText = JSON.stringify(errorDetails, null, 2);
    navigator.clipboard.writeText(errorText).then(() => {
      toast.success("Error details copied to clipboard");
    });
  };

  const handleCopySimple = () => {
    const simpleError = `Error in ${componentName}: ${errorMessage}`;
    navigator.clipboard.writeText(simpleError).then(() => {
      toast.success("Error message copied to clipboard");
    });
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[var(--color-dark-bg)] p-6">
      <div className="w-full max-w-2xl bg-[var(--color-dark-bg-darker)] border-2 border-red-500/50 rounded-lg shadow-xl">
        {/* Header */}
        <div className="p-6 border-b border-[var(--color-dark-border)] bg-red-500/10">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-red-500" />
            <div>
              <h1 className="text-xl font-bold text-white">
                An Error Occurred
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                Something went wrong in: <span className="font-mono text-red-400">{componentName}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Error Message */}
        <div className="p-6 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-300 mb-2">
              Error Message:
            </h2>
            <div className="p-4 bg-[var(--color-dark-bg)] border border-red-500/30 rounded-md">
              <p className="text-red-400 font-mono text-sm break-words">
                {errorMessage}
              </p>
            </div>
          </div>

          {/* Stack Trace (collapsible) */}
          {showLogs && errorStack && (
            <details className="group">
              <summary className="cursor-pointer text-sm font-semibold text-gray-300 hover:text-white transition-colors">
                <span className="inline-block group-open:rotate-90 transition-transform mr-2">
                  ▶
                </span>
                Stack Trace
              </summary>
              <div className="mt-2 p-4 bg-[var(--color-dark-bg)] border border-[var(--color-dark-border)] rounded-md max-h-64 overflow-auto">
                <pre className="text-xs text-gray-400 font-mono whitespace-pre-wrap break-words">
                  {errorStack}
                </pre>
              </div>
            </details>
          )}

          {/* Additional Info */}
          {additionalInfo && Object.keys(additionalInfo).length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-sm font-semibold text-gray-300 hover:text-white transition-colors">
                <span className="inline-block group-open:rotate-90 transition-transform mr-2">
                  ▶
                </span>
                Additional Information
              </summary>
              <div className="mt-2 p-4 bg-[var(--color-dark-bg)] border border-[var(--color-dark-border)] rounded-md max-h-64 overflow-auto">
                <pre className="text-xs text-gray-400 font-mono whitespace-pre-wrap">
                  {JSON.stringify(additionalInfo, null, 2)}
                </pre>
              </div>
            </details>
          )}

          {/* Error Details (Full JSON) */}
          {showLogs && (
            <details className="group">
              <summary className="cursor-pointer text-sm font-semibold text-gray-300 hover:text-white transition-colors">
                <span className="inline-block group-open:rotate-90 transition-transform mr-2">
                  ▶
                </span>
                Full Error Details (JSON)
              </summary>
              <div className="mt-2 p-4 bg-[var(--color-dark-bg)] border border-[var(--color-dark-border)] rounded-md max-h-64 overflow-auto">
                <pre className="text-xs text-gray-400 font-mono whitespace-pre-wrap">
                  {JSON.stringify(errorDetails, null, 2)}
                </pre>
              </div>
            </details>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-[var(--color-dark-border)] bg-[var(--color-dark-bg-darker)]/50">
          <div className="flex flex-wrap gap-3">
            {onRetry && (
              <Button
                onClick={onRetry}
                className="gap-2 bg-[var(--color-primary)] hover:opacity-90"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </Button>
            )}
            {onGoHome && (
              <Button
                onClick={onGoHome}
                variant="outline"
                className="gap-2 border-[var(--color-dark-border)] bg-[var(--color-dark-bg-button)] hover:bg-[var(--color-dark-hover)]"
              >
                <Home className="w-4 h-4" />
                Go to Home
              </Button>
            )}
            <Button
              onClick={handleCopySimple}
              variant="outline"
              className="gap-2 border-[var(--color-dark-border)] bg-[var(--color-dark-bg-button)] hover:bg-[var(--color-dark-hover)]"
            >
              <Copy className="w-4 h-4" />
              Copy Error
            </Button>
            <Button
              onClick={handleCopyError}
              variant="outline"
              className="gap-2 border-[var(--color-dark-border)] bg-[var(--color-dark-bg-button)] hover:bg-[var(--color-dark-hover)]"
            >
              <Copy className="w-4 h-4" />
              Copy Full Details
            </Button>
          </div>

          <p className="text-xs text-gray-500 mt-4">
            If this error persists, please copy the error details and report it to the development team.
          </p>
        </div>
      </div>
    </div>
  );
}
