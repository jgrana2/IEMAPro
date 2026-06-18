import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface ZoomableTimelineProps {
  totalDuration: number; // milliseconds
  zoomLevel: number; // 1-5
  timeWindowStart: number;
  timeWindowEnd: number;
  onZoomChange: (level: number) => void;
  onZoomToFit: () => void;
  onTimeClick: (timestamp: number) => void;
}

export function ZoomableTimeline({
  totalDuration,
  zoomLevel,
  timeWindowStart,
  timeWindowEnd,
  onZoomChange,
  onZoomToFit,
  onTimeClick,
}: ZoomableTimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);

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
    <div className="flex flex-col">
      {/* Timeline Ruler - directly under graph */}
      <div
        ref={timelineRef}
        className="h-8 bg-muted border-l border-r border-b cursor-pointer relative overflow-hidden"
        onClick={handleTimelineClick}
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

        {/* Range handles at extremes */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-primary/50 hover:bg-primary cursor-col-resize"
          style={{ left: '0%' }}
          title="Drag to adjust start"
        />
        <div
          className="absolute top-0 bottom-0 w-1 bg-primary/50 hover:bg-primary cursor-col-resize"
          style={{ right: '0%' }}
          title="Drag to adjust end"
        />
      </div>

      {/* Zoom Controls Below */}
      <div className="flex items-center justify-center space-x-2 p-2 border-l border-r border-b bg-background">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onZoomChange(Math.max(1, zoomLevel - 1))}
          disabled={zoomLevel === 1}
          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onZoomChange(Math.min(5, zoomLevel + 1))}
          disabled={zoomLevel === 5}
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onZoomToFit}
          title="Fit All"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
