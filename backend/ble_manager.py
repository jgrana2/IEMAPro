import asyncio
import logging
from typing import Dict, List, Optional, Callable, Any
from bleak import BleakClient, BleakScanner
from bleak.backends.device import BLEDevice
from bleak.backends.characteristic import BleakGATTCharacteristic
import struct
import time
from models import BLEDeviceInfo, ProcessedECGData

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# BLE Configuration for ECG Device (matching your Web Bluetooth config)
TARGET_ADDRESS = "6614D41F-1CB3-77FA-3E35-C5A446EA4E3F"
TARGET_SERVICE_UUID = "0000805b-0000-1000-8000-00805f9b34fb"

# All ADS1298 ECG channels (8171-8178) - matching your Web Bluetooth UUIDs
TARGET_CHARACTERISTIC_UUIDS = [
    "00008171-0000-1000-8000-00805f9b34fb",  # Channel 1
    "00008172-0000-1000-8000-00805f9b34fb",  # Channel 2
    "00008173-0000-1000-8000-00805f9b34fb",  # Channel 3
    "00008174-0000-1000-8000-00805f9b34fb",  # Channel 4
    "00008175-0000-1000-8000-00805f9b34fb",  # Channel 5
    "00008176-0000-1000-8000-00805f9b34fb",  # Channel 6
    "00008177-0000-1000-8000-00805f9b34fb",  # Channel 7
    "00008178-0000-1000-8000-00805f9b34fb",  # Channel 8
]

# Extended channel configuration
EXTENDED_CHANNEL_UUIDS = {
    1: "00008171-0000-1000-8000-00805f9b34fb",
    2: "00008172-0000-1000-8000-00805f9b34fb",
    3: "00008173-0000-1000-8000-00805f9b34fb",
    4: "00008174-0000-1000-8000-00805f9b34fb",
    5: "00008175-0000-1000-8000-00805f9b34fb",
    6: "00008176-0000-1000-8000-00805f9b34fb",
    7: "00008177-0000-1000-8000-00805f9b34fb",
    8: "00008178-0000-1000-8000-00805f9b34fb",
}

class BLEManager:
    def __init__(self):
        self.client: Optional[BleakClient] = None
        self.connected_device: Optional[BLEDevice] = None
        self.is_connected = False
        self.is_scanning = False
        self.ecg_callback: Optional[Callable] = None
        self.status_callback: Optional[Callable] = None
        self.enabled_channels: List[str] = []
        
    async def scan_devices(self, timeout: float = 10.0) -> List[BLEDeviceInfo]:
        """Scan for IoT Holter ECG devices"""
        if self.is_scanning:
            logger.warning("Scan already in progress")
            return []
            
        self.is_scanning = True
        devices = []
        
        try:
            logger.info("Scanning for IoT Holter ECG devices...")
            
            # Scan for devices with IoT Holter name prefix
            discovered_devices = await BleakScanner.discover(timeout=timeout)
            
            for device in discovered_devices:
                if device.name and "IoT Holter" in device.name:
                    device_info = BLEDeviceInfo(
                        id=device.address,
                        name=device.name,
                        rssi=device.rssi if hasattr(device, 'rssi') else None,
                        isConnected=False
                    )
                    devices.append(device_info)
                    logger.info(f"Found IoT Holter device: {device.name} ({device.address})")
            
            if not devices:
                logger.info("No IoT Holter devices found")
                
        except Exception as e:
            logger.error(f"Error during device scan: {e}")
        finally:
            self.is_scanning = False
            
        return devices
    
    async def connect_device(self, device_address: str) -> bool:
        """Connect to a specific BLE device"""
        if self.is_connected:
            logger.warning("Already connected to a device")
            return False
            
        try:
            logger.info(f"Connecting to device: {device_address}")
            
            # Find the device first
            discovered_devices = await BleakScanner.discover(timeout=10.0)
            target_device = None
            
            for device in discovered_devices:
                if device.address == device_address or (device.name and "IoT Holter" in device.name):
                    target_device = device
                    break
                    
            if not target_device:
                logger.error(f"Device {device_address} not found")
                return False
                
            # Create client and connect
            self.client = BleakClient(target_device)
            await self.client.connect()
            
            if self.client.is_connected:
                self.connected_device = target_device
                self.is_connected = True
                logger.info(f"Successfully connected to {target_device.name}")
                
                # Enable ECG notifications
                await self._enable_ecg_notifications()
                
                # Notify status callback
                if self.status_callback:
                    await self.status_callback(True, device_address, target_device.name)
                    
                return True
            else:
                logger.error("Failed to establish connection")
                return False
                
        except Exception as e:
            logger.error(f"Connection error: {e}")
            if self.client:
                try:
                    await self.client.disconnect()
                except:
                    pass
            self.client = None
            self.connected_device = None
            self.is_connected = False
            return False
    
    async def disconnect_device(self) -> bool:
        """Disconnect from the current device"""
        if not self.is_connected or not self.client:
            logger.warning("No device connected")
            return False
            
        try:
            device_address = self.connected_device.address if self.connected_device else "unknown"
            device_name = self.connected_device.name if self.connected_device else "unknown"
            
            logger.info(f"Disconnecting from {device_name}")
            
            # Disable notifications first
            await self._disable_ecg_notifications()
            
            # Disconnect client
            await self.client.disconnect()
            
            # Reset state
            self.client = None
            self.connected_device = None
            self.is_connected = False
            self.enabled_channels = []
            
            # Notify status callback
            if self.status_callback:
                await self.status_callback(False, device_address, device_name)
                
            logger.info("Device disconnected successfully")
            return True
            
        except Exception as e:
            logger.error(f"Disconnection error: {e}")
            # Force reset state even if disconnect fails
            self.client = None
            self.connected_device = None
            self.is_connected = False
            self.enabled_channels = []
            return False
    
    async def _enable_ecg_notifications(self):
        """Enable notifications for ECG channels (matching Web Bluetooth logic)"""
        if not self.client or not self.client.is_connected:
            logger.error("No connected client for enabling notifications")
            return
            
        enabled_channels = []
        
        try:
            logger.info("Discovering services for ECG device...")
            
            # Get all services
            services = self.client.services
            
            # Try to find the ECG service
            ecg_service = None
            for service in services:
                if service.uuid.lower() == TARGET_SERVICE_UUID.lower():
                    ecg_service = service
                    break
                    
            if not ecg_service:
                logger.warning(f"ECG service {TARGET_SERVICE_UUID} not found")
                # List available services for debugging
                logger.info("Available services:")
                for service in services:
                    logger.info(f"  - {service.uuid}")
                return
                
            logger.info(f"Found ECG service: {ecg_service.uuid}")
            
            # Enable notifications for target characteristics
            for target_char_uuid in TARGET_CHARACTERISTIC_UUIDS:
                try:
                    # Find the characteristic
                    characteristic = None
                    for char in ecg_service.characteristics:
                        if char.uuid.lower() == target_char_uuid.lower():
                            characteristic = char
                            break
                            
                    if not characteristic:
                        logger.warning(f"Characteristic {target_char_uuid} not found")
                        continue
                        
                    # Check if notifications are supported
                    if "notify" in characteristic.properties or "indicate" in characteristic.properties:
                        # Enable notifications with callback
                        await self.client.start_notify(
                            characteristic.uuid,
                            self._create_notification_handler(target_char_uuid)
                        )
                        enabled_channels.append(target_char_uuid)
                        logger.info(f"Notifications enabled for characteristic {target_char_uuid}")
                    else:
                        logger.warning(f"Characteristic {target_char_uuid} does not support notifications")
                        
                except Exception as char_error:
                    logger.warning(f"Failed to setup characteristic {target_char_uuid}: {char_error}")
                    
        except Exception as e:
            logger.error(f"Error during ECG setup: {e}")
            
        self.enabled_channels = enabled_channels
        
        if enabled_channels:
            logger.info(f"ECG notifications active for {len(enabled_channels)} channels")
        else:
            logger.warning("Unable to enable ECG notifications")
    
    async def _disable_ecg_notifications(self):
        """Disable all ECG notifications"""
        if not self.client or not self.client.is_connected:
            return
            
        for char_uuid in self.enabled_channels:
            try:
                await self.client.stop_notify(char_uuid)
                logger.info(f"Disabled notifications for {char_uuid}")
            except Exception as e:
                logger.warning(f"Failed to disable notifications for {char_uuid}: {e}")
                
        self.enabled_channels = []
    
    def _create_notification_handler(self, characteristic_uuid: str):
        """Create notification handler for specific characteristic"""
        def notification_handler(sender: BleakGATTCharacteristic, data: bytearray):
            try:
                # Convert data to list of integers (matching Web Bluetooth format)
                raw_data = list(data)
                
                # Map characteristic UUID to channel number
                channel_map = {
                    "00008171-0000-1000-8000-00805f9b34fb": 1,  # Channel 1
                    "00008172-0000-1000-8000-00805f9b34fb": 2,  # Channel 2
                    "00008173-0000-1000-8000-00805f9b34fb": 3,  # Channel 3
                    "00008174-0000-1000-8000-00805f9b34fb": 4,  # Channel 4
                    "00008175-0000-1000-8000-00805f9b34fb": 5,  # Channel 5
                    "00008176-0000-1000-8000-00805f9b34fb": 6,  # Channel 6
                    "00008177-0000-1000-8000-00805f9b34fb": 7,  # Channel 7
                    "00008178-0000-1000-8000-00805f9b34fb": 8,  # Channel 8
                }
                
                channel_number = channel_map.get(characteristic_uuid.lower())
                if not channel_number:
                    logger.warning(f"Unknown characteristic UUID: {characteristic_uuid}")
                    return
                    
                # Process the ECG data (this will be handled by the ECG callback)
                if self.ecg_callback:
                    asyncio.create_task(self.ecg_callback(raw_data, channel_number, characteristic_uuid))
                    
            except Exception as e:
                logger.error(f"Error processing notification from {characteristic_uuid}: {e}")
                
        return notification_handler
    
    def set_ecg_callback(self, callback: Callable):
        """Set callback for ECG data reception"""
        self.ecg_callback = callback
        
    def set_status_callback(self, callback: Callable):
        """Set callback for connection status changes"""
        self.status_callback = callback
    
    def get_connection_status(self) -> Dict[str, Any]:
        """Get current connection status"""
        return {
            "connected": self.is_connected,
            "device_name": self.connected_device.name if self.connected_device else None,
            "device_address": self.connected_device.address if self.connected_device else None,
            "enabled_channels": len(self.enabled_channels),
            "scanning": self.is_scanning
        }

# Global BLE manager instance
ble_manager = BLEManager()
