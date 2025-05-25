import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const patients = pgTable("patients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  patientId: text("patient_id").notNull().unique(),
  dateOfBirth: text("date_of_birth"),
  gender: text("gender"),
  medicalNotes: text("medical_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const bleDevices = pgTable("ble_devices", {
  id: serial("id").primaryKey(),
  deviceId: text("device_id").notNull().unique(),
  name: text("name").notNull(),
  isConnected: boolean("is_connected").default(false).notNull(),
  lastSeen: timestamp("last_seen").defaultNow().notNull(),
  rssi: integer("rssi"),
});

export const recordingSessions = pgTable("recording_sessions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  patientId: integer("patient_id").references(() => patients.id).notNull(),
  deviceId: integer("device_id").references(() => bleDevices.id).notNull(),
  startTime: timestamp("start_time").defaultNow().notNull(),
  endTime: timestamp("end_time"),
  duration: integer("duration"), // in seconds
  heartRate: integer("heart_rate"),
  status: text("status").notNull().default("recording"), // recording, completed, stopped
  ecgData: jsonb("ecg_data"), // stores the ECG buffer data
  bufferSize: integer("buffer_size").default(250).notNull(),
});

export const systemLogs = pgTable("system_logs", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  level: text("level").notNull(), // info, warning, error
  message: text("message").notNull(),
  source: text("source"), // ble, websocket, system
});

export const insertPatientSchema = createInsertSchema(patients).omit({
  id: true,
  createdAt: true,
});

export const insertBleDeviceSchema = createInsertSchema(bleDevices).omit({
  id: true,
  lastSeen: true,
});

export const insertRecordingSessionSchema = createInsertSchema(recordingSessions).omit({
  id: true,
  startTime: true,
  endTime: true,
});

export const insertSystemLogSchema = createInsertSchema(systemLogs).omit({
  id: true,
  timestamp: true,
});

export type Patient = typeof patients.$inferSelect;
export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type BleDevice = typeof bleDevices.$inferSelect;
export type InsertBleDevice = z.infer<typeof insertBleDeviceSchema>;
export type RecordingSession = typeof recordingSessions.$inferSelect;
export type InsertRecordingSession = z.infer<typeof insertRecordingSessionSchema>;
export type SystemLog = typeof systemLogs.$inferSelect;
export type InsertSystemLog = z.infer<typeof insertSystemLogSchema>;
