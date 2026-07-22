import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, SearchX } from 'lucide-react';
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
import { fetchArtworks, publishArtwork, updateArtwork, deleteArtwork } from './lib/artworks';

interface PublishInput {
  title: string;
  description: string;
  tags: string[];
  previewFile: File;
  sourceFile: File | null;
  resolution: string;
}

interface UpdateInput {
  title: string;
  description: string;
  tags: string[];
  newPreviewFile: File | null;
}

// Resolves the :id route param to an artwork and renders DetailScreen,
// so a direct link/refresh/share to /art/:id always shows the right piece.
function DetailRoute({
  artworks,
  loadingArtworks,
  onSelectArtwork,
  onNavigateToProfile,
  onPublishFork,
  onUpdateArtwork,
  onRequireAuth,
}: {
  artworks: Artwork[];
  loadingArtworks: boolean;
  onSelectArtwork: (id: string) => void;
  onNavigateToProfile: () => void;
  onPublishFork: (parentArtworkId: string, forkDetails: PublishInput) => Promise<{ error: string | null }>;
  onUpdateArtwork: (artworkId: string, updates: UpdateInput) => Promise<{ error: string | null }>;
  onRequireAuth: () => void;
}) {
  const { id } = useParams<{ id: string }>();
  const artwork = artworks.find((art) => art.id === id);

  if (!artwork) {
    if (loadingArtworks) {
      return (
        <div className="w-full min-h-screen flex items-center justify-center text-slate-400 text-sm font-semibold">
          Loading…
        </div>
      );
    }
    return (
      <div className="w-full min-h-screen text-slate-900 pt-32 pb-20 px-6 flex flex-col items-center justify-center text-center">
        <SearchX className="w-10 h-10 text-slate-300 mb-4" />
        <h1 className="text-2xl font-black tracking-tight text-slate-900 mb-2">Artwork not found</h1>
        <p className="text-sm text-slate-500 font-semibold mb-6 max-w-sm">
          This piece may have been removed, or the link isn't quite right.
        </p>
        <button
          onClick={() => onSelectArtwork('')}
          className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-widest transition-all active:scale-95 cursor-pointer shadow-sm"
        >
          Back to Explore
        </button>
      </div>
    );
  }

  return (
    <DetailScreen
      artwork={artwork}
      artworks={artworks}
      onSelectArtwork={onSelectArtwork}
      onNavigateToProfile={onNavigateToProfile}
      onPublishFork={onPublishFork}
      onUpdateArtwork={onUpdateArtwork}
      onRequireAuth={onRequireAuth}
    />
  );
}

export default function App() {
  const { user, refreshProfile } = useAuth();
  const [realArtworks, setRealArtworks] = useState<Artwork[]>([]);
  const [loadingArtworks, setLoadingArtworks] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signIn' | 'signUp'>('signIn');
  const navigate = useNavigate();
  const location = useLocation();

  const artworks = realArtworks;

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

  const handleSelectArtwork = (artworkId: string) => {
    navigate(artworkId ? `/art/${artworkId}` : '/');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Publish a brand-new (non-remix) artwork: uploads files to Storage, inserts
  // the DB row, then prepends it to local state and navigates to its page.
  const handlePublishArtwork = async (newArt: PublishInput): Promise<{ error: string | null }> => {
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
    await refreshProfile();
    navigate(`/art/${artwork.id}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return { error: null };
  };

  // Publish a fork/remix of an existing artwork.
  const handlePublishFork = async (
    parentArtworkId: string,
    forkDetails: PublishInput
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
    await refreshProfile();
    navigate(`/art/${artwork.id}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return { error: null };
  };

  // Edits an existing artwork's title/description/tags, and optionally
  // replaces its cover image. The source PSD file is never touched here.
  const handleUpdateArtwork = async (
    artworkId: string,
    updates: UpdateInput
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

  // Permanently deletes one of the current user's own artworks.
  const handleDeleteArtwork = async (artworkId: string): Promise<{ error: string | null }> => {
    if (!user) {
      openAuthModal('signIn');
      return { error: 'Please sign in first.' };
    }
    const current = realArtworks.find((art) => art.id === artworkId);
    if (!current || current.ownerId !== user.id) {
      return { error: 'Could not find that artwork.' };
    }
    const { error } = await deleteArtwork(artworkId, current.imagePath, current.sourceFilePath);
    if (error) {
      return { error };
    }
    setRealArtworks((prev) => prev.filter((art) => art.id !== artworkId));
    navigate('/');
    return { error: null };
  };

  return (
    <div className="min-h-screen ps-blueprint-bg text-slate-900 font-sans flex flex-col selection:bg-blue-100 selection:text-blue-600">
      {!isSupabaseConfigured && (
        <div className="fixed top-0 w-full z-[60] bg-amber-400 text-amber-950 text-xs font-bold text-center py-2 px-4">
          Backend isn't configured yet — accounts, uploads, and downloads won't work until Supabase is set up. See SETUP.md.
        </div>
      )}

      <Header
        searchQuery={searchQuery}
        onSearch={setSearchQuery}
        onRequireAuth={() => openAuthModal('signIn')}
      />

      <div className={`flex-grow ${!isSupabaseConfigured ? 'pt-8' : ''}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="w-full h-full"
          >
            <Routes location={location}>
              <Route
                path="/"
                element={
                  <ExploreScreen
                    artworks={artworks}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    onSelectArtwork={handleSelectArtwork}
                  />
                }
              />

              <Route
                path="/profile"
                element={
                  <ProfileScreen
                    artworks={artworks}
                    onSelectArtwork={handleSelectArtwork}
                    onRequireAuth={() => openAuthModal('signIn')}
                  />
                }
              />

              <Route
                path="/upload"
                element={
                  user ? (
                    <UploadScreen onPublish={handlePublishArtwork} />
                  ) : (
                    <div className="w-full min-h-screen text-slate-900 pt-32 pb-20 px-6 flex flex-col items-center justify-center text-center">
                      <h1 className="text-2xl font-black tracking-tight text-slate-900 mb-2">Sign in to publish artwork</h1>
                      <p className="text-sm text-slate-500 font-semibold mb-6 max-w-sm">
                        You'll need an account to upload and share your work on LayerRemix.
                      </p>
                      <button
                        onClick={() => openAuthModal('signIn')}
                        className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-widest transition-all active:scale-95 cursor-pointer flex items-center gap-2 shadow-sm"
                      >
                        <LogIn className="w-4 h-4" />
                        Sign In
                      </button>
                    </div>
                  )
                }
              />

              <Route
                path="/art/:id"
                element={
                  <DetailRoute
                    artworks={artworks}
                    loadingArtworks={loadingArtworks}
                    onSelectArtwork={handleSelectArtwork}
                    onNavigateToProfile={() => navigate('/profile')}
                    onPublishFork={handlePublishFork}
                    onUpdateArtwork={handleUpdateArtwork}
                    onDeleteArtwork={handleDeleteArtwork}
                    onRequireAuth={() => openAuthModal('signIn')}
                  />
                }
              />

              <Route
                path="*"
                element={
                  <div className="w-full min-h-screen text-slate-900 pt-32 pb-20 px-6 flex flex-col items-center justify-center text-center">
                    <h1 className="text-2xl font-black tracking-tight text-slate-900 mb-2">Page not found</h1>
                    <button
                      onClick={() => navigate('/')}
                      className="mt-4 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-widest transition-all active:scale-95 cursor-pointer shadow-sm"
                    >
                      Back to Explore
                    </button>
                  </div>
                }
              />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </div>

      <Footer />

      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
      />
    </div>
  );
}
