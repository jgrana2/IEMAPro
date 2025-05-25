import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Heart, Menu, History, Bluetooth, Wifi } from "lucide-react";

interface HeaderProps {
  onToggleLeft: () => void;
  onToggleRight: () => void;
  bleStatus: 'connected' | 'disconnected' | 'connecting';
  wsStatus: 'connected' | 'disconnected' | 'connecting';
}

export function Header({ onToggleLeft, onToggleRight, bleStatus, wsStatus }: HeaderProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'text-green-500';
      case 'connecting': return 'text-yellow-500';
      default: return 'text-red-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting';
      default: return 'Disconnected';
    }
  };

  return (
    <header className="bg-card border-b border-border h-16 flex items-center justify-between px-4 shadow-sm">
      <div className="flex items-center space-x-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" onClick={onToggleLeft} className="p-2">
              <Menu className="h-4 w-4 text-primary" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle Patient & Device Panel</TooltipContent>
        </Tooltip>
        
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Heart className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">ECG Pro</h1>
            <p className="text-xs text-muted-foreground">Real-time 12-Lead Analysis</p>
          </div>
        </div>
      </div>
      
      <div className="flex items-center space-x-4">
        {/* Connection Status */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Bluetooth className={`h-4 w-4 ${getStatusColor(bleStatus)}`} />
            <span className={`text-xs font-medium ${getStatusColor(bleStatus)}`}>
              BLE {getStatusText(bleStatus)}
            </span>
          </div>
          
          <div className="w-px h-4 bg-border" />
          
          <div className="flex items-center space-x-2">
            <Wifi className={`h-4 w-4 ${getStatusColor(wsStatus)}`} />
            <span className={`text-xs font-medium ${getStatusColor(wsStatus)}`}>
              WS {getStatusText(wsStatus)}
            </span>
          </div>
        </div>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" onClick={onToggleRight} className="p-2">
              <History className="h-4 w-4 text-primary" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle Recording Sessions Panel</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
