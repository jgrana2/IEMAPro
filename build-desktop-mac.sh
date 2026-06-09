#!/usr/bin/env bash
set -euo pipefail

# Build a macOS .app bundle for the pywebview desktop launcher.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"
BUILD_DIR="$REPO_ROOT/build"
RELEASE_DIR="$REPO_ROOT/release"

command -v python3 >/dev/null 2>&1 || { echo "python3 not found. Install Python 3 first."; exit 1; }

if [ ! -d "$BACKEND_DIR/.venv" ] && [ ! -d "$BACKEND_DIR/env" ]; then
  echo "No backend virtualenv found. Create one under backend/.venv or backend/env first."
  exit 1
fi

if [ -d "$BACKEND_DIR/.venv" ]; then
  VENV_DIR="$BACKEND_DIR/.venv"
else
  VENV_DIR="$BACKEND_DIR/env"
fi

# shellcheck disable=SC1090
source "$VENV_DIR/bin/activate"

python -m pip install --upgrade pip setuptools wheel
python -m pip install pyinstaller
python -m pip install -r "$BACKEND_DIR/requirements.txt"
npm install
npm run build

rm -rf "$BUILD_DIR" "$RELEASE_DIR"

pyinstaller \
  --noconfirm \
  --distpath "$RELEASE_DIR" \
  "$BACKEND_DIR/desktop_app.spec"

echo "Built app bundle at: $RELEASE_DIR/ECG Monitor.app"
