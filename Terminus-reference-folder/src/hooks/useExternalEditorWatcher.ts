import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { getTempFileContent, saveRemoteFileContent, stopWatchingTempFile } from '@/ui/main-axios';

interface ExternalEditorEvent {
  watcherId: string;
  type: 'file_changed' | 'editor_opened' | 'editor_closed';
  filePath: string;
  remotePath: string;
  sessionId: string;
  timestamp: number;
  content?: string;
}

interface ActiveEditor {
  watcherId: string;
  remotePath: string;
  sessionId: string;
  fileName: string;
  hostId?: number;
  userId?: string;
}

export function useExternalEditorWatcher() {
  const [activeEditors, setActiveEditors] = useState<Map<string, ActiveEditor>>(new Map());
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000; // 3 seconds

  const connectWebSocket = useCallback(() => {
    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    // Clear any existing ping interval
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    try {
      // Connect to WebSocket server
      const ws = new WebSocket('ws://localhost:30005/');

      ws.onopen = () => {
        console.log('[EDITOR WS] Connected');
        setIsConnected(true);
        reconnectAttemptsRef.current = 0; // Reset on successful connection

        // Send ping every 30 seconds to keep connection alive
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          } else {
            if (pingIntervalRef.current) {
              clearInterval(pingIntervalRef.current);
              pingIntervalRef.current = null;
            }
          }
        }, 30000);
      };

      ws.onmessage = async (event) => {
        try {
          const data: ExternalEditorEvent = JSON.parse(event.data);

          // Ignore pong messages
          if (data.type === 'pong') {
            return;
          }

          console.log('[EDITOR WS] Message:', data);

          if (data.type === 'file_changed') {
            handleFileChanged(data);
          } else if (data.type === 'editor_opened') {
            console.log(`[EDITOR WS] Editor opened: ${data.remotePath}`);
          }
        } catch (error) {
          console.error('[EDITOR WS] Failed to parse message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[EDITOR WS] Error:', error);
      };

      ws.onclose = () => {
        console.log('[EDITOR WS] Disconnected');
        setIsConnected(false);

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Attempt reconnection
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          console.log(
            `[EDITOR WS] Reconnecting (${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`
          );
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, reconnectDelay);
        } else {
          console.error('[EDITOR WS] Max reconnect attempts reached');
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('[EDITOR WS] Connection error:', error);
      setIsConnected(false);
    }
  }, []);

  const handleFileChanged = useCallback(async (event: ExternalEditorEvent) => {
    const editor = activeEditors.get(event.watcherId);
    if (!editor) {
      console.warn('Received file change event for unknown editor:', event.watcherId);
      return;
    }

    // Show toast notification with action button
    toast.info(`File "${editor.fileName}" has been modified in external editor`, {
      duration: 10000, // 10 seconds
      action: {
        label: 'Upload Changes',
        onClick: async () => {
          try {
            // Get temp file content
            const result = await getTempFileContent(event.watcherId);

            if (!result.success) {
              toast.error('Failed to read modified file');
              return;
            }

            // Upload changes to remote server
            await saveRemoteFileContent(
              event.sessionId,
              event.remotePath,
              result.content,
              editor.hostId,
              editor.userId
            );

            toast.success(`Changes uploaded to ${event.remotePath}`);
          } catch (error) {
            console.error('Failed to upload changes:', error);
            toast.error('Failed to upload changes to server');
          }
        }
      },
      cancel: {
        label: 'Ignore',
        onClick: () => {
          toast.info('Changes ignored');
        }
      }
    });
  }, [activeEditors]);

  const registerEditor = useCallback((editor: ActiveEditor) => {
    setActiveEditors((prev) => {
      const newMap = new Map(prev);
      newMap.set(editor.watcherId, editor);
      return newMap;
    });
  }, []);

  const unregisterEditor = useCallback(async (watcherId: string) => {
    try {
      await stopWatchingTempFile(watcherId);
      setActiveEditors((prev) => {
        const newMap = new Map(prev);
        newMap.delete(watcherId);
        return newMap;
      });
    } catch (error) {
      console.error('Failed to stop watching temp file:', error);
    }
  }, []);

  const unregisterAllEditors = useCallback(async () => {
    const watchers = Array.from(activeEditors.keys());
    for (const watcherId of watchers) {
      await unregisterEditor(watcherId);
    }
  }, [activeEditors, unregisterEditor]);

  useEffect(() => {
    connectWebSocket();

    return () => {
      // Cleanup on unmount
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
      // Stop all watchers
      unregisterAllEditors();
    };
  }, [connectWebSocket]);

  return {
    isConnected,
    activeEditors: Array.from(activeEditors.values()),
    registerEditor,
    unregisterEditor,
    unregisterAllEditors
  };
}
