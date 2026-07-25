import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { X, Coins, Upload } from 'lucide-react';

interface NeedCreditsModalProps {
  open: boolean;
  onClose: () => void;
}

export const NeedCreditsModal: React.FC<NeedCreditsModalProps> = ({ open, onClose }) => {
  const navigate = useNavigate();

  const handleUploadClick = () => {
    onClose();
    navigate('/upload');
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm px-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm bg-white rounded-xl shadow-2xl border border-slate-200 p-8 text-center"
          >
            <button
              onClick={onClose}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-4">
              <Coins className="w-7 h-7 text-amber-500" />
            </div>

            <h2 className="text-lg font-black text-slate-900 mb-2">You need a download credit</h2>
            <p className="text-sm text-slate-500 font-semibold leading-relaxed mb-6">
              New accounts start with 0 credits. Publish your first original artwork or a remix to earn one —
              then you'll be able to download other people's files too.
            </p>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-lg border border-slate-200 text-slate-700 font-bold text-xs uppercase tracking-widest hover:border-slate-300 transition-all cursor-pointer"
              >
                Maybe Later
              </button>
              <button
                onClick={handleUploadClick}
                className="flex-1 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] py-3 rounded-lg text-white font-bold text-xs tracking-widest uppercase transition-all shadow-sm hover:shadow-md cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
