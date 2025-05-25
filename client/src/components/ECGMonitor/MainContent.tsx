import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Square, FileText, Download } from "lucide-react";
import { ECGCarousel } from "./ECGCarousel";
import { useQuery } from "@tanstack/react-query";
import { generateECGReport, downloadPDF } from "@/lib/pdf-generator";
import { useToast } from "@/hooks/use-toast";
import { generateSimulatedECGData, ECGData } from "@/lib/ecg-utils";

interface MainContentProps {
  currentPatient: any;
  currentSession: any;
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  bleStatus: string;
  wsStatus: string;
}

const ECG_LEADS = [
  { name: "Lead I", voltage: "1.2mV" },
  { name: "Lead II", voltage: "0.8mV" },
  { name: "Lead III", voltage: "1.0mV" },
  { name: "aVR", voltage: "-0.6mV" },
  { name: "aVL", voltage: "0.9mV" },
  { name: "aVF", voltage: "1.1mV" },
  { name: "V1", voltage: "0.7mV" },
  { name: "V2", voltage: "1.3mV" },
  { name: "V3", voltage: "1.0mV" },
  { name: "V4", voltage: "1.1mV" },
  { name: "V5", voltage: "0.9mV" },
  { name: "V6", voltage: "0.8mV" },
];

export function MainContent({
  currentPatient,
  currentSession,
  isRecording,
  onStartRecording,
  onStopRecording,
  bleStatus,
  wsStatus,
}: MainContentProps) {
  const [heartRate, setHeartRate] = useState(72);
  const [ecgData, setEcgData] = useState<{ [key: string]: number[] }>({});
  const [ecgHistory, setEcgHistory] = useState<ECGData[]>([]);
  const { toast } = useToast();

  const { data: systemLogs = [] } = useQuery({
    queryKey: ["/api/system-logs"],
    refetchInterval: 2000, // Refresh logs every 2 seconds
  });

  // Simulate heart rate variations
  useEffect(() => {
    const interval = setInterval(() => {
      setHeartRate((prev) => {
        const variation = Math.floor(Math.random() * 6) - 3; // ±3 BPM
        return Math.max(60, Math.min(100, prev + variation));
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // Generate ECG data and store history for reports
  useEffect(() => {
    const generateECGData = () => {
      const timestamp = Date.now();
      const newData: { [key: string]: number[] } = {};
      const leadsData: { [leadName: string]: number } = {};

      ECG_LEADS.forEach((lead, index) => {
        const data = [];
        const beatInterval = 150; // Points between beats (adjust for heart rate)
        
        for (let i = 0; i < 500; i++) {
          let value = 0;
          const beatPosition = i % beatInterval;
          
          // P wave (10-20 points)
          if (beatPosition >= 10 && beatPosition <= 20) {
            const pPhase = (beatPosition - 10) / 10 * Math.PI;
            value = 0.15 * Math.sin(pPhase) * (0.8 + index * 0.1);
          }
          // PR segment (flat)
          else if (beatPosition > 20 && beatPosition < 40) {
            value = (Math.random() - 0.5) * 0.02;
          }
          // QRS complex (40-50 points) - main spike
          else if (beatPosition >= 40 && beatPosition <= 50) {
            const qrsPhase = (beatPosition - 40) / 10;
            if (qrsPhase < 0.3) {
              // Q wave (small negative)
              value = -0.1 * Math.sin(qrsPhase * Math.PI / 0.3);
            } else if (qrsPhase < 0.7) {
              // R wave (large positive)
              value = 1.2 * Math.sin((qrsPhase - 0.3) * Math.PI / 0.4) * (0.8 + index * 0.2);
            } else {
              // S wave (negative)
              value = -0.3 * Math.sin((qrsPhase - 0.7) * Math.PI / 0.3);
            }
          }
          // ST segment (flat)
          else if (beatPosition > 50 && beatPosition < 80) {
            value = (Math.random() - 0.5) * 0.02;
          }
          // T wave (80-120 points)
          else if (beatPosition >= 80 && beatPosition <= 120) {
            const tPhase = (beatPosition - 80) / 40 * Math.PI;
            value = 0.3 * Math.sin(tPhase) * (0.9 + index * 0.1);
          }
          // Baseline with minimal noise
          else {
            value = (Math.random() - 0.5) * 0.01;
          }

          data.push(value);
        }
        newData[lead.name] = data;
        leadsData[lead.name] = generateSimulatedECGData(lead.name, timestamp);
      });

      setEcgData(newData);

      // Store ECG data point for history
      if (isRecording) {
        const ecgDataPoint: ECGData = {
          timestamp,
          leads: leadsData,
          heartRate,
          quality: "good",
        };
        setEcgHistory((prev) => [...prev.slice(-999), ecgDataPoint]); // Keep last 1000 points
      }
    };

    generateECGData();
    const interval = setInterval(generateECGData, 100); // Update every 100ms

    return () => clearInterval(interval);
  }, [heartRate, isRecording]);

  const handleGeneratePDF = async () => {
    if (!currentPatient) {
      toast({
        title: "No Patient Selected",
        description: "Please select a patient before generating a PDF report.",
        variant: "destructive",
      });
      return;
    }

    try {
      const sessionInfo = {
        sessionId: currentSession?.sessionId || `SESSION-${Date.now()}`,
        startTime: new Date(),
        endTime: new Date(),
        duration: Math.floor(ecgHistory.length * 0.1), // Approximate duration in seconds
        heartRate: heartRate,
      };

      const pdfBlob = await generateECGReport(
        currentPatient,
        sessionInfo,
        ecgHistory,
      );
      const filename = `ECG_Report_${currentPatient.name.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`;

      await downloadPDF(pdfBlob, filename);

      toast({
        title: "PDF Generated",
        description: `ECG report for ${currentPatient.name} has been downloaded.`,
      });
    } catch (error) {
      console.error("PDF generation error:", error);
      toast({
        title: "PDF Generation Failed",
        description: "Failed to generate PDF report. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case "error":
        return "text-red-500";
      case "warning":
        return "text-yellow-500";
      case "info":
        return "text-green-500";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <main className="h-full flex flex-col bg-muted/20">
      <div className="flex-1 p-6">
        {/* ECG Header */}
        <div className="mb-6">
          <div className="flex flex-col items-center justify-between">
            <div className="text-center">
              <h2 className="text-lg font-semibold text-foreground">
                12-Lead ECG Monitoring
              </h2>
              <p className="text-sm text-muted-foreground">
                {currentPatient
                  ? `Patient: ${currentPatient.name} (ID: ${currentPatient.patientId})`
                  : "No patient selected"}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row justify-between w-full items-center">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Heart Rate</p>
                <p className="text-2xl font-bold text-red-500">
                  {heartRate} BPM
                </p>
              </div>
              <div className="flex">
                {!isRecording ? (
                  <Button
                    onClick={onStartRecording}
                    className="bg-green-600 hover:bg-green-700"
                    disabled={!currentPatient || bleStatus !== "connected"}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Start Recording
                  </Button>
                ) : (
                  <Button onClick={onStopRecording} variant="destructive">
                    <Square className="h-4 w-4 mr-2" />
                    Stop Recording
                  </Button>
                )}
                {isRecording && (
                  <Badge variant="destructive" className="animate-pulse">
                    Recording
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ECG Carousel */}
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">12-Lead ECG Display</CardTitle>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGeneratePDF}
                  disabled={!currentPatient}
                  className="flex items-center space-x-2"
                >
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Generate PDF Report</span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <ECGCarousel
              leads={ECG_LEADS.map((lead) => ({
                ...lead,
                data: ecgData[lead.name] || [],
              }))}
              isActive={bleStatus === "connected"}
            />
          </CardContent>
        </Card>
      </div>

      {/* System Logs */}
      <div className="border-t border-border bg-card">
        <div className="p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            System Messages
          </h3>
          <ScrollArea className="h-24">
            <div className="space-y-1">
              {systemLogs.slice(0, 10).map((log: any) => (
                <div
                  key={log.id}
                  className="text-xs font-mono flex items-center space-x-2"
                >
                  <span className="text-muted-foreground">
                    [{new Date(log.timestamp).toLocaleTimeString()}]
                  </span>
                  <span className={getLogLevelColor(log.level)}>
                    {log.message}
                  </span>
                </div>
              ))}
              {systemLogs.length === 0 && (
                <div className="text-xs text-muted-foreground font-mono">
                  No system messages available.
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </main>
  );
}
