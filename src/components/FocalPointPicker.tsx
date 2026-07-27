import React, { useRef, useState } from 'react';
import { Target } from 'lucide-react';

interface FocalPointPickerProps {
  imageUrl: string;
  focalX: number;
  focalY: number;
  onChange: (x: number, y: number) => void;
}

// Lets someone choose which part of an image stays in frame when it's shown
// cropped elsewhere (gallery cards, profile cards, etc. all crop to a fixed
// aspect ratio via object-fit: cover). This never changes which image is
// used — only where the crop is centered — so it can't be used to swap in
// a different or misleading image.
export const FocalPointPicker: React.FC<FocalPointPickerProps> = ({ imageUrl, focalX, focalY, onChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const updateFromPointer = (clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100));
    onChange(Math.round(x), Math.round(y));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    setDragging(true);
    (e.target as Element).setPointerCapture(e.pointerId);
    updateFromPointer(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    updateFromPointer(e.clientX, e.clientY);
  };

  const handlePointerUp = () => setDragging(false);

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      {/* Full uncropped image with a draggable focal marker */}
      <div className="flex-1 space-y-1.5">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
          Click or drag to choose what stays in frame
        </label>
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="relative w-full aspect-[4/3] bg-slate-900 rounded-lg overflow-hidden cursor-crosshair select-none"
        >
          <img
            src={imageUrl}
            alt="Full preview"
            draggable={false}
            className="w-full h-full object-contain pointer-events-none"
          />
          <div
            className="absolute w-7 h-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-blue-600/70 shadow-lg pointer-events-none flex items-center justify-center"
            style={{ left: `${focalX}%`, top: `${focalY}%` }}
          >
            <Target className="w-3.5 h-3.5 text-white" />
          </div>
        </div>
      </div>

      {/* Live preview of the resulting crop, matching a gallery card */}
      <div className="w-full sm:w-32 space-y-1.5 shrink-0">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
          Card preview
        </label>
        <div className="w-full sm:w-32 aspect-[4/5] rounded-lg overflow-hidden border border-slate-200">
          <img
            src={imageUrl}
            alt="Cropped preview"
            className="w-full h-full object-cover"
            style={{ objectPosition: `${focalX}% ${focalY}%` }}
          />
        </div>
      </div>
    </div>
  );
};
