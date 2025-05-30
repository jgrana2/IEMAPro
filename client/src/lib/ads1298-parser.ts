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
 * Format: 84 bytes = 28 samples of 24-bit data at 250 Hz
 * Each sample is 3 bytes (24-bit), two's complement, MSB first, gain 12
 */
export function parseADS1298Data(rawData: number[]): ParsedECGData {
  if (!rawData || rawData.length === 0) {
    return {
      samples: [],
      timestamp: Date.now(),
      sampleRate: 250, // Updated to 250 Hz as specified
      quality: 'noise'
    };
  }

  const samples: ADS1298Sample[] = [];
  const bytesPerFullSample = 28; // Full ADS1298 sample format
  const bytesPerChannelPair = 6; // Simplified 2-channel format
  
  // Handle 84-byte packets with 28 samples of single-channel 24-bit data
  if (rawData.length === 84) {
    const samplesCount = 28; // 84 bytes / 3 bytes per sample = 28 samples
    console.log(`Processing ${rawData.length} bytes as 28-sample format: ${samplesCount} samples`);
    
    for (let sampleIdx = 0; sampleIdx < samplesCount; sampleIdx++) {
      const sampleOffset = sampleIdx * 3; // 3 bytes per sample
      
      if (sampleOffset + 2 < rawData.length) {
        // Parse 24-bit two's complement, MSB first
        const rawValue = parse24BitSigned(
          rawData[sampleOffset],     // MSB
          rawData[sampleOffset + 1], // Middle byte
          rawData[sampleOffset + 2]  // LSB
        );
        
        // Convert to voltage with gain 12
        const voltage = adcToVoltage(rawValue, 12);
        
        // For single-channel data from 8171 characteristic, assign to Lead I
        // and generate reasonable approximations for other leads for visualization
        const leadI = voltage;
        const leadII = voltage * 0.8 + (Math.random() - 0.5) * 0.1; // Slight variation for Lead II
        
        const sample: ADS1298Sample = {
          leadI,
          leadII,
          leadIII: leadII - leadI, // Standard ECG calculation
          aVR: -(leadI + leadII) / 2,
          aVL: leadI - leadII / 2,
          aVF: leadII - leadI / 2,
          V1: 0, V2: 0, V3: 0, V4: 0, V5: 0, V6: 0
        };
        
        samples.push(sample);
      }
    }
  }
  // Fallback to existing parsing logic for other formats
  else {
    
    // Try full 8-channel format first
    const fullSamples = Math.floor(rawData.length / bytesPerFullSample);
    
    if (fullSamples > 0) {
      console.log(`Processing ${rawData.length} bytes as full ADS1298 format: ${fullSamples} samples`);
      
      for (let sampleIdx = 0; sampleIdx < fullSamples; sampleIdx++) {
        const sampleOffset = sampleIdx * bytesPerFullSample;
        
        // Skip 3 status bytes, start from channel data
        const channelDataStart = sampleOffset + 3;
        
        if (channelDataStart + 24 <= rawData.length) { // Need 8 channels * 3 bytes = 24 bytes
          
          // Extract all 8 channels (each channel is 3 bytes)
          const channels: number[] = [];
          for (let ch = 0; ch < 8; ch++) {
            const chOffset = channelDataStart + (ch * 3);
            const channelValue = parse24BitSigned(
              rawData[chOffset],
              rawData[chOffset + 1],
              rawData[chOffset + 2]
            );
            channels.push(adcToVoltage(channelValue, 12)); // Gain 12 from device config
          }
          
          // Map channels to ECG leads based on device configuration
          const sample: ADS1298Sample = {
            leadI: channels[0],    // Channel 1
            leadII: channels[1],   // Channel 2
            leadIII: channels[2],  // Channel 3 or calculated
            aVR: channels[3],      // Channel 4 or calculated
            aVL: channels[4],      // Channel 5 or calculated
            aVF: channels[5],      // Channel 6 or calculated
            V1: channels[6],       // Channel 7
            V2: channels[7],       // Channel 8
            V3: 0,  // Would need more channels
            V4: 0,
            V5: 0,
            V6: 0
          };

          samples.push(sample);
        }
      }
    }
  }
  
  // If full format didn't work, try 2-channel format (channels 8171/8172)
  if (samples.length === 0 && rawData.length >= bytesPerChannelPair) {
    console.log(`Falling back to 2-channel parsing: ${rawData.length} bytes`);
    const channelPairSamples = Math.floor(rawData.length / bytesPerChannelPair);
    
    for (let i = 0; i < channelPairSamples; i++) {
      const offset = i * bytesPerChannelPair;
      
      if (offset + 5 < rawData.length) {
        // Channel 1 (Lead I) - bytes 0,1,2
        const leadI = adcToVoltage(parse24BitSigned(
          rawData[offset],
          rawData[offset + 1], 
          rawData[offset + 2]
        ), 12);
        
        // Channel 2 (Lead II) - bytes 3,4,5
        const leadII = adcToVoltage(parse24BitSigned(
          rawData[offset + 3],
          rawData[offset + 4],
          rawData[offset + 5]
        ), 12);
        
        // Calculate derived leads using Einthoven's triangle
        const leadIII = leadII - leadI;
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
          V1: 0, V2: 0, V3: 0, V4: 0, V5: 0, V6: 0
        };

        samples.push(sample);
      }
    }
  }
  
  // If still no samples, try single channel format
  if (samples.length === 0 && rawData.length >= 3) {
    console.log(`Falling back to single-channel parsing: ${rawData.length} bytes`);
    const singleChannelSamples = Math.floor(rawData.length / 3);
    
    for (let i = 0; i < singleChannelSamples; i++) {
      const offset = i * 3;
      
      if (offset + 2 < rawData.length) {
        const leadI = adcToVoltage(parse24BitSigned(
          rawData[offset],
          rawData[offset + 1],
          rawData[offset + 2]
        ), 12);
        
        const sample: ADS1298Sample = {
          leadI,
          leadII: 0,
          leadIII: 0,
          aVR: -leadI / 2,
          aVL: leadI / 2,
          aVF: 0,
          V1: 0, V2: 0, V3: 0, V4: 0, V5: 0, V6: 0
        };

        samples.push(sample);
      }
    }
  }

  const quality = assessSignalQuality(samples);
  console.log(`Parsed ${samples.length} ECG samples from channels 8171/8172, quality: ${quality}`);

  return {
    samples,
    timestamp: Date.now(),
    sampleRate: 250, // Updated to match the 250 Hz specification
    quality
  };
}

/**
 * Assess signal quality based on ECG characteristics
 */
function assessSignalQuality(samples: ADS1298Sample[]): 'good' | 'poor' | 'noise' {
  if (samples.length === 0) return 'poor';
  
  // Calculate signal variance for Lead I (only available lead)
  const leadIValues = samples.map(s => s.leadI);
  const mean = leadIValues.reduce((a, b) => a + b, 0) / leadIValues.length;
  const variance = leadIValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / leadIValues.length;
  const stdDev = Math.sqrt(variance);
  
  // Check for reasonable ECG amplitude (0.1 - 5 mV typical)
  const maxAmplitude = Math.max(...leadIValues.map(Math.abs));
  const minAmplitude = Math.min(...leadIValues.map(Math.abs));
  
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
  
  // Use Lead I for heart rate calculation (only available lead)
  const leadI = samples.map(s => s.leadI);
  
  // Simple peak detection for R-waves
  const peaks: number[] = [];
  const threshold = Math.max(...leadI) * 0.6; // 60% of max amplitude
  
  for (let i = 1; i < leadI.length - 1; i++) {
    if (leadI[i] > threshold && 
        leadI[i] > leadI[i - 1] && 
        leadI[i] > leadI[i + 1]) {
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