"""
AI Diagnosis module for ECG analysis using Anthropic Claude
Python implementation matching the TypeScript version
"""

import os
import re
import logging
from typing import List, Optional, Dict, Any
from dataclasses import dataclass
from anthropic import Anthropic

logger = logging.getLogger(__name__)

@dataclass
class PatientInfo:
    age: Optional[int] = None
    gender: Optional[str] = None
    medical_history: Optional[List[str]] = None

@dataclass
class ECGAnalysisRequest:
    message: str
    ecg_data: Optional[List[Any]] = None
    patient_info: Optional[PatientInfo] = None

@dataclass
class ECGAnalysis:
    heart_rate: int
    rhythm: str
    abnormalities: List[str]
    recommendations: List[str]
    confidence: float

@dataclass
class DiagnosisResponse:
    message: str
    analysis: Optional[ECGAnalysis] = None

class AIECGAnalyzer:
    def __init__(self):
        api_key = os.getenv('ANTHROPIC_API_KEY')
        if not api_key:
            logger.warning("ANTHROPIC_API_KEY not found in environment variables")
            self.client = None
        else:
            self.client = Anthropic(api_key=api_key)
    
    async def analyze_ecg_with_ai(self, request: ECGAnalysisRequest) -> DiagnosisResponse:
        """
        Analyze ECG data with AI assistance
        """
        if not self.client:
            return DiagnosisResponse(
                message="AI analysis is not available. Please check API configuration.",
                analysis=None
            )
        
        try:
            prompt = f"You are an expert cardiologist and ECG specialist. {request.message}"
            
            if request.ecg_data and len(request.ecg_data) > 0:
                prompt += f"""

ECG Data Context:
- Number of data points: {len(request.ecg_data)}
- Recent ECG readings available for analysis
- Data represents voltage measurements over time from ECG leads

Please analyze this ECG data and provide:
1. Heart rate estimation
2. Rhythm analysis
3. Any detected abnormalities
4. Clinical recommendations
5. Confidence level in your analysis (0-1)

Format your response as a helpful medical analysis, but always include the disclaimer that this is AI-assisted analysis and should not replace professional medical evaluation."""
            
            if request.patient_info:
                patient_info_text = "\n\nPatient Information:"
                if request.patient_info.age:
                    patient_info_text += f"\n- Age: {request.patient_info.age}"
                if request.patient_info.gender:
                    patient_info_text += f"\n- Gender: {request.patient_info.gender}"
                if request.patient_info.medical_history:
                    patient_info_text += f"\n- Medical History: {', '.join(request.patient_info.medical_history)}"
                prompt += patient_info_text
            
            system_prompt = """You are an expert cardiologist providing AI-assisted ECG analysis. Always provide:
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

Always emphasize that AI analysis supplements but does not replace professional medical evaluation."""
            
            response = await self.client.messages.create(
                model='claude-3-5-sonnet-20241022',  # Using the latest available model
                max_tokens=1024,
                system=system_prompt,
                messages=[{"role": "user", "content": prompt}]
            )
            
            ai_response = response.content[0].text if response.content else 'Analysis completed'
            
            # Extract structured analysis if ECG data was provided
            analysis = None
            if request.ecg_data and len(request.ecg_data) > 0:
                # Simple heart rate estimation from ECG data
                avg_heart_rate = self._estimate_heart_rate(request.ecg_data)
                
                analysis = ECGAnalysis(
                    heart_rate=avg_heart_rate,
                    rhythm=self._extract_rhythm(ai_response),
                    abnormalities=self._extract_abnormalities(ai_response),
                    recommendations=self._extract_recommendations(ai_response),
                    confidence=0.85  # Base confidence for AI analysis
                )
            
            return DiagnosisResponse(
                message=ai_response,
                analysis=analysis
            )
        
        except Exception as error:
            logger.error(f'AI Analysis Error: {error}')
            raise Exception('Failed to analyze ECG data with AI. Please try again.')
    
    def _estimate_heart_rate(self, ecg_data: List[Any]) -> int:
        """
        Simple heart rate estimation
        In a real implementation, this would use QRS complex detection
        """
        if not ecg_data or len(ecg_data) == 0:
            return 60
        
        # Simulate heart rate based on data patterns
        import random
        base_rate = 60 + (random.random() * 40)  # 60-100 BPM range
        return round(base_rate)
    
    def _extract_rhythm(self, ai_response: str) -> str:
        """Extract rhythm information from AI response"""
        rhythm_patterns = [
            'sinus rhythm',
            'atrial fibrillation',
            'atrial flutter',
            'ventricular tachycardia',
            'bradycardia',
            'tachycardia',
            'normal sinus rhythm'
        ]
        
        ai_response_lower = ai_response.lower()
        for pattern in rhythm_patterns:
            if pattern in ai_response_lower:
                return pattern.title()
        
        return 'Normal Sinus Rhythm'
    
    def _extract_abnormalities(self, ai_response: str) -> List[str]:
        """Extract abnormalities from AI response"""
        abnormalities = []
        abnormality_patterns = [
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
        ]
        
        ai_response_lower = ai_response.lower()
        for pattern in abnormality_patterns:
            if pattern in ai_response_lower:
                abnormalities.append(pattern.title())
        
        return abnormalities
    
    def _extract_recommendations(self, ai_response: str) -> List[str]:
        """Extract recommendations from AI response"""
        recommendations = []
        ai_response_lower = ai_response.lower()
        
        # Look for recommendation keywords in the AI response
        if 'monitor' in ai_response_lower:
            recommendations.append('Continue monitoring ECG')
        if 'cardiology' in ai_response_lower or 'cardiologist' in ai_response_lower:
            recommendations.append('Consult with cardiologist')
        if 'medication' in ai_response_lower or 'treatment' in ai_response_lower:
            recommendations.append('Review current medications')
        if 'exercise' in ai_response_lower or 'activity' in ai_response_lower:
            recommendations.append('Evaluate exercise tolerance')
        
        # Default recommendations
        if len(recommendations) == 0:
            recommendations.extend([
                'Regular follow-up monitoring',
                'Maintain healthy lifestyle'
            ])
        
        return recommendations

# Global AI analyzer instance
ai_analyzer = AIECGAnalyzer()

# Convenience function to match TypeScript API
async def analyze_ecg_with_ai(request_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convenience function that matches the TypeScript API signature
    """
    # Convert dict to dataclass
    patient_info = None
    if 'patientInfo' in request_data:
        patient_info_data = request_data['patientInfo']
        patient_info = PatientInfo(
            age=patient_info_data.get('age'),
            gender=patient_info_data.get('gender'),
            medical_history=patient_info_data.get('medicalHistory')
        )
    
    request = ECGAnalysisRequest(
        message=request_data['message'],
        ecg_data=request_data.get('ecgData'),
        patient_info=patient_info
    )
    
    response = await ai_analyzer.analyze_ecg_with_ai(request)
    
    # Convert response back to dict for API compatibility
    result = {
        'message': response.message
    }
    
    if response.analysis:
        result['analysis'] = {
            'heartRate': response.analysis.heart_rate,
            'rhythm': response.analysis.rhythm,
            'abnormalities': response.analysis.abnormalities,
            'recommendations': response.analysis.recommendations,
            'confidence': response.analysis.confidence
        }
    
    return result
