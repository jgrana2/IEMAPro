# ECG Monitoring Backend

FastAPI backend with BLE support for ECG monitoring system. This replaces the Node.js/Express server with a Python implementation using bleak for Bluetooth Low Energy communication.

## Features

- **FastAPI REST API** - Identical endpoints to the original Express server
- **WebSocket Support** - Real-time ECG data streaming
- **BLE Communication** - Python bleak library for reliable Bluetooth connectivity
- **SQLite Database** - Local data storage matching the original schema
- **AI Diagnosis** - Anthropic Claude integration for ECG analysis
- **ADS1298 Support** - Full compatibility with existing ECG device protocol

## Architecture

```
ADS1298 Device → Python BLE (bleak) → FastAPI → WebSocket → React Frontend
```

## Prerequisites

- Python 3.8 or higher
- macOS (for BLE support with bleak)
- Optional: Anthropic API key for AI diagnosis features

## Quick Start

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Run the development server:**
   ```bash
   python start_server.py
   ```

   This will:
   - Install all Python dependencies
   - Run backend tests
   - Start the FastAPI server on http://127.0.0.1:5000

3. **Access the API:**
   - API Server: http://localhost:5000
   - API Documentation: http://localhost:5000/docs
   - WebSocket: ws://localhost:5000/ws

## Manual Setup

If you prefer manual setup:

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Run tests:**
   ```bash
   python test_backend.py
   ```

3. **Start server:**
   ```bash
   uvicorn main:app --host 127.0.0.1 --port 5000 --reload
   ```

### Desktop App Launcher

To open the app in a native desktop window with `pywebview`:

```bash
python desktop_app.py
```

This starts the local FastAPI backend and opens the built frontend in a desktop window.

## Environment Variables

Create a `.env` file in the backend directory:

```env
# Optional: Anthropic API key for AI diagnosis
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Optional: Environment setting
ENVIRONMENT=development
```

## API Endpoints

The backend provides identical endpoints to the original Express server:

### Patients
- `GET /api/patients` - Get all patients
- `GET /api/patients/{id}` - Get patient by ID
- `POST /api/patients` - Create new patient

### BLE Devices
- `GET /api/ble-devices` - Get all BLE devices
- `POST /api/ble-devices` - Create new BLE device
- `PATCH /api/ble-devices/{id}` - Update BLE device
- `PATCH /api/ble-devices/device/{deviceId}` - Update by device ID

### Recording Sessions
- `GET /api/recording-sessions` - Get all sessions
- `GET /api/recording-sessions/patient/{patientId}` - Get sessions by patient
- `POST /api/recording-sessions` - Create new session
- `PATCH /api/recording-sessions/{id}` - Update session

### BLE Management (New)
- `POST /api/ble/scan` - Scan for BLE devices
- `POST /api/ble/connect` - Connect to BLE device
- `POST /api/ble/disconnect` - Disconnect from BLE device
- `GET /api/ble/status` - Get BLE connection status

### AI Diagnosis
- `POST /api/ai-diagnosis` - Analyze ECG with AI

### System Logs
- `GET /api/system-logs` - Get system logs
- `POST /api/system-logs` - Create system log

### WebSocket
- `WS /ws` - Real-time ECG data streaming

## BLE Configuration

The backend is configured for ADS1298 ECG devices with these specifications:

- **Target Device**: IoT Holter ECG devices
- **Service UUID**: `0000805b-0000-1000-8000-00805f9b34fb`
- **Characteristics**: `00008171` through `00008178` (8 ECG channels)
- **Data Format**: 28 samples × 3 bytes (24-bit) per characteristic

## Database Schema

SQLite database with tables matching the original PostgreSQL schema:

- `patients` - Patient information
- `ble_devices` - BLE device registry
- `recording_sessions` - ECG recording sessions
- `system_logs` - Application logs

## Development

### Project Structure

```
backend/
├── main.py              # FastAPI application
├── routes.py            # API routes and WebSocket
├── models.py            # Pydantic data models
├── storage.py           # Database operations
├── ble_manager.py       # BLE communication with bleak
├── ecg_processor.py     # ECG data parsing
├── ai_diagnosis.py      # AI analysis integration
├── requirements.txt     # Python dependencies
├── start_server.py      # Development server script
├── test_backend.py      # Backend tests
└── README.md           # This file
```

### Testing

Run the test suite:

```bash
python test_backend.py
```

Tests cover:
- Database operations
- Patient/device management
- System logging
- Basic API functionality

### BLE Testing

To test BLE functionality:

1. Ensure your IoT Holter device is powered on
2. Start the backend server
3. Use the BLE scan endpoint: `POST /api/ble/scan`
4. Connect to device: `POST /api/ble/connect`
5. Monitor WebSocket for real-time ECG data

## Migration from Express Server

This FastAPI backend is designed as a drop-in replacement for the Express server:

1. **Identical API**: All endpoints match the original Express routes
2. **Same WebSocket Protocol**: Compatible message formats
3. **Database Compatibility**: SQLite schema matches PostgreSQL structure
4. **ECG Processing**: Identical ADS1298 data parsing logic

## Troubleshooting

### BLE Issues
- Ensure Bluetooth is enabled on macOS
- Check device permissions for Bluetooth access
- Verify IoT Holter device is in pairing mode

### Database Issues
- Database file (`ecg_monitor.db`) is created automatically
- Check file permissions in the backend directory

### API Issues
- Verify server is running on port 5000
- Check CORS settings for frontend integration
- Review server logs for detailed error information

## Production Deployment

For production deployment:

1. Set `ENVIRONMENT=production`
2. Configure proper CORS origins
3. Use a production ASGI server (e.g., gunicorn with uvicorn workers)
4. Set up proper logging and monitoring
5. Configure SSL/TLS certificates

## Contributing

1. Follow Python PEP 8 style guidelines
2. Add tests for new functionality
3. Update documentation for API changes
4. Test BLE functionality with actual hardware

## License

Same license as the main project.
