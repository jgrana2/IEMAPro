# IEMAPro Development Scripts

This directory contains scripts for running the IEMAPro ECG monitoring application on macOS (Apple Silicon).

## Scripts

### `run-on-mac-m1.sh`
Main script to start the entire application stack including device scanning functionality.

**Features:**
- ✅ Automatic Python virtual environment setup
- ✅ Port conflict detection and resolution
- ✅ Bluetooth availability checking
- ✅ BLE device scanning support
- ✅ Service health monitoring
- ✅ Graceful shutdown handling

**Usage:**
```bash
./run-on-mac-m1.sh
```

**What it does:**
1. Checks system requirements (Node.js, npm, Python)
2. Verifies Bluetooth availability
3. Creates/activates Python virtual environment
4. Installs Python dependencies
5. Finds available port for backend (default 5001, avoids macOS AirPlay port 5000)
6. Starts FastAPI backend with BLE scanning
7. Starts frontend development server
8. Provides device scanning information and endpoints
9. Monitors service health

### `stop-services.sh`
Utility script to stop all running services.

**Usage:**
```bash
./stop-services.sh
```

## Device Scanning

The application supports scanning for IoT Holter ECG devices using:

### Backend (Python + Bleak)
- **Library:** `bleak` for cross-platform BLE support
- **Target devices:** IoT Holter ECG devices
- **Supported channels:** 8-channel ADS1298 ECG data

### API Endpoints
| Endpoint | Method | Description |
|----------|---------|-------------|
| `/api/ble/scan` | POST | Scan for BLE devices |
| `/api/ble/status` | GET | Check connection status |
| `/api/ble/connect/{device_id}` | POST | Connect to device |
| `/api/ble/disconnect` | POST | Disconnect current device |

### Frontend Integration
- Uses `usePythonBLE` hook for device management
- Provides UI for device scanning and connection
- Real-time ECG data visualization
- Device status monitoring

## Testing Device Scanning

### Command Line Testing
```bash
# Check BLE status
curl http://localhost:5001/api/ble/status

# Scan for devices
curl -X POST http://localhost:5001/api/ble/scan

# Connect to a device (replace {device_id} with actual device ID)
curl -X POST http://localhost:5001/api/ble/connect/{device_id}
```

### Web Interface Testing
1. Open http://localhost:3000
2. Navigate to ECG Monitor
3. Click "Scan for Devices" button
4. Select device from the list
5. Monitor connection status and ECG data

## System Requirements

- **macOS:** Apple Silicon (M1/M2/M3) or Intel
- **Node.js:** v18+
- **Python:** 3.8+
- **Bluetooth:** Enabled and available

## Troubleshooting

### Port Conflicts
- The script automatically finds available ports
- Backend avoids port 5000 (used by macOS AirPlay)
- Default backend port: 5001
- Frontend port: 3000

### Bluetooth Issues
- Ensure Bluetooth is enabled in System Preferences
- Grant Bluetooth permissions to Terminal/VS Code
- Check that no other applications are using the BLE device

### Python Environment
- Virtual environment is created automatically in `backend/.venv`
- All dependencies are installed from `backend/requirements.txt`
- Use the activation script if running backend manually:
  ```bash
  source backend/.venv/bin/activate
  ```

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   IoT Holter    │
│   (React/TS)    │◄──►│   (FastAPI)     │◄──►│   ECG Device    │
│   Port: 3000    │    │   Port: 5001    │    │   (Bluetooth)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                       │                       │
        │                       │                       │
   Web Bluetooth          Python Bleak               BLE GATT
   (Alternative)            (Primary)               (8 Channels)
```

## Environment Variables

- `ANTHROPIC_API_KEY`: Optional, for AI diagnosis features
- `BACKEND_PORT`: Override default backend port
- `NODE_ENV`: Set to 'development' for frontend

## Logs

All service logs are written to the `logs/` directory:
- `backend.log`: Python backend logs
- `frontend.log`: Node.js frontend logs
- `backend.pid`: Backend process ID
- `frontend.pid`: Frontend process ID
