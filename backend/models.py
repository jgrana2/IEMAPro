from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum

class SessionStatus(str, Enum):
    RECORDING = "recording"
    COMPLETED = "completed"
    STOPPED = "stopped"

class LogLevel(str, Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"

class LogSource(str, Enum):
    BLE = "ble"
    WEBSOCKET = "websocket"
    SYSTEM = "system"
    ADS1298 = "ads1298"
    TEST = "test"

# Patient Models
class PatientBase(BaseModel):
    name: str
    patient_id: str = Field(alias="patientId")
    date_of_birth: Optional[str] = Field(None, alias="dateOfBirth")
    gender: Optional[str] = None
    medical_notes: Optional[str] = Field(None, alias="medicalNotes")

class Patient(PatientBase):
    id: int
    created_at: datetime = Field(alias="createdAt")
    
    class Config:
        populate_by_name = True
        from_attributes = True

class InsertPatient(PatientBase):
    class Config:
        populate_by_name = True

# BLE Device Models
class BleDeviceBase(BaseModel):
    device_id: str = Field(alias="deviceId")
    name: str
    is_connected: bool = Field(default=False, alias="isConnected")
    rssi: Optional[int] = None

class BleDevice(BleDeviceBase):
    id: int
    last_seen: datetime = Field(alias="lastSeen")
    
    class Config:
        populate_by_name = True
        from_attributes = True

class InsertBleDevice(BleDeviceBase):
    class Config:
        populate_by_name = True

class UpdateBleDevice(BaseModel):
    is_connected: Optional[bool] = Field(None, alias="isConnected")
    rssi: Optional[int] = None
    
    class Config:
        populate_by_name = True

# Recording Session Models
class RecordingSessionBase(BaseModel):
    session_id: str = Field(alias="sessionId")
    patient_id: int = Field(alias="patientId")
    device_id: int = Field(alias="deviceId")
    duration: Optional[int] = None  # in seconds
    heart_rate: Optional[int] = Field(None, alias="heartRate")
    status: SessionStatus = SessionStatus.RECORDING
    ecg_data: Optional[Dict[str, Any]] = Field(None, alias="ecgData")
    buffer_size: int = Field(default=250, alias="bufferSize")

class RecordingSession(RecordingSessionBase):
    id: int
    start_time: datetime = Field(alias="startTime")
    end_time: Optional[datetime] = Field(None, alias="endTime")
    
    class Config:
        populate_by_name = True
        from_attributes = True

class InsertRecordingSession(RecordingSessionBase):
    class Config:
        populate_by_name = True

class UpdateRecordingSession(BaseModel):
    end_time: Optional[datetime] = Field(None, alias="endTime")
    duration: Optional[int] = None
    heart_rate: Optional[int] = Field(None, alias="heartRate")
    status: Optional[SessionStatus] = None
    ecg_data: Optional[Dict[str, Any]] = Field(None, alias="ecgData")
    
    class Config:
        populate_by_name = True

# System Log Models
class SystemLogBase(BaseModel):
    level: LogLevel
    message: str
    source: Optional[LogSource] = None

class SystemLog(SystemLogBase):
    id: int
    timestamp: datetime
    
    class Config:
        populate_by_name = True
        from_attributes = True

class InsertSystemLog(SystemLogBase):
    class Config:
        populate_by_name = True

# WebSocket Message Models
class WebSocketMessage(BaseModel):
    type: str
    timestamp: Optional[int] = None

class ECGDataMessage(WebSocketMessage):
    type: str = "ecg_data"
    patient_id: Optional[str] = Field(None, alias="patientId")
    session_id: Optional[str] = Field(None, alias="sessionId")
    lead_data: Dict[str, List[float]] = Field(alias="leadData")
    heart_rate: int = Field(alias="heartRate")
    
    class Config:
        populate_by_name = True

class ADS1298DataMessage(WebSocketMessage):
    type: str = "ads1298_data"
    patient_id: Optional[str] = Field(None, alias="patientId")
    session_id: Optional[str] = Field(None, alias="sessionId")
    raw_data: List[int] = Field(alias="rawData")
    device_id: str = Field(default="00008171-0000-1000-8000-00805f9b34fb", alias="deviceId")
    
    class Config:
        populate_by_name = True

class BLEStatusMessage(WebSocketMessage):
    type: str = "ble_status"
    connected: bool
    device_id: str = Field(alias="deviceId")
    device_name: Optional[str] = Field(None, alias="deviceName")
    
    class Config:
        populate_by_name = True

class ConnectionStatusMessage(WebSocketMessage):
    type: str = "connection_status"
    status: str
    
    class Config:
        populate_by_name = True

# BLE Device Discovery and Connection Models
class BLEDeviceInfo(BaseModel):
    id: str
    name: str
    rssi: Optional[int] = None
    is_connected: bool = Field(default=False, alias="isConnected")
    
    class Config:
        populate_by_name = True

class BLEConnectionRequest(BaseModel):
    device_id: str = Field(alias="deviceId")
    
    class Config:
        populate_by_name = True

# ECG Data Processing Models
class ECGLeadData(BaseModel):
    lead_name: str = Field(alias="leadName")
    data: List[float]
    voltage: Optional[str] = None
    
    class Config:
        populate_by_name = True

class ProcessedECGData(BaseModel):
    leads: Dict[str, List[float]]
    heart_rate: int = Field(alias="heartRate")
    signal_quality: str = Field(alias="signalQuality")  # "good", "poor", "noise"
    timestamp: int
    
    class Config:
        populate_by_name = True

# AI Diagnosis Models
class AIDiagnosisRequest(BaseModel):
    message: str
    ecg_data: Optional[Dict[str, Any]] = Field(None, alias="ecgData")
    
    class Config:
        populate_by_name = True

class AIDiagnosisResponse(BaseModel):
    analysis: str
    confidence: Optional[float] = None
    recommendations: Optional[List[str]] = None
    timestamp: datetime
    
    class Config:
        populate_by_name = True
