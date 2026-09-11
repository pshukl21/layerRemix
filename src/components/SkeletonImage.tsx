import React, { useState } from 'react';
import { Palette } from 'lucide-react';

interface SkeletonImageProps {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
}

// Drop-in replacement for a plain <img> that shows a pulsing gray
// placeholder — the same pattern YouTube, Instagram, etc. use — until the
// real image has actually finished loading, instead of a blank/white gap.
// If the image fails to load, shows a soft palette-icon placeholder
// instead of revealing nothing.
// Assumes the parent element already establishes the sizing/aspect ratio
// (e.g. via `aspect-[4/5]`), same as a plain <img> would.
export const SkeletonImage: React.FC<SkeletonImageProps> = ({ src, alt, className, style, referrerPolicy }) => {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');

  return (
    <div className="relative w-full h-full">
      {status === 'loading' && <div className="absolute inset-0 bg-slate-200 animate-pulse" />}
      {status === 'error' && (
        <div className="absolute inset-0 bg-slate-100 flex items-center justify-center text-slate-300">
          <Palette className="w-7 h-7" />
        </div>
      )}
      {status !== 'error' && (
        <img
          className={`${className || ''} transition-opacity duration-300 ${status === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
          style={style}
          src={src}
          alt={alt}
          referrerPolicy={referrerPolicy}
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
        />
      )}
    </div>
  );
};
