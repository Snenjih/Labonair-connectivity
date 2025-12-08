import { Terminal, Info } from "lucide-react";

interface TerminalEmptyStateProps {
  message?: string;
  description?: string;
}

export function TerminalEmptyState({
  message = "Terminal Not Connected",
  description = "Click reconnect to establish a terminal session",
}: TerminalEmptyStateProps) {
  return (
    <div className="flex items-center justify-center w-full h-full bg-[var(--color-dark-bg)]">
      <div className="flex flex-col items-center gap-4 text-center max-w-md p-8">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-[var(--color-dark-card)] flex items-center justify-center">
            <Terminal
              className="w-10 h-10"
              style={{ color: "var(--color-muted)" }}
            />
          </div>
          <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[var(--color-dark-card)] flex items-center justify-center border-2 border-[var(--color-dark-bg)]">
            <Info
              className="w-4 h-4"
              style={{ color: "var(--color-primary)" }}
            />
          </div>
        </div>

        <div className="space-y-2">
          <h3
            className="text-lg font-semibold"
            style={{ color: "var(--color-foreground)" }}
          >
            {message}
          </h3>
          <p
            className="text-sm"
            style={{ color: "var(--color-muted)" }}
          >
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
