import React, { useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area.tsx";
import { executeQuickAction } from "@/ui/main-axios.ts";
import { toast } from "sonner";
import * as LucideIcons from "lucide-react";

interface QuickAction {
  id: string;
  label: string;
  command: string;
  icon?: string;
  requireConfirmation?: boolean;
  order?: number;
}

interface QuickActionsBarProps {
  quickActions: QuickAction[];
  hostId: number;
}

export function QuickActionsBar({ quickActions, hostId }: QuickActionsBarProps) {
  const [executingAction, setExecutingAction] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<QuickAction | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Sort actions by order
  const sortedActions = [...quickActions].sort((a, b) => (a.order || 0) - (b.order || 0));

  // Get icon component from lucide-react
  const getIconComponent = (iconName?: string) => {
    if (!iconName) return LucideIcons.Terminal;

    // @ts-ignore - Dynamic icon access
    const IconComponent = LucideIcons[iconName];
    return IconComponent || LucideIcons.Terminal;
  };

  // Handle quick action execution
  const handleExecuteAction = async (action: QuickAction) => {
    // Show confirmation dialog if required
    if (action.requireConfirmation) {
      setConfirmAction(action);
      setShowConfirmDialog(true);
      return;
    }

    // Execute directly
    await executeAction(action);
  };

  // Execute action
  const executeAction = async (action: QuickAction) => {
    try {
      setExecutingAction(action.id);
      const result = await executeQuickAction(hostId, action.id);

      if (result.success) {
        toast.success(`Successfully executed: ${action.label}`, {
          description: result.output ?
            (result.output.length > 100 ? result.output.substring(0, 100) + '...' : result.output)
            : undefined,
        });
      } else {
        toast.error(`Failed to execute: ${action.label}`, {
          description: result.error || 'Unknown error',
        });
      }
    } catch (error: any) {
      console.error("Failed to execute quick action:", error);
      toast.error(`Failed to execute: ${action.label}`, {
        description: error.message || 'Unknown error',
      });
    } finally {
      setExecutingAction(null);
      setShowConfirmDialog(false);
      setConfirmAction(null);
    }
  };

  // Handle confirmation dialog
  const handleConfirm = () => {
    if (confirmAction) {
      executeAction(confirmAction);
    }
  };

  const handleCancel = () => {
    setShowConfirmDialog(false);
    setConfirmAction(null);
  };

  return (
    <>
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-2 pb-2">
          {sortedActions.map((action) => {
            const Icon = getIconComponent(action.icon);
            const isExecuting = executingAction === action.id;

            return (
              <Button
                key={action.id}
                variant="outline"
                size="sm"
                onClick={() => handleExecuteAction(action)}
                disabled={isExecuting || executingAction !== null}
                className="flex-shrink-0"
              >
                <Icon className={`h-4 w-4 mr-2 ${isExecuting ? 'animate-spin' : ''}`} />
                {action.label}
              </Button>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Action</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to execute this command?
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirmAction && (
            <div className="my-4 p-4 bg-muted rounded-md">
              <p className="font-medium mb-2">{confirmAction.label}</p>
              <code className="text-sm text-muted-foreground">{confirmAction.command}</code>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>Execute</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
