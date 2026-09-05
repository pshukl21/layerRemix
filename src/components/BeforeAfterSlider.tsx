import React, { useRef, useState, useCallback } from 'react';
import { ArrowLeftRight } from 'lucide-react';

interface BeforeAfterSliderProps {
  beforeImage: string;
  afterImage: string;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
  aspectRatio?: string; // Tailwind arbitrary value, e.g. "4/5" or "16/9"
  // Lets a caller flatten specific corners (e.g. "rounded-t-xl") when this
  // sits flush against another element, like a button directly below it,
  // rather than always rounding all four corners.
  roundedClassName?: string;
}

// Draggable before/after comparison — drag the handle (or tap/click
// anywhere on the image) to reveal more of one side or the other. Works
// with mouse, touch, and keyboard (left/right arrows once focused) for
// accessibility.
export const BeforeAfterSlider: React.FC<BeforeAfterSliderProps> = ({
  beforeImage,
  afterImage,
  beforeLabel,
  afterLabel,
  className = '',
  aspectRatio = '4/5',
  roundedClassName = 'rounded-xl',
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
      style={{ aspectRatio }}
      className={`relative w-full ${roundedClassName} overflow-hidden select-none cursor-ew-resize touch-none ${className}`}
    >
      {/* After — full image, sits underneath */}
      <img
        src={afterImage}
        alt={afterLabel || 'After'}
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
      />
      {afterLabel && (
        <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm text-white text-xs font-bold px-2 py-0.5 rounded pointer-events-none">
          {afterLabel}
        </div>
      )}

      {/* Before — clipped to the handle position, sits on top */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ width: `${position}%` }}
      >
        <img
          src={beforeImage}
          alt={beforeLabel || 'Before'}
          draggable={false}
          className="absolute inset-0 h-full object-cover"
          style={{ width: `${(100 / Math.max(position, 0.001)) * 100}%`, maxWidth: 'none' }}
        />
        {beforeLabel && (
          <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-sm text-white text-xs font-bold px-2 py-0.5 rounded">
            {beforeLabel}
          </div>
        )}
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
