import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Square } from "lucide-react";
import { ECGCanvas } from "./ECGCanvas";
import { useQuery } from "@tanstack/react-query";

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
  wsStatus
}: MainContentProps) {
  const [heartRate, setHeartRate] = useState(72);
  const [ecgData, setEcgData] = useState<{ [key: string]: number[] }>({});

  const { data: systemLogs = [] } = useQuery({
    queryKey: ["/api/system-logs"],
    refetchInterval: 2000, // Refresh logs every 2 seconds
  });

  // Simulate heart rate variations
  useEffect(() => {
    const interval = setInterval(() => {
      setHeartRate(prev => {
        const variation = Math.floor(Math.random() * 6) - 3; // ±3 BPM
        return Math.max(60, Math.min(100, prev + variation));
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // Generate mock ECG data for demonstration
  useEffect(() => {
    const generateECGData = () => {
      const newData: { [key: string]: number[] } = {};
      ECG_LEADS.forEach((lead, index) => {
        const data = [];
        for (let i = 0; i < 500; i++) {
          let value = 0;
          
          // QRS complex simulation
          if (i % 100 < 5) {
            value = Math.sin((i % 100) * Math.PI / 2.5) * (0.5 + index * 0.1);
          }
          // T wave simulation
          else if (i % 100 < 20) {
            value = Math.sin((i % 100 - 5) * Math.PI / 15) * (0.2 + index * 0.05);
          }
          // Baseline with noise
          else {
            value = (Math.random() - 0.5) * 0.05;
          }
          
          data.push(value);
        }
        newData[lead.name] = data;
      });
      setEcgData(newData);
    };

    generateECGData();
    const interval = setInterval(generateECGData, 100); // Update every 100ms

    return () => clearInterval(interval);
  }, []);

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-500';
      case 'warning': return 'text-yellow-500';
      case 'info': return 'text-green-500';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <main className="h-full flex flex-col bg-muted/20">
      <div className="flex-1 p-6">
        {/* ECG Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">12-Lead ECG Monitoring</h2>
              <p className="text-sm text-muted-foreground">
                {currentPatient ? `Patient: ${currentPatient.name} (ID: ${currentPatient.patientId})` : 'No patient selected'}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Heart Rate</p>
                <p className="text-2xl font-bold text-red-500">{heartRate} BPM</p>
              </div>
              <div className="flex space-x-2">
                {!isRecording ? (
                  <Button 
                    onClick={onStartRecording}
                    className="bg-green-600 hover:bg-green-700"
                    disabled={!currentPatient || bleStatus !== 'connected'}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Start Recording
                  </Button>
                ) : (
                  <Button 
                    onClick={onStopRecording}
                    variant="destructive"
                  >
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

        {/* 12-Lead ECG Grid */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {ECG_LEADS.map((lead, index) => (
                <div key={lead.name} className="lead-card rounded-lg p-4 min-h-[140px] border">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-foreground">{lead.name}</h3>
                    <span className="text-xs text-muted-foreground">{lead.voltage}</span>
                  </div>
                  <div className="h-20 bg-black rounded relative overflow-hidden">
                    <ECGCanvas 
                      leadName={lead.name}
                      data={ecgData[lead.name] || []}
                      isActive={bleStatus === 'connected'}
                    />
                    {/* Grid overlay */}
                    <div className="absolute inset-0 ecg-grid-pattern pointer-events-none" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Logs */}
      <div className="border-t border-border bg-card">
        <div className="p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">System Messages</h3>
          <ScrollArea className="h-24">
            <div className="space-y-1">
              {systemLogs.slice(0, 10).map((log: any) => (
                <div key={log.id} className="text-xs font-mono flex items-center space-x-2">
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
