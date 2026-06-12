#!/usr/bin/env bash
set -euo pipefail

# Build a Windows executable for the pywebview desktop launcher.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"
BUILD_DIR="$REPO_ROOT/build"
RELEASE_DIR="$REPO_ROOT/release"

# --- Locate Python ---
PYTHON=""
for candidate in python3 python py; do
  if command -v "$candidate" >/dev/null 2>&1 && "$candidate" --version >/dev/null 2>&1; then
    PYTHON="$candidate"
    break
  fi
done
if [ -z "$PYTHON" ]; then
  for prefix in "/c/Users/${USER:-${USERNAME:-Public}}/AppData/Local/Programs/Python" \
                "/c/Python312" "/c/Python311" "/c/Python310"; do
    expanded=$(eval echo "$prefix")
    for dir in "$expanded"/*/; do
      if [ -f "${dir}python.exe" ]; then
        PYTHON="${dir}python.exe"
        break 2
      fi
    done
  done
fi
if [ -z "$PYTHON" ]; then echo "Python not found. Install Python 3.12+ first."; exit 1; fi
echo "Using Python: $("$PYTHON" --version 2>&1)"

# --- Locate Node / npm ---
NPM=""
for candidate in npm npm.cmd; do
  if command -v "$candidate" >/dev/null 2>&1; then
    NPM="$candidate"
    break
  fi
done
if [ -z "$NPM" ]; then
  for dir in "/c/Program Files/nodejs" "/c/Program Files (x86)/nodejs"; do
    if [ -f "$dir/npm.cmd" ]; then
      PATH="$dir:$PATH"
      NPM="$dir/npm.cmd"
      break
    fi
  done
fi
if [ -z "$NPM" ]; then echo "npm not found. Install Node.js 18+ first."; exit 1; fi
echo "Using npm: $("$NPM" --version 2>&1)"

# --- Set up Python venv ---
if [ -d "$BACKEND_DIR/.venv" ]; then
  VENV_DIR="$BACKEND_DIR/.venv"
elif [ -d "$BACKEND_DIR/env" ]; then
  VENV_DIR="$BACKEND_DIR/env"
else
  VENV_DIR="$BACKEND_DIR/.venv"
  echo "Creating Python virtualenv at $VENV_DIR"
  "$PYTHON" -m venv "$VENV_DIR"
fi

# shellcheck disable=SC1090
source "$VENV_DIR/Scripts/activate"

"$PYTHON" -m pip install --upgrade pip setuptools wheel
"$PYTHON" -m pip install pyinstaller
"$PYTHON" -m pip install -r "$BACKEND_DIR/requirements.txt"

# --- Build frontend ---
"$NPM" install
"$NPM" run build

# --- Package with PyInstaller ---
rm -rf "$BUILD_DIR" "$RELEASE_DIR"

"$PYTHON" -m PyInstaller \
  --noconfirm \
  --distpath "$RELEASE_DIR" \
  "$BACKEND_DIR/desktop_app_windows.spec"

echo "Built app at: $RELEASE_DIR/ECG Monitor/"
