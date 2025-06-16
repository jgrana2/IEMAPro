use futures_util::{sink::SinkExt, stream::StreamExt};
use serde_json;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio_tungstenite::{accept_async, tungstenite::Message};
use tracing::{error, info};

use crate::bluetooth::BluetoothManager;

pub struct WebSocketHandler {
    bluetooth_manager: Arc<BluetoothManager>,
    clients: Arc<RwLock<Vec<tokio_tungstenite::WebSocketStream<tokio::net::TcpStream>>>>,
}

impl WebSocketHandler {
    pub fn new(bluetooth_manager: Arc<BluetoothManager>) -> Self {
        Self {
            bluetooth_manager,
            clients: Arc::new(RwLock::new(Vec::new())),
        }
    }

    pub async fn handle_connection(
        &self,
        stream: tokio::net::TcpStream,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let ws_stream = accept_async(stream).await?;
        info!("New WebSocket connection established");

        let (mut ws_sender, mut ws_receiver) = ws_stream.split();
        let mut data_receiver = self.bluetooth_manager.get_data_receiver();

        // Handle incoming WebSocket messages
        let ws_receive_task = async move {
            while let Some(msg) = ws_receiver.next().await {
                match msg {
                    Ok(Message::Text(text)) => {
                        info!("Received WebSocket message: {}", text);
                        // Handle client messages if needed (e.g., configuration)
                    }
                    Ok(Message::Close(_)) => {
                        info!("WebSocket connection closed by client");
                        break;
                    }
                    Err(e) => {
                        error!("WebSocket receive error: {}", e);
                        break;
                    }
                    _ => {}
                }
            }
        };

        // Handle outgoing ECG data
        let ws_send_task = async move {
            while let Ok(ecg_message) = data_receiver.recv().await {
                let json_message = match serde_json::to_string(&ecg_message) {
                    Ok(json) => json,
                    Err(e) => {
                        error!("Failed to serialize ECG data: {}", e);
                        continue;
                    }
                };

                if let Err(e) = ws_sender.send(Message::Text(json_message)).await {
                    error!("Failed to send WebSocket message: {}", e);
                    break;
                }
            }
        };

        // Run both tasks concurrently
        tokio::select! {
            _ = ws_receive_task => {
                info!("WebSocket receive task completed");
            }
            _ = ws_send_task => {
                info!("WebSocket send task completed");
            }
        }

        Ok(())
    }
}

pub async fn start_websocket_server(
    bluetooth_manager: Arc<BluetoothManager>,
    port: u16,
) -> Result<(), Box<dyn std::error::Error>> {
    let addr = format!("127.0.0.1:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    info!("WebSocket server listening on: {}", addr);

    let handler = Arc::new(WebSocketHandler::new(bluetooth_manager));

    while let Ok((stream, addr)) = listener.accept().await {
        info!("New connection from: {}", addr);
        let handler_clone = handler.clone();

        tokio::spawn(async move {
            if let Err(e) = handler_clone.handle_connection(stream).await {
                error!("WebSocket connection error: {}", e);
            }
        });
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::bluetooth::BluetoothManager;

    #[tokio::test]
    async fn test_websocket_handler_creation() {
        let bluetooth_manager = Arc::new(BluetoothManager::new().await.unwrap());
        let handler = WebSocketHandler::new(bluetooth_manager);
        
        // Test that handler is created successfully
        assert!(handler.clients.read().await.is_empty());
    }
}