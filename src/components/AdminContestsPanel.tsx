import React, { useEffect, useState } from 'react';
import { Trophy, Trash2, Loader2 } from 'lucide-react';
import { fetchContests, createContest, deleteContest, Contest } from '../lib/contests';
import { Artwork } from '../types';

const DEFAULT_DESCRIPTION = `How to enter:
1. Download the base PSD above.
2. Remix it — change whatever you want, make it your own.
3. Hit "Enter With Your Remix" and publish your version.

Your entry will automatically show up in this contest's entry list.`;

interface AdminContestsPanelProps {
  artworks: Artwork[];
  currentUserId: string;
}

// Admin-only panel for creating and managing contests — kept off the
// contests page itself, same pattern as the hero settings and reports
// panels, so this only ever shows on the admin's own profile page.
export const AdminContestsPanel: React.FC<AdminContestsPanelProps> = ({ artworks, currentUserId }) => {
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState(DEFAULT_DESCRIPTION);
  const [baseArtworkId, setBaseArtworkId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ownArtworks = artworks.filter((a) => a.ownerId === currentUserId);

  const loadContests = () => {
    fetchContests().then((data) => {
      setContests(data);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadContests();
  }, []);

  const handleCreate = async () => {
    if (!title.trim() || !description.trim() || !baseArtworkId) {
      setError('Title, description, and a base artwork are all required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const { error: err } = await createContest(
      title.trim(),
      description.trim(),
      baseArtworkId,
      deadline ? new Date(deadline).toISOString() : null,
      currentUserId
    );
    setSubmitting(false);
    if (err) {
      setError(err);
      return;
    }
    setTitle('');
    setDescription(DEFAULT_DESCRIPTION);
    setBaseArtworkId('');
    setDeadline('');
    loadContests();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this contest? Entries (remixes) are not affected, only the contest listing itself.')) return;
    const { error: err } = await deleteContest(id);
    if (err) {
      setError(err);
      return;
    }
    setContests((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="mb-10 bg-amber-50/50 border border-amber-200 rounded-xl p-5">
      <h2 className="text-[10px] font-bold text-amber-700 uppercase tracking-widest mb-1">Admin Only</h2>
      <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
        <Trophy className="w-4 h-4 text-amber-500" />
        Contests
      </h3>

      <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">New Contest</p>
        <div className="flex flex-col gap-2.5">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Contest title"
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            placeholder="Rules / description"
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 resize-none"
          />
          <select
            value={baseArtworkId}
            onChange={(e) => setBaseArtworkId(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-600 cursor-pointer"
          >
            <option value="">Select base file (from your own uploads)…</option>
            {ownArtworks.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Deadline (optional)
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-600"
            />
          </div>
          {error && <p className="text-[11px] font-semibold text-red-600">{error}</p>}
          <button
            onClick={handleCreate}
            disabled={submitting}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-xs rounded-lg cursor-pointer transition-all"
          >
            {submitting ? 'Creating…' : 'Create Contest'}
          </button>
        </div>
        {ownArtworks.length === 0 && (
          <p className="text-[11px] text-slate-400 font-semibold mt-2">
            Upload the base PSD through the normal Upload page first, then it'll show up here to pick from.
          </p>
        )}
      </div>

      {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}

      <div className="flex flex-col gap-2">
        {contests.map((contest) => (
          <div key={contest.id} className="bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">{contest.title}</p>
              <p className="text-[10px] text-slate-400 font-semibold">Base: {contest.baseTitle}</p>
            </div>
            <button
              onClick={() => handleDelete(contest.id)}
              className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center transition-all cursor-pointer shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-600" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
