import { useState, useEffect, useCallback, useRef } from "react";
import { parseADS1298DataRaw, convertToECGFormat, calculateHeartRateFromSamples, type ParsedECGData } from '@/lib/ads1298-parser';

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

          // Handle ADS1298 ECG data
          if (message.type === 'ads1298_data' && message.rawData) {
            try {
              const parsedData: ParsedECGData = parseADS1298DataRaw(message.rawData);
              const leadData = convertToECGFormat(parsedData);
              const calculatedHeartRate = calculateHeartRateFromSamples(parsedData.samples, parsedData.sampleRate);

              // Update ECG data buffer with rolling window
              const maxBufferSize = 2500; // Keep ~5 seconds at 500Hz
              const newBuffer = { ...ecgBufferRef.current };

              Object.entries(leadData).forEach(([leadName, newSamples]) => {
                if (!newBuffer[leadName]) {
                  newBuffer[leadName] = [];
                }
                
                // Append new samples
                newBuffer[leadName] = [...newBuffer[leadName], ...newSamples];
                
                // Keep only the most recent samples
                if (newBuffer[leadName].length > maxBufferSize) {
                  newBuffer[leadName] = newBuffer[leadName].slice(-maxBufferSize);
                }
              });

              ecgBufferRef.current = newBuffer;
              setEcgData({ ...newBuffer });
              setHeartRate(calculatedHeartRate);
              setSignalQuality(parsedData.quality);

              console.log(`ECG data parsed: ${parsedData.samples.length} samples, HR: ${calculatedHeartRate}, Quality: ${parsedData.quality}`);
              console.log('Lead data keys:', Object.keys(leadData));
              console.log('Lead I data length:', leadData['Lead I']?.length || 0);
              console.log('Lead II data length:', leadData['Lead II']?.length || 0);
              
              // Check actual voltage values
              if (leadData['Lead I']?.length > 0) {
                console.log('Lead I sample values:', leadData['Lead I'].slice(-5)); // Last 5 values
              }
              if (leadData['Lead II']?.length > 0) {
                console.log('Lead II sample values:', leadData['Lead II'].slice(-5)); // Last 5 values
              }
            } catch (parseError) {
              console.error('Failed to parse ADS1298 data:', parseError);
            }
          }
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
