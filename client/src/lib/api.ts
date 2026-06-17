// API utility for ECG recording sessions

import axios from 'axios';

export async function saveRecordingSession(session: any) {
  const res = await axios.post('/api/recording-sessions', session);
  return res.data;
}

export async function updateRecordingSession(id: number, session: Partial<any>) {
  const res = await axios.patch(`/api/recording-sessions/${id}`, session);
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

export async function deleteSession(sessionId: number | string) {
  const res = await axios.delete(`/api/recording-sessions/${sessionId}`);
  return res.data;
}
