/**
 * ADS1298 ECG Data Parser
 * Handles parsing of 24-bit ECG data from ADS1298 AFE
 */

export interface ADS1298Sample {
  leadI: number;      // Channel 1 (raw)
  leadII: number;     // Channel 2 (raw)
  leadIII: number;    // Derived: Lead I - Lead II
  aVR: number;        // Derived: -(Lead I + Lead II) / 2
  aVL: number;        // Derived: Lead I - Lead II / 2
  aVF: number;        // Derived: Lead II - Lead I / 2
  V1: number;         // Channel 3
  V2: number;         // Channel 4
  V3: number;         // Channel 5
  V4: number;         // Channel 6
  V5: number;         // Channel 7
  V6: number;         // Channel 8
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

  // Check if the sign bit (bit 23) is set
  if (combined & 0x800000) {  // Sign bit is set (negative number)
    // Sign extend by ORing with 0xFF000000 and converting to signed 32-bit
    return combined | 0xFF000000;
  } else {
    return combined;
  }
}

/**
 * Convert raw ADC value to voltage (in mV)
 * ADS1298 has 24-bit resolution with ±2.4V reference
 */
function adcToVoltage(adcValue: number, gain: number = 12): number {
  const vref = 2.4;  // Reference voltage
  const resolution = 24;  // 24-bit ADC
  const maxValue = Math.pow(2, resolution - 1) - 1;  // 2^23 - 1
  
  // Convert to voltage and scale to millivolts
  const voltage = ((adcValue / maxValue) * vref * 1000) / gain;
  return voltage;
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
      
      // Convert raw ADC value to voltage (in mV)
      const voltage = adcToVoltage(signedValue, 12);

      samples.push(voltage);
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

      // Convert raw ADC value to voltage (in mV)
      const voltage = adcToVoltage(signedValue, 12);

      const sample: ADS1298Sample = {
        leadI: voltage,
        leadII: voltage, // Use real data, not synthetic
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
      
      // Convert raw ADC value to voltage (in mV)
      const voltage = adcToVoltage(signedValue, 12);

      const sample: ADS1298Sample = {
        leadI: voltage,
        leadII: voltage,
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
 * Create ADS1298Sample with proper lead derivation
 * @param channelData - Object containing raw channel data (1-8)
 * @param sampleIndex - Index of the current sample within each channel
 */
export function createADS1298Sample(
  channelData: { [channel: number]: number[] },
  sampleIndex: number
): ADS1298Sample {
  // Get raw values for this sample
  const leadI = channelData[1]?.[sampleIndex] || 0;
  const leadII = channelData[2]?.[sampleIndex] || 0;
  const V1 = channelData[3]?.[sampleIndex] || 0;
  const V2 = channelData[4]?.[sampleIndex] || 0;
  const V3 = channelData[5]?.[sampleIndex] || 0;
  const V4 = channelData[6]?.[sampleIndex] || 0;
  const V5 = channelData[7]?.[sampleIndex] || 0;
  const V6 = channelData[8]?.[sampleIndex] || 0;

  // Calculate derived leads using standard ECG formulas
  const leadIII = leadI - leadII;
  const aVR = -(leadI + leadII) / 2;
  const aVL = leadI - leadII / 2;
  const aVF = leadII - leadI / 2;

  return {
    leadI,
    leadII,
    leadIII,
    aVR,
    aVL,
    aVF,
    V1,
    V2,
    V3,
    V4,
    V5,
    V6
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
  if (samples.length < 50) return 60; // Need at least 0.2 seconds of data

  // Use Lead I for heart rate calculation (only available lead)
  const leadI = samples.map((s) => s.leadI);

  // Improved peak detection for R-waves
  let peaks: number[] = [];
  
  // Calculate adaptive threshold using signal statistics
  const meanVal = leadI.reduce((a, b) => a + b, 0) / leadI.length;
  const maxVal = Math.max(...leadI);
  const minVal = Math.min(...leadI);
  
  // Use adaptive threshold: mean + 70% of range above mean
  let threshold = meanVal + (maxVal - meanVal) * 0.7;
  
  // Minimum peak separation (300ms for max 200 BPM)
  const minPeakDistance = Math.floor(sampleRate * 0.3);

  for (let i = 1; i < leadI.length - 1; i++) {
    // R-wave detection: local maximum above threshold
    if (
      leadI[i] > threshold &&
      leadI[i] > leadI[i - 1] &&
      leadI[i] > leadI[i + 1]
    ) {
      // Ensure peaks are sufficiently separated
      if (peaks.length === 0 || i - peaks[peaks.length - 1] > minPeakDistance) {
        peaks.push(i);
      }
    }
  }

  if (peaks.length < 2) {
    // If no peaks detected, try with lower threshold
    threshold = meanVal + (maxVal - meanVal) * 0.4;
    peaks = [];
    for (let i = 1; i < leadI.length - 1; i++) {
      if (
        leadI[i] > threshold &&
        leadI[i] > leadI[i - 1] &&
        leadI[i] > leadI[i + 1]
      ) {
        if (peaks.length === 0 || i - peaks[peaks.length - 1] > minPeakDistance) {
          peaks.push(i);
        }
      }
    }
  }

  if (peaks.length < 2) return 60; // Default if still no peaks detected

  // Calculate RR intervals (in samples)
  const rrIntervals = [];
  for (let i = 1; i < peaks.length; i++) {
    rrIntervals.push(peaks[i] - peaks[i - 1]);
  }

  // Remove outliers (RR intervals that are too short or too long)
  const filteredIntervals = rrIntervals.filter(interval => {
    // Accept intervals corresponding to 40-180 BPM
    return interval >= sampleRate * 0.33 && interval <= sampleRate * 1.5;
  });

  if (filteredIntervals.length === 0) return 60;

  // Calculate average RR interval
  const avgRRInterval = filteredIntervals.reduce((a, b) => a + b, 0) / filteredIntervals.length;
  const avgRRSeconds = avgRRInterval / sampleRate;

  // Calculate BPM
  const heartRate = Math.round(60 / avgRRSeconds);
  
  // Clamp to physiological range
  return Math.max(40, Math.min(180, heartRate));
}

/**
 * Calculate heart rate from single channel ECG data
 */
export function calculateHeartRateFromChannel(channelData: number[], sampleRate: number = 250): number {
  if (channelData.length < 50) return 60; // Need at least 0.2 seconds of data

  // Improved R-wave detection
  let peaks: number[] = [];
  
  // Calculate signal statistics for adaptive threshold
  const meanVal = channelData.reduce((a, b) => a + b, 0) / channelData.length;
  const maxValue = Math.max(...channelData);
  const minValue = Math.min(...channelData);
  
  // Use adaptive threshold: mean + 70% of positive range
  let threshold = meanVal + (maxValue - meanVal) * 0.7;
  
  // Minimum peak separation (300ms for max 200 BPM)
  const minPeakDistance = Math.floor(sampleRate * 0.3);

  for (let i = 1; i < channelData.length - 1; i++) {
    if (
      channelData[i] > threshold &&
      channelData[i] > channelData[i - 1] &&
      channelData[i] > channelData[i + 1]
    ) {
      // Ensure peaks are sufficiently separated
      if (peaks.length === 0 || i - peaks[peaks.length - 1] > minPeakDistance) {
        peaks.push(i);
      }
    }
  }

  if (peaks.length < 2) {
    // Try with lower threshold if no peaks found
    threshold = meanVal + (maxValue - meanVal) * 0.4;
    peaks = [];
    for (let i = 1; i < channelData.length - 1; i++) {
      if (
        channelData[i] > threshold &&
        channelData[i] > channelData[i - 1] &&
        channelData[i] > channelData[i + 1]
      ) {
        if (peaks.length === 0 || i - peaks[peaks.length - 1] > minPeakDistance) {
          peaks.push(i);
        }
      }
    }
  }

  if (peaks.length < 2) return 60;

  // Calculate RR intervals
  const intervals = [];
  for (let i = 1; i < peaks.length; i++) {
    intervals.push(peaks[i] - peaks[i - 1]);
  }

  // Filter out unrealistic intervals (corresponding to <40 or >180 BPM)
  const filteredIntervals = intervals.filter(interval => {
    return interval >= sampleRate * 0.33 && interval <= sampleRate * 1.5; // 40-180 BPM range
  });

  if (filteredIntervals.length === 0) return 60;

  // Calculate average interval and convert to BPM
  const avgInterval = filteredIntervals.reduce((a, b) => a + b, 0) / filteredIntervals.length;
  const heartRate = Math.round((60 * sampleRate) / avgInterval);

  // Final clamp to physiological range
  return Math.max(40, Math.min(180, heartRate));
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

  if (maxAmplitude > 50 || stdDev > 20) {
    return "noise"; // Too much noise or artifact
  } else if (maxAmplitude < 0.1 || stdDev < 0.05) {
    return "poor"; // Signal too weak or flat
  }

  return "good";
}
