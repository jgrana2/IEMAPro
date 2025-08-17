
import { useState, useCallback, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, apiRequestJson, queryClient } from "@/lib/queryClient";

interface BluetoothDevice {
  id: string;
  name: string;
  rssi?: number;
  isConnected: boolean;
}

interface PythonBLEHookProps {
  onECGData?: (
    ecgData: { [leadName: string]: number[] },
    heartRate: number,
    quality: string,
  ) => void;
}

interface BLEStatusResponse {
  connected: boolean;
  device_name?: string;
  device_address?: string;
  enabled_channels?: number;
  scanning?: boolean;
}

interface BLEResponse {
  success: boolean;
  message: string;
}

export function usePythonBLE({ onECGData }: PythonBLEHookProps = {}) {
  const [bleStatus, setBleStatus] = useState<
    "connected" | "disconnected" | "connecting" | "scanning"
  >("disconnected");
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [connectedDevice, setConnectedDevice] =
    useState<BluetoothDevice | null>(null);
  const { toast } = useToast();

  // Check BLE status on mount
  useEffect(() => {
    checkBLEStatus();
  }, []);

  const checkBLEStatus = useCallback(async () => {
    try {
      const status = await apiRequestJson<BLEStatusResponse>("GET", "/api/ble/status");
      
      if (status.connected) {
        setBleStatus("connected");
        setConnectedDevice({
          id: status.device_address || "",
          name: status.device_name || "IoT Holter",
          isConnected: true,
        });
      } else {
        setBleStatus("disconnected");
        setConnectedDevice(null);
      }
    } catch (error) {
      setBleStatus("disconnected");
    }
  }, []);

  const scanDevices = useCallback(async () => {
    setBleStatus("scanning");
    
    try {
      toast({
        title: "Scanning for Devices",
        description: "Looking for IoT Holter ECG devices...",
      });

      const scannedDevices = await apiRequestJson<BluetoothDevice[]>("POST", "/api/ble/scan");
      setDevices(scannedDevices);

      if (scannedDevices.length === 0) {
        toast({
          title: "No Devices Found",
          description: "No IoT Holter devices were found nearby. Make sure your device is powered on and in pairing mode.",
          variant: "destructive",
        });
        setBleStatus("disconnected");
      } else {
        toast({
          title: "Devices Found",
          description: `Found ${scannedDevices.length} IoT Holter device(s). Tap a device to connect.`,
        });
        setBleStatus("disconnected");
      }
    } catch (error) {
      setBleStatus("disconnected");
      toast({
        title: "Scan Failed",
        description: "Failed to scan for BLE devices. Please check that the Python backend is running and Bluetooth is enabled.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const connectDevice = useCallback(
    async (deviceId: string) => {
      setBleStatus("connecting");

      try {
        toast({
          title: "Connecting...",
          description: "Connecting to IoT Holter device via Python backend",
        });

        const response = await apiRequestJson<BLEResponse>("POST", `/api/ble/connect/${deviceId}`);

        if (response.success) {
          setBleStatus("connected");
          
          const deviceToConnect = devices.find(d => d.id === deviceId) || {
            id: deviceId,
            name: "IoT Holter",
            isConnected: true,
          };
          
          setConnectedDevice(deviceToConnect);
          setDevices(prev =>
            prev.map(d =>
              d.id === deviceId ? { ...d, isConnected: true } : d
            )
          );

          // Update backend device status
          try {
            await apiRequest("PATCH", `/api/ble-devices/device/${deviceId}`, {
              isConnected: true,
            });
            queryClient.invalidateQueries({ queryKey: ["/api/ble-devices"] });
          } catch (dbError) {
            // Failed to update device in backend - handled silently
          }

          toast({
            title: "Device Connected",
            description: `Successfully connected via Python backend`,
          });
        } else {
          throw new Error("Connection failed");
        }
      } catch (error) {
        setBleStatus("disconnected");
        
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        const isNetworkError = errorMessage.includes("fetch") || errorMessage.includes("Failed to fetch");
        
        toast({
          title: "Connection Failed",
          description: isNetworkError 
            ? "Cannot connect to Python backend. Please ensure the backend server is running."
            : `Failed to connect to device: ${errorMessage}`,
          variant: "destructive",
        });
      }
    },
    [devices, toast]
  );

  const disconnectDevice = useCallback(async () => {
    if (!connectedDevice) {
      toast({
        title: "No Device Connected",
        description: "There is no device currently connected to disconnect.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await apiRequestJson<BLEResponse>("POST", "/api/ble/disconnect");

      if (response.success) {
        // Update backend device status
        try {
          await apiRequest("PATCH", `/api/ble-devices/device/${connectedDevice.id}`, {
            isConnected: false,
          });
          queryClient.invalidateQueries({ queryKey: ["/api/ble-devices"] });
        } catch (dbError) {
          // Failed to update device in backend - handled silently
        }

        setDevices(prev =>
          prev.map(d =>
            d.id === connectedDevice.id ? { ...d, isConnected: false } : d
          )
        );

        setConnectedDevice(null);
        setBleStatus("disconnected");

        toast({
          title: "Device Disconnected",
          description: "Device has been disconnected via Python backend.",
        });
      } else {
        throw new Error("Disconnection failed");
      }
    } catch (error) {
      toast({
        title: "Disconnection Error",
        description: "Failed to disconnect device via Python backend.",
        variant: "destructive",
      });
    }
  }, [connectedDevice, toast]);

  return {
    bleStatus,
    devices,
    connectedDevice,
    scanDevices,
    connectDevice,
    disconnectDevice,
  };
}
