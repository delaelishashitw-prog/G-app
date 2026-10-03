import { useState, useEffect, useCallback } from 'react';

export interface NetworkStatus {
  isOnline: boolean;
  offlineSince: Date | null;
  checkConnection: () => Promise<boolean>;
}

/**
 * Custom hook to detect network connectivity status using the navigator.onLine API
 * and window online/offline event listeners.
 */
export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
      ? navigator.onLine
      : true;
  });

  const [offlineSince, setOfflineSince] = useState<Date | null>(() => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return new Date();
    }
    return null;
  });

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setOfflineSince(null);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setOfflineSince(new Date());
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial sync
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
      setIsOnline(navigator.onLine);
      if (!navigator.onLine) {
        setOfflineSince(new Date());
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    // If navigator explicitly reports offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOnline(false);
      if (!offlineSince) setOfflineSince(new Date());
      return false;
    }

    // Actively verify server reachability with a fast timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const res = await fetch('/api/health', {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const connected = res.ok || res.status < 500;
      setIsOnline(connected);
      if (connected) {
        setOfflineSince(null);
      } else if (!offlineSince) {
        setOfflineSince(new Date());
      }
      return connected;
    } catch {
      const navOnline = typeof navigator !== 'undefined' ? navigator.onLine : false;
      setIsOnline(navOnline);
      if (!navOnline && !offlineSince) {
        setOfflineSince(new Date());
      }
      return navOnline;
    }
  }, [offlineSince]);

  return { isOnline, offlineSince, checkConnection };
}
