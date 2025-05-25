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

    const drawECG = () => {
      if (!isActive) return;

      // Clear canvas
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      
      // Set ECG line properties
      ctx.strokeStyle = '#10B981'; // Medical green
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (data.length > 0) {
        ctx.beginPath();
        
        const centerY = canvasHeight / 2;
        const amplitude = canvasHeight * 0.3; // Scale amplitude
        
        for (let i = 0; i < canvasWidth; i++) {
          const dataIndex = (offsetRef.current + i * 2) % data.length;
          const value = data[dataIndex] || 0;
          const x = i;
          const y = centerY - (value * amplitude);
          
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        
        ctx.stroke();
        
        // Update offset for animation
        offsetRef.current = (offsetRef.current + 2) % data.length;
      } else {
        // Draw baseline when no data
        ctx.beginPath();
        ctx.moveTo(0, canvasHeight / 2);
        ctx.lineTo(canvasWidth, canvasHeight / 2);
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      if (isActive) {
        animationRef.current = requestAnimationFrame(drawECG);
      }
    };

    if (isActive) {
      drawECG();
    } else {
      // Draw static line when inactive
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      ctx.beginPath();
      ctx.moveTo(0, canvasHeight / 2);
      ctx.lineTo(canvasWidth, canvasHeight / 2);
      ctx.strokeStyle = '#6B7280'; // Gray when inactive
      ctx.lineWidth = 1;
      ctx.stroke();
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
