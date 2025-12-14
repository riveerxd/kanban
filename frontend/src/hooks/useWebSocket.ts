import { useEffect, useState, useRef, useCallback } from 'react';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8181';

interface UseWebSocketOptions {
  boardId: number | null;
  token: string | null;
  onMessage?: (message: any) => void;
}

export function useWebSocket({ boardId, token, onMessage }: UseWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isCleaningUpRef = useRef(false);
  const maxReconnectAttempts = 10;
  const baseDelay = 1000;

  useEffect(() => {
    if (!boardId || !token) {
      return;
    }

    isCleaningUpRef.current = false;

    const connect = () => {
      // Don't connect if we're cleaning up or already have an active connection
      if (isCleaningUpRef.current) return;
      if (socketRef.current?.readyState === WebSocket.OPEN ||
          socketRef.current?.readyState === WebSocket.CONNECTING) {
        return;
      }

      try {
        const ws = new WebSocket(`${WS_URL}?boardId=${boardId}&token=${encodeURIComponent(token)}`);

        ws.onopen = () => {
          if (isCleaningUpRef.current) {
            ws.close();
            return;
          }
          console.log('WebSocket connected');
          setIsConnected(true);
          reconnectAttemptsRef.current = 0;
        };

        ws.onclose = () => {
          // Don't reconnect if we're intentionally cleaning up
          if (isCleaningUpRef.current) {
            return;
          }

          console.log('WebSocket disconnected');
          setIsConnected(false);
          socketRef.current = null;

          // Attempt reconnection with exponential backoff
          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            const delay = Math.min(baseDelay * Math.pow(2, reconnectAttemptsRef.current), 30000);
            console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`);

            reconnectTimeoutRef.current = setTimeout(() => {
              reconnectAttemptsRef.current++;
              connect();
            }, delay);
          } else {
            console.error('Max reconnection attempts reached');
          }
        };

        ws.onerror = () => {
          // Errors are followed by onclose, so no action needed here
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            onMessage?.(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        socketRef.current = ws;
      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
      }
    };

    connect();

    // Cleanup on unmount or when dependencies change
    return () => {
      isCleaningUpRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      reconnectAttemptsRef.current = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, token]);

  const requestLock = useCallback((resourceType: string, resourceId: number) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'lock.request',
        payload: { resourceType, resourceId }
      }));
    }
  }, []);

  const releaseLock = useCallback((resourceType: string, resourceId: number) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'lock.release',
        payload: { resourceType, resourceId }
      }));
    }
  }, []);

  return { isConnected, requestLock, releaseLock };
}
