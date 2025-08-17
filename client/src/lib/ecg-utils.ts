export interface ECGLead {
  name: string;
  data: number[];
  voltage: string;
  isActive: boolean;
}

export interface ECGData {
  timestamp: number;
  leads: { [leadName: string]: number };
  heartRate: number;
  quality: 'good' | 'poor' | 'noise';
}

export const ECG_LEAD_NAMES = [
  'Lead I', 'Lead II', 'Lead III',
  'aVR', 'aVL', 'aVF',
  'V1', 'V2', 'V3', 'V4', 'V5', 'V6'
];

export function generateSimulatedECGData(leadName: string, timestamp: number): number {
  // Simulate different ECG patterns for different leads
  const time = timestamp / 1000; // Convert to seconds
  const heartRateHz = 1.0; // 60 BPM
  const beatPhase = (time * heartRateHz) % 1;
  
  let amplitude = 1.0;
  let offset = 0;
  
  // Adjust amplitude and characteristics based on lead
  switch (leadName) {
    case 'Lead I':
      amplitude = 1.2;
      break;
    case 'Lead II':
      amplitude = 1.5;
      break;
    case 'Lead III':
      amplitude = 0.8;
      break;
    case 'aVR':
      amplitude = -0.6;
      break;
    case 'aVL':
      amplitude = 0.9;
      break;
    case 'aVF':
      amplitude = 1.1;
      break;
    case 'V1':
      amplitude = 0.7;
      break;
    case 'V2':
      amplitude = 1.3;
      break;
    case 'V3':
      amplitude = 1.0;
      break;
    case 'V4':
      amplitude = 1.4;
      break;
    case 'V5':
      amplitude = 1.1;
      break;
    case 'V6':
      amplitude = 0.9;
      break;
  }
  
  let value = 0;
  
  // QRS complex (0.04-0.12 of beat cycle)
  if (beatPhase >= 0.04 && beatPhase <= 0.12) {
    const qrsPhase = (beatPhase - 0.04) / 0.08;
    if (qrsPhase < 0.3) {
      // Q wave
      value = -0.2 * amplitude * Math.sin(qrsPhase * Math.PI / 0.3);
    } else if (qrsPhase < 0.7) {
      // R wave
      value = amplitude * Math.sin((qrsPhase - 0.3) * Math.PI / 0.4);
    } else {
      // S wave
      value = -0.3 * amplitude * Math.sin((qrsPhase - 0.7) * Math.PI / 0.3);
    }
  }
  // T wave (0.2-0.4 of beat cycle)
  else if (beatPhase >= 0.2 && beatPhase <= 0.4) {
    const tPhase = (beatPhase - 0.2) / 0.2;
    value = 0.3 * amplitude * Math.sin(tPhase * Math.PI);
  }
  // P wave (0.8-0.95 of beat cycle)
  else if (beatPhase >= 0.8 && beatPhase <= 0.95) {
    const pPhase = (beatPhase - 0.8) / 0.15;
    value = 0.2 * amplitude * Math.sin(pPhase * Math.PI);
  }
  
  // Add some baseline noise
  value += (Math.random() - 0.5) * 0.05;
  
  return value;
}

export function calculateHeartRate(ecgData: ECGData[]): number {
  if (ecgData.length < 2) return 0;
  
  // Simple R-wave detection for heart rate calculation
  const recentData = ecgData.slice(-60); // Last 60 samples
  const rWaves: number[] = [];
  
  for (let i = 1; i < recentData.length - 1; i++) {
    const current = recentData[i].leads['Lead II'] || 0;
    const prev = recentData[i - 1].leads['Lead II'] || 0;
    const next = recentData[i + 1].leads['Lead II'] || 0;
    
    // Detect R-wave peaks
    if (current > 0.5 && current > prev && current > next) {
      rWaves.push(recentData[i].timestamp);
    }
  }
  
  if (rWaves.length < 2) return 0;
  
  // Calculate average RR interval
  const intervals = [];
  for (let i = 1; i < rWaves.length; i++) {
    intervals.push(rWaves[i] - rWaves[i - 1]);
  }
  
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const heartRate = 60000 / avgInterval; // Convert ms to BPM
  
  return Math.round(heartRate);
}

export function detectECGAnomalies(ecgData: ECGData): string[] {
  const anomalies: string[] = [];
  
  // Check for missing leads
  const expectedLeads = ECG_LEAD_NAMES;
  const actualLeads = Object.keys(ecgData.leads);
  const missingLeads = expectedLeads.filter(lead => !actualLeads.includes(lead));
  
  if (missingLeads.length > 0) {
    anomalies.push(`Missing leads: ${missingLeads.join(', ')}`);
  }
  
  // Check for noise/poor quality
  if (ecgData.quality === 'poor') {
    anomalies.push('Poor signal quality detected');
  } else if (ecgData.quality === 'noise') {
    anomalies.push('Excessive noise in signal');
  }
  
  // Check heart rate bounds
  if (ecgData.heartRate < 60) {
    anomalies.push('Bradycardia detected (HR < 60 BPM)');
  } else if (ecgData.heartRate > 100) {
    anomalies.push('Tachycardia detected (HR > 100 BPM)');
  }
  
  return anomalies;
}

export function formatECGDataForExport(ecgData: ECGData[]): string {
  const header = ['Timestamp', 'Heart Rate', ...ECG_LEAD_NAMES].join(',');
  const rows = ecgData.map(data => {
    const row = [
      data.timestamp,
      data.heartRate,
      ...ECG_LEAD_NAMES.map(lead => data.leads[lead] || 0)
    ];
    return row.join(',');
  });
  
  return [header, ...rows].join('\n');
}
