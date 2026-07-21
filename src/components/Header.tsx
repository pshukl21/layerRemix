import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Upload, Search, LogOut, Coins } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { DEFAULT_AVATAR } from '../lib/artworks';

interface HeaderProps {
  onSearch: (query: string) => void;
  searchQuery: string;
  onRequireAuth: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onSearch, searchQuery, onRequireAuth }) => {
  const { user, profile, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const isExplore = location.pathname === '/';
  const isProfile = location.pathname === '/profile';
  const isUpload = location.pathname === '/upload';

  const handleUploadClick = () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    navigate('/upload');
  };

  const handleAvatarClick = () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    setMenuOpen((open) => !open);
  };

  return (
    <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 md:px-12 h-16 bg-white/80 backdrop-blur-xl border-b border-slate-200/80 shadow-xs">
      <div className="flex items-center gap-8">
        <Link
          to="/"
          className="font-bold text-2xl tracking-tighter text-slate-900 cursor-pointer hover:opacity-95 select-none"
        >
          LayerRemix
        </Link>
        <nav className="hidden md:flex gap-6 items-center">
          <Link
            to="/"
            className={`font-semibold transition-colors duration-200 text-sm ${
              isExplore ? 'text-blue-600 border-b-2 border-blue-600 pb-1 mt-1' : 'text-slate-600 hover:text-blue-600'
            }`}
          >
            Explore Art
          </Link>
        </nav>
      </div>

      <div className="flex items-center gap-6">
        {/* Header Search Bar (Only shown or styled nicely on md screens) */}
        <div className="hidden md:flex relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-[18px] h-[18px] group-focus-within:text-blue-600" />
          <input
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            className="bg-slate-100/80 border border-slate-200 rounded-full py-1.5 pl-9 pr-4 w-60 focus:outline-none focus:border-blue-600 text-xs font-semibold text-slate-800 placeholder-slate-400 transition-all duration-300"
            placeholder="Search art tags or titles..."
            type="text"
          />
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleUploadClick}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer ${
              isUpload
                ? 'bg-slate-200 text-slate-800'
                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-xs'
            }`}
          >
            <Upload className="w-4 h-4" />
            Upload
          </button>

          {user ? (
            <div className="relative flex items-center gap-2.5">
              <button
                onClick={handleAvatarClick}
                title="Download credits"
                className="hidden sm:flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer hover:bg-amber-100 transition-colors"
              >
                <Coins className="w-3.5 h-3.5" />
                {profile?.credits ?? 0}
              </button>
              <div
                onClick={handleAvatarClick}
                className={`w-9 h-9 rounded-full border overflow-hidden cursor-pointer hover:border-blue-600 transition-all ${
                  isProfile ? 'border-blue-600' : 'border-slate-200'
                }`}
              >
                <img
                  className="w-full h-full object-cover"
                  src={profile?.avatarUrl || DEFAULT_AVATAR}
                  alt="Profile Avatar"
                  referrerPolicy="no-referrer"
                />
              </div>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-lg z-20 py-2 overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-slate-100">
                      <p className="text-xs font-bold text-slate-800 truncate">@{profile?.username || 'you'}</p>
                      <p className="flex items-center gap-1.5 text-[11px] font-bold text-amber-600 mt-1">
                        <Coins className="w-3.5 h-3.5" />
                        {profile?.credits ?? 0} download credit{profile?.credits === 1 ? '' : 's'}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        navigate('/profile');
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                    >
                      View Profile
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        signOut();
                        navigate('/');
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 cursor-pointer flex items-center gap-2"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={onRequireAuth}
              className="px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider border border-slate-200 text-slate-700 hover:border-blue-600 hover:text-blue-600 transition-all active:scale-95 cursor-pointer"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
