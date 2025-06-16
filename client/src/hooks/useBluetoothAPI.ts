import { useState, useCallback, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

interface BluetoothDevice {
  id: string;
  name: string;
  rssi?: number;
  is_connected: boolean;
}

interface BluetoothAPIHookProps {
  onECGData?: (
    ecgData: { [leadName: string]: number[] },
    heartRate: number,
    quality: string,
  ) => void;
}

interface ECGDataMessage {
  ecg_data: { [leadName: string]: number[] };
  heart_rate: number;
  quality: "good" | "poor" | "noise";
  timestamp: number;
}

const API_BASE_URL = "http://localhost:3001";
const WS_URL = "ws://localhost:3002";

export function useBluetoothAPI({ onECGData }: BluetoothAPIHookProps = {}) {
  const [bleStatus, setBleStatus] = useState<
    "connected" | "disconnected" | "connecting"
  >("disconnected");
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [connectedDevice, setConnectedDevice] =
    useState<BluetoothDevice | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const { toast } = useToast();
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // API request helper with enhanced error handling
  const apiRequest = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    try {
      console.log(`Making API request: ${options.method || 'GET'} ${API_BASE_URL}${endpoint}`);
      
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });
      
      console.log(`API response status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        // Try to get error details from response
        let errorMessage = `API request failed: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
          // If we can't parse the error response, use the status text
        }
        throw new Error(errorMessage);
      }
      
      return response.json();
    } catch (error) {
      console.error(`API request error for ${endpoint}:`, error);
      
      // Check if it's a CORS error
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error - check if the Bluetooth server is running on port 3001');
      }
      
      throw error;
    }
  }, []);

  // WebSocket connection for ECG data
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('ECG WebSocket connected');
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message: ECGDataMessage = JSON.parse(event.data);
          
          if (onECGData) {
            onECGData(
              message.ecg_data,
              message.heart_rate,
              message.quality
            );
          }
        } catch (error) {
          console.error('Failed to parse ECG WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('ECG WebSocket disconnected:', event.code, event.reason);
        wsRef.current = null;

        // Attempt to reconnect if not a manual disconnect
        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connectWebSocket();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        console.error('ECG WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to create ECG WebSocket connection:', error);
    }
  }, [onECGData]);

  const disconnectWebSocket = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }
    
    reconnectAttempts.current = 0;
  }, []);

  const scanDevices = useCallback(async () => {
    try {
      setBleStatus("connecting");
      
      toast({
        title: "Scanning for Devices",
        description: "Looking for IoT Holter ECG devices...",
      });

      const response = await apiRequest("/devices");
      
      if (response.success && response.data) {
        setDevices(response.data);
        setBleStatus("disconnected");
        
        toast({
          title: "Device Scan Complete",
          description: `Found ${response.data.length} IoT Holter devices`,
        });
      } else {
        throw new Error(response.error || "Failed to scan devices");
      }
    } catch (error) {
      console.error("Device scan error:", error);
      setBleStatus("disconnected");
      
      toast({
        title: "Scan Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  }, [apiRequest, toast]);

  const connectDevice = useCallback(async (deviceId: string) => {
    try {
      setBleStatus("connecting");
      
      toast({
        title: "Connecting...",
        description: "Connecting to IoT Holter device",
      });

      const response = await apiRequest("/devices/connect", {
        method: "POST",
        body: JSON.stringify({ device_id: deviceId }),
      });

      if (response.success) {
        // Find the device in our list
        const device = devices.find(d => d.id === deviceId);
        if (device) {
          const connectedDev = { ...device, is_connected: true };
          setConnectedDevice(connectedDev);
          setDevices(prev => prev.map(d => 
            d.id === deviceId ? connectedDev : d
          ));
        }
        
        setBleStatus("connected");
        
        // Connect WebSocket for ECG data
        connectWebSocket();
        
        toast({
          title: "Device Connected",
          description: `Successfully connected to device`,
        });
      } else {
        throw new Error(response.error || "Failed to connect device");
      }
    } catch (error) {
      console.error("Device connection error:", error);
      setBleStatus("disconnected");
      
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  }, [apiRequest, devices, toast, connectWebSocket]);

  const disconnectDevice = useCallback(async () => {
    if (!connectedDevice) {
      toast({
        title: "No Device Connected",
        description: "There is no device currently connected to disconnect.",
        variant: "destructive",
      });
      return;
    }

    // Prevent duplicate disconnection handling
    if (isDisconnecting || bleStatus === "disconnected") {
      return;
    }

    setIsDisconnecting(true);

    try {
      console.log("Attempting to disconnect device:", connectedDevice.name);

      // Disconnect WebSocket first
      disconnectWebSocket();

      // Disconnect device via API
      const response = await apiRequest("/devices/disconnect", {
        method: "POST",
      });

      if (response.success) {
        // Update local state
        setDevices(prev => prev.map(d => 
          d.id === connectedDevice.id ? { ...d, is_connected: false } : d
        ));
        
        setConnectedDevice(null);
        setBleStatus("disconnected");
        
        toast({
          title: "Device Disconnected",
          description: "Device has been successfully disconnected.",
        });
      } else {
        throw new Error(response.error || "Failed to disconnect device");
      }
    } catch (error) {
      console.error("Error during disconnection:", error);
      
      // Force cleanup of local state even if there were errors
      setConnectedDevice(null);
      setBleStatus("disconnected");
      disconnectWebSocket();
      
      toast({
        title: "Disconnection Error",
        description: "There was an issue disconnecting the device, but local state has been cleared.",
        variant: "destructive",
      });
    } finally {
      // Reset disconnecting flag after a short delay
      setTimeout(() => setIsDisconnecting(false), 1000);
    }
  }, [connectedDevice, apiRequest, toast, isDisconnecting, bleStatus, disconnectWebSocket]);

  // Monitor connection status periodically
  useEffect(() => {
    const monitorConnection = async () => {
      if (connectedDevice && bleStatus === "connected") {
        try {
          const response = await apiRequest("/devices/status");
          if (response.success && !response.data.connected) {
            console.log("Device connection lost according to server");
            
            // Update local state
            setConnectedDevice(null);
            setBleStatus("disconnected");
            disconnectWebSocket();
            
            toast({
              title: "Device Disconnected",
              description: "Connection to device was lost.",
              variant: "destructive",
            });
          }
        } catch (error) {
          console.warn("Failed to check device status:", error);
        }
      }
    };

    // Check connection status every 10 seconds
    const interval = setInterval(monitorConnection, 10000);

    return () => clearInterval(interval);
  }, [connectedDevice, bleStatus, apiRequest, toast, disconnectWebSocket]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectWebSocket();
    };
  }, [disconnectWebSocket]);

  return {
    bleStatus,
    devices,
    connectedDevice,
    scanDevices,
    connectDevice,
    disconnectDevice,
  };
}
