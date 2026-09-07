import React from 'react';
import { Artwork } from '../types';

interface ContestEntriesListProps {
  entries: Artwork[];
  totalCount: number;
  maxShow: number;
  onSelectArtwork: (artworkId: string) => void;
  // Maps an entry's artwork id to its medal, so winners can be badged and
  // surfaced to the top. Optional — omitted entirely when a contest has no
  // winners set yet, which is the common case while judging is still open.
  winnerMedals?: Record<string, '🥇' | '🥈' | '🥉'>;
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
  winnerMedals,
}) => {
  if (totalCount === 0) return null;

  // Winners (if any are set) float to the top of the list regardless of
  // submission order, so they're visible even when maxShow truncates the
  // rest — a winner shouldn't disappear into "+N more".
  const sortedEntries = winnerMedals
    ? [...entries].sort((a, b) => (winnerMedals[a.id] ? -1 : 0) - (winnerMedals[b.id] ? -1 : 0))
    : entries;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Entries</h3>
        <span className="text-[10px] font-bold text-slate-400">{totalCount} submitted</span>
      </div>
      <div className="flex flex-col gap-2">
        {sortedEntries.slice(0, maxShow).map((artwork) => {
          const medal = winnerMedals?.[artwork.id];
          return (
            <div
              key={artwork.id}
              onClick={(e) => {
                e.stopPropagation();
                onSelectArtwork(artwork.id);
              }}
              className={`flex items-center gap-2.5 cursor-pointer rounded-lg p-1.5 hover:bg-slate-50 transition-colors ${
                medal ? 'bg-amber-50/60' : ''
              }`}
            >
              <div className="relative shrink-0">
                <img
                  src={artwork.image}
                  alt={artwork.title}
                  className="w-9 h-9 rounded-md object-cover border border-slate-200"
                  style={{ objectPosition: `${artwork.focalX ?? 50}% ${artwork.focalY ?? 50}%` }}
                />
                {medal && (
                  <span className="absolute -top-1.5 -right-1.5 text-sm leading-none drop-shadow">{medal}</span>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-800 truncate">{artwork.title}</div>
                <div className="text-[10px] font-semibold text-slate-400 truncate">by @{artwork.author}</div>
              </div>
            </div>
          );
        })}
        {totalCount > maxShow && (
          <p className="text-[10px] font-bold text-slate-400 pl-1.5">+{totalCount - maxShow} more</p>
        )}
      </div>
    </div>
  );
};
