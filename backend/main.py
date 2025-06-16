"""
FastAPI main application
ECG monitoring system backend with BLE support
"""

import logging
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import time
import os

from routes import router, setup_ble_callbacks
from storage import storage

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("Starting ECG monitoring backend...")
    
    # Initialize database
    try:
        # Test database connection
        await storage.create_system_log({
            "level": "info",
            "message": "ECG monitoring backend started",
            "source": "system"
        })
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
    
    # Setup BLE callbacks
    try:
        await setup_ble_callbacks()
        logger.info("BLE manager initialized successfully")
    except Exception as e:
        logger.error(f"BLE manager initialization failed: {e}")
    
    yield
    
    # Shutdown
    logger.info("Shutting down ECG monitoring backend...")
    
    # Log shutdown
    try:
        await storage.create_system_log({
            "level": "info", 
            "message": "ECG monitoring backend shutdown",
            "source": "system"
        })
    except Exception as e:
        logger.error(f"Failed to log shutdown: {e}")

# Create FastAPI app
app = FastAPI(
    title="ECG Monitoring API",
    description="FastAPI backend for ECG monitoring with BLE support",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log API requests"""
    start_time = time.time()
    path = request.url.path
    
    # Process request
    response = await call_next(request)
    
    # Calculate duration
    duration = int((time.time() - start_time) * 1000)
    
    # Log API requests (matching Express server format)
    if path.startswith("/api"):
        log_line = f"{request.method} {path} {response.status_code} in {duration}ms"
        
        # Truncate long log lines
        if len(log_line) > 80:
            log_line = log_line[:79] + "…"
        
        logger.info(log_line)
    
    return response

# Include API routes
app.include_router(router)

# Error handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {exc}")
    
    # Log error to database
    try:
        await storage.create_system_log({
            "level": "error",
            "message": f"Unhandled exception: {str(exc)}",
            "source": "system"
        })
    except:
        pass  # Don't fail if logging fails
    
    return Response(
        content=f'{{"message": "Internal Server Error"}}',
        status_code=500,
        media_type="application/json"
    )

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": int(time.time() * 1000),
        "service": "ECG Monitoring Backend"
    }

# Serve static files for React frontend
# Mount static files from the built React app
try:
    # Check if the dist directory exists
    dist_path = "../dist/public"
    if os.path.exists(dist_path):
        app.mount("/assets", StaticFiles(directory=f"{dist_path}/assets"), name="assets")
        
        # Serve React app for all non-API routes
        @app.get("/{full_path:path}")
        async def serve_react_app(full_path: str):
            """Serve React app for all non-API routes"""
            # Don't serve React app for API routes or WebSocket
            if full_path.startswith("api/") or full_path.startswith("ws") or full_path == "health":
                return Response(status_code=404)
            
            # Serve index.html for all other routes (React Router)
            index_path = f"{dist_path}/index.html"
            if os.path.exists(index_path):
                return FileResponse(index_path)
            else:
                return Response(content="Frontend not built. Run 'npm run build' first.", status_code=503)
    else:
        logger.warning(f"Frontend dist directory not found at {dist_path}. Frontend will not be served.")
except Exception as e:
    logger.error(f"Failed to setup static file serving: {e}")

if __name__ == "__main__":
    import uvicorn
    
    # Run the server on port 3000 (frontend + backend combined)
    uvicorn.run(
        "main:app",
        host="127.0.0.1",  # Use localhost instead of 0.0.0.0 to avoid socket issues on macOS
        port=3000,
        reload=True,
        log_level="info"
    )
