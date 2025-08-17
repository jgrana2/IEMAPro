import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WebSocketProvider } from "@/contexts/WebSocketContext";
import NotFound from "@/pages/not-found";
import ECGMonitor from "@/pages/ecg-monitor";

function Router() {
  return (
    <Switch>
      <Route path="/" component={ECGMonitor} />
      <Route path="/ecg-monitor" component={ECGMonitor} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WebSocketProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </WebSocketProvider>
    </QueryClientProvider>
  );
}

export default App;
