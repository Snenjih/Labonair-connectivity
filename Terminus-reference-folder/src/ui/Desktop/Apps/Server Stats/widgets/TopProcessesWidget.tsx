import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import { Activity, AlertCircle } from "lucide-react";

interface ServerMetric {
  id: number;
  processes: string | null;
  [key: string]: any;
}

interface TopProcessesWidgetProps {
  latestMetric: ServerMetric | null;
}

interface Process {
  comm: string;
  pid: string;
  user: string;
  cpu: string;
  mem: string;
}

export function TopProcessesWidget({ latestMetric }: TopProcessesWidgetProps) {
  // Parse processes data
  const parseProcesses = (processesStr: string | null): Process[] => {
    if (!processesStr) return [];

    try {
      const processesData = JSON.parse(processesStr);
      if (Array.isArray(processesData)) {
        return processesData.slice(0, 10); // Top 10 processes
      }
      return [];
    } catch (error) {
      console.error("Failed to parse processes data:", error);
      return [];
    }
  };

  const processes = parseProcesses(latestMetric?.processes || null);

  // Determine CPU usage color
  const getCPUColor = (cpu: string) => {
    const cpuNum = parseFloat(cpu);
    if (isNaN(cpuNum)) return "";
    if (cpuNum > 50) return "text-red-500";
    if (cpuNum > 25) return "text-yellow-500";
    return "";
  };

  // Determine memory usage color
  const getMemColor = (mem: string) => {
    const memNum = parseFloat(mem);
    if (isNaN(memNum)) return "";
    if (memNum > 50) return "text-red-500";
    if (memNum > 25) return "text-yellow-500";
    return "";
  };

  // Error state
  if (!latestMetric || processes.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Top Processes</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No process data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Top Processes</CardTitle>
        <Activity className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30%]">Process</TableHead>
              <TableHead className="w-[15%]">PID</TableHead>
              <TableHead className="w-[25%]">User</TableHead>
              <TableHead className="w-[15%] text-right">CPU%</TableHead>
              <TableHead className="w-[15%] text-right">MEM%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {processes.map((process, index) => (
              <TableRow key={`${process.pid}-${index}`}>
                <TableCell className="font-medium truncate max-w-[150px]">
                  {process.comm}
                </TableCell>
                <TableCell>{process.pid}</TableCell>
                <TableCell className="truncate max-w-[100px]">{process.user}</TableCell>
                <TableCell className={`text-right font-medium ${getCPUColor(process.cpu)}`}>
                  {process.cpu}%
                </TableCell>
                <TableCell className={`text-right font-medium ${getMemColor(process.mem)}`}>
                  {process.mem}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
