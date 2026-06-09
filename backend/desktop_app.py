"""
Desktop launcher for the ECG app using pywebview.

This starts the local FastAPI backend and opens the UI in a native window.
"""

from __future__ import annotations

import os
import sys
import threading
import time
from pathlib import Path

import uvicorn
import webview

def _get_repo_root() -> Path:
    if getattr(sys, "frozen", False):
        # When packaged with PyInstaller, the executable lives inside the .app bundle.
        return Path(sys.executable).resolve().parent.parent.parent
    return Path(__file__).resolve().parent.parent


REPO_ROOT = _get_repo_root()
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.main import app


def _run_backend(host: str, port: int) -> None:
    uvicorn.run(
        app,
        host=host,
        port=port,
        log_level=os.getenv("UVICORN_LOG_LEVEL", "info"),
        reload=False,
    )


def main() -> None:
    host = os.getenv("APP_HOST", "127.0.0.1")
    port = int(os.getenv("APP_PORT", "8001"))
    frontend_url = os.getenv("APP_URL", f"http://{host}:{port}")

    backend_thread = threading.Thread(
        target=_run_backend,
        args=(host, port),
        daemon=True,
    )
    backend_thread.start()

    # Give the backend a moment to bind before creating the window.
    time.sleep(float(os.getenv("APP_STARTUP_DELAY", "1.5")))

    webview.create_window(
        "ECG Monitor",
        frontend_url,
        width=1440,
        height=960,
        min_size=(1200, 800),
        resizable=True,
    )
    webview.start()


if __name__ == "__main__":
    main()
