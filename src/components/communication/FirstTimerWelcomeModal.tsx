import React, { useState, useEffect } from 'react';
import {
  X,
  MessageCircle,
  Send,
  Copy,
  Check,
  Video,
  ExternalLink,
  Smartphone,
  Sparkles,
  Heart,
  Eye,
  UserCheck
} from 'lucide-react';
import { Visitor } from '../../types/database.types';
import { useToast } from '../../contexts/ToastContext';

interface FirstTimerWelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  visitor: Visitor | null;
  videoLink: string;
  onSendSms: (v: Visitor, customText: string) => void;
  onLaunchWhatsApp: (phone: string, text: string) => void;
  onOpenVideoPreview: () => void;
  smsCredits: number;
}

export const FirstTimerWelcomeModal: React.FC<FirstTimerWelcomeModalProps> = ({
  isOpen,
  onClose,
  visitor,
  videoLink,
  onSendSms,
  onLaunchWhatsApp,
  onOpenVideoPreview,
  smsCredits,
}) => {
  const { success: toastSuccess } = useToast();
  const [customText, setCustomText] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (!visitor) return;
    const firstName = visitor.full_name.split(' ')[0];
    const prayerPart = visitor.prayer_request
      ? ` concerning your prayer request: "${visitor.prayer_request}"`
      : '';
    setCustomText(
      `Shalom ${firstName}! 🕊️✨ Thank you for worshipping with Greater Works City Church (GWCC), Joma this Sunday! Prophet Elisha K. Richard and our entire church family were truly honored by your fellowship.\n\nPlease watch Prophet Elisha's personal welcome message and sanctuary orientation video for you here:\n👉 ${videoLink}\n\nOur pastoral intercessors are praying in faith with you${prayerPart}. You are warmly welcome to our Midweek Miracle Service this Wednesday at 6:30 PM!\n\nPastoral Care Secretariat • Greater Works City Church, Joma New Site, Accra`
    );
  }, [visitor, videoLink]);

  if (!isOpen || !visitor) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(customText);
      setIsCopied(true);
      toastSuccess('Copied to Clipboard', 'Welcome message copied to clipboard!');
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  const charLength = customText.length;
  const smsPages = charLength <= 160 ? 1 : Math.ceil(charLength / 153);
  const phone = visitor.phone || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-emerald-950 via-[#064e3b] to-emerald-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-300">
              <Sparkles className="w-6 h-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  Post-Service First-Timer Welcome Studio
                </h3>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950">
                  2-Hour Window
                </span>
              </div>
              <p className="text-xs text-emerald-200/90 mt-0.5">
                {visitor.full_name} • Attended {visitor.service_attended || 'Sunday Service'}
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

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
          {/* Visitor Card */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-bold text-slate-900 text-xs">{visitor.full_name}</p>
              <p className="text-[11px] font-mono text-slate-500">{phone || 'No phone number'}</p>
              {visitor.prayer_request && (
                <p className="text-[11px] text-amber-800 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200 mt-1.5">
                  <strong>Prayer Request:</strong> "{visitor.prayer_request}"
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenVideoPreview}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
              >
                <Video className="w-3.5 h-3.5 text-emerald-700" />
                <span>Watch Pastor's Video</span>
              </button>
            </div>
          </div>

          {/* Message Textarea */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-bold text-slate-800 text-xs">
                Welcome Message Copy (with Prophet Elisha's Video Link)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-slate-500">
                  {charLength} chars • {smsPages} {smsPages === 1 ? 'page' : 'pages'}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-2 py-0.5 text-xs text-slate-600 hover:text-emerald-800 flex items-center gap-1 hover:underline"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isCopied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>
            <textarea
              rows={8}
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              className="w-full px-3.5 py-3 border border-slate-300 rounded-2xl text-xs font-medium text-slate-800 focus:outline-emerald-600 focus:ring-1 focus:ring-emerald-600 leading-relaxed font-sans"
              placeholder="First-timer welcome message..."
            />
          </div>

          {/* Handset WhatsApp Preview */}
          <div className="p-3.5 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-emerald-700" />
                Live Recipient WhatsApp Preview
              </span>
              <span className="text-emerald-700 font-mono">Greater Works City Church</span>
            </div>
            <p className="text-xs text-slate-800 bg-white p-3 rounded-xl border border-emerald-100 shadow-2xs whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">
              {customText}
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500">
            Gateway Units: <strong className="font-mono text-slate-700">{smsCredits} units</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{isCopied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              type="button"
              disabled={!phone}
              onClick={() => {
                onLaunchWhatsApp(phone, customText);
                onClose();
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Launch WhatsApp Chat</span>
            </button>

            <button
              type="button"
              disabled={!phone || smsCredits < 1}
              onClick={() => {
                onSendSms(visitor, customText);
                onClose();
              }}
              className="px-4 py-2 bg-[#064e3b] hover:bg-[#047857] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send Ghana SMS</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
