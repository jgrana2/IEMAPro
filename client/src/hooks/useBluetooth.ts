import { useState, useCallback, useEffect } from "react";
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
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const { toast } = useToast();

  // Handle device disconnection events
  const handleDeviceDisconnection = useCallback(async (deviceId: string, deviceName: string) => {
    // Prevent duplicate disconnection handling
    if (isDisconnecting || bleStatus === "disconnected") {
      return;
    }
    
    setIsDisconnecting(true);
    console.log(`Device ${deviceName} (${deviceId}) disconnected`);
    
    // Update local state
    setDevices((prev) =>
      prev.map((d) =>
        d.id === deviceId ? { ...d, isConnected: false } : d,
      ),
    );
    
    if (connectedDevice?.id === deviceId) {
      setConnectedDevice(null);
    }
    
    setBleStatus("disconnected");

    // Update backend
    try {
      await apiRequest(
        "PATCH",
        `/api/ble-devices/device/${deviceId}`,
        { isConnected: false }
      );
      
      // Invalidate cache to refresh device list
      queryClient.invalidateQueries({ queryKey: ["/api/ble-devices"] });
    } catch (error) {
      console.warn("Failed to update device disconnection in backend:", error);
    }

    toast({
      title: "Device Disconnected",
      description: `${deviceName} has been disconnected.`,
      variant: "destructive",
    });
    
    // Reset disconnecting flag after a short delay
    setTimeout(() => setIsDisconnecting(false), 1000);
  }, [connectedDevice, toast, queryClient, isDisconnecting, bleStatus]);

  // Monitor connection status periodically
  useEffect(() => {
    const monitorConnection = () => {
      if (connectedDevice && connectedDevice.bluetoothDevice) {
        const isStillConnected = connectedDevice.bluetoothDevice.gatt?.connected;
        
        if (!isStillConnected && bleStatus === "connected") {
          console.log("Device connection lost, triggering disconnection handler");
          handleDeviceDisconnection(
            connectedDevice.id, 
            connectedDevice.name || "IoT Holter"
          );
        }
      }
    };

    // Check connection status every 5 seconds
    const interval = setInterval(monitorConnection, 5000);

    return () => clearInterval(interval);
  }, [connectedDevice, bleStatus, handleDeviceDisconnection]);

  const scanDevices = useCallback(async () => {
    if (!(navigator as any).bluetooth) {
      toast({
        title: "Bluetooth Not Supported",
        description: "Web Bluetooth API is not supported in this browser.",
        variant: "destructive",
      });
      return;
    }

    try {
      setBleStatus("connecting");

      toast({
        title: "Scanning for Devices",
        description: "Looking for IoT Holter ECG devices...",
      });

      // Request Bluetooth device with ECG service - this both scans and connects
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [{ namePrefix: "IoT Holter" }],
        optionalServices: ["heart_rate", "battery_service", "0000180d-0000-1000-8000-00805f9b34fb"],
      });

      if (device) {
        // Connect to the device immediately after selection
        const gattServer = await device.gatt.connect();
        
        // Add disconnection event listener
        device.addEventListener('gattserverdisconnected', () => {
          handleDeviceDisconnection(device.id, device.name || "IoT Holter");
        });
        
        const newDevice: BluetoothDevice = {
          id: device.id,
          name: device.name || "IoT Holter",
          isConnected: true,
          bluetoothDevice: device,
        };

        setDevices((prev) => {
          const exists = prev.find((d) => d.id === newDevice.id);
          if (exists) {
            return prev.map((d) => d.id === newDevice.id ? { ...d, isConnected: true } : d);
          }
          return [...prev, newDevice];
        });

        setConnectedDevice(newDevice);
        setBleStatus("connected");

        // Save to backend
        try {
          await apiRequest("POST", "/api/ble-devices", {
            deviceId: device.id,
            name: device.name || "IoT Holter",
            isConnected: true,
            rssi: -50, // Default signal strength
          });
          
          // Invalidate cache to refresh device list
          queryClient.invalidateQueries({ queryKey: ["/api/ble-devices"] });
        } catch (apiError) {
          console.warn("Failed to save device to backend:", apiError);
        }

        toast({
          title: "Device Connected",
          description: `Successfully connected to ${device.name || "IoT Holter Device"}`,
        });
      }
    } catch (error) {
      console.error("Bluetooth scan/connect error:", error);
      setBleStatus("disconnected");

      if (error instanceof Error && error.name === "NotFoundError") {
        toast({
          title: "No Device Selected",
          description: "Please select a device to connect.",
          variant: "destructive",
        });
      } else if (error instanceof Error && error.name === "NotAllowedError") {
        toast({
          title: "Permission Denied",
          description: "Bluetooth access was denied. Please allow Bluetooth permissions.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Connection Failed",
          description: "Unable to connect to the device. Please try again.",
          variant: "destructive",
        });
      }
    }
  }, [toast, queryClient]);

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
        
        // Add disconnection event listener
        bluetoothDevice.addEventListener('gattserverdisconnected', () => {
          handleDeviceDisconnection(bluetoothDevice.id, bluetoothDevice.name || "IoT Holter");
        });
        
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
            console.log("Available services:", services.map((s: any) => s.uuid));
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
          isConnected: true,
          bluetoothDevice: bluetoothDevice  // Store the actual Bluetooth device object
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
      
      // If we have the actual Bluetooth device object, properly disconnect it
      if (connectedDevice.bluetoothDevice) {
        try {
          // Remove event listeners first to prevent duplicate disconnection events
          connectedDevice.bluetoothDevice.removeEventListener('gattserverdisconnected', handleDeviceDisconnection);
          
          // Check if GATT server is still connected and disconnect it
          if (connectedDevice.bluetoothDevice.gatt?.connected) {
            console.log("Disconnecting GATT server...");
            await connectedDevice.bluetoothDevice.gatt.disconnect();
            console.log("GATT server disconnected successfully");
          } else {
            console.log("GATT server was already disconnected");
          }
        } catch (gattError) {
          console.warn("Error disconnecting GATT server:", gattError);
          // Continue with cleanup even if GATT disconnect fails
        }
      } else {
        console.warn("No Bluetooth device object available, proceeding with state cleanup");
      }

      // Update backend status
      try {
        await apiRequest(
          "PATCH",
          `/api/ble-devices/device/${connectedDevice.id}`,
          { isConnected: false }
        );
        console.log("Backend updated successfully");
      } catch (backendError) {
        console.warn("Failed to update backend:", backendError);
        // Continue with local cleanup even if backend update fails
      }

      // Update local state
      setDevices((prev) =>
        prev.map((d) =>
          d.id === connectedDevice.id ? { ...d, isConnected: false } : d,
        ),
      );

      setConnectedDevice(null);
      setBleStatus("disconnected");

      // Invalidate cache to refresh device list
      queryClient.invalidateQueries({ queryKey: ["/api/ble-devices"] });

      toast({
        title: "Device Disconnected",
        description: "Bluetooth device has been successfully disconnected.",
      });

    } catch (error) {
      console.error("Error during manual disconnection:", error);
      
      // Force cleanup of local state even if there were errors
      setConnectedDevice(null);
      setBleStatus("disconnected");
      
      toast({
        title: "Disconnection Error",
        description: "There was an issue disconnecting the device, but local state has been cleared.",
        variant: "destructive",
      });
    } finally {
      // Reset disconnecting flag after a short delay
      setTimeout(() => setIsDisconnecting(false), 1000);
    }
  }, [connectedDevice, toast, queryClient, handleDeviceDisconnection, isDisconnecting, bleStatus]);

  return {
    bleStatus,
    devices,
    connectedDevice,
    scanDevices,
    connectDevice,
    disconnectDevice,
  };
}
