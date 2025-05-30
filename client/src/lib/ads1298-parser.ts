/**
 * ADS1298 ECG Data Parser
 * Handles parsing of 24-bit ECG data from ADS1298 AFE
 */

export interface ADS1298Sample {
  leadI: number;
  leadII: number;
  leadIII: number;
  aVR: number;
  aVL: number;
  aVF: number;
  V1: number;
  V2: number;
  V3: number;
  V4: number;
  V5: number;
  V6: number;
}

export interface ParsedECGData {
  samples: ADS1298Sample[];
  timestamp: number;
  sampleRate: number;
  quality: 'good' | 'poor' | 'noise';
}

/**
 * Parse 24-bit signed integer from 3 bytes
 */
function parse24BitSigned(byte1: number, byte2: number, byte3: number): number {
  // Combine bytes into 24-bit value
  let value = (byte1 << 16) | (byte2 << 8) | byte3;
  
  // Convert to signed if negative (bit 23 is set)
  if (value & 0x800000) {
    value = value - 0x1000000;
  }
  
  return value;
}

/**
 * Convert raw ADC value to voltage (in mV)
 * ADS1298 has 24-bit resolution with ±2.4V reference
 */
function adcToVoltage(adcValue: number, gain: number = 1): number {
  const vref = 2.4; // Reference voltage
  const resolution = 24; // 24-bit ADC
  const maxValue = Math.pow(2, resolution - 1) - 1; // 2^23 - 1
  
  // Convert to voltage and scale to millivolts
  const voltage = (adcValue / maxValue) * vref * 1000 / gain;
  return voltage;
}

/**
 * Parse ADS1298 ECG data packet
 * Expected format: 84 bytes = 28 samples * 3 bytes per sample
 * Each sample contains data for one channel, cycling through 8 channels
 */
export function parseADS1298Data(rawData: number[]): ParsedECGData {
  if (rawData.length !== 84) {
    throw new Error(`Invalid data length: expected 84 bytes, got ${rawData.length}`);
  }

  const samples: ADS1298Sample[] = [];
  const channelData: { [key: number]: number[] } = {
    0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: []
  };

  // Parse 28 samples (84 bytes / 3 bytes per sample)
  for (let i = 0; i < 28; i++) {
    const byteIndex = i * 3;
    const byte1 = rawData[byteIndex];
    const byte2 = rawData[byteIndex + 1];
    const byte3 = rawData[byteIndex + 2];
    
    const adcValue = parse24BitSigned(byte1, byte2, byte3);
    const voltage = adcToVoltage(adcValue);
    
    // Distribute samples across 8 channels (leads)
    const channel = i % 8;
    channelData[channel].push(voltage);
  }

  // Map channels to 12-lead ECG
  // Assuming first 8 channels map to primary leads
  const sampleCount = Math.min(...Object.values(channelData).map(arr => arr.length));
  
  for (let sampleIdx = 0; sampleIdx < sampleCount; sampleIdx++) {
    // Calculate derived leads from primary leads
    const leadI = channelData[0][sampleIdx] || 0;
    const leadII = channelData[1][sampleIdx] || 0;
    const leadIII = leadII - leadI; // Lead III = Lead II - Lead I
    
    const aVR = -(leadI + leadII) / 2;
    const aVL = leadI - leadII / 2;
    const aVF = leadII - leadI / 2;
    
    const sample: ADS1298Sample = {
      leadI,
      leadII,
      leadIII,
      aVR,
      aVL,
      aVF,
      V1: channelData[2][sampleIdx] || 0,
      V2: channelData[3][sampleIdx] || 0,
      V3: channelData[4][sampleIdx] || 0,
      V4: channelData[5][sampleIdx] || 0,
      V5: channelData[6][sampleIdx] || 0,
      V6: channelData[7][sampleIdx] || 0,
    };
    
    samples.push(sample);
  }

  // Assess signal quality based on variance and amplitude
  const quality = assessSignalQuality(samples);

  return {
    samples,
    timestamp: Date.now(),
    sampleRate: 500, // ADS1298 typical sample rate
    quality
  };
}

/**
 * Assess signal quality based on ECG characteristics
 */
function assessSignalQuality(samples: ADS1298Sample[]): 'good' | 'poor' | 'noise' {
  if (samples.length === 0) return 'poor';
  
  // Calculate signal variance for Lead II (most reliable)
  const leadIIValues = samples.map(s => s.leadII);
  const mean = leadIIValues.reduce((a, b) => a + b, 0) / leadIIValues.length;
  const variance = leadIIValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / leadIIValues.length;
  const stdDev = Math.sqrt(variance);
  
  // Check for reasonable ECG amplitude (0.1 - 5 mV typical)
  const maxAmplitude = Math.max(...leadIIValues.map(Math.abs));
  const minAmplitude = Math.min(...leadIIValues.map(Math.abs));
  
  if (maxAmplitude > 10 || stdDev > 5) {
    return 'noise'; // Too much noise or artifact
  } else if (maxAmplitude < 0.05 || stdDev < 0.01) {
    return 'poor'; // Signal too weak or flat
  }
  
  return 'good';
}

/**
 * Convert parsed samples to the format expected by ECG components
 */
export function convertToECGFormat(parsedData: ParsedECGData): { [leadName: string]: number[] } {
  const leadMapping = {
    'Lead I': 'leadI',
    'Lead II': 'leadII',
    'Lead III': 'leadIII',
    'aVR': 'aVR',
    'aVL': 'aVL',
    'aVF': 'aVF',
    'V1': 'V1',
    'V2': 'V2',
    'V3': 'V3',
    'V4': 'V4',
    'V5': 'V5',
    'V6': 'V6'
  };

  const result: { [leadName: string]: number[] } = {};
  
  Object.entries(leadMapping).forEach(([leadName, sampleKey]) => {
    result[leadName] = parsedData.samples.map(sample => 
      sample[sampleKey as keyof ADS1298Sample]
    );
  });

  return result;
}

/**
 * Calculate heart rate from ECG samples
 */
export function calculateHeartRateFromSamples(samples: ADS1298Sample[], sampleRate: number = 500): number {
  if (samples.length < sampleRate) return 0; // Need at least 1 second of data
  
  // Use Lead II for heart rate calculation
  const leadII = samples.map(s => s.leadII);
  
  // Simple peak detection for R-waves
  const peaks: number[] = [];
  const threshold = Math.max(...leadII) * 0.6; // 60% of max amplitude
  
  for (let i = 1; i < leadII.length - 1; i++) {
    if (leadII[i] > threshold && 
        leadII[i] > leadII[i - 1] && 
        leadII[i] > leadII[i + 1]) {
      // Ensure peaks are at least 200ms apart (300 BPM max)
      if (peaks.length === 0 || i - peaks[peaks.length - 1] > sampleRate * 0.2) {
        peaks.push(i);
      }
    }
  }
  
  if (peaks.length < 2) return 0;
  
  // Calculate average RR interval
  const rrIntervals = [];
  for (let i = 1; i < peaks.length; i++) {
    rrIntervals.push(peaks[i] - peaks[i - 1]);
  }
  
  const avgRRInterval = rrIntervals.reduce((a, b) => a + b, 0) / rrIntervals.length;
  const avgRRSeconds = avgRRInterval / sampleRate;
  
  return Math.round(60 / avgRRSeconds); // Convert to BPM
}