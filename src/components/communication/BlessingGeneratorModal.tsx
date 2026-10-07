import React, { useState, useEffect } from 'react';
import {
  X,
  MessageCircle,
  Send,
  Copy,
  Check,
  Sparkles,
  Cake,
  Heart,
  Smartphone,
  BookOpen,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { CelebrantItem } from '../../pages/CommunicationPage';
import { useToast } from '../../contexts/ToastContext';

interface BlessingGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  celebrant: CelebrantItem | null;
  onSendSms: (c: CelebrantItem, customText: string) => void;
  onLaunchWhatsApp: (phone: string, text: string) => void;
  smsCredits: number;
}

export const BlessingGeneratorModal: React.FC<BlessingGeneratorModalProps> = ({
  isOpen,
  onClose,
  celebrant,
  onSendSms,
  onLaunchWhatsApp,
  smsCredits,
}) => {
  const { success: toastSuccess } = useToast();
  const [tone, setTone] = useState<'prophetic' | 'pastoral' | 'concise'>('prophetic');
  const [customText, setCustomText] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (!celebrant) return;
    setCustomText(getBlessingByTone(celebrant, tone));
  }, [celebrant, tone]);

  if (!isOpen || !celebrant) return null;

  function getBlessingByTone(item: CelebrantItem, selectedTone: 'prophetic' | 'pastoral' | 'concise'): string {
    const firstName = item.member.first_name;
    const isBirthday = item.type === 'birthday';
    const spouse = item.member.spouse_name || item.spouseName || 'your beloved spouse';

    if (isBirthday) {
      if (selectedTone === 'prophetic') {
        return `Shalom ${firstName}! 🎉🎂 Prophet Elisha K. Richard, the ministerial council, and the entire Greater Works City Church (GWCC) family joyfully celebrate you on your ${item.yearsCount}th birthday today!\n\nAs Psalm 20:1-4 declares:\n"The Lord hear thee in the day of trouble; the name of the God of Jacob defend thee; Send thee help from the sanctuary, and strengthen thee out of Zion..."\n\nMay this new year usher in supernatural favor, long life, divine health, open heavens, and continuous kingdom elevation for you and your household! Have a glorious birthday celebration!\n\nWith pastoral blessings,\nProphet Elisha K. Richard • Greater Works City Church, Joma, Accra`;
      }
      if (selectedTone === 'pastoral') {
        return `Shalom ${firstName}! ❤️ On this joyous milestone of your ${item.yearsCount}th birthday, Prophet Elisha K. Richard, our pastoral leadership, and the entire GWCC congregation honor and appreciate you. Numbers 6:24-26 declares: "The Lord bless thee, and keep thee: The Lord make his face shine upon thee..." May your walk of faith flourish exceedingly this year! Warmest pastoral love, Greater Works City Church, Joma.`;
      }
      return `Happy ${item.yearsCount}th Birthday ${firstName}! 🎉 GWCC speaks Psalm 20:1-4 blessings over your new age: divine favor, sound health, long life & kingdom elevation. Prophet Elisha K. Richard & GWCC Family.`;
    } else {
      // Anniversary
      if (selectedTone === 'prophetic') {
        return `Shalom ${firstName} & ${spouse}! 💍✨ Prophet Elisha K. Richard and the entire Greater Works City Church (GWCC) family rejoice with you on your ${item.yearsCount}th Wedding Anniversary today!\n\n"Therefore shall a man leave his father and his mother, and shall cleave unto his wife: and they shall be one flesh." — Genesis 2:24\n\nMay the God of peace continually preserve your home, renew your marital joy, guard your family against every trial, and multiply your generational blessings exceedingly abundantly!\n\nProphet Elisha K. Richard & GWCC Ministerial Council • Joma, Accra`;
      }
      if (selectedTone === 'pastoral') {
        return `Shalom ${firstName} & ${spouse}! ❤️ Congratulations on celebrating ${item.yearsCount} beautiful years of holy matrimony. The ministerial board of GWCC thanks God for your godly home. May the peace of Christ rule in your hearts and may your marriage continue to be a shining testimony in Zion! Pastoral blessings, Greater Works City Church, Joma.`;
      }
      return `Happy ${item.yearsCount}th Wedding Anniversary ${firstName} & ${spouse}! 💍✨ GWCC speaks divine peace, marital joy and increasing fruitfulness over your holy union. Prophet Elisha & GWCC Council.`;
    }
  }

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(customText);
      setIsCopied(true);
      toastSuccess('Copied to Clipboard', 'Personalized blessing copied to clipboard!');
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  const handleInsertScripture = (verse: string, scriptureText: string) => {
    setCustomText((prev) => `${prev}\n\n"${scriptureText}" — ${verse}`);
  };

  const charLength = customText.length;
  const smsPages = charLength <= 160 ? 1 : Math.ceil(charLength / 153);
  const phone = celebrant.member.phone || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-emerald-950 via-[#064e3b] to-emerald-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl ${
              celebrant.type === 'birthday' ? 'bg-amber-500/20 text-amber-300' : 'bg-rose-500/20 text-rose-300'
            }`}>
              {celebrant.type === 'birthday' ? (
                <Cake className="w-6 h-6" />
              ) : (
                <Heart className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  {celebrant.type === 'birthday' ? 'Birthday Blessing Studio' : 'Wedding Anniversary Blessing Studio'}
                </h3>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                  celebrant.isToday ? 'bg-rose-500 text-white' : 'bg-amber-400 text-slate-950'
                }`}>
                  {celebrant.isToday ? 'Today!' : `In ${celebrant.daysUntil} days`}
                </span>
              </div>
              <p className="text-xs text-emerald-200/90 mt-0.5">
                {celebrant.member.first_name} {celebrant.member.last_name} • {celebrant.milestoneTitle}
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

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs">
          {/* Member Quick Badge Info */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs">
                {celebrant.member.first_name[0]}{celebrant.member.last_name[0]}
              </div>
              <div>
                <p className="font-bold text-slate-900 text-xs">
                  {celebrant.member.first_name} {celebrant.member.last_name}
                </p>
                <p className="text-[11px] font-mono text-slate-500">
                  {phone ? `Ghana: ${phone}` : 'No phone number on record'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px]">
              {celebrant.member.ministry_name && (
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200 font-medium">
                  {celebrant.member.ministry_name}
                </span>
              )}
              {celebrant.member.small_group_name && (
                <span className="px-2 py-0.5 bg-blue-50 text-blue-800 rounded-lg border border-blue-200 font-medium">
                  {celebrant.member.small_group_name}
                </span>
              )}
            </div>
          </div>

          {/* Tone Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Select Pastoral Blessing Tone
              </label>
              <span className="text-[11px] text-slate-400">Click to switch pre-composed copy</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTone('prophetic')}
                className={`p-2.5 rounded-xl border text-left transition ${
                  tone === 'prophetic'
                    ? 'border-emerald-600 bg-emerald-50/80 text-emerald-950 font-bold shadow-xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs">
                  <span>🕊️</span>
                  <span>Prophetic Mandate</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5 font-normal line-clamp-1">
                  Prophet Elisha K. Richard declaration
                </p>
              </button>

              <button
                type="button"
                onClick={() => setTone('pastoral')}
                className={`p-2.5 rounded-xl border text-left transition ${
                  tone === 'pastoral'
                    ? 'border-emerald-600 bg-emerald-50/80 text-emerald-950 font-bold shadow-xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs">
                  <span>❤️</span>
                  <span>Pastoral & Family</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5 font-normal line-clamp-1">
                  Warm fellowship & gratitude
                </p>
              </button>

              <button
                type="button"
                onClick={() => setTone('concise')}
                className={`p-2.5 rounded-xl border text-left transition ${
                  tone === 'concise'
                    ? 'border-emerald-600 bg-emerald-50/80 text-emerald-950 font-bold shadow-xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs">
                  <span>⚡</span>
                  <span>Concise SMS</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5 font-normal line-clamp-1">
                  Short single-page prayer declaration
                </p>
              </button>
            </div>
          </div>

          {/* Quick Scripture Inserter */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-semibold text-slate-700 text-xs flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-emerald-700" />
                Quick Scripture Declarations
              </label>
              <span className="text-[10px] text-slate-400">Click to append to message</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleInsertScripture('Psalm 20:1-4', 'The Lord hear thee in the day of trouble; the name of the God of Jacob defend thee; Send thee help from the sanctuary...')}
                className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 rounded-lg text-slate-700 text-[11px] border border-slate-200 transition"
              >
                + Psalm 20:1-4
              </button>
              <button
                type="button"
                onClick={() => handleInsertScripture('Numbers 6:24-26', 'The Lord bless thee, and keep thee: The Lord make his face shine upon thee...')}
                className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 rounded-lg text-slate-700 text-[11px] border border-slate-200 transition"
              >
                + Numbers 6:24-26
              </button>
              <button
                type="button"
                onClick={() => handleInsertScripture('Isaiah 40:31', 'They that wait upon the Lord shall renew their strength; they shall mount up with wings as eagles...')}
                className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 rounded-lg text-slate-700 text-[11px] border border-slate-200 transition"
              >
                + Isaiah 40:31
              </button>
              <button
                type="button"
                onClick={() => handleInsertScripture('3 John 1:2', 'Beloved, I wish above all things that thou mayest prosper and be in health, even as thy soul prospereth.')}
                className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 rounded-lg text-slate-700 text-[11px] border border-slate-200 transition"
              >
                + 3 John 1:2
              </button>
            </div>
          </div>

          {/* Editable Textarea */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-bold text-slate-800 text-xs">
                Personalized Blessing Message Copy
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-slate-500">
                  {charLength} chars • {smsPages} {smsPages === 1 ? 'SMS page' : 'SMS pages'}
                </span>
                <button
                  type="button"
                  onClick={handleCopyText}
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
              placeholder="Blessing message text..."
            />
          </div>

          {/* Handset WhatsApp Preview */}
          <div className="p-3.5 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-emerald-700" />
                Live Handset Preview
              </span>
              <span className="text-emerald-700 font-mono">GWCC Ministerial Radar</span>
            </div>
            <p className="text-xs text-slate-800 bg-white p-3 rounded-xl border border-emerald-100 shadow-2xs whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">
              {customText}
            </p>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500">
            SMS Gateway Credits: <strong className="font-mono text-slate-700">{smsCredits} units</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyText}
              className="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{isCopied ? 'Copied' : 'Copy Text'}</span>
            </button>

            {/* Launch WhatsApp */}
            <button
              type="button"
              disabled={!phone}
              onClick={() => {
                onLaunchWhatsApp(phone, customText);
                onClose();
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              title="Launch official WhatsApp chat with prefilled message"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Launch WhatsApp Chat</span>
            </button>

            {/* Send SMS */}
            <button
              type="button"
              disabled={!phone || smsCredits < smsPages}
              onClick={() => {
                onSendSms(celebrant, customText);
                onClose();
              }}
              className="px-4 py-2 bg-[#064e3b] hover:bg-[#047857] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              title="Send scheduled SMS via Ghana Bulk SMS Gateway"
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
