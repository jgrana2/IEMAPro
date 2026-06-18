import { useState } from 'react';

const LEAD_NAMES = [
  'Lead I', 'Lead II', 'Lead III',
  'aVR', 'aVL', 'aVF',
  'V1', 'V2', 'V3', 'V4', 'V5', 'V6'
];

export function useSessionZoom(sessionDuration: number) {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [timeWindowStart, setTimeWindowStart] = useState(0);
  const [timeWindowEnd, setTimeWindowEnd] = useState(sessionDuration);
  const [selectedLead, setSelectedLead] = useState<string | null>(null);
  const [featuredLead, setFeaturedLead] = useState<string | null>(null);
  const [visibleLeads, setVisibleLeads] = useState<Set<string>>(
    new Set(LEAD_NAMES)
  );

  // Calculate visible time range based on zoom level
  // Level 1: 100%, Level 2: 50%, Level 3: 25%, Level 4: 10%, Level 5: 5%
  const getTimeRangeForZoom = (level: number, center: number = sessionDuration / 2) => {
    const visiblePercentages = [1, 0.5, 0.25, 0.1, 0.05];
    const visibleRange = sessionDuration * visiblePercentages[level - 1];
    const halfRange = visibleRange / 2;

    let start = center - halfRange;
    let end = center + halfRange;

    // Clamp to session bounds
    if (start < 0) {
      start = 0;
      end = Math.min(visibleRange, sessionDuration);
    }
    if (end > sessionDuration) {
      end = sessionDuration;
      start = Math.max(0, sessionDuration - visibleRange);
    }

    return { start, end };
  };

  const zoomIn = () => {
    if (zoomLevel < 5) {
      const newLevel = zoomLevel + 1;
      const center = (timeWindowStart + timeWindowEnd) / 2;
      const { start, end } = getTimeRangeForZoom(newLevel, center);

      setZoomLevel(newLevel);
      setTimeWindowStart(start);
      setTimeWindowEnd(end);
    }
  };

  const zoomOut = () => {
    if (zoomLevel > 1) {
      const newLevel = zoomLevel - 1;
      const center = (timeWindowStart + timeWindowEnd) / 2;
      const { start, end } = getTimeRangeForZoom(newLevel, center);

      setZoomLevel(newLevel);
      setTimeWindowStart(start);
      setTimeWindowEnd(end);
    }
  };

  const zoomToFit = () => {
    setZoomLevel(1);
    setTimeWindowStart(0);
    setTimeWindowEnd(sessionDuration);
  };

  const panLeft = () => {
    const visibleRange = timeWindowEnd - timeWindowStart;
    const panAmount = visibleRange * 0.1; // Pan by 10%
    const newStart = Math.max(0, timeWindowStart - panAmount);
    const newEnd = Math.min(sessionDuration, newStart + visibleRange);

    setTimeWindowStart(newStart);
    setTimeWindowEnd(newEnd);
  };

  const panRight = () => {
    const visibleRange = timeWindowEnd - timeWindowStart;
    const panAmount = visibleRange * 0.1; // Pan by 10%
    const newEnd = Math.min(sessionDuration, timeWindowEnd + panAmount);
    const newStart = Math.max(0, newEnd - visibleRange);

    setTimeWindowStart(newStart);
    setTimeWindowEnd(newEnd);
  };

  const panToTime = (timestamp: number) => {
    const visibleRange = timeWindowEnd - timeWindowStart;
    const halfRange = visibleRange / 2;

    let start = timestamp - halfRange;
    let end = timestamp + halfRange;

    // Clamp to session bounds
    if (start < 0) {
      start = 0;
      end = Math.min(visibleRange, sessionDuration);
    }
    if (end > sessionDuration) {
      end = sessionDuration;
      start = Math.max(0, sessionDuration - visibleRange);
    }

    setTimeWindowStart(start);
    setTimeWindowEnd(end);
  };

  const zoomToSelection = (start: number, end: number) => {
    if (start >= 0 && end <= sessionDuration && start < end) {
      setTimeWindowStart(start);
      setTimeWindowEnd(end);
      // Calculate appropriate zoom level for this range
      const range = end - start;
      const percentage = range / sessionDuration;
      if (percentage >= 0.5) setZoomLevel(1);
      else if (percentage >= 0.25) setZoomLevel(2);
      else if (percentage >= 0.1) setZoomLevel(3);
      else if (percentage >= 0.05) setZoomLevel(4);
      else setZoomLevel(5);
    }
  };

  const toggleLeadVisibility = (leadName: string) => {
    const newVisibleLeads = new Set(visibleLeads);
    if (newVisibleLeads.has(leadName)) {
      newVisibleLeads.delete(leadName);
    } else {
      newVisibleLeads.add(leadName);
    }
    setVisibleLeads(newVisibleLeads);
  };

  const selectLead = (leadName: string | null) => {
    setSelectedLead(leadName);
  };

  const selectFeaturedLead = (leadName: string | null) => {
    setFeaturedLead(leadName);
  };

  const panByPixels = (deltaPixels: number, containerWidth: number) => {
    if (containerWidth === 0) return;
    const visibleRange = timeWindowEnd - timeWindowStart;
    const timeDelta = (-deltaPixels / containerWidth) * visibleRange;
    const currentCenter = (timeWindowStart + timeWindowEnd) / 2;
    panToTime(currentCenter + timeDelta);
  };

  const zoomAt = (direction: 'in' | 'out', centerTime: number) => {
    const newLevel =
      direction === 'in'
        ? Math.min(5, zoomLevel + 1)
        : Math.max(1, zoomLevel - 1);

    if (newLevel === zoomLevel) return;

    const { start, end } = getTimeRangeForZoom(newLevel, centerTime);
    setZoomLevel(newLevel);
    setTimeWindowStart(start);
    setTimeWindowEnd(end);
  };

  return {
    zoomLevel,
    timeWindowStart,
    timeWindowEnd,
    selectedLead,
    featuredLead,
    visibleLeads,
    zoomIn,
    zoomOut,
    zoomToFit,
    panLeft,
    panRight,
    panToTime,
    zoomToSelection,
    panByPixels,
    zoomAt,
    toggleLeadVisibility,
    selectLead,
    selectFeaturedLead,
  };
}
