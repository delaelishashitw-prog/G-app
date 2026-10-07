import React, { useState } from 'react';
import {
  X,
  Sparkles,
  CheckCircle2,
  BookOpen,
  Calendar,
  MessageCircle,
  Share2,
  Heart,
} from 'lucide-react';
import { PrayerRequest, ChurchSettings } from '../../types/database.types';

interface AnsweredPrayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  prayer: PrayerRequest | null;
  onConfirm: (prayerId: string, testimony: string) => void;
  settings: ChurchSettings;
}

export const AnsweredPrayerModal: React.FC<AnsweredPrayerModalProps> = ({
  isOpen,
  onClose,
  prayer,
  onConfirm,
  settings,
}) => {
  if (!isOpen || !prayer) return null;

  const [testimony, setTestimony] = useState(
    prayer.testimony ||
      'The Lord God of Greater Works City Church has answered this petition mightily! To God alone be all the glory and honor.'
  );
  const [scripture, setScripture] = useState('Psalm 118:23 - "This is the Lord\'s doing; it is marvellous in our eyes."');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testimony.trim()) return;
    const fullTestimony = scripture ? `${testimony.trim()} [Scripture: ${scripture.trim()}]` : testimony.trim();
    onConfirm(prayer.id, fullTestimony);
    onClose();
  };

  const shareOnWhatsApp = () => {
    const text = `🙌 *PRAISE REPORT & TESTIMONY - GREATER WORKS CITY CHURCH* 🙌\n\n*Requester:* ${prayer.requester_name}\n*Category:* ${prayer.category}\n*Petition:* "${prayer.request}"\n\n*Answered Prayer Testimony:*\n${testimony}\n\n_${scripture}_\n\n"Exceeding Abundantly Above All We Ask or Think!" (Eph 3:20)`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 bg-linear-to-r from-emerald-800 via-teal-800 to-emerald-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-300/30 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Praise Report & Answered Prayer
              </h2>
              <p className="text-[11px] text-emerald-200">
                Recording God's Mighty Works at GWCC Joma
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Original Prayer Summary Card */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 text-xs">{prayer.requester_name}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                {prayer.category}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 italic">
              &ldquo;{prayer.request}&rdquo;
            </p>
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Testimony / Praise Report Details <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={4}
              value={testimony}
              onChange={(e) => setTestimony(e.target.value)}
              placeholder="Describe how the breakthrough occurred, doctor's medical test report, financial supply, or spiritual victory..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-emerald-500 outline-hidden text-xs leading-relaxed"
              required
            ></textarea>
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1 flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5 text-teal-600" /> Scripture of Thanksgiving / Praise
            </label>
            <input
              type="text"
              value={scripture}
              onChange={(e) => setScripture(e.target.value)}
              placeholder="e.g. Psalm 103:1-2, Revelation 12:11"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-emerald-500 outline-hidden text-xs"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={shareOnWhatsApp}
              className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition flex items-center gap-1.5 border border-emerald-200 cursor-pointer"
              title="Share testimony text on WhatsApp"
            >
              <MessageCircle className="w-4 h-4 text-emerald-600" />
              <span>Share Praise Report</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Mark Answered</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
