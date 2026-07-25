import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
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
      {/* Compact header — art is the focal point, not the text */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 pt-2 pb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 leading-tight">
              Where scrapped PSDs become finished art.
            </h1>
            <p className="text-xs text-slate-500 font-semibold mt-1">
              Upload unfinished PSDs, download source layers, and remix dormant projects.
            </p>
          </div>

          <form
            onSubmit={handleHeroSearchSubmit}
            className="w-full md:w-80 bg-white rounded-lg p-1 flex items-center border border-slate-200 shadow-sm focus-within:border-blue-600 transition-colors shrink-0"
          >
            <input
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="flex-grow bg-transparent border-none focus:outline-none focus:ring-0 text-sm px-3 text-slate-800 placeholder-slate-400 font-semibold"
              placeholder="Search tags, titles..."
              type="text"
            />
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white h-8 w-8 rounded-md flex items-center justify-center shrink-0 transition-all cursor-pointer"
            >
              <Search className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Hot Tags suggestion */}
        {hotTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mr-0.5">Hot tags:</span>
            {hotTags.map((tag) => (
              <button
                key={tag}
                onClick={() => handleTagClick(tag)}
                className="text-[11px] font-bold text-slate-600 hover:text-blue-600 hover:bg-blue-50 bg-slate-100/80 border border-slate-200 px-3 py-0.5 rounded-md transition-all cursor-pointer capitalize"
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Main Grid Content */}
      <main className="max-w-7xl mx-auto px-6 md:px-12 py-2">
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
                  <div className="aspect-[4/5] overflow-hidden relative">
                    <div className="w-full h-full overflow-hidden relative">
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