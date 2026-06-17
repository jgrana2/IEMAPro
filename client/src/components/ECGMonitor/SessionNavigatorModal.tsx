import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Trash2, X } from 'lucide-react';
import { ZoomableTimeline } from './ZoomableTimeline';
import { LeadInspector } from './LeadInspector';
import { useSessionZoom } from '@/hooks/useSessionZoom';
import { formatDistance } from 'date-fns';

interface SessionNavigatorModalProps {
  isOpen: boolean;
  session: any;
  onClose: () => void;
  onDelete: (sessionId: number | string) => Promise<void>;
}

export function SessionNavigatorModal({
  isOpen,
  session,
  onClose,
  onDelete,
}: SessionNavigatorModalProps) {
  const {
    zoomLevel,
    timeWindowStart,
    timeWindowEnd,
    selectedLead,
    visibleLeads,
    zoomIn,
    zoomOut,
    zoomToFit,
    panLeft,
    panRight,
    panToTime,
    toggleLeadVisibility,
    selectLead,
  } = useSessionZoom(session?.duration ? session.duration * 1000 : 60000);

  if (!session) return null;

  const handleDelete = async () => {
    const confirmed = window.confirm(`Delete session ${session.id || session.sessionId}? This cannot be undone.`);
    if (confirmed) {
      try {
        await onDelete(session.id || session.sessionId);
        onClose();
      } catch (error) {
        console.error('Delete failed:', error);
      }
    }
  };

  const sessionDuration = session.duration ? session.duration * 1000 : 60000;
  const leads = session.ecgData
    ? Object.fromEntries(
        Object.entries(session.ecgData).map(([key, data]) => [
          key,
          Array.isArray(data) ? data : [],
        ])
      )
    : {};

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-auto p-0">
        {/* Header */}
        <DialogHeader className="p-4 border-b sticky top-0 bg-background z-10">
          <div className="flex items-center justify-between w-full">
            <div>
              <DialogTitle className="text-xl">Session Navigator</DialogTitle>
              <div className="text-sm text-muted-foreground mt-1">
                {session.patientName && <span>{session.patientName} • </span>}
                {new Date(session.startTime).toLocaleDateString()} at{' '}
                {new Date(session.startTime).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })} • {formatDistance(new Date(session.startTime), new Date(), { addSuffix: true })}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
              <Button size="sm" variant="ghost" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Metadata Row */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-muted p-3 rounded">
              <div className="text-xs text-muted-foreground">Duration</div>
              <div className="text-lg font-semibold">
                {Math.floor(session.duration / 60)}:{String(session.duration % 60).padStart(2, '0')}
              </div>
            </div>
            <div className="bg-muted p-3 rounded">
              <div className="text-xs text-muted-foreground">Avg Heart Rate</div>
              <div className="text-lg font-semibold">{session.heartRate || 'N/A'} BPM</div>
            </div>
            <div className="bg-muted p-3 rounded">
              <div className="text-xs text-muted-foreground">Date</div>
              <div className="text-sm font-semibold">
                {new Date(session.startTime).toLocaleDateString()}
              </div>
            </div>
            <div className="bg-muted p-3 rounded">
              <div className="text-xs text-muted-foreground">Session ID</div>
              <div className="text-sm font-mono font-semibold">#{session.id || session.sessionId}</div>
            </div>
          </div>

          {/* Timeline */}
          <ZoomableTimeline
            totalDuration={sessionDuration}
            zoomLevel={zoomLevel}
            timeWindowStart={timeWindowStart}
            timeWindowEnd={timeWindowEnd}
            onZoomChange={(level) => {
              if (level > zoomLevel) zoomIn();
              else zoomOut();
            }}
            onPanLeft={panLeft}
            onPanRight={panRight}
            onZoomToFit={zoomToFit}
            onTimeClick={panToTime}
          />

          {/* Lead Inspector */}
          <LeadInspector
            leads={leads}
            timeWindowStart={timeWindowStart}
            timeWindowEnd={timeWindowEnd}
            selectedLead={selectedLead}
            onLeadSelect={selectLead}
            visibleLeads={visibleLeads}
            onVisibleLeadsChange={(newLeads) => {
              // Update visible leads based on the new set
              newLeads.forEach((lead) => {
                if (!visibleLeads.has(lead)) {
                  toggleLeadVisibility(lead);
                }
              });
              visibleLeads.forEach((lead) => {
                if (!newLeads.has(lead)) {
                  toggleLeadVisibility(lead);
                }
              });
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
