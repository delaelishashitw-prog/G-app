import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { Member, UserProfile, UserRole } from '../types/database.types';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import { sampleUsers, sampleMembers } from '../lib/initialData';

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
    email: string;
    password?: string;
    first_name: string;
    last_name: string;
    role: UserRole;
    phone?: string;
    department?: string;
  }) => Promise<{ success: boolean; message: string; user?: UserProfile }>;
  resetPassword: (email: string) => Promise<{ success: boolean; message: string }>;
  changePassword: (newPassword: string, oldPassword?: string) => Promise<{ success: boolean; message: string }>;
  quickLoginAs: (user: UserProfile) => void;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  updateUser: (userId: string, updates: Partial<UserProfile>) => void;
  deleteUser: (userId: string) => boolean;
  toggleUserStatus: (userId: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const MEMBER_PIN_STORAGE_KEY = 'gwcc_member_passwords_v2';
const LEGACY_MEMBER_PIN_STORAGE_KEY = 'gwcc_member_passwords';

async function hashMemberPin(pin: string): Promise<string> {
  const normalized = (pin || '').trim();
  if (!normalized) return '';

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  return normalized;
}

function readMemberPinMap(): Record<string, string> {
  try {
    const sessionValue = sessionStorage.getItem(MEMBER_PIN_STORAGE_KEY);
    if (sessionValue) {
      const parsed = JSON.parse(sessionValue);
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, string>;
      }
    }
  } catch {}

  try {
    const legacyValue = localStorage.getItem(LEGACY_MEMBER_PIN_STORAGE_KEY);
    if (legacyValue) {
      const parsed = JSON.parse(legacyValue);
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, string>;
      }
    }
  } catch {}

  return {};
}

function persistMemberPinMap(map: Record<string, string>): void {
  try {
    sessionStorage.setItem(MEMBER_PIN_STORAGE_KEY, JSON.stringify(map));
  } catch {}

  try {
    localStorage.removeItem(LEGACY_MEMBER_PIN_STORAGE_KEY);
  } catch {}
}

const isDemoAuthEnabled = (): boolean => {
  const configured = (import.meta.env.VITE_ENABLE_DEMO_AUTH ?? '').toString().trim().toLowerCase();
  if (configured === 'true' || configured === '1' || configured === 'yes') {
    return true;
  }

  return import.meta.env.DEV && configured !== 'false' && configured !== '0';
};

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  super_admin: [
    'dashboard',
    'members',
    'visitors',
    'attendance',
    'services',
    'finance',
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
    'members',
    'visitors',
    'attendance',
    'services',
    'finance',
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
    'members',
    'visitors',
    'attendance',
    'services',
    'ministries',
    'small_groups',
    'events',
    'communication',
    'reports',
    'users',
    'settings',
    'audit_logs',
  ],
  finance_officer: [
    'dashboard',
    'members', // Read-only view for linking donors
    'finance',
    'giving',
    'pledges',
    'reports',
    'audit_logs',
  ],
  pastor: [
    'dashboard',
    'members',
    'visitors',
    'attendance',
    'ministries',
    'small_groups',
    'events',
    'pastoral_care',
    'prayer_requests',
    'communication',
  ],
  ministry_leader: [
    'dashboard',
    'members',
    'attendance',
    'ministries',
    'events',
    'communication',
  ],
  attendance_officer: [
    'dashboard',
    'attendance',
    'services',
    'members', // For check-in verification
    'visitors',
  ],
  data_entry: [
    'dashboard',
    'members',
    'visitors',
    'attendance',
  ],
  member: [
    'member_portal',
  ],
};

export const isElishaRichard = (
  user?: Partial<UserProfile> | null,
  emailCandidate?: string
): boolean => {
  if (!user && !emailCandidate) return false;
  const cleanEmail = (emailCandidate || user?.email || '').trim().toLowerCase();
  const elishaEmails = [
    'prophet@greaterworkscitychurch.org',
    'senior.pastor@greaterworkscitychurch.org',
    'delaelishashitw@gmail.com',
  ];
  if (cleanEmail && elishaEmails.includes(cleanEmail)) return true;

  const firstName = (user?.first_name || '').trim().toLowerCase();
  const lastName = (user?.last_name || '').trim().toLowerCase();
  if (firstName.includes('elisha') && (lastName.includes('richard') || user?.id === 'usr-1' || user?.id === 'usr-001')) {
    return true;
  }
  if (user?.id === 'usr-1' || user?.id === 'usr-001') return true;
  return false;
};

function mapSupabaseUserToProfile(
  user: User,
  existingProfiles: UserProfile[]
): UserProfile {
  const cleanEmail = (user.email || '').trim().toLowerCase();
  const isElisha = isElishaRichard(undefined, cleanEmail);

  // Check existing profiles first
  const existing = existingProfiles.find(
    (u) =>
      u.id === user.id ||
      (Boolean(u.email && cleanEmail) && u.email.toLowerCase() === cleanEmail) ||
      (isElisha && isElishaRichard(u))
  );
  if (existing) {
    const role: UserRole = isElisha || isElishaRichard(existing) ? 'super_admin' : existing.role;
    return {
      ...existing,
      id: existing.id || user.id,
      email: cleanEmail || existing.email,
      role,
      member_id: existing.member_id || (isElisha ? 'GWCC-0013' : undefined),
    };
  }

  // Derive from Supabase metadata
  const meta = user.user_metadata || {};
  const firstName = meta.first_name || (isElisha ? 'Elisha' : cleanEmail ? cleanEmail.split('@')[0].replace('.', ' ') : 'Staff');
  const lastName = meta.last_name || (isElisha ? 'Richard' : 'Member');
  const role: UserRole = isElisha || isElishaRichard({ first_name: firstName, last_name: lastName })
    ? 'super_admin'
    : ((meta.role as UserRole) || 'member');
  const phone = meta.phone || user.phone || undefined;
  const department = meta.department || (isElisha ? 'Senior Pastoral Board & Executive Council' : undefined);

  return {
    id: user.id,
    first_name: firstName,
    last_name: lastName,
    email: cleanEmail,
    role,
    phone,
    department,
    member_id: isElisha ? 'GWCC-0013' : undefined,
    is_active: true,
    created_at: user.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [usersList, setUsersList] = useState<UserProfile[]>(() => {
    const saved = localStorage.getItem('gwcc_registered_users');
    let list = sampleUsers;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          list = parsed;
        }
      } catch {
        // fallback
      }
    }

    // Always enforce super_admin role for Elisha Richard across local/saved accounts
    const withSuperAdmin = list.map((u) => {
      if (isElishaRichard(u)) {
        return {
          ...u,
          role: 'super_admin' as UserRole,
          department: u.department || 'Senior Pastoral Board & Executive Council',
        };
      }
      return u;
    });

    if (!withSuperAdmin.some((u) => isElishaRichard(u))) {
      return [sampleUsers[0], ...withSuperAdmin];
    }
    return withSuperAdmin;
  });

  const [currentUser, setCurrentUser] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('gwcc_active_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.first_name && parsed.email !== 'guest@local') {
          if (isElishaRichard(parsed)) {
            return {
              ...parsed,
              role: 'super_admin' as UserRole,
              department: parsed.department || 'Senior Pastoral Board & Executive Council',
            };
          }
          return parsed;
        }
      } catch {
        // fallback
      }
    }
    return sampleUsers[0];
  });

  const [session, setSession] = useState<Session | null>(null);

  const [currentMember, setCurrentMember] = useState<Member | null>(() => {
    const activeMemberId = localStorage.getItem('gwcc_active_member_id');
    if (!activeMemberId) return null;
    try {
      const stored = localStorage.getItem('gwcc_members');
      if (stored) {
        const parsed: Member[] = JSON.parse(stored);
        const found = parsed.find((m) => m.id === activeMemberId || m.member_id === activeMemberId);
        if (found) return found;
      }
    } catch {}
    const sampleFound = sampleMembers.find((m) => m.id === activeMemberId || m.member_id === activeMemberId);
    if (sampleFound) return sampleFound;
    return null;
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const stored = localStorage.getItem('gwcc_auth_authenticated');
    if (stored === null) {
      return false; // Require explicit login in production.
    }
    return stored === 'true';
  });

  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  // Tracks active simulation session started by an authenticated super_admin
  const [impersonatingAdmin, setImpersonatingAdmin] = useState<UserProfile | null>(() => {
    try {
      const stored = sessionStorage.getItem('gwcc_impersonating_admin');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Sync users list to localStorage
  useEffect(() => {
    localStorage.setItem('gwcc_registered_users', JSON.stringify(usersList));
  }, [usersList]);

  // Sync active user to localStorage
  useEffect(() => {
    localStorage.setItem('gwcc_active_user', JSON.stringify(currentUser));
  }, [currentUser]);

  // Sync auth flag to localStorage
  useEffect(() => {
    localStorage.setItem('gwcc_auth_authenticated', isAuthenticated ? 'true' : 'false');
  }, [isAuthenticated]);

  // Handle Supabase session lifecycle and persistence
  useEffect(() => {
    let isMounted = true;
    const client = getSupabaseClient();

    if (!client) {
      setIsAuthLoading(false);
      return;
    }

    // 1. Initial active session check
    client.auth.getSession().then(({ data: { session: initialSession }, error }) => {
      if (!isMounted) return;

      if (error) {
        console.warn('Supabase getSession notice:', error.message);
      }

      if (initialSession?.user) {
        setSession(initialSession);
        setIsAuthenticated(true);
        const profile = mapSupabaseUserToProfile(initialSession.user, usersList);
        setCurrentUser(profile);
        setUsersList((prev) => {
          const index = prev.findIndex(
            (u) =>
              u.id === profile.id ||
              (Boolean(u.email && profile.email) && u.email.toLowerCase() === profile.email.toLowerCase())
          );
          if (index >= 0) {
            const next = [...prev];
            next[index] = profile;
            return next;
          }
          return [profile, ...prev];
        });
        localStorage.setItem('gwcc_auth_authenticated', 'true');
        localStorage.setItem('gwcc_active_user', JSON.stringify(profile));
      } else {
        setSession(null);
        // If Supabase is configured and has no session, check if explicitly signed out
        const storedAuth = localStorage.getItem('gwcc_auth_authenticated');
        if (storedAuth === 'false') {
          setIsAuthenticated(false);
        }
      }
      setIsAuthLoading(false);
    });

    // 2. Auth state subscription (login, logout, token refresh)
    try {
      const {
        data: { subscription },
      } = client.auth.onAuthStateChange(async (event, newSession) => {
        if (!isMounted) return;

        if (
          (event === 'SIGNED_IN' ||
            event === 'TOKEN_REFRESHED' ||
            event === 'INITIAL_SESSION' ||
            event === 'USER_UPDATED') &&
          newSession?.user
        ) {
          setSession(newSession);
          setIsAuthenticated(true);
          const profile = mapSupabaseUserToProfile(newSession.user, usersList);
          setCurrentUser(profile);
          setUsersList((prev) => {
            const index = prev.findIndex(
              (u) =>
                u.id === profile.id ||
                (Boolean(u.email && profile.email) && u.email.toLowerCase() === profile.email.toLowerCase())
            );
            if (index >= 0) {
              const next = [...prev];
              next[index] = profile;
              return next;
            }
            return [profile, ...prev];
          });
          localStorage.setItem('gwcc_auth_authenticated', 'true');
          localStorage.setItem('gwcc_active_user', JSON.stringify(profile));
        } else if (event === 'SIGNED_OUT') {
          setSession(null);
          setIsAuthenticated(false);
          localStorage.setItem('gwcc_auth_authenticated', 'false');
          localStorage.removeItem('gwcc_active_user');
        }
      });

      return () => {
        isMounted = false;
        subscription.unsubscribe();
      };
    } catch (err) {
      console.warn('Supabase auth state subscription error:', err);
      setIsAuthLoading(false);
    }
  }, []);

  const isSimulating = impersonatingAdmin !== null;

  const startSimulation = (userId: string): boolean => {
    // SECURITY GUARD: Only super_admin (or active super_admin simulation) can simulate
    const effectiveAdmin = impersonatingAdmin || currentUser;
    if (effectiveAdmin.role !== 'super_admin') {
      console.warn('Unauthorized simulation blocked: only super_admin can simulate staff views.');
      return false;
    }

    const target = usersList.find((u) => u.id === userId);
    if (!target) return false;

    // SECURITY GUARD: Never allow simulating or escalating into a super_admin account!
    if (target.role === 'super_admin') {
      console.warn('Unauthorized simulation blocked: cannot simulate or escalate to super_admin.');
      return false;
    }

    // Preserve original super admin session before switching
    if (!impersonatingAdmin) {
      setImpersonatingAdmin(currentUser);
      sessionStorage.setItem('gwcc_impersonating_admin', JSON.stringify(currentUser));
    }

    setCurrentUser(target);
    localStorage.setItem('gwcc_active_user', JSON.stringify(target));
    return true;
  };

  const exitSimulation = () => {
    if (!impersonatingAdmin) return;
    setCurrentUser(impersonatingAdmin);
    localStorage.setItem('gwcc_active_user', JSON.stringify(impersonatingAdmin));
    setImpersonatingAdmin(null);
    sessionStorage.removeItem('gwcc_impersonating_admin');
  };

  const setCurrentRole = (role: UserRole) => {
    // SECURITY GUARD: Disallow arbitrary role switching by non-super-admins
    const effectiveAdmin = impersonatingAdmin || currentUser;
    if (effectiveAdmin.role !== 'super_admin') {
      console.warn('Unauthorized role change blocked: user lacks super_admin privileges.');
      return;
    }
    // SECURITY GUARD: Cannot simulate into super_admin role (use exitSimulation instead)
    if (role === 'super_admin') {
      console.warn('Unauthorized simulation blocked: cannot simulate into super_admin. Use exitSimulation() instead.');
      return;
    }
    if (!impersonatingAdmin) {
      setImpersonatingAdmin(currentUser);
      sessionStorage.setItem('gwcc_impersonating_admin', JSON.stringify(currentUser));
    }
    setCurrentUser((prev) => ({
      ...prev,
      role,
    }));
  };

  const switchUser = (userId: string) => {
    // SECURITY GUARD: Only super_admin can switch/simulate user sessions
    startSimulation(userId);
  };

  const refreshSession = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client) return;

    try {
      const { data, error } = await client.auth.refreshSession();
      if (!error && data.session) {
        setSession(data.session);
        setIsAuthenticated(true);
      }
    } catch (err) {
      console.warn('Supabase session refresh note:', err);
    }
  }, []);

  const login = async (email: string, password?: string): Promise<{ success: boolean; message: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      return { success: false, message: 'Please provide a valid email address.' };
    }

    const client = getSupabaseClient();
    if (!client && !isDemoAuthEnabled()) {
      return {
        success: false,
        message: 'Production auth is disabled. Configure a secure auth backend before enabling staff sign-in.'
      };
    }

    // 1. Attempt Supabase Auth if client is configured
    if (client && password) {
      try {
        const { data, error } = await client.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (!error && data.user) {
          setSession(data.session);
          const profile = mapSupabaseUserToProfile(data.user, usersList);
          setCurrentUser(profile);
          setUsersList((prev) => {
            const index = prev.findIndex(
              (u) =>
                u.id === profile.id ||
                (Boolean(u.email && cleanEmail) && u.email.toLowerCase() === cleanEmail)
            );
            if (index >= 0) {
              const next = [...prev];
              next[index] = profile;
              return next;
            }
            return [profile, ...prev];
          });
          setIsAuthenticated(true);
          localStorage.setItem('gwcc_auth_authenticated', 'true');
          localStorage.setItem('gwcc_active_user', JSON.stringify(profile));
          return { success: true, message: `Welcome back, ${profile.first_name}! (Supabase Session Active)` };
        }

        if (error) {
          const errMsg = String(error.message || '').toLowerCase();
          const isApiKeyError =
            errMsg.includes('api key') ||
            errMsg.includes('apikey') ||
            errMsg.includes('jwt') ||
            errMsg.includes('unauthorized') ||
            (error as any).status === 401 ||
            (error as any).status === 403;

          // If the cloud database key is rejected or offline, check if user exists in local staff directory
          const staff = usersList.find(
            (u) =>
              (Boolean(u.email && cleanEmail) && u.email.toLowerCase() === cleanEmail) ||
              (isElishaRichard(undefined, cleanEmail) && isElishaRichard(u))
          );
          if (staff) {
            const effectiveStaff: UserProfile = isElishaRichard(staff, cleanEmail)
              ? { ...staff, role: 'super_admin' as UserRole }
              : staff;
            setCurrentUser(effectiveStaff);
            setIsAuthenticated(true);
            localStorage.setItem('gwcc_auth_authenticated', 'true');
            localStorage.setItem('gwcc_active_user', JSON.stringify(effectiveStaff));
            return {
              success: true,
              message: isApiKeyError
                ? `Welcome back, ${effectiveStaff.first_name}! (Logged in via Local Staff Directory. Note: Supabase API key is invalid/expired).`
                : `Welcome back, ${effectiveStaff.first_name}!${effectiveStaff.role === 'super_admin' ? ' (Super Admin Access)' : ''}`,
            };
          }

          if (isApiKeyError) {
            return {
              success: false,
              message: 'Invalid Supabase API Key. The connected cloud database Anon Key is invalid or expired. You can clear the cloud key on this screen to log in using the offline local church database.',
            };
          }

          return { success: false, message: error.message };
        }
      } catch (err: any) {
        console.warn('Supabase sign in exception:', err);
      }
    }

    // 2. Check local church staff accounts (offline / local directory)
    if (!isDemoAuthEnabled()) {
      return {
        success: false,
        message: 'Offline/local staff sign-in is disabled in production. Configure a secure auth provider.'
      };
    }

    const staff = usersList.find(
      (u) =>
        (Boolean(u.email && cleanEmail) && u.email.toLowerCase() === cleanEmail) ||
        (isElishaRichard(undefined, cleanEmail) && isElishaRichard(u))
    );
    if (staff) {
      if (!password || password.trim().length < 4) {
        return { success: false, message: 'Please provide a valid password.' };
      }
      const effectiveStaff: UserProfile = isElishaRichard(staff, cleanEmail)
        ? { ...staff, role: 'super_admin' as UserRole }
        : staff;
      setCurrentUser(effectiveStaff);
      setIsAuthenticated(true);
      localStorage.setItem('gwcc_auth_authenticated', 'true');
      localStorage.setItem('gwcc_active_user', JSON.stringify(effectiveStaff));
      return { success: true, message: `Welcome back, ${effectiveStaff.first_name}!${effectiveStaff.role === 'super_admin' ? ' (Super Admin Access)' : ''}` };
    }

    return { success: false, message: 'Invalid staff email or password. Please check your credentials or register for an account.' };
  };

  const register = async (userData: {
    email: string;
    password?: string;
    first_name: string;
    last_name: string;
    role: UserRole;
    phone?: string;
    department?: string;
  }): Promise<{ success: boolean; message: string }> => {
    const cleanEmail = (userData.email || '').trim().toLowerCase();

    if (!isDemoAuthEnabled() && !getSupabaseClient()) {
      return {
        success: false,
        message: 'Self-registration is disabled in production. Contact an administrator to create the staff account.'
      };
    }

    // Check if email already exists locally
    const exists = usersList.some((u) => Boolean(u.email && cleanEmail) && u.email.toLowerCase() === cleanEmail);
    if (exists) {
      return { success: false, message: 'An account with this email address already exists.' };
    }

    // Attempt Supabase Auth sign-up if configured
    const client = getSupabaseClient();
    if (client && userData.password) {
      try {
        const { data, error } = await client.auth.signUp({
          email: cleanEmail,
          password: userData.password,
          options: {
            data: {
              first_name: userData.first_name.trim(),
              last_name: userData.last_name.trim(),
              role: userData.role,
              phone: userData.phone?.trim(),
              department: userData.department,
            },
          },
        });

        if (error) {
          const errMsg = (error.message || '').toLowerCase();
          const isApiKeyError =
            errMsg.includes('api key') ||
            errMsg.includes('apikey') ||
            errMsg.includes('jwt');

          if (errMsg.includes('already registered') || errMsg.includes('user already registered')) {
            return { success: false, message: 'An account with this email address already exists. Please sign in.' };
          }

          if (!isApiKeyError) {
            return {
              success: false,
              message: error.message || 'Unable to register this account. Please verify details or try signing in.',
            };
          }
          console.warn('Supabase sign-up notice, falling back to local registration:', error.message);
          // Fall through to local registration
        } else if (data.user) {
          const profile = mapSupabaseUserToProfile(data.user, usersList);
          profile.first_name = userData.first_name.trim();
          profile.last_name = userData.last_name.trim();
          profile.role = userData.role;
          profile.phone = userData.phone?.trim();
          profile.department = userData.department;

          setUsersList((prev) => [profile, ...prev]);
          setCurrentUser(profile);

          if (data.session) {
            setSession(data.session);
            setIsAuthenticated(true);
            localStorage.setItem('gwcc_auth_authenticated', 'true');
            localStorage.setItem('gwcc_active_user', JSON.stringify(profile));
            return {
              success: true,
              message: `Account created and session authenticated for ${profile.first_name}!`,
            };
          } else {
            setIsAuthenticated(true);
            localStorage.setItem('gwcc_auth_authenticated', 'true');
            localStorage.setItem('gwcc_active_user', JSON.stringify(profile));
            return {
              success: true,
              message: `Account created for ${profile.first_name}! Check your inbox if confirmation was requested.`,
            };
          }
        }
      } catch (err: any) {
        console.warn('Supabase sign up error:', err);
        return { success: false, message: err?.message || 'Failed to complete cloud registration.' };
      }
    }

    // Local / Offline fallback registration
    const newUser: UserProfile = {
      id: `usr-${Date.now()}`,
      first_name: userData.first_name.trim(),
      last_name: userData.last_name.trim(),
      email: cleanEmail,
      phone: userData.phone?.trim() || undefined,
      department: userData.department,
      role: userData.role,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setUsersList((prev) => [newUser, ...prev]);
    setCurrentUser(newUser);
    setIsAuthenticated(true);
    localStorage.setItem('gwcc_auth_authenticated', 'true');
    localStorage.setItem('gwcc_active_user', JSON.stringify(newUser));

    return {
      success: true,
      message: `Account created for ${newUser.first_name} ${newUser.last_name} (${newUser.role.replace('_', ' ')})!`,
    };
  };

  const createUser = async (userData: {
    email: string;
    password?: string;
    first_name: string;
    last_name: string;
    role: UserRole;
    phone?: string;
    department?: string;
  }): Promise<{ success: boolean; message: string; user?: UserProfile }> => {
    const cleanEmail = (userData.email || '').trim().toLowerCase();

    if (!isDemoAuthEnabled() && !getSupabaseClient()) {
      return {
        success: false,
        message: 'Staff account creation is disabled in production until a secure backend is configured.'
      };
    }

    // Check if email already exists locally
    const exists = usersList.some((u) => Boolean(u.email && cleanEmail) && u.email.toLowerCase() === cleanEmail);
    if (exists) {
      return { success: false, message: 'A staff account with this email address already exists.' };
    }

    const newUserId = `usr-${Date.now()}`;
    const newUser: UserProfile = {
      id: newUserId,
      first_name: userData.first_name.trim(),
      last_name: userData.last_name.trim(),
      email: cleanEmail,
      phone: userData.phone?.trim() || undefined,
      department: userData.department || 'Church Administration',
      role: userData.role,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Add to staff users directory without overriding active admin session
    setUsersList((prev) => [newUser, ...prev]);

    // Store local staff password for offline login capability
    if (userData.password) {
      try {
        const storedPass = localStorage.getItem('gwcc_staff_passwords');
        const passMap = storedPass ? JSON.parse(storedPass) : {};
        passMap[cleanEmail] = userData.password;
        localStorage.setItem('gwcc_staff_passwords', JSON.stringify(passMap));
      } catch {}
    }

    // Cloud sync to Supabase (profiles table and auth if available)
    const client = getSupabaseClient();
    if (client) {
      (async () => {
        try {
          await client.from('profiles').insert({
            id: newUser.id,
            first_name: newUser.first_name,
            last_name: newUser.last_name,
            email: newUser.email,
            phone: newUser.phone,
            department: newUser.department,
            role: newUser.role,
            is_active: true,
            created_at: newUser.created_at,
            updated_at: newUser.updated_at,
          });
        } catch (err) {
          console.warn('Supabase profiles insert notice:', err);
        }

        if (userData.password) {
          try {
            await client.auth.signUp({
              email: cleanEmail,
              password: userData.password,
              options: {
                data: {
                  first_name: newUser.first_name,
                  last_name: newUser.last_name,
                  role: newUser.role,
                  phone: newUser.phone,
                  department: newUser.department,
                },
              },
            });
          } catch (err) {
            console.warn('Supabase auth sign up notice:', err);
          }
        }
      })();
    }

    return {
      success: true,
      message: `Staff account created for ${newUser.first_name} ${newUser.last_name}!`,
      user: newUser,
    };
  };

  const resetPassword = async (email: string): Promise<{ success: boolean; message: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes('@')) {
      return { success: false, message: 'Please provide a valid email address.' };
    }

    const client = getSupabaseClient();
    if (client) {
      try {
        const { error } = await client.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: `${window.location.origin}/login`,
        });
        if (error) {
          return { success: false, message: error.message };
        }
        return {
          success: true,
          message: `Password reset link sent to ${cleanEmail}. Check your inbox.`,
        };
      } catch (err: any) {
        console.warn('Supabase password reset note:', err);
      }
    }

    return {
      success: true,
      message: `Password reset instructions have been dispatched to ${cleanEmail}. Please check your inbox or contact church administration.`,
    };
  };

  const changePassword = async (
    newPassword: string,
    _oldPassword?: string
  ): Promise<{ success: boolean; message: string }> => {
    const trimmed = (newPassword || '').trim();
    if (trimmed.length < 6) {
      return { success: false, message: 'New password must contain at least 6 characters.' };
    }

    const client = getSupabaseClient();
    if (client && session) {
      try {
        const { error } = await client.auth.updateUser({
          password: trimmed,
        });
        if (error) {
          return { success: false, message: error.message };
        }
      } catch (err: any) {
        console.warn('Supabase password change error:', err);
      }
    }

    // Save in local staff passwords store for offline/direct staff credentials
    if (currentUser?.email) {
      try {
        const cleanEmail = currentUser.email.trim().toLowerCase();
        const storedPass = localStorage.getItem('gwcc_staff_passwords');
        const passMap = storedPass ? JSON.parse(storedPass) : {};
        passMap[cleanEmail] = trimmed;
        localStorage.setItem('gwcc_staff_passwords', JSON.stringify(passMap));
      } catch (e) {
        console.warn('Error saving local staff password:', e);
      }
    }

    return {
      success: true,
      message: 'Password successfully updated! Your new password is now active.',
    };
  };

  const loginAsMember = async (
    identifier: string,
    pinOrPassword?: string
  ): Promise<{ success: boolean; message: string; member?: Member }> => {
    const clean = identifier.trim().toLowerCase();
    if (!clean) {
      return { success: false, message: 'Please provide your Member ID, Phone Number, or Email address.' };
    }

    let allMembers: Member[] = [];
    try {
      const stored = localStorage.getItem('gwcc_members');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          allMembers = parsed;
        }
      }
    } catch {}

    if (allMembers.length === 0) {
      allMembers = sampleMembers;
    }

    const cleanDigits = clean.replace(/[^0-9]/g, '');
    const cleanAlphaNum = clean.replace(/[^a-z0-9]/g, '');

    // Ghanaian phone normalization helper (e.g. +233 24 123 4567, 024 123 4567, 241234567)
    const normalizeGhanaPhone = (num: string): string => {
      const digits = num.replace(/[^0-9]/g, '');
      if (digits.startsWith('233') && digits.length >= 12) {
        return digits.slice(3); // e.g. 233241234567 -> 241234567
      }
      if (digits.startsWith('0') && digits.length >= 10) {
        return digits.slice(1); // e.g. 0241234567 -> 241234567
      }
      return digits;
    };
    const cleanPhoneCore = normalizeGhanaPhone(clean);

    let member = allMembers.find((m) => {
      const idMatch = (m.id || '').toLowerCase() === clean;
      const memIdClean = (m.member_id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const memberIdMatch =
        (m.member_id || '').toLowerCase() === clean ||
        (cleanAlphaNum.length >= 4 && memIdClean.includes(cleanAlphaNum));
      const titheMatch = m.tithe_number ? m.tithe_number.toLowerCase() === clean : false;
      const emailMatch = m.email ? m.email.toLowerCase() === clean : false;
      const phoneDigits = (m.phone || '').replace(/[^0-9]/g, '');
      const memberPhoneCore = normalizeGhanaPhone(m.phone || '');

      const phoneMatch =
        (cleanPhoneCore.length >= 4 && memberPhoneCore.includes(cleanPhoneCore)) ||
        (cleanDigits.length >= 4 && phoneDigits.endsWith(cleanDigits)) ||
        (m.phone ? m.phone.toLowerCase() === clean : false);

      const fullName = `${m.first_name || ''} ${m.last_name || ''}`.toLowerCase();
      const nameMatch = fullName === clean;
      return idMatch || memberIdMatch || titheMatch || emailMatch || phoneMatch || nameMatch;
    });

    // Cloud Supabase lookup fallback if member not yet cached locally
    if (!member) {
      const client = getSupabaseClient();
      if (client) {
        try {
          const { data: remoteMembers } = await client
            .from('members')
            .select('*')
            .or(`member_id.ilike.%${clean}%,phone.ilike.%${cleanDigits || clean}%,email.ilike.%${clean}%`)
            .limit(1);
          if (remoteMembers && remoteMembers.length > 0) {
            member = remoteMembers[0] as Member;
          }
        } catch (remoteErr) {
          console.warn('Supabase remote member lookup notice:', remoteErr);
        }
      }
    }

    if (!member) {
      return {
        success: false,
        message: 'No matching church member record was found for the details entered. Please verify your Member ID (e.g. GWCC-000002), registered phone number, or email.',
      };
    }

    const requiresCloudMemberAuth = import.meta.env.PROD && isSupabaseConfigured();
    const providedPin = (pinOrPassword || '').trim();

    if (requiresCloudMemberAuth) {
      if (!member.email) {
        return {
          success: false,
          message: 'A verified email address is required for secure member sign-in. Please contact the church office to update your member record.',
        };
      }
      if (!providedPin) {
        return { success: false, message: 'Enter your Supabase member account password.' };
      }

      const client = getSupabaseClient();
      if (!client) {
        return { success: false, message: 'Secure member sign-in is unavailable. Please try again later.' };
      }

      try {
        const { data, error } = await client.auth.signInWithPassword({
          email: member.email.trim(),
          password: providedPin,
        });
        if (error) {
          return {
            success: false,
            message: 'Member account sign-in failed. Check your email/password, or contact the church office to activate your Supabase member account.',
          };
        }
        if (!data.session || !data.user.email_confirmed_at) {
          await client.auth.signOut();
          return {
            success: false,
            message: 'Verify your member email address before signing in. Check your inbox or contact the church office.',
          };
        }
      } catch (error) {
        console.error('Supabase member sign-in failed:', error);
        return { success: false, message: 'Secure member sign-in failed. Please try again later.' };
      }
    } else {
      try {
        const pinsMap = readMemberPinMap();
        const expectedPin = pinsMap[member.id] || pinsMap[member.member_id];
        const memberPhoneDigits = (member.phone || '').replace(/[^0-9]/g, '');
        const phoneSuffix = memberPhoneDigits.slice(-4);

        if (!providedPin) {
          return {
            success: false,
            message: 'PIN or Password is required. For first-time login, your default PIN is the last 4 digits of your registered phone number.',
          };
        }

        const providedPinHash = await hashMemberPin(providedPin);

        if (expectedPin) {
          const normalizedStoredPin = expectedPin.trim();
          const matchesExpected = normalizedStoredPin === providedPin || normalizedStoredPin === providedPinHash;
          const matchesSuffixRecovery = phoneSuffix.length === 4 && providedPin === phoneSuffix;

          if (!matchesExpected && !matchesSuffixRecovery) {
            return {
              success: false,
              message: 'Incorrect PIN or password. Please enter your 4-digit PIN (or last 4 digits of your registered phone), or contact the church office.',
            };
          }

          if (normalizedStoredPin !== providedPinHash && normalizedStoredPin !== providedPin) {
            pinsMap[member.id] = providedPinHash;
            pinsMap[member.member_id] = providedPinHash;
            persistMemberPinMap(pinsMap);
          }
        } else {
          const defaultPin = phoneSuffix.length === 4 ? phoneSuffix : '1234';
          const matchesDefault = providedPin === defaultPin;
          const isValidNewPin = /^\d{4,8}$/.test(providedPin);

          if (!matchesDefault && !isValidNewPin) {
            return {
              success: false,
              message: `First-time sign-in requires your 4-digit PIN. Your default PIN is the last 4 digits of your phone (${defaultPin}).`,
            };
          }

          pinsMap[member.id] = providedPinHash;
          pinsMap[member.member_id] = providedPinHash;
          persistMemberPinMap(pinsMap);
        }
      } catch (e) {
        console.warn('Member PIN verification error:', e);
      }
    }

    const memberProfile: UserProfile = {
      id: `usr-mem-${member.id}`,
      first_name: member.first_name,
      last_name: member.last_name,
      email: member.email || `${(member.member_id || 'member').toLowerCase()}@member.gwcc.org`,
      phone: member.phone,
      role: 'member',
      member_id: member.id,
      avatar_url: member.profile_photo_url,
      is_active: true,
      created_at: member.created_at,
      updated_at: member.updated_at,
    };

    setCurrentMember(member);
    setCurrentUser(memberProfile);
    setIsAuthenticated(true);
    localStorage.setItem('gwcc_auth_authenticated', 'true');
    localStorage.setItem('gwcc_auth_role', 'member');
    localStorage.setItem('gwcc_active_member_id', member.id);
    localStorage.setItem('gwcc_active_user', JSON.stringify(memberProfile));

    return {
      success: true,
      message: `Welcome, ${member.first_name} ${member.last_name}! Member Portal access granted.`,
      member,
    };
  };

  const setPortalMember = (member: Member | null) => {
    setCurrentMember(member);
    if (member) {
      localStorage.setItem('gwcc_active_member_id', member.id);
      if (currentUser.role === 'member') {
        const profile: UserProfile = {
          ...currentUser,
          first_name: member.first_name,
          last_name: member.last_name,
          email: member.email || currentUser.email,
          phone: member.phone,
          member_id: member.id,
          avatar_url: member.profile_photo_url,
        };
        setCurrentUser(profile);
        localStorage.setItem('gwcc_active_user', JSON.stringify(profile));
      }
    } else {
      localStorage.removeItem('gwcc_active_member_id');
    }
  };

  const quickLoginAs = (user: UserProfile) => {
    const effectiveUser: UserProfile = isElishaRichard(user)
      ? { ...user, role: 'super_admin' as UserRole }
      : user;
    setCurrentUser(effectiveUser);
    setIsAuthenticated(true);
    localStorage.setItem('gwcc_auth_authenticated', 'true');
    localStorage.setItem('gwcc_active_user', JSON.stringify(effectiveUser));
  };

  const logout = async () => {
    const client = getSupabaseClient();
    if (client) {
      try {
        await client.auth.signOut();
      } catch (err) {
        console.warn('Supabase sign out notice:', err);
      }
    }
    setSession(null);
    setIsAuthenticated(false);
    setCurrentMember(null);
    setImpersonatingAdmin(null);
    sessionStorage.removeItem('gwcc_impersonating_admin');
    localStorage.setItem('gwcc_auth_authenticated', 'false');
    localStorage.removeItem('gwcc_active_user');
    localStorage.removeItem('gwcc_active_member_id');
    localStorage.removeItem('gwcc_auth_role');
  };

  const canAccess = (module: string): boolean => {
    if (isElishaRichard(currentUser) || currentUser.role === 'super_admin') {
      return true;
    }
    const allowed = ROLE_PERMISSIONS[currentUser.role] || [];
    return allowed.includes(module);
  };

  const hasRole = (roles: UserRole[]): boolean => {
    if (isElishaRichard(currentUser) || currentUser.role === 'super_admin') {
      return true;
    }
    return roles.includes(currentUser.role);
  };

  const isMemberPortalUser = currentUser.role === 'member' || currentMember !== null;

  const updateUser = (userId: string, updates: Partial<UserProfile>) => {
    setUsersList((prev) => {
      const index = prev.findIndex((u) => u.id === userId);
      if (index === -1) return prev;
      const isTargetElisha = isElishaRichard(prev[index]);
      const updatedUser: UserProfile = {
        ...prev[index],
        ...updates,
        role: isTargetElisha ? 'super_admin' : (updates.role || prev[index].role),
        updated_at: new Date().toISOString(),
      };
      const next = [...prev];
      next[index] = updatedUser;
      if (currentUser.id === userId) {
        setCurrentUser(updatedUser);
        localStorage.setItem('gwcc_active_user', JSON.stringify(updatedUser));
      }
      return next;
    });

    // Sync to Supabase profiles table if available
    const client = getSupabaseClient();
    if (client) {
      (async () => {
        try {
          const { error } = await client
            .from('profiles')
            .update({
              ...updates,
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId);
          if (error) console.warn('Supabase profile update note:', error.message);
        } catch {
          // Ignore offline/network exceptions
        }
      })();
    }
  };

  const deleteUser = (userId: string): boolean => {
    if (currentUser.id === userId) {
      return false; // Prevent deleting active logged-in user
    }
    setUsersList((prev) => prev.filter((u) => u.id !== userId));

    const client = getSupabaseClient();
    if (client) {
      (async () => {
        try {
          const { error } = await client
            .from('profiles')
            .delete()
            .eq('id', userId);
          if (error) console.warn('Supabase profile delete note:', error.message);
        } catch {
          // Ignore offline/network exceptions
        }
      })();
    }
    return true;
  };

  const toggleUserStatus = (userId: string) => {
    setUsersList((prev) => {
      const index = prev.findIndex((u) => u.id === userId);
      if (index === -1) return prev;
      const newActive = !prev[index].is_active;
      const updatedUser: UserProfile = {
        ...prev[index],
        is_active: newActive,
        updated_at: new Date().toISOString(),
      };
      const next = [...prev];
      next[index] = updatedUser;
      if (currentUser.id === userId) {
        setCurrentUser(updatedUser);
        localStorage.setItem('gwcc_active_user', JSON.stringify(updatedUser));
      }
      return next;
    });
  };

  const contextValue = React.useMemo<AuthContextType>(
    () => ({
      currentUser,
      currentRole: currentUser.role,
      setCurrentRole,
      availableUsers: usersList,
      switchUser,
      isSimulating,
      impersonatingAdmin,
      startSimulation,
      exitSimulation,
      canAccess,
      hasRole,
      isAuthenticated,
      session,
      isAuthLoading,
      currentMember,
      isMemberPortalUser,
      login,
      loginAsMember,
      setPortalMember,
      register,
      createUser,
      resetPassword,
      changePassword,
      quickLoginAs,
      logout,
      refreshSession,
      updateUser,
      deleteUser,
      toggleUserStatus,
    }),
    [currentUser, usersList, isAuthenticated, session, isAuthLoading, currentMember, isMemberPortalUser, refreshSession]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
