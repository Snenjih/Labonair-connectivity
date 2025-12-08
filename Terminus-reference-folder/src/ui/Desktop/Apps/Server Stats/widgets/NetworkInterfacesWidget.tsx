import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Network, AlertCircle } from "lucide-react";

interface ServerMetric {
  id: number;
  networkData: string | null;
  [key: string]: any;
}

interface NetworkInterfacesWidgetProps {
  latestMetric: ServerMetric | null;
}

interface NetworkInterface {
  name: string;
  ip?: string;
  rxBytes?: string;
  txBytes?: string;
  status: "up" | "down";
}

export function NetworkInterfacesWidget({ latestMetric }: NetworkInterfacesWidgetProps) {
  // Parse network data
  const parseNetworkData = (networkDataStr: string | null): NetworkInterface[] => {
    if (!networkDataStr) return [];

    try {
      const networkData = JSON.parse(networkDataStr);
      if (Array.isArray(networkData)) {
        return networkData;
      }
      // If it's an object, convert to array
      return Object.entries(networkData).map(([name, data]: [string, any]) => ({
        name,
        ip: data.ip || 'N/A',
        rxBytes: data.rxBytes || data.rx || '0',
        txBytes: data.txBytes || data.tx || '0',
        status: data.status || 'unknown',
      }));
    } catch (error) {
      console.error("Failed to parse network data:", error);
      return [];
    }
  };

  const interfaces = parseNetworkData(latestMetric?.networkData || null);

  // Format bytes
  const formatBytes = (bytes: string) => {
    const num = parseFloat(bytes);
    if (isNaN(num)) return bytes;

    if (num < 1024) return `${num} B`;
    if (num < 1024 * 1024) return `${(num / 1024).toFixed(2)} KB`;
    if (num < 1024 * 1024 * 1024) return `${(num / 1024 / 1024).toFixed(2)} MB`;
    return `${(num / 1024 / 1024 / 1024).toFixed(2)} GB`;
  };

  // Error state
  if (!latestMetric || interfaces.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Network Interfaces</CardTitle>
          <Network className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No network data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Network Interfaces</CardTitle>
        <Network className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {interfaces.map((iface) => (
            <div key={iface.name} className="border border-border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{iface.name}</span>
                <Badge variant={iface.status === 'up' ? 'default' : 'secondary'}>
                  {iface.status}
                </Badge>
              </div>
              {iface.ip && (
                <p className="text-xs text-muted-foreground mb-2">IP: {iface.ip}</p>
              )}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">RX:</span>{" "}
                  <span className="font-medium">{formatBytes(iface.rxBytes || '0')}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">TX:</span>{" "}
                  <span className="font-medium">{formatBytes(iface.txBytes || '0')}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
