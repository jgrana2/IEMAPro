import { useState, useEffect } from "react";
import { Header } from "@/components/ECGMonitor/Header";
import { LeftSidebar } from "@/components/ECGMonitor/LeftSidebar";
import { RightSidebar } from "@/components/ECGMonitor/RightSidebar";
import { MainContent } from "@/components/ECGMonitor/MainContent";
import { AIDiagnosisPanel } from "@/components/ECGMonitor/AIDiagnosisPanel";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useBluetooth } from "@/hooks/useBluetooth";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";

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

        <div className={`flex-1 sidebar-transition ${getMainContentClass()} flex flex-col overflow-hidden`}>
          <ResizablePanelGroup direction="vertical" className="h-full">
            <ResizablePanel defaultSize={aiPanelExpanded ? 70 : 95} minSize={30}>
              <div className="h-full overflow-auto">
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
            </ResizablePanel>
            
            {aiPanelExpanded && <ResizableHandle withHandle />}
            
            <ResizablePanel 
              defaultSize={aiPanelExpanded ? 30 : 5} 
              minSize={5}
              maxSize={60}
              className="border-t bg-background"
            >
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between p-2 border-b bg-background flex-shrink-0">
                  <h3 className="text-sm font-medium">AI-Assisted Diagnosis</h3>
                  <button
                    onClick={() => setAiPanelExpanded(!aiPanelExpanded)}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                  >
                    {aiPanelExpanded ? "−" : "+"}
                  </button>
                </div>
                {aiPanelExpanded && (
                  <div className="flex-1 min-h-0">
                    <AIDiagnosisPanel
                      currentPatient={currentPatient}
                      isRecording={isRecording}
                      ecgData={ecgData}
                    />
                  </div>
                )}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
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
