import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, SearchX, X, Upload as UploadIcon } from 'lucide-react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { ExploreScreen } from './components/ExploreScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { UploadScreen } from './components/UploadScreen';
import { DetailScreen } from './components/DetailScreen';
import { AuthModal } from './components/AuthModal';
import { ResetPasswordScreen } from './components/ResetPasswordScreen';
import { NeedCreditsModal } from './components/NeedCreditsModal';
import { Artwork } from './types';
import { useAuth } from './contexts/AuthContext';
import { isSupabaseConfigured } from './lib/supabase';
import { fetchArtworks, publishArtwork, updateArtwork, deleteArtwork } from './lib/artworks';

interface PublishInput {
  title: string;
  description: string;
  tags: string[];
  previewFile: File;
  sourceFilePath: string | null;
  sourceFileName: string | null;
  resolution: string;
  focalX: number;
  focalY: number;
}

interface UpdateInput {
  title: string;
  description: string;
  tags: string[];
  newPreviewFile: File | null;
  focalX: number;
  focalY: number;
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
  onDeleteArtwork,
  onRequireAuth,
  onRequireCredits,
}: {
  artworks: Artwork[];
  loadingArtworks: boolean;
  onSelectArtwork: (id: string) => void;
  onNavigateToProfile: () => void;
  onPublishFork: (parentArtworkId: string, forkDetails: PublishInput) => Promise<{ error: string | null }>;
  onUpdateArtwork: (artworkId: string, updates: UpdateInput) => Promise<{ error: string | null }>;
  onDeleteArtwork: (artworkId: string) => Promise<{ error: string | null }>;
  onRequireAuth: () => void;
  onRequireCredits: () => void;
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
      onDeleteArtwork={onDeleteArtwork}
      onRequireAuth={onRequireAuth}
      onRequireCredits={onRequireCredits}
    />
  );
}

// Resolves the :username route param and shows that user's public profile.
function ProfileByUsernameRoute({
  artworks,
  onSelectArtwork,
  onRequireAuth,
}: {
  artworks: Artwork[];
  onSelectArtwork: (id: string) => void;
  onRequireAuth: () => void;
}) {
  const { username } = useParams<{ username: string }>();
  return (
    <ProfileScreen
      artworks={artworks}
      onSelectArtwork={onSelectArtwork}
      onRequireAuth={onRequireAuth}
      viewedUsername={username}
    />
  );
}

export default function App() {
  const { user, profile, refreshProfile } = useAuth();
  const [realArtworks, setRealArtworks] = useState<Artwork[]>([]);
  const [loadingArtworks, setLoadingArtworks] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signIn' | 'signUp'>('signIn');
  const [needCreditsModalOpen, setNeedCreditsModalOpen] = useState(false);
  const [creditsBannerDismissed, setCreditsBannerDismissed] = useState(false);
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

  // Proactively show the "you need a credit" explainer once per browser
  // session for a brand-new account — someone with 0 credits who hasn't
  // published anything yet. This is the same modal shown reactively when
  // someone tries to download without credits; here it's shown once,
  // unprompted, right after their first login, so they aren't surprised
  // by it later.
  useEffect(() => {
    if (!user || !profile || loadingArtworks) return;
    if (profile.credits > 0) return;
    const hasPublishedAnything = artworks.some((art) => art.ownerId === user.id);
    if (hasPublishedAnything) return;

    const seenKey = `layerremix:welcomeCreditsShown:${user.id}`;
    if (sessionStorage.getItem(seenKey)) return;
    sessionStorage.setItem(seenKey, '1');
    setNeedCreditsModalOpen(true);
  }, [user, profile, artworks, loadingArtworks]);

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
      focalX: updates.focalX,
      focalY: updates.focalY,
    });
    if (error || !artwork) {
      return { error: error || 'Something went wrong updating this artwork.' };
    }
    setRealArtworks((prev) => prev.map((art) => (art.id === artworkId ? artwork : art)));
    return { error: null };
  };

  // Permanently deletes one of the current user's own artworks. Costs 1
  // credit — enforced atomically server-side via the RPC, not just in the UI.
  const handleDeleteArtwork = async (artworkId: string): Promise<{ error: string | null }> => {
    if (!user) {
      openAuthModal('signIn');
      return { error: 'Please sign in first.' };
    }
    const current = realArtworks.find((art) => art.id === artworkId);
    if (!current || current.ownerId !== user.id) {
      return { error: 'Could not find that artwork.' };
    }
    const { error } = await deleteArtwork(artworkId);
    if (error) {
      return { error };
    }
    setRealArtworks((prev) => prev.filter((art) => art.id !== artworkId));
    await refreshProfile();
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
        {user && profile && profile.credits === 0 && !creditsBannerDismissed && (
          <div className="sticky top-16 z-40 w-full bg-blue-600 text-white text-xs font-bold text-center py-2.5 px-4 flex items-center justify-center gap-3 shadow-sm">
            <span>🎨 Upload your first PSD to earn a credit and start downloading.</span>
            <button
              onClick={() => navigate('/upload')}
              className="shrink-0 flex items-center gap-1 bg-white/15 hover:bg-white/25 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
            >
              <UploadIcon className="w-3 h-3" />
              Upload Now
            </button>
            <button
              onClick={() => setCreditsBannerDismissed(true)}
              className="shrink-0 text-white/70 hover:text-white cursor-pointer"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
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
                path="/profile/:username"
                element={
                  <ProfileByUsernameRoute
                    artworks={artworks}
                    onSelectArtwork={handleSelectArtwork}
                    onRequireAuth={() => openAuthModal('signIn')}
                  />
                }
              />

              <Route path="/reset-password" element={<ResetPasswordScreen />} />

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
                    onRequireCredits={() => setNeedCreditsModalOpen(true)}
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

      <NeedCreditsModal
        open={needCreditsModalOpen}
        onClose={() => setNeedCreditsModalOpen(false)}
      />
    </div>
  );
}
