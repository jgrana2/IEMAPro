import { useState, useCallback, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  parseADS1298DataRaw,
  parseADS1298SingleChannel,
  convertToECGFormat,
  calculateHeartRateFromSamples,
  calculateHeartRateFromChannel,
  assessChannelQuality,
  type ParsedECGData,
} from "@/lib/ads1298-parser";

interface BluetoothDevice {
  id: string;
  name: string;
  rssi?: number;
  isConnected: boolean;
  bluetoothDevice?: any; // Store the actual Bluetooth device object
}

interface BluetoothHookProps {
  onECGData?: (
    ecgData: { [leadName: string]: number[] },
    heartRate: number,
    quality: string,
  ) => void;
}

// BLE Configuration for ECG Device
const TARGET_ADDRESS = "6614D41F-1CB3-77FA-3E35-C5A446EA4E3F";
// Convert short UUIDs to full 128-bit format for Web Bluetooth API
const TARGET_SERVICE_UUID = "0000805b-0000-1000-8000-00805f9b34fb";
const TARGET_CHARACTERISTIC_UUIDS = ["00008171-0000-1000-8000-00805f9b34fb"];

// 24-bit data processing function for characteristic 8171
const process24BitData = (dataBytes: Uint8Array): number[] => {
  const dataArray: number[] = [];
  for (let index = 0; index < dataBytes.length; index += 3) {
    if (index + 3 <= dataBytes.length) {
      const byte1 = dataBytes[index];
      const byte2 = dataBytes[index + 1];
      const byte3 = dataBytes[index + 2];

      let value24bit = (byte1 << 16) | (byte2 << 8) | byte3;

      // Handle two's complement for negative values
      if (value24bit & 0x800000) {
        value24bit = value24bit - 0x1000000;
      }

      dataArray.push(value24bit);
    }
  }
  return dataArray;
};

// Extended channel configuration (for devices with more channels)
const EXTENDED_CHANNEL_UUIDS = {
  1: "00008171-0000-1000-8000-00805f9b34fb",
  2: "00008172-0000-1000-8000-00805f9b34fb",
  3: "00008173-0000-1000-8000-00805f9b34fb",
  4: "00008174-0000-1000-8000-00805f9b34fb",
  5: "00008175-0000-1000-8000-00805f9b34fb",
  6: "00008176-0000-1000-8000-00805f9b34fb",
  7: "00008177-0000-1000-8000-00805f9b34fb",
  8: "00008178-0000-1000-8000-00805f9b34fb",
};

export function useBluetooth({ onECGData }: BluetoothHookProps = {}) {
  const [bleStatus, setBleStatus] = useState<
    "connected" | "disconnected" | "connecting"
  >("disconnected");
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [connectedDevice, setConnectedDevice] =
    useState<BluetoothDevice | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const { toast } = useToast();

  // Simple heart rate calculation from ECG signal peaks
  const calculateSimpleHeartRate = useCallback((data: number[]): number => {
    if (data.length < 100) return 75; // Default if insufficient data

    // Find peaks in the signal
    const peaks: number[] = [];
    const threshold = Math.max(...data) * 0.6; // 60% of max amplitude

    for (let i = 1; i < data.length - 1; i++) {
      if (
        data[i] > data[i - 1] &&
        data[i] > data[i + 1] &&
        data[i] > threshold
      ) {
        peaks.push(i);
      }
    }

    if (peaks.length < 2) return 75;

    // Calculate average interval between peaks
    const intervals = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i - 1]);
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const sampleRate = 500; // Assumed sample rate in Hz
    const heartRate = Math.round((60 * sampleRate) / avgInterval);

    // Clamp to reasonable range
    return Math.max(40, Math.min(200, heartRate));
  }, []);

  // Assess data quality based on signal characteristics
  const assessDataQuality = useCallback(
    (data: number[]): "good" | "poor" | "noise" => {
      if (data.length === 0) return "poor";

      const mean = data.reduce((a, b) => a + b, 0) / data.length;
      const variance =
        data.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) /
        data.length;
      const stdDev = Math.sqrt(variance);
      const maxAmplitude = Math.max(...data.map(Math.abs));

      if (maxAmplitude > 50000 || stdDev > 20000) {
        return "noise"; // Too much noise or artifact
      } else if (maxAmplitude < 1000 || stdDev < 100) {
        return "poor"; // Signal too weak or flat
      }

      return "good";
    },
    [],
  );

  // Function to enable notifications for ECG channels
  const enableECGNotifications = useCallback(
    async (gattServer: any) => {
      const enabledChannels: string[] = [];

      try {
        console.log("Discovering services for ECG device...");

        // Try to connect to the specific ECG service
        try {
          const ecgService =
            await gattServer.getPrimaryService(TARGET_SERVICE_UUID);
          console.log(`Found ECG service: ${TARGET_SERVICE_UUID}`);

          // Get all characteristics in the ECG service
          const characteristics = await ecgService.getCharacteristics();
          console.log(
            `ECG service has ${characteristics.length} characteristics`,
          );

          // Enable notifications for target characteristics
          for (const targetCharUUID of TARGET_CHARACTERISTIC_UUIDS) {
            try {
              // Find the characteristic by UUID
              let targetCharacteristic = null;
              for (const char of characteristics) {
                if (
                  char.uuid.includes(targetCharUUID.toLowerCase()) ||
                  char.uuid.toLowerCase().includes(targetCharUUID.toLowerCase())
                ) {
                  targetCharacteristic = char;
                  break;
                }
              }

              if (!targetCharacteristic) {
                // Try to get characteristic directly
                targetCharacteristic =
                  await ecgService.getCharacteristic(targetCharUUID);
              }

              if (targetCharacteristic) {
                console.log(
                  `Found characteristic: ${targetCharacteristic.uuid}`,
                );

                // Check if notifications are supported
                if (
                  targetCharacteristic.properties.notify ||
                  targetCharacteristic.properties.indicate
                ) {
                  // Enable notifications
                  await targetCharacteristic.startNotifications();
                  console.log(
                    `Notifications enabled for characteristic ${targetCharUUID}`,
                  );

                  // Add event listener for ECG data
                  targetCharacteristic.addEventListener(
                    "characteristicvaluechanged",
                    (event: any) => {
                      const value = event.target.value;
                      const data = new Uint8Array(value.buffer);

                      console.log(
                        `BLE data from ${targetCharUUID}: ${data.length} bytes`,
                      );

                      // Handle single-channel ADS1298 ECG data for characteristics 8171-8178
                      const characteristicUuid = targetCharUUID.toLowerCase();
                      const channelMap: { [key: string]: number } = {
                        "00008171-0000-1000-8000-00805f9b34fb": 1, // Channel 1
                        "00008172-0000-1000-8000-00805f9b34fb": 2, // Channel 2
                        "00008173-0000-1000-8000-00805f9b34fb": 3, // Channel 3
                        "00008174-0000-1000-8000-00805f9b34fb": 4, // Channel 4
                        "00008175-0000-1000-8000-00805f9b34fb": 5, // Channel 5
                        "00008176-0000-1000-8000-00805f9b34fb": 6, // Channel 6
                        "00008177-0000-1000-8000-00805f9b34fb": 7, // Channel 7
                        "00008178-0000-1000-8000-00805f9b34fb": 8, // Channel 8
                      };

                      const channelNumber = channelMap[characteristicUuid];
                      if (channelNumber) {
                        try {
                          // Parse single channel data (28 samples of 24-bit values)
                          const rawData = Array.from(data);
                          const channelSamples = parseADS1298SingleChannel(rawData, channelNumber);

                          if (channelSamples.length > 0) {
                            // Map channel data to appropriate ECG lead
                            const leadData: { [leadName: string]: number[] } = {};
                            
                            // Map ADS1298 channels to standard ECG leads
                            switch (channelNumber) {
                              case 1:
                                leadData["Lead I"] = channelSamples;
                                break;
                              case 2:
                                leadData["Lead II"] = channelSamples;
                                break;
                              case 3:
                                leadData["Lead III"] = channelSamples;
                                break;
                              case 4:
                                leadData["aVR"] = channelSamples;
                                break;
                              case 5:
                                leadData["aVL"] = channelSamples;
                                break;
                              case 6:
                                leadData["aVF"] = channelSamples;
                                break;
                              case 7:
                                leadData["V1"] = channelSamples;
                                break;
                              case 8:
                                leadData["V2"] = channelSamples;
                                break;
                              default:
                                leadData[`Channel ${channelNumber}`] = channelSamples;
                            }

                            // Calculate heart rate and assess quality for this channel
                            const heartRate = calculateHeartRateFromChannel(channelSamples);
                            const quality = assessChannelQuality(channelSamples);

                            console.log(`Channel ${channelNumber}: ${channelSamples.length} samples, HR: ${heartRate}, Quality: ${quality}`);

                            // Send processed data to callback
                            if (onECGData) {
                              onECGData(leadData, heartRate, quality);
                            }
                          }
                        } catch (parseError) {
                          console.error(
                            `Failed to process Channel ${channelNumber} ECG data:`,
                            parseError,
                          );
                        }
                      } else {
                        // Fallback to original ADS1298 parser for other characteristics
                        const rawData = Array.from(data);
                        try {
                          if (rawData.length === 84) {
                            // Full ADS1298 packet
                            const parsedData: ParsedECGData =
                              parseADS1298DataRaw(rawData);
                            const leadData = convertToECGFormat(parsedData);
                            const heartRate = calculateHeartRateFromSamples(
                              parsedData.samples,
                              parsedData.sampleRate,
                            );

                            console.log(
                              `Parsed ${parsedData.samples.length} ECG samples from BLE`,
                            );
                            console.log(
                              `Lead I data: ${leadData["Lead I"]?.length || 0} samples`,
                            );

                            // Send processed data to callback
                            if (onECGData) {
                              onECGData(
                                leadData,
                                heartRate,
                                parsedData.quality,
                              );
                            }
                          } else {
                            console.log(
                              `Received ${rawData.length} bytes - not a full ADS1298 packet`,
                            );
                          }
                        } catch (parseError) {
                          console.error(
                            "Failed to parse BLE ECG data:",
                            parseError,
                          );
                        }
                      }
                    },
                  );

                  enabledChannels.push(targetCharUUID);
                } else {
                  console.warn(
                    `Characteristic ${targetCharUUID} does not support notifications`,
                  );
                }
              }
            } catch (charError) {
              console.warn(
                `Failed to setup characteristic ${targetCharUUID}:`,
                charError,
              );
            }
          }
        } catch (serviceError) {
          console.error(
            `ECG service ${TARGET_SERVICE_UUID} not found:`,
            serviceError,
          );

          // Fallback: Try to discover all services
          const services = await gattServer.getPrimaryServices();
          console.log(
            "Available services:",
            services.map((s: any) => s.uuid),
          );

          toast({
            title: "Service Discovery",
            description: `Found ${services.length} services. Check console for details.`,
          });
        }
      } catch (error) {
        console.error("Error during ECG setup:", error);
      }

      if (enabledChannels.length > 0) {
        toast({
          title: "ECG Notifications Active",
          description: `Enabled ${enabledChannels.length} ECG characteristics: ${enabledChannels.join(", ")}`,
        });
      } else {
        toast({
          title: "ECG Setup Issue",
          description:
            "Unable to enable ECG notifications. Verify device compatibility.",
          variant: "destructive",
        });
      }

      return enabledChannels;
    },
    [toast],
  );

  // Handle device disconnection events
  const handleDeviceDisconnection = useCallback(
    async (deviceId: string, deviceName: string) => {
      // Prevent duplicate disconnection handling
      if (isDisconnecting || bleStatus === "disconnected") {
        return;
      }

      setIsDisconnecting(true);
      console.log(`Device ${deviceName} (${deviceId}) disconnected`);

      // Update local state
      setDevices((prev) =>
        prev.map((d) => (d.id === deviceId ? { ...d, isConnected: false } : d)),
      );

      if (connectedDevice?.id === deviceId) {
        setConnectedDevice(null);
      }

      setBleStatus("disconnected");

      // Update backend
      try {
        await apiRequest("PATCH", `/api/ble-devices/device/${deviceId}`, {
          isConnected: false,
        });

        // Invalidate cache to refresh device list
        queryClient.invalidateQueries({ queryKey: ["/api/ble-devices"] });
      } catch (error) {
        console.warn(
          "Failed to update device disconnection in backend:",
          error,
        );
      }

      toast({
        title: "Device Disconnected",
        description: `${deviceName} has been disconnected.`,
        variant: "destructive",
      });

      // Reset disconnecting flag after a short delay
      setTimeout(() => setIsDisconnecting(false), 1000);
    },
    [connectedDevice, toast, queryClient, isDisconnecting, bleStatus],
  );

  // Monitor connection status periodically
  useEffect(() => {
    const monitorConnection = () => {
      if (connectedDevice && connectedDevice.bluetoothDevice) {
        const isStillConnected =
          connectedDevice.bluetoothDevice.gatt?.connected;

        if (!isStillConnected && bleStatus === "connected") {
          console.log(
            "Device connection lost, triggering disconnection handler",
          );
          handleDeviceDisconnection(
            connectedDevice.id,
            connectedDevice.name || "IoT Holter",
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
          // Include ECG service UUID
          TARGET_SERVICE_UUID,
        ],
      });

      if (device) {
        // Connect to the device immediately after selection
        const gattServer = await device.gatt.connect();

        // Add disconnection event listener
        device.addEventListener("gattserverdisconnected", () => {
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
            return prev.map((d) =>
              d.id === newDevice.id ? { ...d, isConnected: true } : d,
            );
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
          description:
            "Bluetooth access was denied. Please allow Bluetooth permissions.",
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
        const bluetoothDevice = await (
          navigator as any
        ).bluetooth.requestDevice({
          filters: [{ namePrefix: "IoT Holter" }],
          optionalServices: [
            "heart_rate",
            "battery_service",
            "0000180d-0000-1000-8000-00805f9b34fb",
            // Include ECG service UUID
            TARGET_SERVICE_UUID,
          ],
        });

        if (!bluetoothDevice) {
          throw new Error("No Bluetooth device selected");
        }

        // Connect to GATT server
        const server = await bluetoothDevice.gatt.connect();

        // Add disconnection event listener
        bluetoothDevice.addEventListener("gattserverdisconnected", () => {
          handleDeviceDisconnection(
            bluetoothDevice.id,
            bluetoothDevice.name || "IoT Holter",
          );
        });

        // Enable ECG channel notifications
        await enableECGNotifications(server);

        // Try to discover available services on the device
        let service;
        try {
          // First try heart rate service (standard for ECG devices)
          service = await server.getPrimaryService("heart_rate");
          console.log("Found heart rate service");
        } catch {
          try {
            // Try to get all available services
            const services = await server.getPrimaryServices();
            console.log(
              "Available services:",
              services.map((s: any) => s.uuid),
            );
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
        await apiRequest("PATCH", `/api/ble-devices/device/IoT-Holter-001`, {
          isConnected: true,
        });

        setBleStatus("connected");
        setConnectedDevice({
          id: bluetoothDevice.id,
          name: bluetoothDevice.name || "IoT Holter",
          isConnected: true,
          bluetoothDevice: bluetoothDevice, // Store the actual Bluetooth device object
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

        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
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
          connectedDevice.bluetoothDevice.removeEventListener(
            "gattserverdisconnected",
            handleDeviceDisconnection,
          );

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
        console.warn(
          "No Bluetooth device object available, proceeding with state cleanup",
        );
      }

      // Update backend status
      try {
        await apiRequest(
          "PATCH",
          `/api/ble-devices/device/${connectedDevice.id}`,
          { isConnected: false },
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
        description:
          "There was an issue disconnecting the device, but local state has been cleared.",
        variant: "destructive",
      });
    } finally {
      // Reset disconnecting flag after a short delay
      setTimeout(() => setIsDisconnecting(false), 1000);
    }
  }, [
    connectedDevice,
    toast,
    queryClient,
    handleDeviceDisconnection,
    isDisconnecting,
    bleStatus,
  ]);

  return {
    bleStatus,
    devices,
    connectedDevice,
    scanDevices,
    connectDevice,
    disconnectDevice,
  };
}
