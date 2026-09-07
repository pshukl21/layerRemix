import React, { useState } from 'react';
import { X, Upload, Loader2 } from 'lucide-react';
import { Artwork } from '../types';

interface AdminReplacePreviewModalProps {
  open: boolean;
  artwork: Artwork | null;
  onClose: () => void;
  onSave: (artworkId: string, file: File) => Promise<{ error: string | null }>;
}

// Deliberately narrow — an admin can replace the preview image of anyone's
// artwork (e.g. a broken upload, a low-quality contest entry thumbnail),
// but nothing else about their piece. Kept as its own small modal rather
// than folded into the full EditArtworkModal, so this capability can't
// accidentally grow into "admins can edit anyone's title/description/tags"
// — that's a different, bigger decision this doesn't make.
export const AdminReplacePreviewModal: React.FC<AdminReplacePreviewModalProps> = ({
  open,
  artwork,
  onClose,
  onSave,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setFile(null);
      setPreviewUrl(null);
      setError(null);
    }
  }, [open]);

  if (!open || !artwork) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (!picked) return;
    if (!picked.type.startsWith('image/')) {
      setError('Please choose an image file (JPG, PNG, WebP).');
      return;
    }
    setError(null);
    setFile(picked);
    setPreviewUrl(URL.createObjectURL(picked));
  };

  const handleSave = async () => {
    if (!file) {
      setError('Choose a replacement image first.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const { error: saveError } = await onSave(artwork.id, file);
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
        <h2 className="text-base font-black text-slate-900 mb-1">Replace Preview Image</h2>
        <p className="text-xs text-slate-500 font-semibold mb-4">
          For "{artwork.title}" by @{artwork.author}. This only changes the preview thumbnail — nothing else about
          their upload.
        </p>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Current</p>
            <img
              src={artwork.image}
              alt="Current preview"
              className="w-full aspect-[4/5] object-cover rounded-lg border border-slate-200"
              style={{ objectPosition: `${artwork.focalX ?? 50}% ${artwork.focalY ?? 50}%` }}
            />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">New</p>
            {previewUrl ? (
              <img src={previewUrl} alt="New preview" className="w-full aspect-[4/5] object-cover rounded-lg border-2 border-blue-500" />
            ) : (
              <div className="w-full aspect-[4/5] rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center">
                <Upload className="w-5 h-5 text-slate-300" />
              </div>
            )}
          </div>
        </div>

        <label className="block w-full py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-widest text-center cursor-pointer transition-all mb-3">
          Choose Image
          <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </label>

        {error && <p className="text-xs font-semibold text-red-600 mb-3">{error}</p>}

        <button
          onClick={handleSave}
          disabled={submitting || !file}
          className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          {submitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Saving…
            </>
          ) : (
            'Save New Preview'
          )}
        </button>
      </div>
    </div>
  );
};
