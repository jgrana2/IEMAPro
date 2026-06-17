import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { analyzeECGWithAI } from "./ai-diagnosis";
import { insertPatientSchema, insertBleDeviceSchema, insertRecordingSessionSchema, insertSystemLogSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Patient routes
  app.get("/api/patients", async (req, res) => {
    try {
      const patients = await storage.getPatients();
      res.json(patients);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch patients" });
    }
  });

  app.get("/api/patients/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const patient = await storage.getPatient(id);
      if (!patient) {
        return res.status(404).json({ error: "Patient not found" });
      }
      res.json(patient);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch patient" });
    }
  });

  app.post("/api/patients", async (req, res) => {
    try {
      const patientData = insertPatientSchema.parse(req.body);
      const patient = await storage.createPatient(patientData);
      res.status(201).json(patient);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid patient data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create patient" });
    }
  });

  // BLE Device routes
  app.get("/api/ble-devices", async (req, res) => {
    try {
      const devices = await storage.getBleDevices();
      res.json(devices);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch BLE devices" });
    }
  });

  app.post("/api/ble-devices", async (req, res) => {
    try {
      const deviceData = insertBleDeviceSchema.parse(req.body);
      const device = await storage.createBleDevice(deviceData);
      res.status(201).json(device);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid device data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create BLE device" });
    }
  });

  app.patch("/api/ble-devices/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const device = await storage.updateBleDevice(id, updates);
      if (!device) {
        return res.status(404).json({ error: "Device not found" });
      }
      res.json(device);
    } catch (error) {
      res.status(500).json({ error: "Failed to update BLE device" });
    }
  });

  app.patch("/api/ble-devices/device/:deviceId", async (req, res) => {
    try {
      const deviceId = req.params.deviceId;
      const updates = req.body;
      
      // Find device by deviceId first
      const device = await storage.getBleDeviceByDeviceId(deviceId);
      if (!device) {
        return res.status(404).json({ error: "Device not found" });
      }
      
      const updatedDevice = await storage.updateBleDevice(device.id, updates);
      res.json(updatedDevice);
    } catch (error) {
      res.status(500).json({ error: "Failed to update BLE device" });
    }
  });

  // Recording Session routes
  app.get("/api/recording-sessions", async (req, res) => {
    try {
      const sessions = await storage.getRecordingSessions();
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recording sessions" });
    }
  });

  app.get("/api/recording-sessions/patient/:patientId", async (req, res) => {
    try {
      const patientId = parseInt(req.params.patientId);
      const sessions = await storage.getRecordingSessionsByPatient(patientId);
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch patient recording sessions" });
    }
  });

  app.get("/api/recording-sessions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const session = await storage.getRecordingSession(id);
      if (!session) {
        return res.status(404).json({ error: "Recording session not found" });
      }
      res.json(session);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recording session" });
    }
  });

  app.post("/api/recording-sessions", async (req, res) => {
    try {
      const sessionData = insertRecordingSessionSchema.parse(req.body);

      const patient = await storage.getPatient(sessionData.patientId);
      if (!patient) {
        return res.status(400).json({ error: "Invalid patient. Please select a valid patient before recording." });
      }

      const device = await storage.getBleDevice(sessionData.deviceId);
      if (!device) {
        return res.status(400).json({ error: "Invalid device. Please connect a valid BLE device before recording." });
      }

      if (!device.isConnected) {
        await storage.updateBleDevice(device.id, { isConnected: true });
      }

      const session = await storage.createRecordingSession(sessionData);
      res.status(201).json(session);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid session data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create recording session" });
    }
  });

  app.patch("/api/recording-sessions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const session = await storage.updateRecordingSession(id, updates);
      if (!session) {
        return res.status(404).json({ error: "Recording session not found" });
      }
      res.json(session);
    } catch (error) {
      res.status(500).json({ error: "Failed to update recording session" });
    }
  });

  // AI Diagnosis route
  app.post("/api/ai-diagnosis", async (req, res) => {
    try {
      const { message, ecgData } = req.body;
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }
      
      const result = await analyzeECGWithAI({ message, ecgData });
      res.json(result);
    } catch (error) {
      console.error("AI Diagnosis Error:", error);
      res.status(500).json({ error: "Failed to analyze ECG data with AI" });
    }
  });

  // System Log routes
  app.get("/api/system-logs", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const logs = await storage.getSystemLogs(limit);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch system logs" });
    }
  });

  app.post("/api/system-logs", async (req, res) => {
    try {
      const logData = insertSystemLogSchema.parse(req.body);
      const log = await storage.createSystemLog(logData);
      res.status(201).json(log);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid log data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create system log" });
    }
  });

  // WebSocket server for real-time ECG data streaming
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  // Store active WebSocket connections
  const activeConnections = new Set<WebSocket>();

  wss.on('connection', async (ws: WebSocket) => {
    console.log('WebSocket client connected');
    activeConnections.add(ws);

    // Log connection
    await storage.createSystemLog({
      level: "info",
      message: "WebSocket client connected",
      source: "websocket"
    });

    ws.on('message', async (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Handle different message types
        switch (data.type) {
          case 'ecg_data':
            // Broadcast ECG data to all connected clients
            const ecgMessage = JSON.stringify({
              type: 'ecg_data',
              timestamp: Date.now(),
              patientId: data.patientId,
              sessionId: data.sessionId,
              leadData: data.leadData,
              heartRate: data.heartRate
            });

            activeConnections.forEach(client => {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(ecgMessage);
              }
            });

            // Update recording session if active
            if (data.sessionId) {
              const session = await storage.getRecordingSessionBySessionId(data.sessionId);
              if (session) {
                await storage.updateRecordingSession(session.id, {
                  heartRate: data.heartRate,
                  ecgData: data.leadData
                });
              }
            }
            break;

          case 'ads1298_data':
            // Handle raw ADS1298 ECG data
            const ads1298Message = JSON.stringify({
              type: 'ads1298_data',
              timestamp: Date.now(),
              patientId: data.patientId,
              sessionId: data.sessionId,
              rawData: data.rawData, // Array of 84 bytes from ADS1298
              deviceId: data.deviceId || '00008171-0000-1000-8000-00805f9b34fb'
            });

            // Broadcast to all connected clients for real-time visualization
            activeConnections.forEach(client => {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(ads1298Message);
              }
            });

            // Log ADS1298 data reception
            await storage.createSystemLog({
              level: "info",
              message: `ADS1298 data received: ${data.rawData ? data.rawData.length : 0} bytes`,
              source: "ads1298"
            });
            break;

          case 'buffer_flush':
            await storage.createSystemLog({
              level: "info",
              message: `Buffer flushed: ${data.bufferSize} samples sent`,
              source: "websocket"
            });
            break;

          case 'ble_status':
            await storage.createSystemLog({
              level: data.connected ? "info" : "warning",
              message: `BLE device ${data.connected ? "connected" : "disconnected"}: ${data.deviceId}`,
              source: "ble"
            });
            
            // Update device status
            if (data.deviceId) {
              const device = await storage.getBleDeviceByDeviceId(data.deviceId);
              if (device) {
                await storage.updateBleDevice(device.id, {
                  isConnected: data.connected
                });
              }
            }
            break;
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        await storage.createSystemLog({
          level: "error",
          message: `WebSocket message error: ${error}`,
          source: "websocket"
        });
      }
    });

    ws.on('close', async () => {
      console.log('WebSocket client disconnected');
      activeConnections.delete(ws);
      
      await storage.createSystemLog({
        level: "info",
        message: "WebSocket client disconnected",
        source: "websocket"
      });
    });

    ws.on('error', async (error) => {
      console.error('WebSocket error:', error);
      activeConnections.delete(ws);
      
      await storage.createSystemLog({
        level: "error",
        message: `WebSocket error: ${error.message}`,
        source: "websocket"
      });
    });

    // Send initial connection confirmation
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'connection_status',
        status: 'connected',
        timestamp: Date.now()
      }));
    }
  });

  return httpServer;
}
