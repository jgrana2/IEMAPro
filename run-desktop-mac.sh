#!/usr/bin/env bash
set -euo pipefail

# Run helper for the desktop app on macOS.
# - Ensures the backend virtualenv exists
# - Installs Python requirements if needed
# - Builds the frontend bundle if missing
# - Launches the pywebview desktop runtime

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"
DIST_DIR="$REPO_ROOT/dist/public"
LOG_DIR="$REPO_ROOT/logs"

mkdir -p "$LOG_DIR"

echo "IEMAPro desktop helper — repo root: $REPO_ROOT"

command -v python3 >/dev/null 2>&1 || { echo "python3 not found. Install Python 3.8+. Exiting."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm not found. Install Node.js/npm. Exiting."; exit 1; }

echo "Python: $(python3 -V)  npm: $(npm -v)"

if [ -d "$BACKEND_DIR/.venv" ]; then
  VENV_DIR="$BACKEND_DIR/.venv"
elif [ -d "$BACKEND_DIR/env" ]; then
  VENV_DIR="$BACKEND_DIR/env"
else
  VENV_DIR="$BACKEND_DIR/.venv"
  echo "Creating Python virtualenv at $VENV_DIR"
  python3 -m venv "$VENV_DIR"
fi

# shellcheck disable=SC1090
source "$VENV_DIR/bin/activate"

echo "Upgrading pip/build tools..."
pip install --upgrade pip setuptools wheel >/dev/null

echo "Installing backend Python requirements..."
pip install -r "$BACKEND_DIR/requirements.txt"

if [ ! -d "$DIST_DIR" ] || [ ! -f "$DIST_DIR/index.html" ]; then
  echo "Frontend bundle not found. Building frontend..."
  npm run build
fi

export APP_HOST="${APP_HOST:-127.0.0.1}"
export APP_PORT="${APP_PORT:-8001}"
export APP_URL="${APP_URL:-http://$APP_HOST:$APP_PORT}"
export APP_STARTUP_DELAY="${APP_STARTUP_DELAY:-1.5}"

echo "Launching desktop app..."
echo "  Backend: http://$APP_HOST:$APP_PORT"
echo "  UI: $APP_URL"

cd "$REPO_ROOT"
exec python -m backend.desktop_app
