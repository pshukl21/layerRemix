import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Check, Heart, Download, LogIn, Coins } from 'lucide-react';
import { Artwork } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { DEFAULT_AVATAR, getDownloadTarget, incrementDownloads } from '../lib/artworks';

interface ProfileScreenProps {
  artworks: Artwork[];
  onSelectArtwork: (artworkId: string) => void;
  onRequireAuth: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  artworks,
  onSelectArtwork,
  onRequireAuth,
}) => {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'original' | 'remixed'>('original');
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});

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
    setFavorites((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDownloadClick = (art: Artwork, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!art.isDemo) {
      incrementDownloads(art.id, Number(art.downloads) || 0);
    }
  };

  if (!user || !profile) {
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

  const originalArt = artworks.filter((art) => art.ownerId === user.id && art.type === 'Original');
  const remixedArt = artworks.filter((art) => art.ownerId === user.id && art.type === 'Remix');
  const totalDownloads = artworks
    .filter((art) => art.ownerId === user.id)
    .reduce((sum, art) => sum + (Number(art.downloads) || 0), 0);

  const renderGrid = (list: Artwork[], showRemixLabel: boolean) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {list.length === 0 && (
        <p className="text-sm text-slate-400 font-semibold col-span-full text-center py-16">
          Nothing here yet — head to Upload to publish your first piece.
        </p>
      )}
      {list.map((art) => {
        const isHovered = hoveredCardId === art.id;
        const isFav = !!favorites[art.id];
        const downloadTarget = getDownloadTarget(art);
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
            <div className="aspect-[4/5] relative overflow-hidden ps-checkerboard rounded-lg border border-slate-200 p-1">
              <img
                style={isHovered ? tiltStyle : {}}
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
                      <span className="text-[10px] text-slate-300 font-bold">remixed by @{art.author}</span>
                    )}
                  </div>
                  <div className="flex gap-2 text-white">
                    <button
                      onClick={(e) => handleFavorite(art.id, e)}
                      className="hover:text-blue-400 transition-colors p-1.5 bg-slate-900/40 border border-white/10 rounded-full backdrop-blur-xs cursor-pointer"
                    >
                      <Heart className={`w-4 h-4 ${isFav ? 'fill-red-500 text-red-500' : ''}`} />
                    </button>
                    <a
                      href={downloadTarget.url}
                      download={downloadTarget.filename}
                      onClick={(e) => handleDownloadClick(art, e)}
                      className="hover:text-blue-400 transition-colors p-1.5 bg-slate-900/40 border border-white/10 rounded-full backdrop-blur-xs cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                    </a>
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
          <div className="absolute bottom-1 right-1 bg-blue-600 text-white p-1.5 rounded-full border-2 border-white flex items-center justify-center shadow-lg">
            <Check className="w-4 h-4 stroke-[3px]" />
          </div>
        </div>

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
            <p className="text-sm md:text-base text-slate-600 max-w-2xl mb-6 leading-relaxed font-semibold">
              {profile.bio || 'This creator hasn\u2019t written a bio yet.'}
            </p>
          </div>

          <div className="flex flex-wrap justify-center md:justify-start gap-4 ps-stat">
            <div className="flex flex-col items-center justify-center bg-amber-50 border border-amber-200 px-6 py-3 rounded-2xl min-w-[100px] shadow-2xs">
              <span className="flex items-center gap-1.5 text-xl md:text-2xl font-black text-amber-600">
                <Coins className="w-5 h-5" />
                {profile.credits}
              </span>
              <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Credits</span>
            </div>
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
          <p className="text-[11px] text-slate-400 font-semibold mt-3 text-center md:text-left">
            Downloading someone else's file costs 1 credit. Publish an original piece or a remix to earn 1 more.
          </p>
        </div>
      </section>

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
      </nav>

      {activeTab === 'original' ? renderGrid(originalArt, false) : renderGrid(remixedArt, true)}
    </div>
  );
};
