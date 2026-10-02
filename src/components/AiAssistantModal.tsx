import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  X,
  Send,
  Copy,
  Check,
  Bot,
  User,
  BookOpen,
  HeartHandshake,
  MessageSquare,
  Network,
  RotateCcw,
  Loader2,
  ChevronRight,
  Flame,
  FileText
} from 'lucide-react';
import { useChurchData } from '../contexts/ChurchDataContext';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPrompt?: string;
}

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({
  isOpen,
  onClose,
  initialPrompt,
}) => {
  const { settings, members, visitors, smallGroups, ministries } = useChurchData();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: `**Shalom and Blessings!** I am your **GWCC Ministerial AI Assistant**, grounded in biblical scripture and designed for **${settings.church_name}** in Joma, Accra.\n\nHow may I assist your ministry today?\n* 📖 **Sermon Preparation & Outlines**\n* 🕊️ **Pastoral Care & Counseling Messages**\n* 📢 **Announcements & Ghana Bulk SMS Copy**\n* 👥 **Cell Group Lessons & Discipleship Guides**`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputPrompt, setInputPrompt] = useState(initialPrompt || '');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialPrompt) {
      setInputPrompt(initialPrompt);
    }
  }, [initialPrompt]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const quickPrompts = [
    {
      label: 'Sermon Outline: Supernatural Abundance',
      icon: BookOpen,
      prompt: 'Draft an inspiring 3-point Pentecostal sermon outline on "Walking in Supernatural Abundance" (Ephesians 3:20). Include relevant scriptures, a Ghanaian real-life illustration, and concluding altar call prayer points.',
    },
    {
      label: 'Visitor Follow-up WhatsApp Message',
      icon: MessageSquare,
      prompt: 'Write a warm, faith-filled WhatsApp follow-up message to a first-time church visitor who attended Sunday service at Greater Works City Church in Joma.',
    },
    {
      label: 'Friday All-Night Vigil SMS (<160 chars)',
      icon: Flame,
      prompt: 'Draft 3 punchy SMS announcement options under 160 characters for our upcoming Friday Prophetic All-Night Vigil at GWCC Joma.',
    },
    {
      label: 'Pastoral Bereavement Condolence',
      icon: HeartHandshake,
      prompt: 'Write an empathetic pastoral condolence note from the Senior Pastor and leadership of Greater Works City Church to a church family grieving the loss of an elderly parent.',
    },
    {
      label: 'Cell Fellowship 1-Hour Study Plan',
      icon: Network,
      prompt: 'Create a 1-hour home cell fellowship meeting guide on "Prevailing in Prayer" with icebreaker, scripture reading (James 5:16-18), discussion questions, and prayer targets.',
    },
  ];

  const handleSendMessage = async (textToSend?: string) => {
    const prompt = (textToSend || inputPrompt).trim();
    if (!prompt || isLoading) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: prompt,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputPrompt('');
    setIsLoading(true);

    try {
      // Package church context so AI is grounded in GWCC statistics
      const churchContext = {
        churchName: settings.church_name,
        seniorPastor: settings.senior_pastor || 'Prophet Elisha K. Richard',
        generalSecretary: settings.general_secretary || 'Tamekloe Clara Gaewornu',
        tagline: settings.tagline,
        location: settings.location,
        address: settings.address,
        gpsAddress: settings.gps_address,
        registeredMembersCount: members.length,
        visitorsCount: visitors.length,
        smallGroupsCount: smallGroups.length,
        ministries: ministries.map((m) => m.name),
      };

      const response = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          churchContext,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with status ${response.status}`);
      }

      const data = await response.json();
      const assistantMessage: Message = {
        id: `msg-${Date.now() + 1}`,
        sender: 'assistant',
        text: data.text || 'I have completed your request, Beloved.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error('AI Assistant Error:', err);
      const errorMessage: Message = {
        id: `msg-err-${Date.now()}`,
        sender: 'assistant',
        text: `⚠️ **Notice**: ${err.message || 'Unable to contact the AI assistant service at this moment.'}\n\nPlease check your network connection and server status.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearHistory = () => {
    if (confirm('Clear assistant conversation history?')) {
      setMessages([
        {
          id: 'welcome-reset',
          sender: 'assistant',
          text: `Conversation cleared. Ready for your next ministerial question or prompt, Beloved.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden h-[90vh] sm:h-[85vh] flex flex-col">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-emerald-950 via-[#064e3b] to-emerald-900 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
              <Sparkles className="w-4 h-4 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold tracking-tight text-white">GWCC Ministerial AI Assistant</h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-[10px] font-mono font-bold text-emerald-200 border border-emerald-400/20">
                  Gemini 3.8
                </span>
              </div>
              <p className="text-[11px] text-emerald-200/90">
                Sermon prep, pastoral care, Ghana bulk communications & leadership advisor
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleClearHistory}
              className="p-1.5 text-emerald-200 hover:text-white hover:bg-white/10 rounded-lg transition text-xs"
              title="Reset conversation"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Prompts Bar */}
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 overflow-x-auto flex items-center gap-1.5 shrink-0 text-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1 mr-1">
            <Sparkles className="w-3 h-3 text-emerald-600" /> Quick Starters:
          </span>
          {quickPrompts.map((qp, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(qp.prompt)}
              disabled={isLoading}
              className="px-2.5 py-1 bg-white hover:bg-emerald-50 hover:text-emerald-900 border border-slate-200 hover:border-emerald-300 rounded-lg text-slate-700 text-[11px] font-medium shrink-0 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <qp.icon className="w-3 h-3 text-emerald-700" />
              <span>{qp.label}</span>
            </button>
          ))}
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/50 text-xs">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'assistant' && (
                <div className="w-7 h-7 rounded-xl bg-[#064e3b] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                  <Bot className="w-4 h-4 text-emerald-200" />
                </div>
              )}

              <div
                className={`max-w-[85%] sm:max-w-[78%] rounded-2xl p-4 space-y-2 shadow-xs ${
                  msg.sender === 'user'
                    ? 'bg-[#064e3b] text-white rounded-tr-xs'
                    : 'bg-white text-slate-800 border border-slate-200 rounded-tl-xs'
                }`}
              >
                <div className="whitespace-pre-wrap leading-relaxed space-y-1.5 font-sans">
                  {msg.text.split('\n\n').map((paragraph, pIdx) => {
                    // Simple formatting for bold, bullets
                    return (
                      <p key={pIdx} className="leading-relaxed">
                        {paragraph}
                      </p>
                    );
                  })}
                </div>

                <div
                  className={`flex items-center justify-between pt-1 border-t text-[10px] ${
                    msg.sender === 'user'
                      ? 'border-emerald-700/50 text-emerald-200'
                      : 'border-slate-100 text-slate-400'
                  }`}
                >
                  <span>{msg.timestamp}</span>
                  {msg.sender === 'assistant' && (
                    <button
                      onClick={() => handleCopy(msg.id, msg.text)}
                      className="flex items-center gap-1 hover:text-slate-700 transition"
                      title="Copy response to clipboard"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-600 font-semibold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {msg.sender === 'user' && (
                <div className="w-7 h-7 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs font-bold text-xs">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="w-7 h-7 rounded-xl bg-[#064e3b] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                <Bot className="w-4 h-4 text-emerald-200" />
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-2 text-slate-600 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
                <span>Consulting scriptures & generating ministerial response...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3.5 bg-white border-t border-slate-200">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder="Ask for sermon outline, visitor follow-up, prayer points, SMS text..."
              className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-emerald-600 text-slate-800"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!inputPrompt.trim() || isLoading}
              className="px-4 py-2.5 bg-[#064e3b] hover:bg-[#047857] disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5 shrink-0"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span className="hidden sm:inline">Send Prompt</span>
            </button>
          </form>
          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5 px-1">
            <span>Powered by Gemini 3.8 Flash • Specialized for Greater Works City Church</span>
            <span>Shift + Enter for new lines</span>
          </div>
        </div>
      </div>
    </div>
  );
};
