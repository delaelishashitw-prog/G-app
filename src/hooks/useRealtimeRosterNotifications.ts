import { useState, useEffect, useRef, useCallback } from 'react';

export interface RosterNotification {
  id: string;
  type: 'ROSTER_ASSIGNED' | 'ROSTER_UPDATED' | 'ROSTER_SUBSTITUTED' | 'ROSTER_CONFIRMED';
  memberId: string;
  memberName: string;
  dutyId: string;
  serviceName: string;
  date: string;
  department: string;
  roleTitle: string;
  reportTime: string;
  notes?: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

// Gentle ministerial chime synthesized via Web Audio API
export function playRosterNotificationSound(): void {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const now = ctx.currentTime;
    const playTone = (freq: number, start: number, duration: number, gainVal: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(gainVal, start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + duration);
    };

    // Elegant 3-tone ascending church bell chime (C5 -> E5 -> G5)
    playTone(523.25, now, 0.5, 0.15); // C5
    playTone(659.25, now + 0.12, 0.6, 0.15); // E5
    playTone(783.99, now + 0.24, 0.8, 0.2); // G5
  } catch {
    // Audio context may be restricted by autoplay policy until user gesture
  }
}

export interface UseRealtimeRosterOptions {
  memberId?: string;
  memberName?: string;
  enabled?: boolean;
  onNotificationReceived?: (notification: RosterNotification) => void;
}

export function useRealtimeRosterNotifications({
  memberId,
  memberName,
  enabled = true,
  onNotificationReceived,
}: UseRealtimeRosterOptions) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [notifications, setNotifications] = useState<RosterNotification[]>([]);
  const [latestAlert, setLatestAlert] = useState<RosterNotification | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const reconnectAttemptsRef = useRef(0);
  const pingIntervalRef = useRef<any>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Fetch initial notifications from REST endpoint on mount/member change
  const fetchRecentNotifications = useCallback(async () => {
    if (!memberId) return;
    try {
      const res = await fetch(`/api/roster/notifications?memberId=${encodeURIComponent(memberId)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.notifications)) {
          setNotifications(data.notifications.reverse());
        }
      }
    } catch {
      // Ignore network errors
    }
  }, [memberId]);

  useEffect(() => {
    fetchRecentNotifications();
  }, [fetchRecentNotifications]);

  // Connect WebSocket
  const connect = useCallback(() => {
    if (!enabled || !memberId) return;

    if (socketRef.current) {
      if (
        socketRef.current.readyState === WebSocket.OPEN ||
        socketRef.current.readyState === WebSocket.CONNECTING
      ) {
        return;
      }
      try {
        socketRef.current.close();
      } catch {}
    }

    setStatus('connecting');

    try {
      const isHttps = window.location.protocol === 'https:';
      const wsProtocol = isHttps ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}/ws`;

      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
        reconnectAttemptsRef.current = 0;

        // Subscribe with member credentials
        ws.send(
          JSON.stringify({
            type: 'subscribe',
            memberId,
            memberName,
          })
        );

        // Keep-alive heartbeat ping every 25s
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 25000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'SUBSCRIBED') {
            if (Array.isArray(data.notifications)) {
              setNotifications(data.notifications.reverse());
            }
          } else if (data.type === 'ROSTER_NOTIFICATION' && data.notification) {
            const incoming: RosterNotification = data.notification;

            // Idempotent deduplication check
            setNotifications((prev) => {
              const alreadyExists = prev.some((n) => n.id === incoming.id);
              if (alreadyExists) return prev;
              return [incoming, ...prev];
            });

            setLatestAlert(incoming);
            playRosterNotificationSound();

            if (onNotificationReceived) {
              onNotificationReceived(incoming);
            }
          }
        } catch {
          // Ignore parse errors
        }
      };

      ws.onclose = () => {
        setStatus('disconnected');
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

        // Reconnect with exponential backoff (1s, 2s, 4s, up to 10s max)
        const delay = Math.min(1000 * Math.pow(1.5, reconnectAttemptsRef.current), 10000);
        reconnectAttemptsRef.current += 1;

        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      };

      ws.onerror = () => {
        setStatus('error');
      };
    } catch {
      setStatus('error');
    }
  }, [enabled, memberId, memberName, onNotificationReceived]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (socketRef.current) {
        try {
          socketRef.current.close();
        } catch {}
      }
    };
  }, [connect]);

  // Mark single notification as read
  const markAsRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'mark_read', notificationId: id }));
    }

    try {
      await fetch('/api/roster/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
    } catch {}
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'mark_read', all: true }));
    }

    try {
      await fetch('/api/roster/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true, memberId }),
      });
    } catch {}
  }, [memberId]);

  const clearLatestAlert = useCallback(() => {
    setLatestAlert(null);
  }, []);

  // Dispatch a real-time notification to the server (broadcasts to all active clients)
  const notifyRosterUpdate = useCallback(
    async (params: {
      type: 'ROSTER_ASSIGNED' | 'ROSTER_UPDATED' | 'ROSTER_SUBSTITUTED' | 'ROSTER_CONFIRMED';
      memberId: string;
      memberName: string;
      dutyId: string;
      serviceName: string;
      date: string;
      department: string;
      roleTitle: string;
      reportTime: string;
      notes?: string;
      message?: string;
    }) => {
      try {
        const res = await fetch('/api/roster/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        });
        if (res.ok) {
          const data = await res.json();
          return data.notification;
        }
      } catch (err) {
        console.warn('Failed to dispatch roster notification:', err);
      }
      return null;
    },
    []
  );

  // Test simulator trigger: sends a real-time test duty assignment to this member
  const simulateDutyAlert = useCallback(
    async (customRole?: string, customService?: string) => {
      if (!memberId) return null;
      try {
        const res = await fetch('/api/roster/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberId,
            memberName,
            roleTitle: customRole,
            serviceName: customService,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          return data.notification;
        }
      } catch (err) {
        console.warn('Simulation error:', err);
      }
      return null;
    },
    [memberId, memberName]
  );

  return {
    status,
    notifications,
    unreadCount,
    latestAlert,
    clearLatestAlert,
    markAsRead,
    markAllAsRead,
    notifyRosterUpdate,
    simulateDutyAlert,
    reconnect: connect,
  };
}
