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
  const animationRef = useRef<number | null>(null);
  const dataRef = useRef<number[]>(data);
  const activeRef = useRef(isActive);
  const metricsRef = useRef({ width, height, dpr: 1 });
  const gridCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scaleStateRef = useRef<{ baseline: number; range: number } | null>(null);
  const startLoopRef = useRef<() => void>(() => {});
  const stopLoopRef = useRef<() => void>(() => {});
  const drawInactiveRef = useRef<() => void>(() => {});

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    activeRef.current = isActive;
  }, [isActive]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const drawGridCache = (canvasWidth: number, canvasHeight: number, dpr: number) => {
      const grid = document.createElement("canvas");
      grid.width = Math.max(1, Math.floor(canvasWidth * dpr));
      grid.height = Math.max(1, Math.floor(canvasHeight * dpr));

      const gridCtx = grid.getContext("2d");
      if (!gridCtx) return;

      gridCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      gridCtx.clearRect(0, 0, canvasWidth, canvasHeight);

      const majorSpacing = 25;
      const minorSpacing = 5;

      gridCtx.strokeStyle = "#E5E7EB";
      gridCtx.lineWidth = 0.5;
      for (let x = 0; x <= canvasWidth; x += majorSpacing) {
        gridCtx.beginPath();
        gridCtx.moveTo(x, 0);
        gridCtx.lineTo(x, canvasHeight);
        gridCtx.stroke();
      }
      for (let y = 0; y <= canvasHeight; y += majorSpacing) {
        gridCtx.beginPath();
        gridCtx.moveTo(0, y);
        gridCtx.lineTo(canvasWidth, y);
        gridCtx.stroke();
      }

      gridCtx.strokeStyle = "#F3F4F6";
      gridCtx.lineWidth = 0.3;
      for (let x = 0; x <= canvasWidth; x += minorSpacing) {
        if (x % majorSpacing !== 0) {
          gridCtx.beginPath();
          gridCtx.moveTo(x, 0);
          gridCtx.lineTo(x, canvasHeight);
          gridCtx.stroke();
        }
      }
      for (let y = 0; y <= canvasHeight; y += minorSpacing) {
        if (y % majorSpacing !== 0) {
          gridCtx.beginPath();
          gridCtx.moveTo(0, y);
          gridCtx.lineTo(canvasWidth, y);
          gridCtx.stroke();
        }
      }

      gridCanvasRef.current = grid;
    };

    const configureCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const canvasWidth = rect.width || width;
      const canvasHeight = rect.height || height;

      metricsRef.current = { width: canvasWidth, height: canvasHeight, dpr };

      canvas.width = Math.max(1, Math.floor(canvasWidth * dpr));
      canvas.height = Math.max(1, Math.floor(canvasHeight * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      drawGridCache(canvasWidth, canvasHeight, dpr);
    };

    const drawFrame = (traceColor: string) => {
      const { width: canvasWidth, height: canvasHeight } = metricsRef.current;

      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      if (gridCanvasRef.current) {
        ctx.drawImage(gridCanvasRef.current, 0, 0, canvasWidth, canvasHeight);
      }

      const source = dataRef.current;
      if (!source || source.length === 0) {
        ctx.strokeStyle = traceColor;
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.moveTo(0, canvasHeight / 2);
        ctx.lineTo(canvasWidth, canvasHeight / 2);
        ctx.stroke();
        return;
      }

      const maxPoints = Math.max(120, Math.floor(canvasWidth * 2));
      const step = Math.max(1, Math.ceil(source.length / maxPoints));
      const points: number[] = [];
      for (let i = 0; i < source.length; i += step) {
        points.push(source[i]);
      }

      let minValue = Number.POSITIVE_INFINITY;
      let maxValue = Number.NEGATIVE_INFINITY;
      for (let i = 0; i < points.length; i++) {
        const value = points[i];
        if (value < minValue) minValue = value;
        if (value > maxValue) maxValue = value;
      }

      const targetBaseline = (minValue + maxValue) / 2;
      const targetRange = Math.max(maxValue - minValue, 1e-6);

      if (!scaleStateRef.current) {
        scaleStateRef.current = { baseline: targetBaseline, range: targetRange };
      } else {
        const alpha = 0.1;
        scaleStateRef.current.baseline += (targetBaseline - scaleStateRef.current.baseline) * alpha;
        scaleStateRef.current.range += (targetRange - scaleStateRef.current.range) * alpha;
      }

      const baseline = scaleStateRef.current.baseline;
      const range = Math.max(scaleStateRef.current.range, 1e-6);
      const centerY = canvasHeight / 2;
      const amplitude = canvasHeight * 0.4;

      ctx.strokeStyle = traceColor;
      ctx.lineWidth = 1.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();

      const lastIndex = points.length - 1;
      for (let i = 0; i <= lastIndex; i++) {
        const x = lastIndex > 0 ? (i / lastIndex) * canvasWidth : 0;
        const normalized = (points[i] - baseline) / (range / 2);
        const y = centerY - Math.max(-1.2, Math.min(1.2, normalized)) * amplitude;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
    };

    const tick = () => {
      if (!activeRef.current) {
        animationRef.current = null;
        drawFrame("#9CA3AF");
        return;
      }

      drawFrame("#EF4444");
      animationRef.current = requestAnimationFrame(tick);
    };

    const startLoop = () => {
      if (animationRef.current !== null) return;
      animationRef.current = requestAnimationFrame(tick);
    };

    const stopLoop = () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };

    startLoopRef.current = startLoop;
    stopLoopRef.current = stopLoop;
    drawInactiveRef.current = () => {
      drawFrame("#9CA3AF");
    };

    const handleResize = () => {
      configureCanvas();
      scaleStateRef.current = null;
      if (!activeRef.current) {
        drawFrame("#9CA3AF");
      }
    };

    let resizeObserver: ResizeObserver | null = null;

    configureCanvas();
    if (activeRef.current) {
      startLoop();
    } else {
      drawFrame("#9CA3AF");
    }

    window.addEventListener("resize", handleResize);
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      resizeObserver.observe(canvas);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      stopLoop();
    };
  }, [width, height, leadName]);

  useEffect(() => {
    if (isActive) {
      startLoopRef.current();
      return;
    }

    stopLoopRef.current();
    drawInactiveRef.current();
  }, [isActive]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ width: '100%', height: '100%' }}
    />
  );
}
