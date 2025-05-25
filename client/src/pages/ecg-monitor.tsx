import { useState, useEffect } from "react";
import { Header } from "@/components/ECGMonitor/Header";
import { LeftSidebar } from "@/components/ECGMonitor/LeftSidebar";
import { RightSidebar } from "@/components/ECGMonitor/RightSidebar";
import { MainContent } from "@/components/ECGMonitor/MainContent";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useBluetooth } from "@/hooks/useBluetooth";

export default function ECGMonitor() {
  const { leftExpanded, rightExpanded, toggleLeft, toggleRight } = useSidebarState();
  const { wsStatus, sendMessage } = useWebSocket();
  const { bleStatus, devices, scanDevices, connectDevice } = useBluetooth();
  
  const [currentPatient, setCurrentPatient] = useState<any>(null);
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [isRecording, setIsRecording] = useState(false);

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
        
        <div className={`flex-1 sidebar-transition ${getMainContentClass()}`}>
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
