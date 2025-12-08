import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { HardDrive, AlertCircle } from "lucide-react";

interface ServerMetric {
  id: number;
  diskUsage: string | null;
  [key: string]: any;
}

interface DiskUsageWidgetProps {
  latestMetric: ServerMetric | null;
}

interface DiskPartition {
  partition: string;
  used: string;
  total: string;
  percent: number;
}

export function DiskUsageWidget({ latestMetric }: DiskUsageWidgetProps) {
  // Parse disk usage data
  const parseDiskUsage = (diskUsageStr: string | null): DiskPartition[] => {
    if (!diskUsageStr) return [];

    try {
      const diskData = JSON.parse(diskUsageStr);
      return Object.entries(diskData).map(([partition, data]: [string, any]) => ({
        partition,
        used: data.used || 'N/A',
        total: data.total || 'N/A',
        percent: parseFloat(data.percent) || 0,
      }));
    } catch (error) {
      console.error("Failed to parse disk usage data:", error);
      return [];
    }
  };

  const partitions = parseDiskUsage(latestMetric?.diskUsage || null);

  // Determine color based on usage
  const getUsageColor = (percent: number) => {
    if (percent < 80) return "bg-green-500";
    if (percent < 90) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getTextColor = (percent: number) => {
    if (percent < 80) return "text-green-500";
    if (percent < 90) return "text-yellow-500";
    return "text-red-500";
  };

  // Error state
  if (!latestMetric || partitions.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Disk Usage</CardTitle>
          <HardDrive className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No disk data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Disk Usage</CardTitle>
        <HardDrive className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {partitions.map((partition) => (
            <div key={partition.partition} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{partition.partition}</span>
                <span className={`text-sm font-bold ${getTextColor(partition.percent)}`}>
                  {partition.percent.toFixed(1)}%
                </span>
              </div>
              <Progress value={partition.percent} className="h-2" indicatorClassName={getUsageColor(partition.percent)} />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{partition.used} used</span>
                <span>{partition.total} total</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
