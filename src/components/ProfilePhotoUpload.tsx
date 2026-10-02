import React, { useState, useRef } from 'react';
import { Camera, Upload, Link2, X, Image as ImageIcon, Sparkles, Check } from 'lucide-react';

export interface ProfilePhotoUploadProps {
  value?: string;
  onChange: (url: string) => void;
  memberName?: string;
  className?: string;
}

// Curated high-quality, professional portraits suitable for church congregation members
const AVATAR_PRESETS = [
  {
    name: 'Ghanaian Professional (Male)',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
  },
  {
    name: 'Ghanaian Professional (Female)',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
  },
  {
    name: 'Youth Leader (Male)',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
  },
  {
    name: 'Choir / Deaconess (Female)',
    url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80',
  },
  {
    name: 'Elder / Board Member',
    url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&auto=format&fit=crop&q=80',
  },
];

export const ProfilePhotoUpload: React.FC<ProfilePhotoUploadProps> = ({
  value,
  onChange,
  memberName = 'Member',
  className = '',
}) => {
  const [activeMode, setActiveMode] = useState<'upload' | 'url' | 'presets'>('upload');
  const [urlInput, setUrlInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compress & resize image to max 400x400 for efficient local storage storage
  const processImageFile = (file: File) => {
    setUploadError(null);

    if (!file.type.startsWith('image/')) {
      setUploadError('Please select a valid image file (PNG, JPG, WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image size exceeds 5MB. Please choose a smaller photo.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (!result) return;

      // Create an offscreen image to compress
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          onChange(compressedDataUrl);
        } else {
          onChange(result);
        }
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processImageFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleApplyUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    onChange(urlInput.trim());
    setUrlInput('');
  };

  const handleClearPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="block font-semibold text-slate-700 text-xs">
          Member Profile Photo
        </label>
        {value && (
          <button
            type="button"
            onClick={handleClearPhoto}
            className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1 transition cursor-pointer"
          >
            <X className="w-3 h-3" />
            <span>Remove Photo</span>
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
        {/* Avatar Preview */}
        <div className="relative group shrink-0">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-slate-300 bg-white shadow-xs flex items-center justify-center cursor-pointer transition group-hover:border-emerald-500 relative"
            title="Click to change photo"
          >
            {value ? (
              <img
                src={value}
                alt={memberName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-100 group-hover:bg-emerald-50/50 transition">
                <Camera className="w-6 h-6 text-slate-400 group-hover:text-emerald-700 transition" />
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mt-1">Upload</span>
              </div>
            )}

            {/* Hover overlay indicator */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
              <Camera className="w-5 h-5" />
            </div>
          </div>

          {value && (
            <button
              type="button"
              onClick={handleClearPhoto}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs shadow-xs hover:bg-rose-700 transition cursor-pointer"
              title="Remove"
            >
              ✕
            </button>
          )}
        </div>

        {/* Controls & Methods */}
        <div className="flex-1 w-full space-y-2.5">
          {/* Mode Switcher */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-[11px] w-fit">
            <button
              type="button"
              onClick={() => setActiveMode('upload')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1 ${
                activeMode === 'upload'
                  ? 'bg-[#064e3b] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Upload className="w-3 h-3" />
              <span>Upload File</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMode('url')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1 ${
                activeMode === 'url'
                  ? 'bg-[#064e3b] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Link2 className="w-3 h-3" />
              <span>Photo URL</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMode('presets')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1 ${
                activeMode === 'presets'
                  ? 'bg-[#064e3b] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Presets</span>
            </button>
          </div>

          {/* Mode 1: File Upload / Drag & Drop */}
          {activeMode === 'upload' && (
            <div>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-3 text-center cursor-pointer transition ${
                  isDragging
                    ? 'border-emerald-500 bg-emerald-50/50'
                    : 'border-slate-300 hover:border-emerald-500 bg-white'
                }`}
              >
                <div className="flex items-center justify-center gap-2 text-xs text-slate-600">
                  <Upload className="w-4 h-4 text-emerald-700" />
                  <span>
                    <strong className="text-emerald-900 font-bold">Choose an image</strong> or drag and drop
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">PNG, JPG, WebP up to 5MB (auto-optimized)</p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          )}

          {/* Mode 2: Photo URL */}
          {activeMode === 'url' && (
            <div className="flex gap-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Paste direct image URL (https://...)"
                className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={handleApplyUrl}
                className="px-3 py-1.5 bg-[#064e3b] hover:bg-[#047857] text-white rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Apply
              </button>
            </div>
          )}

          {/* Mode 3: Presets */}
          {activeMode === 'presets' && (
            <div className="flex items-center gap-2 overflow-x-auto py-1">
              {AVATAR_PRESETS.map((preset) => {
                const isSelected = value === preset.url;
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => onChange(preset.url)}
                    className={`relative w-10 h-10 rounded-xl overflow-hidden shrink-0 border-2 transition cursor-pointer group ${
                      isSelected ? 'border-emerald-600 ring-2 ring-emerald-400' : 'border-slate-200 hover:border-slate-400'
                    }`}
                    title={preset.name}
                  >
                    <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                    {isSelected && (
                      <div className="absolute inset-0 bg-emerald-900/40 flex items-center justify-center text-white">
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {uploadError && (
            <p className="text-[11px] text-rose-600 font-semibold">{uploadError}</p>
          )}
        </div>
      </div>
    </div>
  );
};
