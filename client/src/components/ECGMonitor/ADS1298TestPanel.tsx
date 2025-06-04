import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Activity, Heart, TrendingUp, Wifi } from "lucide-react";
import { useWebSocket } from "@/hooks/useWebSocket";

export function ADS1298TestPanel() {
  const { ecgData, heartRate, signalQuality, wsStatus } = useWebSocket();

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'good': return 'bg-foreground';
      case 'poor': return 'bg-muted-foreground';
      case 'noise': return 'bg-muted-foreground/50';
      default: return 'bg-muted';
    }
  };

  const getConnectionColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-foreground';
      case 'connecting': return 'bg-muted-foreground';
      case 'disconnected': return 'bg-muted-foreground/50';
      default: return 'bg-muted';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          ADS1298 Device Monitor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Device Connection:</span>
          <Badge className={`${getConnectionColor(wsStatus)} text-white`}>
            <Wifi className="w-3 h-3 mr-1" />
            {wsStatus.toUpperCase()}
          </Badge>
        </div>

        {/* Device Information */}
        <Alert>
          <Activity className="h-4 w-4" />
          <AlertDescription>
            Monitoring real-time ECG data from ADS1298 device (UUID: 00008171-0000-1000-8000-00805f9b34fb)
          </AlertDescription>
        </Alert>

        {/* Real-time ECG Status */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Heart className="w-4 h-4 text-foreground" />
              <span className="text-sm font-medium">Heart Rate</span>
            </div>
            <div className="text-2xl font-bold text-foreground">{heartRate}</div>
            <div className="text-xs text-muted-foreground">BPM</div>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Activity className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Signal Quality</span>
            </div>
            <Badge className={`${getQualityColor(signalQuality)} text-background`}>
              {signalQuality.toUpperCase()}
            </Badge>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Active Leads</span>
            </div>
            <div className="text-2xl font-bold text-foreground">
              {Object.keys(ecgData).length}
            </div>
            <div className="text-xs text-muted-foreground">of 12</div>
          </div>
        </div>

        {/* ECG Data Preview */}
        {Object.keys(ecgData).length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Live ECG Leads Data:</h4>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {Object.entries(ecgData).slice(0, 6).map(([leadName, data]) => (
                <div key={leadName} className="bg-muted p-2 rounded">
                  <div className="font-medium">{leadName}</div>
                  <div className="text-muted-foreground">
                    {data.length} samples
                  </div>
                  <div className="text-foreground">
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