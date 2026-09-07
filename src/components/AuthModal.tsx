import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  initialMode?: 'signIn' | 'signUp';
}

type Mode = 'signIn' | 'signUp' | 'forgotPassword';

// A real format check — not just relying on the browser's own <input
// type="email">, which is inconsistent across browsers and doesn't catch
// things like double dots or a missing top-level domain.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Catches the single most common real-world cause of "user typo'd their
// own email": fat-fingering a well-known provider's domain (gmial.com,
// yahooo.com, etc.). Not exhaustive — this deliberately only flags the
// handful of huge providers where a typo is overwhelmingly likely to be a
// mistake rather than someone's actual (less common) domain.
const COMMON_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
  'aol.com',
  'live.com',
  'msn.com',
];

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  return matrix[a.length][b.length];
}

// Returns a suggested full email (with corrected domain) if the typed
// domain is a near-miss of a well-known provider, or null if it looks
// fine (either an exact match already, or too different to guess at).
function suggestEmailCorrection(email: string): string | null {
  const atIndex = email.lastIndexOf('@');
  if (atIndex === -1) return null;
  const localPart = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1).toLowerCase();
  if (!domain || COMMON_DOMAINS.includes(domain)) return null;

  for (const candidate of COMMON_DOMAINS) {
    const distance = levenshteinDistance(domain, candidate);
    // Small edit distance relative to length — catches one or two
    // mistyped/missing/swapped characters without flagging genuinely
    // different (and possibly correct) domains.
    if (distance > 0 && distance <= 2) {
      return `${localPart}@${candidate}`;
    }
  }
  return null;
}

export const AuthModal: React.FC<AuthModalProps> = ({ open, onClose, initialMode = 'signIn' }) => {
  const { signIn, signUp, sendPasswordResetEmail } = useAuth();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null);

  const reset = () => {
    setEmail('');
    setPassword('');
    setUsername('');
    setError(null);
    setInfo(null);
    setSubmitting(false);
    setEmailSuggestion(null);
  };

  const handleClose = () => {
    reset();
    setMode(initialMode);
    onClose();
  };

  const switchMode = (next: Mode) => {
    setError(null);
    setInfo(null);
    setMode(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!EMAIL_REGEX.test(email.trim())) {
      setError('That email address doesn\'t look valid — double check it and try again.');
      return;
    }

    setSubmitting(true);

    if (mode === 'forgotPassword') {
      const { error: resetError } = await sendPasswordResetEmail(email);
      setSubmitting(false);
      if (resetError) {
        setError(resetError);
        return;
      }
      setInfo("If an account exists for that email, we've sent a password reset link.");
      return;
    }

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

  const titles: Record<Mode, { heading: string; subtext: string }> = {
    signIn: { heading: 'Welcome back', subtext: 'Sign in to upload, fork, and download files.' },
    signUp: { heading: 'Create your account', subtext: 'Join LayerRemix to publish and download artwork.' },
    forgotPassword: { heading: 'Reset your password', subtext: "Enter your email and we'll send you a reset link." },
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

            {mode === 'forgotPassword' && (
              <button
                onClick={() => switchMode('signIn')}
                className="absolute top-5 left-5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}

            <div className="mb-6 text-center">
              <span className="font-bold text-2xl tracking-tighter text-slate-900">LayerRemix</span>
              <h2 className="mt-3 text-lg font-black text-slate-900">{titles[mode].heading}</h2>
              <p className="text-xs text-slate-500 font-semibold mt-1">{titles[mode].subtext}</p>
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
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailSuggestion) setEmailSuggestion(null);
                  }}
                  onBlur={() => setEmailSuggestion(suggestEmailCorrection(email))}
                  required
                  className="w-full bg-slate-100/80 border border-slate-200 rounded-xl py-2.5 px-3.5 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 transition-colors"
                  placeholder="you@example.com"
                  type="email"
                />
                {emailSuggestion && (
                  <button
                    type="button"
                    onClick={() => {
                      setEmail(emailSuggestion);
                      setEmailSuggestion(null);
                    }}
                    className="text-[11px] font-bold text-amber-600 hover:text-amber-700 cursor-pointer"
                  >
                    Did you mean <span className="underline">{emailSuggestion}</span>?
                  </button>
                )}
              </div>

              {mode !== 'forgotPassword' && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                      Password
                    </label>
                    {mode === 'signIn' && (
                      <button
                        type="button"
                        onClick={() => switchMode('forgotPassword')}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
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
              )}

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
                {submitting
                  ? 'Please wait…'
                  : mode === 'signIn'
                  ? 'Sign In'
                  : mode === 'signUp'
                  ? 'Create Account'
                  : 'Send Reset Link'}
              </button>
            </form>

            {mode !== 'forgotPassword' && (
              <p className="text-center text-xs font-semibold text-slate-500 mt-6">
                {mode === 'signIn' ? "Don't have an account?" : 'Already have an account?'}{' '}
                <button
                  onClick={() => switchMode(mode === 'signIn' ? 'signUp' : 'signIn')}
                  className="text-blue-600 hover:text-blue-700 font-bold cursor-pointer"
                >
                  {mode === 'signIn' ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
