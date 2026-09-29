import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Artwork } from '../types';

interface AdminEditTitleModalProps {
  open: boolean;
  artwork: Artwork | null;
  onClose: () => void;
  onSave: (artworkId: string, newTitle: string) => Promise<{ error: string | null }>;
}

// Deliberately narrow — same reasoning as AdminReplacePreviewModal: an admin
// can fix the title of anyone's artwork (a typo, a misleading name, contest
// entry cleanup), but nothing else about their piece. Kept as its own small
// modal rather than folded into the full EditArtworkModal, so this doesn't
// quietly grow into "admins can edit anyone's description/tags" — that
// would be a separate decision.
export const AdminEditTitleModal: React.FC<AdminEditTitleModalProps> = ({ open, artwork, onClose, onSave }) => {
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (open && artwork) {
      setTitle(artwork.title);
      setError(null);
    }
  }, [open, artwork]);

  if (!open || !artwork) return null;

  const handleSave = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Title cannot be empty.');
      return;
    }
    if (trimmed === artwork.title) {
      onClose();
      return;
    }
    setSubmitting(true);
    setError(null);
    const { error: saveError } = await onSave(artwork.id, trimmed);
    setSubmitting(false);
    if (saveError) {
      setError(saveError);
      return;
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm bg-white rounded-xl shadow-2xl border border-slate-200 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">Admin Only</p>
        <h2 className="text-base font-black text-slate-900 mb-1">Edit Title</h2>
        <p className="text-xs text-slate-500 font-semibold mb-4">
          By @{artwork.author}. This only changes the title — nothing else about their upload.
        </p>

        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
          Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 text-sm font-semibold text-slate-800 mb-4"
          placeholder="Artwork title"
        />

        {error && <p className="text-xs font-semibold text-red-600 mb-3">{error}</p>}

        <button
          onClick={handleSave}
          disabled={submitting || !title.trim()}
          className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          {submitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Saving…
            </>
          ) : (
            'Save Title'
          )}
        </button>
      </div>
    </div>
  );
};
