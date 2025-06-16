"""
Development server startup script
"""

import os
import sys
import subprocess
import asyncio

def install_dependencies():
    """Install Python dependencies"""
    print("Installing Python dependencies...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("✅ Dependencies installed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install dependencies: {e}")
        return False

def run_tests():
    """Run backend tests"""
    print("\nRunning backend tests...")
    try:
        result = subprocess.run([sys.executable, "test_backend.py"], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ Backend tests passed")
            print(result.stdout)
            return True
        else:
            print("❌ Backend tests failed")
            print(result.stdout)
            print(result.stderr)
            return False
    except Exception as e:
        print(f"❌ Error running tests: {e}")
        return False

def start_server():
    """Start the FastAPI development server"""
    print("\nStarting FastAPI development server...")
    print("Server will be available at: http://localhost:3000")
    print("API documentation at: http://localhost:3000/docs")
    print("WebSocket endpoint at: ws://localhost:3000/ws")
    print("Frontend will be served at: http://localhost:3000")
    print("\nPress Ctrl+C to stop the server\n")
    
    try:
        # Set environment variables
        os.environ["PYTHONPATH"] = os.getcwd()
        
        # Start the server
        subprocess.run([
            sys.executable, "-m", "uvicorn", 
            "main:app", 
            "--host", "127.0.0.1",  # Use localhost to avoid socket issues on macOS
            "--port", "3000", 
            "--reload",
            "--log-level", "info"
        ])
    except KeyboardInterrupt:
        print("\n\n🛑 Server stopped by user")
    except Exception as e:
        print(f"\n❌ Server error: {e}")

def main():
    """Main startup function"""
    print("🚀 ECG Monitoring Backend - Development Server")
    print("=" * 50)
    
    # Check if we're in the backend directory
    if not os.path.exists("main.py"):
        print("❌ Please run this script from the backend directory")
        sys.exit(1)
    
    # Install dependencies
    if not install_dependencies():
        print("❌ Cannot start server without dependencies")
        sys.exit(1)
    
    # Run tests
    if not run_tests():
        print("⚠️  Tests failed, but starting server anyway...")
    
    # Start server
    start_server()

if __name__ == "__main__":
    main()
