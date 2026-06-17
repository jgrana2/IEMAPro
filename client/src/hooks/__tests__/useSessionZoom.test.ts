import { renderHook, act } from '@testing-library/react';
import { useSessionZoom } from '../useSessionZoom';

describe('useSessionZoom', () => {
  it('should initialize with full recording (zoom level 1)', () => {
    const { result } = renderHook(() => useSessionZoom(60000)); // 60 second session

    expect(result.current.zoomLevel).toBe(1);
    expect(result.current.timeWindowStart).toBe(0);
    expect(result.current.timeWindowEnd).toBe(60000);
  });

  it('should zoom in and reduce time window', () => {
    const { result } = renderHook(() => useSessionZoom(60000));

    act(() => {
      result.current.zoomIn();
    });

    expect(result.current.zoomLevel).toBe(2);
    expect(result.current.timeWindowEnd - result.current.timeWindowStart).toBe(30000); // 50% of 60s
  });

  it('should zoom out and increase time window', () => {
    const { result } = renderHook(() => useSessionZoom(60000));

    act(() => {
      result.current.zoomIn();
      result.current.zoomOut();
    });

    expect(result.current.zoomLevel).toBe(1);
    expect(result.current.timeWindowEnd).toBe(60000);
  });

  it('should not zoom beyond bounds', () => {
    const { result } = renderHook(() => useSessionZoom(60000));

    act(() => {
      result.current.zoomOut();
      result.current.zoomOut();
    });

    expect(result.current.zoomLevel).toBe(1);
  });

  it('should pan left without going before start', () => {
    const { result } = renderHook(() => useSessionZoom(60000));

    act(() => {
      result.current.zoomIn();
      result.current.panLeft();
    });

    expect(result.current.timeWindowStart).toBeGreaterThanOrEqual(0);
  });

  it('should pan right without exceeding end', () => {
    const { result } = renderHook(() => useSessionZoom(60000));

    act(() => {
      result.current.zoomIn();
      result.current.panRight();
    });

    expect(result.current.timeWindowEnd).toBeLessThanOrEqual(60000);
  });

  it('should toggle lead visibility', () => {
    const { result } = renderHook(() => useSessionZoom(60000));

    expect(result.current.visibleLeads.has('Lead I')).toBe(true);

    act(() => {
      result.current.toggleLeadVisibility('Lead I');
    });

    expect(result.current.visibleLeads.has('Lead I')).toBe(false);

    act(() => {
      result.current.toggleLeadVisibility('Lead I');
    });

    expect(result.current.visibleLeads.has('Lead I')).toBe(true);
  });

  it('should select a lead', () => {
    const { result } = renderHook(() => useSessionZoom(60000));

    act(() => {
      result.current.selectLead('Lead II');
    });

    expect(result.current.selectedLead).toBe('Lead II');
  });
});
