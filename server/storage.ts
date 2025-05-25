import { 
  patients, 
  bleDevices, 
  recordingSessions, 
  systemLogs,
  type Patient, 
  type InsertPatient,
  type BleDevice,
  type InsertBleDevice,
  type RecordingSession,
  type InsertRecordingSession,
  type SystemLog,
  type InsertSystemLog
} from "@shared/schema";

export interface IStorage {
  // Patient operations
  getPatients(): Promise<Patient[]>;
  getPatient(id: number): Promise<Patient | undefined>;
  getPatientByPatientId(patientId: string): Promise<Patient | undefined>;
  createPatient(patient: InsertPatient): Promise<Patient>;
  updatePatient(id: number, patient: Partial<InsertPatient>): Promise<Patient | undefined>;
  
  // BLE Device operations
  getBleDevices(): Promise<BleDevice[]>;
  getBleDevice(id: number): Promise<BleDevice | undefined>;
  getBleDeviceByDeviceId(deviceId: string): Promise<BleDevice | undefined>;
  createBleDevice(device: InsertBleDevice): Promise<BleDevice>;
  updateBleDevice(id: number, device: Partial<InsertBleDevice>): Promise<BleDevice | undefined>;
  
  // Recording Session operations
  getRecordingSessions(): Promise<RecordingSession[]>;
  getRecordingSessionsByPatient(patientId: number): Promise<RecordingSession[]>;
  getRecordingSession(id: number): Promise<RecordingSession | undefined>;
  getRecordingSessionBySessionId(sessionId: string): Promise<RecordingSession | undefined>;
  createRecordingSession(session: InsertRecordingSession): Promise<RecordingSession>;
  updateRecordingSession(id: number, session: Partial<RecordingSession>): Promise<RecordingSession | undefined>;
  
  // System Log operations
  getSystemLogs(limit?: number): Promise<SystemLog[]>;
  createSystemLog(log: InsertSystemLog): Promise<SystemLog>;
}

export class MemStorage implements IStorage {
  private patients: Map<number, Patient> = new Map();
  private bleDevices: Map<number, BleDevice> = new Map();
  private recordingSessions: Map<number, RecordingSession> = new Map();
  private systemLogs: Map<number, SystemLog> = new Map();
  private currentPatientId = 1;
  private currentBleDeviceId = 1;
  private currentRecordingSessionId = 1;
  private currentSystemLogId = 1;

  constructor() {
    // Initialize with some default data
    this.initializeDefaultData();
  }

  private initializeDefaultData() {
    // Default patient
    const defaultPatient: Patient = {
      id: this.currentPatientId++,
      name: "Sarah Johnson",
      patientId: "PAT-12345",
      dateOfBirth: "1985-03-15",
      gender: "Female",
      medicalNotes: "Regular patient for routine ECG monitoring",
      createdAt: new Date(),
    };
    this.patients.set(defaultPatient.id, defaultPatient);

    // Default BLE device
    const defaultDevice: BleDevice = {
      id: this.currentBleDeviceId++,
      deviceId: "ECG-12L-001",
      name: "ECG Pro 12-Lead Monitor",
      isConnected: true,
      lastSeen: new Date(),
      rssi: -45,
    };
    this.bleDevices.set(defaultDevice.id, defaultDevice);
  }

  // Patient operations
  async getPatients(): Promise<Patient[]> {
    return Array.from(this.patients.values());
  }

  async getPatient(id: number): Promise<Patient | undefined> {
    return this.patients.get(id);
  }

  async getPatientByPatientId(patientId: string): Promise<Patient | undefined> {
    return Array.from(this.patients.values()).find(p => p.patientId === patientId);
  }

  async createPatient(patient: InsertPatient): Promise<Patient> {
    const newPatient: Patient = {
      ...patient,
      id: this.currentPatientId++,
      createdAt: new Date(),
    };
    this.patients.set(newPatient.id, newPatient);
    return newPatient;
  }

  async updatePatient(id: number, patient: Partial<InsertPatient>): Promise<Patient | undefined> {
    const existing = this.patients.get(id);
    if (!existing) return undefined;
    
    const updated: Patient = { ...existing, ...patient };
    this.patients.set(id, updated);
    return updated;
  }

  // BLE Device operations
  async getBleDevices(): Promise<BleDevice[]> {
    return Array.from(this.bleDevices.values());
  }

  async getBleDevice(id: number): Promise<BleDevice | undefined> {
    return this.bleDevices.get(id);
  }

  async getBleDeviceByDeviceId(deviceId: string): Promise<BleDevice | undefined> {
    return Array.from(this.bleDevices.values()).find(d => d.deviceId === deviceId);
  }

  async createBleDevice(device: InsertBleDevice): Promise<BleDevice> {
    const newDevice: BleDevice = {
      ...device,
      id: this.currentBleDeviceId++,
      lastSeen: new Date(),
    };
    this.bleDevices.set(newDevice.id, newDevice);
    return newDevice;
  }

  async updateBleDevice(id: number, device: Partial<InsertBleDevice>): Promise<BleDevice | undefined> {
    const existing = this.bleDevices.get(id);
    if (!existing) return undefined;
    
    const updated: BleDevice = { ...existing, ...device, lastSeen: new Date() };
    this.bleDevices.set(id, updated);
    return updated;
  }

  // Recording Session operations
  async getRecordingSessions(): Promise<RecordingSession[]> {
    return Array.from(this.recordingSessions.values()).sort((a, b) => 
      new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
  }

  async getRecordingSessionsByPatient(patientId: number): Promise<RecordingSession[]> {
    return Array.from(this.recordingSessions.values())
      .filter(s => s.patientId === patientId)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }

  async getRecordingSession(id: number): Promise<RecordingSession | undefined> {
    return this.recordingSessions.get(id);
  }

  async getRecordingSessionBySessionId(sessionId: string): Promise<RecordingSession | undefined> {
    return Array.from(this.recordingSessions.values()).find(s => s.sessionId === sessionId);
  }

  async createRecordingSession(session: InsertRecordingSession): Promise<RecordingSession> {
    const newSession: RecordingSession = {
      ...session,
      id: this.currentRecordingSessionId++,
      startTime: new Date(),
      endTime: null,
    };
    this.recordingSessions.set(newSession.id, newSession);
    return newSession;
  }

  async updateRecordingSession(id: number, session: Partial<RecordingSession>): Promise<RecordingSession | undefined> {
    const existing = this.recordingSessions.get(id);
    if (!existing) return undefined;
    
    const updated: RecordingSession = { ...existing, ...session };
    this.recordingSessions.set(id, updated);
    return updated;
  }

  // System Log operations
  async getSystemLogs(limit: number = 50): Promise<SystemLog[]> {
    const logs = Array.from(this.systemLogs.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return logs.slice(0, limit);
  }

  async createSystemLog(log: InsertSystemLog): Promise<SystemLog> {
    const newLog: SystemLog = {
      ...log,
      id: this.currentSystemLogId++,
      timestamp: new Date(),
    };
    this.systemLogs.set(newLog.id, newLog);
    return newLog;
  }
}

export const storage = new MemStorage();
