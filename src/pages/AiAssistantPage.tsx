import React, { useState } from 'react';
import {
  Sparkles,
  BookOpen,
  HeartHandshake,
  MessageSquare,
  Network,
  Send,
  Copy,
  Check,
  RotateCcw,
  Loader2,
  Flame,
  FileText,
  Church,
  Users,
  Compass,
  Zap,
  Bookmark,
  ExternalLink
} from 'lucide-react';
import { useChurchData } from '../contexts/ChurchDataContext';

export const AiAssistantPage: React.FC = () => {
  const { settings, members, visitors, smallGroups, ministries, giving } = useChurchData();

  const [activeCategory, setActiveCategory] = useState<'sermon' | 'pastoral' | 'comms' | 'cells' | 'custom'>('sermon');
  const [promptInput, setPromptInput] = useState('');
  const [responseOutput, setResponseOutput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Pre-configured Studio Templates
  const templates = {
    sermon: [
      {
        title: 'Supernatural Abundance & Grace',
        topic: 'Walking in Supernatural Abundance (Ephesians 3:20)',
        prompt: 'Draft an inspiring 3-point Pentecostal sermon outline on "Walking in Supernatural Abundance" (Ephesians 3:20). Include biblical exegesis, 3 strong supporting scriptures, an authentic Ghanaian real-life faith illustration (e.g. from business, family, or ministry in Accra), and concluding altar call prayer points.',
      },
      {
        title: 'Communion & Covenant Blood',
        topic: 'The Power in the Blood of the Covenant (1 Corinthians 11:23-26)',
        prompt: 'Prepare a powerful 15-minute Communion exhortation for Sunday service at Greater Works City Church. Focus on healing, deliverance from generational curses, and divine protection. Include scripture readings and communion prayer words.',
      },
      {
        title: 'Tithe, Seed & Financial Breakthrough',
        topic: 'The Mystery of Kingdom Seed & Harvest (Malachi 3:10, 2 Corinthians 9:6-8)',
        prompt: 'Generate a biblical, faith-building 10-minute offering exhortation on faithful stewardship and covenant giving for a Ghanaian congregation. Avoid manipulation; ground the message in love, obedience, and divine multiplication.',
      },
      {
        title: 'Friday All-Night Warfare & Deliverance',
        topic: 'Dismantling Foundations of Delay (Psalm 11:3, Colossians 2:14-15)',
        prompt: 'Provide a dynamic sermon and prophetic prayer outline for our Friday All-Night Vigil at GWCC Joma. Include 7 targeted prayer warfare bulletins for families, careers, and youth advancement.',
      },
    ],
    pastoral: [
      {
        title: 'First-Time Visitor Pastoral Care',
        topic: 'Warm Welcome & Personal Follow-Up',
        prompt: 'Write an empathetic and encouraging pastoral letter from Prophet Elisha K. Richard, Senior Pastor of Greater Works City Church, Joma to a new visitor who attended for the first time. Express heartfelt love, provide church service schedules, and invite them for coffee or prayer.',
      },
      {
        title: 'Bereavement & Funeral Condolence',
        topic: 'Comfort in Time of Grief (2 Corinthians 1:3-4)',
        prompt: 'Draft a formal and comforting condolence message from Prophet Elisha K. Richard, Senior Pastor, and the leadership of Greater Works City Church to a member family mourning the loss of a mother. Include scriptures of hope in Christ and reassurance of church support.',
      },
      {
        title: 'Hospital Visitation & Healing Prayer',
        topic: 'Divine Health & Recovery (James 5:14-15)',
        prompt: 'Create a pastoral hospital visitation guide with gentle conversation starters, 3 healing scriptures, and an uplifting prayer for a hospitalized church member in Accra.',
      },
      {
        title: 'Youth & Academic Encouragement',
        topic: 'Excellence in Exams & Career (Daniel 1:17)',
        prompt: 'Draft an encouraging pastoral message for BECE, WASSCE, and university students in our congregation embarking on critical examinations. Speak wisdom, focus, and divine favor.',
      },
    ],
    comms: [
      {
        title: 'Ghana Bulk SMS: Sunday Prophetic Service',
        topic: 'High-Impact SMS Broadcast (<160 chars)',
        prompt: 'Generate 3 high-impact, punchy SMS broadcast messages under 160 characters each for Greater Works City Church, Joma, inviting members and neighbors to Sunday Prophetic Celebration Service at 8:30 AM.',
      },
      {
        title: 'WhatsApp Weekly Devotional Broadcast',
        topic: 'Monday Morning Motivation',
        prompt: 'Draft an engaging Monday Morning WhatsApp devotional for GWCC members titled "Starting Your Week with Greater Works". Include a Bible verse, 3 short uplifting paragraphs, and a declarative confession.',
      },
      {
        title: 'Community Outreach Announcement',
        topic: 'Medical Screening & Community Evangelism',
        prompt: 'Write a persuasive community announcement inviting residents of Joma, Ablekuma, and surrounding communities to a free community health screening and evangelism crusade hosted by GWCC.',
      },
      {
        title: 'Secretariat Official Notice',
        topic: 'Administrative Notice by General Secretary',
        prompt: 'Draft an official administrative notice from the Church Secretariat signed by General Secretary Tamekloe Clara Gaewornu to all department heads and church members regarding upcoming quarterly church council reviews, ministry calendar deadlines, and compliance requirements.',
      },
    ],
    cells: [
      {
        title: 'Cell Lesson: Fruit of the Spirit at Work',
        topic: 'Christian Integrity in Marketplace (Galatians 5:22-23)',
        prompt: 'Create a 45-minute home cell discussion guide on demonstrating the Fruit of the Spirit in daily Ghanaian workplaces and commercial markets. Include an icebreaker, scripture reading, 3 discussion questions, and prayer targets.',
      },
      {
        title: 'Cell Leader Assimilation Strategy',
        topic: 'Retaining Visitors in Joma & Ablekuma',
        prompt: 'Provide 5 practical, actionable recommendations for our Community Cell Leaders to connect with and disciple new visitors within 48 hours of their first church visit.',
      },
    ],
    custom: [],
  };

  const handleRunPrompt = async (textToRun?: string) => {
    const prompt = (textToRun || promptInput).trim();
    if (!prompt || isLoading) return;

    setIsLoading(true);
    setResponseOutput('');

    try {
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
      setResponseOutput(data.text || 'No response generated.');
    } catch (err: any) {
      console.error('AI Generation Error:', err);
      setResponseOutput(`⚠️ **Notice**: ${err.message || 'Unable to contact the AI assistant service at this moment.'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyOutput = () => {
    if (!responseOutput) return;
    navigator.clipboard.writeText(responseOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-emerald-950 via-[#064e3b] to-emerald-900 p-6 rounded-3xl text-white shadow-lg">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 bg-emerald-700/60 rounded-xl">
              <Sparkles className="w-5 h-5 text-emerald-200" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
              Generative Ministerial Intelligence
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            GWCC Pastoral AI Assistant & Studio
          </h1>
          <p className="text-xs text-emerald-100/90 mt-1 max-w-2xl">
            Powered by <strong>Gemini 3.8 Flash</strong>. Generate theological sermon outlines, pastoral counseling letters, Ghana bulk communications, and community cell fellowship materials tailored for {settings.church_name}.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white/10 border border-white/20 p-3 rounded-2xl backdrop-blur-xs text-xs">
          <Church className="w-4 h-4 text-emerald-300" />
          <div>
            <span className="text-[10px] text-emerald-200 block uppercase font-semibold">Active Assembly</span>
            <span className="font-bold text-white">{settings.church_name}</span>
          </div>
        </div>
      </div>

      {/* Main Categories Selector */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveCategory('sermon')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition shrink-0 ${
            activeCategory === 'sermon'
              ? 'border-[#064e3b] text-[#064e3b]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Sermon Preparation Studio</span>
        </button>

        <button
          onClick={() => setActiveCategory('pastoral')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition shrink-0 ${
            activeCategory === 'pastoral'
              ? 'border-[#064e3b] text-[#064e3b]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <HeartHandshake className="w-4 h-4 text-rose-600" />
          <span>Pastoral Care & Counseling</span>
        </button>

        <button
          onClick={() => setActiveCategory('comms')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition shrink-0 ${
            activeCategory === 'comms'
              ? 'border-[#064e3b] text-[#064e3b]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <MessageSquare className="w-4 h-4 text-emerald-600" />
          <span>Ghana SMS & WhatsApp Copywriter</span>
        </button>

        <button
          onClick={() => setActiveCategory('cells')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition shrink-0 ${
            activeCategory === 'cells'
              ? 'border-[#064e3b] text-[#064e3b]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Network className="w-4 h-4 text-blue-600" />
          <span>Cell Fellowship & Discipleship</span>
        </button>

        <button
          onClick={() => setActiveCategory('custom')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition shrink-0 ${
            activeCategory === 'custom'
              ? 'border-[#064e3b] text-[#064e3b]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Zap className="w-4 h-4 text-amber-600" />
          <span>Custom Theological Prompt</span>
        </button>
      </div>

      {/* Studio Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Preset Templates (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-700" />
                Featured Ministerial Templates
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">1-Click Generate</span>
            </div>
            <p className="text-xs text-slate-500">
              Select any prompt below to automatically populate the generative studio:
            </p>

            <div className="space-y-2.5">
              {(templates[activeCategory] || []).map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setPromptInput(item.prompt);
                    handleRunPrompt(item.prompt);
                  }}
                  className="p-3.5 border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 rounded-xl cursor-pointer transition space-y-1 group"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs text-slate-900 group-hover:text-emerald-950">
                      {item.title}
                    </h4>
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      Generate
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 font-medium">{item.topic}</p>
                  <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">{item.prompt}</p>
                </div>
              ))}

              {activeCategory === 'custom' && (
                <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-600 space-y-2">
                  <p className="font-semibold text-slate-800">Ask Any Question:</p>
                  <ul className="list-disc list-inside space-y-1 text-[11px]">
                    <li>Greek/Hebrew word study insights</li>
                    <li>Congregation assimilation strategy</li>
                    <li>Board meeting agenda drafting</li>
                    <li>Ghanaian wedding or baby dedication exhortations</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Prompt Input & Generated Output (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Prompt Input Box */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <label className="block font-bold text-slate-800 text-xs">
              Prompt Instructions & Context
            </label>
            <textarea
              rows={4}
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              placeholder="Enter your sermon topic, counseling need, scripture reference, or question..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-emerald-600 leading-relaxed"
            />
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-400">
                Model: <strong className="font-mono text-emerald-800">gemini-3.8-flash</strong>
              </span>
              <button
                type="button"
                onClick={() => handleRunPrompt()}
                disabled={!promptInput.trim() || isLoading}
                className="px-5 py-2 bg-[#064e3b] hover:bg-[#047857] disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-2"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>{isLoading ? 'Generating...' : 'Generate with Gemini'}</span>
              </button>
            </div>
          </div>

          {/* Generated Result Output */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-700" />
                <h3 className="font-bold text-slate-900 text-sm">Generated Ministerial Response</h3>
              </div>
              {responseOutput && (
                <button
                  type="button"
                  onClick={handleCopyOutput}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 border border-slate-200"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700 font-bold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Result</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {isLoading && (
              <div className="p-12 text-center space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-700 mx-auto" />
                <h4 className="font-bold text-slate-800 text-sm">Formulating Scriptural Output</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Consulting biblical cross-references, hermeneutical context, and Greater Works City Church ministry voice...
                </p>
              </div>
            )}

            {!isLoading && responseOutput && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-800 leading-relaxed font-sans whitespace-pre-wrap max-h-[600px] overflow-y-auto">
                {responseOutput}
              </div>
            )}

            {!isLoading && !responseOutput && (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <Sparkles className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-xs font-semibold text-slate-600">No output generated yet</p>
                <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                  Select a template from the left or type your custom ministerial request above, then click <strong>Generate with Gemini</strong>.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
