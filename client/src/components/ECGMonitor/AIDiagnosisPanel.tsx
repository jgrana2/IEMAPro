import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Send, Bot, User, Activity, Heart, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

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

export function AIDiagnosisPanel({
  currentPatient,
  isRecording,
  ecgData = [],
}: AIDiagnosisPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "Hello! I'm your AI ECG analysis assistant. I can help analyze ECG patterns, detect abnormalities, and provide diagnostic insights. Upload or select an ECG lead to analyze, or ask me any questions about the current readings.",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyzeWithAI = async (data: { message: string; ecgData?: any[] }) => {
    setIsAnalyzing(true);
    try {
      const response = await fetch("/api/ai-diagnosis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to analyze");
      }

      const result = await response.json();
      const assistantMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content: result.message,
        timestamp: new Date(),
        analysis: result.analysis,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content:
          "Sorry, I encountered an error while analyzing the ECG data. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);

    // Send to AI for analysis
    analyzeWithAI({
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
        content:
          "No ECG data available to analyze. Please start recording or ensure the ECG device is connected and transmitting data.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, noDataMessage]);
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: "Please analyze the current ECG data",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);

    analyzeWithAI({
      message:
        "Analyze the current ECG data for abnormalities, rhythm, and provide diagnostic insights",
      ecgData: ecgData.slice(-250), // Send last 250 data points for analysis
    });
  };

  useEffect(() => {
    // Only auto-scroll to bottom when new messages are added, but allow manual scrolling
    const scrollContainer = scrollAreaRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]",
    );
    if (scrollContainer) {
      const isNearBottom =
        scrollContainer.scrollTop + scrollContainer.clientHeight >=
        scrollContainer.scrollHeight - 100;

      // Only auto-scroll if user is near the bottom
      if (isNearBottom) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [messages]);

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="border-b px-3 sm:px-6 py-3 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm sm:text-base font-medium">
            <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
            <span className="hidden sm:inline">AI-Assisted Diagnosis</span>
            <span className="sm:hidden">AI Diagnosis</span>
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            {isRecording && (
              <Badge
                variant="outline"
                className="text-green-600 border-green-600 text-xs"
              >
                <Activity className="h-3 w-3 mr-1" />
                Live
              </Badge>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={analyzeCurrentECG}
              disabled={isAnalyzing || ecgData.length === 0}
              className="text-xs sm:text-sm"
            >
              <Heart className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              <span className="hidden sm:inline">Analyze Current ECG</span>
              <span className="sm:hidden">Analyze</span>
            </Button>
          </div>
        </div>
        {currentPatient && (
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Patient: {currentPatient.firstName} {currentPatient.lastName} (ID:{" "}
            {currentPatient.patientId})
          </p>
        )}
      </div>
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Messages Area - Fixed height with scroll */}
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full px-2 sm:px-4" ref={scrollAreaRef}>
            <div className="space-y-3 py-2">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-2 sm:gap-3",
                    message.role === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  {message.role === "assistant" && (
                    <Avatar className="h-6 w-6 sm:h-8 sm:w-8 flex-shrink-0">
                      <AvatarFallback className="bg-blue-100 text-blue-600">
                        <Bot className="h-3 w-3 sm:h-4 sm:w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={cn(
                      "max-w-[85%] sm:max-w-[80%] rounded-lg p-2 sm:p-3 text-xs sm:text-sm",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground ml-auto"
                        : "bg-muted",
                    )}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>

                    {/* ECG Analysis Results */}
                    {message.analysis && (
                      <div className="mt-2 sm:mt-3 space-y-1 sm:space-y-2 border-t pt-2">
                        <div className="flex items-center gap-1 sm:gap-2 text-xs font-medium">
                          <Heart className="h-3 w-3" />
                          ECG Analysis Results
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 sm:gap-2 text-xs">
                          <div>
                            <span className="font-medium">Heart Rate:</span>{" "}
                            {message.analysis.heartRate} BPM
                          </div>
                          <div>
                            <span className="font-medium">Rhythm:</span>{" "}
                            {message.analysis.rhythm}
                          </div>
                          <div className="sm:col-span-2">
                            <span className="font-medium">Confidence:</span>{" "}
                            {Math.round(message.analysis.confidence * 100)}%
                          </div>
                        </div>

                        {message.analysis.abnormalities.length > 0 && (
                          <div>
                            <div className="flex items-center gap-1 text-xs font-medium text-orange-600">
                              <AlertTriangle className="h-3 w-3" />
                              Detected Abnormalities:
                            </div>
                            <ul className="text-xs mt-1 space-y-1">
                              {message.analysis.abnormalities.map(
                                (abnormality, index) => (
                                  <li
                                    key={index}
                                    className="flex items-start gap-1"
                                  >
                                    <span className="text-orange-500">•</span>
                                    <span className="break-words">
                                      {abnormality}
                                    </span>
                                  </li>
                                ),
                              )}
                            </ul>
                          </div>
                        )}

                        {message.analysis.recommendations.length > 0 && (
                          <div>
                            <div className="text-xs font-medium text-blue-600">
                              Recommendations:
                            </div>
                            <ul className="text-xs mt-1 space-y-1">
                              {message.analysis.recommendations.map(
                                (recommendation, index) => (
                                  <li
                                    key={index}
                                    className="flex items-start gap-1"
                                  >
                                    <span className="text-blue-500">•</span>
                                    <span className="break-words">
                                      {recommendation}
                                    </span>
                                  </li>
                                ),
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground mt-1 sm:mt-2">
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                  {message.role === "user" && (
                    <Avatar className="h-6 w-6 sm:h-8 sm:w-8 flex-shrink-0">
                      <AvatarFallback className="bg-gray-100 text-gray-600">
                        <User className="h-3 w-3 sm:h-4 sm:w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}

              {isAnalyzing && (
                <div className="flex gap-2 sm:gap-3">
                  <Avatar className="h-6 w-6 sm:h-8 sm:w-8 flex-shrink-0">
                    <AvatarFallback className="bg-blue-100 text-blue-600">
                      <Bot className="h-3 w-3 sm:h-4 sm:w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-muted rounded-lg p-2 sm:p-3 text-xs sm:text-sm">
                    <div className="flex items-center gap-2">
                      <div className="animate-spin h-3 w-3 sm:h-4 sm:w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                      Analyzing ECG data...
                    </div>
                  </div>
                </div>
              )}

              {/* Scroll anchor */}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </div>

        {/* Input Area - Pinned to bottom */}
        <div className="border-t p-2 sm:p-4 flex-shrink-0">
          <div className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about ECG data or request analysis..."
              className="flex-1 text-xs sm:text-sm"
              disabled={isAnalyzing}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isAnalyzing}
              size="icon"
              className="h-8 w-8 sm:h-10 sm:w-10"
            >
              <Send className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1 sm:gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setInputValue("Please analyze the last 10 seconds of ECG data")
              }
              disabled={isAnalyzing}
              className="text-xs px-2 py-1 h-auto"
            >
              <span className="hidden sm:inline">Analyze Last 10s</span>
              <span className="sm:hidden">Last 10s</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInputValue("What abnormalities do you detect?")}
              disabled={isAnalyzing}
              className="text-xs px-2 py-1 h-auto"
            >
              <span className="hidden sm:inline">Check Abnormalities</span>
              <span className="sm:hidden">Abnormalities</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setInputValue("Provide diagnostic recommendations")
              }
              disabled={isAnalyzing}
              className="text-xs px-2 py-1 h-auto"
            >
              <span className="hidden sm:inline">Get Recommendations</span>
              <span className="sm:hidden">Recommendations</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
