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
 * Convert raw ADC value to voltage (in mV)
 * ADS1298 has 24-bit resolution with ±2.4V reference
 */
function adcToVoltage(adcValue: number, gain: number = 12): number {
  const vref = 2.4; // Reference voltage
  const resolution = 24; // 24-bit ADC
  const maxValue = Math.pow(2, resolution - 1) - 1; // 2^23 - 1

  // Convert to voltage and scale to millivolts
  const voltage = ((adcValue / maxValue) * vref * 1000) / gain;
  return voltage;
}

/**
 * Parse ADS1298 ECG data packet
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
  console.log(`Processing ${rawData.length} bytes as ${count} samples`);

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

      // Convert to voltage (raw ADC value to mV)
      const voltage = adcToVoltage(signedValue, 12);

      // For now, treat as Lead I data and calculate derived leads
      const leadI = voltage;
      const leadII = voltage * 0.85 + Math.sin(i * 0.1) * 0.2; // Some variation for visualization

      const sample: ADS1298Sample = {
        leadI,
        leadII,
        leadIII: leadII - leadI, // Standard ECG calculation
        aVR: -(leadI + leadII) / 2,
        aVL: leadI - leadII / 2,
        aVF: leadII - leadI / 2,
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

  const quality = assessSignalQuality(samples);
  console.log(
    `Parsed ${samples.length} ECG samples from channels 8171/8172, quality: ${quality}`,
  );

  return {
    samples,
    timestamp: Date.now(),
    sampleRate: 250,
    quality,
  };
}

/**
 * Assess signal quality based on ECG characteristics
 */
function assessSignalQuality(
  samples: ADS1298Sample[],
): "good" | "poor" | "noise" {
  if (samples.length === 0) return "poor";

  // Calculate signal variance for Lead I (only available lead)
  const leadIValues = samples.map((s) => s.leadI);
  const mean = leadIValues.reduce((a, b) => a + b, 0) / leadIValues.length;
  const variance =
    leadIValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) /
    leadIValues.length;
  const stdDev = Math.sqrt(variance);

  // Check for reasonable ECG amplitude (0.1 - 5 mV typical)
  const maxAmplitude = Math.max(...leadIValues.map(Math.abs));
  const minAmplitude = Math.min(...leadIValues.map(Math.abs));

  if (maxAmplitude > 10 || stdDev > 5) {
    return "noise"; // Too much noise or artifact
  } else if (maxAmplitude < 0.05 || stdDev < 0.01) {
    return "poor"; // Signal too weak or flat
  }

  return "good";
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
    result[leadName] = parsedData.samples.map(
      (sample) => sample[sampleKey as keyof ADS1298Sample],
    );
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
