import React from 'react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full py-8 px-6 md:px-12 flex flex-col items-center justify-center gap-1 bg-slate-100 border-t border-slate-200">
      <Link
        to="/"
        className="font-bold text-xl tracking-tighter text-slate-900 cursor-pointer"
      >
        LayerRemix
      </Link>
      <p className="text-slate-500 text-[11px] font-medium tracking-wide">
        © 2026 LayerRemix. The digital artist's canvas.
      </p>
      <Link to="/terms" className="text-slate-400 hover:text-blue-600 text-[11px] font-bold tracking-wide transition-colors">
        Terms of Service
      </Link>
    </footer>
  );
};
