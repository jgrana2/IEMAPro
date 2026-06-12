"""
SQLite storage module for ECG monitoring system.

Stores data in a local SQLite database in the user's app-data directory by default.
"""

from __future__ import annotations

import json
import logging
import os
import sqlite3
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    from backend.models import (
        BleDevice,
        InsertBleDevice,
        InsertPatient,
        InsertRecordingSession,
        InsertSystemLog,
        Patient,
        RecordingSession,
        SystemLog,
        UpdateBleDevice,
        UpdateRecordingSession,
    )
except ImportError:  # pragma: no cover
    from backend.models import (
        BleDevice,
        InsertBleDevice,
        InsertPatient,
        InsertRecordingSession,
        InsertSystemLog,
        Patient,
        RecordingSession,
        SystemLog,
        UpdateBleDevice,
        UpdateRecordingSession,
    )

logger = logging.getLogger(__name__)


def _default_db_path() -> Path:
    override = os.getenv("IEMAPRO_DB_PATH")
    if override:
        return Path(override).expanduser()

    if sys.platform == "darwin":
        base_dir = Path.home() / "Library" / "Application Support"
    elif os.name == "nt":
        base_dir = Path(os.getenv("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
    else:
        base_dir = Path(os.getenv("XDG_DATA_HOME", Path.home() / ".local" / "share"))

    return base_dir / "IEMAPro" / "ecg_monitor.db"


class Storage:
    def __init__(self, db_path: str | Path | None = None):
        self.db_path = Path(db_path).expanduser() if db_path else _default_db_path()
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        logger.info("Using SQLite database at: %s", self.db_path.resolve())
        self._init_database()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def _init_database(self) -> None:
        conn = self._connect()
        try:
            conn.execute("PRAGMA journal_mode = WAL")
            conn.execute("PRAGMA synchronous = NORMAL")
            self._create_base_schema(conn)
            self._apply_migrations(conn)
            conn.commit()
            logger.info("Database initialized successfully")
        finally:
            conn.close()

    def _create_base_schema(self, conn: sqlite3.Connection) -> None:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version TEXT PRIMARY KEY,
                applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS patients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                patient_id TEXT NOT NULL UNIQUE,
                date_of_birth TEXT,
                gender TEXT,
                medical_notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS ble_devices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                is_connected INTEGER NOT NULL DEFAULT 0,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                rssi INTEGER
            )
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS recording_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL UNIQUE,
                patient_id INTEGER NOT NULL,
                device_id INTEGER NOT NULL,
                start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                end_time TIMESTAMP,
                duration INTEGER,
                heart_rate INTEGER,
                status TEXT NOT NULL DEFAULT 'recording',
                ecg_data TEXT,
                buffer_size INTEGER NOT NULL DEFAULT 250,
                FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE,
                FOREIGN KEY (device_id) REFERENCES ble_devices (id) ON DELETE RESTRICT
            )
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS system_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                level TEXT NOT NULL,
                message TEXT NOT NULL,
                source TEXT
            )
            """
        )

    def _apply_migrations(self, conn: sqlite3.Connection) -> None:
        migrations = [
            ("0001_backfill_schema_migrations", self._migration_0001_backfill_schema_migrations),
        ]

        applied = {
            row["version"]
            for row in conn.execute("SELECT version FROM schema_migrations").fetchall()
        }

        for version, migration in migrations:
            if version in applied:
                continue
            migration(conn)
            conn.execute(
                "INSERT INTO schema_migrations (version) VALUES (?)",
                (version,),
            )
            logger.info("Applied migration %s", version)

    def _migration_0001_backfill_schema_migrations(self, conn: sqlite3.Connection) -> None:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version TEXT PRIMARY KEY,
                applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

    def _row_to_dict(self, row: sqlite3.Row | None) -> Dict[str, Any]:
        return dict(row) if row else {}

    def _parse_timestamp(self, value: Any) -> datetime:
        if value is None or value == "":
            return datetime.now()
        if isinstance(value, datetime):
            return value
        text = str(value)
        try:
            return datetime.fromisoformat(text)
        except ValueError:
            return datetime.strptime(text, "%Y-%m-%d %H:%M:%S")

    def _parse_json(self, value: Any) -> Any:
        if value is None or value == "":
            return None
        if isinstance(value, (dict, list)):
            return value
        return json.loads(value)

    def _dump_json(self, value: Any) -> Optional[str]:
        if value is None:
            return None
        return json.dumps(value)

    async def get_schema_version(self) -> List[Dict[str, Any]]:
        conn = self._connect()
        try:
            rows = conn.execute(
                "SELECT version, applied_at FROM schema_migrations ORDER BY applied_at ASC"
            ).fetchall()
            return [dict(row) for row in rows]
        finally:
            conn.close()

    async def get_patients(self) -> List[Patient]:
        conn = self._connect()
        try:
            rows = conn.execute("SELECT * FROM patients ORDER BY created_at DESC").fetchall()
            return [
                Patient(
                    id=row["id"],
                    name=row["name"],
                    patient_id=row["patient_id"],
                    date_of_birth=row["date_of_birth"],
                    gender=row["gender"],
                    medical_notes=row["medical_notes"],
                    created_at=self._parse_timestamp(row["created_at"]),
                )
                for row in rows
            ]
        finally:
            conn.close()

    async def get_patient(self, patient_id: int) -> Optional[Patient]:
        conn = self._connect()
        try:
            row = conn.execute("SELECT * FROM patients WHERE id = ?", (patient_id,)).fetchone()
            if not row:
                return None
            return Patient(
                id=row["id"],
                name=row["name"],
                patient_id=row["patient_id"],
                date_of_birth=row["date_of_birth"],
                gender=row["gender"],
                medical_notes=row["medical_notes"],
                created_at=self._parse_timestamp(row["created_at"]),
            )
        finally:
            conn.close()

    async def get_patient_by_patient_id(self, patient_id: str) -> Optional[Patient]:
        conn = self._connect()
        try:
            row = conn.execute("SELECT * FROM patients WHERE patient_id = ?", (patient_id,)).fetchone()
            if not row:
                return None
            return Patient(
                id=row["id"],
                name=row["name"],
                patient_id=row["patient_id"],
                date_of_birth=row["date_of_birth"],
                gender=row["gender"],
                medical_notes=row["medical_notes"],
                created_at=self._parse_timestamp(row["created_at"]),
            )
        finally:
            conn.close()

    async def create_patient(self, patient: InsertPatient) -> Patient:
        conn = self._connect()
        try:
            cursor = conn.execute(
                """
                INSERT INTO patients (name, patient_id, date_of_birth, gender, medical_notes)
                VALUES (?, ?, ?, ?, ?)
                """,
                (patient.name, patient.patient_id, patient.date_of_birth, patient.gender, patient.medical_notes),
            )
            conn.commit()
            return await self.get_patient(cursor.lastrowid)
        finally:
            conn.close()

    async def update_patient(self, id: int, patient: Dict[str, Any]) -> Optional[Patient]:
        existing = await self.get_patient(id)
        if not existing:
            return None
        payload = existing.model_dump(by_alias=False)
        payload.update(patient)
        conn = self._connect()
        try:
            conn.execute(
                """
                UPDATE patients
                SET name = ?, patient_id = ?, date_of_birth = ?, gender = ?, medical_notes = ?
                WHERE id = ?
                """,
                (
                    payload["name"],
                    payload["patient_id"],
                    payload["date_of_birth"],
                    payload["gender"],
                    payload["medical_notes"],
                    id,
                ),
            )
            conn.commit()
            return await self.get_patient(id)
        finally:
            conn.close()

    async def get_ble_devices(self) -> List[BleDevice]:
        conn = self._connect()
        try:
            rows = conn.execute("SELECT * FROM ble_devices ORDER BY last_seen DESC").fetchall()
            return [
                BleDevice(
                    id=row["id"],
                    deviceId=row["device_id"],
                    name=row["name"],
                    isConnected=bool(row["is_connected"]),
                    lastSeen=self._parse_timestamp(row["last_seen"]),
                    rssi=row["rssi"],
                )
                for row in rows
            ]
        finally:
            conn.close()

    async def get_ble_device(self, id: int) -> Optional[BleDevice]:
        conn = self._connect()
        try:
            row = conn.execute("SELECT * FROM ble_devices WHERE id = ?", (id,)).fetchone()
            if not row:
                return None
            return BleDevice(
                id=row["id"],
                deviceId=row["device_id"],
                name=row["name"],
                isConnected=bool(row["is_connected"]),
                lastSeen=self._parse_timestamp(row["last_seen"]),
                rssi=row["rssi"],
            )
        finally:
            conn.close()

    async def get_ble_device_by_device_id(self, device_id: str) -> Optional[BleDevice]:
        conn = self._connect()
        try:
            row = conn.execute("SELECT * FROM ble_devices WHERE device_id = ?", (device_id,)).fetchone()
            if not row:
                return None
            return BleDevice(
                id=row["id"],
                deviceId=row["device_id"],
                name=row["name"],
                isConnected=bool(row["is_connected"]),
                lastSeen=self._parse_timestamp(row["last_seen"]),
                rssi=row["rssi"],
            )
        finally:
            conn.close()

    async def create_ble_device(self, device: InsertBleDevice) -> BleDevice:
        conn = self._connect()
        try:
            cursor = conn.execute(
                """
                INSERT INTO ble_devices (device_id, name, is_connected, rssi)
                VALUES (?, ?, ?, ?)
                """,
                (device.device_id, device.name, int(device.is_connected), device.rssi),
            )
            conn.commit()
            return await self.get_ble_device(cursor.lastrowid)
        finally:
            conn.close()

    async def update_ble_device(self, id: int, device: UpdateBleDevice | Dict[str, Any]) -> Optional[BleDevice]:
        current = await self.get_ble_device(id)
        if not current:
            return None

        if hasattr(device, "model_dump"):
            updates = device.model_dump(by_alias=False, exclude_unset=True)
        else:
            updates = dict(device)

        fields: List[str] = []
        values: List[Any] = []
        if "is_connected" in updates and updates["is_connected"] is not None:
            fields.append("is_connected = ?")
            values.append(int(bool(updates["is_connected"])))
        if "rssi" in updates and updates["rssi"] is not None:
            fields.append("rssi = ?")
            values.append(updates["rssi"])

        if not fields:
            return current

        fields.append("last_seen = CURRENT_TIMESTAMP")
        values.append(id)
        conn = self._connect()
        try:
            conn.execute(f"UPDATE ble_devices SET {', '.join(fields)} WHERE id = ?", values)
            conn.commit()
            return await self.get_ble_device(id)
        finally:
            conn.close()

    async def get_recording_sessions(self) -> List[RecordingSession]:
        conn = self._connect()
        try:
            rows = conn.execute("SELECT * FROM recording_sessions ORDER BY start_time DESC").fetchall()
            return [self._row_to_recording_session(row) for row in rows]
        finally:
            conn.close()

    async def get_recording_sessions_by_patient(self, patient_id: int) -> List[RecordingSession]:
        conn = self._connect()
        try:
            rows = conn.execute(
                "SELECT * FROM recording_sessions WHERE patient_id = ? ORDER BY start_time DESC",
                (patient_id,),
            ).fetchall()
            return [self._row_to_recording_session(row) for row in rows]
        finally:
            conn.close()

    async def get_recording_session(self, id: int) -> Optional[RecordingSession]:
        conn = self._connect()
        try:
            row = conn.execute("SELECT * FROM recording_sessions WHERE id = ?", (id,)).fetchone()
            return self._row_to_recording_session(row) if row else None
        finally:
            conn.close()

    async def get_recording_session_by_session_id(self, session_id: str) -> Optional[RecordingSession]:
        conn = self._connect()
        try:
            row = conn.execute("SELECT * FROM recording_sessions WHERE session_id = ?", (session_id,)).fetchone()
            return self._row_to_recording_session(row) if row else None
        finally:
            conn.close()

    def _row_to_recording_session(self, row: sqlite3.Row) -> RecordingSession:
        return RecordingSession(
            id=row["id"],
            sessionId=row["session_id"],
            patientId=row["patient_id"],
            deviceId=row["device_id"],
            startTime=self._parse_timestamp(row["start_time"]),
            endTime=self._parse_timestamp(row["end_time"]) if row["end_time"] else None,
            duration=row["duration"],
            heartRate=row["heart_rate"],
            status=row["status"],
            ecgData=self._parse_json(row["ecg_data"]),
            bufferSize=row["buffer_size"],
        )

    async def create_recording_session(self, session: InsertRecordingSession) -> RecordingSession:
        conn = self._connect()
        try:
            cursor = conn.execute(
                """
                INSERT INTO recording_sessions
                (session_id, patient_id, device_id, duration, heart_rate, status, ecg_data, buffer_size)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    session.session_id,
                    session.patient_id,
                    session.device_id,
                    session.duration,
                    session.heart_rate,
                    session.status,
                    self._dump_json(session.ecg_data),
                    session.buffer_size,
                ),
            )
            conn.commit()
            created = await self.get_recording_session(cursor.lastrowid)
            if created is None:
                raise RuntimeError("Failed to reload created recording session")
            return created
        finally:
            conn.close()

    async def update_recording_session(self, id: int, session: UpdateRecordingSession | Dict[str, Any]) -> Optional[RecordingSession]:
        current = await self.get_recording_session(id)
        if not current:
            return None

        if hasattr(session, "model_dump"):
            updates = session.model_dump(by_alias=False, exclude_unset=True)
        else:
            raw = dict(session)
            # Normalize camelCase keys (from frontend JSON) to snake_case
            _key_map = {
                "endTime": "end_time",
                "heartRate": "heart_rate",
                "ecgData": "ecg_data",
                "bufferSize": "buffer_size",
                "sessionId": "session_id",
                "patientId": "patient_id",
                "deviceId": "device_id",
            }
            updates = {_key_map.get(k, k): v for k, v in raw.items()}

        fields: List[str] = []
        values: List[Any] = []
        if "end_time" in updates and updates["end_time"] is not None:
            fields.append("end_time = ?")
            end_time = updates["end_time"]
            values.append(end_time.isoformat() if isinstance(end_time, datetime) else str(end_time))
        if "duration" in updates and updates["duration"] is not None:
            fields.append("duration = ?")
            values.append(updates["duration"])
        if "heart_rate" in updates and updates["heart_rate"] is not None:
            fields.append("heart_rate = ?")
            values.append(updates["heart_rate"])
        if "status" in updates and updates["status"] is not None:
            fields.append("status = ?")
            values.append(updates["status"])
        if "ecg_data" in updates and updates["ecg_data"] is not None:
            fields.append("ecg_data = ?")
            values.append(self._dump_json(updates["ecg_data"]))

        if not fields:
            return current

        values.append(id)
        conn = self._connect()
        try:
            conn.execute(f"UPDATE recording_sessions SET {', '.join(fields)} WHERE id = ?", values)
            conn.commit()
            return await self.get_recording_session(id)
        finally:
            conn.close()

    async def get_system_logs(self, limit: int = 50) -> List[SystemLog]:
        conn = self._connect()
        try:
            rows = conn.execute(
                "SELECT * FROM system_logs ORDER BY timestamp DESC LIMIT ?",
                (limit,),
            ).fetchall()
            return [
                SystemLog(
                    id=row["id"],
                    timestamp=self._parse_timestamp(row["timestamp"]),
                    level=row["level"],
                    message=row["message"],
                    source=row["source"],
                )
                for row in rows
            ]
        finally:
            conn.close()

    async def create_system_log(self, log_data: InsertSystemLog | Dict[str, Any]) -> SystemLog:
        if hasattr(log_data, "model_dump"):
            payload = log_data.model_dump(by_alias=False, exclude_unset=True)
        else:
            payload = dict(log_data)

        conn = self._connect()
        try:
            cursor = conn.execute(
                """
                INSERT INTO system_logs (level, message, source)
                VALUES (?, ?, ?)
                """,
                (payload["level"], payload["message"], payload.get("source")),
            )
            conn.commit()
            row = conn.execute("SELECT * FROM system_logs WHERE id = ?", (cursor.lastrowid,)).fetchone()
            if not row:
                raise RuntimeError("Failed to reload created system log")
            return SystemLog(
                id=row["id"],
                timestamp=self._parse_timestamp(row["timestamp"]),
                level=row["level"],
                message=row["message"],
                source=row["source"],
            )
        finally:
            conn.close()


storage = Storage()
