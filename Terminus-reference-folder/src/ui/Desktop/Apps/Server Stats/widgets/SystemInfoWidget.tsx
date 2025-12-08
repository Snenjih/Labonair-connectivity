import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Server, AlertCircle } from "lucide-react";

interface ServerMetric {
  id: number;
  systemInfo: string | null;
  [key: string]: any;
}

interface SystemInfoWidgetProps {
  latestMetric: ServerMetric | null;
}

interface SystemInfo {
  os?: string;
  kernel?: string;
  arch?: string;
  hostname?: string;
  [key: string]: string | undefined;
}

export function SystemInfoWidget({ latestMetric }: SystemInfoWidgetProps) {
  // Parse system info data
  const parseSystemInfo = (systemInfoStr: string | null): SystemInfo => {
    if (!systemInfoStr) return {};

    try {
      // If it's JSON, parse it
      if (systemInfoStr.startsWith('{')) {
        return JSON.parse(systemInfoStr);
      }

      // Otherwise, parse from "uname -a" output
      // Example: "Linux hostname 5.15.0-56-generic #62-Ubuntu SMP x86_64 GNU/Linux"
      const parts = systemInfoStr.split(/\s+/);

      return {
        os: parts[0] || 'Unknown',
        hostname: parts[1] || 'Unknown',
        kernel: parts[2] || 'Unknown',
        arch: parts[parts.length - 2] || 'Unknown',
      };
    } catch (error) {
      console.error("Failed to parse system info:", error);
      return {};
    }
  };

  const systemInfo = parseSystemInfo(latestMetric?.systemInfo || null);

  // Error state
  if (!latestMetric || Object.keys(systemInfo).length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">System Information</CardTitle>
          <Server className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No system information available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">System Information</CardTitle>
        <Server className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {systemInfo.os && (
            <div>
              <p className="text-xs text-muted-foreground">Operating System</p>
              <p className="text-sm font-medium">{systemInfo.os}</p>
            </div>
          )}
          {systemInfo.kernel && (
            <div>
              <p className="text-xs text-muted-foreground">Kernel Version</p>
              <p className="text-sm font-medium">{systemInfo.kernel}</p>
            </div>
          )}
          {systemInfo.arch && (
            <div>
              <p className="text-xs text-muted-foreground">Architecture</p>
              <p className="text-sm font-medium">{systemInfo.arch}</p>
            </div>
          )}
          {systemInfo.hostname && (
            <div>
              <p className="text-xs text-muted-foreground">Hostname</p>
              <p className="text-sm font-medium">{systemInfo.hostname}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
