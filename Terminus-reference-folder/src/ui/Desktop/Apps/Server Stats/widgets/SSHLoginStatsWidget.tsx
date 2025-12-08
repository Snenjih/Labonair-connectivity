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
import { UserCheck, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface ServerMetric {
  id: number;
  sshLogins: string | null;
  [key: string]: any;
}

interface SSHLoginStatsWidgetProps {
  latestMetric: ServerMetric | null;
}

interface SSHLogin {
  user: string;
  ip: string;
  loginTime: string;
  duration?: string;
}

export function SSHLoginStatsWidget({ latestMetric }: SSHLoginStatsWidgetProps) {
  // Parse SSH logins data
  const parseSSHLogins = (sshLoginsStr: string | null): SSHLogin[] => {
    if (!sshLoginsStr) return [];

    try {
      const loginsData = JSON.parse(sshLoginsStr);
      if (Array.isArray(loginsData)) {
        return loginsData.slice(0, 10); // Last 10 logins
      }
      return [];
    } catch (error) {
      console.error("Failed to parse SSH logins data:", error);
      return [];
    }
  };

  const logins = parseSSHLogins(latestMetric?.sshLogins || null);

  // Format date/time
  const formatLoginTime = (timeStr: string) => {
    try {
      const date = new Date(timeStr);
      if (isNaN(date.getTime())) {
        // If not a valid date, return as-is
        return timeStr;
      }
      return format(date, 'MMM dd, HH:mm');
    } catch (error) {
      return timeStr;
    }
  };

  // Error state
  if (!latestMetric || logins.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">SSH Login Statistics</CardTitle>
          <UserCheck className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No SSH login data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">SSH Login Statistics</CardTitle>
        <UserCheck className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[25%]">User</TableHead>
              <TableHead className="w-[35%]">IP Address</TableHead>
              <TableHead className="w-[30%]">Login Time</TableHead>
              <TableHead className="w-[10%]">Duration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logins.map((login, index) => (
              <TableRow key={`${login.user}-${login.ip}-${index}`}>
                <TableCell className="font-medium">{login.user}</TableCell>
                <TableCell className="font-mono text-xs">{login.ip}</TableCell>
                <TableCell>{formatLoginTime(login.loginTime)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {login.duration || '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
