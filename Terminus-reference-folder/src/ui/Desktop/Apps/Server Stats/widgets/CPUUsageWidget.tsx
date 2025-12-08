import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Cpu, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface ServerMetric {
  id: number;
  timestamp: number;
  cpuUsage: number | null;
  [key: string]: any;
}

interface CPUUsageWidgetProps {
  metricsData: ServerMetric[];
  latestMetric: ServerMetric | null;
}

export function CPUUsageWidget({ metricsData, latestMetric }: CPUUsageWidgetProps) {
  // Prepare chart data
  const chartData = metricsData
    .filter(m => m.cpuUsage !== null)
    .map(m => ({
      timestamp: m.timestamp,
      value: m.cpuUsage,
    }));

  // Get current CPU usage
  const currentUsage = latestMetric?.cpuUsage;

  // Determine color based on usage
  const getUsageColor = (usage: number | null | undefined) => {
    if (usage === null || usage === undefined) return "text-gray-500";
    if (usage < 70) return "text-green-500";
    if (usage < 85) return "text-yellow-500";
    return "text-red-500";
  };

  const getChartColor = (usage: number | null | undefined) => {
    if (usage === null || usage === undefined) return "#6b7280";
    if (usage < 70) return "#10b981";
    if (usage < 85) return "#f59e0b";
    return "#ef4444";
  };

  // Error state
  if (!latestMetric || currentUsage === null) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
          <Cpu className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No CPU data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
        <Cpu className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className={`text-3xl font-bold ${getUsageColor(currentUsage)}`}>
          {currentUsage.toFixed(1)}%
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {currentUsage < 70 ? "Normal" : currentUsage < 85 ? "Elevated" : "High"} usage
        </p>

        {/* Chart */}
        {chartData.length > 1 && (
          <div className="mt-4">
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.3} />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(ts) => format(new Date(ts * 1000), 'HH:mm')}
                  stroke="var(--color-text-secondary)"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  stroke="var(--color-text-secondary)"
                  fontSize={12}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-card-bg)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                  }}
                  labelFormatter={(ts) => format(new Date(ts * 1000), 'PPpp')}
                  formatter={(value: any) => [`${value.toFixed(1)}%`, 'CPU']}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={getChartColor(currentUsage)}
                  strokeWidth={2}
                  dot={false}
                  animationDuration={300}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
