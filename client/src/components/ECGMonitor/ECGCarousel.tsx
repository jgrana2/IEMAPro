import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ECGCanvas } from "./ECGCanvas";

interface ECGLead {
  name: string;
  voltage: string;
  data: number[];
}

interface ECGCarouselProps {
  leads: ECGLead[];
  isActive: boolean;
}

export function ECGCarousel({ leads, isActive }: ECGCarouselProps) {
  const [selectedLead, setSelectedLead] = useState(0);

  // Show the main ECG display like in the reference image
  const mainLead = leads[selectedLead] || leads[0];

  return (
    <div className="space-y-6">
      {/* Main ECG Display - Large view like in the reference image */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Sinus Rhythm</h3>
            <p className="text-sm text-gray-500">Real-time ECG monitoring</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-sm font-medium">{mainLead?.name || 'Lead II'}</span>
            </div>
            <span className="text-lg font-semibold text-red-600">
              {mainLead?.voltage || '1.2mV'}
            </span>
          </div>
        </div>
        
        {/* Large ECG Canvas */}
        <div className="bg-white rounded-lg border-2">
          <ECGCanvas
            leadName={mainLead?.name || 'Lead II'}
            data={mainLead?.data || []}
            isActive={isActive}
            width={800}
            height={200}
          />
        </div>

        {/* Time markers */}
        <div className="flex justify-between mt-2 px-2">
          <span className="text-xs text-gray-400">0s</span>
          <span className="text-xs text-gray-400">1s</span>
          <span className="text-xs text-gray-400">2s</span>
        </div>
      </div>

      {/* Lead Selection Grid */}
      <div className="bg-white rounded-lg border p-4">
        <h4 className="text-lg font-semibold mb-4">ECG Leads</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {leads.map((lead, index) => (
            <Card 
              key={lead.name} 
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedLead === index ? 'ring-2 ring-red-500 bg-red-50' : ''
              }`}
              onClick={() => setSelectedLead(index)}
            >
              <CardContent className="p-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h5 className="font-medium text-sm">{lead.name}</h5>
                    <span className="text-xs text-muted-foreground">
                      {lead.voltage}
                    </span>
                  </div>
                  <div className="bg-white rounded border">
                    <ECGCanvas
                      leadName={lead.name}
                      data={lead.data}
                      isActive={isActive}
                      width={200}
                      height={80}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
