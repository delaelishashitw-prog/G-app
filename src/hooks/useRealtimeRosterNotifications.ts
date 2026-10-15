import { getSupabaseClient } from '../lib/supabase';
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

export function useRealtimeRosterNotifications({memberId,memberName,enabled=true,onNotificationReceived}:UseRealtimeRosterOptions) {
  const [status,setStatus]=useState<ConnectionStatus>('disconnected');
  const [notifications,setNotifications]=useState<RosterNotification[]>([]);
  const [latestAlert,setLatestAlert]=useState<RosterNotification|null>(null);
  const callback=useRef(onNotificationReceived);callback.current=onNotificationReceived;
  const refreshRef=useRef<()=>Promise<void>>(async()=>{});
  useEffect(()=>{
    setNotifications([]);setLatestAlert(null);
    const client=getSupabaseClient();
    if(!enabled||!memberId||!client){setStatus('disconnected');return;}
    let alive=true;let initialized=false;const seen=new Set<string>();
    const load=async()=>{
      setStatus(previous=>previous==='connected'?previous:'connecting');
      const {data,error}=await client.from('roster_notifications').select('*').eq('member_id',memberId).order('created_at',{ascending:false}).limit(100);
      if(!alive)return;
      if(error){setStatus('error');return;}
      const rows:RosterNotification[]=(data||[]).map(row=>({...row.payload,id:row.id,type:row.type,memberId:row.member_id,dutyId:row.duty_id,timestamp:row.created_at,read:Boolean(row.read_at)}));
      const incoming=rows.filter(row=>!seen.has(row.id));
      rows.forEach(row=>seen.add(row.id));setNotifications(rows);setStatus('connected');
      if(initialized && incoming.length){setLatestAlert(incoming[0]);playRosterNotificationSound();callback.current?.(incoming[0]);}
      initialized=true;
    };
    refreshRef.current=load;void load();
    // Realtime improves latency; polling keeps the serverless deployment functional without it.
    const channel=client.channel(`roster-notifications-${memberId}`).on('postgres_changes',
      {event:'*',schema:'public',table:'roster_notifications',filter:`member_id=eq.${memberId}`},()=>void load()).subscribe();
    const interval=setInterval(()=>void load(),30000);
    return()=>{alive=false;clearInterval(interval);void client.removeChannel(channel);};
  },[enabled,memberId]);
  const mark=useCallback(async(id:string)=>{
    const client=getSupabaseClient();if(!client)return;
    const {error}=await client.rpc('gwcc_member_action',{p_action:'notification_read',p_id:id,p_data:{}});
    if(error){setStatus('error');return;}
    setNotifications(prev=>prev.map(row=>id==='all'||row.id===id?{...row,read:true}:row));
  },[]);
  const simulateDutyAlert=useCallback(async(customRole?:string,customService?:string)=>{
    if(!memberId)return null;
    const preview:RosterNotification={id:crypto.randomUUID(),type:'ROSTER_ASSIGNED',memberId,memberName:memberName||'',dutyId:'preview',serviceName:customService||'Preview service',date:new Date().toISOString().slice(0,10),department:'Preview',roleTitle:customRole||'Preview duty',reportTime:'08:00',message:'Preview only: no duty was assigned or message sent.',timestamp:new Date().toISOString(),read:true};
    setLatestAlert(preview);return preview;
  },[memberId,memberName]);
  return {status,notifications,unreadCount:notifications.filter(row=>!row.read).length,latestAlert,
    clearLatestAlert:()=>setLatestAlert(null),markAsRead:mark,markAllAsRead:()=>mark('all'),
    simulateDutyAlert,reconnect:()=>refreshRef.current()};
}
