import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Send, Bot, User, Activity, Heart, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  analysis?: ECGAnalysis;
}

interface ECGAnalysis {
  heartRate: number;
  rhythm: string;
  abnormalities: string[];
  recommendations: string[];
  confidence: number;
}

interface AIDiagnosisPanelProps {
  currentPatient: any;
  isRecording: boolean;
  ecgData?: any[];
}

export function AIDiagnosisPanel({ currentPatient, isRecording, ecgData = [] }: AIDiagnosisPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      role: "assistant",
      content: "Hello! I'm your AI ECG analysis assistant. I can help analyze ECG patterns, detect abnormalities, and provide diagnostic insights. Upload or select an ECG lead to analyze, or ask me any questions about the current readings.",
      timestamp: new Date(),
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const analyzeMutation = useMutation({
    mutationFn: async (data: { message: string; ecgData?: any[] }) => {
      const response = await apiRequest("POST", "/api/ai-diagnosis", data);
      return await response.json();
    },
    onSuccess: (response: any) => {
      const assistantMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content: response.message,
        timestamp: new Date(),
        analysis: response.analysis,
      };
      setMessages(prev => [...prev, assistantMessage]);
    },
  });

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    
    // Send to AI for analysis
    analyzeMutation.mutate({
      message: inputValue,
      ecgData: ecgData.length > 0 ? ecgData.slice(-100) : undefined, // Send last 100 data points
    });

    setInputValue("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const analyzeCurrentECG = () => {
    if (ecgData.length === 0) {
      const noDataMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content: "No ECG data available to analyze. Please start recording or ensure the ECG device is connected and transmitting data.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, noDataMessage]);
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: "Please analyze the current ECG data",
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    
    analyzeMutation.mutate({
      message: "Analyze the current ECG data for abnormalities, rhythm, and provide diagnostic insights",
      ecgData: ecgData.slice(-250), // Send last 250 data points for analysis
    });
  };

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-blue-500" />
            AI-Assisted Diagnosis
          </CardTitle>
          <div className="flex items-center gap-2">
            {isRecording && (
              <Badge variant="outline" className="text-green-600 border-green-600">
                <Activity className="h-3 w-3 mr-1" />
                Live Analysis
              </Badge>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={analyzeCurrentECG}
              disabled={analyzeMutation.isPending || ecgData.length === 0}
            >
              <Heart className="h-4 w-4 mr-1" />
              Analyze Current ECG
            </Button>
          </div>
        </div>
        {currentPatient && (
          <p className="text-sm text-muted-foreground">
            Patient: {currentPatient.firstName} {currentPatient.lastName} (ID: {currentPatient.patientId})
          </p>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex flex-col h-[400px]">
          {/* Messages Area */}
          <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {message.role === "assistant" && (
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-blue-100 text-blue-600">
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg p-3 text-sm",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground ml-auto"
                        : "bg-muted"
                    )}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    
                    {/* ECG Analysis Results */}
                    {message.analysis && (
                      <div className="mt-3 space-y-2 border-t pt-2">
                        <div className="flex items-center gap-2 text-xs font-medium">
                          <Heart className="h-3 w-3" />
                          ECG Analysis Results
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="font-medium">Heart Rate:</span> {message.analysis.heartRate} BPM
                          </div>
                          <div>
                            <span className="font-medium">Rhythm:</span> {message.analysis.rhythm}
                          </div>
                          <div className="col-span-2">
                            <span className="font-medium">Confidence:</span> {Math.round(message.analysis.confidence * 100)}%
                          </div>
                        </div>
                        
                        {message.analysis.abnormalities.length > 0 && (
                          <div>
                            <div className="flex items-center gap-1 text-xs font-medium text-orange-600">
                              <AlertTriangle className="h-3 w-3" />
                              Detected Abnormalities:
                            </div>
                            <ul className="text-xs mt-1 space-y-1">
                              {message.analysis.abnormalities.map((abnormality, index) => (
                                <li key={index} className="flex items-start gap-1">
                                  <span className="text-orange-500">•</span>
                                  {abnormality}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {message.analysis.recommendations.length > 0 && (
                          <div>
                            <div className="text-xs font-medium text-blue-600">Recommendations:</div>
                            <ul className="text-xs mt-1 space-y-1">
                              {message.analysis.recommendations.map((recommendation, index) => (
                                <li key={index} className="flex items-start gap-1">
                                  <span className="text-blue-500">•</span>
                                  {recommendation}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="text-xs text-muted-foreground mt-2">
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                  {message.role === "user" && (
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-gray-100 text-gray-600">
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
              
              {analyzeMutation.isPending && (
                <div className="flex gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-blue-100 text-blue-600">
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-muted rounded-lg p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                      Analyzing ECG data...
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          
          {/* Input Area */}
          <div className="border-t p-4">
            <div className="flex gap-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about the ECG data, request analysis, or describe symptoms..."
                className="flex-1"
                disabled={analyzeMutation.isPending}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || analyzeMutation.isPending}
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2 mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInputValue("Please analyze the last 10 seconds of ECG data")}
                disabled={analyzeMutation.isPending}
              >
                Analyze Last 10s
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInputValue("What abnormalities do you detect?")}
                disabled={analyzeMutation.isPending}
              >
                Check Abnormalities
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInputValue("Provide diagnostic recommendations")}
                disabled={analyzeMutation.isPending}
              >
                Get Recommendations
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}