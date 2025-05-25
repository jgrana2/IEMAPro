import { useState, useEffect, useCallback, useRef } from "react";

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export function useWebSocket() {
  const [wsStatus, setWsStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback((url?: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setWsStatus('connecting');
    
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = url || `${protocol}//${window.location.host}/ws`;
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setWsStatus('connected');
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          setLastMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setWsStatus('disconnected');
        wsRef.current = null;

        // Attempt to reconnect if not a manual disconnect
        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect(url);
          }, delay);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setWsStatus('disconnected');
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setWsStatus('disconnected');
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }
    
    setWsStatus('disconnected');
    reconnectAttempts.current = 0;
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(message));
        return true;
      } catch (error) {
        console.error('Failed to send WebSocket message:', error);
        return false;
      }
    } else {
      console.warn('WebSocket is not connected');
      return false;
    }
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    wsStatus,
    lastMessage,
    connect,
    disconnect,
    sendMessage,
  };
}
