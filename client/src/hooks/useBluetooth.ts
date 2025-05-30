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

// BLE Configuration for ECG Device
const TARGET_ADDRESS = "6614D41F-1CB3-77FA-3E35-C5A446EA4E3F";
const CHANNEL_UUIDS = {
  1: "00008171-0000-1000-8000-00805f9b34fb",
  2: "00008172-0000-1000-8000-00805f9b34fb",
  3: "00008173-0000-1000-8000-00805f9b34fb",
  4: "00008174-0000-1000-8000-00805f9b34fb",
  5: "00008175-0000-1000-8000-00805f9b34fb",
  6: "00008176-0000-1000-8000-00805f9b34fb",
  7: "00008177-0000-1000-8000-00805f9b34fb",
  8: "00008178-0000-1000-8000-00805f9b34fb",
};

export function useBluetooth() {
  const [bleStatus, setBleStatus] = useState<
    "connected" | "disconnected" | "connecting"
  >("disconnected");
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [connectedDevice, setConnectedDevice] =
    useState<BluetoothDevice | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const { toast } = useToast();

  // Function to enable notifications for ECG channels
  const enableECGNotifications = useCallback(async (gattServer: any) => {
    const enabledChannels: string[] = [];
    
    try {
      console.log("Discovering all available services...");
      const services = await gattServer.getPrimaryServices();
      console.log("Available services:", services.map((s: any) => s.uuid));
      
      // Try to find and enable notifications for each ECG channel
      for (const [channel, uuid] of Object.entries(CHANNEL_UUIDS)) {
        try {
          console.log(`Attempting to enable notifications for channel ${channel} (${uuid})`);
          
          let characteristic = null;
          
          // Method 1: Try to get service by the channel UUID directly
          try {
            const service = await gattServer.getPrimaryService(uuid);
            console.log(`Found service for channel ${channel}`);
            
            // Try to get characteristics in this service
            const characteristics = await service.getCharacteristics();
            console.log(`Service ${uuid} has ${characteristics.length} characteristics`);
            
            // Look for a characteristic that supports notifications
            for (const char of characteristics) {
              if (char.properties.notify || char.properties.indicate) {
                characteristic = char;
                console.log(`Found notifiable characteristic: ${char.uuid}`);
                break;
              }
            }
            
            // If no notifiable characteristic found, try the first one
            if (!characteristic && characteristics.length > 0) {
              characteristic = characteristics[0];
              console.log(`Using first characteristic: ${characteristic.uuid}`);
            }
          } catch (serviceError) {
            console.log(`Service ${uuid} not found, trying alternative discovery...`);
            
            // Method 2: Search through all services for characteristics with the channel UUID
            for (const service of services) {
              try {
                const characteristics = await service.getCharacteristics();
                for (const char of characteristics) {
                  if (char.uuid === uuid || char.uuid.toLowerCase() === uuid.toLowerCase()) {
                    characteristic = char;
                    console.log(`Found characteristic ${uuid} in service ${service.uuid}`);
                    break;
                  }
                }
                if (characteristic) break;
              } catch (charError) {
                // Continue searching in other services
                continue;
              }
            }
          }
          
          if (characteristic) {
            // Check if notifications are supported
            if (characteristic.properties.notify || characteristic.properties.indicate) {
              // Enable notifications
              await characteristic.startNotifications();
              console.log(`Notifications enabled for channel ${channel}`);
              
              // Add event listener for data
              characteristic.addEventListener('characteristicvaluechanged', (event: any) => {
                const value = event.target.value;
                const data = new Uint8Array(value.buffer);
                
                console.log(`ECG Channel ${channel} data:`, Array.from(data));
                
                // Send ECG data to WebSocket for real-time processing
                // You can expand this to parse the data format your device uses
                const ecgDataPoint = {
                  timestamp: Date.now(),
                  channel: parseInt(channel),
                  data: Array.from(data),
                  voltage: data.length > 0 ? (data[0] - 128) * 0.1 : 0 // Example conversion
                };
                
                // TODO: Send to WebSocket or store for analysis
                console.log(`Processed ECG data for channel ${channel}:`, ecgDataPoint);
              });
              
              enabledChannels.push(channel);
            } else {
              console.warn(`Characteristic for channel ${channel} does not support notifications`);
            }
          } else {
            console.warn(`Could not find characteristic for channel ${channel}`);
          }
          
        } catch (error) {
          console.warn(`Failed to enable notifications for channel ${channel}:`, error);
          // Continue with other channels even if one fails
        }
      }
    } catch (error) {
      console.error("Error during service discovery:", error);
    }
    
    if (enabledChannels.length > 0) {
      toast({
        title: "ECG Notifications Enabled",
        description: `Successfully enabled ${enabledChannels.length} ECG channels: ${enabledChannels.join(', ')}`,
      });
    } else {
      toast({
        title: "ECG Setup Warning", 
        description: "Could not enable ECG channel notifications. Check device compatibility.",
        variant: "destructive"
      });
    }
    
    return enabledChannels;
  }, [toast]);

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
        optionalServices: [
          "heart_rate", 
          "battery_service", 
          "0000180d-0000-1000-8000-00805f9b34fb",
          // Include all ECG channel UUIDs as optional services
          ...Object.values(CHANNEL_UUIDS)
        ],
      });

      if (device) {
        // Connect to the device immediately after selection
        const gattServer = await device.gatt.connect();
        
        // Add disconnection event listener
        device.addEventListener('gattserverdisconnected', () => {
          handleDeviceDisconnection(device.id, device.name || "IoT Holter");
        });

        // Enable ECG channel notifications
        await enableECGNotifications(gattServer);
        
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
          optionalServices: [
            'heart_rate', 
            'battery_service', 
            '0000180d-0000-1000-8000-00805f9b34fb',
            // Include all ECG channel UUIDs as optional services
            ...Object.values(CHANNEL_UUIDS)
          ]
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

        // Enable ECG channel notifications
        await enableECGNotifications(server);
        
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
