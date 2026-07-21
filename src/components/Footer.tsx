import React from 'react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full py-8 px-6 md:px-12 flex flex-col md:flex-row justify-between items-center gap-6 bg-slate-100 border-t border-slate-200">
      <div className="flex flex-col items-center md:items-start gap-1">
        <Link
          to="/"
          className="font-bold text-xl tracking-tighter text-slate-900 cursor-pointer"
        >
          LayerRemix
        </Link>
        <p className="text-slate-500 text-[11px] font-medium tracking-wide">
          © 2026 LayerRemix. The digital artist's canvas.
        </p>
      </div>
      <nav className="flex gap-6 text-[12px] font-bold uppercase tracking-wider text-slate-600">
        <a className="hover:text-blue-600 transition-colors cursor-pointer">About</a>
        <a className="hover:text-blue-600 transition-colors cursor-pointer">Terms</a>
        <a className="hover:text-blue-600 transition-colors cursor-pointer">Privacy</a>
        <a className="hover:text-blue-600 transition-colors cursor-pointer">Support</a>
      </nav>
    </footer>
  );
};
