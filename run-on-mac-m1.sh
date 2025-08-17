#!/usr/bin/env bash
set -euo pipefail

# Run helper for macOS (M1) development: starts backend (FastAPI) and frontend (Vite+Express)
# - Creates/uses Python venv at backend/.venv
# - Installs Python requirements
# - Starts uvicorn backend (port 5000 by default)
# - Installs node deps if missing
# - Starts npm run dev which runs the Express + Vite dev server (port 3000)

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$REPO_ROOT/logs"
BACKEND_DIR="$REPO_ROOT/backend"

mkdir -p "$LOG_DIR"

echo "IEMAPro macOS helper — repo root: $REPO_ROOT"

echo "Checking required tools..."
command -v node >/dev/null 2>&1 || { echo "node not found. Install Node.js (v18+). Exiting."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm not found. Install Node.js/npm. Exiting."; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "python3 not found. Install Python 3.8+. Exiting."; exit 1; }

echo "Node: $(node -v)  npm: $(npm -v)  Python: $(python3 -V)"

# Check Bluetooth availability on macOS
echo "Checking Bluetooth availability..."
if system_profiler SPBluetoothDataType 2>/dev/null | grep -q "Bluetooth Power: On"; then
  echo "✓ Bluetooth is enabled"
else
  echo "⚠ Bluetooth may be disabled or not available"
  echo "  Please ensure Bluetooth is enabled in System Preferences"
fi

# 1) Setup Python venv and install backend requirements
# Check for existing virtual environment (prefer .venv, fallback to env)
if [ -d "$BACKEND_DIR/.venv" ]; then
  VENV_DIR="$BACKEND_DIR/.venv"
elif [ -d "$BACKEND_DIR/env" ]; then
  VENV_DIR="$BACKEND_DIR/env"
  echo "Using existing virtual environment at $VENV_DIR"
else
  VENV_DIR="$BACKEND_DIR/.venv"
  echo "Creating Python virtualenv at $VENV_DIR"
  python3 -m venv "$VENV_DIR"
fi

# shellcheck disable=SC1090
source "$VENV_DIR/bin/activate"

echo "Upgrading pip/build tools..."
pip install --upgrade pip setuptools wheel >/dev/null

if [ -f "$BACKEND_DIR/requirements.txt" ]; then
  echo "Installing backend Python requirements (may take a few minutes)..."
  pip install -r "$BACKEND_DIR/requirements.txt"
else
  echo "Warning: $BACKEND_DIR/requirements.txt not found — skipping Python deps install."
fi

if [ -z "${ANTHROPIC_API_KEY-}" ]; then
  echo "Note: ANTHROPIC_API_KEY not set; AI features will be disabled unless you set it." 
fi

# Use a fixed port for the backend (skip auto-port detection)
BACKEND_PORT="${BACKEND_PORT:-8000}"
echo "Using backend port $BACKEND_PORT"

# Kill any existing process on this port to ensure consistency
if lsof -i ":$BACKEND_PORT" >/dev/null 2>&1; then
  echo "Port $BACKEND_PORT is in use, killing existing process..."
  lsof -ti ":$BACKEND_PORT" | xargs kill -9 2>/dev/null || true
  sleep 1
fi

# Check if backend is already running
if [ -f "$LOG_DIR/backend.pid" ] && kill -0 "$(cat "$LOG_DIR/backend.pid")" 2>/dev/null; then
  BACKEND_PID=$(cat "$LOG_DIR/backend.pid")
  echo "Backend already running (PID: $BACKEND_PID)"
  # Get the port from the running process
  BACKEND_PORT=$(lsof -p "$BACKEND_PID" -a -i -sTCP:LISTEN | awk 'NR>1 {print $9}' | cut -d: -f2 | head -1)
  echo "Backend running on port $BACKEND_PORT"
else
  echo "Starting backend on port $BACKEND_PORT (logs => $LOG_DIR/backend.log)"
  cd "$BACKEND_DIR"
  nohup uvicorn main:app --host 0.0.0.0 --port "$BACKEND_PORT" --reload >"$LOG_DIR/backend.log" 2>&1 &
  BACKEND_PID=$!
  echo "$BACKEND_PID" > "$LOG_DIR/backend.pid"
  cd "$REPO_ROOT"
  
  # Wait for backend to start and verify it's running
  sleep 3
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "Error: Backend failed to start. Check $LOG_DIR/backend.log for details."
    cat "$LOG_DIR/backend.log"
    exit 1
  fi
fi

# Test backend connectivity
if ! curl -s "http://localhost:$BACKEND_PORT/api/ble/status" >/dev/null; then
  echo "Warning: Backend is not responding on port $BACKEND_PORT"
fi

# 2) Ensure Node deps are installed
if [ ! -d "$REPO_ROOT/node_modules" ]; then
  echo "Installing node dependencies (npm ci)..."
  npm ci || npm install
fi

# 3) Start frontend + Express dev server (npm run dev)
# Check if frontend is already running
if [ -f "$LOG_DIR/frontend.pid" ] && kill -0 "$(cat "$LOG_DIR/frontend.pid")" 2>/dev/null; then
  FRONTEND_PID=$(cat "$LOG_DIR/frontend.pid")
  echo "Frontend already running (PID: $FRONTEND_PID)"
else
  echo "Starting frontend + Express dev server (port 3000) — logs => $LOG_DIR/frontend.log"
  # Set backend port for frontend to use
  export BACKEND_PORT
  nohup npm run dev >"$LOG_DIR/frontend.log" 2>&1 &
  FRONTEND_PID=$!
  echo "$FRONTEND_PID" > "$LOG_DIR/frontend.pid"
fi

echo "Started backend (PID: $BACKEND_PID) and frontend (PID: $FRONTEND_PID)."
echo "Frontend: http://localhost:3000  Backend: http://localhost:$BACKEND_PORT"
echo "Logs: $LOG_DIR"
echo ""
echo "🔍 Device Scanning Information:"
echo "   - The application supports scanning for IoT Holter ECG devices"
echo "   - Backend provides BLE scanning via Python's 'bleak' library"
echo "   - Frontend uses the Python backend for device discovery and connection"
echo "   - To scan for devices, use the 'Scan for Devices' button in the web interface"
echo "   - API endpoints available:"
echo "     • POST /api/ble/scan - Scan for BLE devices"
echo "     • POST /api/ble/connect/{device_id} - Connect to device"
echo "     • GET /api/ble/status - Check connection status"
echo "     • POST /api/ble/disconnect - Disconnect current device"
echo ""
echo "📱 Testing device scanning:"
if command -v curl >/dev/null 2>&1; then
  echo "   Testing BLE status endpoint..."
  if curl -s "http://localhost:$BACKEND_PORT/api/ble/status" >/dev/null; then
    echo "   ✓ Backend BLE API is accessible"
    echo "   📡 You can test device scanning with:"
    echo "      curl -X POST http://localhost:$BACKEND_PORT/api/ble/scan"
  else
    echo "   ⚠ Backend BLE API is not responding"
  fi
else
  echo "   (curl not available for testing)"
fi

# Cleanup handler: kill both processes when this script receives SIGINT/SIGTERM
cleanup() {
  echo "Stopping services..."
  if [ -n "${FRONTEND_PID-}" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    kill "$FRONTEND_PID" 2>/dev/null || true
    echo "Frontend stopped (PID: $FRONTEND_PID)"
  fi
  if [ -n "${BACKEND_PID-}" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
    echo "Backend stopped (PID: $BACKEND_PID)"
  fi
  # Clean up PID files
  rm -f "$LOG_DIR/backend.pid" "$LOG_DIR/frontend.pid"
  echo "✓ All services stopped"
  exit 0
}

# Helper function to check service status
check_services() {
  echo "📊 Service Status:"
  if [ -f "$LOG_DIR/backend.pid" ] && kill -0 "$(cat "$LOG_DIR/backend.pid")" 2>/dev/null; then
    echo "   Backend: ✓ Running (PID: $(cat "$LOG_DIR/backend.pid"))"
    if curl -s "http://localhost:$BACKEND_PORT/api/ble/status" >/dev/null 2>&1; then
      echo "   Backend API: ✓ Responding"
    else
      echo "   Backend API: ⚠ Not responding"
    fi
  else
    echo "   Backend: ✗ Not running"
  fi
  
  if [ -f "$LOG_DIR/frontend.pid" ] && kill -0 "$(cat "$LOG_DIR/frontend.pid")" 2>/dev/null; then
    echo "   Frontend: ✓ Running (PID: $(cat "$LOG_DIR/frontend.pid"))"
    if curl -s http://localhost:3000 >/dev/null 2>&1; then
      echo "   Frontend: ✓ Accessible at http://localhost:3000"
    else
      echo "   Frontend: ⚠ Not responding on port 3000"
    fi
  else
    echo "   Frontend: ✗ Not running"
  fi
}

trap cleanup SIGINT SIGTERM

# Check service status after startup
sleep 2
check_services

echo ""
echo "🎯 Ready to scan for IoT Holter devices!"
echo "   1. Open http://localhost:3000 in your browser"
echo "   2. Click 'Scan for Devices' in the interface"
echo "   3. Or test directly: curl -X POST http://localhost:$BACKEND_PORT/api/ble/scan"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait so the script stays active and the trap can run (press Ctrl+C to stop)
wait
