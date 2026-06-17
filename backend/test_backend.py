"""
Simple test script for the FastAPI backend
"""

import asyncio
import sys
import os

# Add the backend directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.storage import storage
from backend.models import InsertPatient, InsertBleDevice, InsertSystemLog

async def test_backend():
    """Test basic backend functionality"""
    print("Testing ECG Monitoring Backend...")
    
    try:
        # Test system log creation
        print("1. Testing system log creation...")
        log = await storage.create_system_log({
            "level": "info",
            "message": "Backend test started",
            "source": "system"
        })
        print(f"   ✓ Created system log: {log.message}")
        
        # Test patient creation
        print("2. Testing patient creation...")
        import time
        unique_id = f"TEST-{int(time.time())}"
        patient_data = InsertPatient(
            name="Test Patient",
            patientId=unique_id,
            dateOfBirth="1990-01-01",
            gender="M",
            medicalNotes="Test patient for backend verification"
        )
        patient = await storage.create_patient(patient_data)
        print(f"   ✓ Created patient: {patient.name} (ID: {patient.patient_id})")
        
        # Test BLE device creation
        print("3. Testing BLE device creation...")
        device_unique_id = f"TEST-DEVICE-{int(time.time())}"
        device_data = InsertBleDevice(
            deviceId=device_unique_id,
            name="Test IoT Holter",
            isConnected=False,
            rssi=-50
        )
        device = await storage.create_ble_device(device_data)
        print(f"   ✓ Created BLE device: {device.name} (ID: {device.device_id})")
        
        # Test data retrieval
        print("4. Testing data retrieval...")
        patients = await storage.get_patients()
        devices = await storage.get_ble_devices()
        logs = await storage.get_system_logs(5)
        
        print(f"   ✓ Retrieved {len(patients)} patients")
        print(f"   ✓ Retrieved {len(devices)} BLE devices")
        print(f"   ✓ Retrieved {len(logs)} system logs")
        
        # Test recording session creation and deletion
        print("5. Testing recording session creation and deletion...")
        from backend.models import InsertRecordingSession
        session_data = InsertRecordingSession(
            session_id=f"TEST-SESSION-{int(time.time())}",
            patient_id=patient.id,
            device_id=device.id,
            duration=300,
            heart_rate=72,
            status="completed",
            ecg_data={"Lead I": [10, 20, 30, 40, 50]},
            buffer_size=250
        )
        session = await storage.create_recording_session(session_data)
        print(f"   ✓ Created session: {session.session_id} (ID: {session.id})")

        # Test delete recording session
        print("6. Testing recording session deletion...")
        delete_result = await storage.delete_recording_session(session.id)
        print(f"   ✓ Deleted session (result: {delete_result})")

        # Verify deletion
        deleted_session = await storage.get_recording_session(session.id)
        if deleted_session is None:
            print("   ✓ Verified session no longer exists")
        else:
            raise RuntimeError("Session still exists after deletion")

        # Test completion log
        await storage.create_system_log({
            "level": "info",
            "message": "Backend test completed successfully",
            "source": "test"
        })

        print("\n✅ All backend tests passed!")
        return True
        
    except Exception as e:
        print(f"\n❌ Backend test failed: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(test_backend())
    sys.exit(0 if success else 1)
