import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  Pause,
  Square,
  FileText,
  Download,
  Activity,
} from "lucide-react";
import { ECGCarousel } from "./ECGCarousel";
import { ADS1298TestPanel } from "./ADS1298TestPanel";
import { useQuery } from "@tanstack/react-query";
import { generateECGReport, downloadPDF } from "@/lib/pdf-generator";
import { useToast } from "@/hooks/use-toast";
import { generateSimulatedECGData, ECGData } from "@/lib/ecg-utils";
import { useWebSocketContext } from "@/contexts/WebSocketContext";

interface MainContentProps {
  currentPatient: any;
  currentSession: any;
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  bleStatus: string;
  wsStatus: string;
  ecgData?: { [leadName: string]: number[] };
  heartRate?: number;
  signalQuality?: "good" | "poor" | "noise";
  onTestData?: (
    leadData: { [leadName: string]: number[] },
    hr: number,
    quality: string,
  ) => void;
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
  ecgData = {},
  heartRate = 0,
  signalQuality = "poor",
  onTestData,
}: MainContentProps) {
  const [ecgHistory, setEcgHistory] = useState<ECGData[]>([]);
  const { toast } = useToast();

  // Get WebSocket functions for sending data (if needed)
  const { sendADS1298Data } = useWebSocketContext();

  const { data: systemLogs = [] } = useQuery({
    queryKey: ["/api/system-logs"],
    refetchInterval: 2000, // Refresh logs every 2 seconds
  });

  const typedSystemLogs = systemLogs as any[];

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
        return "text-foreground font-semibold";
      case "warning":
        return "text-muted-foreground font-medium";
      case "info":
        return "text-muted-foreground";
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
                <div className="flex-1 text-center sm:text-left">
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
                    <p className="text-2xl font-bold text-foreground">
                      {heartRate} BPM
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {!isRecording ? (
                      <Button
                        onClick={onStartRecording}
                        className="bg-primary text-background"
                        disabled={!currentPatient || bleStatus !== "connected"}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Start Recording
                      </Button>
                    ) : (
                      <>
                        <Button
                          onClick={onStopRecording}
                          className="bg-muted-foreground hover:bg-muted-foreground/80 text-background"
                        >
                          <Square className="h-4 w-4 mr-2" />
                          Stop Recording
                        </Button>
                        <Badge className="animate-pulse bg-muted-foreground text-background">
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

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const testData = [
                          249, 245, 251, 250, 5, 32, 249, 243, 177, 249, 245,
                          223, 250, 14, 98, 250, 12, 56, 249, 242, 249, 249,
                          243, 186, 250, 9, 21, 249, 251, 223, 250, 12, 172,
                          250, 11, 112, 249, 242, 10, 249, 238, 46, 249, 244,
                          199, 250, 10, 150, 249, 245, 211, 249, 246, 112, 250,
                          11, 146, 249, 249, 26, 249, 243, 188, 249, 250, 215,
                          250, 14, 80, 249, 250, 233, 249, 246, 65, 249, 253,
                          249, 250, 19, 218, 250, 16, 51,
                        ];
                        sendADS1298Data(
                          testData,
                          currentPatient?.patientId,
                          currentSession?.sessionId,
                        );
                        toast({
                          title: "Device Data Sent",
                          description:
                            "Your ADS1298 channels 8171/8172 data processed",
                        });
                      }}
                      className="flex items-center space-x-2"
                    >
                      <Activity className="h-4 w-4" />
                      <span className="hidden sm:inline">Test Device Data</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <ECGCarousel
              leads={ECG_LEADS.map((lead) => {
                // Log the raw lead object
                // console.log("Lead:", lead);

                // Get the data for this lead, or fallback to []
                const leadData = ecgData[lead.name] || [];

                // Log the data array
                // console.log("Lead Data:", leadData);

                // // Optionally log based on availability
                // if (leadData.length > 0) {
                //   console.log(`Mapped data for ${lead.name}, length: ${leadData.length}`);
                // } else {
                //   console.log(`No data available for ${lead.name}`);
                // }

                // Return the new object with data attached
                return {
                  ...lead,
                  data: leadData,
                };
              })}
              // Consider websocket connection as a valid active data source too
              isActive={
                (bleStatus === "connected" || wsStatus === "connected") && Object.keys(ecgData).length > 0
              }
            />
          </CardContent>
        </Card>

        {/* ADS1298 Test Panel */}
        <div className="mt-4">
          <ADS1298TestPanel onTestData={onTestData} />
        </div>
      </div>

      {/* System Logs */}
      <div className="border border-border bg-card">
        <div className="p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            System Messages
          </h3>
          <ScrollArea className="h-24">
            <div className="space-y-1">
              {typedSystemLogs.slice(0, 10).map((log: any) => (
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
              {typedSystemLogs.length === 0 && (
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
