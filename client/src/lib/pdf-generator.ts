import jsPDF from 'jspdf';
import { ECGData } from './ecg-utils';

interface PatientInfo {
  name: string;
  patientId: string;
  dateOfBirth?: string;
  gender?: string;
}

interface SessionInfo {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  heartRate?: number;
}

export async function generateECGReport(
  patient: PatientInfo,
  session: SessionInfo,
  ecgData: ECGData[]
): Promise<Blob> {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  
  // Header
  pdf.setFontSize(20);
  pdf.text('ECG Report', pageWidth / 2, 20, { align: 'center' });
  
  // Patient Information
  pdf.setFontSize(12);
  let yPos = 40;
  
  pdf.text('Patient Information:', 20, yPos);
  yPos += 10;
  pdf.text(`Name: ${patient.name}`, 30, yPos);
  yPos += 7;
  pdf.text(`Patient ID: ${patient.patientId}`, 30, yPos);
  yPos += 7;
  
  if (patient.dateOfBirth) {
    pdf.text(`Date of Birth: ${patient.dateOfBirth}`, 30, yPos);
    yPos += 7;
  }
  
  if (patient.gender) {
    pdf.text(`Gender: ${patient.gender}`, 30, yPos);
    yPos += 7;
  }
  
  yPos += 10;
  
  // Session Information
  pdf.text('Session Information:', 20, yPos);
  yPos += 10;
  pdf.text(`Session ID: ${session.sessionId}`, 30, yPos);
  yPos += 7;
  pdf.text(`Start Time: ${session.startTime.toLocaleString()}`, 30, yPos);
  yPos += 7;
  
  if (session.endTime) {
    pdf.text(`End Time: ${session.endTime.toLocaleString()}`, 30, yPos);
    yPos += 7;
  }
  
  if (session.duration) {
    const duration = formatDuration(session.duration);
    pdf.text(`Duration: ${duration}`, 30, yPos);
    yPos += 7;
  }
  
  if (session.heartRate) {
    pdf.text(`Average Heart Rate: ${session.heartRate} BPM`, 30, yPos);
    yPos += 7;
  }
  
  yPos += 15;
  
  // ECG Analysis Summary
  pdf.text('ECG Analysis Summary:', 20, yPos);
  yPos += 10;
  
  if (ecgData.length > 0) {
    const avgHeartRate = calculateAverageHeartRate(ecgData);
    const minHeartRate = Math.min(...ecgData.map(d => d.heartRate));
    const maxHeartRate = Math.max(...ecgData.map(d => d.heartRate));
    
    pdf.text(`Average Heart Rate: ${avgHeartRate} BPM`, 30, yPos);
    yPos += 7;
    pdf.text(`Heart Rate Range: ${minHeartRate} - ${maxHeartRate} BPM`, 30, yPos);
    yPos += 7;
    pdf.text(`Total Data Points: ${ecgData.length}`, 30, yPos);
    yPos += 7;
    
    // Quality assessment
    const poorQualityCount = ecgData.filter(d => d.quality === 'poor').length;
    const qualityPercentage = ((ecgData.length - poorQualityCount) / ecgData.length * 100).toFixed(1);
    pdf.text(`Signal Quality: ${qualityPercentage}% good`, 30, yPos);
    yPos += 15;
  }
  
  // ECG Strips (simplified representation)
  pdf.text('ECG Lead Summary:', 20, yPos);
  yPos += 10;
  
  const leadNames = ['Lead I', 'Lead II', 'Lead III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'];
  const leadsPerRow = 3;
  const stripWidth = (pageWidth - 40) / leadsPerRow - 10;
  const stripHeight = 20;
  
  for (let i = 0; i < leadNames.length; i++) {
    const row = Math.floor(i / leadsPerRow);
    const col = i % leadsPerRow;
    const x = 20 + col * (stripWidth + 10);
    const y = yPos + row * (stripHeight + 15);
    
    // Lead label
    pdf.setFontSize(10);
    pdf.text(leadNames[i], x, y);
    
    // Draw simplified ECG strip
    drawECGStrip(pdf, x, y + 5, stripWidth, stripHeight, ecgData, leadNames[i]);
  }
  
  // Footer
  const footerY = pageHeight - 20;
  pdf.setFontSize(8);
  pdf.text(`Report generated on ${new Date().toLocaleString()}`, 20, footerY);
  pdf.text('ECG Pro - Medical Grade ECG Analysis System', pageWidth - 20, footerY, { align: 'right' });
  
  return pdf.output('blob');
}

function drawECGStrip(
  pdf: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  ecgData: ECGData[],
  leadName: string
) {
  // Draw border
  pdf.rect(x, y, width, height);
  
  if (ecgData.length === 0) return;
  
  // Sample data for the strip (take every nth point to fit in width)
  const sampleSize = Math.min(width * 2, ecgData.length);
  const step = Math.max(1, Math.floor(ecgData.length / sampleSize));
  const sampledData = [];
  
  for (let i = 0; i < ecgData.length; i += step) {
    if (sampledData.length >= sampleSize) break;
    sampledData.push(ecgData[i]);
  }
  
  // Draw ECG waveform
  pdf.setLineWidth(0.5);
  pdf.setDrawColor(0, 150, 0); // Green color for ECG
  
  if (sampledData.length > 1) {
    const xStep = width / sampledData.length;
    let prevX = x;
    let prevY = y + height / 2; // Start at center
    
    for (let i = 0; i < sampledData.length; i++) {
      const dataPoint = sampledData[i];
      const leadValue = dataPoint.leads[leadName] || 0;
      
      const currentX = x + i * xStep;
      const currentY = y + height / 2 - (leadValue * height * 0.3); // Scale and invert
      
      if (i > 0) {
        pdf.line(prevX, prevY, currentX, currentY);
      }
      
      prevX = currentX;
      prevY = currentY;
    }
  }
  
  pdf.setDrawColor(0, 0, 0); // Reset to black
  pdf.setLineWidth(0.2); // Reset line width
}

function calculateAverageHeartRate(ecgData: ECGData[]): number {
  if (ecgData.length === 0) return 0;
  const sum = ecgData.reduce((acc, data) => acc + data.heartRate, 0);
  return Math.round(sum / ecgData.length);
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

export async function downloadPDF(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
