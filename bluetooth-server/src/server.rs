use serde::{Deserialize, Serialize};
use std::convert::Infallible;
use std::sync::Arc;
use warp::Filter;

use crate::bluetooth::{BluetoothDevice, BluetoothManager};
use crate::websocket::start_websocket_server;

#[derive(Debug, Serialize, Deserialize)]
struct ApiResponse<T> {
    success: bool,
    data: Option<T>,
    error: Option<String>,
}

impl<T> ApiResponse<T> {
    fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    fn error(message: String) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(message),
        }
    }
}

#[derive(Debug, Deserialize)]
struct ConnectRequest {
    device_id: String,
}

#[derive(Debug, Serialize)]
struct StatusResponse {
    connected: bool,
    device_id: Option<String>,
}

pub async fn run_server() -> Result<(), Box<dyn std::error::Error>> {
    let bluetooth_manager = Arc::new(BluetoothManager::new().await?);
    
    // Start WebSocket server for ECG data streaming
    let bluetooth_manager_ws = bluetooth_manager.clone();
    tokio::spawn(async move {
        if let Err(e) = start_websocket_server(bluetooth_manager_ws, 3002).await {
            tracing::error!("WebSocket server error: {}", e);
        }
    });

    // HTTP API routes
    let bluetooth_manager_filter = warp::any().map(move || bluetooth_manager.clone());

    // GET /devices - List available devices
    let devices_route = warp::path("devices")
        .and(warp::get())
        .and(bluetooth_manager_filter.clone())
        .and_then(handle_scan_devices);

    // POST /devices/connect - Connect to a device
    let connect_route = warp::path!("devices" / "connect")
        .and(warp::post())
        .and(warp::body::json())
        .and(bluetooth_manager_filter.clone())
        .and_then(handle_connect_device);

    // POST /devices/disconnect - Disconnect current device
    let disconnect_route = warp::path!("devices" / "disconnect")
        .and(warp::post())
        .and(bluetooth_manager_filter.clone())
        .and_then(handle_disconnect_device);

    // GET /devices/status - Get connection status
    let status_route = warp::path!("devices" / "status")
        .and(warp::get())
        .and(bluetooth_manager_filter.clone())
        .and_then(handle_device_status);

    // Health check
    let health_route = warp::path("health")
        .and(warp::get())
        .map(|| warp::reply::json(&ApiResponse::success("OK")));

    // Combine all routes
    let api_routes = devices_route
        .or(connect_route)
        .or(disconnect_route)
        .or(status_route)
        .or(health_route);

    // Enhanced CORS configuration with explicit preflight handling
    let cors = warp::cors()
        .allow_any_origin()
        .allow_headers(vec![
            "content-type", 
            "authorization", 
            "accept", 
            "origin", 
            "user-agent",
            "x-requested-with",
            "access-control-allow-origin",
            "access-control-allow-headers",
            "access-control-allow-methods"
        ])
        .allow_methods(vec!["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"])
        .max_age(3600);

    // Add explicit OPTIONS handler for preflight requests
    let options_route = warp::options()
        .map(|| {
            tracing::info!("Handling CORS preflight request");
            warp::reply::with_status("", warp::http::StatusCode::OK)
        });

    let routes = api_routes
        .or(options_route)
        .with(cors)
        .with(warp::log("api"));

    // Start HTTP server
    tracing::info!("Starting HTTP server on 127.0.0.1:3001");
    warp::serve(routes)
        .run(([127, 0, 0, 1], 3001))
        .await;

    Ok(())
}

async fn handle_scan_devices(
    bluetooth_manager: Arc<BluetoothManager>,
) -> Result<impl warp::Reply, Infallible> {
    match bluetooth_manager.scan_devices().await {
        Ok(devices) => {
            tracing::info!("Found {} devices", devices.len());
            Ok(warp::reply::json(&ApiResponse::success(devices)))
        }
        Err(e) => {
            tracing::error!("Failed to scan devices: {}", e);
            Ok(warp::reply::json(&ApiResponse::<Vec<BluetoothDevice>>::error(
                e.to_string(),
            )))
        }
    }
}

async fn handle_connect_device(
    request: ConnectRequest,
    bluetooth_manager: Arc<BluetoothManager>,
) -> Result<impl warp::Reply, Infallible> {
    tracing::info!("Connecting to device: {}", request.device_id);
    
    match bluetooth_manager.connect_device(&request.device_id).await {
        Ok(()) => {
            tracing::info!("Successfully connected to device: {}", request.device_id);
            Ok(warp::reply::json(&ApiResponse::success(
                "Device connected successfully",
            )))
        }
        Err(e) => {
            tracing::error!("Failed to connect to device {}: {}", request.device_id, e);
            Ok(warp::reply::json(&ApiResponse::<String>::error(
                e.to_string(),
            )))
        }
    }
}

async fn handle_disconnect_device(
    bluetooth_manager: Arc<BluetoothManager>,
) -> Result<impl warp::Reply, Infallible> {
    tracing::info!("Disconnecting device");
    
    match bluetooth_manager.disconnect_device().await {
        Ok(()) => {
            tracing::info!("Device disconnected successfully");
            Ok(warp::reply::json(&ApiResponse::success(
                "Device disconnected successfully",
            )))
        }
        Err(e) => {
            tracing::error!("Failed to disconnect device: {}", e);
            Ok(warp::reply::json(&ApiResponse::<String>::error(
                e.to_string(),
            )))
        }
    }
}

async fn handle_device_status(
    bluetooth_manager: Arc<BluetoothManager>,
) -> Result<impl warp::Reply, Infallible> {
    let connected = bluetooth_manager.is_connected().await;
    
    let status = StatusResponse {
        connected,
        device_id: if connected { 
            Some("connected_device".to_string()) // In a real app, store actual device ID
        } else { 
            None 
        },
    };
    
    Ok(warp::reply::json(&ApiResponse::success(status)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_api_response_success() {
        let response = ApiResponse::success("test data");
        assert!(response.success);
        assert_eq!(response.data, Some("test data"));
        assert!(response.error.is_none());
    }

    #[test]
    fn test_api_response_error() {
        let response = ApiResponse::<String>::error("test error".to_string());
        assert!(!response.success);
        assert!(response.data.is_none());
        assert_eq!(response.error, Some("test error".to_string()));
    }
}
