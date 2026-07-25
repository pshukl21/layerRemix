import React, { useState, useRef } from 'react';
import { Upload, FileUp, Image as ImageIcon, Sparkles, Check, Loader2, AlertTriangle } from 'lucide-react';
import { parsePsdHeader, formatPsdResolution, extractPsdThumbnail } from '../lib/psd';

interface UploadScreenProps {
  onPublish: (newArtwork: {
    title: string;
    description: string;
    tags: string[];
    previewFile: File;
    sourceFile: File | null;
    resolution: string;
  }) => Promise<{ error: string | null }>;
}

export const UploadScreen: React.FC<UploadScreenProps> = ({ onPublish }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [certified, setCertified] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Source PSD file state
  const [psdFile, setPsdFile] = useState<File | null>(null);
  const [psdDragActive, setPsdDragActive] = useState(false);
  const psdInputRef = useRef<HTMLInputElement>(null);

  // The preview is never uploaded manually — it's extracted straight from the
  // PSD's own embedded thumbnail (the same one Finder/Explorer show), so the
  // gallery image can never be misleading or mismatched from the real file.
  const [extractedThumbnail, setExtractedThumbnail] = useState<File | null>(null);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  // Selected tags preset
  const tagPresets = ['Illustration', 'Abstract', 'DigitalArt', 'Layered', 'Cyberpunk', '3D'];

  const handlePresetTagClick = (tag: string) => {
    const currentTags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t !== '');
    if (!currentTags.includes(tag)) {
      currentTags.push(tag);
      setTagsInput(currentTags.join(', '));
    }
  };

  const processPsdFile = async (file: File) => {
    setPsdFile(file);
    setExtractedThumbnail(null);
    setThumbnailPreviewUrl(null);
    setExtractionError(null);
    setExtracting(true);

    const thumbnail = await extractPsdThumbnail(file);
    setExtracting(false);

    if (!thumbnail) {
      setExtractionError(
        "We couldn't find an embedded preview inside this PSD. In Photoshop, go to Preferences → File Handling and set \"Maximize PSD and PSB File Compatibility\" to Always (or Ask), then re-save the file and upload it again."
      );
      return;
    }

    setExtractedThumbnail(thumbnail);
    const reader = new FileReader();
    reader.onload = () => setThumbnailPreviewUrl(reader.result as string);
    reader.readAsDataURL(thumbnail);
  };

  // Drag-and-drop handlers for PSD file
  const handlePsdDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setPsdDragActive(true);
    } else if (e.type === 'dragleave') {
      setPsdDragActive(false);
    }
  };

  const handlePsdDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPsdDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.toLowerCase().endsWith('.psd') || file.name.toLowerCase().endsWith('.psb')) {
        processPsdFile(file);
      } else {
        alert('Please drop a valid Photoshop .psd (or .psb) file.');
      }
    }
  };

  const handlePsdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processPsdFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!title) {
      alert('Please enter an artwork title.');
      return;
    }
    if (!psdFile) {
      alert('Please upload your .psd file.');
      return;
    }
    if (!extractedThumbnail) {
      alert("We need a valid preview extracted from your PSD before publishing — see the message under the upload box.");
      return;
    }
    if (!certified) {
      alert('You must certify that you own the rights to upload this artwork.');
      return;
    }

    const tagsArray = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t !== '');

    // Real dimensions come straight from the PSD's own header.
    let resolution = 'Unknown dimensions';
    const psdInfo = await parsePsdHeader(psdFile);
    if (psdInfo) {
      resolution = formatPsdResolution(psdInfo);
    }

    setSubmitting(true);
    const { error } = await onPublish({
      title,
      description: description || 'No notes on what needs work yet.',
      tags: tagsArray.length > 0 ? tagsArray : ['DigitalArt'],
      previewFile: extractedThumbnail,
      sourceFile: psdFile,
      resolution,
    });
    setSubmitting(false);
    if (error) {
      setSubmitError(error);
    }
  };

  return (
    <div className="w-full min-h-screen text-slate-900 pt-24 pb-20 px-6 md:px-12 max-w-7xl mx-auto">
      <header className="mb-12 mt-4 text-center md:text-left">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 mb-2 font-sans">
          Publish New Work
        </h1>
        <p className="text-sm md:text-base text-slate-500 font-semibold">
          Share your latest masterpiece with the LayerRemix community.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: File Drop-Zone + Auto-Generated Preview */}
        <div className="lg:col-span-7 space-y-6">
          {/* Source PSD upload box */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
            <div
              onClick={() => psdInputRef.current?.click()}
              onDragEnter={handlePsdDrag}
              onDragOver={handlePsdDrag}
              onDragLeave={handlePsdDrag}
              onDrop={handlePsdDrop}
              className={`border-2 border-dashed rounded-lg p-12 transition-all cursor-pointer flex flex-col items-center justify-center text-center group ${
                psdDragActive 
                  ? 'border-blue-500 bg-blue-50/30' 
                  : 'border-slate-200 hover:border-blue-500 hover:bg-blue-50/20'
              }`}
            >
              <input
                ref={psdInputRef}
                accept=".psd,.psb"
                className="hidden"
                type="file"
                onChange={handlePsdChange}
              />
              <FileUp className="w-10 h-10 text-slate-400 group-hover:text-blue-600 transition-colors mb-4" />
              <h3 className="font-bold text-sm text-slate-800 mb-1">Source File (.psd)</h3>
              <p className="text-xs text-slate-400 max-w-xs leading-relaxed font-semibold">
                {psdFile 
                  ? `Selected: ${psdFile.name} (${(psdFile.size / (1024 * 1024)).toFixed(1)} MB)`
                  : 'Drag and drop your project file here or click to browse. Max size depends on your plan.'
                }
              </p>
            </div>
          </div>

          {/* Auto-generated preview — read-only, pulled straight from the PSD */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
            <div className="rounded-lg h-80 flex flex-col items-center justify-center text-center relative overflow-hidden bg-slate-50 border border-slate-100">
              {extracting && (
                <div className="flex flex-col items-center gap-3 text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <span className="text-xs font-bold uppercase tracking-widest">Rendering HD preview from your PSD…</span>
                </div>
              )}

              {!extracting && thumbnailPreviewUrl && (
                <>
                  <img
                    className="absolute inset-0 w-full h-full object-cover z-0"
                    src={thumbnailPreviewUrl}
                    alt="Auto-generated preview from PSD"
                  />
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950/80 to-transparent p-4 flex items-center gap-1.5 z-10">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[10px] font-bold text-white uppercase tracking-widest">
                      Auto-generated from your PSD
                    </span>
                  </div>
                </>
              )}

              {!extracting && !thumbnailPreviewUrl && !extractionError && (
                <div className="flex flex-col items-center gap-2 text-slate-400 px-6">
                  <ImageIcon className="w-10 h-10 mb-2" />
                  <h3 className="font-bold text-sm text-slate-600">Preview appears automatically</h3>
                  <p className="text-xs leading-relaxed font-semibold max-w-xs">
                    Upload a .psd above — we'll pull its embedded thumbnail for you. There's no separate image
                    upload, so the preview always matches the real file.
                  </p>
                </div>
              )}

              {!extracting && extractionError && (
                <div className="flex flex-col items-center gap-2 text-red-600 px-6">
                  <AlertTriangle className="w-8 h-8 mb-1" />
                  <h3 className="font-bold text-sm">No embedded preview found</h3>
                  <p className="text-xs leading-relaxed font-semibold max-w-sm text-red-500">
                    {extractionError}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Metadata Form */}
        <div className="lg:col-span-5">
          <div className="bg-white border border-slate-200 p-8 rounded-xl space-y-6 lg:sticky lg:top-24 shadow-sm">
            {/* Title Input */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                Artwork Title
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-transparent border-b border-slate-200 focus:border-blue-600 focus:outline-none transition-colors text-sm text-slate-800 py-3 px-0 font-semibold placeholder-slate-400"
                placeholder="Enter a name for your piece"
                type="text"
              />
            </div>

            {/* "What needs work" Input — replaces the old generic Description */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                What needs work or could be remixed?
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-transparent border-b border-slate-200 focus:border-blue-600 focus:outline-none transition-colors text-sm text-slate-800 py-3 px-0 resize-none font-semibold placeholder-slate-400 min-h-[100px]"
                placeholder="e.g., Background FX need work, missing text layers, lighting feels off, needs a 3D element..."
                rows={4}
              />
            </div>

            {/* Tags Input */}
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                Tags
              </label>
              <input
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className="w-full bg-transparent border-b border-slate-200 focus:border-blue-600 focus:outline-none transition-colors text-sm text-slate-800 py-3 px-0 font-semibold placeholder-slate-400"
                placeholder="Add tags separated by comma (e.g. Cyberpunk, 3D)"
                type="text"
              />
              <div className="flex flex-wrap gap-1.5 pt-2 select-none">
                {tagPresets.map((tag) => (
                  <span
                    key={tag}
                    onClick={() => handlePresetTagClick(tag)}
                    className="bg-slate-100 border border-slate-200/80 text-slate-600 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-300 px-3 py-1 rounded-lg text-[10px] font-bold tracking-wide cursor-pointer transition-all"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Certification policy */}
            <div className="pt-4 flex items-start gap-3 border-t border-slate-100">
              <input
                id="policy"
                checked={certified}
                onChange={(e) => setCertified(e.target.checked)}
                className="mt-1 rounded bg-slate-100 border-slate-200 text-blue-600 focus:ring-0 cursor-pointer h-4 w-4"
                type="checkbox"
              />
              <label 
                htmlFor="policy" 
                className="text-xs text-slate-500 leading-relaxed cursor-pointer select-none font-semibold"
              >
                I certify that I am the original creator of this artwork and own all rights to the uploaded files.
              </label>
            </div>

            {submitError && (
              <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5">
                {submitError}
              </p>
            )}

            {/* Action button */}
            <button 
              type="submit"
              disabled={submitting || extracting || !extractedThumbnail}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 active:scale-[0.98] py-4 rounded-lg text-white font-bold text-sm tracking-widest uppercase transition-all shadow-sm hover:shadow-md cursor-pointer flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4 fill-white/10" />
              {submitting ? 'Publishing…' : 'Publish Art'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
