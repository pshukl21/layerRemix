import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Trophy } from 'lucide-react';
import { Contest } from '../lib/contests';

interface ContestPromoModalProps {
  contests: Contest[];
}

const SEEN_KEY = 'contestPromoSeenV1';
const SHOW_DELAY_MS = 4000;

// Shown once per visitor, ever — not once per session — so it can't
// become the kind of popup that hits someone on every single visit.
// Delayed a few seconds so it never fires the instant the page loads,
// giving a first-time visitor a moment to see the site is real before
// asking anything of them. Only appears if there's an actual contest
// still open to enter — never promotes one that's already ended.
export const ContestPromoModal: React.FC<ContestPromoModalProps> = ({ contests }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const activeContest = contests.find((c) => !c.deadline || new Date(c.deadline).getTime() > Date.now());

  useEffect(() => {
    if (!activeContest) return;
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(SEEN_KEY)) return;

    const timer = setTimeout(() => setOpen(true), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
    // Only re-evaluate when a contest actually becomes available to show —
    // not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!activeContest]);

  const handleClose = () => {
    setOpen(false);
    localStorage.setItem(SEEN_KEY, 'true');
  };

  const handleEnter = () => {
    handleClose();
    if (activeContest) navigate(`/contests/${activeContest.id}`);
  };

  if (!open || !activeContest) return null;

  const hasPrizes = activeContest.prizeFirst || activeContest.prizeSecond || activeContest.prizeThird;

  return (
    <div
      className="fixed inset-0 z-[300] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/90 hover:bg-white flex items-center justify-center text-slate-500 hover:text-slate-800 transition-all cursor-pointer shadow-sm"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="bg-gradient-to-br from-blue-600 to-blue-800 px-8 pt-10 pb-8 text-center">
          <div className="w-16 h-16 rounded-full bg-white/15 flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-8 h-8 text-amber-300" />
          </div>
          <p className="text-[11px] font-black text-blue-200 uppercase tracking-widest mb-2">Contest Open Now</p>
          <h2 className="text-2xl font-black text-white leading-tight">{activeContest.title}</h2>
        </div>

        <div className="px-8 py-7 text-center">
          {hasPrizes && (
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 mb-5">
              {activeContest.prizeFirst && (
                <span className="text-sm font-bold text-slate-700">🥇 {activeContest.prizeFirst}</span>
              )}
              {activeContest.prizeSecond && (
                <span className="text-sm font-bold text-slate-700">🥈 {activeContest.prizeSecond}</span>
              )}
              {activeContest.prizeThird && (
                <span className="text-sm font-bold text-slate-700">🥉 {activeContest.prizeThird}</span>
              )}
            </div>
          )}
          <p className="text-sm text-slate-500 font-semibold leading-relaxed mb-7">
            Download the base PSD, remix it into something new, and publish it to enter.
          </p>
          <div className="flex flex-col gap-2.5">
            <button
              onClick={handleEnter}
              className="w-full py-3.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-widest transition-all cursor-pointer active:scale-[0.98]"
            >
              See The Contest
            </button>
            <button
              onClick={handleClose}
              className="w-full py-2 text-slate-400 hover:text-slate-600 font-bold text-xs uppercase tracking-widest transition-all cursor-pointer"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
