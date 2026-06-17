import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Maximize2, ChevronLeft, ChevronRight } from 'lucide-react';

interface ZoomableTimelineProps {
  totalDuration: number; // milliseconds
  zoomLevel: number; // 1-5
  timeWindowStart: number;
  timeWindowEnd: number;
  onZoomChange: (level: number) => void;
  onPanLeft: () => void;
  onPanRight: () => void;
  onZoomToFit: () => void;
  onTimeClick: (timestamp: number) => void;
}

export function ZoomableTimeline({
  totalDuration,
  zoomLevel,
  timeWindowStart,
  timeWindowEnd,
  onZoomChange,
  onPanLeft,
  onPanRight,
  onZoomToFit,
  onTimeClick,
}: ZoomableTimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const clickPosition = (e.clientX - rect.left) / rect.width;
    const timestamp = timeWindowStart + (timeWindowEnd - timeWindowStart) * clickPosition;

    onTimeClick(Math.max(0, Math.min(totalDuration, timestamp)));
  };

  const handleDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;

    const delta = e.movementX;
    const timelineWidth = timelineRef.current?.offsetWidth || 1;
    const timePerPixel = (timeWindowEnd - timeWindowStart) / timelineWidth;
    const timeDelta = -delta * timePerPixel;

    const newStart = Math.max(0, timeWindowStart + timeDelta);
    const newEnd = Math.min(totalDuration, timeWindowEnd + timeDelta);

    // Adjust if we're at boundaries
    if (newStart === 0) {
      onTimeClick(timeWindowStart);
    } else if (newEnd === totalDuration) {
      onTimeClick(timeWindowEnd - (timeWindowEnd - timeWindowStart) / 2);
    } else {
      onTimeClick(newStart + (newEnd - newStart) / 2);
    }
  };

  // Generate time markers
  const timeMarkers: number[] = [];
  const visibleRange = timeWindowEnd - timeWindowStart;
  const markerInterval = Math.max(1000, visibleRange / 5);

  for (let t = Math.ceil(timeWindowStart / markerInterval) * markerInterval; t <= timeWindowEnd; t += markerInterval) {
    if (t >= timeWindowStart) {
      timeMarkers.push(t);
    }
  }

  return (
    <div className="space-y-3 p-4 border rounded-lg bg-card">
      {/* Zoom Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onZoomChange(Math.max(1, zoomLevel - 1))}
            disabled={zoomLevel === 1}
            title="Zoom Out (Ctrl+-)"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>

          <div className="text-xs text-muted-foreground px-2">
            Zoom: {Math.round((1 / zoomLevel) * 100)}%
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => onZoomChange(Math.min(5, zoomLevel + 1))}
            disabled={zoomLevel === 5}
            title="Zoom In (Ctrl++)"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={onZoomToFit}
            disabled={zoomLevel === 1}
            title="Fit All"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Pan Controls */}
        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onPanLeft}
            disabled={timeWindowStart === 0}
            title="Pan Left (← arrow)"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="text-xs text-muted-foreground px-2">
            {formatTime(timeWindowStart)} - {formatTime(timeWindowEnd)}
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={onPanRight}
            disabled={timeWindowEnd === totalDuration}
            title="Pan Right (→ arrow)"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Timeline Ruler */}
      <div
        ref={timelineRef}
        className="h-16 bg-muted border rounded cursor-pointer relative overflow-hidden"
        onClick={handleTimelineClick}
        onMouseDown={() => setIsDragging(true)}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
        onMouseMove={handleDrag}
      >
        {/* Time markers */}
        {timeMarkers.map((time) => {
          const positionPercent = ((time - timeWindowStart) / (timeWindowEnd - timeWindowStart)) * 100;
          return (
            <div
              key={time}
              className="absolute top-0 h-full"
              style={{ left: `${positionPercent}%` }}
            >
              <div className="absolute top-0 w-px h-2 bg-foreground" />
              <span className="absolute top-3 text-xs text-foreground whitespace-nowrap transform -translate-x-1/2 left-0">
                {formatTime(time)}
              </span>
            </div>
          );
        })}

        {/* Current position indicator */}
        <div className="absolute top-0 bottom-0 w-0.5 bg-primary" />
      </div>

      {/* Keyboard hint */}
      <div className="text-xs text-muted-foreground">
        💡 Click to navigate • Drag to pan • Arrow keys (← →) to move
      </div>
    </div>
  );
}
