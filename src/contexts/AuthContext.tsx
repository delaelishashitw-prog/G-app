import {createClient} from '@supabase/supabase-js';
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Member, UserProfile, UserRole } from '../types/database.types';
import { getSupabaseClient, getStoredSupabaseConfig, clearPrivateCache, setSyncIdentity } from '../lib/supabase';
import { readVerifiedProfile, GUEST_PROFILE, clearLegacyCredentials } from '../lib/authPolicy';
import {readSecurityStatus, type SecurityStatus} from '../lib/mfa';
import { apiRequest } from '../lib/apiClient';
import {authRequestError,isTemporaryAuthFailure,unexpiredVerifiedSession,verifiedSessionExpiresAt} from '../lib/authConnectivity';
import { MEMBER_DIRECTORY_COLUMNS, memberForRole } from '../lib/memberPrivacy';

interface AuthContextType {
  currentUser: UserProfile;
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  availableUsers: UserProfile[];
  switchUser: (userId: string) => void;
  isSimulating: boolean;
  impersonatingAdmin: UserProfile | null;
  startSimulation: (userId: string) => boolean;
  exitSimulation: () => void;
  canAccess: (module: string) => boolean;
  hasRole: (roles: UserRole[]) => boolean;
  isAuthenticated: boolean;
  securityStatus: SecurityStatus | null;
  connectionNotice: string;
  refreshSecurity: () => Promise<void>;
  session: Session | null;
  isAuthLoading: boolean;
  currentMember: Member | null;
  isMemberPortalUser: boolean;
  login: (email: string, password?: string) => Promise<{ success: boolean; message: string }>;
  loginAsMember: (identifier: string, pinOrPassword?: string) => Promise<{ success: boolean; message: string; member?: Member }>;
  setPortalMember: (member: Member | null) => void;
  register: (userData: {
    email: string;
    password?: string;
    first_name: string;
    last_name: string;
    role: UserRole;
    phone?: string;
    department?: string;
  }) => Promise<{ success: boolean; message: string }>;
  createUser: (userData: {
    email?: string;
    password?: string;
    first_name: string;
    last_name: string;
    role: UserRole;
    phone?: string;
    department?: string;
    job_title?: string;
    employment_type?: 'full_time' | 'part_time' | 'volunteer' | 'contract';
    avatar_url?: string;
    has_login_account?: boolean;
    member_id?: string;
  }) => Promise<{ success: boolean; message: string; user?: UserProfile }>;
  resetPassword: (email: string) => Promise<{ success: boolean; message: string }>;
  setTemporaryPassword: (email: string, tempPass: string) => Promise<{ success: boolean; message: string }>;
  changePassword: (newPassword: string, oldPassword?: string) => Promise<{ success: boolean; message: string }>;
  quickLoginAs: (user: UserProfile) => void;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  updateUser: (userId: string, updates: Partial<UserProfile>) => Promise<{ success: boolean; message: string }>;
  deleteUser: (userId: string) => Promise<boolean>;
  toggleUserStatus: (userId: string) => Promise<{ success: boolean; message: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  super_admin: [
    'dashboard',
    'ai_assistant',
    'tasks',
    'members',
    'visitors',
    'attendance',
    'services',
    'finance',
    'welfare',
    'giving',
    'pledges',
    'ministries',
    'small_groups',
    'events',
    'pastoral_care',
    'prayer_requests',
    'communication',
    'reports',
    'users',
    'settings',
    'audit_logs',
  ],
  senior_pastor: [
    'dashboard',
    'ai_assistant',
    'tasks',
    'members',
    'visitors',
    'attendance',
    'services',
    'finance',
    'welfare',
    'giving',
    'pledges',
    'ministries',
    'small_groups',
    'events',
    'pastoral_care',
    'prayer_requests',
    'communication',
    'reports',
    'users',
    'settings',
    'audit_logs',
  ],
  administrator: [
    'dashboard',
    'ai_assistant',
    'tasks',
    'members',
    'visitors',
    'attendance',
    'services',
    'welfare',
    'ministries',
    'small_groups',
    'events',
    'communication',
    'reports',
    'users',
    'settings',
    'audit_logs',
  ],
  welfare_officer: ['welfare'],
  finance_officer: [
    'dashboard',
    'ai_assistant',
    'tasks',
    'members', // Read-only view for linking donors
    'finance',
    'welfare',
    'giving',
    'pledges',
    'reports',
    'audit_logs',
  ],
  pastor: [
    'dashboard',
    'ai_assistant',
    'tasks',
    'members',
    'visitors',
    'attendance',
    'welfare',
    'ministries',
    'small_groups',
    'events',
    'pastoral_care',
    'prayer_requests',
    'communication',
  ],
  ministry_leader: [
    'dashboard',
    'ai_assistant',
    'tasks',
    'members',
    'attendance',
    'ministries',
    'events',
    'communication',
  ],
  attendance_officer: [
    'dashboard',
    'ai_assistant',
    'tasks',
    'attendance',
    'services',
    'members', // For check-in verification
    'visitors',
  ],
  data_entry: [
    'dashboard',
    'ai_assistant',
    'tasks',
    'members',
    'visitors',
    'attendance',
  ],
  member: [
    'member_portal',
  ],
};


// Retained for presentation compatibility. Names/emails never establish privileges.
export const isElishaRichard = (user?: Partial<UserProfile> | null, _email?: string): boolean => user?.role === 'super_admin';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile>(GUEST_PROFILE);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [securityStatus,setSecurityStatus]=useState<SecurityStatus|null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [currentMember, setCurrentMember] = useState<Member | null>(null);
  const generation = useRef(0);
  const validatedToken=useRef<string|null>(null);
  const verifiedIdentity=useRef<{session:Session;profile:UserProfile}|null>(null);
  const [connectionNotice,setConnectionNotice]=useState('');
  const isAuthenticated = Boolean(session && currentUser.id && currentUser.is_active && securityStatus?.satisfied);

  const resetIdentity = useCallback(() => {
    generation.current++;validatedToken.current=null;verifiedIdentity.current=null;setConnectionNotice('');setIsAuthLoading(false);
    setSession(null); setSecurityStatus(null); setCurrentUser(GUEST_PROFILE); setCurrentMember(null); setUsersList([]);
    clearLegacyCredentials();
    clearPrivateCache();
  }, []);

  const hydrate = useCallback(async (nextSession: Session | null) => {
    const ticket = ++generation.current;
    const client = getSupabaseClient();
    if (!client || !nextSession) { resetIdentity(); setIsAuthLoading(false); return; }
    if(!verifiedIdentity.current)setIsAuthLoading(true);
    try {
      const { data: { user }, error } = await client.auth.getUser(nextSession.access_token);
      if(error)throw error;
      if(!user)throw new Error('Your session has expired. Please sign in again.');
      const profile = await readVerifiedProfile(client,user);
      const security = await readSecurityStatus(client,profile.role);
      let directory:UserProfile[]=[profile];
      let member:Member|null=null;
      if(security.satisfied){
        if(['super_admin','senior_pastor','administrator'].includes(profile.role)){
          const {data,error:directoryError}=await client.from('profiles').select('*').order('first_name');
          if(!directoryError&&data)directory=data;
        }
        if(profile.role==='member'){
          const {data,error:memberError,status}=await client.from('members').select(MEMBER_DIRECTORY_COLUMNS).eq('auth_user_id',user.id).maybeSingle();
          if(memberError)throw authRequestError(memberError,status);
          member=data?memberForRole(data as unknown as Member,profile.role):null;
        }
      }
      if(ticket!==generation.current)return;
      const previousId=sessionStorage.getItem('gwcc_cache_owner');
      if(previousId&&previousId!==profile.id)clearPrivateCache(previousId);
      sessionStorage.setItem('gwcc_cache_owner',profile.id);
      if(!security.satisfied)clearPrivateCache(profile.id);
      await setSyncIdentity(security.satisfied?profile.id:null,security.satisfied?profile.role:null);
      if(ticket!==generation.current)return;
      validatedToken.current=nextSession.access_token;
      verifiedIdentity.current=security.satisfied?{session:nextSession,profile}:null;
      setSession(nextSession);setCurrentUser(profile);setSecurityStatus(security);
      setUsersList(directory);setCurrentMember(member);setConnectionNotice('');
    } catch(error){
      if(ticket===generation.current){
        const previous=verifiedIdentity.current;
        if(isTemporaryAuthFailure(error)&&previous&&previous.profile.id===nextSession.user.id&&unexpiredVerifiedSession(previous.session)){
          setConnectionNotice('Connection interrupted. Previously verified records remain available; cloud confirmation requires reconnection.');
          return;
        }
        resetIdentity();
      }
      throw error;
    } finally {if(ticket===generation.current)setIsAuthLoading(false);}
  }, [resetIdentity]);

  useEffect(() => {
    clearLegacyCredentials();
    const client = getSupabaseClient();
    if (!client) { setIsAuthLoading(false); return; }
    let alive = true;
    client.auth.getSession().then(({ data, error }) => {
      if (alive) hydrate(error ? null : data.session).catch(() => {});
    }).catch(() => { if (alive) { resetIdentity(); setIsAuthLoading(false); } });
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, nextSession) => {
      if(_event==='SIGNED_IN' && nextSession?.access_token!==validatedToken.current){
        generation.current++;verifiedIdentity.current=null;setConnectionNotice('');setSecurityStatus(null);setIsAuthLoading(true);clearPrivateCache();
      }
      // Supabase holds an auth lock while dispatching this callback. Do DB work afterwards.
      queueMicrotask(() => { if (alive) hydrate(nextSession).catch(() => {}); });
    });
    return () => { alive = false; generation.current++; subscription.unsubscribe(); };
  }, [hydrate, resetIdentity]);

  useEffect(() => {
    if (!session || !currentUser.id) return;
    const client = getSupabaseClient();
    if (!client) return;
    const refresh = () => {
      client.auth.getSession().then(({data,error})=>error?hydrate(session):hydrate(data.session)).catch(()=>{});
    };
    const timer = window.setInterval(refresh, 60000);
    const onFocus = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('online',refresh);
    const channel = client.channel(`profile-${currentUser.id}`).on('postgres_changes',
      { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${currentUser.id}` }, refresh).subscribe();
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onFocus);window.removeEventListener('online',refresh);client.removeChannel(channel); };
  }, [session?.access_token, currentUser.id, hydrate]);

  useEffect(()=>{
    const deadline=verifiedSessionExpiresAt(session);
    if(!deadline)return;
    const timer=window.setTimeout(()=>{if(!unexpiredVerifiedSession(verifiedIdentity.current?.session||null))resetIdentity();},Math.max(0,Math.min(2147483647,deadline-Date.now())));
    return()=>window.clearTimeout(timer);
  },[session?.access_token,resetIdentity]);

  const login = async (email: string, password?: string, memberOnly = false) => {
    const client = getSupabaseClient();
    if (!client) return { success: false, message: 'Secure sign-in is not configured. Set the Supabase environment variables.' };
    if (!email.trim() || !password) return { success: false, message: 'Enter your email address and password.' };
    try {
      const { data, error } = await client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error || !data.session) throw new Error(error?.message || 'Sign-in failed.');
      if (memberOnly) {
        const { data: verified, error: userError } = await client.auth.getUser(data.session.access_token);
        if (userError || !verified.user) throw new Error('Your session could not be verified. Please sign in again.');
        const profile = await readVerifiedProfile(client, verified.user);
        if (profile.role !== 'member') throw new Error('This is a staff account. Use Staff Login to access the church system.');
        const security=await readSecurityStatus(client,profile.role);
        if(security.satisfied){
          const { data: linked, error: linkError } = await client.from('members').select('id').eq('auth_user_id', verified.user.id).maybeSingle();
          if (linkError) throw new Error('Your member account could not be checked. Please try again.');
          if (!linked) throw new Error('Your login is not linked to a member record yet. Ask the church office to open your member profile and link Portal Access.');
        }
      }
      await hydrate(data.session);
      return { success: true, message: 'Signed in securely.' };
    } catch (error) {
      resetIdentity();
      await client.auth.signOut({ scope: 'local' }).catch(() => {});
      return { success: false, message: error instanceof Error ? error.message : 'Sign-in failed.' };
    }
  };

  const loginAsMember = async (identifier: string, password?: string) => {
    if (!identifier.includes('@')) return { success: false, message: 'Sign in with your verified email address and password. Contact the church office if you need an account.' };
    const result = await login(identifier, password, true);
    return result;
  };

  const register: AuthContextType['register'] = async () => ({ success: false, message: 'Staff access is invitation-only. Ask the church administrator to create your account.' });
  const refreshSession = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client) return;
    const { data, error } = await client.auth.refreshSession();
    if (error) {
      if(isTemporaryAuthFailure(error)&&unexpiredVerifiedSession(verifiedIdentity.current?.session||null)){setConnectionNotice('Connection interrupted. Previously verified records remain available; cloud confirmation requires reconnection.');return;}
      resetIdentity(); return;
    }
    await hydrate(data.session).catch(() => {});
  }, [hydrate, resetIdentity]);

  const refreshSecurity=useCallback(async()=>{
    const client=getSupabaseClient();if(!client)throw new Error('Secure sign-in is unavailable.');
    const {data,error}=await client.auth.getSession();
    if(error || !data.session)throw new Error('Please sign in again.');
    await hydrate(data.session);
  },[hydrate]);

  const createUser: AuthContextType['createUser'] = async (input) => {
    try {
      const result = await apiRequest('/api/staff', { action: 'create', ...input });
      if (result.user) setUsersList(prev => [result.user, ...prev.filter(u => u.id !== result.user.id)]);
      return { success: true, message: result.message, user: result.user };
    } catch (error) { return { success: false, message: String((error as Error).message) }; }
  };
  const updateUser: AuthContextType['updateUser'] = async (id, updates) => {
    try {
      const result = await apiRequest('/api/staff', { action: 'update', id, updates });
      setUsersList(prev => prev.map(u => u.id === id ? result.user : u));
      if (id === currentUser.id) await refreshSession();
      return { success: true, message: 'Staff record updated.' };
    } catch (error) { return { success: false, message: (error as Error).message }; }
  };
  const toggleUserStatus: AuthContextType['toggleUserStatus'] = async id => {
    const target = usersList.find(u => u.id === id);
    if (!target) return { success: false, message: 'Staff account not found.' };
    return updateUser(id, { is_active: !target.is_active });
  };
  const deleteUser: AuthContextType['deleteUser'] = async id => {
    try { await apiRequest('/api/staff', { action: 'archive', id }); setUsersList(prev => prev.filter(u => u.id !== id)); return true; }
    catch { return false; }
  };
  const resetPassword = async (email: string) => {
    const client = getSupabaseClient();
    if (!client) return { success: false, message: 'Secure sign-in is not configured.' };
    const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/password` });
    return { success: !error, message: error?.message || 'If this account exists, password reset instructions have been requested.' };
  };
  const setTemporaryPassword = async (email: string, password: string) => {
    try { await apiRequest('/api/staff', { action: 'reset_password', email, password }); return { success: true, message: 'The temporary password was set in the authentication service. Share it privately with the staff member.' }; }
    catch (error) { return { success: false, message: (error as Error).message }; }
  };
  const changePassword = async (password: string,oldPassword?:string) => {
    const client = getSupabaseClient();
    if (!client || !session) return { success: false, message: 'Please sign in again.' };
    if (password.length < 12) return { success: false, message: 'Use at least 12 characters.' };
    if(oldPassword){
      // Verify without replacing the active, MFA-verified session with AAL1.
      const config=getStoredSupabaseConfig();
      const verifier=createClient(config.url,config.anonKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:`gwcc-password-check-${generation.current}`}});
      const {error}=await verifier.auth.signInWithPassword({email:currentUser.email,password:oldPassword});
      if(error)return {success:false,message:'Your current password was not accepted.'};
      await verifier.auth.signOut({scope:'local'}).catch(()=>{});
    }
    const { error } = await client.auth.updateUser({ password });
    return { success: !error, message: error?.message || 'Password updated securely.' };
  };
  const logout = async () => {
    generation.current++;
    const client = getSupabaseClient();
    resetIdentity();
    // Local identity is cleared even if the network is unavailable.
    if (client) await client.auth.signOut({ scope: 'local' }).catch(() => {});
  };
  const canAccess = (module: string) => isAuthenticated && (ROLE_PERMISSIONS[currentUser.role] || []).includes(module);
  const hasRole = (roles: UserRole[]) => isAuthenticated && (currentUser.role === 'super_admin' || roles.includes(currentUser.role));
  const setPortalMember = (member: Member | null) => {
    if (!member) { setCurrentMember(null); return; }
    if (member.auth_user_id === currentUser.id || hasRole(['senior_pastor', 'administrator'])) setCurrentMember(member);
  };
  const contextValue: AuthContextType = {
    currentUser, currentRole: currentUser.role, availableUsers: usersList, isAuthenticated, session, isAuthLoading,
    securityStatus,connectionNotice,refreshSecurity, currentMember, isMemberPortalUser: currentUser.role === 'member', login, loginAsMember, register, createUser,
    updateUser, deleteUser, toggleUserStatus, resetPassword, setTemporaryPassword, changePassword, logout, refreshSession,
    setPortalMember, canAccess, hasRole,
    // Identity simulation is intentionally unavailable for a real authenticated session.
    isSimulating: false, impersonatingAdmin: null, startSimulation: () => false, exitSimulation: () => {},
    setCurrentRole: () => {}, switchUser: () => {}, quickLoginAs: () => {},
  };
  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
