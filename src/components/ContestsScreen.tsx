import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Clock, Loader2, ArrowRight } from 'lucide-react';
import { fetchContests, Contest } from '../lib/contests';
import { Artwork } from '../types';
import { ContestEntriesList } from './ContestEntriesList';

interface ContestsScreenProps {
  artworks: Artwork[];
  onSelectArtwork: (artworkId: string) => void;
}

export const ContestsScreen: React.FC<ContestsScreenProps> = ({ artworks, onSelectArtwork }) => {
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContests().then((data) => {
      setContests(data);
      setLoading(false);
    });
  }, []);

  const formatDeadline = (deadline: string | null) => {
    if (!deadline) return null;
    const date = new Date(deadline);
    const isPast = date.getTime() < Date.now();
    return {
      text: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
      isPast,
    };
  };

  // Direct entries for the compact card preview, plus a total count that
  // includes deeper remix-of-a-remix chains — same split the detail page
  // uses, kept consistent between the two so numbers never disagree.
  const getEntries = (baseArtworkId: string): Artwork[] =>
    artworks.filter((a) => a.parentArtworkId === baseArtworkId);

  const countAllDescendants = (artworkId: string): number => {
    const children = artworks.filter((a) => a.parentArtworkId === artworkId);
    return children.reduce((acc, child) => acc + 1 + countAllDescendants(child.id), 0);
  };

  return (
    <div className="w-full min-h-screen text-slate-900 pt-24 pb-20 px-6 md:px-12 max-w-7xl mx-auto">
      <header className="mb-10 text-center md:text-left">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 mb-2 flex items-center justify-center md:justify-start gap-3">
          <Trophy className="w-8 h-8 text-amber-500" />
          Contests
        </h1>
        <p className="text-sm md:text-base text-slate-500 font-semibold">
          Download the base PSD, remix it, and publish your version as an entry.
        </p>
      </header>

      {loading && (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      )}

      {!loading && contests.length === 0 && (
        <div className="text-center py-20">
          <p className="text-sm font-bold text-slate-400">No contests running right now — check back soon.</p>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {contests.map((contest) => {
          const deadline = formatDeadline(contest.deadline);
          const hasPrizes = contest.prizeFirst || contest.prizeSecond || contest.prizeThird;
          return (
            <div
              key={contest.id}
              className="group bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-blue-300 transition-all flex flex-col sm:flex-row"
            >
              <Link
                to={`/contests/${contest.id}`}
                className="sm:w-56 shrink-0 aspect-[4/5] sm:aspect-auto overflow-hidden bg-slate-100 relative block"
              >
                {contest.baseImage && (
                  <img
                    src={contest.baseImage}
                    alt={contest.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                )}
                {deadline && (
                  <div
                    className={`absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold ${
                      deadline.isPast ? 'bg-slate-800/80 text-slate-300' : 'bg-amber-500/90 text-white'
                    }`}
                  >
                    <Clock className="w-3 h-3" />
                    {deadline.isPast ? 'Ended' : deadline.text}
                  </div>
                )}
              </Link>
              <div className="p-5 flex flex-col gap-3 flex-1 min-w-0">
                <div>
                  <Link to={`/contests/${contest.id}`}>
                    <h2 className="font-black text-lg text-slate-900 group-hover:text-blue-600 transition-colors">
                      {contest.title}
                    </h2>
                  </Link>
                  <p className="text-[11px] text-slate-400 font-bold mt-1">Base file by @{contest.baseAuthor}</p>
                </div>

                {hasPrizes && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-amber-50/60 border border-amber-100 rounded-lg px-3 py-2">
                    {contest.prizeFirst && (
                      <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700 whitespace-nowrap">
                        <span>🥇</span>
                        {contest.prizeFirst}
                      </div>
                    )}
                    {contest.prizeSecond && (
                      <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700 whitespace-nowrap">
                        <span>🥈</span>
                        {contest.prizeSecond}
                      </div>
                    )}
                    {contest.prizeThird && (
                      <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700 whitespace-nowrap">
                        <span>🥉</span>
                        {contest.prizeThird}
                      </div>
                    )}
                  </div>
                )}

                <ContestEntriesList
                  entries={getEntries(contest.baseArtworkId)}
                  totalCount={countAllDescendants(contest.baseArtworkId)}
                  maxShow={2}
                  onSelectArtwork={onSelectArtwork}
                />

                <Link
                  to={`/contests/${contest.id}`}
                  className="mt-auto sm:w-fit sm:self-start px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-widest rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.98]"
                >
                  Enter Contest
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
