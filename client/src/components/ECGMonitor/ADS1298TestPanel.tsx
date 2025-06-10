import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Activity, Heart, TrendingUp, Wifi, Play, Square } from "lucide-react";
import { useWebSocket } from "@/hooks/useWebSocket";

interface ADS1298TestPanelProps {
  onTestData?: (leadData: { [leadName: string]: number[] }, hr: number, quality: string) => void;
}

export function ADS1298TestPanel({ onTestData }: ADS1298TestPanelProps) {
  const { ecgData, heartRate, signalQuality, wsStatus } = useWebSocket();
  const [isGeneratingTest, setIsGeneratingTest] = useState(false);

  // Generate realistic ECG test data
  const generateTestECGData = useCallback(() => {
    const sampleRate = 500; // 500 Hz
    const duration = 2; // 2 seconds of data
    const samples = sampleRate * duration;
    const time = Date.now() / 1000;
    
    const testData: { [leadName: string]: number[] } = {};
    const leadNames = ['Lead I', 'Lead II', 'Lead III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'];
    
    leadNames.forEach((leadName, leadIndex) => {
      const data: number[] = [];
      const amplitude = 1000 + leadIndex * 200; // Different amplitudes for each lead
      const heartRate = 75; // BPM
      const beatsPerSecond = heartRate / 60;
      
      for (let i = 0; i < samples; i++) {
        const t = (time + i / sampleRate) * beatsPerSecond * 2 * Math.PI;
        
        // Basic ECG waveform simulation
        let value = 0;
        
        // P wave
        value += amplitude * 0.1 * Math.exp(-Math.pow((t % (2 * Math.PI)) - 0.5, 2) / 0.1);
        
        // QRS complex
        const qrsPosition = (t % (2 * Math.PI)) - Math.PI;
        if (Math.abs(qrsPosition) < 0.2) {
          value += amplitude * (qrsPosition < 0 ? -0.3 : 1.5) * Math.exp(-Math.pow(qrsPosition * 20, 2));
        }
        
        // T wave
        value += amplitude * 0.2 * Math.exp(-Math.pow((t % (2 * Math.PI)) - 4.5, 2) / 0.3);
        
        // Add some realistic noise
        value += (Math.random() - 0.5) * amplitude * 0.05;
        
        data.push(Math.round(value));
      }
      
      testData[leadName] = data;
    });
    
    return testData;
  }, []);

  // Test data generation effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isGeneratingTest && onTestData) {
      interval = setInterval(() => {
        const testData = generateTestECGData();
        const testHeartRate = 75 + Math.floor(Math.random() * 20); // 75-95 BPM
        const testQuality = Math.random() > 0.1 ? 'good' : 'poor'; // 90% good quality
        
        onTestData(testData, testHeartRate, testQuality);
      }, 100); // Generate new data every 100ms
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isGeneratingTest, onTestData, generateTestECGData]);

  const handleTestToggle = () => {
    setIsGeneratingTest(!isGeneratingTest);
  };

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

        {/* Test Data Generator */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">ECG Data Generator:</h4>
            <Button
              onClick={handleTestToggle}
              variant={isGeneratingTest ? "destructive" : "default"}
              size="sm"
              className="flex items-center gap-2"
            >
              {isGeneratingTest ? (
                <>
                  <Square className="w-4 h-4" />
                  Stop Test
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Generate Test Data
                </>
              )}
            </Button>
          </div>
          {isGeneratingTest && (
            <Alert>
              <Activity className="h-4 w-4" />
              <AlertDescription>
                Generating simulated ECG data for all 12 leads at 500Hz sample rate
              </AlertDescription>
            </Alert>
          )}
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