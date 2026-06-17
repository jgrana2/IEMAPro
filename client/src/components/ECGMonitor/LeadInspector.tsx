import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, X } from 'lucide-react';
import { ECGCanvas } from './ECGCanvas';

const LEAD_NAMES = [
  'Lead I', 'Lead II', 'Lead III',
  'aVR', 'aVL', 'aVF',
  'V1', 'V2', 'V3', 'V4', 'V5', 'V6'
];

interface LeadInspectorProps {
  leads: { [leadName: string]: number[] };
  timeWindowStart: number;
  timeWindowEnd: number;
  selectedLead: string | null;
  onLeadSelect: (leadName: string | null) => void;
  visibleLeads: Set<string>;
  onVisibleLeadsChange: (leads: Set<string>) => void;
}

export function LeadInspector({
  leads,
  timeWindowStart,
  timeWindowEnd,
  selectedLead,
  onLeadSelect,
  visibleLeads,
  onVisibleLeadsChange,
}: LeadInspectorProps) {
  // Calculate visible samples based on time window
  const getVisibleSamples = (leadData: number[]) => {
    const sampleRate = 500; // Hz
    const totalDuration = (leadData.length / sampleRate) * 1000; // Convert to ms

    const startIndex = Math.floor((timeWindowStart / totalDuration) * leadData.length);
    const endIndex = Math.ceil((timeWindowEnd / totalDuration) * leadData.length);

    return leadData.slice(Math.max(0, startIndex), Math.min(leadData.length, endIndex));
  };

  const toggleLeadVisibility = (leadName: string) => {
    const newVisibleLeads = new Set(visibleLeads);
    if (newVisibleLeads.has(leadName)) {
      newVisibleLeads.delete(leadName);
    } else {
      newVisibleLeads.add(leadName);
    }
    onVisibleLeadsChange(newVisibleLeads);
  };

  // If a lead is selected for detail view, show expanded view
  if (selectedLead && leads[selectedLead]) {
    const visibleData = getVisibleSamples(leads[selectedLead]);

    return (
      <div className="space-y-4 p-4 border rounded-lg bg-card">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{selectedLead} - Detail View</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onLeadSelect(null)}
          >
            <X className="h-4 w-4 mr-1" />
            Close
          </Button>
        </div>

        {/* Full-width ECG canvas */}
        <div className="h-64 bg-white rounded border overflow-hidden">
          {visibleData.length > 0 ? (
            <ECGCanvas
              leadName={selectedLead}
              data={visibleData}
              isActive={true}
              width={800}
              height={256}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              No data in visible time range
            </div>
          )}
        </div>

        {/* Lead statistics */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-muted p-2 rounded">
            <div className="text-muted-foreground">Min</div>
            <div className="font-mono font-bold">
              {visibleData.length > 0 ? Math.min(...visibleData).toFixed(2) : 'N/A'}
            </div>
          </div>
          <div className="bg-muted p-2 rounded">
            <div className="text-muted-foreground">Max</div>
            <div className="font-mono font-bold">
              {visibleData.length > 0 ? Math.max(...visibleData).toFixed(2) : 'N/A'}
            </div>
          </div>
          <div className="bg-muted p-2 rounded">
            <div className="text-muted-foreground">Avg</div>
            <div className="font-mono font-bold">
              {visibleData.length > 0
                ? (visibleData.reduce((a, b) => a + b, 0) / visibleData.length).toFixed(2)
                : 'N/A'}
            </div>
          </div>
        </div>

        {/* Back to grid button */}
        <Button
          className="w-full"
          variant="outline"
          onClick={() => onLeadSelect(null)}
        >
          Back to Grid View
        </Button>
      </div>
    );
  }

  // Grid view: show all visible leads
  return (
    <div className="space-y-4">
      {/* Grid Controls */}
      <div className="flex items-center justify-between px-4">
        <h3 className="font-semibold">12-Lead ECG</h3>
        <div className="flex items-center space-x-2">
          <Badge variant="outline">{visibleLeads.size} of {LEAD_NAMES.length} visible</Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onVisibleLeadsChange(new Set(LEAD_NAMES))}
          >
            Show All
          </Button>
        </div>
      </div>

      {/* Lead Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 px-4">
        {LEAD_NAMES.map((leadName) => {
          const isVisible = visibleLeads.has(leadName);
          const leadData = leads[leadName] || [];
          const visibleData = getVisibleSamples(leadData);
          const isSelected = selectedLead === leadName;

          return (
            <Card
              key={leadName}
              className={`cursor-pointer transition-all ${
                isSelected ? 'ring-2 ring-primary' : ''
              } ${isVisible ? '' : 'opacity-50'}`}
              onClick={() => onLeadSelect(leadName)}
            >
              <CardContent className="p-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">{leadName}</h4>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLeadVisibility(leadName);
                      }}
                    >
                      {isVisible ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>

                  {/* Mini ECG Canvas */}
                  <div className="h-20 bg-white rounded border overflow-hidden">
                    {visibleData.length > 0 ? (
                      <ECGCanvas
                        leadName={leadName}
                        data={visibleData}
                        isActive={true}
                        width={200}
                        height={80}
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                        No data
                      </div>
                    )}
                  </div>

                  {/* Lead info */}
                  <div className="text-xs text-muted-foreground">
                    {leadData.length > 0
                      ? `${visibleData.length} samples`
                      : 'No data'}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
