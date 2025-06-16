use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ADS1298Sample {
    pub lead_i: f64,
    pub lead_ii: f64,
    pub lead_iii: f64,
    pub avr: f64,
    pub avl: f64,
    pub avf: f64,
    pub v1: f64,
    pub v2: f64,
    pub v3: f64,
    pub v4: f64,
    pub v5: f64,
    pub v6: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedECGData {
    pub samples: Vec<ADS1298Sample>,
    pub timestamp: u64,
    pub sample_rate: u32,
    pub quality: SignalQuality,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SignalQuality {
    Good,
    Poor,
    Noise,
}

/// Parse 24-bit signed integer from 3 bytes
/// Following the Swift reference pattern for proper sign extension
fn parse_24_bit_signed(byte0: u8, byte1: u8, byte2: u8) -> i32 {
    // Combine bytes: b0 << 16 | b1 << 8 | b2
    let combined = ((byte0 as u32) << 16) | ((byte1 as u32) << 8) | (byte2 as u32);
    
    // Sign extension: shift left 8 bits then arithmetic right shift 8 bits
    let signed_value = ((combined << 8) as i32) >> 8;
    
    signed_value
}

/// Convert raw ADC value to voltage (in mV)
/// ADS1298 has 24-bit resolution with ±2.4V reference
fn adc_to_voltage(adc_value: i32, gain: u32) -> f64 {
    let vref = 2.4; // Reference voltage
    let resolution = 24; // 24-bit ADC
    let max_value = (1_i32 << (resolution - 1)) - 1; // 2^23 - 1
    
    // Convert to voltage and scale to millivolts
    let voltage = ((adc_value as f64 / max_value as f64) * vref * 1000.0) / gain as f64;
    voltage
}

/// Parse single channel ADS1298 ECG data from BLE characteristic
/// Each characteristic (8171-8178) contains 28 samples of 24-bit data for one channel
/// @param raw_data - Array of bytes (should be 84 bytes = 28 samples * 3 bytes each)
/// @param channel_number - Channel number (1-8 corresponding to characteristics 8171-8178)
pub fn parse_ads1298_single_channel(raw_data: &[u8], channel_number: u8) -> Vec<f64> {
    if raw_data.is_empty() {
        tracing::warn!("No data provided for channel {}", channel_number);
        return Vec::new();
    }
    
    // Expected: 28 samples * 3 bytes = 84 bytes
    let expected_bytes = 28 * 3;
    if raw_data.len() != expected_bytes {
        tracing::warn!(
            "Channel {}: Expected {} bytes, got {} bytes",
            channel_number,
            expected_bytes,
            raw_data.len()
        );
    }
    
    let mut samples = Vec::new();
    let sample_count = raw_data.len() / 3;
    
    for i in 0..sample_count {
        let start_index = i * 3;
        if start_index + 2 < raw_data.len() {
            let b0 = raw_data[start_index];
            let b1 = raw_data[start_index + 1];
            let b2 = raw_data[start_index + 2];
            
            // Parse 24-bit signed integer from 3 bytes using proper sign extension
            let signed_value = parse_24_bit_signed(b0, b1, b2);
            
            // Convert raw ADC value to voltage (in mV) for proper ECG display
            let voltage = adc_to_voltage(signed_value, 12); // Use gain of 12 for typical ECG
            
            samples.push(voltage);
        }
    }
    
    samples
}

/// Calculate heart rate from single channel ECG data
pub fn calculate_heart_rate_from_channel(channel_data: &[f64]) -> u32 {
    if channel_data.len() < 2 {
        return 75;
    }
    
    // Find R-peaks (simplified peak detection)
    let mut peaks = Vec::new();
    let max_value = channel_data.iter().fold(f64::NEG_INFINITY, |a, &b| a.max(b));
    let min_value = channel_data.iter().fold(f64::INFINITY, |a, &b| a.min(b));
    let threshold = min_value + (max_value - min_value) * 0.6;
    
    for i in 1..channel_data.len().saturating_sub(1) {
        if channel_data[i] > channel_data[i - 1]
            && channel_data[i] > channel_data[i + 1]
            && channel_data[i] > threshold
        {
            peaks.push(i);
        }
    }
    
    if peaks.len() < 2 {
        return 75;
    }
    
    // Calculate RR intervals
    let mut intervals = Vec::new();
    for i in 1..peaks.len() {
        intervals.push(peaks[i] - peaks[i - 1]);
    }
    
    let avg_interval = intervals.iter().sum::<usize>() as f64 / intervals.len() as f64;
    let sample_rate = 250.0; // ADS1298 sample rate
    let heart_rate = ((60.0 * sample_rate) / avg_interval).round() as u32;
    
    // Clamp to reasonable range
    heart_rate.max(40).min(200)
}

/// Assess signal quality for single channel data
pub fn assess_channel_quality(channel_data: &[f64]) -> SignalQuality {
    if channel_data.is_empty() {
        return SignalQuality::Poor;
    }
    
    let mean = channel_data.iter().sum::<f64>() / channel_data.len() as f64;
    let variance = channel_data.iter()
        .map(|&val| (val - mean).powi(2))
        .sum::<f64>() / channel_data.len() as f64;
    let std_dev = variance.sqrt();
    let max_amplitude = channel_data.iter().map(|&x| x.abs()).fold(0.0, f64::max);
    
    if max_amplitude > 50000.0 || std_dev > 20000.0 {
        SignalQuality::Noise // Too much noise or artifact
    } else if max_amplitude < 1000.0 || std_dev < 100.0 {
        SignalQuality::Poor // Signal too weak or flat
    } else {
        SignalQuality::Good
    }
}

/// Convert channel data to ECG lead format expected by frontend
pub fn convert_to_ecg_format(channel_data: &HashMap<u8, Vec<f64>>) -> HashMap<String, Vec<f64>> {
    let mut result = HashMap::new();
    
    // Map ADS1298 channels to standard ECG leads
    for (&channel_number, samples) in channel_data {
        let lead_name = match channel_number {
            1 => "Lead I",
            2 => "Lead II", 
            3 => "Lead III",
            4 => "aVR",
            5 => "aVL",
            6 => "aVF",
            7 => "V1",
            8 => "V2",
            _ => continue,
        };
        
        result.insert(lead_name.to_string(), samples.clone());
    }
    
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_parse_24_bit_signed() {
        // Test positive number
        let result = parse_24_bit_signed(0x00, 0x12, 0x34);
        assert_eq!(result, 0x1234);
        
        // Test negative number (MSB set indicates negative in two's complement)
        let result = parse_24_bit_signed(0xFF, 0xFF, 0xFF);
        assert_eq!(result, -1);
    }
    
    #[test]
    fn test_adc_to_voltage() {
        let voltage = adc_to_voltage(0x7FFFFF, 12); // Max positive value
        assert!(voltage > 0.0);
        
        let voltage = adc_to_voltage(-0x800000, 12); // Max negative value  
        assert!(voltage < 0.0);
    }
    
    #[test]
    fn test_parse_ads1298_single_channel() {
        // Create test data: 84 bytes (28 samples * 3 bytes each)
        let mut test_data = vec![0u8; 84];
        
        // Fill with some test pattern
        for i in 0..28 {
            let start = i * 3;
            test_data[start] = 0x00;
            test_data[start + 1] = (i as u8) << 4;
            test_data[start + 2] = i as u8;
        }
        
        let samples = parse_ads1298_single_channel(&test_data, 1);
        assert_eq!(samples.len(), 28);
    }
}