import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Trophy, Clock, Download, GitFork, ArrowLeft, Loader2, X, Trash2, Eye } from 'lucide-react';
import { fetchContestById, Contest } from '../lib/contests';
import { Artwork } from '../types';
import { getDownloadTarget, incrementDownloads, triggerFileDownload } from '../lib/artworks';
import { useAuth } from '../contexts/AuthContext';
import { ContestEntriesList } from './ContestEntriesList';

interface ContestDetailScreenProps {
  artworks: Artwork[];
  onSelectArtwork: (artworkId: string) => void;
  onRequireAuth: () => void;
  onDeleteArtwork: (artworkId: string) => Promise<{ error: string | null }>;
}

interface EntryNode {
  artwork: Artwork;
  children: EntryNode[];
}

export const ContestDetailScreen: React.FC<ContestDetailScreenProps> = ({
  artworks,
  onSelectArtwork,
  onRequireAuth,
  onDeleteArtwork,
}) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [contest, setContest] = useState<Contest | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAlreadyEnteredModal, setShowAlreadyEnteredModal] = useState(false);
  const [deletingEntry, setDeletingEntry] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  // A contest entry is just a remix of the base file — so "already
  // entered" means the current user owns some remix whose parent is this
  // contest's base artwork.
  const myExistingEntry = user
    ? artworks.find((a) => a.ownerId === user.id && a.parentArtworkId === contest?.baseArtworkId)
    : undefined;

  const handleDownload = async () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    if (!baseArtwork) return;
    const downloadTarget = await getDownloadTarget(baseArtwork);
    if (downloadTarget.error) {
      window.alert(downloadTarget.error);
      return;
    }
    triggerFileDownload(downloadTarget.url, downloadTarget.filename);
    incrementDownloads(baseArtwork.id);
  };

  const handleFork = () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    if (myExistingEntry) {
      setDeleteError(null);
      setShowAlreadyEnteredModal(true);
      return;
    }
    if (baseArtwork) navigate(`/art/${baseArtwork.id}?fork=true`);
  };

  const handleDeleteAndReenter = async () => {
    if (!myExistingEntry || !baseArtwork) return;
    setDeletingEntry(true);
    setDeleteError(null);
    const { error } = await onDeleteArtwork(myExistingEntry.id);
    setDeletingEntry(false);
    if (error) {
      setDeleteError(error);
      return;
    }
    setShowAlreadyEnteredModal(false);
    navigate(`/art/${baseArtwork.id}?fork=true`);
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
  const hasPrizes = contest.prizeFirst || contest.prizeSecond || contest.prizeThird;
  const entryCount = entryTree ? countEntries(entryTree) : 0;

  const winnerMedals: Record<string, '🥇' | '🥈' | '🥉'> = {};
  if (contest.winnerFirstArtworkId) winnerMedals[contest.winnerFirstArtworkId] = '🥇';
  if (contest.winnerSecondArtworkId) winnerMedals[contest.winnerSecondArtworkId] = '🥈';
  if (contest.winnerThirdArtworkId) winnerMedals[contest.winnerThirdArtworkId] = '🥉';
  const hasWinners = Object.keys(winnerMedals).length > 0;
  const winnerEntries = [
    { medal: '🥇' as const, artwork: artworks.find((a) => a.id === contest.winnerFirstArtworkId) },
    { medal: '🥈' as const, artwork: artworks.find((a) => a.id === contest.winnerSecondArtworkId) },
    { medal: '🥉' as const, artwork: artworks.find((a) => a.id === contest.winnerThirdArtworkId) },
  ].filter((w): w is { medal: '🥇' | '🥈' | '🥉'; artwork: Artwork } => !!w.artwork);

  return (
    <div className="w-full min-h-screen text-slate-900 pt-24 pb-20 px-6 md:px-12 max-w-7xl mx-auto">
      <Link
        to="/contests"
        className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-blue-600 uppercase tracking-widest mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Contests
      </Link>

      {/* Image and contest info sit side by side, both visible without
          scrolling — entries move to a full-width section below instead of
          a tall right column that's mostly empty when there aren't many
          submissions yet. */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-10">
        <div className="lg:col-span-5">
          <div className="max-w-[420px] mx-auto w-full rounded-xl overflow-hidden border border-slate-300 shadow-sm">
            <img
              src={baseArtwork.image}
              alt={contest.title}
              className="w-full aspect-[4/5] object-cover"
              style={{ objectPosition: `${baseArtwork.focalX ?? 50}% ${baseArtwork.focalY ?? 50}%` }}
            />
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              <h1 className="text-2xl font-black text-slate-900">{contest.title}</h1>
            </div>
            {contest.deadline && (
              <div
                className={`flex items-center gap-3 rounded-xl px-4 py-3 mb-4 ${
                  isPastDeadline
                    ? 'bg-slate-100 border border-slate-200'
                    : 'bg-gradient-to-r from-amber-50 to-amber-100/50 border-2 border-amber-300'
                }`}
              >
                <Clock className={`w-6 h-6 shrink-0 ${isPastDeadline ? 'text-slate-400' : 'text-amber-600'}`} />
                <div>
                  <p
                    className={`text-[11px] font-black uppercase tracking-widest ${
                      isPastDeadline ? 'text-slate-400' : 'text-amber-600'
                    }`}
                  >
                    {isPastDeadline ? 'Contest Ended' : 'Contest Ends'}
                  </p>
                  <p className={`text-xl font-black leading-tight ${isPastDeadline ? 'text-slate-500' : 'text-amber-800'}`}>
                    {new Date(contest.deadline).toLocaleDateString(undefined, {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                  {!isPastDeadline &&
                    (() => {
                      const daysLeft = Math.ceil((new Date(contest.deadline).getTime() - Date.now()) / 86400000);
                      return (
                        <p className="text-xs font-bold text-amber-600 mt-0.5">
                          {daysLeft <= 0 ? 'Ends today' : daysLeft === 1 ? '1 day left' : `${daysLeft} days left`}
                        </p>
                      );
                    })()}
                </div>
              </div>
            )}

            {hasPrizes && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-amber-50/60 border border-amber-100 rounded-lg px-3.5 py-2.5 mb-4">
                {contest.prizeFirst && (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 whitespace-nowrap">
                    <span className="text-base">🥇</span>
                    {contest.prizeFirst}
                  </div>
                )}
                {contest.prizeSecond && (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 whitespace-nowrap">
                    <span className="text-base">🥈</span>
                    {contest.prizeSecond}
                  </div>
                )}
                {contest.prizeThird && (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 whitespace-nowrap">
                    <span className="text-base">🥉</span>
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
                className={`w-full py-3 font-bold text-xs uppercase tracking-widest rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98] ${
                  myExistingEntry
                    ? 'bg-emerald-50 border-2 border-emerald-500 text-emerald-700 hover:bg-emerald-100'
                    : 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50'
                }`}
              >
                {myExistingEntry ? <Trophy className="w-4 h-4" /> : <GitFork className="w-4 h-4" />}
                {myExistingEntry ? "You've Entered — View or Change" : 'Enter With Your Remix'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {hasWinners && (
        <div className="bg-gradient-to-br from-amber-50 to-white border-2 border-amber-200 rounded-xl p-6 shadow-sm mb-8">
          <h3 className="text-sm font-black text-amber-700 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Trophy className="w-4 h-4" />
            Winners Announced
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {winnerEntries.map(({ medal, artwork }) => (
              <div
                key={artwork.id}
                onClick={() => onSelectArtwork(artwork.id)}
                className="cursor-pointer group bg-white border border-amber-100 rounded-lg p-3 flex items-center gap-3 hover:shadow-md transition-all"
              >
                <div className="relative shrink-0">
                  <img
                    src={artwork.image}
                    alt={artwork.title}
                    className="w-14 h-14 rounded-md object-cover border border-slate-200"
                    style={{ objectPosition: `${artwork.focalX ?? 50}% ${artwork.focalY ?? 50}%` }}
                  />
                  <span className="absolute -top-2 -right-2 text-xl leading-none drop-shadow">{medal}</span>
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-black text-slate-800 truncate group-hover:text-blue-600 transition-colors">
                    {artwork.title}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-400 truncate">by @{artwork.author}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {entryCount === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3">Entries</h3>
          <p className="text-sm font-bold text-slate-400 text-center py-10">
            No entries yet — be the first to remix and submit.
          </p>
        </div>
      ) : (
        <ContestEntriesList
          entries={entryTree ? entryTree.children.map((n) => n.artwork) : []}
          totalCount={entryCount}
          maxShow={20}
          onSelectArtwork={onSelectArtwork}
          winnerMedals={winnerMedals}
        />
      )}

      {showAlreadyEnteredModal && myExistingEntry && (
        <div
          className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setShowAlreadyEnteredModal(false)}
        >
          <div
            className="relative w-full max-w-sm bg-white rounded-xl shadow-2xl border border-slate-200 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowAlreadyEnteredModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              <h2 className="text-base font-black text-slate-900">You've already entered</h2>
            </div>
            <p className="text-xs text-slate-500 font-semibold leading-relaxed mb-5">
              You can only submit one entry per contest. Your current entry is{' '}
              <span className="font-bold text-slate-700">"{myExistingEntry.title}"</span>. Delete it to submit a
              different remix instead.
            </p>

            {deleteError && <p className="text-xs font-semibold text-red-600 mb-3">{deleteError}</p>}

            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => {
                  setShowAlreadyEnteredModal(false);
                  onSelectArtwork(myExistingEntry.id);
                }}
                className="w-full py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                View My Entry
              </button>
              <button
                onClick={handleDeleteAndReenter}
                disabled={deletingEntry}
                className="w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deletingEntry ? 'Deleting…' : 'Delete & Re-Enter'}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 font-semibold text-center mt-3">
              Deleting costs 1 credit, same as deleting any other upload.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
