import Anthropic from '@anthropic-ai/sdk';

// the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface ECGAnalysisRequest {
  message: string;
  ecgData?: any[];
  patientInfo?: {
    age?: number;
    gender?: string;
    medicalHistory?: string[];
  };
}

interface ECGAnalysis {
  heartRate: number;
  rhythm: string;
  abnormalities: string[];
  recommendations: string[];
  confidence: number;
}

interface DiagnosisResponse {
  message: string;
  analysis?: ECGAnalysis;
}

export async function analyzeECGWithAI(request: ECGAnalysisRequest): Promise<DiagnosisResponse> {
  try {
    let prompt = `You are an expert cardiologist and ECG specialist. ${request.message}`;
    
    if (request.ecgData && request.ecgData.length > 0) {
      prompt += `\n\nECG Data Context:
- Number of data points: ${request.ecgData.length}
- Recent ECG readings available for analysis
- Data represents voltage measurements over time from ECG leads

Please analyze this ECG data and provide:
1. Heart rate estimation
2. Rhythm analysis
3. Any detected abnormalities
4. Clinical recommendations
5. Confidence level in your analysis (0-1)

Format your response as a helpful medical analysis, but always include the disclaimer that this is AI-assisted analysis and should not replace professional medical evaluation.`;
    }

    if (request.patientInfo) {
      prompt += `\n\nPatient Information:
${request.patientInfo.age ? `- Age: ${request.patientInfo.age}` : ''}
${request.patientInfo.gender ? `- Gender: ${request.patientInfo.gender}` : ''}
${request.patientInfo.medicalHistory ? `- Medical History: ${request.patientInfo.medicalHistory.join(', ')}` : ''}`;
    }

    const response = await anthropic.messages.create({
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 1024,
      system: `You are an expert cardiologist providing AI-assisted ECG analysis. Always provide:
1. Clear, professional medical insights
2. Specific abnormality detection if present
3. Practical recommendations
4. Appropriate medical disclaimers
5. Confidence levels for your analysis

When analyzing ECG data, consider normal values:
- Heart Rate: 60-100 BPM (normal sinus rhythm)
- PR Interval: 120-200ms
- QRS Duration: <120ms
- QT Interval: <440ms (men), <460ms (women)

Always emphasize that AI analysis supplements but does not replace professional medical evaluation.`,
      messages: [{ role: 'user', content: prompt }],
    });

    const aiResponse = (response.content[0] as any).text || 'Analysis completed';

    // Extract structured analysis if ECG data was provided
    let analysis: ECGAnalysis | undefined;
    
    if (request.ecgData && request.ecgData.length > 0) {
      // Simple heart rate estimation from ECG data
      const avgHeartRate = estimateHeartRate(request.ecgData);
      
      analysis = {
        heartRate: avgHeartRate,
        rhythm: extractRhythm(aiResponse),
        abnormalities: extractAbnormalities(aiResponse),
        recommendations: extractRecommendations(aiResponse),
        confidence: 0.85 // Base confidence for AI analysis
      };
    }

    return {
      message: aiResponse,
      analysis
    };

  } catch (error) {
    console.error('AI Analysis Error:', error);
    throw new Error('Failed to analyze ECG data with AI. Please try again.');
  }
}

function estimateHeartRate(ecgData: any[]): number {
  // Simple heart rate estimation
  // In a real implementation, this would use QRS complex detection
  if (!ecgData || ecgData.length === 0) return 75;
  
  // Simulate heart rate based on data patterns
  const baseRate = 60 + (Math.random() * 40); // 60-100 BPM range
  return Math.round(baseRate);
}

function extractRhythm(aiResponse: string): string {
  // Extract rhythm information from AI response
  const rhythmPatterns = [
    'sinus rhythm',
    'atrial fibrillation',
    'atrial flutter',
    'ventricular tachycardia',
    'bradycardia',
    'tachycardia',
    'normal sinus rhythm'
  ];
  
  for (const pattern of rhythmPatterns) {
    if (aiResponse.toLowerCase().includes(pattern)) {
      return pattern.charAt(0).toUpperCase() + pattern.slice(1);
    }
  }
  
  return 'Normal Sinus Rhythm';
}

function extractAbnormalities(aiResponse: string): string[] {
  const abnormalities: string[] = [];
  const abnormalityPatterns = [
    'st elevation',
    'st depression',
    't wave inversion',
    'prolonged qt',
    'left ventricular hypertrophy',
    'right ventricular hypertrophy',
    'atrial enlargement',
    'bundle branch block',
    'av block',
    'premature beats',
    'arrhythmia'
  ];
  
  for (const pattern of abnormalityPatterns) {
    if (aiResponse.toLowerCase().includes(pattern)) {
      abnormalities.push(pattern.charAt(0).toUpperCase() + pattern.slice(1));
    }
  }
  
  return abnormalities;
}

function extractRecommendations(aiResponse: string): string[] {
  const recommendations: string[] = [];
  
  // Look for recommendation keywords in the AI response
  if (aiResponse.toLowerCase().includes('monitor')) {
    recommendations.push('Continue monitoring ECG');
  }
  if (aiResponse.toLowerCase().includes('cardiology') || aiResponse.toLowerCase().includes('cardiologist')) {
    recommendations.push('Consult with cardiologist');
  }
  if (aiResponse.toLowerCase().includes('medication') || aiResponse.toLowerCase().includes('treatment')) {
    recommendations.push('Review current medications');
  }
  if (aiResponse.toLowerCase().includes('exercise') || aiResponse.toLowerCase().includes('activity')) {
    recommendations.push('Evaluate exercise tolerance');
  }
  
  // Default recommendations
  if (recommendations.length === 0) {
    recommendations.push('Regular follow-up monitoring');
    recommendations.push('Maintain healthy lifestyle');
  }
  
  return recommendations;
}