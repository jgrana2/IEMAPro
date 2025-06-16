use btleplug::platform::{Manager, Peripheral};
use btleplug::api::{
    Central, Characteristic, Manager as _, Peripheral as _, ScanFilter, CharPropFlags,
};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use tokio::time::{sleep, Duration};
use uuid::Uuid;

use crate::parser::{parse_ads1298_single_channel, convert_to_ecg_format, calculate_heart_rate_from_channel, assess_channel_quality, SignalQuality};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BluetoothDevice {
    pub id: String,
    pub name: String,
    pub rssi: Option<i16>,
    pub is_connected: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ECGDataMessage {
    pub ecg_data: HashMap<String, Vec<f64>>,
    pub heart_rate: u32,
    pub quality: SignalQuality,
    pub timestamp: u64,
}

// BLE Configuration for ECG Device
const TARGET_ADDRESS: &str = "6614D41F-1CB3-77FA-3E35-C5A446EA4E3F";
const TARGET_SERVICE_UUID: &str = "0000805b-0000-1000-8000-00805f9b34fb";

// All ADS1298 ECG channels (8171-8178)
const TARGET_CHARACTERISTIC_UUIDS: &[&str] = &[
    "00008171-0000-1000-8000-00805f9b34fb", // Channel 1
    "00008172-0000-1000-8000-00805f9b34fb", // Channel 2
    "00008173-0000-1000-8000-00805f9b34fb", // Channel 3
    "00008174-0000-1000-8000-00805f9b34fb", // Channel 4
    "00008175-0000-1000-8000-00805f9b34fb", // Channel 5
    "00008176-0000-1000-8000-00805f9b34fb", // Channel 6
    "00008177-0000-1000-8000-00805f9b34fb", // Channel 7
    "00008178-0000-1000-8000-00805f9b34fb", // Channel 8
];

pub struct BluetoothManager {
    manager: Manager,
    connected_device: Arc<RwLock<Option<Peripheral>>>,
    data_sender: broadcast::Sender<ECGDataMessage>,
    ecg_buffer: Arc<RwLock<HashMap<u8, Vec<f64>>>>,
}

impl BluetoothManager {
    pub async fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let manager = Manager::new().await?;
        let (data_sender, _) = broadcast::channel(1000);
        let connected_device = Arc::new(RwLock::new(None));
        let ecg_buffer = Arc::new(RwLock::new(HashMap::new()));

        Ok(Self {
            manager,
            connected_device,
            data_sender,
            ecg_buffer,
        })
    }

    pub fn get_data_receiver(&self) -> broadcast::Receiver<ECGDataMessage> {
        self.data_sender.subscribe()
    }

    pub async fn scan_devices(&self) -> Result<Vec<BluetoothDevice>, Box<dyn std::error::Error>> {
        let adapters = self.manager.adapters().await?;
        if adapters.is_empty() {
            return Err("No Bluetooth adapters found".into());
        }

        let central = &adapters[0];
        central.start_scan(ScanFilter::default()).await?;

        // Scan for 5 seconds
        sleep(Duration::from_secs(5)).await;
        central.stop_scan().await?;

        let peripherals = central.peripherals().await?;
        let mut devices = Vec::new();

        for peripheral in peripherals {
            if let Ok(properties) = peripheral.properties().await {
                if let Some(properties) = properties {
                    if let Some(name) = &properties.local_name {
                        if name.contains("IoT Holter") {
                            devices.push(BluetoothDevice {
                                id: peripheral.id().to_string(),
                                name: name.clone(),
                                rssi: properties.rssi,
                                is_connected: false,
                            });
                        }
                    }
                }
            }
        }

        Ok(devices)
    }

    pub async fn connect_device(&self, device_id: &str) -> Result<(), Box<dyn std::error::Error>> {
        let adapters = self.manager.adapters().await?;
        if adapters.is_empty() {
            return Err("No Bluetooth adapters found".into());
        }

        let central = &adapters[0];
        let peripherals = central.peripherals().await?;

        for peripheral in peripherals {
            if peripheral.id().to_string() == device_id {
                tracing::info!("Connecting to device: {}", device_id);
                
                peripheral.connect().await?;
                peripheral.discover_services().await?;

                // Store connected device
                {
                    let mut connected = self.connected_device.write().await;
                    *connected = Some(peripheral.clone());
                }

                // Setup ECG notifications
                self.setup_ecg_notifications(&peripheral).await?;
                
                tracing::info!("Successfully connected to device: {}", device_id);
                return Ok(());
            }
        }

        Err(format!("Device {} not found", device_id).into())
    }

    pub async fn disconnect_device(&self) -> Result<(), Box<dyn std::error::Error>> {
        let mut connected = self.connected_device.write().await;
        
        if let Some(peripheral) = connected.take() {
            peripheral.disconnect().await?;
            tracing::info!("Device disconnected");
        }

        // Clear ECG buffer
        {
            let mut buffer = self.ecg_buffer.write().await;
            buffer.clear();
        }

        Ok(())
    }

    pub async fn is_connected(&self) -> bool {
        let connected = self.connected_device.read().await;
        if let Some(peripheral) = connected.as_ref() {
            peripheral.is_connected().await.unwrap_or(false)
        } else {
            false
        }
    }

    async fn setup_ecg_notifications(&self, peripheral: &Peripheral) -> Result<(), Box<dyn std::error::Error>> {
        let service_uuid = Uuid::parse_str(TARGET_SERVICE_UUID)?;
        
        let services = peripheral.services();
        let service = services.iter()
            .find(|s| s.uuid == service_uuid)
            .ok_or("ECG service not found")?;

        let mut enabled_channels = 0;

        for (channel_num, &char_uuid_str) in TARGET_CHARACTERISTIC_UUIDS.iter().enumerate() {
            let char_uuid = Uuid::parse_str(char_uuid_str)?;
            
            if let Some(characteristic) = service.characteristics.iter().find(|c| c.uuid == char_uuid) {
                if characteristic.properties.contains(CharPropFlags::NOTIFY) || characteristic.properties.contains(CharPropFlags::INDICATE) {
                    peripheral.subscribe(characteristic).await?;
                    
                    let channel_number = (channel_num + 1) as u8;
                    let sender = self.data_sender.clone();
                    let buffer = self.ecg_buffer.clone();
                    
                    // Setup notification handler
                    let peripheral_clone = peripheral.clone();
                    let characteristic_clone = characteristic.clone();
                    
                    tokio::spawn(async move {
                        Self::handle_characteristic_notifications(
                            peripheral_clone,
                            characteristic_clone,
                            channel_number,
                            sender,
                            buffer,
                        ).await;
                    });
                    
                    enabled_channels += 1;
                    tracing::info!("Enabled notifications for channel {} ({})", channel_number, char_uuid_str);
                }
            }
        }

        if enabled_channels == 0 {
            return Err("No ECG characteristics found or notifications not supported".into());
        }

        tracing::info!("Successfully enabled {} ECG channels", enabled_channels);
        Ok(())
    }

    async fn handle_characteristic_notifications(
        peripheral: Peripheral,
        characteristic: Characteristic,
        channel_number: u8,
        sender: broadcast::Sender<ECGDataMessage>,
        buffer: Arc<RwLock<HashMap<u8, Vec<f64>>>>,
    ) {
        if let Ok(mut notification_stream) = peripheral.notifications().await {
            while let Some(data) = notification_stream.next().await {
                if data.uuid == characteristic.uuid {
                    // Parse single channel data (28 samples of 24-bit values)
                    let channel_samples = parse_ads1298_single_channel(&data.value, channel_number);
                    
                    if !channel_samples.is_empty() {
                        // Update buffer
                        {
                            let mut buffer_guard = buffer.write().await;
                            let channel_buffer = buffer_guard.entry(channel_number).or_insert_with(Vec::new);
                            
                            // Append new samples
                            channel_buffer.extend_from_slice(&channel_samples);
                            
                            // Keep only the most recent 2500 samples (10 seconds at 250Hz)
                            const MAX_BUFFER_SIZE: usize = 2500;
                            if channel_buffer.len() > MAX_BUFFER_SIZE {
                                let start = channel_buffer.len() - MAX_BUFFER_SIZE;
                                *channel_buffer = channel_buffer[start..].to_vec();
                            }
                        }
                        
                        // Convert to ECG format and send
                        let buffer_snapshot = {
                            let buffer_guard = buffer.read().await;
                            buffer_guard.clone()
                        };
                        
                        let ecg_data = convert_to_ecg_format(&buffer_snapshot);
                        let heart_rate = calculate_heart_rate_from_channel(&channel_samples);
                        let quality = assess_channel_quality(&channel_samples);
                        
                        let message = ECGDataMessage {
                            ecg_data,
                            heart_rate,
                            quality,
                            timestamp: std::time::SystemTime::now()
                                .duration_since(std::time::UNIX_EPOCH)
                                .unwrap()
                                .as_millis() as u64,
                        };
                        
                        if let Err(e) = sender.send(message) {
                            tracing::error!("Failed to send ECG data: {}", e);
                        }
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_bluetooth_manager_creation() {
        let manager = BluetoothManager::new().await;
        assert!(manager.is_ok());
    }
    
    #[test]
    fn test_uuid_parsing() {
        for &uuid_str in TARGET_CHARACTERISTIC_UUIDS {
            let uuid = Uuid::parse_str(uuid_str);
            assert!(uuid.is_ok(), "Failed to parse UUID: {}", uuid_str);
        }
    }
}