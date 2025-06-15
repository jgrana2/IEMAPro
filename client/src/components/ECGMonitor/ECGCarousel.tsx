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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visibleLeads, setVisibleLeads] = useState(4);
  const carouselRef = useRef<HTMLDivElement>(null);

  // Log leads length for debugging
  leads.forEach((lead, index) => {
    if (lead.data.length > 0) {
      console.log(
        `Lead ${index + 1} (${lead.name}): ${lead.data.length} samples`,
      );
    }
  });

  // Adjust visible leads based on screen size
  useEffect(() => {
    const updateVisibleLeads = () => {
      const width = window.innerWidth;
      if (width < 640) {
        setVisibleLeads(1); // Mobile: 1 lead
      } else if (width < 768) {
        setVisibleLeads(1); // Small tablet: 2 leads
      } else if (width < 1024) {
        setVisibleLeads(2); // Tablet: 3 leads
      } else {
        setVisibleLeads(3); // Desktop: 4 leads
      }
    };

    updateVisibleLeads();
    window.addEventListener("resize", updateVisibleLeads);
    return () => window.removeEventListener("resize", updateVisibleLeads);
  }, []);

  const maxIndex = Math.max(0, leads.length - visibleLeads);

  const goToNext = () => {
    setCurrentIndex((prev) => Math.min(prev + 1, maxIndex));
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  };

  const goToIndex = (index: number) => {
    setCurrentIndex(Math.min(Math.max(index, 0), maxIndex));
  };

  const visibleLeadsData = leads.slice(
    currentIndex,
    currentIndex + visibleLeads,
  );

  return (
    <div className="space-y-4">
      {/* Carousel Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goToPrevious}
            disabled={currentIndex === 0}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="text-sm text-muted-foreground">
            Leads {currentIndex + 1}-
            {Math.min(currentIndex + visibleLeads, leads.length)} of{" "}
            {leads.length}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={goToNext}
            disabled={currentIndex >= maxIndex}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Lead Indicators */}
        <div className="flex space-x-1">
          {leads.map((_, index) => (
            <button
              key={index}
              onClick={() => goToIndex(index)}
              className={`w-2 h-2 rounded-full transition-colors ${
                index >= currentIndex && index < currentIndex + visibleLeads
                  ? "bg-primary"
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Carousel Content */}
      <div
        ref={carouselRef}
        className="grid gap-4 transition-all duration-300"
        style={{
          gridTemplateColumns: `repeat(${visibleLeads}, 1fr)`,
        }}
      >
        {visibleLeadsData.map((lead, index) => (
          <Card key={lead.name} className="lead-card border">
            <CardContent className="p-0">
              <div className="flex items-center justify-between border-b">
                <h3 className="text-sm font-semibold text-foreground p-2">
                  {lead.name}
                </h3>
                <span className="text-xs text-muted-foreground p-2">
                  {lead.voltage}
                </span>
              </div>
              <div className="h-24 bg-white relative overflow-hidden">
                <ECGCanvas
                  leadName={lead.name}
                  data={lead.data}
                  isActive={isActive}
                  width={300}
                  height={96}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Jump Navigation */}
      <div className="flex flex-wrap gap-1 justify-center">
        {leads.map((lead, index) => (
          <Button
            key={lead.name}
            variant={
              index >= currentIndex && index < currentIndex + visibleLeads
                ? "default"
                : "outline"
            }
            size="sm"
            onClick={() =>
              goToIndex(Math.max(0, index - Math.floor(visibleLeads / 2)))
            }
            className="h-7 text-xs px-2"
          >
            {lead.name}
          </Button>
        ))}
      </div>
    </div>
  );
}
