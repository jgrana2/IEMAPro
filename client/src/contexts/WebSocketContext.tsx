import React, { createContext, useContext, ReactNode } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';

interface WebSocketContextType {
  wsStatus: 'connected' | 'disconnected' | 'connecting';
  lastMessage: any;
  ecgData: { [leadName: string]: number[] };
  heartRate: number;
  signalQuality: 'good' | 'poor' | 'noise';
  connect: (url?: string) => void;
  disconnect: () => void;
  sendMessage: (message: any) => boolean;
  sendADS1298Data: (rawData: number[], patientId?: string, sessionId?: string) => boolean;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const webSocket = useWebSocket();

  return (
    <WebSocketContext.Provider value={webSocket}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketContext() {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
}