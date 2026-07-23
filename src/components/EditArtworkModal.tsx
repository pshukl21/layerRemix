import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, ImageIcon, UploadCloud, Trash2 } from 'lucide-react';
import { Artwork } from '../types';

interface EditArtworkModalProps {
  open: boolean;
  artwork: Artwork | null;
  onClose: () => void;
  onSave: (
    artworkId: string,
    updates: {
      title: string;
      description: string;
      tags: string[];
      newPreviewFile: File | null;
    }
  ) => Promise<{ error: string | null }>;
  onDelete?: (artworkId: string) => Promise<{ error: string | null }>;
}

export const EditArtworkModal: React.FC<EditArtworkModalProps> = ({ open, artwork, onClose, onSave, onDelete }) => {
  const [title, setTitle] = useState(artwork?.title || '');
  const [description, setDescription] = useState(artwork?.description || '');
  const [tagsInput, setTagsInput] = useState(artwork?.tags.join(', ') || '');
  const [newPreviewFile, setNewPreviewFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset local form state whenever a new artwork is opened for editing.
  React.useEffect(() => {
    if (open && artwork) {
      setTitle(artwork.title);
      setDescription(artwork.description);
      setTagsInput(artwork.tags.join(', '));
      setNewPreviewFile(null);
      setPreviewUrl(null);
      setError(null);
      setDeleteConfirming(false);
      setDeleteError(null);
    }
  }, [open, artwork]);

  if (!artwork) return null;

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please choose a valid image file (PNG/JPG).');
      return;
    }
    setNewPreviewFile(file);
    const reader = new FileReader();
    reader.onload = () => setPreviewUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      alert('Please enter a title.');
      return;
    }
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    setSubmitting(true);
    const { error: saveError } = await onSave(artwork.id, {
      title: title.trim(),
      description: description.trim() || 'No description provided.',
      tags: tags.length > 0 ? tags : ['DigitalArt'],
      newPreviewFile,
    });
    setSubmitting(false);
    if (saveError) {
      setError(saveError);
      return;
    }
    onClose();
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleteError(null);
    setDeleting(true);
    const { error: deleteErr } = await onDelete(artwork.id);
    setDeleting(false);
    if (deleteErr) {
      setDeleteError(deleteErr);
      return;
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm px-4 py-8 overflow-y-auto"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 p-8 my-auto"
          >
            <button
              onClick={onClose}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-6">
              <h2 className="text-lg font-black text-slate-900">Edit Artwork</h2>
              <p className="text-xs text-slate-500 font-semibold mt-1">
                Update the title, description, tags, or cover image. The source PSD file can't be changed here.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full bg-slate-100/80 border border-slate-200 rounded-xl py-2.5 px-3.5 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 transition-colors"
                  type="text"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-100/80 border border-slate-200 rounded-xl py-2.5 px-3.5 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 transition-colors resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                  Tags (comma separated)
                </label>
                <input
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="w-full bg-slate-100/80 border border-slate-200 rounded-xl py-2.5 px-3.5 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 transition-colors"
                  placeholder="e.g. Neon, Cyberpunk, Portrait"
                  type="text"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                  Cover Image
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleDrop}
                  className={`relative aspect-[16/9] rounded-2xl border-2 border-dashed overflow-hidden cursor-pointer transition-colors flex items-center justify-center ps-checkerboard p-1 ${
                    dragActive ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <img
                    src={previewUrl || artwork.image}
                    alt="Cover preview"
                    className="w-full h-full object-cover rounded-xl"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-slate-950/0 hover:bg-slate-950/40 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                    <div className="text-white text-xs font-bold flex flex-col items-center gap-1.5">
                      <UploadCloud className="w-5 h-5" />
                      Click or drop to replace
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  />
                </div>
                {newPreviewFile && (
                  <p className="text-[11px] font-semibold text-blue-600 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5" />
                    New image selected: {newPreviewFile.name}
                  </p>
                )}
              </div>

              {error && (
                <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5">
                  {error}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3.5 rounded-lg border border-slate-200 text-slate-700 font-bold text-xs uppercase tracking-widest hover:border-slate-300 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 active:scale-[0.98] py-3.5 rounded-lg text-white font-bold text-xs tracking-widest uppercase transition-all shadow-sm hover:shadow-md cursor-pointer flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4 fill-white/10" />
                  {submitting ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>

            {onDelete && (
              <div className="mt-6 pt-5 border-t-2 border-red-200">
                <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-2">⚠ Danger Zone</p>
                {!deleteConfirming ? (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirming(true)}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs uppercase tracking-widest transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete This Artwork
                  </button>
                ) : (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex flex-col gap-3">
                    <p className="text-xs font-semibold text-red-700">
                      This permanently deletes "{artwork.title}" and its files. This can't be undone. Are you sure?
                    </p>
                    {deleteError && (
                      <p className="text-xs font-semibold text-red-700 bg-red-100 border border-red-200 rounded-lg px-3 py-2">
                        {deleteError}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setDeleteConfirming(false)}
                        className="flex-1 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-bold text-xs uppercase tracking-widest hover:border-slate-300 transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={deleting}
                        className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold text-xs uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {deleting ? 'Deleting…' : 'Confirm Delete'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
