import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  ChevronRight,
  User,
  Bluetooth,
  Search,
  Plug,
  Unplug,
  Settings,
  Plus,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PatientDialog } from "./PatientDialog";

interface LeftSidebarProps {
  isExpanded: boolean;
  onToggle: () => void;
  bleStatus: string;
  devices: any[];
  onScanDevices: () => void;
  onConnectDevice: (deviceId: string) => void;
  onDisconnectDevice: () => void;
  currentPatient: any;
  onPatientSelect: (patient: any) => void;
  wsStatus: string;
  onSendMessage: (message: any) => void;
}

export function LeftSidebar({
  isExpanded,
  onToggle,
  bleStatus,
  devices,
  onScanDevices,
  onConnectDevice,
  onDisconnectDevice,
  currentPatient,
  onPatientSelect,
  wsStatus,
  onSendMessage,
}: LeftSidebarProps) {
  const [bufferSize, setBufferSize] = useState(250);
  const [websocketUrl, setWebsocketUrl] = useState("wss://hrzmed.org");
  const [showPatientDialog, setShowPatientDialog] = useState(false);

  const { data: patients = [] } = useQuery<any[]>({
    queryKey: ["/api/patients"],
  });

  // Use devices prop instead of API data for real-time Bluetooth state
  const bleDevices = devices;

  const handleConnectWebSocket = () => {
    onSendMessage({
      type: "connection_request",
      url: websocketUrl,
    });
  };

  const handleDisconnectWebSocket = () => {
    onSendMessage({
      type: "disconnect_request",
    });
  };

  return (
    <>
      <aside
        className={`
          fixed left-0 top-16 bottom-0 bg-card border-r border-border 
          sidebar-transition z-30 overflow-hidden shadow-lg
          ${isExpanded ? "expanded-sidebar-left" : "collapsed-sidebar"}
          md:relative md:top-0
          ${isExpanded ? "sidebar-mobile open" : "sidebar-mobile"} md:translate-x-0
        `}
      >
        <div className="h-full flex flex-col">
          {/* Sidebar Header */}
          <div className="p-4 h-16 border-b border-border flex items-center justify-between">
            {isExpanded && (
              <h2 className="font-semibold text-foreground">
                Patient & Device
              </h2>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className="p-1"
            >
              <ChevronRight
                className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${
                  isExpanded ? "rotate-180" : ""
                }`}
              />
            </Button>
          </div>

          <ScrollArea className="flex-1">
            {isExpanded ? (
              <div className="p-4 space-y-6">
                {/* Patient Selection */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-foreground">
                    Current Patient
                  </Label>
                  <Card>
                    <CardContent className="p-3">
                      {currentPatient ? (
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                            <User className="h-4 w-4 text-primary-foreground" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">
                              {currentPatient.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              ID: {currentPatient.patientId}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No patient selected
                        </p>
                      )}
                    </CardContent>
                  </Card>
                  <div className="flex space-x-2">
                    <Select
                      onValueChange={(value) => {
                        const patient = patients.find(
                          (p) => p.id.toString() === value,
                        );
                        onPatientSelect(patient);
                      }}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select Patient..." />
                      </SelectTrigger>
                      <SelectContent>
                        {patients.map((patient: any) => (
                          <SelectItem
                            key={patient.id}
                            value={patient.id.toString()}
                          >
                            {patient.name} (ID: {patient.patientId})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowPatientDialog(true)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* BLE Device Configuration */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-foreground">
                    BLE ECG Device
                  </Label>
                  
                  {/* Unified Scan & Connect Button */}
                  <Button
                    onClick={onScanDevices}
                    className="w-full"
                    variant={bleStatus === "connected" ? "secondary" : "outline"}
                    disabled={bleStatus === "connecting" || bleStatus === "connected"}
                  >
                    {bleStatus === "connecting" ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 mr-2 border-b-2 border-current" />
                        Connecting...
                      </>
                    ) : bleStatus === "connected" ? (
                      <>
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse mr-2" />
                        Device Connected
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4 mr-2" />
                        Find & Connect Device
                      </>
                    )}
                  </Button>

                  {/* Connected Device Display */}
                  {bleStatus === "connected" && (
                    <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20">
                      <CardContent className="p-3 space-y-3">
                        {bleDevices.filter((device: any) => device.isConnected).length > 0 ? (
                          bleDevices
                            .filter((device: any) => device.isConnected)
                            .map((device: any) => (
                              <div key={device.id} className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                    <div>
                                      <p className="text-sm font-medium text-green-800 dark:text-green-200">
                                        {device.name}
                                      </p>
                                      <p className="text-xs text-green-600 dark:text-green-400">
                                        Signal: {device.rssi || "Strong"} dBm
                                      </p>
                                    </div>
                                  </div>
                                  <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                                    Active
                                  </Badge>
                                </div>
                                <Button
                                  onClick={() => {
                                    if (window.confirm("Are you sure you want to disconnect this device?")) {
                                      onDisconnectDevice();
                                    }
                                  }}
                                  variant="outline"
                                  size="sm"
                                  className="w-full border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                                >
                                  <Unplug className="h-3 w-3 mr-1" />
                                  Disconnect Device
                                </Button>
                              </div>
                            ))
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                <div>
                                  <p className="text-sm font-medium text-green-800 dark:text-green-200">
                                    IoT Holter Device
                                  </p>
                                  <p className="text-xs text-green-600 dark:text-green-400">
                                    Signal: Strong
                                  </p>
                                </div>
                              </div>
                              <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                                Active
                              </Badge>
                            </div>
                            <Button
                              onClick={() => {
                                if (window.confirm("Are you sure you want to disconnect this device?")) {
                                  onDisconnectDevice();
                                }
                              }}
                              variant="outline"
                              size="sm"
                              className="w-full border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                            >
                              <Unplug className="h-3 w-3 mr-1" />
                              Disconnect Device
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Available Devices (when not connected) */}
                  {bleStatus === "disconnected" && bleDevices.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">
                        Found Devices - Tap to Connect
                      </Label>
                      <div className="space-y-2">
                        {bleDevices
                          .filter((device: any) => !device.isConnected)
                          .map((device: any) => (
                            <Card
                              key={device.id}
                              className="cursor-pointer hover:bg-accent hover:border-primary/50 transition-colors"
                              onClick={() => onConnectDevice(device.deviceId)}
                            >
                              <CardContent className="p-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <div className="w-2 h-2 rounded-full bg-gray-400" />
                                    <div>
                                      <p className="text-sm font-medium">
                                        {device.name}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        Tap to connect • RSSI: {device.rssi || "N/A"} dBm
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    ▶
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))
                        }
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Buffer Configuration */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-foreground">
                    Buffer Configuration
                  </Label>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Buffer Size (samples)
                      </Label>
                      <Input
                        type="number"
                        value={bufferSize}
                        onChange={(e) =>
                          setBufferSize(parseInt(e.target.value))
                        }
                        min={100}
                        max={1000}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Sample Rate (Hz)
                      </Label>
                      <Select defaultValue="250">
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="250">250 Hz</SelectItem>
                          <SelectItem value="500">500 Hz</SelectItem>
                          <SelectItem value="1000">1000 Hz</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* WebSocket Configuration */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-foreground">
                    WebSocket Server
                  </Label>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Server URL
                      </Label>
                      <Input
                        type="url"
                        value={websocketUrl}
                        onChange={(e) => setWebsocketUrl(e.target.value)}
                        placeholder="ws://localhost:5000/ws"
                        className="mt-1"
                      />
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        onClick={handleConnectWebSocket}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        disabled={wsStatus === "connected"}
                      >
                        Connect
                      </Button>
                      <Button
                        onClick={handleDisconnectWebSocket}
                        variant="destructive"
                        className="flex-1"
                        disabled={wsStatus === "disconnected"}
                      >
                        Disconnect
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // Collapsed Icons
              <div className="p-2 space-y-3">
                <div className="flex flex-col items-center space-y-4">
                  <Button variant="ghost" size="sm" className="p-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="sm" className="p-2">
                    <Bluetooth className="h-4 w-4 text-primary" />
                  </Button>
                  <Button variant="ghost" size="sm" className="p-2">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="sm" className="p-2">
                    <Plug className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Patient Dialog */}
        <PatientDialog
          open={showPatientDialog}
          onOpenChange={setShowPatientDialog}
          onPatientCreated={(patient) => {
            onPatientSelect(patient);
            setShowPatientDialog(false);
          }}
        />
      </aside>
    </>
  );
}
