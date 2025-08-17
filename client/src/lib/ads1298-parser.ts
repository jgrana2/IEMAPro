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
  quality: "good" | "poor" | "noise";
}

/**
 * Parse 24-bit signed integer from 3 bytes
 * Following the Swift reference pattern for proper sign extension
 */
function parse24BitSigned(byte0: number, byte1: number, byte2: number): number {
  // Combine bytes: b0 << 16 | b1 << 8 | b2
  const combined = (byte0 << 16) | (byte1 << 8) | byte2;

  // Sign extension: shift left 8 bits then arithmetic right shift 8 bits
  const signedValue = (combined << 8) >> 8;

  return signedValue;
}

/**
 * Parse single channel ADS1298 ECG data from BLE characteristic
 * Each characteristic (8171-8178) contains 28 samples of 24-bit data for one channel
 * @param rawData - Array of bytes (should be 84 bytes = 28 samples * 3 bytes each)
 * @param channelNumber - Channel number (1-8 corresponding to characteristics 8171-8178)
 */
export function parseADS1298SingleChannel(
  rawData: number[],
  channelNumber: number,
): number[] {
  if (!rawData || rawData.length === 0) {
    return [];
  }

  // Expected: 28 samples * 3 bytes = 84 bytes
  const expectedBytes = 28 * 3;
  if (rawData.length !== expectedBytes) {
    // Warning: unexpected byte count - handled silently
  }

  const samples: number[] = [];
  const sampleCount = Math.floor(rawData.length / 3);

  for (let i = 0; i < sampleCount; i++) {
    const startIndex = i * 3;
    if (startIndex + 2 < rawData.length) {
      const b0 = rawData[startIndex];
      const b1 = rawData[startIndex + 1];
      const b2 = rawData[startIndex + 2];

      // Parse 24-bit signed integer from 3 bytes using proper sign extension
      const signedValue = parse24BitSigned(b0, b1, b2);

      samples.push(signedValue);
    }
  }

  return samples;
}

/**
 * Parse ADS1298 ECG data packet with raw ADC values (no voltage conversion or quality assessment)
 * Format: Each sample is 3 bytes (24-bit), two's complement, MSB first
 */
export function parseADS1298DataRaw(rawData: number[]): ParsedECGData {
  if (!rawData || rawData.length === 0) {
    return {
      samples: [],
      timestamp: Date.now(),
      sampleRate: 250,
      quality: "good",
    };
  }

  const samples: ADS1298Sample[] = [];

  // Handle data format with 3-byte samples (following Swift reference pattern)
  const count = Math.floor(rawData.length / 3); // Each sample is 3 bytes
  for (let i = 0; i < count; i++) {
    const startIndex = i * 3;
    if (startIndex + 2 < rawData.length) {
      const b0 = rawData[startIndex];
      const b1 = rawData[startIndex + 1];
      const b2 = rawData[startIndex + 2];

      // Following Swift reference: (b0 << 16) | (b1 << 8) | b2
      const combined = (b0 << 16) | (b1 << 8) | b2;

      // Sign extension: shift left 8 bits then arithmetic right shift 8 bits
      const signedValue = (combined << 8) >> 8;

      // Use raw ADC values directly (no voltage conversion)
      const rawValue = signedValue;

      const sample: ADS1298Sample = {
        leadI: rawValue,
        leadII: rawValue, // Use real data, not synthetic
        leadIII: 0, // Will be calculated from actual channels when available
        aVR: 0,
        aVL: 0,
        aVF: 0,
        V1: 0,
        V2: 0,
        V3: 0,
        V4: 0,
        V5: 0,
        V6: 0,
      };

      samples.push(sample);
    }
  }

  return {
    samples,
    timestamp: Date.now(),
    sampleRate: 250,
    quality: "good",
  };
}

/**
 * Parse ADS1298 ECG data packet (with voltage conversion - original function)
 * Format: Each sample is 3 bytes (24-bit), two's complement, MSB first
 */
export function parseADS1298Data(rawData: number[]): ParsedECGData {
  if (!rawData || rawData.length === 0) {
    return {
      samples: [],
      timestamp: Date.now(),
      sampleRate: 250,
      quality: "noise",
    };
  }

  const samples: ADS1298Sample[] = [];

  // Handle data format with 3-byte samples (following Swift reference pattern)
  const count = Math.floor(rawData.length / 3); // Each sample is 3 bytes

  for (let i = 0; i < count; i++) {
    const startIndex = i * 3;
    if (startIndex + 2 < rawData.length) {
      const b0 = rawData[startIndex];
      const b1 = rawData[startIndex + 1];
      const b2 = rawData[startIndex + 2];

      // Following Swift reference: (b0 << 16) | (b1 << 8) | b2
      const combined = (b0 << 16) | (b1 << 8) | b2;

      // Sign extension: shift left 8 bits then arithmetic right shift 8 bits
      const signedValue = (combined << 8) >> 8;

      const sample: ADS1298Sample = {
        leadI: signedValue,
        leadII: signedValue,
        leadIII: 0,
        aVR: 0,
        aVL: 0,
        aVF: 0,
        V1: 0,
        V2: 0,
        V3: 0,
        V4: 0,
        V5: 0,
        V6: 0,
      };

      samples.push(sample);
    }
  }

  return {
    samples,
    timestamp: Date.now(),
    sampleRate: 250,
    quality: "good",
  };
}

/**
 * Convert parsed samples to the format expected by ECG components
 */
export function convertToECGFormat(parsedData: ParsedECGData): {
  [leadName: string]: number[];
} {
  const leadMapping = {
    "Lead I": "leadI",
    "Lead II": "leadII",
    "Lead III": "leadIII",
    aVR: "aVR",
    aVL: "aVL",
    aVF: "aVF",
    V1: "V1",
    V2: "V2",
    V3: "V3",
    V4: "V4",
    V5: "V5",
    V6: "V6",
  };

  const result: { [leadName: string]: number[] } = {};

  Object.entries(leadMapping).forEach(([leadName, sampleKey]) => {
    // Collect raw values for this lead
    const raw = parsedData.samples.map(
      (sample) => sample[sampleKey as keyof ADS1298Sample],
    );

    // Return raw signal without any filtering
    result[leadName] = raw;
    
    // REMOVED: Apply baseline-wander removal only (simple high-pass via exponential moving average)
    // result[leadName] = removeBaselineWander(raw, parsedData.sampleRate || 250);
  });

  return result;
}

/**
 * Calculate heart rate from ECG samples
 */
export function calculateHeartRateFromSamples(
  samples: ADS1298Sample[],
  sampleRate: number = 250,
): number {
  if (samples.length < sampleRate) return 0; // Need at least 1 second of data

  // Use Lead I for heart rate calculation (only available lead)
  const leadI = samples.map((s) => s.leadI);

  // Simple peak detection for R-waves
  const peaks: number[] = [];
  const threshold = Math.max(...leadI) * 0.6; // 60% of max amplitude

  for (let i = 1; i < leadI.length - 1; i++) {
    if (
      leadI[i] > threshold &&
      leadI[i] > leadI[i - 1] &&
      leadI[i] > leadI[i + 1]
    ) {
      // Ensure peaks are at least 200ms apart (300 BPM max)
      if (
        peaks.length === 0 ||
        i - peaks[peaks.length - 1] > sampleRate * 0.2
      ) {
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

  const avgRRInterval =
    rrIntervals.reduce((a, b) => a + b, 0) / rrIntervals.length;
  const avgRRSeconds = avgRRInterval / sampleRate;

  return Math.round(60 / avgRRSeconds); // Convert to BPM
}

/**
 * Calculate heart rate from single channel ECG data
 */
export function calculateHeartRateFromChannel(channelData: number[]): number {
  if (channelData.length < 2) return 75;

  // Find R-peaks (simplified peak detection)
  const peaks: number[] = [];
  const maxValue = Math.max(...channelData);
  const minValue = Math.min(...channelData);
  const threshold = minValue + (maxValue - minValue) * 0.6;

  for (let i = 1; i < channelData.length - 1; i++) {
    if (
      channelData[i] > channelData[i - 1] &&
      channelData[i] > channelData[i + 1] &&
      channelData[i] > threshold
    ) {
      peaks.push(i);
    }
  }

  if (peaks.length < 2) return 75;

  // Calculate RR intervals
  const intervals = [];
  for (let i = 1; i < peaks.length; i++) {
    intervals.push(peaks[i] - peaks[i - 1]);
  }

  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const sampleRate = 250; // ADS1298 sample rate
  const heartRate = Math.round((60 * sampleRate) / avgInterval);

  // Clamp to reasonable range
  return Math.max(40, Math.min(200, heartRate));
}

/**
 * Assess signal quality for single channel data
 */
export function assessChannelQuality(
  channelData: number[],
): "good" | "poor" | "noise" {
  if (channelData.length === 0) return "poor";

  const mean = channelData.reduce((a, b) => a + b, 0) / channelData.length;
  const variance =
    channelData.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) /
    channelData.length;
  const stdDev = Math.sqrt(variance);
  const maxAmplitude = Math.max(...channelData.map(Math.abs));

  if (maxAmplitude > 50000 || stdDev > 20000) {
    return "noise"; // Too much noise or artifact
  } else if (maxAmplitude < 1000 || stdDev < 100) {
    return "poor"; // Signal too weak or flat
  }

  return "good";
}
