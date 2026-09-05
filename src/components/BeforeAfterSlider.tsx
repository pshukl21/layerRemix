import React, { useRef, useState, useCallback } from 'react';
import { ArrowLeftRight } from 'lucide-react';

interface BeforeAfterSliderProps {
  beforeImage: string;
  afterImage: string;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
}

// Draggable before/after comparison — drag the handle (or tap/click
// anywhere on the image) to reveal more of one side or the other. Works
// with mouse, touch, and keyboard (left/right arrows once focused) for
// accessibility.
export const BeforeAfterSlider: React.FC<BeforeAfterSliderProps> = ({
  beforeImage,
  afterImage,
  beforeLabel = 'Before',
  afterLabel = 'After',
  className = '',
}) => {
  const [position, setPosition] = useState(50); // percent, 0 = all "before", 100 = all "after"
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const updateFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(100, Math.max(0, pct)));
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    draggingRef.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    updateFromClientX(e.clientX);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    updateFromClientX(e.clientX);
  };
  const handlePointerUp = () => {
    draggingRef.current = false;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') setPosition((p) => Math.max(0, p - 5));
    if (e.key === 'ArrowRight') setPosition((p) => Math.min(100, p + 5));
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      className={`relative w-full aspect-[4/5] rounded-xl overflow-hidden select-none cursor-ew-resize touch-none ${className}`}
    >
      {/* After — full image, sits underneath */}
      <img
        src={afterImage}
        alt={afterLabel}
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
      />
      <div className="absolute top-0 right-0 flex items-center gap-1.5 bg-[#3f3f46]/90 backdrop-blur-xs px-2.5 py-1.5 pointer-events-none">
        <span className="text-[10px] font-bold text-zinc-200 truncate">{afterLabel}</span>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
      </div>

      {/* Before — clipped to the handle position, sits on top */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ width: `${position}%` }}
      >
        <img
          src={beforeImage}
          alt={beforeLabel}
          draggable={false}
          className="absolute inset-0 h-full object-cover"
          style={{ width: `${(100 / Math.max(position, 0.001)) * 100}%`, maxWidth: 'none' }}
        />
        <div className="absolute top-0 left-0 flex items-center gap-1.5 bg-[#3f3f46]/90 backdrop-blur-xs px-2.5 py-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
          <span className="text-[10px] font-bold text-zinc-200 truncate">{beforeLabel}</span>
        </div>
      </div>

      {/* Divider + drag handle */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.15)] pointer-events-none"
        style={{ left: `${position}%` }}
      />
      <div
        tabIndex={0}
        onKeyDown={handleKeyDown}
        role="slider"
        aria-label="Before/after comparison position"
        aria-valuenow={Math.round(position)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-white shadow-lg border border-slate-200 flex items-center justify-center cursor-ew-resize focus:outline-none focus:ring-2 focus:ring-blue-500"
        style={{ left: `${position}%` }}
      >
        <ArrowLeftRight className="w-4 h-4 text-slate-700" />
      </div>
    </div>
  );
};
