import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  Download,
  RefreshCw,
  Activity,
  Circle,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { getHostMetrics, getHostMetricsHistory, getHostStatus } from "@/ui/main-axios.ts";
import type { SSHHost } from "@/types/index.ts";
import { QuickActionsBar } from "./QuickActionsBar.tsx";
import { CPUUsageWidget } from "./widgets/CPUUsageWidget.tsx";
import { MemoryUsageWidget } from "./widgets/MemoryUsageWidget.tsx";
import { DiskUsageWidget } from "./widgets/DiskUsageWidget.tsx";
import { NetworkInterfacesWidget } from "./widgets/NetworkInterfacesWidget.tsx";
import { UptimeWidget } from "./widgets/UptimeWidget.tsx";
import { TopProcessesWidget } from "./widgets/TopProcessesWidget.tsx";
import { SystemInfoWidget } from "./widgets/SystemInfoWidget.tsx";
import { SSHLoginStatsWidget } from "./widgets/SSHLoginStatsWidget.tsx";

interface ServerStatsPageProps {
  hostConfig: SSHHost;
}

interface ServerMetric {
  id: number;
  hostId: number;
  userId: string;
  timestamp: number;
  cpuUsage: number | null;
  memoryUsage: number | null;
  diskUsage: string | null;
  networkData: string | null;
  uptime: string | null;
  processes: string | null;
  systemInfo: string | null;
  sshLogins: string | null;
}

interface HostStatus {
  status: "online" | "offline" | "unknown";
  lastCheck: number | null;
}

type TimeRange = "1h" | "6h" | "24h" | "7d" | "custom";

export function ServerStatsPage({ hostConfig }: ServerStatsPageProps) {
  const [metricsData, setMetricsData] = useState<ServerMetric[]>([]);
  const [hostStatus, setHostStatus] = useState<HostStatus>({ status: "unknown", lastCheck: null });
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  const [refreshing, setRefreshing] = useState(false);

  // Calculate start and end times based on time range
  const getTimeRangeBounds = useCallback((): { startTime: number; endTime: number } => {
    const now = Math.floor(Date.now() / 1000);
    let startTime: number;

    switch (timeRange) {
      case "1h":
        startTime = now - 3600;
        break;
      case "6h":
        startTime = now - 6 * 3600;
        break;
      case "24h":
        startTime = now - 24 * 3600;
        break;
      case "7d":
        startTime = now - 7 * 24 * 3600;
        break;
      default:
        startTime = now - 24 * 3600;
    }

    return { startTime, endTime: now };
  }, [timeRange]);

  // Fetch latest metrics
  const fetchLatestMetrics = useCallback(async () => {
    try {
      const { startTime, endTime } = getTimeRangeBounds();
      const metrics = await getHostMetricsHistory(hostConfig.id, startTime, endTime);
      setMetricsData(metrics);
      setLastUpdate(Date.now());
    } catch (error) {
      console.error("Failed to fetch metrics:", error);
      // Don't show error toast on auto-refresh to avoid spam
      if (!autoRefresh) {
        toast.error("Failed to fetch metrics data");
      }
    }
  }, [hostConfig.id, getTimeRangeBounds, autoRefresh]);

  // Fetch host status
  const fetchHostStatus = useCallback(async () => {
    try {
      const status = await getHostStatus(hostConfig.id);
      setHostStatus(status);
    } catch (error) {
      console.error("Failed to fetch host status:", error);
    }
  }, [hostConfig.id]);

  // Initial data fetch
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchLatestMetrics(), fetchHostStatus()]);
      setLoading(false);
    };
    loadData();
  }, [fetchLatestMetrics, fetchHostStatus]);

  // Auto-refresh logic
  useEffect(() => {
    if (!autoRefresh) return;

    const intervalId = setInterval(() => {
      fetchLatestMetrics();
      fetchHostStatus();
    }, 30000); // 30 seconds

    return () => clearInterval(intervalId);
  }, [autoRefresh, fetchLatestMetrics, fetchHostStatus]);

  // Manual refresh handler
  const handleManualRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchLatestMetrics(), fetchHostStatus()]);
    setRefreshing(false);
    toast.success("Metrics refreshed");
  };

  // Export as CSV
  const exportAsCSV = () => {
    try {
      const headers = ['Timestamp', 'CPU Usage (%)', 'Memory Usage (%)', 'Disk Usage', 'Uptime'];
      const rows = metricsData.map(m => [
        new Date(m.timestamp * 1000).toISOString(),
        m.cpuUsage?.toFixed(2) || 'N/A',
        m.memoryUsage?.toFixed(2) || 'N/A',
        m.diskUsage || 'N/A',
        m.uptime || 'N/A',
      ]);

      const csv = [headers, ...rows]
        .map(row => row.join(','))
        .join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${hostConfig.name || hostConfig.ip}-metrics-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Metrics exported as CSV");
    } catch (error) {
      console.error("Failed to export metrics:", error);
      toast.error("Failed to export metrics");
    }
  };

  // Export as JSON
  const exportAsJSON = () => {
    try {
      const json = JSON.stringify(metricsData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${hostConfig.name || hostConfig.ip}-metrics-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Metrics exported as JSON");
    } catch (error) {
      console.error("Failed to export metrics:", error);
      toast.error("Failed to export metrics");
    }
  };

  // Get status color
  const getStatusColor = () => {
    switch (hostStatus.status) {
      case "online":
        return "text-green-500";
      case "offline":
        return "text-red-500";
      default:
        return "text-gray-500";
    }
  };

  // Get enabled widgets from host config
  const enabledWidgets = hostConfig.enabledWidgets ?
    (typeof hostConfig.enabledWidgets === 'string' ? JSON.parse(hostConfig.enabledWidgets) : hostConfig.enabledWidgets)
    : ["cpu", "memory", "disk", "network", "uptime", "processes", "system_info", "ssh_logins"];

  // Get quick actions from host config
  const quickActions = hostConfig.quickActions ?
    (typeof hostConfig.quickActions === 'string' ? JSON.parse(hostConfig.quickActions) : hostConfig.quickActions)
    : [];

  // Get latest metric for widgets
  const latestMetric = metricsData.length > 0 ? metricsData[metricsData.length - 1] : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <Activity className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading server statistics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header Section */}
      <div className="flex-shrink-0 border-b border-border bg-[var(--color-card-bg)] p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Activity className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-semibold">
                {hostConfig.name || `${hostConfig.username}@${hostConfig.ip}`}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Circle className={`h-3 w-3 ${getStatusColor()} fill-current`} />
                <span className="text-sm text-muted-foreground capitalize">
                  {hostStatus.status}
                </span>
                {lastUpdate && (
                  <span className="text-xs text-muted-foreground">
                    • Updated {formatDistanceToNow(lastUpdate, { addSuffix: true })}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Time Range Selector */}
            <Select value={timeRange} onValueChange={(value) => setTimeRange(value as TimeRange)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last Hour</SelectItem>
                <SelectItem value="6h">Last 6 Hours</SelectItem>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
              </SelectContent>
            </Select>

            {/* Auto-Refresh Toggle */}
            <div className="flex items-center gap-2">
              <Switch
                id="auto-refresh"
                checked={autoRefresh}
                onCheckedChange={setAutoRefresh}
              />
              <Label htmlFor="auto-refresh" className="text-sm cursor-pointer">
                Auto-refresh
              </Label>
            </div>

            {/* Manual Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>

            {/* Export Button */}
            <Select onValueChange={(value) => value === 'csv' ? exportAsCSV() : exportAsJSON()}>
              <SelectTrigger className="w-[120px]">
                <Download className="h-4 w-4 mr-2" />
                Export
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">Export as CSV</SelectItem>
                <SelectItem value="json">Export as JSON</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Quick Actions Section */}
      {quickActions.length > 0 && (
        <div className="flex-shrink-0 border-b border-border bg-[var(--color-card-bg)] p-4">
          <QuickActionsBar quickActions={quickActions} hostId={hostConfig.id} />
        </div>
      )}

      {/* Widgets Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {metricsData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Activity className="h-16 w-16 text-muted-foreground" />
            <div className="text-center">
              <p className="text-lg font-medium">No metrics data available yet</p>
              <p className="text-sm text-muted-foreground mt-2">
                Metrics collection will begin shortly based on your configured interval.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {enabledWidgets.includes("cpu") && (
              <CPUUsageWidget metricsData={metricsData} latestMetric={latestMetric} />
            )}
            {enabledWidgets.includes("memory") && (
              <MemoryUsageWidget metricsData={metricsData} latestMetric={latestMetric} />
            )}
            {enabledWidgets.includes("disk") && (
              <DiskUsageWidget latestMetric={latestMetric} />
            )}
            {enabledWidgets.includes("network") && (
              <NetworkInterfacesWidget latestMetric={latestMetric} />
            )}
            {enabledWidgets.includes("uptime") && (
              <UptimeWidget latestMetric={latestMetric} />
            )}
            {enabledWidgets.includes("processes") && (
              <TopProcessesWidget latestMetric={latestMetric} />
            )}
            {enabledWidgets.includes("system_info") && (
              <SystemInfoWidget latestMetric={latestMetric} />
            )}
            {enabledWidgets.includes("ssh_logins") && (
              <SSHLoginStatsWidget latestMetric={latestMetric} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
