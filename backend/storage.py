"""
Database storage module for ECG monitoring system
SQLite implementation matching the PostgreSQL schema from TypeScript
"""

import sqlite3
import json
import logging
from datetime import datetime
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager
import asyncio
from models import (
    Patient, InsertPatient, BleDevice, InsertBleDevice, UpdateBleDevice,
    RecordingSession, InsertRecordingSession, UpdateRecordingSession,
    SystemLog, InsertSystemLog
)

logger = logging.getLogger(__name__)

class Storage:
    def __init__(self, db_path: str = "ecg_monitor.db"):
        import os
        self.db_path = db_path
        abs_path = os.path.abspath(self.db_path)
        logger.info(f"Using SQLite database at: {abs_path}")
        self._init_database()
    
    def _init_database(self):
        """Initialize SQLite database with tables matching PostgreSQL schema"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        
        try:
            # Create patients table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS patients (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    patient_id TEXT NOT NULL UNIQUE,
                    date_of_birth TEXT,
                    gender TEXT,
                    medical_notes TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Create ble_devices table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS ble_devices (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    device_id TEXT NOT NULL UNIQUE,
                    name TEXT NOT NULL,
                    is_connected BOOLEAN DEFAULT FALSE,
                    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    rssi INTEGER
                )
            """)
            
            # Create recording_sessions table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS recording_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL UNIQUE,
                    patient_id INTEGER NOT NULL,
                    device_id INTEGER NOT NULL,
                    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    end_time TIMESTAMP,
                    duration INTEGER,
                    heart_rate INTEGER,
                    status TEXT DEFAULT 'recording',
                    ecg_data TEXT,
                    buffer_size INTEGER DEFAULT 250,
                    FOREIGN KEY (patient_id) REFERENCES patients (id),
                    FOREIGN KEY (device_id) REFERENCES ble_devices (id)
                )
            """)
            
            # Create system_logs table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS system_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    level TEXT NOT NULL,
                    message TEXT NOT NULL,
                    source TEXT
                )
            """)
            
            conn.commit()
            logger.info("Database initialized successfully")
            
        except Exception as e:
            logger.error(f"Database initialization error: {e}")
            raise
        finally:
            conn.close()
    
    def _get_connection(self):
        """Get database connection with row factory"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn
    
    def _row_to_dict(self, row: sqlite3.Row) -> Dict[str, Any]:
        """Convert SQLite row to dictionary"""
        return dict(row) if row else {}
    
    # Patient operations
    async def get_patients(self) -> List[Patient]:
        """Get all patients"""
        conn = self._get_connection()
        try:
            cursor = conn.execute("SELECT * FROM patients ORDER BY created_at DESC")
            rows = cursor.fetchall()
            
            patients = []
            for row in rows:
                patient_dict = self._row_to_dict(row)
                # Convert snake_case to camelCase for API compatibility
                patient = Patient(
                    id=patient_dict["id"],
                    name=patient_dict["name"],
                    patient_id=patient_dict["patient_id"],
                    date_of_birth=patient_dict["date_of_birth"],
                    gender=patient_dict["gender"],
                    medical_notes=patient_dict["medical_notes"],
                    created_at=datetime.fromisoformat(patient_dict["created_at"]) if patient_dict["created_at"] else datetime.now()
                )
                patients.append(patient)
            
            return patients
        finally:
            conn.close()
    
    async def get_patient(self, patient_id: int) -> Optional[Patient]:
        """Get patient by ID"""
        conn = self._get_connection()
        try:
            cursor = conn.execute("SELECT * FROM patients WHERE id = ?", (patient_id,))
            row = cursor.fetchone()
            
            if not row:
                return None
            
            patient_dict = self._row_to_dict(row)
            return Patient(
                id=patient_dict["id"],
                name=patient_dict["name"],
                patient_id=patient_dict["patient_id"],
                date_of_birth=patient_dict["date_of_birth"],
                gender=patient_dict["gender"],
                medical_notes=patient_dict["medical_notes"],
                created_at=datetime.fromisoformat(patient_dict["created_at"]) if patient_dict["created_at"] else datetime.now()
            )
        finally:
            conn.close()
    
    async def create_patient(self, patient_data: InsertPatient) -> Patient:
        """Create new patient"""
        conn = self._get_connection()
        try:
            cursor = conn.execute("""
                INSERT INTO patients (name, patient_id, date_of_birth, gender, medical_notes)
                VALUES (?, ?, ?, ?, ?)
            """, (
                patient_data.name,
                patient_data.patient_id,
                patient_data.date_of_birth,
                patient_data.gender,
                patient_data.medical_notes
            ))
            
            patient_id = cursor.lastrowid
            conn.commit()
            
            # Return the created patient
            return await self.get_patient(patient_id)
        finally:
            conn.close()
    
    # BLE Device operations
    async def get_ble_devices(self) -> List[BleDevice]:
        """Get all BLE devices"""
        conn = self._get_connection()
        try:
            cursor = conn.execute("SELECT * FROM ble_devices ORDER BY last_seen DESC")
            rows = cursor.fetchall()
            
            devices = []
            for row in rows:
                device_dict = self._row_to_dict(row)
                device = BleDevice(
                    id=device_dict["id"],
                    deviceId=device_dict["device_id"],
                    name=device_dict["name"],
                    isConnected=bool(device_dict["is_connected"]),
                    lastSeen=datetime.fromisoformat(device_dict["last_seen"]) if device_dict["last_seen"] else datetime.now(),
                    rssi=device_dict["rssi"]
                )
                devices.append(device)
            
            return devices
        finally:
            conn.close()
    
    async def get_ble_device_by_device_id(self, device_id: str) -> Optional[BleDevice]:
        """Get BLE device by device_id"""
        conn = self._get_connection()
        try:
            cursor = conn.execute("SELECT * FROM ble_devices WHERE device_id = ?", (device_id,))
            row = cursor.fetchone()
            
            if not row:
                return None
            
            device_dict = self._row_to_dict(row)
            return BleDevice(
                id=device_dict["id"],
                deviceId=device_dict["device_id"],
                name=device_dict["name"],
                isConnected=bool(device_dict["is_connected"]),
                lastSeen=datetime.fromisoformat(device_dict["last_seen"]) if device_dict["last_seen"] else datetime.now(),
                rssi=device_dict["rssi"]
            )
        finally:
            conn.close()
    
    async def create_ble_device(self, device_data: InsertBleDevice) -> BleDevice:
        """Create new BLE device"""
        conn = self._get_connection()
        try:
            cursor = conn.execute("""
                INSERT INTO ble_devices (device_id, name, is_connected, rssi)
                VALUES (?, ?, ?, ?)
            """, (
                device_data.device_id,
                device_data.name,
                device_data.is_connected,
                device_data.rssi
            ))
            
            device_id = cursor.lastrowid
            conn.commit()
            
            # Return the created device
            cursor = conn.execute("SELECT * FROM ble_devices WHERE id = ?", (device_id,))
            row = cursor.fetchone()
            device_dict = self._row_to_dict(row)
            
            return BleDevice(
                id=device_dict["id"],
                deviceId=device_dict["device_id"],
                name=device_dict["name"],
                isConnected=bool(device_dict["is_connected"]),
                lastSeen=datetime.fromisoformat(device_dict["last_seen"]) if device_dict["last_seen"] else datetime.now(),
                rssi=device_dict["rssi"]
            )
        finally:
            conn.close()
    
    async def update_ble_device(self, device_id: int, updates: UpdateBleDevice) -> Optional[BleDevice]:
        """Update BLE device"""
        conn = self._get_connection()
        try:
            # Build update query dynamically
            update_fields = []
            values = []
            
            if updates.is_connected is not None:
                update_fields.append("is_connected = ?")
                values.append(updates.is_connected)
            
            if updates.rssi is not None:
                update_fields.append("rssi = ?")
                values.append(updates.rssi)
            
            if not update_fields:
                # No updates to make
                return await self.get_ble_device_by_id(device_id)
            
            # Always update last_seen
            update_fields.append("last_seen = CURRENT_TIMESTAMP")
            values.append(device_id)
            
            query = f"UPDATE ble_devices SET {', '.join(update_fields)} WHERE id = ?"
            conn.execute(query, values)
            conn.commit()
            
            # Return updated device
            return await self.get_ble_device_by_id(device_id)
        finally:
            conn.close()
    
    async def get_ble_device_by_id(self, device_id: int) -> Optional[BleDevice]:
        """Get BLE device by ID"""
        conn = self._get_connection()
        try:
            cursor = conn.execute("SELECT * FROM ble_devices WHERE id = ?", (device_id,))
            row = cursor.fetchone()
            
            if not row:
                return None
            
            device_dict = self._row_to_dict(row)
            return BleDevice(
                id=device_dict["id"],
                deviceId=device_dict["device_id"],
                name=device_dict["name"],
                isConnected=bool(device_dict["is_connected"]),
                lastSeen=datetime.fromisoformat(device_dict["last_seen"]) if device_dict["last_seen"] else datetime.now(),
                rssi=device_dict["rssi"]
            )
        finally:
            conn.close()
    
    # Recording Session operations
    async def get_recording_sessions(self) -> List[RecordingSession]:
        """Get all recording sessions"""
        conn = self._get_connection()
        try:
            cursor = conn.execute("SELECT * FROM recording_sessions ORDER BY start_time DESC")
            rows = cursor.fetchall()
            
            sessions = []
            for row in rows:
                session_dict = self._row_to_dict(row)
                session = RecordingSession(
                    id=session_dict["id"],
                    sessionId=session_dict["session_id"],
                    patientId=session_dict["patient_id"],
                    deviceId=session_dict["device_id"],
                    startTime=datetime.fromisoformat(session_dict["start_time"]) if session_dict["start_time"] else datetime.now(),
                    endTime=datetime.fromisoformat(session_dict["end_time"]) if session_dict["end_time"] else None,
                    duration=session_dict["duration"],
                    heartRate=session_dict["heart_rate"],
                    status=session_dict["status"],
                    ecgData=json.loads(session_dict["ecg_data"]) if session_dict["ecg_data"] else None,
                    bufferSize=session_dict["buffer_size"]
                )
                sessions.append(session)
            
            return sessions
        finally:
            conn.close()
    
    async def get_recording_sessions_by_patient(self, patient_id: int) -> List[RecordingSession]:
        """Get recording sessions by patient ID"""
        conn = self._get_connection()
        try:
            cursor = conn.execute(
                "SELECT * FROM recording_sessions WHERE patient_id = ? ORDER BY start_time DESC",
                (patient_id,)
            )
            rows = cursor.fetchall()
            
            sessions = []
            for row in rows:
                session_dict = self._row_to_dict(row)
                session = RecordingSession(
                    id=session_dict["id"],
                    sessionId=session_dict["session_id"],
                    patientId=session_dict["patient_id"],
                    deviceId=session_dict["device_id"],
                    startTime=datetime.fromisoformat(session_dict["start_time"]) if session_dict["start_time"] else datetime.now(),
                    endTime=datetime.fromisoformat(session_dict["end_time"]) if session_dict["end_time"] else None,
                    duration=session_dict["duration"],
                    heartRate=session_dict["heart_rate"],
                    status=session_dict["status"],
                    ecgData=json.loads(session_dict["ecg_data"]) if session_dict["ecg_data"] else None,
                    bufferSize=session_dict["buffer_size"]
                )
                sessions.append(session)
            
            return sessions
        finally:
            conn.close()
    
    async def get_recording_session(self, session_id: int) -> Optional[RecordingSession]:
        """Get recording session by ID"""
        conn = self._get_connection()
        try:
            cursor = conn.execute("SELECT * FROM recording_sessions WHERE id = ?", (session_id,))
            row = cursor.fetchone()
            
            if not row:
                return None
            
            session_dict = self._row_to_dict(row)
            return RecordingSession(
                id=session_dict["id"],
                sessionId=session_dict["session_id"],
                patientId=session_dict["patient_id"],
                deviceId=session_dict["device_id"],
                startTime=datetime.fromisoformat(session_dict["start_time"]) if session_dict["start_time"] else datetime.now(),
                endTime=datetime.fromisoformat(session_dict["end_time"]) if session_dict["end_time"] else None,
                duration=session_dict["duration"],
                heartRate=session_dict["heart_rate"],
                status=session_dict["status"],
                ecgData=json.loads(session_dict["ecg_data"]) if session_dict["ecg_data"] else None,
                bufferSize=session_dict["buffer_size"]
            )
        finally:
            conn.close()
    
    async def get_recording_session_by_session_id(self, session_id: str) -> Optional[RecordingSession]:
        """Get recording session by session_id"""
        conn = self._get_connection()
        try:
            cursor = conn.execute("SELECT * FROM recording_sessions WHERE session_id = ?", (session_id,))
            row = cursor.fetchone()
            
            if not row:
                return None
            
            session_dict = self._row_to_dict(row)
            return RecordingSession(
                id=session_dict["id"],
                sessionId=session_dict["session_id"],
                patientId=session_dict["patient_id"],
                deviceId=session_dict["device_id"],
                startTime=datetime.fromisoformat(session_dict["start_time"]) if session_dict["start_time"] else datetime.now(),
                endTime=datetime.fromisoformat(session_dict["end_time"]) if session_dict["end_time"] else None,
                duration=session_dict["duration"],
                heartRate=session_dict["heart_rate"],
                status=session_dict["status"],
                ecgData=json.loads(session_dict["ecg_data"]) if session_dict["ecg_data"] else None,
                bufferSize=session_dict["buffer_size"]
            )
        finally:
            conn.close()
    
    async def create_recording_session(self, session_data: InsertRecordingSession) -> RecordingSession:
        """Create new recording session"""
        conn = self._get_connection()
        try:
            cursor = conn.execute("""
                INSERT INTO recording_sessions 
                (session_id, patient_id, device_id, duration, heart_rate, status, ecg_data, buffer_size)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                session_data.session_id,
                session_data.patient_id,
                session_data.device_id,
                session_data.duration,
                session_data.heart_rate,
                session_data.status,
                json.dumps(session_data.ecg_data) if session_data.ecg_data else None,
                session_data.buffer_size
            ))
            
            session_id = cursor.lastrowid
            conn.commit()
            
            # Return the created session
            return await self.get_recording_session(session_id)
        finally:
            conn.close()
    
    async def update_recording_session(self, session_id: int, updates: UpdateRecordingSession) -> Optional[RecordingSession]:
        """Update recording session"""
        conn = self._get_connection()
        try:
            # Build update query dynamically
            update_fields = []
            values = []
            
            if updates.end_time is not None:
                update_fields.append("end_time = ?")
                values.append(updates.end_time.isoformat())
            
            if updates.duration is not None:
                update_fields.append("duration = ?")
                values.append(updates.duration)
            
            if updates.heart_rate is not None:
                update_fields.append("heart_rate = ?")
                values.append(updates.heart_rate)
            
            if updates.status is not None:
                update_fields.append("status = ?")
                values.append(updates.status)
            
            if updates.ecg_data is not None:
                update_fields.append("ecg_data = ?")
                values.append(json.dumps(updates.ecg_data))
            
            if not update_fields:
                # No updates to make
                return await self.get_recording_session(session_id)
            
            values.append(session_id)
            query = f"UPDATE recording_sessions SET {', '.join(update_fields)} WHERE id = ?"
            conn.execute(query, values)
            conn.commit()
            
            # Return updated session
            return await self.get_recording_session(session_id)
        finally:
            conn.close()
    
    # System Log operations
    async def get_system_logs(self, limit: int = 50) -> List[SystemLog]:
        """Get system logs"""
        conn = self._get_connection()
        try:
            cursor = conn.execute(
                "SELECT * FROM system_logs ORDER BY timestamp DESC LIMIT ?",
                (limit,)
            )
            rows = cursor.fetchall()
            
            logs = []
            for row in rows:
                log_dict = self._row_to_dict(row)
                log = SystemLog(
                    id=log_dict["id"],
                    timestamp=datetime.fromisoformat(log_dict["timestamp"]) if log_dict["timestamp"] else datetime.now(),
                    level=log_dict["level"],
                    message=log_dict["message"],
                    source=log_dict["source"]
                )
                logs.append(log)
            
            return logs
        finally:
            conn.close()
    
    async def create_system_log(self, log_data) -> SystemLog:
        """Create new system log"""
        conn = self._get_connection()
        try:
            # Handle both InsertSystemLog objects and dict inputs
            if isinstance(log_data, dict):
                level = log_data["level"]
                message = log_data["message"]
                source = log_data.get("source")
            else:
                level = log_data.level
                message = log_data.message
                source = log_data.source
            
            cursor = conn.execute("""
                INSERT INTO system_logs (level, message, source)
                VALUES (?, ?, ?)
            """, (level, message, source))
            
            log_id = cursor.lastrowid
            conn.commit()
            
            # Return the created log
            cursor = conn.execute("SELECT * FROM system_logs WHERE id = ?", (log_id,))
            row = cursor.fetchone()
            log_dict = self._row_to_dict(row)
            
            return SystemLog(
                id=log_dict["id"],
                timestamp=datetime.fromisoformat(log_dict["timestamp"]) if log_dict["timestamp"] else datetime.now(),
                level=log_dict["level"],
                message=log_dict["message"],
                source=log_dict["source"]
            )
        finally:
            conn.close()

# Global storage instance
storage = Storage()
