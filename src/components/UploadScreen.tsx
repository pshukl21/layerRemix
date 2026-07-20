import React, { useState, useRef } from 'react';
import { Upload, FileUp, Image as ImageIcon, Sparkles, Check } from 'lucide-react';

interface UploadScreenProps {
  onPublish: (newArtwork: {
    title: string;
    description: string;
    tags: string[];
    previewFile: File;
    sourceFile: File | null;
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

  // Preview Image state — keep the File object (for upload) alongside a data
  // URL (for the on-screen preview) since the two are needed for different things.
  const [previewImageFile, setPreviewImageFile] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [imgDragActive, setImgDragActive] = useState(false);
  const imgInputRef = useRef<HTMLInputElement>(null);

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
      if (file.name.endsWith('.psd') || file.name.includes('psd')) {
        setPsdFile(file);
      } else {
        alert('Please drop a valid Photoshop .psd file.');
      }
    }
  };

  const handlePsdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPsdFile(e.target.files[0]);
    }
  };

  // Drag-and-drop handlers for Preview Image
  const handleImgDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setImgDragActive(true);
    } else if (e.type === 'dragleave') {
      setImgDragActive(false);
    }
  };

  const handleImgDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setImgDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        setPreviewImageFile(file);
        const reader = new FileReader();
        reader.onload = () => {
          setPreviewImage(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        alert('Please upload a valid image file (PNG/JPG).');
      }
    }
  };

  const handleImgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPreviewImageFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!title) {
      alert('Please enter an artwork title.');
      return;
    }
    if (!previewImageFile) {
      alert('Please provide a preview image.');
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

    setSubmitting(true);
    const { error } = await onPublish({
      title,
      description: description || 'No description provided.',
      tags: tagsArray.length > 0 ? tagsArray : ['DigitalArt'],
      previewFile: previewImageFile,
      sourceFile: psdFile,
    });
    setSubmitting(false);
    if (error) {
      setSubmitError(error);
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#F2F2F7] text-slate-900 pt-24 pb-20 px-6 md:px-12 max-w-7xl mx-auto">
      <header className="mb-12 mt-4 text-center md:text-left">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 mb-2 font-sans">
          Publish New Work
        </h1>
        <p className="text-sm md:text-base text-slate-500 font-semibold">
          Share your latest masterpiece with the LayerHub community.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: File Drop-Zones */}
        <div className="lg:col-span-7 space-y-6">
          {/* Source PSD upload box */}
          <div className="bg-white border border-slate-200 rounded-[32px] p-3 shadow-sm">
            <div
              onClick={() => psdInputRef.current?.click()}
              onDragEnter={handlePsdDrag}
              onDragOver={handlePsdDrag}
              onDragLeave={handlePsdDrag}
              onDrop={handlePsdDrop}
              className={`border-2 border-dashed rounded-[24px] p-12 transition-all cursor-pointer flex flex-col items-center justify-center text-center group ${
                psdDragActive 
                  ? 'border-blue-500 bg-blue-50/30' 
                  : 'border-slate-200 hover:border-blue-500 hover:bg-blue-50/20'
              }`}
            >
              <input
                ref={psdInputRef}
                accept=".psd"
                className="hidden"
                type="file"
                onChange={handlePsdChange}
              />
              <FileUp className="w-10 h-10 text-slate-400 group-hover:text-blue-600 transition-colors mb-4" />
              <h3 className="font-bold text-sm text-slate-800 mb-1">Source File (.psd)</h3>
              <p className="text-xs text-slate-400 max-w-xs leading-relaxed font-semibold">
                {psdFile 
                  ? `Selected: ${psdFile.name} (${(psdFile.size / (1024 * 1024)).toFixed(1)} MB)`
                  : 'Drag and drop your project files here or click to browse. Max size 2GB.'
                }
              </p>
            </div>
          </div>

          {/* Preview image upload box */}
          <div className="bg-white border border-slate-200 rounded-[32px] p-3 shadow-sm">
            <div
              onClick={() => imgInputRef.current?.click()}
              onDragEnter={handleImgDrag}
              onDragOver={handleImgDrag}
              onDragLeave={handleImgDrag}
              onDrop={handleImgDrop}
              className={`border-2 border-dashed rounded-[24px] p-12 h-80 transition-all cursor-pointer flex flex-col items-center justify-center text-center group relative overflow-hidden ${
                imgDragActive 
                  ? 'border-blue-500 bg-blue-50/30' 
                  : 'border-slate-200 hover:border-blue-500 hover:bg-blue-50/20'
              }`}
            >
              <input
                ref={imgInputRef}
                accept="image/*"
                className="hidden"
                type="file"
                onChange={handleImgChange}
              />

              {previewImage ? (
                <>
                  <img
                    className="absolute inset-0 w-full h-full object-cover z-0"
                    src={previewImage}
                    alt="Preview Render"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center opacity-0 hover:opacity-100 transition-opacity z-10 p-4 rounded-[24px]">
                    <ImageIcon className="w-8 h-8 text-blue-400 mb-2" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Change Preview Image</span>
                  </div>
                </>
              ) : (
                <div className="relative z-10 flex flex-col items-center">
                  <ImageIcon className="w-10 h-10 text-slate-400 group-hover:text-blue-600 transition-colors mb-4" />
                  <h3 className="font-bold text-sm text-slate-800 mb-1">Preview Image (PNG/JPG)</h3>
                  <p className="text-xs text-slate-400 max-w-xs leading-relaxed font-semibold">
                    This image will be displayed in the gallery. High resolution recommended.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Metadata Form */}
        <div className="lg:col-span-5">
          <div className="bg-white border border-slate-200 p-8 rounded-[32px] space-y-6 lg:sticky lg:top-24 shadow-sm">
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

            {/* Description Input */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-transparent border-b border-slate-200 focus:border-blue-600 focus:outline-none transition-colors text-sm text-slate-800 py-3 px-0 resize-none font-semibold placeholder-slate-400 min-h-[100px]"
                placeholder="Describe your creative process, tools used, or inspiration..."
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
                    className="bg-slate-100 border border-slate-200/80 text-slate-600 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-300 px-3 py-1 rounded-full text-[10px] font-bold tracking-wide cursor-pointer transition-all"
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
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 active:scale-[0.98] py-4 rounded-full text-white font-bold text-sm tracking-widest uppercase transition-all shadow-sm hover:shadow-md cursor-pointer flex items-center justify-center gap-2"
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
