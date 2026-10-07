import React, { useState } from 'react';
import {
  X,
  Play,
  Pause,
  Video,
  ExternalLink,
  Copy,
  Check,
  Church,
  Sparkles,
  Volume2,
  Share2,
  Clock,
  ShieldCheck
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

interface PastorWelcomeVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoLink: string;
  onUpdateVideoLink?: (newLink: string) => void;
}

export const PastorWelcomeVideoModal: React.FC<PastorWelcomeVideoModalProps> = ({
  isOpen,
  onClose,
  videoLink,
  onUpdateVideoLink,
}) => {
  const { success: toastSuccess } = useToast();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [editableLink, setEditableLink] = useState(videoLink);
  const [isEditingLink, setIsEditingLink] = useState(false);

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(editableLink);
      setIsCopied(true);
      toastSuccess('Link Copied', 'Pastor welcome video link copied to clipboard!');
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  const handleSaveLink = () => {
    if (onUpdateVideoLink && editableLink.trim()) {
      onUpdateVideoLink(editableLink.trim());
      setIsEditingLink(false);
      toastSuccess('Video Link Updated', 'Updated welcome video URL for post-service automated follow-ups.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-950 via-[#064e3b] to-emerald-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-emerald-700/60 rounded-xl">
              <Video className="w-5 h-5 text-emerald-200" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-white">
                Prophet Elisha K. Richard's Welcome Video Preview
              </h3>
              <p className="text-[11px] text-emerald-200">
                Official Orientation & Pastoral Touchpoint for First-Time Visitors
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/70 hover:text-white rounded-xl hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Simulation Canvas */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
          <div className="relative bg-slate-950 rounded-2xl aspect-video overflow-hidden shadow-inner flex flex-col justify-between p-4 group">
            {/* Top Bar inside Video Player */}
            <div className="flex items-center justify-between text-white/90 z-10">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                <span className="font-bold text-xs">GWCC Media Sanctuary Stream</span>
              </div>
              <span className="text-[10px] font-mono bg-black/50 px-2 py-0.5 rounded backdrop-blur-xs">
                HD 1080p • 3:45 min
              </span>
            </div>

            {/* Video Center Play Overlay */}
            <div className="flex flex-col items-center justify-center text-center my-auto z-10 space-y-2">
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-16 h-16 rounded-full bg-emerald-600/90 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-105"
              >
                {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 translate-x-0.5" />}
              </button>
              <div className="text-white space-y-0.5">
                <h4 className="font-bold text-sm tracking-wide">
                  Welcome to the City of Refuge!
                </h4>
                <p className="text-[11px] text-emerald-300">
                  A personal message & prayer declaration from Prophet Elisha K. Richard
                </p>
              </div>
            </div>

            {/* Bottom Controls Bar */}
            <div className="bg-black/60 backdrop-blur-xs p-2 rounded-xl flex items-center justify-between text-white text-[11px] z-10">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="hover:text-emerald-400"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-300">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{isPlaying ? '01:14' : '00:00'} / 03:45</span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-slate-300">
                <Volume2 className="w-3.5 h-3.5" />
                <span className="text-[10px]">Greater Works City Church, Joma</span>
              </div>
            </div>

            {/* Video Background Graphic Simulation */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/80 to-slate-950/60 flex items-center justify-center pointer-events-none opacity-40">
              <Church className="w-48 h-48 text-emerald-800/30" />
            </div>
          </div>

          {/* Video Overview & Orientation Content */}
          <div className="space-y-3">
            <div className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-emerald-950 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                  What the Visitor Receives in this Video
                </span>
                <span className="text-[10px] bg-emerald-200/60 text-emerald-900 px-2 py-0.5 rounded-full font-bold">
                  2-Hour Post-Service Follow-up
                </span>
              </div>
              <ul className="text-slate-700 space-y-1.5 list-disc list-inside leading-relaxed text-[11px]">
                <li>
                  <strong>Warm Welcome:</strong> Prophet Elisha welcomes the visitor and blesses their household.
                </li>
                <li>
                  <strong>The GWCC Vision:</strong> Overview of our apostolic mandate to manifest God's greater works in Accra and beyond.
                </li>
                <li>
                  <strong>Sanctuary Life:</strong> Introduction to Voice of Grace Choir, King's Ushers, Media, and Children's Church.
                </li>
                <li>
                  <strong>Cell & Discipleship:</strong> Invitation to local Joma/Ablekuma/Weija cell fellowships and Foundation School classes.
                </li>
                <li>
                  <strong>Personal Prayer of Dedication:</strong> Prophet Elisha leads a prayer for their specific needs, open heavens, and divine breakthrough.
                </li>
              </ul>
            </div>

            {/* Video Link Configuration Card */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-800 text-xs">
                  Active Video Broadcast URL
                </label>
                <div className="flex items-center gap-2">
                  {!isEditingLink ? (
                    <button
                      type="button"
                      onClick={() => setIsEditingLink(true)}
                      className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 hover:underline"
                    >
                      Edit URL
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSaveLink}
                      className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 hover:underline"
                    >
                      Save URL
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="text-[11px] font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 hover:underline"
                  >
                    {isCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{isCopied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {isEditingLink ? (
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={editableLink}
                    onChange={(e) => setEditableLink(e.target.value)}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono"
                    placeholder="https://..."
                  />
                  <button
                    type="button"
                    onClick={handleSaveLink}
                    className="px-3 py-2 bg-[#064e3b] hover:bg-[#047857] text-white text-xs font-bold rounded-xl"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <div className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs font-mono text-emerald-900">
                  <span className="truncate">{editableLink}</span>
                  <a
                    href={editableLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 text-slate-400 hover:text-emerald-700 shrink-0 ml-2"
                    title="Open in new window"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Automatically appended into all 2-hour first-timer follow-up broadcasts.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};
