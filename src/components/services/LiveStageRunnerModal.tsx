import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  SkipBack,
  Clock,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Sparkles,
  User,
  ListOrdered,
  AlertTriangle,
  CheckCircle2,
  Tv,
} from 'lucide-react';
import { ChurchService, ServiceProgramItem } from '../../types/database.types';

interface LiveStageRunnerModalProps {
  service: ChurchService;
  onClose: () => void;
}

// Parses string like "25 min" or "15" or "10 mins" into seconds
function parseDurationToSeconds(durationStr?: string): number {
  if (!durationStr) return 15 * 60; // default 15 mins
  const match = durationStr.match(/(\d+)/);
  if (match) {
    const minutes = parseInt(match[1], 10);
    return Math.max(1, minutes) * 60;
  }
  return 15 * 60;
}

function formatTime(seconds: number): string {
  const isNegative = seconds < 0;
  const abs = Math.abs(seconds);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const sign = isNegative ? '+' : '';
  return `${sign}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const LiveStageRunnerModal: React.FC<LiveStageRunnerModalProps> = ({
  service,
  onClose,
}) => {
  const items: ServiceProgramItem[] = service.order_of_service && service.order_of_service.length > 0
    ? service.order_of_service
    : [
        { id: '1', order: 1, title: 'Opening Prayer & Thanksgiving', minister: service.service_leader || 'Prayer Lead', duration: '15 min' },
        { id: '2', order: 2, title: 'High Praise & Adoration', minister: service.worship_leader || 'Praise Choir', duration: '30 min' },
        { id: '3', order: 3, title: 'Visitor Welcome & Announcements', minister: 'Protocol Lead', duration: '10 min' },
        { id: '4', order: 4, title: 'Tithe, Kingdom Seed & Offering', minister: 'Finance Steward', duration: '15 min' },
        { id: '5', order: 5, title: 'The Word of God (Sermon)', minister: service.preacher || 'Prophet Elisha K. Richard', duration: '45 min' },
        { id: '6', order: 6, title: 'Altar Call & Benediction', minister: service.preacher || 'Senior Pastor', duration: '15 min' },
      ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const currentItem = items[currentIndex] || items[0];

  const currentDurationSeconds = parseDurationToSeconds(currentItem.duration);
  const [secondsRemaining, setSecondsRemaining] = useState(currentDurationSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTimeStr, setCurrentTimeStr] = useState('');
  const [serviceElapsedTime, setServiceElapsedTime] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Live real-time clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTimeStr(
        now.toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Timer interval
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRunning) {
      interval = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev === 1 && soundEnabled) {
            playChime();
          }
          return prev - 1;
        });
        setServiceElapsedTime((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, soundEnabled]);

  // Audio chime via Web Audio API
  const playChime = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
    } catch {
      // Audio context might be restricted before interaction
    }
  };

  const handleSelectIndex = (idx: number) => {
    setCurrentIndex(idx);
    const newDuration = parseDurationToSeconds(items[idx]?.duration);
    setSecondsRemaining(newDuration);
    setIsRunning(false);
  };

  const handleNext = () => {
    if (currentIndex < items.length - 1) {
      handleSelectIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      handleSelectIndex(currentIndex - 1);
    }
  };

  const handleResetSegment = () => {
    setSecondsRemaining(currentDurationSeconds);
    setIsRunning(false);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const isOvertime = secondsRemaining < 0;
  const isNearEnd = secondsRemaining > 0 && secondsRemaining <= 120; // under 2 mins

  const totalPlannedDurationSeconds = items.reduce(
    (acc, it) => acc + parseDurationToSeconds(it.duration),
    0
  );

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-50 flex flex-col bg-slate-950 text-white ${
        isFullscreen ? 'p-6 sm:p-10' : 'p-3 sm:p-6 backdrop-blur-md bg-slate-950/95'
      }`}
    >
      {/* Top Bar: Service Info & Live Clock */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-600/30 border border-emerald-500/50 rounded-xl">
            <Tv className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white animate-pulse">
                LIVE STAGE RUNNER
              </span>
              <h2 className="text-base sm:text-lg font-black tracking-tight">{service.name}</h2>
            </div>
            <p className="text-xs text-slate-400">
              {service.day_of_week}s • {service.start_time} - {service.end_time} • {service.venue || 'Main Sanctuary'}
            </p>
          </div>
        </div>

        {/* Live Clock & Control Icons */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col text-right font-mono">
            <span className="text-[10px] uppercase font-bold text-slate-400">Sanctuary Live Time (GMT)</span>
            <span className="text-base font-extrabold text-emerald-400">{currentTimeStr}</span>
          </div>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-xl border transition ${
              soundEnabled
                ? 'bg-slate-800 border-slate-700 text-emerald-400'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
            title={soundEnabled ? 'Chime Enabled' : 'Chime Muted'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Stage Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-rose-900/60 border border-slate-700 text-slate-300 hover:text-rose-200 transition"
            title="Close Stage Runner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Area: Split Stage Display (Left) + Liturgy Program Flow (Right) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 pt-6 overflow-y-auto min-h-0">
        {/* Left (8 Cols): Huge Stage Timer & Presenter Card */}
        <div className="lg:col-span-8 flex flex-col justify-between space-y-6">
          {/* Active Segment Card */}
          <div className="p-6 sm:p-8 bg-slate-900/90 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden flex-1 flex flex-col justify-between">
            {/* Top info badge */}
            <div className="flex items-center justify-between gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                Segment {currentIndex + 1} of {items.length}
              </span>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>Planned: {currentItem.duration || '15 min'}</span>
              </div>
            </div>

            {/* Current Item Title & Minister */}
            <div className="my-6 space-y-3">
              <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
                {currentItem.title}
              </h1>
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm sm:text-base">
                <User className="w-4 h-4 text-emerald-400" />
                <span>Ministration by: <strong className="text-white">{currentItem.minister || service.preacher || 'Assigned Minister'}</strong></span>
              </div>
              {currentItem.notes && (
                <p className="text-xs sm:text-sm text-slate-400 italic bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  Notes: {currentItem.notes}
                </p>
              )}
            </div>

            {/* Giant Timer Display */}
            <div
              className={`p-6 sm:p-10 rounded-2xl border text-center transition-all ${
                isOvertime
                  ? 'bg-rose-950/60 border-rose-600/80 text-rose-300 animate-pulse'
                  : isNearEnd
                  ? 'bg-amber-950/40 border-amber-500/70 text-amber-300'
                  : 'bg-slate-950/80 border-slate-800 text-white'
              }`}
            >
              <span className="text-[11px] font-black uppercase tracking-widest block text-slate-400 mb-1">
                {isOvertime ? '⚠️ OVERTIME EXTENSION' : isNearEnd ? '⏳ FINAL 2 MINUTES' : 'TIME REMAINING FOR SEGMENT'}
              </span>
              <div className="text-6xl sm:text-8xl lg:text-9xl font-mono font-black tracking-tight leading-none">
                {formatTime(secondsRemaining)}
              </div>
            </div>

            {/* Stage Controls: Play / Pause, Prev, Next, Reset */}
            <div className="flex items-center justify-center gap-3 pt-6 flex-wrap">
              <button
                onClick={handlePrevious}
                disabled={currentIndex === 0}
                className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                title="Previous Segment"
              >
                <SkipBack className="w-4 h-4" />
                <span className="hidden sm:inline">Prev Segment</span>
              </button>

              <button
                onClick={() => setIsRunning(!isRunning)}
                className={`px-8 py-4 rounded-2xl font-black text-sm flex items-center gap-2 transition shadow-xl cursor-pointer ${
                  isRunning
                    ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                    : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950'
                }`}
              >
                {isRunning ? (
                  <>
                    <Pause className="w-5 h-5 fill-current" />
                    <span>PAUSE TIMER</span>
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 fill-current" />
                    <span>START SEGMENT</span>
                  </>
                )}
              </button>

              <button
                onClick={handleResetSegment}
                className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                title="Reset Segment Clock"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={handleNext}
                disabled={currentIndex === items.length - 1}
                className="px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md"
                title="Next Segment"
              >
                <span className="hidden sm:inline">Next Segment</span>
                <SkipForward className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Upcoming Next Segment Banner */}
          {currentIndex < items.length - 1 && (
            <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 uppercase font-bold text-[10px]">UP NEXT:</span>
                <span className="font-bold text-slate-200">
                  {items[currentIndex + 1].title} ({items[currentIndex + 1].duration || '15 min'})
                </span>
              </div>
              <span className="text-slate-400 font-medium text-[11px]">
                {items[currentIndex + 1].minister || 'Assigned Minister'}
              </span>
            </div>
          )}
        </div>

        {/* Right (4 Cols): Liturgy Program Timeline & Jump Controls */}
        <div className="lg:col-span-4 flex flex-col space-y-4">
          <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                <ListOrdered className="w-4 h-4 text-emerald-400" />
                Liturgy Program Sequence
              </h3>
              <p className="text-[11px] text-slate-400">
                Click any segment to jump active stage focus
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-400">
              {currentIndex + 1}/{items.length}
            </span>
          </div>

          {/* Liturgy Items List */}
          <div className="space-y-2 flex-1 overflow-y-auto pr-1">
            {items.map((item, idx) => {
              const isActive = idx === currentIndex;
              const isPast = idx < currentIndex;

              return (
                <div
                  key={item.id}
                  onClick={() => handleSelectIndex(idx)}
                  className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                    isActive
                      ? 'bg-emerald-950/70 border-emerald-500/80 shadow-lg text-white ring-1 ring-emerald-500'
                      : isPast
                      ? 'bg-slate-900/40 border-slate-800/80 text-slate-400 hover:bg-slate-800/50'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800/70'
                  }`}
                >
                  <div className="flex items-start gap-2.5 truncate">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                        isActive
                          ? 'bg-emerald-500 text-slate-950 font-black'
                          : isPast
                          ? 'bg-slate-800 text-emerald-400'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {isPast ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
                    </span>
                    <div className="truncate">
                      <h4 className={`text-xs font-bold truncate ${isActive ? 'text-white' : ''}`}>
                        {item.title}
                      </h4>
                      <p className="text-[10px] text-slate-400 truncate">
                        {item.minister || 'Minister'}
                      </p>
                    </div>
                  </div>

                  <span className="font-mono text-[11px] font-semibold text-slate-400 shrink-0">
                    {item.duration || item.time || ''}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Overall Elapsed vs Planned Bar */}
          <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
              <span>SERVICE RUNTIME</span>
              <span className="font-mono text-emerald-400">
                {Math.floor(serviceElapsedTime / 60)}m elapsed / ~{Math.floor(totalPlannedDurationSeconds / 60)}m total
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, Math.round((serviceElapsedTime / totalPlannedDurationSeconds) * 100))}%`,
                }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
