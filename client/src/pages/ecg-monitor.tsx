import { useState, useEffect } from "react";
import { Header } from "@/components/ECGMonitor/Header";
import { LeftSidebar } from "@/components/ECGMonitor/LeftSidebar";
import { RightSidebar } from "@/components/ECGMonitor/RightSidebar";
import { MainContent } from "@/components/ECGMonitor/MainContent";
import { AIDiagnosisPanel } from "@/components/ECGMonitor/AIDiagnosisPanel";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useBluetooth } from "@/hooks/useBluetooth";

export default function ECGMonitor() {
  const { leftExpanded, rightExpanded, toggleLeft, toggleRight } =
    useSidebarState();
  const { wsStatus, sendMessage } = useWebSocket();
  const { bleStatus, devices, scanDevices, connectDevice } = useBluetooth();

  const [currentPatient, setCurrentPatient] = useState<any>(null);
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [ecgData, setEcgData] = useState<any[]>([]);
  const [aiPanelExpanded, setAiPanelExpanded] = useState(true);

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
          className={`flex-1 sidebar-transition ${getMainContentClass()} flex flex-col overflow-hidden`}
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
            />
          </div>

          {/* AI Diagnosis Panel at bottom - Collapsible & Draggable */}
          <div
            className={`border-t bg-background flex-shrink-0 transition-all duration-300 relative ${
              aiPanelExpanded ? "h-[400px] resize-y overflow-hidden" : "h-12"
            }`}
            style={{ 
              minHeight: aiPanelExpanded ? "200px" : "48px",
              maxHeight: "60vh"
            }}
          >
            <div className="flex items-center justify-between p-2 border-b bg-background">
              <h3 className="text-sm font-medium">AI-Assisted Diagnosis</h3>
              <div className="flex items-center gap-2">
                {aiPanelExpanded && (
                  <div className="text-xs text-gray-500 hidden sm:block">Drag corner to resize</div>
                )}
                <button
                  onClick={() => setAiPanelExpanded(!aiPanelExpanded)}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
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
                {/* Visible drag handle */}
                <div className="absolute bottom-0 right-0 w-4 h-4 bg-gray-300 hover:bg-gray-400 transition-colors cursor-nw-resize">
                  <div className="absolute bottom-1 right-1 w-0 h-0 border-l-2 border-b-2 border-gray-600"></div>
                  <div className="absolute bottom-0.5 right-0.5 w-0 h-0 border-l-1 border-b-1 border-gray-600"></div>
                </div>
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
