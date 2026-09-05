import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Trophy, Clock, Download, GitFork, ArrowLeft, Loader2 } from 'lucide-react';
import { fetchContestById, Contest } from '../lib/contests';
import { Artwork } from '../types';
import { getDownloadTarget, incrementDownloads } from '../lib/artworks';
import { useAuth } from '../contexts/AuthContext';

interface ContestDetailScreenProps {
  artworks: Artwork[];
  onSelectArtwork: (artworkId: string) => void;
  onRequireAuth: () => void;
}

interface EntryNode {
  artwork: Artwork;
  children: EntryNode[];
}

export const ContestDetailScreen: React.FC<ContestDetailScreenProps> = ({ artworks, onSelectArtwork, onRequireAuth }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [contest, setContest] = useState<Contest | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetchContestById(id).then((data) => {
      setContest(data);
      setLoading(false);
    });
  }, [id]);

  const baseArtwork = contest ? artworks.find((a) => a.id === contest.baseArtworkId) : undefined;

  const buildEntryTree = (rootId: string): EntryNode | null => {
    const root = artworks.find((a) => a.id === rootId);
    if (!root) return null;
    const children = artworks
      .filter((a) => a.parentArtworkId === rootId)
      .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
      .map((child) => buildEntryTree(child.id))
      .filter((n): n is EntryNode => n !== null);
    return { artwork: root, children };
  };

  const entryTree = contest ? buildEntryTree(contest.baseArtworkId) : null;

  const countEntries = (node: EntryNode): number =>
    node.children.reduce((acc, child) => acc + 1 + countEntries(child), 0);

  const handleDownload = async () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    if (!baseArtwork) return;
    const { url, filename } = getDownloadTarget(baseArtwork);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    incrementDownloads(baseArtwork.id);
  };

  const handleFork = () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    if (baseArtwork) navigate(`/art/${baseArtwork.id}?fork=true`);
  };

  if (loading) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!contest || !baseArtwork) {
    return (
      <div className="w-full min-h-screen flex flex-col items-center justify-center text-center px-6">
        <p className="text-sm font-bold text-slate-500 mb-4">This contest couldn't be found.</p>
        <Link to="/contests" className="text-sm font-bold text-blue-600 hover:underline">
          Back to Contests
        </Link>
      </div>
    );
  }

  const isPastDeadline = contest.deadline ? new Date(contest.deadline).getTime() < Date.now() : false;

  return (
    <div className="w-full min-h-screen text-slate-900 pt-24 pb-20 px-6 md:px-12 max-w-5xl mx-auto">
      <Link
        to="/contests"
        className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-blue-600 uppercase tracking-widest mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Contests
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-6">
          <div className="max-w-[460px] mx-auto w-full rounded-xl overflow-hidden border border-slate-300 shadow-sm">
            <img
              src={baseArtwork.image}
              alt={contest.title}
              className="w-full aspect-[4/5] object-cover"
              style={{ objectPosition: `${baseArtwork.focalX ?? 50}% ${baseArtwork.focalY ?? 50}%` }}
            />
          </div>
        </div>

        <div className="lg:col-span-6 flex flex-col gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              <h1 className="text-2xl font-black text-slate-900">{contest.title}</h1>
            </div>
            {contest.deadline && (
              <div
                className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-md mb-4 ${
                  isPastDeadline ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                {isPastDeadline ? 'Contest ended' : `Ends ${new Date(contest.deadline).toLocaleDateString()}`}
              </div>
            )}

            {(contest.prizeFirst || contest.prizeSecond || contest.prizeThird) && (
              <div className="flex flex-col gap-1.5 bg-amber-50/60 border border-amber-100 rounded-lg px-3.5 py-3 mb-4">
                <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-0.5">Prizes</p>
                {contest.prizeFirst && (
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                    <span className="text-lg">🥇</span>
                    {contest.prizeFirst}
                  </div>
                )}
                {contest.prizeSecond && (
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                    <span className="text-lg">🥈</span>
                    {contest.prizeSecond}
                  </div>
                )}
                {contest.prizeThird && (
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                    <span className="text-lg">🥉</span>
                    {contest.prizeThird}
                  </div>
                )}
              </div>
            )}

            <p className="text-sm text-slate-600 font-semibold leading-relaxed whitespace-pre-line mb-5">
              {contest.description}
            </p>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={handleDownload}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-widest rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98]"
              >
                <Download className="w-4 h-4" />
                Download Base PSD
              </button>
              <button
                onClick={handleFork}
                className="w-full py-3 border-2 border-blue-600 text-blue-600 hover:bg-blue-50 font-bold text-xs uppercase tracking-widest rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98]"
              >
                <GitFork className="w-4 h-4" />
                Enter With Your Remix
              </button>
            </div>
          </div>

          {entryTree && countEntries(entryTree) > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Entries</h3>
                <span className="text-[10px] font-bold text-slate-400">{countEntries(entryTree)} submitted</span>
              </div>
              <div className="flex flex-col gap-2">
                {entryTree.children.slice(0, 5).map((node) => (
                  <div
                    key={node.artwork.id}
                    onClick={() => onSelectArtwork(node.artwork.id)}
                    className="flex items-center gap-2.5 cursor-pointer rounded-lg p-1.5 hover:bg-slate-50 transition-colors"
                  >
                    <img
                      src={node.artwork.image}
                      alt={node.artwork.title}
                      className="w-9 h-9 rounded-md object-cover shrink-0 border border-slate-200"
                      style={{ objectPosition: `${node.artwork.focalX ?? 50}% ${node.artwork.focalY ?? 50}%` }}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800 truncate">{node.artwork.title}</div>
                      <div className="text-[10px] font-semibold text-slate-400 truncate">by @{node.artwork.author}</div>
                    </div>
                  </div>
                ))}
                {entryTree.children.length > 5 && (
                  <p className="text-[10px] font-bold text-slate-400 pl-1.5">
                    +{entryTree.children.length - 5} more
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
