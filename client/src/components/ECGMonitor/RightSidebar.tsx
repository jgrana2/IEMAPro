// ...existing code...
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  ChevronLeft,
  Play,
  Pause,
  Save,
  FileText,
  History,
} from "lucide-react";
import { useEffect, useState } from "react";
import { fetchAllSessions, fetchPatientSessions, fetchSessionById } from "@/lib/api";
import { generateECGReport, downloadPDF } from "@/lib/pdf-generator";
import { formatDistance } from "date-fns";

interface RightSidebarProps {
  isExpanded: boolean;
  onToggle: () => void;
  currentSession: any;
  onSessionSelect: (session: any) => void;
  currentPatient: any;
  isRecording: boolean;
  isPaused: boolean;
  onPauseRecording: () => void;
  onStopRecording: () => void;
  onSaveSession: () => void;
  refreshSessionsTrigger: number;
}

export function RightSidebar({
  isExpanded,
  onToggle,
  currentSession,
  onSessionSelect,
  currentPatient,
  isRecording,
  isPaused,
  onPauseRecording,
  onStopRecording,
  onSaveSession,
  refreshSessionsTrigger,
}: RightSidebarProps) {
  const [recordingDuration, setRecordingDuration] = useState("00:00:00");
  const [durationSeconds, setDurationSeconds] = useState(0);

  // Timer effect: increments duration while recording
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRecording) {
      interval = setInterval(() => {
        setDurationSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setDurationSeconds(0);
      setRecordingDuration("00:00:00");
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  // Update formatted duration string
  useEffect(() => {
    setRecordingDuration(formatDuration(durationSeconds));
  }, [durationSeconds]);

  const [allSessions, setAllSessions] = useState<any[]>([]);
  const [patientSessions, setPatientSessions] = useState<any[]>([]);

  useEffect(() => {
    fetchAllSessions().then(setAllSessions);
  }, [refreshSessionsTrigger]);

  useEffect(() => {
    if (currentPatient?.id) {
      fetchPatientSessions(currentPatient.id).then(setPatientSessions);
    } else {
      setPatientSessions([]);
    }
  }, [currentPatient, refreshSessionsTrigger]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleGeneratePDF = async (session: any) => {
    if (!currentPatient) return;
    try {
      // Always fetch the full session by sessionId (string, not id)
      const sessionId = session.sessionId || session.id || session.id?.toString();
      if (!sessionId) {
        alert("Session ID not found.");
        return;
      }
      const fullSession = await fetchSessionById(sessionId);
      // Validate ecgData
      const ecgData = Array.isArray(fullSession.ecgData) ? fullSession.ecgData : [];
      if (!ecgData.length) {
        alert("No ECG data found for this session. Cannot generate report.");
        return;
      }
      const pdfBlob = await generateECGReport(
        currentPatient,
        fullSession,
        ecgData
      );
      const filename = `ECG_Report_${currentPatient.name.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`;
      await downloadPDF(pdfBlob, filename);
    } catch (error) {
      alert("Failed to generate PDF report. Please try again.");
    }
  };

  return (
    <aside
      className={`
        fixed right-0 top-16 bottom-0 bg-card border-l border-border 
        sidebar-transition z-30 overflow-hidden shadow-lg
        ${isExpanded ? "expanded-sidebar-right" : "collapsed-sidebar"}
        md:relative md:top-0
        ${isExpanded ? "sidebar-mobile-right open" : "sidebar-mobile-right"} md:translate-x-0
      `}
    >
      <div className="h-full flex flex-col">
        {/* Sidebar Header */}
        <div className="p-4 h-16 border-b border-border flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onToggle} className="p-1">
            <ChevronLeft
              className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${
                isExpanded ? "rotate-180" : ""
              }`}
            />
          </Button>
          {isExpanded && (
            <h2 className="font-semibold text-foreground">
              Recording Sessions
            </h2>
          )}
        </div>

        <ScrollArea className="flex-1">
          {isExpanded ? (
            <div className="p-4 space-y-6">
              {/* Active Recording Controls */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">
                  Current Recording
                </h3>
                <Card
                  className={
                    isRecording
                      ? "border-red-500 bg-red-50 dark:bg-red-950"
                      : ""
                  }
                >
                  <CardContent className="p-3">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Status:</span>
                        <Badge
                          variant={isRecording ? "destructive" : "secondary"}
                        >
                          {isRecording ? "Recording" : "Stopped"}
                        </Badge>
                      </div>
                      {isRecording && (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Duration:</span>
                            <span className="text-sm font-mono">
                              {recordingDuration}
                            </span>
                          </div>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant={isPaused ? "secondary" : "destructive"}
                              className="flex-1"
                              onClick={onPauseRecording}
                            >
                              <Pause className="h-3 w-3 mr-1" />
                              {isPaused ? "Resume" : "Pause"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={onSaveSession}
                            >
                              <Save className="h-3 w-3 mr-1" />
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={onStopRecording}
                            >
                              Stop
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Separator />

              {/* Recording Sessions List */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">
                  Recent Sessions
                </h3>
                <div className="space-y-3">
                  {(currentPatient ? patientSessions : allSessions).map(
                    (session: any) => (
                      <Card
                        key={session.id}
                        className="cursor-pointer hover:bg-accent transition-colors"
                        onClick={() => onSessionSelect(session)}
                      >
                        <CardContent className="p-3">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">
                                Session #{session.sessionId || session.id}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatDistance(
                                  new Date(session.startTime),
                                  new Date(),
                                  { addSuffix: true },
                                )}
                              </span>
                            </div>

                            {currentPatient && (
                              <div className="text-xs text-muted-foreground">
                                Patient: {currentPatient.name}
                              </div>
                            )}

                            <div className="text-xs text-muted-foreground">
                              Duration:{" "}
                              {session.duration
                                ? formatDuration(session.duration)
                                : "N/A"}{" "}
                              | HR: {session.heartRate || "N/A"} BPM
                            </div>

                            {/* Mini ECG Thumbnail */}
                            <div className="h-8 bg-black rounded relative overflow-hidden">
                              <svg
                                className="w-full h-full"
                                viewBox="0 0 100 20"
                              >
                                <path
                                  d="M0,10 L10,10 L12,5 L14,15 L16,8 L18,12 L20,10 L30,10 L32,6 L34,14 L36,9 L38,11 L40,10 L50,10"
                                  className="ecg-wave"
                                />
                              </svg>
                            </div>

                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSessionSelect(session);
                                }}
                              >
                                <Play className="h-3 w-3 mr-1" />
                                View
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleGeneratePDF(session);
                                }}
                              >
                                <FileText className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ),
                  )}
                </div>
              </div>
            </div>
          ) : (
            // Collapsed Icons
            <div className="p-2 space-y-3">
              <div className="flex flex-col items-center space-y-4">
                <div className="w-8 h-8 bg-white border rounded flex items-center justify-center text-black text-xs">
                  {isRecording ? (
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  ) : (
                    "•"
                  )}
                </div>
                <Button variant="ghost" size="sm" className="p-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                </Button>
                <Button variant="ghost" size="sm" className="p-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            </div>
          )}
        </ScrollArea>
      </div>
    </aside>
  );
}
