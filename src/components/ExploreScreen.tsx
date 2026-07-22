import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Download, GitFork, ArrowDown, ExternalLink } from 'lucide-react';
import { Artwork } from '../types';

interface ExploreScreenProps {
  artworks: Artwork[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onSelectArtwork: (artworkId: string) => void;
}

type TabType = 'trending' | 'remixed' | 'recent';

export const ExploreScreen: React.FC<ExploreScreenProps> = ({
  artworks,
  searchQuery,
  setSearchQuery,
  onSelectArtwork,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('trending');
  const [localSearch, setLocalSearch] = useState('');

  // Combine parent search with local hero search
  const handleHeroSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(localSearch);
  };

  const activeSearch = searchQuery || localSearch;

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
    .filter((art) => art.type === 'Original')
    .filter((art) => {
      if (!activeSearch) return true;
      const lowerSearch = activeSearch.toLowerCase();
      const matchTitle = art.title.toLowerCase().includes(lowerSearch);
      const matchAuthor = art.author.toLowerCase().includes(lowerSearch);
      const matchTags = art.tags.some((t) => t.toLowerCase().includes(lowerSearch));
      return matchTitle || matchAuthor || matchTags;
    })
    .sort((a, b) => {
      if (activeTab === 'remixed') {
        const aVal = parseFloat(a.forks) || 0;
        const bVal = parseFloat(b.forks) || 0;
        return bVal - aVal;
      }
      if (activeTab === 'recent') {
        return a.id.localeCompare(b.id);
      }
      const aVal = parseFloat(a.downloads) || 0;
      const bVal = parseFloat(b.downloads) || 0;
      return bVal - aVal;
    });

  // Hot tag clicks
  const handleTagClick = (tag: string) => {
    setLocalSearch(tag);
    setSearchQuery(tag);
  };

  return (
    <div className="w-full min-h-screen text-slate-900 pt-24 pb-12">
      {/* Hero Section styled as a premium Large Bento Card */}
      <section className="relative h-auto min-h-[420px] md:min-h-[480px] py-12 flex flex-col justify-center items-center text-center px-6 overflow-hidden rounded-xl mx-4 md:mx-12 my-6 bg-gradient-to-br from-white via-slate-50 to-blue-50/20 border border-slate-200 shadow-xs">
        {/* Decorative Bento Grid Line Overlays */}
        <div className="absolute inset-0 opacity-[0.14] pointer-events-none ps-grid-bg" />
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-blue-500/5 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-indigo-500/10 blur-[120px]" />

        {/* Centered Hero Content Container */}
        <div className="relative z-10 w-full max-w-4xl mx-auto flex flex-col items-center justify-center text-center">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="mb-4 inline-flex items-center justify-center"
          >
            <span className="bg-blue-100 text-blue-600 px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider shadow-2xs border border-blue-200/50">
              🎨 OPEN-SOURCE ARTWORK
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="w-full max-w-full text-center text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 mb-4 font-sans leading-tight"
          >
            Scrapped{' '}
            <code className="bg-slate-800 text-slate-100 font-mono text-2xl sm:text-3xl md:text-4xl lg:text-5xl px-3 py-1 rounded-xl align-middle border border-slate-700 shadow-inner inline-block mx-1">
              .psd
            </code>{' '}
            to finished art.
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="text-sm md:text-base lg:text-lg text-slate-500 max-w-2xl mx-auto mb-8 font-semibold leading-relaxed"
          >
            Upload unfinished PSDs, download source layers, and turn dormant projects into final artwork.
          </motion.p>

          {/* Hero Search Bar */}
          <motion.form 
            onSubmit={handleHeroSearchSubmit}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="w-full max-w-xl mx-auto bg-slate-100/90 backdrop-blur-md rounded-full p-1.5 flex items-center border border-slate-200 shadow-md focus-within:border-blue-600 focus-within:bg-white transition-all"
          >
            <input
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="flex-grow bg-transparent border-none focus:outline-none focus:ring-0 text-sm px-6 text-slate-800 placeholder-slate-400 font-semibold"
              placeholder="Search by tag: abstract, 3D, neon..."
              type="text"
            />
            <button 
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white h-11 w-11 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer shadow-md"
            >
              <Search className="w-5 h-5" />
            </button>
          </motion.form>

          {/* Hot Tags suggestion */}
          {hotTags.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
              <span className="text-[11px] text-slate-400 uppercase tracking-widest font-bold mr-1">Hot tags:</span>
              {hotTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleTagClick(tag)}
                  className="text-[11px] font-bold text-slate-600 hover:text-blue-600 hover:bg-blue-50 bg-slate-100/80 border border-slate-200 px-3.5 py-1 rounded-md transition-all cursor-pointer capitalize"
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Main Grid Content */}
      <main className="max-w-7xl mx-auto px-6 md:px-12 py-8">
        {/* Navigation Filters */}
        <div className="flex items-center mb-8 overflow-x-auto">
          <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-1.5 shadow-sm whitespace-nowrap">
            {(['trending', 'remixed', 'recent'] as TabType[]).map((tab) => (
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
                  {tab === 'trending' && 'Trending'}
                  {tab === 'remixed' && 'Most Remixed'}
                  {tab === 'recent' && 'Recent'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Art Cards Grid */}
        {filteredArtworks.length === 0 ? (
          <div className="py-24 text-center bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
            <p className="text-slate-400 text-sm mb-2 font-semibold">No artwork matches your search criteria.</p>
            <button 
              onClick={() => { setLocalSearch(''); setSearchQuery(''); }}
              className="text-blue-600 text-xs font-bold hover:underline"
            >
              Reset all search filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-16">
            {filteredArtworks.map((art) => (
              <motion.div
                key={art.id}
                layout
                whileHover={{ y: -4 }}
                transition={{ duration: 0.3 }}
                className="group relative flex flex-col gap-4 p-3 bg-white border border-slate-200 hover:border-blue-300 rounded-xl shadow-sm hover:shadow-md transition-all duration-300"
              >
                {/* Image Wrap */}
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <div className="flex items-center gap-1.5 bg-[#3f3f46] px-2.5 py-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 shrink-0" />
                    <span className="text-[9px] font-bold text-zinc-200 truncate ps-stat">{art.title}.psd</span>
                  </div>
                  <div className="aspect-[4/5] overflow-hidden relative ps-checkerboard p-1">
                    <div className="w-full h-full rounded-md overflow-hidden relative">
                      <img
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        src={art.image}
                        alt={art.title}
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                        <button
                          onClick={() => onSelectArtwork(art.id)}
                          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                        >
                          View Project
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info block */}
                <div className="px-1 pb-1 flex flex-col">
                  <h3 
                    onClick={() => onSelectArtwork(art.id)}
                    className="font-bold text-slate-800 hover:text-blue-600 transition-colors cursor-pointer text-sm truncate mb-0.5"
                  >
                    {art.title}
                  </h3>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-bold">
                      by @{art.author}
                    </span>
                    <div className="flex gap-3 text-slate-400 text-xs font-semibold ps-stat">
                      <div className="flex items-center gap-1" title="Downloads">
                        <Download className="w-3.5 h-3.5" />
                        <span>{art.downloads}</span>
                      </div>
                      <div className="flex items-center gap-1" title="Forks">
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
        {filteredArtworks.length > 0 && (
          <div className="flex justify-center pb-8">
            <button className="px-8 py-3.5 border border-slate-200 bg-white shadow-sm hover:border-blue-600 text-slate-800 hover:text-blue-600 transition-all rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer active:scale-95">
              <span>Discover More Art</span>
              <ArrowDown className="w-4 h-4 animate-bounce text-blue-600" />
            </button>
          </div>
        )}
      </main>
    </div>
  );
};