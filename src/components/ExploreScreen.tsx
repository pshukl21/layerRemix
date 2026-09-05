import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Search, Download, GitFork, ArrowDown, ExternalLink, Heart, Upload, Layers, HardDrive } from 'lucide-react';
import { Artwork } from '../types';
import { OPEN_CHALLENGES } from '../lib/challenges';
import { BeforeAfterSlider } from './BeforeAfterSlider';

interface ExploreScreenProps {
  artworks: Artwork[];
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  onSelectArtwork: (artworkId: string) => void;
  favoriteIds: Set<string>;
  onToggleFavorite: (artworkId: string) => Promise<{ error: string | null }>;
  heroBeforeImageUrl: string | null;
  heroAfterImageUrl: string | null;
  heroDownloadUrl: string | null;
}

type TabType = 'all' | 'originals' | 'remixes' | 'trending';
type SortType = 'recent' | 'downloaded';

function formatFileSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${Math.round(bytes / 1024)} KB`;
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
}

export const ExploreScreen: React.FC<ExploreScreenProps> = ({
  artworks,
  searchQuery,
  setSearchQuery,
  onSelectArtwork,
  favoriteIds,
  onToggleFavorite,
  heroBeforeImageUrl,
  heroAfterImageUrl,
  heroDownloadUrl,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [sortBy, setSortBy] = useState<SortType>('recent');
  const [activeChallengeFilter, setActiveChallengeFilter] = useState<string | null>(null);
  const navigate = useNavigate();
  const gridRef = useRef<HTMLDivElement>(null);
  const scrollToGrid = () => gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Strips any protocol/host from an admin-entered link, so the download
  // button can only ever navigate within this site — even if someone pastes
  // a full URL (including one pointing at this site's own domain) rather
  // than a bare path, this normalizes it to just the internal path.
  const toInternalPath = (input: string): string => {
    try {
      const url = new URL(input, window.location.origin);
      return url.pathname + url.search + url.hash;
    } catch {
      return input;
    }
  };

  // How many gallery cards to actually render at once. Rendering hundreds
  // of animated cards into the DOM at once is the real performance cost
  // here — this caps it, and "Discover More Art" reveals more on demand.
  const PAGE_SIZE = 24;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);


  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeTab, searchQuery]);

  // Real "hot tags": count how often each tag appears across every original artwork
  const hotTags = useMemo(() => {
    const counts = new Map<string, { display: string; count: number }>();
    for (const art of artworks) {
      if (art.type !== 'Original') continue;
      for (const tag of art.tags) {
        const key = tag.toLowerCase();
        const existing = counts.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          counts.set(key, { display: tag, count: 1 });
        }
      }
    }
    return Array.from(counts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
      .map((entry) => entry.display);
  }, [artworks]);

  // Filter and sort logic
  const filteredArtworks = artworks
    .filter((art) => {
      if (activeTab === 'originals') return art.type === 'Original';
      if (activeTab === 'remixes') return art.type === 'Remix';
      return true;
    })
    .filter((art) => {
      if (!activeChallengeFilter) return true;
      return art.openChallenges.includes(activeChallengeFilter);
    })
    .filter((art) => {
      if (!searchQuery) return true;
      const lowerSearch = searchQuery.toLowerCase();
      const matchTitle = art.title.toLowerCase().includes(lowerSearch);
      const matchAuthor = art.author.toLowerCase().includes(lowerSearch);
      const matchTags = art.tags.some((t) => t.toLowerCase().includes(lowerSearch));
      return matchTitle || matchAuthor || matchTags;
    })
    .sort((a, b) => {
      if (activeTab === 'trending') {
        const heartsDiff = (Number(b.hearts) || 0) - (Number(a.hearts) || 0);
        if (heartsDiff !== 0) return heartsDiff;
        return (Number(b.downloads) || 0) - (Number(a.downloads) || 0);
      }
      if (sortBy === 'downloaded') {
        return (Number(b.downloads) || 0) - (Number(a.downloads) || 0);
      }
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });

  // Hot tag clicks
  const handleTagClick = (tag: string) => {
    setSearchQuery((prev) => (prev.toLowerCase() === tag.toLowerCase() ? '' : tag));
  };

  return (
    <div className="w-full min-h-screen text-slate-900 pt-24 pb-12">
      {/* Hero Section — kept deliberately compact: this is a signpost, not
          the main event. Wrapped in the exact same max-w-7xl + px-6/px-12
          outer container as <main> below, so the card's edges land on the
          identical bounds as the grid/tabs, not just the same max-width. */}
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <section className="relative overflow-hidden rounded-xl my-4 bg-gradient-to-br from-white via-slate-50 to-blue-50/20 border border-slate-200 shadow-xs">
          <div className="relative z-10 px-6 md:px-12 py-6 grid md:grid-cols-2 gap-6 md:gap-10 items-end">
            {/* Copy + CTAs */}
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            className="text-center md:text-left"
          >
            <span className="inline-block bg-blue-100 text-blue-600 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-blue-200/50 mb-3">
              🎨 Open-Source Artwork
            </span>
            {/* Styled to mimic an active Photoshop Text Tool / Transform
                box — a small, intentional easter egg leaning into the
                platform's whole PSD theme. The 8 handles are generated from
                one position list rather than repeated by hand, so the
                bounding box stays easy to resize/adjust later. */}
            <div className="relative inline-block border border-dashed border-neutral-400 px-1 py-1 mb-2.5">
              {[
                { top: '0%', left: '0%' },
                { top: '0%', left: '50%' },
                { top: '0%', left: '100%' },
                { top: '50%', left: '0%' },
                { top: '50%', left: '100%' },
                { top: '100%', left: '0%' },
                { top: '100%', left: '50%' },
                { top: '100%', left: '100%' },
              ].map((pos, i) => (
                <span
                  key={i}
                  className="absolute w-1.5 h-1.5 bg-white border border-neutral-800 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                  style={pos}
                />
              ))}
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-black tracking-tight text-slate-900 leading-tight">
                Where scrapped PSDs become{' '}
                <span className="bg-blue-600 text-white px-1">finished art.</span>
                <span className="inline-block w-[2px] h-[0.9em] bg-slate-900 align-middle ml-1 ps-cursor-blink" />
              </h1>
            </div>
            <p className="text-sm md:text-base text-slate-500 font-semibold leading-snug mb-5 max-w-sm mx-auto md:mx-0">
              Upload unfinished PSDs, download real source layers, and turn dormant projects into finished artwork.
            </p>
            <div className="flex flex-col sm:flex-row gap-2.5 justify-center md:justify-start">
              <button
                onClick={scrollToGrid}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-5 py-2.5 rounded-lg shadow-sm hover:shadow-md active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                Explore Remixes
                <ArrowDown className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigate('/upload')}
                className="bg-white border border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-600 font-bold text-sm px-5 py-2.5 rounded-lg shadow-sm hover:shadow-md active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Drop a PSD
              </button>
            </div>

            {hotTags.length > 0 && (
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-1.5 mt-5">
                <span className="text-[11px] text-slate-400 uppercase tracking-widest font-bold mr-1">Hot tags:</span>
                {hotTags.map((tag) => {
                  const isActive = searchQuery.toLowerCase() === tag.toLowerCase();
                  return (
                    <button
                      key={tag}
                      onClick={() => handleTagClick(tag)}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-md transition-all cursor-pointer uppercase border ${
                        isActive
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50 bg-slate-100/80 border-slate-200'
                      }`}
                    >
                      #{tag}
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* Compact before/after demo — pure display only. No edit
              controls here at all — those live on the admin's own profile
              page now, so this view always matches exactly what every
              visitor sees. Slider and button are styled independently
              (each with its own full rounding/border/shadow) but share the
              same w-full parent, so they stay the same width with a gap
              between them rather than sitting flush. */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="max-w-[420px] mx-auto w-full"
          >
            <BeforeAfterSlider
              beforeImage={heroBeforeImageUrl || '/hero-before.png'}
              afterImage={heroAfterImageUrl || '/hero-after.png'}
              beforeLabel="RAW PSD"
              afterLabel="REMIX"
              aspectRatio="3/2"
              className="shadow-md border border-slate-200"
            />

            {/* Download button — same styling as the card hover action.
                Always same-tab, and always treated as an internal site
                path (any host portion of the URL is stripped), matching
                what the admin sets on their profile page. */}
            {heroDownloadUrl && (
              <Link
                to={toInternalPath(heroDownloadUrl)}
                className="mt-3 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
              >
                <GitFork className="w-3.5 h-3.5" />
                Fork / Download PSD
              </Link>
            )}
          </motion.div>
        </div>
      </section>
      </div>

      {/* Main Grid Content */}
      <main className="max-w-7xl mx-auto px-6 md:px-12 py-8">
        {/* Filter bar — docked directly above the grid: type tabs, a
            separate sort control, and the "what's needed" browse row. */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-1.5 shadow-sm whitespace-nowrap">
            {(['all', 'trending', 'originals', 'remixes'] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative font-bold text-xs uppercase tracking-widest px-4 py-2 rounded-md transition-colors cursor-pointer ${
                  activeTab === tab ? 'text-white' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {activeTab === tab && (
                  <motion.div
                    layoutId="exploreActiveTab"
                    className="absolute inset-0 bg-blue-600 rounded-md"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                  />
                )}
                <span className="relative z-10">
                  {tab === 'all' && 'All Art'}
                  {tab === 'trending' && 'Trending'}
                  {tab === 'originals' && 'Originals'}
                  {tab === 'remixes' && 'Remixes'}
                </span>
              </button>
            ))}
          </div>

          {/* Sort — independent of the type tabs above (Trending already has
              its own fixed sort, so this only applies to All/Originals/Remixes). */}
          <div className="flex items-center gap-2 ml-auto">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Sort
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortType)}
              disabled={activeTab === 'trending'}
              className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-600 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:border-blue-600"
            >
              <option value="recent">Most Recent</option>
              <option value="downloaded">Most Downloaded</option>
            </select>
          </div>
        </div>

        {/* Browse by what's needed — a separate filter dimension from the
            tabs above (which filter by type), letting people jump straight
            to pieces flagged as needing a specific kind of work. */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0">
            Needs:
          </span>
          {OPEN_CHALLENGES.map((challenge) => {
            const isActive = activeChallengeFilter === challenge;
            return (
              <button
                key={challenge}
                onClick={() => setActiveChallengeFilter(isActive ? null : challenge)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wide cursor-pointer transition-all border ${
                  isActive
                    ? 'bg-amber-500 border-amber-500 text-white'
                    : 'bg-white border-slate-200 text-slate-500 hover:border-amber-300 hover:text-amber-600'
                }`}
              >
                {challenge}
              </button>
            );
          })}
        </div>

        {/* Art Cards Grid */}
        {filteredArtworks.length === 0 ? (
          <div className="py-24 text-center bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
            <p className="text-slate-400 text-sm mb-2 font-semibold">No artwork matches your search criteria.</p>
            <button 
              onClick={() => setSearchQuery('')}
              className="text-blue-600 text-xs font-bold hover:underline"
            >
              Reset all search filters
            </button>
          </div>
        ) : (
          <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-16 scroll-mt-24">
            {filteredArtworks.slice(0, visibleCount).map((art) => (
              <motion.div
                key={art.id}
                layout
                whileHover={{ y: -4 }}
                transition={{ duration: 0.3 }}
                className="group relative flex flex-col bg-white border border-slate-200 hover:border-blue-300 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden"
              >
                {/* Dark document-tab-style bar — filename + type badge,
                    restored per feedback (sits on top of the image, like
                    the original design). */}
                <div className="flex items-center gap-1.5 bg-[#3f3f46] px-2.5 py-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 shrink-0" />
                  <span className="text-[9px] font-bold text-zinc-200 truncate ps-stat">{art.title}.psd</span>
                  <span className="flex-1" />
                  <span
                    className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shrink-0 ${
                      art.type === 'Remix' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-blue-500/20 text-blue-300'
                    }`}
                  >
                    {art.type === 'Remix' ? 'Remix' : 'Original'}
                  </span>
                </div>

                <div
                  onClick={() => onSelectArtwork(art.id)}
                  className="aspect-[4/5] overflow-hidden relative cursor-pointer"
                >
                  <img
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    style={{ objectPosition: `${art.focalX ?? 50}% ${art.focalY ?? 50}%` }}
                    src={art.image}
                    alt={art.title}
                    referrerPolicy="no-referrer"
                  />

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(art.id);
                    }}
                    title={favoriteIds.has(art.id) ? 'Remove from favorites' : 'Add to favorites'}
                    className="absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-full bg-slate-950/50 backdrop-blur-xs flex items-center justify-center hover:bg-slate-950/70 transition-all active:scale-90 cursor-pointer"
                  >
                    <Heart
                      className={`w-4 h-4 transition-colors ${
                        favoriteIds.has(art.id) ? 'fill-red-500 text-red-500' : 'text-white'
                      }`}
                    />
                  </button>

                  {/* Hover quick actions */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 gap-2">
                    <button
                      onClick={() => onSelectArtwork(art.id)}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <GitFork className="w-3.5 h-3.5" />
                      Fork / Download PSD
                    </button>
                  </div>
                </div>

                {/* Info block — title, metadata, author, attribution, stats.
                    Everything about the piece lives here, below the art. */}
                <div className="p-3.5 flex flex-col gap-2">
                  <h3
                    onClick={() => onSelectArtwork(art.id)}
                    className="font-bold text-slate-800 hover:text-blue-600 transition-colors cursor-pointer text-sm truncate"
                  >
                    {art.title}
                  </h3>

                  {/* Layer count / file size badge */}
                  {(art.layerCount || art.fileSizeBytes) && (
                    <div className="flex items-center gap-2.5 text-[10px] font-bold text-slate-400">
                      {art.layerCount && (
                        <span className="flex items-center gap-1">
                          <Layers className="w-3 h-3" />
                          {art.layerCount} Layers
                        </span>
                      )}
                      {art.layerCount && art.fileSizeBytes && <span className="text-slate-300">•</span>}
                      {art.fileSizeBytes && (
                        <span className="flex items-center gap-1">
                          <HardDrive className="w-3 h-3" />
                          {formatFileSize(art.fileSizeBytes)}
                        </span>
                      )}
                    </div>
                  )}

                  {art.openChallenges.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {art.openChallenges.slice(0, 2).map((challenge) => (
                        <span
                          key={challenge}
                          className="px-1.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 rounded text-[9px] font-bold tracking-wide"
                        >
                          {challenge}
                        </span>
                      ))}
                      {art.openChallenges.length > 2 && (
                        <span className="px-1.5 py-0.5 bg-slate-50 border border-slate-200 text-slate-400 rounded text-[9px] font-bold">
                          +{art.openChallenges.length - 2}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Remix attribution — links back to the original */}
                  {art.type === 'Remix' && art.parentArtworkId && art.parentAuthor && (
                    <Link
                      to={`/art/${art.parentArtworkId}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-500 hover:text-indigo-700 hover:underline w-fit"
                    >
                      <GitFork className="w-3 h-3" />
                      remixed from @{art.parentAuthor}
                    </Link>
                  )}

                  <div className="flex items-center justify-between pt-0.5">
                    <Link
                      to={`/profile/${art.author}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-slate-400 font-bold hover:text-blue-600 hover:underline"
                    >
                      by @{art.author}
                    </Link>
                    <div className="flex gap-3 text-slate-400 text-xs font-semibold ps-stat">
                      <div className="flex items-center gap-1" title="Downloads">
                        <Download className="w-3.5 h-3.5" />
                        <span>{art.downloads}</span>
                      </div>
                      <div className="flex items-center gap-1" title="Times remixed">
                        <GitFork className="w-3.5 h-3.5" />
                        <span>{art.forks}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Load More Pagination Button */}
        {visibleCount < filteredArtworks.length && (
          <div className="flex justify-center pb-8">
            <button
              onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
              className="px-8 py-3.5 border border-slate-200 bg-white shadow-sm hover:border-blue-600 text-slate-800 hover:text-blue-600 transition-all rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <span>Discover More Art</span>
              <ArrowDown className="w-4 h-4 animate-bounce text-blue-600" />
            </button>
          </div>
        )}
      </main>
    </div>
  );
};