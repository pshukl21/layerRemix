import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Clock, Loader2 } from 'lucide-react';
import { fetchContests, Contest } from '../lib/contests';

export const ContestsScreen: React.FC = () => {
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {contests.map((contest) => {
          const deadline = formatDeadline(contest.deadline);
          return (
            <Link
              key={contest.id}
              to={`/contests/${contest.id}`}
              className="group bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-blue-300 transition-all"
            >
              <div className="aspect-[4/5] overflow-hidden bg-slate-100 relative">
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
              </div>
              <div className="p-4">
                <h2 className="font-black text-base text-slate-900 group-hover:text-blue-600 transition-colors">
                  {contest.title}
                </h2>
                <p className="text-xs text-slate-500 font-semibold mt-1 line-clamp-2">{contest.description}</p>
                <p className="text-[11px] text-slate-400 font-bold mt-2">Base file by @{contest.baseAuthor}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};
