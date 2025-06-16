use bluetooth_server::server::run_server;
use tracing_subscriber;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt::init();
    
    println!("Starting Bluetooth ECG Server on localhost:3001");
    run_server().await?;
    
    Ok(())
}