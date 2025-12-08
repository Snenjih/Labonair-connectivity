import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Clock, AlertCircle } from "lucide-react";

interface ServerMetric {
  id: number;
  uptime: string | null;
  [key: string]: any;
}

interface UptimeWidgetProps {
  latestMetric: ServerMetric | null;
}

export function UptimeWidget({ latestMetric }: UptimeWidgetProps) {
  const uptime = latestMetric?.uptime;

  // Error state
  if (!latestMetric || !uptime) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Uptime</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No uptime data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Parse uptime string (from "uptime -p" command)
  // Example: "up 2 days, 5 hours, 30 minutes"
  const parseUptime = (uptimeStr: string): { display: string; lastReboot: string } => {
    // Remove "up " prefix if present
    const cleanUptime = uptimeStr.replace(/^up\s+/, '');

    // Calculate approximate last reboot time
    // This is a rough estimate based on parsing the uptime string
    const now = new Date();
    let totalMinutes = 0;

    // Extract days, hours, minutes
    const daysMatch = cleanUptime.match(/(\d+)\s+days?/);
    const hoursMatch = cleanUptime.match(/(\d+)\s+hours?/);
    const minutesMatch = cleanUptime.match(/(\d+)\s+minutes?/);

    if (daysMatch) totalMinutes += parseInt(daysMatch[1]) * 24 * 60;
    if (hoursMatch) totalMinutes += parseInt(hoursMatch[1]) * 60;
    if (minutesMatch) totalMinutes += parseInt(minutesMatch[1]);

    const lastRebootTime = new Date(now.getTime() - totalMinutes * 60 * 1000);
    const lastReboot = lastRebootTime.toLocaleString();

    return {
      display: cleanUptime,
      lastReboot,
    };
  };

  const { display, lastReboot } = parseUptime(uptime);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Uptime</CardTitle>
        <Clock className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-primary">
          {display}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Last reboot: {lastReboot}
        </p>
      </CardContent>
    </Card>
  );
}
