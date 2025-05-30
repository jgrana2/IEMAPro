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
        
        // Try to discover available services on the device
        let service;
        try {
          // First try heart rate service (standard for ECG devices)
          service = await server.getPrimaryService('heart_rate');
          console.log("Found heart rate service");
        } catch {
          try {
            // Try to get all available services
            const services = await server.getPrimaryServices();
            console.log("Available services:", services.map(s => s.uuid));
            if (services.length > 0) {
              service = services[0];
              console.log("Using first available service:", service.uuid);
            } else {
              console.log("No services found, but connection established");
              // Don't throw error - connection is still valid
            }
          } catch (serviceError) {
            console.log("Service discovery failed:", serviceError);
            // Don't throw error - basic connection is still established
          }
        }

        // Update device connection status in backend
        await apiRequest(
          "PATCH",
          `/api/ble-devices/device/IoT-Holter-001`,
          { isConnected: true }
        );

        setBleStatus("connected");
        setConnectedDevice({ 
          id: bluetoothDevice.id, 
          name: bluetoothDevice.name || "IoT Holter",
          isConnected: true 
        });

        // Invalidate cache to refresh device list
        queryClient.invalidateQueries({ queryKey: ["/api/ble-devices"] });

        toast({
          title: "Device Connected",
          description: `Successfully connected to ${bluetoothDevice.name || "IoT Holter"}`,
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
