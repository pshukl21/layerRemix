import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  initialMode?: 'signIn' | 'signUp';
}

export const AuthModal: React.FC<AuthModalProps> = ({ open, onClose, initialMode = 'signIn' }) => {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signIn' | 'signUp'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setEmail('');
    setPassword('');
    setUsername('');
    setError(null);
    setInfo(null);
    setSubmitting(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);

    if (mode === 'signUp') {
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        setSubmitting(false);
        return;
      }
      const { error: signUpError } = await signUp(email, password, username);
      setSubmitting(false);
      if (signUpError) {
        setError(signUpError);
        return;
      }
      setInfo('Account created! Check your email if confirmation is required, then sign in.');
      setMode('signIn');
      return;
    }

    const { error: signInError } = await signIn(email, password);
    setSubmitting(false);
    if (signInError) {
      setError(signInError);
      return;
    }
    handleClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm px-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm bg-white rounded-xl shadow-2xl border border-slate-200 p-8"
          >
            <button
              onClick={handleClose}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-6 text-center">
              <span className="font-bold text-2xl tracking-tighter text-slate-900">LayerRemix</span>
              <h2 className="mt-3 text-lg font-black text-slate-900">
                {mode === 'signIn' ? 'Welcome back' : 'Create your account'}
              </h2>
              <p className="text-xs text-slate-500 font-semibold mt-1">
                {mode === 'signIn'
                  ? 'Sign in to upload, fork, and download files.'
                  : 'Join LayerRemix to publish and download artwork.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signUp' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                    Username
                  </label>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="w-full bg-slate-100/80 border border-slate-200 rounded-xl py-2.5 px-3.5 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 transition-colors"
                    placeholder="e.g. luna_creative"
                    type="text"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                  Email
                </label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-slate-100/80 border border-slate-200 rounded-xl py-2.5 px-3.5 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 transition-colors"
                  placeholder="you@example.com"
                  type="email"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                  Password
                </label>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full bg-slate-100/80 border border-slate-200 rounded-xl py-2.5 px-3.5 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 transition-colors"
                  placeholder="At least 6 characters"
                  type="password"
                />
              </div>

              {error && (
                <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5">
                  {error}
                </p>
              )}
              {info && (
                <p className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3.5 py-2.5">
                  {info}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 active:scale-[0.98] py-3.5 rounded-lg text-white font-bold text-xs tracking-widest uppercase transition-all shadow-sm hover:shadow-md cursor-pointer flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 fill-white/10" />
                {submitting ? 'Please wait…' : mode === 'signIn' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            <p className="text-center text-xs font-semibold text-slate-500 mt-6">
              {mode === 'signIn' ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button
                onClick={() => {
                  setError(null);
                  setInfo(null);
                  setMode(mode === 'signIn' ? 'signUp' : 'signIn');
                }}
                className="text-blue-600 hover:text-blue-700 font-bold cursor-pointer"
              >
                {mode === 'signIn' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
