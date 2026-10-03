import React, { useState, useEffect, useRef } from 'react';
import {
  WifiOff,
  Wifi,
  RefreshCw,
  X,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  HardDriveDownload,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useToast } from '../contexts/ToastContext';

export interface OfflineConnectivityBannerProps {
  /** Optional custom className */
  className?: string;
}

/**
 * OfflineConnectivityBanner Component
 * Detects online/offline network connectivity using navigator.onLine API
 * and presents a clear, actionable banner and toast notifications to church staff.
 */
export const OfflineConnectivityBanner: React.FC<OfflineConnectivityBannerProps> = ({ className = '' }) => {
  const { isOnline, offlineSince, checkConnection } = useNetworkStatus();
  const { warning, success } = useToast();

  const [isDismissed, setIsDismissed] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  // Track previous online state to distinguish initial mount from state change
  const prevOnlineRef = useRef<boolean>(isOnline);
  const reconnectedTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Handle transitions between Online and Offline
  useEffect(() => {
    // If transitioning from online to offline
    if (prevOnlineRef.current === true && isOnline === false) {
      setIsDismissed(false);
      setShowReconnected(false);
      if (reconnectedTimerRef.current) {
        clearTimeout(reconnectedTimerRef.current);
      }
      warning(
        'Offline Mode Detected',
        'Disconnected from network. Staff entries remain saved locally in browser storage.'
      );
    }

    // If transitioning from offline to online
    if (prevOnlineRef.current === false && isOnline === true) {
      setIsDismissed(false);
      setShowReconnected(true);
      success(
        'Internet Connection Restored',
        'Back online! Your system is reconnected to church services.'
      );

      // Auto-hide the reconnected banner after 4.5 seconds
      if (reconnectedTimerRef.current) {
        clearTimeout(reconnectedTimerRef.current);
      }
      reconnectedTimerRef.current = setTimeout(() => {
        setShowReconnected(false);
      }, 4500);
    }

    prevOnlineRef.current = isOnline;
  }, [isOnline, warning, success]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (reconnectedTimerRef.current) {
        clearTimeout(reconnectedTimerRef.current);
      }
    };
  }, []);

  // Update elapsed offline time counter every 30 seconds
  useEffect(() => {
    if (!offlineSince || isOnline) {
      setElapsedMinutes(0);
      return;
    }

    const updateElapsed = () => {
      const diffMs = Date.now() - offlineSince.getTime();
      setElapsedMinutes(Math.max(0, Math.floor(diffMs / 60000)));
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 30000);
    return () => clearInterval(interval);
  }, [offlineSince, isOnline]);

  const handleManualCheck = async () => {
    setIsChecking(true);
    try {
      const online = await checkConnection();
      if (!online) {
        // Still offline
      }
    } finally {
      setTimeout(() => setIsChecking(false), 500);
    }
  };

  // If online and not showing temporary reconnected confirmation, render nothing
  if (isOnline && !showReconnected) {
    return null;
  }

  return (
    <>
      {/* 1. Main Full-Width Connectivity Notification Banner */}
      <AnimatePresence>
        {(!isDismissed || showReconnected) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            role="alert"
            aria-live="assertive"
            className={`w-full overflow-hidden text-white shadow-md z-40 transition-colors ${
              showReconnected
                ? 'bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 border-b border-emerald-500/40'
                : 'bg-gradient-to-r from-amber-700 via-amber-600 to-rose-700 border-b border-amber-400/40'
            } ${className}`}
          >
            <div className="max-w-7xl mx-auto px-4 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              {/* Left Details */}
              <div className="flex items-center gap-3 flex-1 min-w-[280px]">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-inner ${
                    showReconnected ? 'bg-emerald-900/60' : 'bg-amber-900/60'
                  }`}
                >
                  {showReconnected ? (
                    <Wifi className="w-4 h-4 text-emerald-200 animate-pulse" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-amber-200 animate-bounce" />
                  )}
                </div>

                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold tracking-wide uppercase text-[11px] px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-xs flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          showReconnected ? 'bg-emerald-300 animate-ping' : 'bg-rose-300 animate-ping'
                        }`}
                      />
                      {showReconnected ? 'Back Online' : 'Offline Mode Active'}
                    </span>

                    {!showReconnected && elapsedMinutes > 0 && (
                      <span className="text-[11px] text-amber-100 font-mono font-medium">
                        (Disconnected for {elapsedMinutes}m)
                      </span>
                    )}
                  </div>

                  <p className="text-[11.5px] text-white/95 leading-relaxed">
                    {showReconnected ? (
                      <span>
                        Internet connectivity restored via <strong>navigator.onLine</strong>. Reconnected to church system.
                      </span>
                    ) : (
                      <span>
                        You are currently disconnected from the system. You can continue recording attendance, giving, and visitors — <strong>all entries are safely preserved in local browser storage</strong>.
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Right Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                {!showReconnected && (
                  <>
                    <button
                      type="button"
                      onClick={handleManualCheck}
                      disabled={isChecking}
                      className="px-3 py-1.5 bg-white/20 hover:bg-white/30 active:bg-white/40 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                      title="Re-check network connectivity with navigator.onLine and server health ping"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                      <span>{isChecking ? 'Checking...' : 'Check Connection'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsDismissed(true)}
                      className="px-2.5 py-1.5 bg-black/20 hover:bg-black/30 text-white/90 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                      title="Minimize to floating pill"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Minimize</span>
                    </button>
                  </>
                )}

                {showReconnected && (
                  <button
                    type="button"
                    onClick={() => setShowReconnected(false)}
                    className="p-1 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
                    title="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Floating Compact Pill (When staff minimized the top banner during long offline service) */}
      <AnimatePresence>
        {!isOnline && isDismissed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 15 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-5 left-5 z-40"
          >
            <button
              type="button"
              onClick={() => setIsDismissed(false)}
              className="group px-3 py-2 bg-gradient-to-r from-amber-700 to-rose-700 hover:from-amber-600 hover:to-rose-600 text-white rounded-xl shadow-xl border border-amber-400/50 flex items-center gap-2.5 text-xs font-bold transition hover:scale-105 cursor-pointer"
              title="Click to view full offline status details"
            >
              <div className="relative flex items-center justify-center">
                <WifiOff className="w-4 h-4 text-amber-200" />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-400 rounded-full animate-ping" />
              </div>
              <div className="text-left">
                <span className="block text-[11px] leading-tight">Offline Mode</span>
                <span className="block text-[9px] text-amber-200 font-normal font-mono">
                  Local Storage Active • Click to Expand
                </span>
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
