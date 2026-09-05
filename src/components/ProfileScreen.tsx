import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Check, Heart, Download, LogIn, Coins, Camera, Pencil, SearchX } from 'lucide-react';
import { Artwork, Profile } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { DEFAULT_AVATAR, getDownloadTarget, incrementDownloads, fetchProfileByUsername, triggerFileDownload } from '../lib/artworks';
import { HeroSettingsPanel } from './HeroSettingsPanel';
import { AdminReportsPanel } from './AdminReportsPanel';
import { AdminContestsPanel } from './AdminContestsPanel';

interface ProfileScreenProps {
  artworks: Artwork[];
  onSelectArtwork: (artworkId: string) => void;
  onRequireAuth: () => void;
  favoriteIds: Set<string>;
  onToggleFavorite: (artworkId: string) => Promise<{ error: string | null }>;
  // When provided, shows that user's public profile (read-only) instead of
  // the logged-in user's own profile. Omit (or pass the logged-in user's
  // own username) to get the normal editable "my profile" experience.
  viewedUsername?: string;
  // Only needed for the admin's own profile view — omitted entirely on the
  // public profile route, since HeroSettingsPanel never renders there.
  heroBeforeImageUrl?: string | null;
  heroAfterImageUrl?: string | null;
  heroDownloadUrl?: string | null;
  onUpdateHeroImage?: (side: 'before' | 'after', file: File) => Promise<{ error: string | null }>;
  onUpdateHeroDownloadUrl?: (url: string) => Promise<{ error: string | null }>;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  artworks,
  onSelectArtwork,
  onRequireAuth,
  favoriteIds,
  onToggleFavorite,
  viewedUsername,
  heroBeforeImageUrl,
  heroAfterImageUrl,
  heroDownloadUrl,
  onUpdateHeroImage,
  onUpdateHeroDownloadUrl,
}) => {
  const { user, profile: ownProfile, updateAvatar, updateBio } = useAuth();

  const isOwnProfile = !viewedUsername || (!!ownProfile && viewedUsername === ownProfile.username);

  const [viewedProfile, setViewedProfile] = useState<Profile | null>(null);
  const [loadingViewedProfile, setLoadingViewedProfile] = useState(false);
  const [viewedProfileNotFound, setViewedProfileNotFound] = useState(false);

  useEffect(() => {
    if (isOwnProfile || !viewedUsername) {
      setViewedProfile(null);
      setViewedProfileNotFound(false);
      return;
    }
    let cancelled = false;
    setLoadingViewedProfile(true);
    setViewedProfileNotFound(false);
    fetchProfileByUsername(viewedUsername).then((p) => {
      if (cancelled) return;
      setLoadingViewedProfile(false);
      if (!p) {
        setViewedProfileNotFound(true);
      } else {
        setViewedProfile(p);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [viewedUsername, isOwnProfile]);

  const profile = isOwnProfile ? ownProfile : viewedProfile;

  const [editingBio, setEditingBio] = useState(false);
  const [bioInput, setBioInput] = useState('');
  const [bioSaving, setBioSaving] = useState(false);
  const [bioError, setBioError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'original' | 'remixed' | 'favorites'>('original');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAvatarError(null);
    setAvatarUploading(true);
    const { error } = await updateAvatar(file);
    setAvatarUploading(false);
    if (error) {
      setAvatarError(error);
    }
  };

  const handleStartEditBio = () => {
    setBioInput(ownProfile?.bio || '');
    setBioError(null);
    setEditingBio(true);
  };

  const handleCancelEditBio = () => {
    setEditingBio(false);
    setBioError(null);
  };

  const handleSaveBio = async () => {
    setBioSaving(true);
    setBioError(null);
    const { error } = await updateBio(bioInput);
    setBioSaving(false);
    if (error) {
      setBioError(error);
      return;
    }
    setEditingBio(false);
  };

  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [tiltStyle, setTiltStyle] = useState<React.CSSProperties>({});

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>, id: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const xPercent = (x / rect.width - 0.5) * 8;
    const yPercent = (y / rect.height - 0.5) * 8;
    setTiltStyle({ transform: `scale(1.06) translate(${xPercent}px, ${yPercent}px)` });
  };

  const handleMouseLeave = () => {
    setHoveredCardId(null);
    setTiltStyle({});
  };

  const handleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite(id);
  };

  const handleDownloadClick = (art: Artwork, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const { url, filename } = getDownloadTarget(art);
    triggerFileDownload(url, filename);
    if (!art.isDemo) {
      incrementDownloads(art.id, Number(art.downloads) || 0);
    }
  };

  // Own profile requires being signed in. Someone else's profile is public
  // and viewable by anyone, signed in or not.
  if (isOwnProfile && (!user || !ownProfile)) {
    return (
      <div className="w-full min-h-screen text-slate-900 pt-32 pb-20 px-6 flex flex-col items-center justify-center text-center">
        <h1 className="text-2xl font-black tracking-tight text-slate-900 mb-2">Sign in to view your profile</h1>
        <p className="text-sm text-slate-500 font-semibold mb-6 max-w-sm">
          Create an account or sign in to publish artwork, fork designs, and see everything you've uploaded.
        </p>
        <button
          onClick={onRequireAuth}
          className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-widest transition-all active:scale-95 cursor-pointer flex items-center gap-2 shadow-sm"
        >
          <LogIn className="w-4 h-4" />
          Sign In
        </button>
      </div>
    );
  }

  if (!isOwnProfile && loadingViewedProfile) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center text-slate-400 text-sm font-semibold">
        Loading…
      </div>
    );
  }

  if (!isOwnProfile && (viewedProfileNotFound || !profile)) {
    return (
      <div className="w-full min-h-screen text-slate-900 pt-32 pb-20 px-6 flex flex-col items-center justify-center text-center">
        <SearchX className="w-10 h-10 text-slate-300 mb-4" />
        <h1 className="text-2xl font-black tracking-tight text-slate-900 mb-2">Creator not found</h1>
        <p className="text-sm text-slate-500 font-semibold max-w-sm">
          There's no profile at @{viewedUsername}.
        </p>
      </div>
    );
  }

  if (!profile) return null;

  const targetUserId = isOwnProfile ? user?.id : profile.id;
  const originalArt = artworks.filter((art) => art.ownerId === targetUserId && art.type === 'Original');
  const remixedArt = artworks.filter((art) => art.ownerId === targetUserId && art.type === 'Remix');
  // Private — only ever computed/shown when viewing your own profile.
  const favoritedArt = isOwnProfile ? artworks.filter((art) => favoriteIds.has(art.id)) : [];
  const totalDownloads = artworks
    .filter((art) => art.ownerId === targetUserId)
    .reduce((sum, art) => sum + (Number(art.downloads) || 0), 0);

  const renderGrid = (list: Artwork[], showRemixLabel: boolean, emptyMessage?: string) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {list.length === 0 && (
        <p className="text-sm text-slate-400 font-semibold col-span-full text-center py-16">
          {emptyMessage ||
            (isOwnProfile
              ? 'Nothing here yet — head to Upload to publish your first piece.'
              : 'This creator hasn\u2019t published anything here yet.')}
        </p>
      )}
      {list.map((art) => {
        const isHovered = hoveredCardId === art.id;
        const isFav = favoriteIds.has(art.id);
        return (
          <div
            key={art.id}
            onClick={() => onSelectArtwork(art.id)}
            onMouseMove={(e) => {
              setHoveredCardId(art.id);
              handleMouseMove(e, art.id);
            }}
            onMouseLeave={handleMouseLeave}
            className="group relative border border-slate-200 hover:border-blue-300 bg-white rounded-xl p-3 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer"
          >
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <div className="flex items-center gap-1.5 bg-[#3f3f46] px-2.5 py-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 shrink-0" />
                <span className="text-[9px] font-bold text-zinc-200 truncate ps-stat">{art.title}.psd</span>
              </div>
              <div className="aspect-[4/5] relative overflow-hidden ps-checkerboard p-1">
              <img
                style={{ objectPosition: `${art.focalX ?? 50}% ${art.focalY ?? 50}%`, ...(isHovered ? tiltStyle : {}) }}
                className="w-full h-full object-cover transition-transform duration-500 ease-out rounded-md"
                src={art.image}
                alt={art.title}
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-5 rounded-lg">
                <div className="flex justify-between items-center text-white">
                  <div className="flex flex-col">
                    <span className="font-bold text-sm tracking-wide">{art.title}</span>
                    {showRemixLabel && (
                      <Link
                        to={`/profile/${art.author}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-[10px] text-slate-300 font-bold hover:text-white hover:underline w-fit"
                      >
                        remixed by @{art.author}
                      </Link>
                    )}
                  </div>
                  <div className="flex gap-2 text-white">
                    <button
                      onClick={(e) => handleFavorite(art.id, e)}
                      className="hover:text-blue-400 transition-colors p-1.5 bg-slate-900/40 border border-white/10 rounded-lg backdrop-blur-xs cursor-pointer"
                    >
                      <Heart className={`w-4 h-4 ${isFav ? 'fill-red-500 text-red-500' : ''}`} />
                    </button>
                    <a
                      href="#"
                      onClick={(e) => handleDownloadClick(art, e)}
                      className="hover:text-blue-400 transition-colors p-1.5 bg-slate-900/40 border border-white/10 rounded-lg backdrop-blur-xs cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="w-full min-h-screen text-slate-900 pt-24 pb-20 px-6 md:px-12 max-w-7xl mx-auto">
      <section className="bg-white border border-slate-200 rounded-xl p-6 md:p-8 shadow-sm flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-10 mb-12 mt-4">
        <div className="relative group select-none shrink-0">
          <div className="w-32 h-32 md:w-44 md:h-44 rounded-full border-2 border-blue-600 p-1.5 bg-slate-50 shadow-md">
            <img
              className="w-full h-full rounded-full object-cover grayscale-30 group-hover:grayscale-0 transition-all duration-500 shadow-inner"
              src={profile.avatarUrl || DEFAULT_AVATAR}
              alt={`${profile.displayName} Avatar`}
              referrerPolicy="no-referrer"
            />
          </div>
          {isOwnProfile && (
            <>
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarUploading}
                title="Change profile photo"
                className="absolute inset-1.5 rounded-full bg-slate-950/0 group-hover:bg-slate-950/50 transition-colors flex items-center justify-center cursor-pointer disabled:cursor-wait"
              >
                <span className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center gap-1 text-white">
                  <Camera className="w-6 h-6" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    {avatarUploading ? 'Uploading…' : 'Change'}
                  </span>
                </span>
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarFileChange}
              />
            </>
          )}
          <div className="absolute bottom-1 right-1 bg-blue-600 text-white p-1.5 rounded-full border-2 border-white flex items-center justify-center shadow-lg">
            <Check className="w-4 h-4 stroke-[3px]" />
          </div>
        </div>

        {avatarError && (
          <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 max-w-xs">
            {avatarError}
          </p>
        )}

        <div className="flex-1 text-center md:text-left flex flex-col justify-between h-full">
          <div>
            <div className="flex flex-col md:flex-row md:items-center gap-3 mb-3 justify-center md:justify-start">
              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900">
                {profile.displayName}
              </h1>
              <span className="text-[10px] bg-blue-50 border border-blue-100 px-3 py-1 rounded-lg uppercase tracking-widest font-black text-blue-600 self-center">
                @{profile.username}
              </span>
            </div>
            {isOwnProfile && editingBio ? (
              <div className="max-w-2xl mb-6">
                <textarea
                  value={bioInput}
                  onChange={(e) => setBioInput(e.target.value)}
                  rows={3}
                  autoFocus
                  placeholder="Tell people a bit about yourself and what you make..."
                  className="w-full bg-slate-100/80 border border-slate-200 rounded-xl py-2.5 px-3.5 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 transition-colors resize-none"
                />
                {bioError && (
                  <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mt-2">
                    {bioError}
                  </p>
                )}
                <div className="flex gap-2 mt-2 justify-center md:justify-start">
                  <button
                    onClick={handleCancelEditBio}
                    className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-bold text-[11px] uppercase tracking-widest hover:border-slate-300 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveBio}
                    disabled={bioSaving}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-[11px] uppercase tracking-widest transition-all cursor-pointer"
                  >
                    {bioSaving ? 'Saving…' : 'Save Bio'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 max-w-2xl mb-6 justify-center md:justify-start">
                <p className="text-sm md:text-base text-slate-600 leading-relaxed font-semibold">
                  {profile.bio || (isOwnProfile ? 'This creator hasn\u2019t written a bio yet.' : 'This creator hasn\u2019t written a bio yet.')}
                </p>
                {isOwnProfile && (
                  <button
                    onClick={handleStartEditBio}
                    title="Edit bio"
                    className="text-slate-400 hover:text-blue-600 transition-colors cursor-pointer shrink-0 mt-1"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap justify-center md:justify-start gap-4 ps-stat">
            {isOwnProfile && (
              <div className="flex flex-col items-center justify-center bg-amber-50 border border-amber-200 px-6 py-3 rounded-2xl min-w-[100px] shadow-2xs">
                <span className="flex items-center gap-1.5 text-xl md:text-2xl font-black text-amber-600">
                  <Coins className="w-5 h-5" />
                  {profile.credits}
                </span>
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Credits</span>
              </div>
            )}
            <div className="flex flex-col items-center justify-center bg-slate-50 border border-slate-100 px-6 py-3 rounded-2xl min-w-[100px] shadow-2xs">
              <span className="text-xl md:text-2xl font-black text-blue-600">{remixedArt.length}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Remixes</span>
            </div>
            <div className="flex flex-col items-center justify-center bg-slate-50 border border-slate-100 px-6 py-3 rounded-2xl min-w-[100px] shadow-2xs">
              <span className="text-xl md:text-2xl font-black text-blue-600">{totalDownloads}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Downloads</span>
            </div>
            <div className="flex flex-col items-center justify-center bg-slate-50 border border-slate-100 px-6 py-3 rounded-2xl min-w-[100px] shadow-2xs">
              <span className="text-xl md:text-2xl font-black text-blue-600">{originalArt.length}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Creations</span>
            </div>
          </div>
          {isOwnProfile && (
            <p className="text-[11px] text-slate-400 font-semibold mt-3 text-center md:text-left">
              Downloading someone else's file costs 1 credit. Publish an original piece or a remix to earn 1 more.
            </p>
          )}
        </div>
      </section>

      {isOwnProfile && ownProfile?.isAdmin && onUpdateHeroImage && onUpdateHeroDownloadUrl && (
        <HeroSettingsPanel
          heroBeforeImageUrl={heroBeforeImageUrl ?? null}
          heroAfterImageUrl={heroAfterImageUrl ?? null}
          heroDownloadUrl={heroDownloadUrl ?? null}
          onUpdateHeroImage={onUpdateHeroImage}
          onUpdateHeroDownloadUrl={onUpdateHeroDownloadUrl}
        />
      )}

      {isOwnProfile && ownProfile?.isAdmin && <AdminReportsPanel />}

      {isOwnProfile && ownProfile?.isAdmin && user && <AdminContestsPanel artworks={artworks} currentUserId={user.id} />}

      <nav className="flex gap-10 border-b border-slate-200 mb-8 overflow-x-auto select-none">
        <button
          onClick={() => setActiveTab('original')}
          className={`pb-4 text-xs font-bold uppercase tracking-widest transition-all relative cursor-pointer ${
            activeTab === 'original' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-700'
          }`}
        >
          Original Art
          {activeTab === 'original' && (
            <motion.div layoutId="profileActiveTab" className="absolute bottom-0 left-0 right-0 h-[3px] bg-blue-600 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('remixed')}
          className={`pb-4 text-xs font-bold uppercase tracking-widest transition-all relative cursor-pointer ${
            activeTab === 'remixed' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-700'
          }`}
        >
          Remixed Work
          {activeTab === 'remixed' && (
            <motion.div layoutId="profileActiveTab" className="absolute bottom-0 left-0 right-0 h-[3px] bg-blue-600 rounded-full" />
          )}
        </button>
        {isOwnProfile && (
          <button
            onClick={() => setActiveTab('favorites')}
            className={`pb-4 text-xs font-bold uppercase tracking-widest transition-all relative cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'favorites' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <Heart className="w-3.5 h-3.5" />
            Favorites
            {activeTab === 'favorites' && (
              <motion.div layoutId="profileActiveTab" className="absolute bottom-0 left-0 right-0 h-[3px] bg-blue-600 rounded-full" />
            )}
          </button>
        )}
      </nav>

      {activeTab === 'original' && renderGrid(originalArt, false)}
      {activeTab === 'remixed' && renderGrid(remixedArt, true)}
      {activeTab === 'favorites' && renderGrid(favoritedArt, false, "You haven't favorited anything yet — hearts you give show up here, visible only to you.")}
    </div>
  );
};
