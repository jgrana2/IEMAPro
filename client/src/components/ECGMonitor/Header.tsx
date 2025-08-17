import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Heart, Menu, History, Bluetooth, Wifi } from "lucide-react";
import logoImage from "@assets/IEMAlogo.png";

interface HeaderProps {
  onToggleLeft: () => void;
  onToggleRight: () => void;
  bleStatus: "connected" | "disconnected" | "connecting" | "scanning";
  wsStatus: "connected" | "disconnected" | "connecting";
}

export function Header({
  onToggleLeft,
  onToggleRight,
  bleStatus,
  wsStatus,
}: HeaderProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected":
        return "text-foreground";
      case "connecting":
        return "text-muted-foreground";
      default:
        return "text-muted-foreground/50";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "connected":
        return "Connected";
      case "connecting":
        return "Connecting";
      default:
        return "Disconnected";
    }
  };

  return (
    <header className="bg-card border-b border-border h-16 flex items-center justify-between px-4 shadow-sm">
      <div className="flex items-center space-x-4">
        <div className="block md:hidden">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleLeft}
                className="p-2"
              >
                <Menu className="h-4 w-4 text-primary" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle Patient & Device Panel</TooltipContent>
          </Tooltip>
        </div>

        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <img
              src={logoImage}
              alt="IEMA Pro Logo"
              className="w-8 h-8 rounded"
            />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">IEMA Pro</h1>
            <h2 className="text-xs text-muted-foreground">
              Real-time AI-assisted ECG Analysis
            </h2>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {/* Connection Status */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Bluetooth className={`h-4 w-4 ${getStatusColor(bleStatus)}`} />
            <span
              className={`text-xs font-medium ${getStatusColor(bleStatus)}`}
            >
              BLE
            </span>
          </div>

          <div className="w-px h-4 bg-border" />

          <div className="flex items-center space-x-2">
            <Wifi className={`h-4 w-4 ${getStatusColor(wsStatus)}`} />
            <span className={`text-xs font-medium ${getStatusColor(wsStatus)}`}>
              WS
            </span>
          </div>
        </div>

        <div className="block md:hidden">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleRight}
                className="p-2"
              >
                <History className="h-4 w-4 text-primary" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle Recording Sessions Panel</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}
