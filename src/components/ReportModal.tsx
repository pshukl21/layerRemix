import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Flag, Check } from 'lucide-react';
import { submitReport, REPORT_REASONS } from '../lib/reports';

interface ReportModalProps {
  open: boolean;
  artworkId: string;
  artworkTitle: string;
  reporterId: string | null;
  onClose: () => void;
  onRequireAuth: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  open,
  artworkId,
  artworkTitle,
  reporterId,
  onClose,
  onRequireAuth,
}) => {
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleClose = () => {
    onClose();
    // Reset shortly after close so the form doesn't visibly reset mid-close-animation.
    setTimeout(() => {
      setReason(REPORT_REASONS[0]);
      setDetails('');
      setError(null);
      setSubmitted(false);
    }, 200);
  };

  const handleSubmit = async () => {
    if (!reporterId) {
      onRequireAuth();
      return;
    }
    setSubmitting(true);
    setError(null);
    const { error: submitError } = await submitReport(artworkId, reporterId, reason, details);
    setSubmitting(false);
    if (submitError) {
      setError(submitError);
      return;
    }
    setSubmitted(true);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-6"
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm bg-white rounded-xl shadow-2xl border border-slate-200 p-6"
          >
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {submitted ? (
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-6 h-6 text-emerald-600" />
                </div>
                <h2 className="text-base font-black text-slate-900 mb-1.5">Report submitted</h2>
                <p className="text-xs text-slate-500 font-semibold leading-relaxed mb-5">
                  Thanks for flagging this — our team will take a look.
                </p>
                <button
                  onClick={handleClose}
                  className="w-full py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-widest transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <Flag className="w-4 h-4 text-red-500" />
                  <h2 className="text-base font-black text-slate-900">Report this artwork</h2>
                </div>
                <p className="text-xs text-slate-500 font-semibold mb-5 truncate">"{artworkTitle}"</p>

                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
                  Reason
                </label>
                <div className="flex flex-col gap-1.5 mb-4">
                  {REPORT_REASONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setReason(r)}
                      className={`text-left px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                        reason === r
                          ? 'bg-blue-50 border-blue-300 text-blue-700'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>

                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
                  Additional details (optional)
                </label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  rows={3}
                  placeholder="Anything else that would help us review this"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 transition-colors resize-none mb-5"
                />

                {error && <p className="text-xs font-semibold text-red-600 mb-3">{error}</p>}

                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full py-3 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold text-xs uppercase tracking-widest transition-all cursor-pointer"
                >
                  {submitting ? 'Submitting…' : 'Submit Report'}
                </button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
