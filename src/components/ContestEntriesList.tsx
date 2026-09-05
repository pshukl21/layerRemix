import React from 'react';
import { Artwork } from '../types';

interface ContestEntriesListProps {
  entries: Artwork[];
  totalCount: number;
  maxShow: number;
  onSelectArtwork: (artworkId: string) => void;
}

// The one shared "Entries" display — used identically on both the
// contests list page (compact, per card) and the individual contest page
// (same style, just allowed to show more of them). Keeping this as one
// component guarantees the two never visually drift apart again.
export const ContestEntriesList: React.FC<ContestEntriesListProps> = ({
  entries,
  totalCount,
  maxShow,
  onSelectArtwork,
}) => {
  if (totalCount === 0) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Entries</h3>
        <span className="text-[10px] font-bold text-slate-400">{totalCount} submitted</span>
      </div>
      <div className="flex flex-col gap-2">
        {entries.slice(0, maxShow).map((artwork) => (
          <div
            key={artwork.id}
            onClick={(e) => {
              e.stopPropagation();
              onSelectArtwork(artwork.id);
            }}
            className="flex items-center gap-2.5 cursor-pointer rounded-lg p-1.5 hover:bg-slate-50 transition-colors"
          >
            <img
              src={artwork.image}
              alt={artwork.title}
              className="w-9 h-9 rounded-md object-cover shrink-0 border border-slate-200"
              style={{ objectPosition: `${artwork.focalX ?? 50}% ${artwork.focalY ?? 50}%` }}
            />
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-800 truncate">{artwork.title}</div>
              <div className="text-[10px] font-semibold text-slate-400 truncate">by @{artwork.author}</div>
            </div>
          </div>
        ))}
        {totalCount > maxShow && (
          <p className="text-[10px] font-bold text-slate-400 pl-1.5">+{totalCount - maxShow} more</p>
        )}
      </div>
    </div>
  );
};
