import { useEffect, useRef } from 'react';
import { drawVectorToCanvas } from '../lib/faceMath';

interface FaceCanvasProps {
  vector: number[];
  className?: string;
  title?: string;
  key?: any;
}

export default function FaceCanvas({ vector, className = 'w-16 h-16', title }: FaceCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && vector && vector.length === 1024) {
      drawVectorToCanvas(vector, canvasRef.current);
    }
  }, [vector]);

  return (
    <div className="flex flex-col items-center justify-center p-1 bg-white border border-slate-100 rounded-lg shadow-xs">
      <canvas
        ref={canvasRef}
        className={`${className} image-render-pixelated border border-slate-200 rounded-md bg-slate-50`}
        title={title}
      />
      {title && (
        <span className="text-[10px] font-mono mt-1 text-slate-500 truncate max-w-full font-medium">
          {title}
        </span>
      )}
    </div>
  );
}
