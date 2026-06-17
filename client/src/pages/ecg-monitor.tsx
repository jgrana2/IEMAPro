import { useState, useEffect } from "react";
import { Header } from "@/components/ECGMonitor/Header";
import { LeftSidebar } from "@/components/ECGMonitor/LeftSidebar";
import { RightSidebar } from "@/components/ECGMonitor/RightSidebar";
import { MainContent } from "@/components/ECGMonitor/MainContent";
import { AIDiagnosisPanel } from "@/components/ECGMonitor/AIDiagnosisPanel";
import { ADS1298TestPanel } from "@/components/ECGMonitor/ADS1298TestPanel";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useWebSocketContext } from "@/contexts/WebSocketContext";
import { usePythonBLE } from "@/hooks/usePythonBLE";
import { useToast } from "@/hooks/use-toast";
import { saveRecordingSession, updateRecordingSession } from "@/lib/api";
import { Bot } from "lucide-react";

export default function ECGMonitor() {
  const { leftExpanded, rightExpanded, toggleLeft, toggleRight } = useSidebarState();
  const { wsStatus, sendMessage, ecgData: wsEcgData, heartRate: wsHeartRate, signalQuality: wsSignalQuality } = useWebSocketContext();

  const { toast } = useToast();
  const [currentPatient, setCurrentPatient] = useState<any>(null);
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [sessionSaved, setSessionSaved] = useState(false);
  const [refreshSessionsTrigger, setRefreshSessionsTrigger] = useState(0);
  const [ecgData, setEcgData] = useState<{ [leadName: string]: number[] }>({});
  const [heartRate, setHeartRate] = useState(0);
  const [signalQuality, setSignalQuality] = useState<"good" | "poor" | "noise">("poor");
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);

  // Handle ECG data from BLE directly
  const handleECGData = (
    leadData: { [leadName: string]: number[] },
    hr: number,
    quality: string,
  ) => {

    // Update ECG data buffer with rolling window using functional state update
    const maxBufferSize = 2500; // Keep ~5 seconds at 500Hz
    
    setEcgData(currentBuffer => {
      const newBuffer = { ...currentBuffer };
      
      Object.entries(leadData).forEach(([leadName, newSamples]) => {
        if (!newBuffer[leadName]) {
          newBuffer[leadName] = [];
        }

        // Append new samples to existing buffer
        newBuffer[leadName] = [...newBuffer[leadName], ...newSamples];

        // Keep only the most recent samples
        if (newBuffer[leadName].length > maxBufferSize) {
          newBuffer[leadName] = newBuffer[leadName].slice(-maxBufferSize);
        }
      });
      
      return newBuffer;
    });

    setHeartRate(hr);
    setSignalQuality(quality as "good" | "poor" | "noise");
  };

  const { bleStatus, devices, scanDevices, connectDevice, disconnectDevice } =
    usePythonBLE({
      onECGData: handleECGData,
    });
  const [aiPanelExpanded, setAiPanelExpanded] = useState(true);
  const [aiPanelHeight, setAiPanelHeight] = useState(400);
  const [isDragging, setIsDragging] = useState(false);

  // Handle dragging for AI panel resize
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    const rect = document
      .querySelector(".main-content-container")
      ?.getBoundingClientRect();
    if (!rect) return;

    const newHeight = rect.bottom - e.clientY;
    const minHeight = 200;
    const maxHeight = window.innerHeight * 0.6;

    setAiPanelHeight(Math.max(minHeight, Math.min(maxHeight, newHeight)));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging]);

  // Main content margin classes based on sidebar states
  const getMainContentClass = () => {
    if (window.innerWidth < 768) {
      return "main-content-mobile";
    }

    if (leftExpanded && rightExpanded) {
      return "main-content-both";
    } else if (leftExpanded) {
      return "main-content-left";
    } else if (rightExpanded) {
      return "main-content-right";
    } else {
      return "main-content-full";
    }
  };

  // Prefer websocket ECG data if present, otherwise fall back to BLE-local data
  const mergedEcgData = Object.keys(wsEcgData || {}).length ? wsEcgData : ecgData;
  const mergedHeartRate = wsHeartRate || heartRate;
  const mergedSignalQuality = wsSignalQuality || signalQuality;

  // Log the merged data being passed to MainContent
  useEffect(() => {
    if (Object.keys(mergedEcgData).length > 0) {
      // Merged ECG data processed silently
    } else {
      // No merged ECG data available - handled silently
    }
  }, [mergedEcgData, mergedHeartRate, mergedSignalQuality, wsEcgData, ecgData, wsStatus, bleStatus]);

  // Handlers for recording controls
  const handleStartRecording = async () => {
    if (!currentPatient) {
      toast({
        title: "No Patient Selected",
        description: "Please select a patient before starting a recording.",
        variant: "destructive",
      });
      return;
    }

    if (bleStatus !== "connected") {
      toast({
        title: "No Device Connected",
        description: "Please connect a BLE ECG device before starting a recording.",
        variant: "destructive",
      });
      return;
    }

    const sessionId = `SESSION-${Date.now()}`;
    try {
      const session = await saveRecordingSession({
        sessionId,
        patientId: currentPatient.id,
        deviceId: 1,
        status: "recording",
        bufferSize: 250,
      });
      setCurrentSession(session);
      setIsRecording(true);
      setSessionSaved(false);
      setRecordingStartTime(Date.now());
      toast({
        title: "Recording Started",
        description: `Session ${sessionId} created for ${currentPatient.name}.`,
      });
    } catch (error) {
      console.error("Recording start error:", error);
      toast({
        title: "Error",
        description: `Failed to start recording: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
      });
    }
  };

  const handleStopRecording = async () => {
    const saveRecording = window.confirm("Save this recording?");
    if (saveRecording) {
      // Keep recordingStartTime until the save completes so MainContent
      // can compute the real duration; it is cleared in onSessionSaved.
      setSessionSaved(true);
    } else {
      setRecordingStartTime(null);
    }
    setIsRecording(false);
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Left Sidebar */}
      <LeftSidebar
        isExpanded={leftExpanded}
        onToggle={toggleLeft}
        bleStatus={bleStatus}
        devices={devices}
        onScanDevices={scanDevices}
        onConnectDevice={connectDevice}
        onDisconnectDevice={disconnectDevice}
        currentPatient={currentPatient}
        onPatientSelect={setCurrentPatient}
        wsStatus={wsStatus}
        onSendMessage={sendMessage}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        <Header
          onToggleLeft={toggleLeft}
          onToggleRight={toggleRight}
          bleStatus={bleStatus}
          wsStatus={wsStatus}
        />

        <div
          className={`flex-1 sidebar-transition ${getMainContentClass()} flex flex-col overflow-hidden main-content-container`}
        >
          <div className="flex-1 min-h-0 overflow-auto">
            <MainContent
              currentPatient={currentPatient}
              currentSession={currentSession}
              isRecording={isRecording}
              sessionSaved={sessionSaved}
              onStartRecording={handleStartRecording}
              onStopRecording={handleStopRecording}
              onSessionSaved={() => {
                setRefreshSessionsTrigger((v) => v + 1);
                setSessionSaved(false); // reset after save
                setRecordingStartTime(null);
              }}
              bleStatus={bleStatus}
              wsStatus={wsStatus}
              recordingStartTime={recordingStartTime}
              ecgData={mergedEcgData}
              heartRate={mergedHeartRate}
              signalQuality={mergedSignalQuality}
            />
          </div>

          {/* AI Diagnosis Panel at bottom - Collapsible & Draggable */}
          <div
            className={`border-t bg-background flex-shrink-0 relative min-h-0${
              aiPanelExpanded ? "overflow-hidden" : "h-12"
            } ${!isDragging ? "transition-all duration-300" : ""}`}
            style={{
              height: aiPanelExpanded ? `${aiPanelHeight}px` : "48px",
            }}
          >
            <div className="flex items-center justify-between p-2 border-b bg-white">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                <h3 className="text-sm font-medium">AI-Assisted Diagnosis</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAiPanelExpanded(!aiPanelExpanded)}
                  className="p-1 hover:bg-muted rounded transition-colors"
                >
                  {aiPanelExpanded ? "−" : "+"}
                </button>
              </div>
            </div>
            {aiPanelExpanded && (
              <>
                <div className="h-[calc(100%-48px)]">
                  <AIDiagnosisPanel
                    currentPatient={currentPatient}
                    isRecording={isRecording}
                    ecgData={ecgData}
                  />
                </div>
                {/* Draggable handle */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1 bg-white hover:bg-muted transition-colors cursor-row-resize border-t-1 border-border ${
                    isDragging ? "bg-muted-foreground" : ""
                  }`}
                  onMouseDown={handleMouseDown}
                  title="Drag to resize panel"
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <RightSidebar
        isExpanded={rightExpanded}
        onToggle={toggleRight}
        currentSession={currentSession}
        onSessionSelect={setCurrentSession}
        currentPatient={currentPatient}
        isRecording={isRecording}
        onStopRecording={handleStopRecording}
        refreshSessionsTrigger={refreshSessionsTrigger}
        onSessionsRefresh={() => setRefreshSessionsTrigger((prev) => prev + 1)}
      />

      {/* Mobile Overlay */}
      {(leftExpanded || rightExpanded) && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
          onClick={() => {
            if (leftExpanded) toggleLeft();
            if (rightExpanded) toggleRight();
          }}
        />
      )}
    </div>
  );
}
