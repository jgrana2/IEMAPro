import { useEffect, useRef } from "react";

interface ECGCanvasProps {
  leadName: string;
  data: number[];
  isActive: boolean;
  width?: number;
  height?: number;
}

export function ECGCanvas({ leadName, data, isActive, width = 300, height = 80 }: ECGCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const offsetRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size with device pixel ratio
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const canvasWidth = rect.width;
    const canvasHeight = rect.height;

    const drawGrid = () => {
      ctx.strokeStyle = '#E5E7EB'; // Light gray for grid
      ctx.lineWidth = 0.5;
      
      // Major grid lines (5mm squares)
      const majorSpacing = 25;
      for (let x = 0; x <= canvasWidth; x += majorSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvasHeight);
        ctx.stroke();
      }
      
      for (let y = 0; y <= canvasHeight; y += majorSpacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvasWidth, y);
        ctx.stroke();
      }
      
      // Minor grid lines (1mm squares)
      ctx.strokeStyle = '#F3F4F6';
      ctx.lineWidth = 0.3;
      const minorSpacing = 5;
      for (let x = 0; x <= canvasWidth; x += minorSpacing) {
        if (x % majorSpacing !== 0) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvasHeight);
          ctx.stroke();
        }
      }
      
      for (let y = 0; y <= canvasHeight; y += minorSpacing) {
        if (y % majorSpacing !== 0) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvasWidth, y);
          ctx.stroke();
        }
      }
    };

    const drawECG = () => {
      if (!isActive) return;

      // Clear canvas
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      
      // Draw grid first
      drawGrid();
      
      // Set ECG line properties
      ctx.strokeStyle = '#EF4444'; // Medical red like in the image
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (data.length > 0) {
        ctx.beginPath();
        
        const centerY = canvasHeight / 2;
        const amplitude = canvasHeight * 0.35; // Slightly larger amplitude
        
        // Auto-scale for ADS1298 voltage values (typically around -18mV range)
        const minValue = Math.min(...data);
        const maxValue = Math.max(...data);
        const range = maxValue - minValue;
        const scaleFactor = range > 0 ? 1 / range : 1;
        
        for (let i = 0; i < canvasWidth; i++) {
          const dataIndex = (offsetRef.current + i * 2) % data.length;
          const rawValue = data[dataIndex] || 0;
          // Normalize the value relative to the baseline (center of data range)
          const baselineValue = (minValue + maxValue) / 2;
          const normalizedValue = (rawValue - baselineValue) * scaleFactor;
          const x = i;
          const y = centerY - (normalizedValue * amplitude);
          
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        
        ctx.stroke();
        
        // Update offset for animation
        offsetRef.current = (offsetRef.current + 1) % data.length; // Slower animation
      } else {
        // Draw baseline when no data
        ctx.beginPath();
        ctx.moveTo(0, canvasHeight / 2);
        ctx.lineTo(canvasWidth, canvasHeight / 2);
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      if (isActive) {
        animationRef.current = requestAnimationFrame(drawECG);
      }
    };

    const drawStaticECG = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      
      // Draw grid
      drawGrid();
      
      // Draw static ECG trace
      ctx.strokeStyle = '#9CA3AF'; // Gray when inactive
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      if (data.length > 0) {
        ctx.beginPath();
        const centerY = canvasHeight / 2;
        const amplitude = canvasHeight * 0.35;
        
        for (let i = 0; i < Math.min(canvasWidth, data.length); i++) {
          const value = data[i] || 0;
          const x = (i / data.length) * canvasWidth;
          const y = centerY - (value * amplitude);
          
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      } else {
        // Draw baseline
        ctx.beginPath();
        ctx.moveTo(0, canvasHeight / 2);
        ctx.lineTo(canvasWidth, canvasHeight / 2);
        ctx.stroke();
      }
    };

    if (isActive) {
      drawECG();
    } else {
      drawStaticECG();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [data, isActive]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ width: '100%', height: '100%' }}
    />
  );
}
