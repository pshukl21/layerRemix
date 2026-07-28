import React, { useRef, useState } from 'react';
import { Move } from 'lucide-react';

interface FocalPointPickerProps {
  imageUrl: string;
  focalX: number;
  focalY: number;
  onChange: (x: number, y: number) => void;
  // CSS aspect-ratio value, e.g. "4/5" (default, matches gallery cards) or
  // "16/10" (matches the landscape cover on the artwork page itself).
  aspectRatio?: string;
  maxWidth?: string;
}

interface DragStart {
  pointerX: number;
  pointerY: number;
  focalX: number;
  focalY: number;
}

// A single box, shown at the same aspect ratio a gallery card actually
// crops to — what you see here is exactly what you'll get. Drag the image
// around inside the box to reposition it; this only changes where the crop
// is centered, never which image is shown.
export const FocalPointPicker: React.FC<FocalPointPickerProps> = ({
  imageUrl,
  focalX,
  focalY,
  onChange,
  aspectRatio = '4/5',
  maxWidth = '220px',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const naturalSizeRef = useRef<{ w: number; h: number } | null>(null);
  const dragStartRef = useRef<DragStart | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    naturalSizeRef.current = { w: img.naturalWidth, h: img.naturalHeight };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    setDragging(true);
    (e.target as Element).setPointerCapture(e.pointerId);
    dragStartRef.current = { pointerX: e.clientX, pointerY: e.clientY, focalX, focalY };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const container = containerRef.current;
    const natural = naturalSizeRef.current;
    const start = dragStartRef.current;
    if (!container || !natural || !start) return;

    const rect = container.getBoundingClientRect();
    const containerAspect = rect.width / rect.height;
    const imageAspect = natural.w / natural.h;

    // How much the "cover"-scaled image spills outside the box in each
    // direction — dragging only has room to matter along the axis that
    // actually overflows.
    let renderedW: number;
    let renderedH: number;
    if (imageAspect > containerAspect) {
      renderedH = rect.height;
      renderedW = rect.height * imageAspect;
    } else {
      renderedW = rect.width;
      renderedH = rect.width / imageAspect;
    }
    const overflowX = Math.max(0, renderedW - rect.width);
    const overflowY = Math.max(0, renderedH - rect.height);

    const dx = e.clientX - start.pointerX;
    const dy = e.clientY - start.pointerY;

    // Dragging the image right should reveal more of its left side, which
    // means moving the focal point toward 0% — hence the negation.
    const deltaX = overflowX > 0 ? (-dx / overflowX) * 100 : 0;
    const deltaY = overflowY > 0 ? (-dy / overflowY) * 100 : 0;

    const newX = Math.min(100, Math.max(0, start.focalX + deltaX));
    const newY = Math.min(100, Math.max(0, start.focalY + deltaY));
    onChange(Math.round(newX), Math.round(newY));
  };

  const handlePointerUp = () => setDragging(false);

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className={`relative w-full mx-auto rounded-lg overflow-hidden border-2 border-dashed bg-slate-100 select-none touch-none ${
          dragging ? 'border-blue-500' : 'border-blue-300'
        }`}
        style={{ cursor: dragging ? 'grabbing' : 'grab', aspectRatio, maxWidth }}
      >
        <img
          src={imageUrl}
          alt="Preview"
          onLoad={handleImageLoad}
          draggable={false}
          className="w-full h-full object-cover pointer-events-none"
          style={{ objectPosition: `${focalX}% ${focalY}%` }}
        />
        <div className="absolute bottom-2 right-2 bg-slate-950/60 backdrop-blur-xs rounded-md p-1.5 pointer-events-none">
          <Move className="w-3.5 h-3.5 text-white" />
        </div>
      </div>
      <div className="flex items-center justify-center gap-2">
        <p className="text-[11px] text-slate-400 font-semibold text-center">Drag the image to reposition it</p>
        {(focalX !== 50 || focalY !== 50) && (
          <button
            type="button"
            onClick={() => onChange(50, 50)}
            className="text-[11px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
};
