import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn } from 'lucide-react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { ExploreScreen } from './components/ExploreScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { UploadScreen } from './components/UploadScreen';
import { DetailScreen } from './components/DetailScreen';
import { AuthModal } from './components/AuthModal';
import { Artwork } from './types';
import { useAuth } from './contexts/AuthContext';
import { isSupabaseConfigured } from './lib/supabase';
import { fetchArtworks, publishArtwork, updateArtwork } from './lib/artworks';

export default function App() {
  const { user } = useAuth();
  const [realArtworks, setRealArtworks] = useState<Artwork[]>([]);
  const [loadingArtworks, setLoadingArtworks] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<'explore' | 'profile' | 'upload' | 'detail'>('explore');
  const [selectedArtworkId, setSelectedArtworkId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signIn' | 'signUp'>('signIn');

  const artworks = realArtworks;
  const selectedArtwork = artworks.find((art) => art.id === selectedArtworkId);

  const loadArtworks = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoadingArtworks(false);
      return;
    }
    setLoadingArtworks(true);
    const data = await fetchArtworks();
    setRealArtworks(data);
    setLoadingArtworks(false);
  }, []);

  useEffect(() => {
    loadArtworks();
  }, [loadArtworks]);

  const openAuthModal = (mode: 'signIn' | 'signUp' = 'signIn') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  const handleNavigate = (screen: 'explore' | 'profile' | 'upload' | 'detail', artworkId?: string) => {
    setCurrentScreen(screen);
    if (screen === 'detail' && artworkId) {
      setSelectedArtworkId(artworkId);
    } else if (screen !== 'detail') {
      setSelectedArtworkId(null);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectArtwork = (artworkId: string) => {
    if (artworkId) {
      setSelectedArtworkId(artworkId);
      setCurrentScreen('detail');
    } else {
      setSelectedArtworkId(null);
      setCurrentScreen('explore');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Publish a brand-new (non-remix) artwork: uploads files to Storage, inserts
  // the DB row, then prepends it to local state so it shows up immediately.
  const handlePublishArtwork = async (newArt: {
    title: string;
    description: string;
    tags: string[];
    previewFile: File;
    sourceFile: File | null;
  }): Promise<{ error: string | null }> => {
    if (!user) {
      openAuthModal('signIn');
      return { error: 'Please sign in first.' };
    }
    const { artwork, error } = await publishArtwork({
      ...newArt,
      ownerId: user.id,
      type: 'Original',
    });
    if (error || !artwork) {
      return { error: error || 'Something went wrong publishing this artwork.' };
    }
    setRealArtworks((prev) => [artwork, ...prev]);
    setSelectedArtworkId(artwork.id);
    setCurrentScreen('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return { error: null };
  };

  // Publish a fork/remix of an existing artwork.
  const handlePublishFork = async (
    parentArtworkId: string,
    forkDetails: {
      title: string;
      description: string;
      tags: string[];
      previewFile: File;
      sourceFile: File | null;
    }
  ): Promise<{ error: string | null }> => {
    if (!user) {
      openAuthModal('signIn');
      return { error: 'Please sign in first.' };
    }
    const { artwork, error } = await publishArtwork({
      ...forkDetails,
      ownerId: user.id,
      type: 'Remix',
      parentArtworkId,
    });
    if (error || !artwork) {
      return { error: error || 'Something went wrong publishing this remix.' };
    }
    setRealArtworks((prev) => {
      const updatedParent = prev.map((art) =>
        art.id === parentArtworkId ? { ...art, forks: String((Number(art.forks) || 0) + 1) } : art
      );
      return [artwork, ...updatedParent];
    });
    setSelectedArtworkId(artwork.id);
    setCurrentScreen('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return { error: null };
  };

  // Edits an existing artwork's title/description/tags, and optionally
  // replaces its cover image. The source PSD file is never touched here.
  const handleUpdateArtwork = async (
    artworkId: string,
    updates: { title: string; description: string; tags: string[]; newPreviewFile: File | null }
  ): Promise<{ error: string | null }> => {
    if (!user) {
      openAuthModal('signIn');
      return { error: 'Please sign in first.' };
    }
    const current = realArtworks.find((art) => art.id === artworkId);
    if (!current) {
      return { error: 'Could not find that artwork.' };
    }
    const { artwork, error } = await updateArtwork({
      artworkId,
      ownerId: user.id,
      title: updates.title,
      description: updates.description,
      tags: updates.tags,
      newPreviewFile: updates.newPreviewFile,
      previousImagePath: updates.newPreviewFile ? current.imagePath : undefined,
    });
    if (error || !artwork) {
      return { error: error || 'Something went wrong updating this artwork.' };
    }
    setRealArtworks((prev) => prev.map((art) => (art.id === artworkId ? artwork : art)));
    return { error: null };
  };

  return (
    <div className="min-h-screen bg-[#F2F2F7] text-slate-900 font-sans flex flex-col selection:bg-blue-100 selection:text-blue-600">
      {!isSupabaseConfigured && (
        <div className="fixed top-0 w-full z-[60] bg-amber-400 text-amber-950 text-xs font-bold text-center py-2 px-4">
          Backend isn't configured yet — accounts, uploads, and downloads won't work until Supabase is set up. See SETUP.md.
        </div>
      )}

      <Header
        currentScreen={currentScreen}
        onNavigate={handleNavigate}
        searchQuery={searchQuery}
        onSearch={setSearchQuery}
        onRequireAuth={() => openAuthModal('signIn')}
      />

      <div className={`flex-grow ${!isSupabaseConfigured ? 'pt-8' : ''}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentScreen + (selectedArtworkId || '')}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="w-full h-full"
          >
            {currentScreen === 'explore' && (
              <ExploreScreen
                artworks={artworks}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                onSelectArtwork={handleSelectArtwork}
              />
            )}

            {currentScreen === 'profile' && (
              <ProfileScreen
                artworks={artworks}
                onSelectArtwork={handleSelectArtwork}
                onRequireAuth={() => openAuthModal('signIn')}
              />
            )}

            {currentScreen === 'upload' && (
              user ? (
                <UploadScreen onPublish={handlePublishArtwork} />
              ) : (
                <div className="w-full min-h-screen bg-[#F2F2F7] text-slate-900 pt-32 pb-20 px-6 flex flex-col items-center justify-center text-center">
                  <h1 className="text-2xl font-black tracking-tight text-slate-900 mb-2">Sign in to publish artwork</h1>
                  <p className="text-sm text-slate-500 font-semibold mb-6 max-w-sm">
                    You'll need an account to upload and share your work on LayerHub.
                  </p>
                  <button
                    onClick={() => openAuthModal('signIn')}
                    className="px-6 py-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-widest transition-all active:scale-95 cursor-pointer flex items-center gap-2 shadow-sm"
                  >
                    <LogIn className="w-4 h-4" />
                    Sign In
                  </button>
                </div>
              )
            )}

            {currentScreen === 'detail' && selectedArtwork && (
              <DetailScreen
                artwork={selectedArtwork}
                artworks={artworks}
                onSelectArtwork={handleSelectArtwork}
                onNavigateToProfile={() => handleNavigate('profile')}
                onPublishFork={handlePublishFork}
                onUpdateArtwork={handleUpdateArtwork}
                onRequireAuth={() => openAuthModal('signIn')}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <Footer onNavigate={handleNavigate} />

      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
      />
    </div>
  );
}
