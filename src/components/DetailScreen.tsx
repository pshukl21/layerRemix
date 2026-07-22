import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { Download, GitFork, ArrowRight, Eye, Sparkles, ArrowLeft, Heart, FileUp, Image as ImageIcon, History, Layers, Pencil, ZoomIn, X } from 'lucide-react';
import { Artwork } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { getDownloadTarget, incrementDownloads, spendDownloadCredit } from '../lib/artworks';
import { parsePsdHeader, formatPsdResolution, getImageDimensions, formatImageResolution } from '../lib/psd';
import { EditArtworkModal } from './EditArtworkModal';

interface DetailScreenProps {
  artwork: Artwork;
  artworks: Artwork[];
  onSelectArtwork: (artworkId: string) => void;
  onNavigateToProfile: () => void;
  onRequireAuth: () => void;
  onPublishFork?: (parentArtworkId: string, forkDetails: {
    title: string;
    description: string;
    tags: string[];
    previewFile: File;
    sourceFile: File | null;
    resolution: string;
  }) => Promise<{ error: string | null }>;
  onUpdateArtwork?: (
    artworkId: string,
    updates: { title: string; description: string; tags: string[]; newPreviewFile: File | null }
  ) => Promise<{ error: string | null }>;
  onDeleteArtwork?: (artworkId: string) => Promise<{ error: string | null }>;
}

// Decorative Photoshop-style rulers with real numbered ticks. Purely
// aesthetic (not tied to the artwork's actual pixel grid), rendered as dark
// chrome so they stay legible against any page background.
const RULER_MARKS = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100];

const RulerH: React.FC = () => (
  <div className="flex-1 h-[22px] bg-[#27272a] border-b border-zinc-600 relative overflow-hidden flex">
    {RULER_MARKS.map((mark) => (
      <div key={mark} className="flex-1 relative border-l border-zinc-600 first:border-l-0">
        <span className="absolute top-0.5 left-1 text-[9px] font-bold text-zinc-300 leading-none ps-stat">{mark}</span>
        <div className="absolute bottom-0 left-1/4 w-px h-1 bg-zinc-600" />
        <div className="absolute bottom-0 left-1/2 w-px h-1.5 bg-zinc-500" />
        <div className="absolute bottom-0 left-3/4 w-px h-1 bg-zinc-600" />
      </div>
    ))}
  </div>
);

const RulerV: React.FC = () => (
  <div className="w-[22px] shrink-0 bg-[#27272a] border-r border-zinc-600 relative overflow-hidden flex flex-col">
    {RULER_MARKS.map((mark) => (
      <div key={mark} className="flex-1 relative border-t border-zinc-600 first:border-t-0">
        <div className="absolute top-0.5 left-0 right-0 flex flex-col items-center leading-[8px] gap-px">
          {String(mark).split('').map((digit, i) => (
            <span key={i} className="text-[7px] font-bold text-zinc-300">{digit}</span>
          ))}
        </div>
        <div className="absolute right-0 top-1/2 h-px w-1.5 bg-zinc-500" />
      </div>
    ))}
  </div>
);

export const DetailScreen: React.FC<DetailScreenProps> = ({
  artwork,
  artworks,
  onSelectArtwork,
  onNavigateToProfile,
  onRequireAuth,
  onPublishFork,
  onUpdateArtwork,
  onDeleteArtwork,
}) => {
  const { user, profile, refreshProfile } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [viewMode, setViewMode] = useState<'showcase' | 'tree' | 'fork'>('showcase');
  const [forkSubmitting, setForkSubmitting] = useState(false);
  const [forkError, setForkError] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Fork/Remix state form
  const [forkTitle, setForkTitle] = useState(`${artwork.title} (Remixed)`);
  const [forkDescription, setForkDescription] = useState(`Created a remix of @${artwork.author}'s original piece. Upgraded lighting effects, enhanced textures, and polished layer organization.`);
  const [forkTags, setForkTags] = useState(artwork.tags.join(', '));
  const [forkPsdFile, setForkPsdFile] = useState<File | null>(null);
  const [forkImgFile, setForkImgFile] = useState<File | null>(null);
  const [forkImgPreview, setForkImgPreview] = useState<string | null>(null);
  const [forkCertified, setForkCertified] = useState(true);

  // Sync fork state values whenever active artwork changes
  React.useEffect(() => {
    setForkTitle(`${artwork.title} (Remixed)`);
    setForkDescription(`Created a remix of @${artwork.author}'s original piece. Upgraded lighting effects, enhanced textures, and polished layer organization.`);
    setForkTags(artwork.tags.join(', '));
    setForkPsdFile(null);
    setForkImgFile(null);
    setForkImgPreview(null);
    setForkCertified(true);
  }, [artwork.id]);

  // References and drag states
  const forkPsdInputRef = useRef<HTMLInputElement>(null);
  const forkImgInputRef = useRef<HTMLInputElement>(null);
  const [psdDragActive, setPsdDragActive] = useState(false);
  const [imgDragActive, setImgDragActive] = useState(false);

  // Parallax tilt effect on the high-res preview
  const [tiltStyle, setTiltStyle] = useState<React.CSSProperties>({});
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Percentage from center (-0.5 to 0.5)
    const xPercent = (x / rect.width - 0.5) * 4;
    const yPercent = (y / rect.height - 0.5) * 4;
    
    setTiltStyle({
      transform: `scale(1.04) translate(${xPercent}px, ${yPercent}px)`,
    });
  };

  const handleMouseLeave = () => {
    setTiltStyle({});
  };

  // Find remixes of this artwork (e.g. if current artwork is 'neon-echoes')
  const remixes = artworks.filter((art) => art.parentArtworkId === artwork.id);

  // Fallback to general remixes if this artwork has none
  const displayedRemixes = remixes.length > 0 
    ? remixes 
    : artworks.filter((art) => art.type === 'Remix' && art.id !== artwork.id).slice(0, 4);

  // Resolve Lineage Tree (Original at the top, down to current and other remixes)
  let rootOriginal = artwork;
  let safetyCounter = 0;
  while (rootOriginal.type === 'Remix' && rootOriginal.parentArtworkId && safetyCounter < 100) {
    const parent = artworks.find(a => a.id === rootOriginal.parentArtworkId);
    if (parent) {
      rootOriginal = parent;
    } else {
      break;
    }
    safetyCounter++;
  }

  // Tree definitions
  interface TreeNode {
    artwork: Artwork;
    children: TreeNode[];
  }

  const buildTree = (rootArt: Artwork): TreeNode => {
    const childrenArts = artworks.filter(a => a.parentArtworkId === rootArt.id);
    const childrenNodes = childrenArts.map(child => buildTree(child));
    return {
      artwork: rootArt,
      children: childrenNodes
    };
  };

  const rootTreeNode = buildTree(rootOriginal);

  const countTreeNodes = (node: TreeNode): number => {
    return 1 + node.children.reduce((acc, child) => acc + countTreeNodes(child), 0);
  };

  const totalVersions = countTreeNodes(rootTreeNode);

  // PSD drag-drop
  const handleForkPsdDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setPsdDragActive(true);
    } else if (e.type === 'dragleave') {
      setPsdDragActive(false);
    }
  };

  const handleForkPsdDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPsdDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setForkPsdFile(e.dataTransfer.files[0]);
    }
  };

  // Image drag-drop
  const handleForkImgDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setImgDragActive(true);
    } else if (e.type === 'dragleave') {
      setImgDragActive(false);
    }
  };

  const handleForkImgDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setImgDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setForkImgFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setForkImgPreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePsdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setForkPsdFile(e.target.files[0]);
    }
  };

  const handleImgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setForkImgFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setForkImgPreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePublishForkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForkError(null);
    if (!forkTitle.trim()) {
      alert('Please enter a title for your fork/remix!');
      return;
    }
    if (!forkPsdFile) {
      alert('Please upload an updated PSD file.');
      return;
    }
    if (!forkImgFile) {
      alert('Please upload/drop a rendering preview image (PNG/JPG).');
      return;
    }
    if (!forkCertified) {
      alert('Please accept the certification policy.');
      return;
    }

    if (onPublishFork) {
      setForkSubmitting(true);
      let resolution = 'Unknown dimensions';
      const psdInfo = await parsePsdHeader(forkPsdFile);
      if (psdInfo) {
        resolution = formatPsdResolution(psdInfo);
      } else {
        const imgDims = await getImageDimensions(forkImgFile);
        if (imgDims) resolution = formatImageResolution(imgDims);
      }
      const { error } = await onPublishFork(artwork.id, {
        title: forkTitle,
        description: forkDescription,
        tags: forkTags.split(',').map(t => t.trim()).filter(Boolean),
        previewFile: forkImgFile,
        sourceFile: forkPsdFile,
        resolution,
      });
      setForkSubmitting(false);
      if (error) {
        setForkError(error);
        return;
      }
      setViewMode('showcase');
    } else {
      alert('Publish callback not found!');
    }
  };

  const handleForkClick = () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    setViewMode('fork');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const downloadTarget = getDownloadTarget(artwork);
  const isOwnArtwork = !!user && user.id === artwork.ownerId;

  const triggerFileDownload = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadClick = () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    setDownloadError(null);

    if (!isOwnArtwork && (profile?.credits ?? 0) < 1) {
      setDownloadError("You're out of download credits. Publish an original piece or a remix to earn more.");
      return;
    }

    // Trigger the download immediately, synchronously, within this click —
    // browsers silently ignore programmatic downloads once you `await`
    // something first, since the "real user click" window has closed by then.
    triggerFileDownload(downloadTarget.url, downloadTarget.filename);
    if (!artwork.isDemo) {
      incrementDownloads(artwork.id, Number(artwork.downloads) || 0);
    }

    if (!isOwnArtwork) {
      setDownloading(true);
      spendDownloadCredit(user.id).then(({ error }) => {
        setDownloading(false);
        if (error) {
          setDownloadError(error);
          return;
        }
        refreshProfile();
      });
    }
  };

  const renderTimeline = (compact: boolean = false) => {
    const renderTreeNode = (node: TreeNode, depth: number = 0): React.ReactNode => {
      const item = node.artwork;
      const isCurrent = item.id === artwork.id;
      const isOriginal = item.type === 'Original';
      const hasChildren = node.children.length > 0;

      return (
        <div key={item.id} className="relative flex flex-col">
          {/* Node row */}
          <div className="flex items-start gap-4 md:gap-6 group relative">
            
            {/* Connector Dot/Icon */}
            <div className="shrink-0 flex items-center justify-center relative select-none">
              {depth > 0 && (
                <div className="absolute -left-6 md:-left-8 top-8 w-6 md:w-8 h-[2px] border-t-2 border-dashed border-blue-200" />
              )}

              <div 
                onClick={() => {
                  if (!isCurrent) {
                    onSelectArtwork(item.id);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }}
                className={`w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl flex flex-col items-center justify-center border-2 transition-all cursor-pointer ${
                  isCurrent 
                    ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/10 scale-105' 
                    : 'bg-white border-slate-200 text-slate-400 hover:border-blue-500 hover:text-blue-600'
                }`}
              >
                <span className="text-[7px] md:text-[8px] font-black uppercase tracking-wider leading-none mb-1">
                  {isOriginal ? 'Root' : `v${depth}`}
                </span>
                {isOriginal ? (
                  <Layers className="w-4 h-4 md:w-5 md:h-5" />
                ) : (
                  <GitFork className="w-4 h-4 md:w-5 md:h-5 rotate-180" />
                )}
              </div>
            </div>

            {/* Premium Bento Card */}
            <div 
              onClick={() => {
                if (!isCurrent) {
                  onSelectArtwork(item.id);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
              className={`flex-grow flex-1 bg-white border rounded-lg p-3 md:p-4 shadow-3xs flex flex-col sm:flex-row items-center gap-4 cursor-pointer hover:shadow-sm transition-all ${
                isCurrent 
                  ? 'border-blue-500 ring-1 ring-blue-500/10 bg-blue-50/5' 
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Thumbnail */}
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-xl overflow-hidden bg-slate-50 border border-slate-100 shrink-0 shadow-3xs">
                <img 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  src={item.image} 
                  alt={item.title} 
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Text details */}
              <div className="flex-grow flex-1 min-w-0 text-center sm:text-left">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 mb-1">
                  <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-lg border ${
                    isCurrent
                      ? 'bg-blue-100 text-blue-600 border-blue-200'
                      : 'bg-slate-50 text-slate-500 border-slate-200'
                  }`}>
                    {isOriginal ? 'Original' : 'Remix'}
                  </span>
                  {isCurrent && (
                    <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-lg flex items-center gap-0.5">
                      <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                      Viewing
                    </span>
                  )}
                  {item.parentArtworkId && (
                    <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wide">
                      Remix of @{item.parentAuthor || 'creator'}
                    </span>
                  )}
                </div>

                <h3 className={`text-sm md:text-base font-black tracking-tight ${isCurrent ? 'text-blue-600' : 'text-slate-800'} truncate`}>
                  {item.title}
                </h3>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                  by @{item.author} • {item.timeAgo}
                </p>
                <p className="text-[11px] text-slate-500 font-semibold leading-relaxed mt-1.5 line-clamp-2 sm:line-clamp-1">
                  {item.description}
                </p>

                {/* Tags */}
                <div className="flex flex-wrap gap-1 mt-2 justify-center sm:justify-start">
                  {item.tags.slice(0, 2).map(t => (
                    <span key={t} className="text-[8px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                      #{t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action column */}
              <div className="shrink-0 flex items-center justify-center w-full sm:w-auto">
                {isCurrent ? (
                  <div className="text-[9px] font-black text-blue-600 uppercase tracking-widest py-1.5 px-3.5 bg-blue-100/50 rounded-lg border border-blue-200 flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    Active
                  </div>
                ) : (
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-600 hover:text-blue-600 border border-slate-200 hover:border-blue-500 py-1.5 px-4 rounded-lg bg-white transition-all shadow-3xs flex items-center gap-1">
                    Explore
                    <ArrowRight className="w-2.5 h-2.5" />
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Render direct children nested */}
          {hasChildren && (
            <div className="relative flex flex-col pl-6 md:pl-8 ml-6 md:ml-8 border-l-2 border-dashed border-blue-200/60 py-3 space-y-4">
              {node.children.map(childNode => renderTreeNode(childNode, depth + 1))}
            </div>
          )}
        </div>
      );
    };

    return (
      <div className={`relative ${compact ? 'mt-4' : 'mt-8'} overflow-x-auto pb-4`}>
        <div className="min-w-[300px] space-y-6">
          {renderTreeNode(rootTreeNode, 0)}
        </div>
      </div>
    );
  };


  return (
    <div className="w-full min-h-screen text-slate-900 pt-24 pb-20 px-6 md:px-12 max-w-7xl mx-auto">
      {/* Dynamically adapting Back button / breadcrumb */}
      {viewMode === 'showcase' ? (
        <button 
          onClick={() => onSelectArtwork('')} // Go back to where we were
          className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors mb-6 text-xs font-bold uppercase tracking-widest cursor-pointer select-none"
        >
          <ArrowLeft className="w-4 h-4 text-blue-600" />
          Back to Gallery
        </button>
      ) : (
        <button 
          onClick={() => {
            setViewMode('showcase');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 transition-colors mb-6 text-xs font-bold uppercase tracking-widest cursor-pointer select-none"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Project Details
        </button>
      )}

      {/* VIEW MODE 1: SHOWCASE VIEW (Standard detailed info & timeline at bottom) */}
      {viewMode === 'showcase' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Main Art Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-16">
            {/* Left column: Image showcase as a Photoshop-style "canvas window" */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              <div className="bg-white border border-slate-300 rounded-xl overflow-hidden group relative shadow-sm hover:shadow-md transition-all">
                {/* Document tab bar, Photoshop-style */}
                <div className="flex items-center gap-2 bg-[#3f3f46] px-4 py-2 border-b border-zinc-600">
                  <button
                    onClick={() => onSelectArtwork('')}
                    title="Back to Explore"
                    className="text-zinc-400 hover:text-white transition-colors cursor-pointer shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs font-bold text-white truncate">
                    {artwork.sourceFileName || `${artwork.title}.psd`}
                  </span>
                  <span className="text-xs text-zinc-400 font-semibold shrink-0 ps-stat">
                    @ 100% {artwork.type === 'Remix' ? '(Remix, RGB/8)' : '(RGB/8)'}
                  </span>
                </div>

                {/* Ruler corner + horizontal ruler */}
                <div className="flex">
                  <div className="w-[22px] h-[22px] shrink-0 bg-[#27272a] border-r border-b border-zinc-600" />
                  <RulerH />
                </div>
                <div className="flex">
                  {/* Vertical ruler */}
                  <RulerV />

                  <div
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                    className="flex-1 aspect-[16/10] overflow-hidden bg-white p-1.5 cursor-crosshair relative"
                  >
                    <div className="w-full h-full rounded-md overflow-hidden relative ps-marching-ants">
                      <img
                        style={tiltStyle}
                        className="w-full h-full object-cover transition-transform duration-500 ease-out"
                        src={artwork.image}
                        alt={artwork.title}
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    {/* Resolution indicator banner */}
                    <div className="absolute inset-x-1.5 bottom-1.5 bg-gradient-to-t from-slate-950/80 to-transparent p-6 opacity-0 group-hover:opacity-100 transition-opacity flex items-end rounded-b-md">
                      <span className="text-[10px] font-bold tracking-widest uppercase text-white/95 bg-slate-950/40 px-3.5 py-2 rounded-lg border border-white/10 backdrop-blur-md ps-stat">
                        {artwork.resolution || 'Unknown dimensions'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Persistent status bar — always visible, Photoshop-doc-window style */}
                <div className="ps-statusbar">
                  <span className="flex items-center gap-1.5">
                    <ZoomIn className="w-3 h-3" />
                    100%
                  </span>
                  <span>{artwork.resolution || 'Unknown dimensions'}</span>
                  <span>{artwork.type === 'Original' ? 'Original' : 'Remix'} · RGB/8</span>
                </div>
              </div>
            </div>
     
            {/* Right column: Segmented Bento Cards */}
            <div className="lg:col-span-4 flex flex-col gap-6 lg:sticky lg:top-24">
              
              {/* Card 1: Core details, Author, Tags & Description */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="bg-blue-50 text-blue-600 font-bold text-[9px] uppercase tracking-wider px-2.5 py-0.5 rounded-lg border border-blue-100">
                        {artwork.type === 'Original' ? 'Original Work' : 'Remixed Design'}
                      </span>
                      <span className="text-slate-400 text-[10px] font-bold">{artwork.timeAgo}</span>
                    </div>
                    {user && user.id === artwork.ownerId && !artwork.isDemo && (
                      <button
                        onClick={() => setEditModalOpen(true)}
                        title="Edit Details"
                        className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-blue-600 border border-slate-200 hover:border-blue-300 px-2.5 py-1 rounded-lg transition-colors cursor-pointer shrink-0"
                      >
                        <Pencil className="w-3 h-3" />
                        Edit
                      </button>
                    )}
                  </div>
                  <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 leading-tight">
                    {artwork.title}
                  </h1>
     
                  {/* Author Profile section */}
                  <div className="flex items-center gap-3 py-1 select-none">
                    <div 
                      onClick={() => {
                        if (artwork.author === 'luna_creative') {
                          onNavigateToProfile();
                        }
                      }}
                      className={`w-9 h-9 rounded-full overflow-hidden border border-slate-200 ${
                        artwork.author === 'luna_creative' ? 'cursor-pointer hover:border-blue-600' : ''
                      }`}
                    >
                      <img
                        className="w-full h-full object-cover"
                        src={artwork.authorAvatar}
                        alt={artwork.author}
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="flex flex-col">
                      <span 
                        onClick={() => {
                          if (artwork.author === 'luna_creative') {
                            onNavigateToProfile();
                          }
                        }}
                        className={`font-bold text-sm text-blue-600 ${
                          artwork.author === 'luna_creative' ? 'cursor-pointer hover:underline' : ''
                        }`}
                      >
                        @{artwork.author}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Creator</span>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-slate-100" />

                <p className="text-xs md:text-sm text-slate-600 leading-relaxed font-semibold">
                  {artwork.description}
                </p>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {artwork.tags.map((tag) => (
                    <span 
                      key={tag}
                      className="px-3 py-1 bg-slate-100 border border-slate-200/60 text-slate-500 rounded-lg text-[10px] font-bold tracking-wider uppercase"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
     
              {/* Card 2: Core Action Buttons */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="ps-panel-header rounded-t-lg">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-500">Downloads & Lineage</h2>
                </div>
                <div className="p-6 flex flex-col gap-3">
                <button
                  onClick={handleDownloadClick}
                  disabled={downloading}
                  className="w-full bg-blue-600 text-white py-3.5 rounded-lg font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-700 active:scale-[0.98] transition-all shadow-sm disabled:opacity-60 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  {downloading
                    ? 'Downloading…'
                    : artwork.sourceFilePath
                    ? 'Download PSD'
                    : 'Download Image'}
                </button>
                <p className="text-[11px] font-semibold text-slate-400 text-center -mt-1.5">
                  {isOwnArtwork ? 'Free — this is your upload' : 'Costs 1 download credit'}
                </p>
                {downloadError && (
                  <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">
                    {downloadError}
                  </p>
                )}

                {/* Fork is a primary feature of the site, so it gets equal visual weight to Download */}
                <button
                  onClick={handleForkClick}
                  className="w-full border-2 border-blue-600 bg-white text-blue-600 py-3.5 rounded-lg font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-50 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <GitFork className="w-4 h-4" />
                  Fork Design
                </button>

                <button
                  onClick={() => {
                    setViewMode('tree');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="w-full border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 py-2.5 rounded-lg font-bold text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <History className="w-3.5 h-3.5 text-blue-600" />
                  View Timeline Tree
                </button>
                </div>
              </div>

              {/* Card 3: Core Stats counters */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="ps-panel-header rounded-t-lg">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-500">Engagement Stats</h2>
                </div>
                <div className="grid grid-cols-2 gap-4 text-center select-none ps-stat p-6">
                  <div className="flex flex-col p-4 bg-slate-50 border border-slate-100 rounded-lg">
                    <span className="text-slate-900 text-xl font-black">{artwork.forks}</span>
                    <span className="text-slate-400 text-[9px] font-bold uppercase tracking-widest mt-0.5">Forks</span>
                  </div>
                  <div className="flex flex-col p-4 bg-slate-50 border border-slate-100 rounded-lg">
                    <span className="text-slate-900 text-xl font-black">{artwork.views}</span>
                    <span className="text-slate-400 text-[9px] font-bold uppercase tracking-widest mt-0.5">Views</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
     
          {/* Timeline of Changes Section (This view is directly on the main page of each project) */}
          <section className="border-t border-slate-200 pt-12">
            <div className="bg-white border border-slate-200 rounded-xl p-6 md:p-10 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                <div className="flex flex-col gap-2">
                  <span className="text-blue-600 text-[10px] font-bold tracking-widest uppercase">Ecosystem Timeline</span>
                  <h2 className="text-xl md:text-2xl font-black tracking-tight text-slate-900">
                    {artwork.type === 'Original' ? (
                      <>Development Tree of original artwork by <span className="text-blue-600">@{artwork.author}</span></>
                    ) : (
                      <>Lineage Tree from Original by <span className="text-blue-600">@{rootOriginal.author}</span></>
                    )}
                  </h2>
                  <p className="text-xs text-slate-400 font-semibold max-w-2xl">
                    Visual tree tracking every remix, branch, and change. The root original is always at the top of the history list.
                  </p>
                </div>
                <button 
                  onClick={() => {
                    setViewMode('tree');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="text-blue-600 hover:text-blue-700 flex items-center gap-1.5 transition-colors text-xs font-bold uppercase tracking-widest cursor-pointer select-none shrink-0"
                >
                  Expand Tree View
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
       
              {/* Chronological connected timeline component */}
              {renderTimeline(true)}
            </div>
          </section>
        </motion.div>
      )}

      {/* VIEW MODE 2: FULL-PAGE ECOSYSTEM TREE (Dedicated timeline view of changes) */}
      {viewMode === 'tree' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="space-y-8"
        >
          <header className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
            <span className="text-blue-600 text-xs font-black uppercase tracking-widest mb-1.5 block">
              Artwork Heritage
            </span>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 mb-2">
              Ecosystem Development Tree
            </h1>
            <p className="text-sm text-slate-500 font-semibold max-w-3xl leading-relaxed">
              Below is the comprehensive visual lineage tree of <strong className="text-slate-800">"{artwork.title}"</strong>.
              All remixes branch downward sequentially starting with the original masterwork at the absolute top of the timeline.
            </p>
          </header>

          <div className="bg-white border border-slate-200 rounded-xl p-6 md:p-10 shadow-sm relative overflow-hidden">
            {/* Background design accents */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(rgba(15,23,42,0.15)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.15)_1px,transparent_1px)] bg-[size:24px_24px]" />
            
            {/* Header for timeline root */}
            <div className="flex items-center gap-3 mb-8 border-b border-slate-100 pb-4">
              <History className="w-5 h-5 text-blue-600" />
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                Lineage Timeline Start
              </span>
            </div>

            {renderTimeline(false)}

            <div className="mt-12 pt-6 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider">
              <span>{totalVersions} active version(s) in development tree</span>
              <span>LayerRemix GitEngine v1.2</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* VIEW MODE 3: FORK DESIGN FORM PAGE */}
      {viewMode === 'fork' && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-8"
        >
          <header className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
            <span className="text-blue-600 text-xs font-black uppercase tracking-widest mb-1.5 block">
              Remix Engine
            </span>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 mb-2">
              Fork & Remix Masterpiece
            </h1>
            <p className="text-sm text-slate-500 font-semibold max-w-3xl leading-relaxed">
              Forking duplicate-branches the current layers so you can download the PSD, apply your adjustments, and publish your upgraded version directly to this project's ecosystem.
            </p>
          </header>

          <form onSubmit={handlePublishForkSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Reference & File Uploader */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Parent Artwork reference info */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 border border-slate-100 bg-slate-50">
                  <img src={artwork.image} className="w-full h-full object-cover" alt="Parent project" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">
                    Remixing Parent
                  </span>
                  <h3 className="font-black text-slate-800 tracking-tight text-sm leading-snug">
                    {artwork.title}
                  </h3>
                  <p className="text-xs text-slate-400 font-semibold">
                    Original by @{artwork.author}
                  </p>
                </div>
              </div>

              {/* Source PSD upload box */}
              <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                <div
                  onClick={() => forkPsdInputRef.current?.click()}
                  onDragEnter={handleForkPsdDrag}
                  onDragOver={handleForkPsdDrag}
                  onDragLeave={handleForkPsdDrag}
                  onDrop={handleForkPsdDrop}
                  className={`border-2 border-dashed rounded-lg p-12 transition-all cursor-pointer flex flex-col items-center justify-center text-center group ${
                    psdDragActive 
                      ? 'border-blue-500 bg-blue-50/30' 
                      : 'border-slate-200 hover:border-blue-500 hover:bg-blue-50/20'
                  }`}
                >
                  <input
                    ref={forkPsdInputRef}
                    className="hidden"
                    type="file"
                    accept=".psd"
                    onChange={handlePsdChange}
                  />
                  <FileUp className="w-10 h-10 text-slate-400 group-hover:text-blue-600 transition-colors mb-4" />
                  <h3 className="font-bold text-sm text-slate-800 mb-1">Upload New PSD File (.psd)</h3>
                  <p className="text-xs text-slate-400 max-w-xs leading-relaxed font-semibold">
                    {forkPsdFile 
                      ? `Selected: ${forkPsdFile.name} (${(forkPsdFile.size / (1024 * 1024)).toFixed(1)} MB)`
                      : 'Drag & drop your updated design layers file or click to browse. Max size 2GB.'
                    }
                  </p>
                </div>
              </div>

              {/* Preview image upload box */}
              <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                <div
                  onClick={() => forkImgInputRef.current?.click()}
                  onDragEnter={handleForkImgDrag}
                  onDragOver={handleForkImgDrag}
                  onDragLeave={handleForkImgDrag}
                  onDrop={handleForkImgDrop}
                  className={`border-2 border-dashed rounded-lg p-12 h-80 transition-all cursor-pointer flex flex-col items-center justify-center text-center group relative overflow-hidden ${
                    imgDragActive 
                      ? 'border-blue-500 bg-blue-50/30' 
                      : 'border-slate-200 hover:border-blue-500 hover:bg-blue-50/20'
                  }`}
                >
                  <input
                    ref={forkImgInputRef}
                    className="hidden"
                    type="file"
                    accept="image/*"
                    onChange={handleImgChange}
                  />
                  
                  {forkImgPreview ? (
                    <>
                      <img 
                        className="absolute inset-0 w-full h-full object-cover rounded-lg z-0" 
                        src={forkImgPreview} 
                        alt="Fork Preview Render"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center opacity-0 hover:opacity-100 transition-opacity z-10 p-4 rounded-lg">
                        <ImageIcon className="w-8 h-8 text-blue-400 mb-2" />
                        <span className="text-xs font-bold text-white uppercase tracking-wider">Change Preview Image</span>
                      </div>
                    </>
                  ) : (
                    <div className="relative z-10 flex flex-col items-center">
                      <ImageIcon className="w-10 h-10 text-slate-400 group-hover:text-blue-600 transition-colors mb-4" />
                      <h3 className="font-bold text-sm text-slate-800 mb-1">Fork Preview Image (PNG/JPG)</h3>
                      <p className="text-xs text-slate-400 max-w-xs leading-relaxed font-semibold">
                        This image displays your remix changes in the timeline. Upload high-res rendering.
                      </p>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Right Column: Metadata form */}
            <div className="lg:col-span-5">
              <div className="bg-white border border-slate-200 p-8 rounded-xl space-y-6 lg:sticky lg:top-24 shadow-sm">
                
                {/* Title */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                    Remix Title
                  </label>
                  <input
                    value={forkTitle}
                    onChange={(e) => setForkTitle(e.target.value)}
                    className="w-full bg-transparent border-b border-slate-200 focus:border-blue-600 focus:outline-none transition-colors text-sm text-slate-800 py-3 px-0 font-semibold placeholder-slate-400"
                    placeholder="Enter a title for your remix work"
                    type="text"
                  />
                </div>

                {/* Changes Description */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                    What Changes Have You Made?
                  </label>
                  <textarea
                    value={forkDescription}
                    onChange={(e) => setForkDescription(e.target.value)}
                    className="w-full bg-transparent border-b border-slate-200 focus:border-blue-600 focus:outline-none transition-colors text-sm text-slate-800 py-3 px-0 resize-none font-semibold placeholder-slate-400 min-h-[100px]"
                    placeholder="Describe your design modifications, color alterations, layer overrides, or rendering upgrades..."
                    rows={4}
                  />
                </div>

                {/* Tags */}
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                    Ecosystem Tags
                  </label>
                  <input
                    value={forkTags}
                    onChange={(e) => setForkTags(e.target.value)}
                    className="w-full bg-transparent border-b border-slate-200 focus:border-blue-600 focus:outline-none transition-colors text-sm text-slate-800 py-3 px-0 font-semibold placeholder-slate-400"
                    placeholder="Comma separated tags (e.g., Retro, Dark, Gold-Remix)"
                    type="text"
                  />
                </div>

                {/* Certification */}
                <div className="pt-4 flex items-start gap-3 border-t border-slate-100">
                  <input
                    id="fork-certified"
                    checked={forkCertified}
                    onChange={(e) => setForkCertified(e.target.checked)}
                    className="mt-1 rounded bg-slate-100 border-slate-200 text-blue-600 focus:ring-0 cursor-pointer h-4 w-4"
                    type="checkbox"
                  />
                  <label 
                    htmlFor="fork-certified"
                    className="text-xs text-slate-500 leading-relaxed cursor-pointer select-none font-semibold"
                  >
                    I certify that these layered modifications are my work, and other designers may download, review, and fork this version.
                  </label>
                </div>

                {forkError && (
                  <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5">
                    {forkError}
                  </p>
                )}

                {/* Publish button */}
                <button 
                  type="submit"
                  disabled={forkSubmitting}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 active:scale-[0.98] py-4 rounded-lg text-white font-bold text-sm tracking-widest uppercase transition-all shadow-sm hover:shadow-md cursor-pointer flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4 fill-white/10" />
                  {forkSubmitting ? 'Publishing…' : 'Publish Remix'}
                </button>
              </div>
            </div>
          </form>
        </motion.div>
      )}

      {onUpdateArtwork && (
        <>
          <p className="fixed bottom-2 left-2 z-[200] bg-black text-white text-[10px] font-bold px-2 py-1 rounded">
            debug: onDeleteArtwork is {typeof onDeleteArtwork} ({String(!!onDeleteArtwork)})
          </p>
          <EditArtworkModal
            open={editModalOpen}
            artwork={artwork}
            onClose={() => setEditModalOpen(false)}
            onSave={onUpdateArtwork}
            onDelete={onDeleteArtwork}
          />
        </>
      )}
    </div>
  );
};

