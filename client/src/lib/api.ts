// API utility for ECG recording sessions

import axios from 'axios';


import type { InsertRecordingSession } from "../../../../backend/models";

export async function saveRecordingSession(session: InsertRecordingSession) {
  const res = await axios.post('/api/recording-sessions', session);
  return res.data;
}

export async function fetchAllSessions() {
  const res = await axios.get('/api/recording-sessions');
  return res.data;
}

export async function fetchPatientSessions(patientId: number) {
  const res = await axios.get(`/api/recording-sessions/patient/${patientId}`);
  return res.data;
}

export async function fetchSessionById(sessionId: number) {
  const res = await axios.get(`/api/recording-sessions/${sessionId}`);
  return res.data;
}
