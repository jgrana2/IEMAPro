import { useState, useEffect } from "react";
import { Header } from "@/components/ECGMonitor/Header";
import { LeftSidebar } from "@/components/ECGMonitor/LeftSidebar";
import { RightSidebar } from "@/components/ECGMonitor/RightSidebar";
import { MainContent } from "@/components/ECGMonitor/MainContent";
import { AIDiagnosisPanel } from "@/components/ECGMonitor/AIDiagnosisPanel";
import { ADS1298TestPanel } from "@/components/ECGMonitor/ADS1298TestPanel";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useBluetooth } from "@/hooks/useBluetooth";
import { Bot } from "lucide-react";

export default function ECGMonitor() {
  const { leftExpanded, rightExpanded, toggleLeft, toggleRight } =
    useSidebarState();
  const { wsStatus, sendMessage } = useWebSocket();

  const [currentPatient, setCurrentPatient] = useState<any>(null);
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [ecgData, setEcgData] = useState<{ [leadName: string]: number[] }>({});
  const [heartRate, setHeartRate] = useState(0);
  const [signalQuality, setSignalQuality] = useState<"good" | "poor" | "noise">(
    "poor",
  );

  // Handle ECG data from BLE directly
  const handleECGData = (
    leadData: { [leadName: string]: number[] },
    hr: number,
    quality: string,
  ) => {
    // Update ECG data buffer with rolling window
    const maxBufferSize = 2500; // Keep ~5 seconds at 500Hz
    const newBuffer = { ...ecgData };

    Object.entries(leadData).forEach(([leadName, newSamples]) => {
      if (!newBuffer[leadName]) {
        newBuffer[leadName] = [];
      }

      // Append new samples
      newBuffer[leadName] = [...newBuffer[leadName], ...newSamples];

      // Keep only the most recent samples
      if (newBuffer[leadName].length > maxBufferSize) {
        newBuffer[leadName] = newBuffer[leadName].slice(-maxBufferSize);
      }
    });

    setEcgData(newBuffer);
    setHeartRate(hr);
    setSignalQuality(quality as "good" | "poor" | "noise");

    console.log(
      `ECG data updated: Lead I samples: ${newBuffer["Lead I"]?.length || 0}, HR: ${hr}, Quality: ${quality}`,
    );
  };

  const { bleStatus, devices, scanDevices, connectDevice, disconnectDevice } =
    useBluetooth({
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
              onStartRecording={() => setIsRecording(true)}
              onStopRecording={() => setIsRecording(false)}
              bleStatus={bleStatus}
              wsStatus={wsStatus}
              ecgData={ecgData}
              heartRate={heartRate}
              signalQuality={signalQuality}
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
        onStopRecording={() => setIsRecording(false)}
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
