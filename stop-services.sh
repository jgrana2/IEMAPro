#!/usr/bin/env bash
set -euo pipefail

# Stop script for IEMAPro development services
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$REPO_ROOT/logs"

echo "Stopping IEMAPro services..."

# Function to stop a service by PID file
stop_service() {
  local service_name=$1
  local pid_file="$LOG_DIR/${service_name}.pid"
  
  if [ -f "$pid_file" ]; then
    local pid=$(cat "$pid_file")
    if kill -0 "$pid" 2>/dev/null; then
      echo "Stopping $service_name (PID: $pid)..."
      kill "$pid" 2>/dev/null || true
      sleep 1
      if kill -0 "$pid" 2>/dev/null; then
        echo "Force stopping $service_name..."
        kill -9 "$pid" 2>/dev/null || true
      fi
      echo "✓ $service_name stopped"
    else
      echo "⚠ $service_name PID file exists but process not running"
    fi
    rm -f "$pid_file"
  else
    echo "ℹ No $service_name PID file found"
  fi
}

# Stop services
stop_service "backend"
stop_service "frontend"

# Also kill any remaining processes (fallback)
echo "Cleaning up any remaining processes..."
pkill -f "uvicorn.*main:app" 2>/dev/null || true
pkill -f "tsx.*server/index.ts" 2>/dev/null || true

echo "✓ All services stopped"
