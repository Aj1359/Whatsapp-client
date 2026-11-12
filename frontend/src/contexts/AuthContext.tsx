import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { AuthUser } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { api } from '../lib/api';

export interface Organization {
  id: string;
  name: string;
  role: 'owner' | 'member';
}

export interface WhatsAppProfileStatus {
  isConnected: boolean;
  phoneNumberId?: string;
  wabaId?: string;
  displayPhone?: string;
  verifiedName?: string;
  qualityRating?: string;
}

export const TEST_ACCOUNTS: any[] = [];

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  currentOrg: Organization | null;
  organizations: Organization[];
  whatsAppStatus: WhatsAppProfileStatus;
  switchOrg: (orgId: string) => void;
  loading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, businessName: string) => Promise<void>;
  signInWithTestAccount: (accountEmail: string) => void;
  signOut: () => Promise<void>;
  refreshWhatsAppStatus: () => Promise<void>;
  updateWhatsAppStatusLocally: (status: Partial<WhatsAppProfileStatus>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [whatsAppStatus, setWhatsAppStatus] = useState<WhatsAppProfileStatus>(() => {
    try {
      const activeOrgId = localStorage.getItem('active-org-id');
      const userKey = activeOrgId ? `reachflow-active-wa-${activeOrgId}` : 'reachflow-active-wa';
      const saved = localStorage.getItem(userKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.phoneNumberId) return parsed;
      }
    } catch {}
    return {
      isConnected: false,
    };
  });

  const refreshWhatsAppStatus = async (targetOrgId?: string) => {
    const orgId = targetOrgId || currentOrg?.id || localStorage.getItem('active-org-id');
    const userKey = orgId ? `reachflow-active-wa-${orgId}` : 'reachflow-active-wa';

    try {
      const res: any = await api.settings.getWhatsApp();
      if (res && res.is_connected && res.phone_number_id) {
        const next: WhatsAppProfileStatus = {
          isConnected: true,
          phoneNumberId: res.phone_number_id,
          wabaId: res.waba_id,
          displayPhone: res.display_phone || res.phone_number_id,
          verifiedName: res.verified_name || currentOrg?.name || 'Verified WhatsApp Profile',
          qualityRating: res.quality_rating || 'GREEN',
        };
        setWhatsAppStatus(next);
        localStorage.setItem(userKey, JSON.stringify(next));
        localStorage.setItem('reachflow-active-wa', JSON.stringify(next));
        return;
      }
    } catch (err) {
      console.warn('refreshWhatsAppStatus fallback:', err);
    }

    // Check organization-specific storage
    if (orgId) {
      const saved = localStorage.getItem(userKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.phoneNumberId) {
            setWhatsAppStatus(parsed);
            localStorage.setItem('reachflow-active-wa', JSON.stringify(parsed));
            return;
          }
        } catch {}
      }
    }

    // Default: New client starts disconnected
    setWhatsAppStatus({ isConnected: false });
    localStorage.removeItem('reachflow-active-wa');
  };

  const updateWhatsAppStatusLocally = (status: Partial<WhatsAppProfileStatus>) => {
    setWhatsAppStatus((prev) => {
      const next = { ...prev, ...status };
      const orgId = currentOrg?.id || localStorage.getItem('active-org-id');
      if (orgId) {
        localStorage.setItem(`reachflow-active-wa-${orgId}`, JSON.stringify(next));
      }
      localStorage.setItem('reachflow-active-wa', JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    let mounted = true;

    // Clean up old demo keys (preserve real ReachFlow connection)
    localStorage.removeItem('demo-user');
    localStorage.removeItem('active-org');

    // 1. Get initial session from Supabase
    supabase.auth
      .getSession()
      .then(({ data: { session: existingSession }, error }) => {
        if (!mounted) return;
        if (error) {
          console.warn('Supabase getSession error:', error);
          setLoading(false);
          return;
        }

        if (existingSession?.user) {
          setSession(existingSession);
          setUser({
            id: existingSession.user.id,
            email: existingSession.user.email,
          });
          if (existingSession.access_token) {
            localStorage.setItem('sb-token', existingSession.access_token);
          }
          const userOrg: Organization = {
            id: existingSession.user.id,
            name: existingSession.user.user_metadata?.business_name || 'My Business',
            role: 'owner',
          };
          setCurrentOrg(userOrg);
          setOrganizations([userOrg]);
          localStorage.setItem('active-org-id', userOrg.id);
          refreshWhatsAppStatus();
        } else {
          setUser(null);
          setSession(null);
          setCurrentOrg(null);
          setOrganizations([]);
          localStorage.removeItem('sb-token');
          localStorage.removeItem('active-org-id');
        }
        setLoading(false);
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });

    // 2. Listen to Auth State Changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      if (newSession?.user) {
        setUser({
          id: newSession.user.id,
          email: newSession.user.email,
        });
        if (newSession.access_token) {
          localStorage.setItem('sb-token', newSession.access_token);
        }
        const userOrg: Organization = {
          id: newSession.user.id,
          name: newSession.user.user_metadata?.business_name || 'My Business',
          role: 'owner',
        };
        setCurrentOrg(userOrg);
        setOrganizations([userOrg]);
        localStorage.setItem('active-org-id', userOrg.id);
        refreshWhatsAppStatus();
      } else {
        setUser(null);
        setCurrentOrg(null);
        setOrganizations([]);
        setWhatsAppStatus({ isConnected: false });
        localStorage.removeItem('sb-token');
        localStorage.removeItem('active-org-id');
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw error;
    }
    if (data.session) {
      setSession(data.session);
      if (data.session.access_token) {
        localStorage.setItem('sb-token', data.session.access_token);
      }
    }
    if (data.user) {
      const userOrg: Organization = {
        id: data.user.id,
        name: data.user.user_metadata?.business_name || 'My Business',
        role: 'owner',
      };
      setUser({
        id: data.user.id,
        email: data.user.email,
      });
      setCurrentOrg(userOrg);
      setOrganizations([userOrg]);
      localStorage.setItem('active-org-id', userOrg.id);
      await refreshWhatsAppStatus();
    }
  };

  const signUp = async (email: string, password: string, businessName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          business_name: businessName,
          full_name: businessName,
        },
      },
    });

    if (error) {
      throw error;
    }

    if (data.session) {
      setSession(data.session);
      if (data.session.access_token) {
        localStorage.setItem('sb-token', data.session.access_token);
      }
    }

    if (data.user) {
      const userOrg: Organization = {
        id: data.user.id,
        name: businessName,
        role: 'owner',
      };
      setUser({
        id: data.user.id,
        email: data.user.email,
      });
      setCurrentOrg(userOrg);
      setOrganizations([userOrg]);
      localStorage.setItem('active-org-id', userOrg.id);
      setWhatsAppStatus({ isConnected: false });
    }
  };

  const signInWithTestAccount = (_accountEmail: string) => {
    // Deprecated for production testing
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setCurrentOrg(null);
    setOrganizations([]);
    setWhatsAppStatus({ isConnected: false });
    localStorage.removeItem('sb-token');
    localStorage.removeItem('active-org-id');
    localStorage.removeItem('reachflow-active-wa');
  };

  const switchOrg = (orgId: string) => {
    const org = organizations.find((o) => o.id === orgId);
    if (org) {
      setCurrentOrg(org);
      localStorage.setItem('active-org-id', org.id);
      refreshWhatsAppStatus();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        currentOrg,
        organizations,
        whatsAppStatus,
        switchOrg,
        loading,
        isConfigured: isSupabaseConfigured,
        signIn,
        signUp,
        signInWithTestAccount,
        signOut,
        refreshWhatsAppStatus,
        updateWhatsAppStatusLocally,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
