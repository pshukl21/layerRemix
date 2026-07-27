import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const ResetPasswordScreen: React.FC = () => {
  const { user, loading, updatePassword } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await updatePassword(password);
    setSubmitting(false);
    if (updateError) {
      setError(updateError);
      return;
    }
    setDone(true);
  };

  // Following the reset-password email link briefly establishes a session
  // while Supabase's client parses the recovery token out of the URL —
  // `loading` covers that window so we don't flash an error before it's
  // done. If there's still no session after that, the link was invalid or
  // has expired.
  if (loading) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center text-slate-400 text-sm font-semibold">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="w-full min-h-screen flex flex-col items-center justify-center text-center px-6">
        <h1 className="text-xl font-black text-slate-900 mb-2">This reset link isn't valid</h1>
        <p className="text-sm text-slate-500 font-semibold mb-6 max-w-sm">
          It may have expired, or already been used. Request a new password reset link and try again.
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-widest transition-all active:scale-95 cursor-pointer"
        >
          Back to LayerRemix
        </button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="w-full min-h-screen flex flex-col items-center justify-center text-center px-6">
        <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-4" />
        <h1 className="text-xl font-black text-slate-900 mb-2">Password updated</h1>
        <p className="text-sm text-slate-500 font-semibold mb-6 max-w-sm">
          Your password has been changed. You're already signed in with it.
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-widest transition-all active:scale-95 cursor-pointer"
        >
          Continue to LayerRemix
        </button>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-xl shadow-sm p-8">
        <div className="mb-6 text-center">
          <span className="font-bold text-2xl tracking-tighter text-slate-900">LayerRemix</span>
          <h1 className="mt-3 text-lg font-black text-slate-900">Set a new password</h1>
          <p className="text-xs text-slate-500 font-semibold mt-1">Choose a new password for your account.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
              New Password
            </label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoFocus
              className="w-full bg-slate-100/80 border border-slate-200 rounded-xl py-2.5 px-3.5 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 transition-colors"
              placeholder="At least 6 characters"
              type="password"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
              Confirm New Password
            </label>
            <input
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-slate-100/80 border border-slate-200 rounded-xl py-2.5 px-3.5 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 transition-colors"
              placeholder="Re-enter your new password"
              type="password"
            />
          </div>

          {error && (
            <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 active:scale-[0.98] py-3.5 rounded-lg text-white font-bold text-xs tracking-widest uppercase transition-all shadow-sm hover:shadow-md cursor-pointer flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4 fill-white/10" />
            {submitting ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
};
