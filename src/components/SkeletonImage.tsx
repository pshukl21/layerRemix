import React, { useState } from 'react';

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
// Assumes the parent element already establishes the sizing/aspect ratio
// (e.g. via `aspect-[4/5]`), same as a plain <img> would.
export const SkeletonImage: React.FC<SkeletonImageProps> = ({ src, alt, className, style, referrerPolicy }) => {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="relative w-full h-full">
      {!loaded && <div className="absolute inset-0 bg-slate-200 animate-pulse" />}
      <img
        className={`${className || ''} transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        style={style}
        src={src}
        alt={alt}
        referrerPolicy={referrerPolicy}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
      />
    </div>
  );
};
