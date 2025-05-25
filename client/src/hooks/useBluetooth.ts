import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

interface BluetoothDevice {
  id: string;
  name: string;
  rssi?: number;
  isConnected: boolean;
}

export function useBluetooth() {
  const [bleStatus, setBleStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<BluetoothDevice | null>(null);
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
      setBleStatus('connecting');
      
      // Request Bluetooth device with ECG service
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: 'ECG' },
          { namePrefix: 'Heart' },
          { namePrefix: 'BLE' }
        ],
        optionalServices: ['heart_rate', 'battery_service']
      });

      if (device) {
        const newDevice: BluetoothDevice = {
          id: device.id,
          name: device.name || 'Unknown Device',
          isConnected: false
        };

        setDevices(prev => {
          const exists = prev.find(d => d.id === newDevice.id);
          if (exists) return prev;
          return [...prev, newDevice];
        });

        toast({
          title: "Device Found",
          description: `Found device: ${newDevice.name}`,
        });
      }
      
      setBleStatus('disconnected');
    } catch (error) {
      console.error('Bluetooth scan error:', error);
      setBleStatus('disconnected');
      
      if (error instanceof Error && error.name === 'NotFoundError') {
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

  const connectDevice = useCallback(async (deviceId: string) => {
    try {
      setBleStatus('connecting');
      
      const device = devices.find(d => d.id === deviceId);
      if (!device) {
        throw new Error('Device not found');
      }

      // Simulate connection process
      await new Promise(resolve => setTimeout(resolve, 2000));

      setDevices(prev => prev.map(d => 
        d.id === deviceId 
          ? { ...d, isConnected: true }
          : { ...d, isConnected: false }
      ));

      setConnectedDevice({ ...device, isConnected: true });
      setBleStatus('connected');

      toast({
        title: "Device Connected",
        description: `Successfully connected to ${device.name}`,
      });

      // Start simulating ECG data notifications
      // In a real implementation, this would subscribe to GATT characteristics
      
    } catch (error) {
      console.error('Bluetooth connection error:', error);
      setBleStatus('disconnected');
      
      toast({
        title: "Connection Failed",
        description: "Failed to connect to Bluetooth device.",
        variant: "destructive",
      });
    }
  }, [devices, toast]);

  const disconnectDevice = useCallback(() => {
    if (connectedDevice) {
      setDevices(prev => prev.map(d => 
        d.id === connectedDevice.id 
          ? { ...d, isConnected: false }
          : d
      ));
      
      setConnectedDevice(null);
      setBleStatus('disconnected');

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
