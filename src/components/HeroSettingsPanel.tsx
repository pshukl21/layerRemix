import React, { useState } from 'react';
import { Pencil, Loader2 } from 'lucide-react';
import { BeforeAfterSlider } from './BeforeAfterSlider';

interface HeroSettingsPanelProps {
  heroBeforeImageUrl: string | null;
  heroAfterImageUrl: string | null;
  heroDownloadUrl: string | null;
  onUpdateHeroImage: (side: 'before' | 'after', file: File) => Promise<{ error: string | null }>;
  onUpdateHeroDownloadUrl: (url: string) => Promise<{ error: string | null }>;
}

// Lets an admin manage the homepage hero's before/after images and its
// download-button link from their own profile page — deliberately kept off
// the homepage itself, so the admin can always see the page exactly as
// every other visitor does.
export const HeroSettingsPanel: React.FC<HeroSettingsPanelProps> = ({
  heroBeforeImageUrl,
  heroAfterImageUrl,
  heroDownloadUrl,
  onUpdateHeroImage,
  onUpdateHeroDownloadUrl,
}) => {
  const [uploadingSide, setUploadingSide] = useState<'before' | 'after' | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [linkDraft, setLinkDraft] = useState(heroDownloadUrl || '');
  const [savingLink, setSavingLink] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkSaved, setLinkSaved] = useState(false);

  const handleImageChange = async (side: 'before' | 'after', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImageError(null);
    setUploadingSide(side);
    const { error } = await onUpdateHeroImage(side, file);
    setUploadingSide(null);
    if (error) setImageError(error);
  };

  const handleSaveLink = async () => {
    setSavingLink(true);
    setLinkError(null);
    setLinkSaved(false);
    const { error } = await onUpdateHeroDownloadUrl(linkDraft.trim());
    setSavingLink(false);
    if (error) {
      setLinkError(error);
      return;
    }
    setLinkSaved(true);
    setTimeout(() => setLinkSaved(false), 2000);
  };

  return (
    <div className="mb-10 bg-amber-50/50 border border-amber-200 rounded-xl p-5">
      <h2 className="text-[10px] font-bold text-amber-700 uppercase tracking-widest mb-1">Admin Only</h2>
      <h3 className="text-sm font-black text-slate-800 mb-4">Homepage Hero Settings</h3>

      <div className="grid sm:grid-cols-2 gap-6">
        <div>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Before / After Images
          </p>
          <div className="relative max-w-[280px]">
            <BeforeAfterSlider
              beforeImage={heroBeforeImageUrl || '/hero-before.png'}
              afterImage={heroAfterImageUrl || '/hero-after.png'}
              aspectRatio="3/2"
              className="border border-slate-200"
            />
            <div className="absolute top-2 right-2 flex gap-1.5 z-20">
              {(['before', 'after'] as const).map((side) => (
                <label
                  key={side}
                  title={`Replace ${side} image`}
                  className="w-7 h-7 rounded-full bg-slate-950/70 hover:bg-slate-950/90 backdrop-blur-xs flex items-center justify-center cursor-pointer transition-all"
                >
                  {uploadingSide === side ? (
                    <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                  ) : (
                    <Pencil className="w-3.5 h-3.5 text-white" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingSide !== null}
                    onChange={(e) => handleImageChange(side, e)}
                  />
                </label>
              ))}
            </div>
          </div>
          {imageError && <p className="text-[11px] font-semibold text-red-600 mt-2">{imageError}</p>}
        </div>

        <div>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Download Button Link
          </p>
          <p className="text-[11px] text-slate-500 font-semibold mb-2 leading-relaxed">
            Only paths on this site are used — any protocol/host you paste in gets stripped automatically.
          </p>
          <div className="flex gap-1.5">
            <input
              value={linkDraft}
              onChange={(e) => setLinkDraft(e.target.value)}
              placeholder="/art/some-artwork-id"
              className="flex-1 min-w-0 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600"
            />
            <button
              onClick={handleSaveLink}
              disabled={savingLink}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-[11px] rounded-lg cursor-pointer transition-all shrink-0"
            >
              {savingLink ? '...' : 'Save'}
            </button>
          </div>
          {linkError && <p className="text-[11px] font-semibold text-red-600 mt-2">{linkError}</p>}
          {linkSaved && <p className="text-[11px] font-semibold text-emerald-600 mt-2">Saved.</p>}
        </div>
      </div>
    </div>
  );
};
