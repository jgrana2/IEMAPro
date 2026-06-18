import { useState, useEffect, useCallback, useRef } from "react";
import { convertToECGFormat, calculateHeartRateFromSamples, parseADS1298DataRaw, type ParsedECGData } from '@/lib/ads1298-parser';

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export function useWebSocket() {
  const [wsStatus, setWsStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [ecgData, setEcgData] = useState<{ [leadName: string]: number[] }>({});
  const [heartRate, setHeartRate] = useState<number>(0);
  const [signalQuality, setSignalQuality] = useState<'good' | 'poor' | 'noise'>('good');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const ecgBufferRef = useRef<{ [leadName: string]: number[] }>({});
  const ecgStateFrameRef = useRef<number | null>(null);

  const scheduleEcgStateFlush = useCallback(() => {
    if (ecgStateFrameRef.current !== null) {
      return;
    }

    ecgStateFrameRef.current = requestAnimationFrame(() => {
      ecgStateFrameRef.current = null;
      setEcgData({ ...ecgBufferRef.current });
    });
  }, []);

  const connect = useCallback((url?: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setWsStatus('connecting');
    
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    // Connect to Python backend on port 8000 for BLE functionality
    const pythonBackendHost = window.location.hostname === 'localhost' ? 'localhost:8000' : window.location.host;
    const wsUrl = url || `${protocol}//${pythonBackendHost}/ws`;
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsStatus('connected');
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          // console.log('WebSocket message received:', message);
          setLastMessage(message);

        // Handle ECG data from Python backend (both processed and raw)
        if (message.type === 'ecg_data' && message.leadData) {
          // Direct processed ECG data from Python backend
            const newBuffer = { ...ecgBufferRef.current };

            Object.entries(message.leadData).forEach(([leadName, newSamples]) => {
              if (!newBuffer[leadName]) {
                newBuffer[leadName] = [];
              }
              
              // Append new samples
              newBuffer[leadName] = [...newBuffer[leadName], ...(newSamples as number[])];
            });

            ecgBufferRef.current = newBuffer;
            scheduleEcgStateFlush();
            setHeartRate(message.heartRate || 60);
            setSignalQuality(message.quality || 'good');
          }
        } catch (error) {
          // Parse error handled silently
        }
      };

      ws.onclose = (event) => {
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
        setWsStatus('disconnected');
      };
    } catch (error) {
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

    if (ecgStateFrameRef.current !== null) {
      cancelAnimationFrame(ecgStateFrameRef.current);
      ecgStateFrameRef.current = null;
    }
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(message));
        return true;
      } catch (error) {
        return false;
      }
    } else {
      return false;
    }
  }, []);

  // Function to send ADS1298 data for testing or real data streaming
  const sendADS1298Data = useCallback((rawData: number[], patientId?: string, sessionId?: string) => {
    return sendMessage({
      type: 'ads1298_data',
      rawData,
      patientId,
      sessionId,
      deviceId: '00008171-0000-1000-8000-00805f9b34fb'
    });
  }, [sendMessage]);

  // Auto-connect on mount
  useEffect(() => {
    connect();
    
    return () => {
      if (ecgStateFrameRef.current !== null) {
        cancelAnimationFrame(ecgStateFrameRef.current);
        ecgStateFrameRef.current = null;
      }
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    wsStatus,
    lastMessage,
    ecgData,
    heartRate,
    signalQuality,
    connect,
    disconnect,
    sendMessage,
    sendADS1298Data,
  };
}
