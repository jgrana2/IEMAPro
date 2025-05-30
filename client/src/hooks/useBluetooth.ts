import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface BluetoothDevice {
  id: string;
  name: string;
  rssi?: number;
  isConnected: boolean;
  bluetoothDevice?: any; // Store the actual Bluetooth device object
}

export function useBluetooth() {
  const [bleStatus, setBleStatus] = useState<
    "connected" | "disconnected" | "connecting"
  >("disconnected");
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [connectedDevice, setConnectedDevice] =
    useState<BluetoothDevice | null>(null);
  const { toast } = useToast();

  const scanDevices = useCallback(async () => {
    if (!navigator.bluetooth) {
      toast({
        title: "Bluetooth Not Supported",
        description: "Web Bluetooth API is not supported in this browser.",
        variant: "destructive",
      });
      return;
    }

    try {
      setBleStatus("connecting");

      // Request Bluetooth device with ECG service
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: "IoT Holter" }],
        optionalServices: ["heart_rate", "battery_service"],
      });

      if (device) {
        const newDevice: BluetoothDevice = {
          id: device.id,
          name: device.name || "Unknown Device",
          isConnected: false,
          bluetoothDevice: device, // Store the actual Bluetooth device
        };

        setDevices((prev) => {
          const exists = prev.find((d) => d.id === newDevice.id);
          if (exists) return prev;
          return [...prev, newDevice];
        });

        toast({
          title: "Device Found",
          description: `Found device: ${newDevice.name}`,
        });
      }

      setBleStatus("disconnected");
    } catch (error) {
      console.error("Bluetooth scan error:", error);
      setBleStatus("disconnected");

      if (error instanceof Error && error.name === "NotFoundError") {
        toast({
          title: "No Device Selected",
          description: "No Bluetooth device was selected.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Bluetooth Error",
          description: "Failed to scan for Bluetooth devices.",
          variant: "destructive",
        });
      }
    }
  }, [toast]);

  const connectDevice = useCallback(
    async (deviceId: string) => {
      try {
        setBleStatus("connecting");
        
        toast({
          title: "Connecting...",
          description: "Connecting to IoT Holter device",
        });

        // Request the specific IoT Holter device directly
        const bluetoothDevice = await (navigator as any).bluetooth.requestDevice({
          filters: [{ namePrefix: "IoT Holter" }],
          optionalServices: ['heart_rate', 'battery_service', '0000180d-0000-1000-8000-00805f9b34fb']
        });

        if (!bluetoothDevice) {
          throw new Error("No Bluetooth device selected");
        }

        // Connect to GATT server
        const server = await bluetoothDevice.gatt.connect();
        
        // Try to get heart rate service (common for ECG devices)
        let service;
        try {
          service = await server.getPrimaryService('heart_rate');
        } catch {
          // If heart rate service not available, try generic services
          const services = await server.getPrimaryServices();
          if (services.length > 0) {
            service = services[0];
          } else {
            throw new Error("No compatible services found on device");
          }
        }

        // Update device connection status in backend
        await apiRequest(
          "PATCH",
          `/api/ble-devices/device/IoT-Holter-001`,
          { isConnected: true }
        );

        setBleStatus("connected");
        setConnectedDevice({ ...device, isConnected: true });

        // Invalidate cache to refresh device list
        queryClient.invalidateQueries({ queryKey: ["/api/ble-devices"] });

        toast({
          title: "Device Connected",
          description: `Successfully connected to ${device.name}`,
        });

      } catch (error) {
        console.error("Bluetooth connection error:", error);
        setBleStatus("disconnected");

        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        toast({
          title: "Connection Failed",
          description: `Failed to connect: ${errorMessage}`,
          variant: "destructive",
        });
      }
    },
    [devices, toast],
  );

  const disconnectDevice = useCallback(() => {
    if (connectedDevice) {
      setDevices((prev) =>
        prev.map((d) =>
          d.id === connectedDevice.id ? { ...d, isConnected: false } : d,
        ),
      );

      setConnectedDevice(null);
      setBleStatus("disconnected");

      toast({
        title: "Device Disconnected",
        description: "Bluetooth device has been disconnected.",
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
