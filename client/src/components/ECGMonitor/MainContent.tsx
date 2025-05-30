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
import { useWebSocket } from "@/hooks/useWebSocket";

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
  const [ecgHistory, setEcgHistory] = useState<ECGData[]>([]);
  const { toast } = useToast();
  
  // Use WebSocket hook to get real ADS1298 ECG data
  const { ecgData, heartRate, signalQuality, sendADS1298Data } = useWebSocket();

  const { data: systemLogs = [] } = useQuery({
    queryKey: ["/api/system-logs"],
    refetchInterval: 2000, // Refresh logs every 2 seconds
  });

  // Heart rate now comes from real ADS1298 data via WebSocket

  // Store ECG data for history when recording with real ADS1298 data
  useEffect(() => {
    if (isRecording && Object.keys(ecgData).length > 0) {
      const timestamp = Date.now();
      const leadsData: { [leadName: string]: number } = {};
      
      // Convert current ECG data to single values for history
      Object.entries(ecgData).forEach(([leadName, dataArray]) => {
        leadsData[leadName] = dataArray[dataArray.length - 1] || 0;
      });

      const ecgDataPoint: ECGData = {
        timestamp,
        leads: leadsData,
        heartRate,
        quality: signalQuality,
      };
      
      setEcgHistory((prev) => [...prev.slice(-999), ecgDataPoint]);
    }
  }, [isRecording, ecgData, heartRate, signalQuality]);

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
    <main className="h-fit flex flex-col bg-muted/20">
      <div className="flex-1 py-2">
        {/* ECG Carousel with Combined Header */}
        <Card className="mb-0">
          <CardHeader className="pb-4">
            <div className="space-y-4">
              {/* Main Header Row */}
              <div className="flex flex-col lg:flex-row items-center justify-between gap-4 text-center sm:text-left">
                <div className="flex-1">
                  <CardTitle className="text-lg mb-1">
                    12-Lead ECG Monitoring
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {currentPatient
                      ? `Patient: ${currentPatient.name} (ID: ${currentPatient.patientId})`
                      : "No patient selected"}
                  </p>
                </div>

                {/* Controls Row */}
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {/* Heart Rate Display */}
                  <div className="text-center sm:text-right">
                    <p className="text-xs text-muted-foreground">Heart Rate</p>
                    <p className="text-2xl font-bold text-red-500">
                      {heartRate} BPM
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
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
                      <>
                        <Button onClick={onStopRecording} variant="destructive">
                          <Square className="h-4 w-4 mr-2" />
                          Stop Recording
                        </Button>
                        <Badge variant="destructive" className="animate-pulse">
                          Recording
                        </Badge>
                      </>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGeneratePDF}
                      disabled={!currentPatient}
                      className="flex items-center space-x-2"
                    >
                      <FileText className="h-4 w-4" />
                      <span className="hidden sm:inline">
                        Generate PDF Report
                      </span>
                    </Button>
                  </div>
                </div>
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
      <div className="border border-border bg-card">
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
