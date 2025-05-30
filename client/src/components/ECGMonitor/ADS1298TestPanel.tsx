import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Activity, Zap, Heart, TrendingUp } from "lucide-react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useToast } from "@/hooks/use-toast";

export function ADS1298TestPanel() {
  const { ecgData, heartRate, signalQuality, sendADS1298Data, wsStatus } = useWebSocket();
  const { toast } = useToast();
  const [isSending, setIsSending] = useState(false);

  // Your actual 84-byte ADS1298 data from the device
  const testData = [249, 245, 251, 250, 5, 32, 249, 243, 177, 249, 245, 223, 250, 14, 98, 250, 12, 56, 249, 242, 249, 249, 243, 186, 250, 9, 21, 249, 251, 223, 250, 12, 172, 250, 11, 112, 249, 242, 10, 249, 238, 46, 249, 244, 199, 250, 10, 150, 249, 245, 211, 249, 246, 112, 250, 11, 146, 249, 249, 26, 249, 243, 188, 249, 250, 215, 250, 14, 80, 249, 250, 233, 249, 246, 65, 249, 253, 249, 250, 19, 218, 250, 16, 51];

  const sendTestData = () => {
    if (wsStatus !== 'connected') {
      toast({
        title: "Connection Error",
        description: "WebSocket is not connected",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    sendADS1298Data(testData);
    
    toast({
      title: "ADS1298 Data Sent",
      description: "Your device data is now being processed in real-time",
    });

    setTimeout(() => setIsSending(false), 1000);
  };

  const startContinuousData = () => {
    // Simulate continuous data stream
    const interval = setInterval(() => {
      // Add small variations to simulate real data changes
      const modifiedData = testData.map(value => {
        const variation = Math.floor(Math.random() * 6) - 3; // ±3 variation
        return Math.max(0, Math.min(255, value + variation));
      });
      sendADS1298Data(modifiedData);
    }, 100); // Send data every 100ms

    setTimeout(() => {
      clearInterval(interval);
      toast({
        title: "Data Stream Stopped",
        description: "Continuous ADS1298 data simulation completed",
      });
    }, 5000); // Run for 5 seconds

    toast({
      title: "Data Stream Started",
      description: "Sending continuous ADS1298 data for 5 seconds",
    });
  };

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'good': return 'bg-green-500';
      case 'poor': return 'bg-yellow-500';
      case 'noise': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getConnectionColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      case 'disconnected': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5" />
          ADS1298 ECG Data Test Panel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">WebSocket Status:</span>
          <Badge className={`${getConnectionColor(wsStatus)} text-white`}>
            {wsStatus.toUpperCase()}
          </Badge>
        </div>

        {/* Real-time ECG Status */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Heart className="w-4 h-4 text-red-500" />
              <span className="text-sm font-medium">Heart Rate</span>
            </div>
            <div className="text-2xl font-bold text-red-600">{heartRate}</div>
            <div className="text-xs text-gray-500">BPM</div>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Activity className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium">Signal Quality</span>
            </div>
            <Badge className={`${getQualityColor(signalQuality)} text-white`}>
              {signalQuality.toUpperCase()}
            </Badge>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium">Active Leads</span>
            </div>
            <div className="text-2xl font-bold text-green-600">
              {Object.keys(ecgData).length}
            </div>
            <div className="text-xs text-gray-500">of 12</div>
          </div>
        </div>

        {/* Data Information */}
        <Alert>
          <Activity className="h-4 w-4" />
          <AlertDescription>
            Using your actual 84-byte ADS1298 data from device UUID: 00008171-0000-1000-8000-00805f9b34fb
          </AlertDescription>
        </Alert>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button 
            onClick={sendTestData} 
            disabled={isSending || wsStatus !== 'connected'}
            className="flex-1"
          >
            <Zap className="w-4 h-4 mr-2" />
            {isSending ? "Sending..." : "Send Test Data"}
          </Button>
          
          <Button 
            onClick={startContinuousData} 
            variant="outline"
            disabled={wsStatus !== 'connected'}
            className="flex-1"
          >
            <Activity className="w-4 h-4 mr-2" />
            Simulate Stream
          </Button>
        </div>

        {/* ECG Data Preview */}
        {Object.keys(ecgData).length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Live ECG Leads Data:</h4>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {Object.entries(ecgData).slice(0, 6).map(([leadName, data]) => (
                <div key={leadName} className="bg-gray-50 p-2 rounded">
                  <div className="font-medium">{leadName}</div>
                  <div className="text-gray-600">
                    {data.length} samples
                  </div>
                  <div className="text-blue-600">
                    {data[data.length - 1]?.toFixed(2) || 0} mV
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}