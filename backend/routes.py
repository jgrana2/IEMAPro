"""
FastAPI routes matching the Express server implementation
Provides identical API endpoints for the React frontend
"""

import asyncio
import json
import logging
from typing import Dict, Any, List, Set
from datetime import datetime
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from models import (
    InsertPatient, InsertBleDevice, UpdateBleDevice, InsertRecordingSession,
    UpdateRecordingSession, InsertSystemLog, AIDiagnosisRequest,
    ADS1298DataMessage, ECGDataMessage, BLEStatusMessage, ConnectionStatusMessage
)
from storage import storage
from ai_diagnosis import analyze_ecg_with_ai
from ble_manager import ble_manager
from ecg_processor import (
    parse_ads1298_single_channel, calculate_heart_rate_from_channel,
    assess_channel_quality, convert_to_ecg_format, parse_ads1298_data_raw
)

logger = logging.getLogger(__name__)

# Create router
router = APIRouter()

# Store active WebSocket connections
active_connections: Set[WebSocket] = set()

# Patient routes
@router.get("/api/patients")
async def get_patients():
    """Get all patients"""
    try:
        patients = await storage.get_patients()
        # Convert to dict format for JSON response
        return [patient.model_dump(by_alias=True) for patient in patients]
    except Exception as error:
        logger.error(f"Failed to fetch patients: {error}")
        raise HTTPException(status_code=500, detail="Failed to fetch patients")

@router.get("/api/patients/{patient_id}")
async def get_patient(patient_id: int):
    """Get patient by ID"""
    try:
        patient = await storage.get_patient(patient_id)
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        return patient.model_dump(by_alias=True)
    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Failed to fetch patient: {error}")
        raise HTTPException(status_code=500, detail="Failed to fetch patient")

@router.post("/api/patients")
async def create_patient(patient_data: InsertPatient):
    """Create new patient"""
    try:
        patient = await storage.create_patient(patient_data)
        return patient.model_dump(by_alias=True)
    except ValidationError as error:
        raise HTTPException(status_code=400, detail={"error": "Invalid patient data", "details": error.errors()})
    except Exception as error:
        logger.error(f"Failed to create patient: {error}")
        raise HTTPException(status_code=500, detail="Failed to create patient")

# BLE Device routes
@router.get("/api/ble-devices")
async def get_ble_devices():
    """Get all BLE devices"""
    try:
        devices = await storage.get_ble_devices()
        return [device.model_dump(by_alias=True) for device in devices]
    except Exception as error:
        logger.error(f"Failed to fetch BLE devices: {error}")
        raise HTTPException(status_code=500, detail="Failed to fetch BLE devices")

@router.post("/api/ble-devices")
async def create_ble_device(device_data: InsertBleDevice):
    """Create new BLE device"""
    try:
        device = await storage.create_ble_device(device_data)
        return device.model_dump(by_alias=True)
    except ValidationError as error:
        raise HTTPException(status_code=400, detail={"error": "Invalid device data", "details": error.errors()})
    except Exception as error:
        logger.error(f"Failed to create BLE device: {error}")
        raise HTTPException(status_code=500, detail="Failed to create BLE device")

@router.patch("/api/ble-devices/{device_id}")
async def update_ble_device(device_id: int, updates: UpdateBleDevice):
    """Update BLE device"""
    try:
        device = await storage.update_ble_device(device_id, updates)
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")
        return device.model_dump(by_alias=True)
    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Failed to update BLE device: {error}")
        raise HTTPException(status_code=500, detail="Failed to update BLE device")

@router.patch("/api/ble-devices/device/{device_id}")
async def update_ble_device_by_device_id(device_id: str, updates: UpdateBleDevice):
    """Update BLE device by device_id"""
    try:
        # Find device by deviceId first
        device = await storage.get_ble_device_by_device_id(device_id)
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")
        
        updated_device = await storage.update_ble_device(device.id, updates)
        return updated_device.model_dump(by_alias=True)
    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Failed to update BLE device: {error}")
        raise HTTPException(status_code=500, detail="Failed to update BLE device")

# Recording Session routes
@router.get("/api/recording-sessions")
async def get_recording_sessions():
    """Get all recording sessions"""
    try:
        sessions = await storage.get_recording_sessions()
        return [session.model_dump(by_alias=True) for session in sessions]
    except Exception as error:
        logger.error(f"Failed to fetch recording sessions: {error}")
        raise HTTPException(status_code=500, detail="Failed to fetch recording sessions")

@router.get("/api/recording-sessions/patient/{patient_id}")
async def get_recording_sessions_by_patient(patient_id: int):
    """Get recording sessions by patient ID"""
    try:
        sessions = await storage.get_recording_sessions_by_patient(patient_id)
        return [session.model_dump(by_alias=True) for session in sessions]
    except Exception as error:
        logger.error(f"Failed to fetch patient recording sessions: {error}")
        raise HTTPException(status_code=500, detail="Failed to fetch patient recording sessions")


# Fetch by integer id (legacy)
@router.get("/api/recording-sessions/by-id/{id}")
async def get_recording_session_by_id(id: int):
    """Get recording session by integer ID (legacy)"""
    try:
        session = await storage.get_recording_session(id)
        if not session:
            raise HTTPException(status_code=404, detail="Recording session not found")
        return session.model_dump(by_alias=True)
    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Failed to fetch recording session: {error}")
        raise HTTPException(status_code=500, detail="Failed to fetch recording session")

# Fetch by string session_id (recommended)
@router.get("/api/recording-sessions/{session_id}")
async def get_recording_session_by_session_id(session_id: str):
    """Get recording session by string session_id (recommended)"""
    try:
        session = await storage.get_recording_session_by_session_id(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Recording session not found")
        return session.model_dump(by_alias=True)
    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Failed to fetch recording session: {error}")
        raise HTTPException(status_code=500, detail="Failed to fetch recording session")

@router.post("/api/recording-sessions")
async def create_recording_session(session_data: InsertRecordingSession):
    """Create new recording session"""
    try:
        session = await storage.create_recording_session(session_data)
        return session.model_dump(by_alias=True)
    except ValidationError as error:
        raise HTTPException(status_code=400, detail={"error": "Invalid session data", "details": error.errors()})
    except Exception as error:
        logger.error(f"Failed to create recording session: {error}")
        raise HTTPException(status_code=500, detail="Failed to create recording session")

@router.patch("/api/recording-sessions/{session_id}")
async def update_recording_session(session_id: int, updates: UpdateRecordingSession):
    """Update recording session"""
    try:
        session = await storage.update_recording_session(session_id, updates)
        if not session:
            raise HTTPException(status_code=404, detail="Recording session not found")
        return session.model_dump(by_alias=True)
    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Failed to update recording session: {error}")
        raise HTTPException(status_code=500, detail="Failed to update recording session")

# AI Diagnosis route
@router.post("/api/ai-diagnosis")
async def ai_diagnosis(request: AIDiagnosisRequest):
    """AI ECG analysis endpoint"""
    try:
        if not request.message:
            raise HTTPException(status_code=400, detail="Message is required")
        
        # Convert to dict format for the AI function
        request_data = {
            "message": request.message,
            "ecgData": request.ecg_data
        }
        
        string = "ECG analysis result here"
        # result = await analyze_ecg_with_ai(request_data)
        result = string
        return result
    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"AI Diagnosis Error: {error}")
        raise HTTPException(status_code=500, detail="Failed to analyze ECG data with AI")

# System Log routes
@router.get("/api/system-logs")
async def get_system_logs(limit: int = 50):
    """Get system logs"""
    try:
        logs = await storage.get_system_logs(limit)
        return [log.model_dump(by_alias=True) for log in logs]
    except Exception as error:
        logger.error(f"Failed to fetch system logs: {error}")
        raise HTTPException(status_code=500, detail="Failed to fetch system logs")

@router.post("/api/system-logs")
async def create_system_log(log_data: InsertSystemLog):
    """Create new system log"""
    try:
        log = await storage.create_system_log(log_data)
        return log.model_dump(by_alias=True)
    except ValidationError as error:
        raise HTTPException(status_code=400, detail={"error": "Invalid log data", "details": error.errors()})
    except Exception as error:
        logger.error(f"Failed to create system log: {error}")
        raise HTTPException(status_code=500, detail="Failed to create system log")

# BLE Management routes (new endpoints for Python BLE control)
@router.post("/api/ble/scan")
async def scan_ble_devices():
    """Scan for BLE devices"""
    try:
        devices = await ble_manager.scan_devices()
        return [device.model_dump(by_alias=True) for device in devices]
    except Exception as error:
        logger.error(f"BLE scan error: {error}")
        raise HTTPException(status_code=500, detail="Failed to scan for BLE devices")

@router.post("/api/ble/connect/{device_address}")
async def connect_ble_device(device_address: str):
    """Connect to BLE device"""
    try:
        success = await ble_manager.connect_device(device_address)
        if success:
            return {"success": True, "message": "Device connected successfully"}
        else:
            raise HTTPException(status_code=400, detail="Failed to connect to device")
    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"BLE connect error: {error}")
        raise HTTPException(status_code=500, detail="Failed to connect to BLE device")

@router.post("/api/ble/disconnect")
async def disconnect_ble_device():
    """Disconnect from BLE device"""
    try:
        success = await ble_manager.disconnect_device()
        if success:
            return {"success": True, "message": "Device disconnected successfully"}
        else:
            raise HTTPException(status_code=400, detail="Failed to disconnect device")
    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"BLE disconnect error: {error}")
        raise HTTPException(status_code=500, detail="Failed to disconnect from BLE device")

@router.get("/api/ble/status")
async def get_ble_status():
    """Get BLE connection status"""
    try:
        status = ble_manager.get_connection_status()
        return status
    except Exception as error:
        logger.error(f"BLE status error: {error}")
        raise HTTPException(status_code=500, detail="Failed to get BLE status")

# WebSocket endpoint for real-time ECG data streaming
@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time ECG data streaming"""
    await websocket.accept()
    active_connections.add(websocket)
    
    # Log connection
    await storage.create_system_log(InsertSystemLog(
        level="info",
        message="WebSocket client connected",
        source="websocket"
    ))
    
    try:
        # Send initial connection confirmation
        await websocket.send_json({
            "type": "connection_status",
            "status": "connected",
            "timestamp": int(datetime.now().timestamp() * 1000)
        })
        
        while True:
            # Receive messages from client
            data = await websocket.receive_json()
            
            # Handle different message types
            message_type = data.get("type")
            
            if message_type == "ecg_data":
                # Broadcast ECG data to all connected clients
                ecg_message = {
                    "type": "ecg_data",
                    "timestamp": int(datetime.now().timestamp() * 1000),
                    "patientId": data.get("patientId"),
                    "sessionId": data.get("sessionId"),
                    "leadData": data.get("leadData"),
                    "heartRate": data.get("heartRate")
                }
                
                # Broadcast to other clients
                await broadcast_message(ecg_message, exclude=websocket)
                
                # Update recording session if active
                session_id = data.get("sessionId")
                if session_id:
                    session = await storage.get_recording_session_by_session_id(session_id)
                    if session:
                        await storage.update_recording_session(session.id, UpdateRecordingSession(
                            heart_rate=data.get("heartRate"),
                            ecg_data=data.get("leadData")
                        ))
            
            elif message_type == "ads1298_data":
                # Handle raw ADS1298 ECG data
                raw_data = data.get("rawData", [])
                patient_id = data.get("patientId")
                session_id = data.get("sessionId")
                device_id = data.get("deviceId", "00008171-0000-1000-8000-00805f9b34fb")
                
                # Process the raw data (simulate channel processing)
                if raw_data:
                    try:
                        # Parse the data as if it came from channel 1
                        channel_samples = parse_ads1298_single_channel(raw_data, 1)
                        
                        if channel_samples:
                            # Create lead data mapping
                            lead_data = {"Lead I": channel_samples}
                            
                            # Calculate heart rate and quality
                            heart_rate = calculate_heart_rate_from_channel(channel_samples)
                            quality = assess_channel_quality(channel_samples)
                            
                            # Create processed message
                            processed_message = {
                                "type": "ads1298_data",
                                "timestamp": int(datetime.now().timestamp() * 1000),
                                "patientId": patient_id,
                                "sessionId": session_id,
                                "rawData": raw_data,
                                "deviceId": device_id,
                                "leadData": lead_data,
                                "heartRate": heart_rate,
                                "quality": quality
                            }
                            
                            # Broadcast to all connected clients
                            await broadcast_message(processed_message, exclude=websocket)
                            
                    except Exception as parse_error:
                        logger.error(f"Failed to process ADS1298 data: {parse_error}")
                
                # Log ADS1298 data reception
                await storage.create_system_log(InsertSystemLog(
                    level="info",
                    message=f"ADS1298 data received: {len(raw_data)} bytes",
                    source="ads1298"
                ))
            
            elif message_type == "buffer_flush":
                await storage.create_system_log(InsertSystemLog(
                    level="info",
                    message=f"Buffer flushed: {data.get('bufferSize', 0)} samples sent",
                    source="websocket"
                ))
            
            elif message_type == "ble_status":
                await storage.create_system_log(InsertSystemLog(
                    level="info" if data.get("connected") else "warning",
                    message=f"BLE device {'connected' if data.get('connected') else 'disconnected'}: {data.get('deviceId', 'unknown')}",
                    source="ble"
                ))
                
                # Update device status
                device_id = data.get("deviceId")
                if device_id:
                    device = await storage.get_ble_device_by_device_id(device_id)
                    if device:
                        await storage.update_ble_device(device.id, UpdateBleDevice(
                            is_connected=data.get("connected", False)
                        ))
    
    except WebSocketDisconnect:
        pass
    except Exception as error:
        logger.error(f"WebSocket error: {error}")
        await storage.create_system_log(InsertSystemLog(
            level="error",
            message=f"WebSocket error: {str(error)}",
            source="websocket"
        ))
    finally:
        # Clean up connection
        active_connections.discard(websocket)
        await storage.create_system_log(InsertSystemLog(
            level="info",
            message="WebSocket client disconnected",
            source="websocket"
        ))

async def broadcast_message(message: Dict[str, Any], exclude: WebSocket = None):
    """Broadcast message to all connected WebSocket clients"""
    disconnected = set()
    
    for connection in active_connections:
        if connection != exclude:
            try:
                await connection.send_json(message)
            except Exception:
                # Connection is broken, mark for removal
                disconnected.add(connection)
    
    # Remove disconnected clients
    active_connections.difference_update(disconnected)

# Setup BLE manager callbacks
async def setup_ble_callbacks():
    """Setup BLE manager callbacks for ECG data and status updates"""
    
    async def ecg_data_callback(raw_data: List[int], channel_number: int, characteristic_uuid: str):
        """Handle ECG data from BLE device"""
        try:
            # Parse single channel data
            channel_samples = parse_ads1298_single_channel(raw_data, channel_number)
            
            if channel_samples:
                # Map channel data to appropriate ECG lead
                lead_data = {}
                
                # Map ADS1298 channels to standard ECG leads
                channel_lead_map = {
                    1: "Lead I",     # Raw limb lead
                    2: "Lead II",    # Raw limb lead  
                    3: "V1",         # Precordial lead
                    4: "V2",         # Precordial lead
                    5: "V3",         # Precordial lead
                    6: "V4",         # Precordial lead
                    7: "V5",         # Precordial lead
                    8: "V6"          # Precordial lead
                }
                
                lead_name = channel_lead_map.get(channel_number, f"Channel {channel_number}")
                lead_data[lead_name] = channel_samples
                
                # Calculate heart rate and assess quality
                heart_rate = calculate_heart_rate_from_channel(channel_samples)
                quality = assess_channel_quality(channel_samples)
                
                # Broadcast to WebSocket clients
                message = {
                    "type": "ecg_data",
                    "timestamp": int(datetime.now().timestamp() * 1000),
                    "leadData": lead_data,
                    "heartRate": heart_rate,
                    "quality": quality,
                    "channelNumber": channel_number,
                    "characteristicUuid": characteristic_uuid
                }
                
                await broadcast_message(message)
                
        except Exception as error:
            logger.error(f"Error processing ECG data from channel {channel_number}: {error}")
    
    async def status_callback(connected: bool, device_address: str, device_name: str):
        """Handle BLE connection status changes"""
        try:
            # Update database
            device = await storage.get_ble_device_by_device_id(device_address)
            if device:
                await storage.update_ble_device(device.id, UpdateBleDevice(
                    is_connected=connected
                ))
            
            # Broadcast status to WebSocket clients
            message = {
                "type": "ble_status",
                "connected": connected,
                "deviceId": device_address,
                "deviceName": device_name,
                "timestamp": int(datetime.now().timestamp() * 1000)
            }
            
            await broadcast_message(message)
            
            # Log status change
            await storage.create_system_log(InsertSystemLog(
                level="info" if connected else "warning",
                message=f"BLE device {'connected' if connected else 'disconnected'}: {device_name} ({device_address})",
                source="ble"
            ))
            
        except Exception as error:
            logger.error(f"Error handling BLE status change: {error}")
    
    # Set callbacks
    ble_manager.set_ecg_callback(ecg_data_callback)
    ble_manager.set_status_callback(status_callback)

# Initialize BLE callbacks when module loads (moved to main.py lifespan)
