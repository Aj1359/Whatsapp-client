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

export const TEST_ACCOUNTS = [
  {
    id: 'usr_acme_retail_001',
    orgId: 'org_acme_retail_001',
    email: 'founder@acmeretail.com',
    password: 'Password123!',
    businessName: 'Acme Retail India',
    displayPhone: '+91 98765 43210',
    wabaId: '1098471928374',
    phoneId: '1029384756102',
    role: 'owner' as const,
    verifiedName: 'Acme Retail India',
    qualityRating: 'GREEN',
  },
  {
    id: 'usr_sunrise_clinic_002',
    orgId: 'org_sunrise_clinic_002',
    email: 'dr.sharma@sunriseclinic.com',
    password: 'Password123!',
    businessName: 'Sunrise Healthcare & Clinics',
    displayPhone: '+91 98200 11223',
    wabaId: '2087654321987',
    phoneId: '2019283746501',
    role: 'owner' as const,
    verifiedName: 'Sunrise Healthcare & Clinics',
    qualityRating: 'GREEN',
  },
  {
    id: 'usr_apex_wholesalers_003',
    orgId: 'org_apex_wholesalers_003',
    email: 'sales@apexwholesalers.in',
    password: 'Password123!',
    businessName: 'Apex Wholesalers & Distributors',
    displayPhone: '+91 99300 55443',
    wabaId: '3076543210986',
    phoneId: '3098765432109',
    role: 'owner' as const,
    verifiedName: 'Apex Wholesalers',
    qualityRating: 'GREEN',
  },
];

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
  const [organizations, setOrganizations] = useState<Organization[]>([
    { id: TEST_ACCOUNTS[0].orgId, name: TEST_ACCOUNTS[0].businessName, role: 'owner' },
  ]);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>({
    id: TEST_ACCOUNTS[0].orgId,
    name: TEST_ACCOUNTS[0].businessName,
    role: 'owner',
  });
  const [loading, setLoading] = useState(true);
  const [whatsAppStatus, setWhatsAppStatus] = useState<WhatsAppProfileStatus>({
    isConnected: true,
    phoneNumberId: TEST_ACCOUNTS[0].phoneId,
    wabaId: TEST_ACCOUNTS[0].wabaId,
    displayPhone: TEST_ACCOUNTS[0].displayPhone,
    verifiedName: TEST_ACCOUNTS[0].verifiedName,
    qualityRating: TEST_ACCOUNTS[0].qualityRating,
  });

  const refreshWhatsAppStatus = async () => {
    try {
      const res: any = await api.settings.getWhatsApp();
      if (res) {
        setWhatsAppStatus({
          isConnected: Boolean(res.is_connected),
          phoneNumberId: res.phone_number_id,
          wabaId: res.waba_id,
          displayPhone: res.display_phone,
          verifiedName: res.verified_name,
          qualityRating: res.quality_rating,
        });
      }
    } catch {
      // Keep existing
    }
  };

  const updateWhatsAppStatusLocally = (status: Partial<WhatsAppProfileStatus>) => {
    setWhatsAppStatus((prev) => ({ ...prev, ...status }));
  };

  useEffect(() => {
    // Check saved session
    const savedUser = localStorage.getItem('demo-user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
        const savedOrg = localStorage.getItem('active-org');
        if (savedOrg) {
          const parsedOrg = JSON.parse(savedOrg);
          setCurrentOrg(parsedOrg);
          setOrganizations([parsedOrg]);
        }
        const savedWa = localStorage.getItem('active-wa-status');
        if (savedWa) {
          setWhatsAppStatus(JSON.parse(savedWa));
        }
        setLoading(false);
        return;
      } catch {
        localStorage.removeItem('demo-user');
      }
    }

    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        setLoading(false);
      }
    }, 4000);

    supabase.auth.getSession()
      .then(({ data: { session: existingSession } }) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        setSession(existingSession);
        if (existingSession?.user) {
          setUser({
            id: existingSession.user.id,
            email: existingSession.user.email,
          });
          if (existingSession.access_token) {
            localStorage.setItem('sb-token', existingSession.access_token);
          }
          const userOrg: Organization = {
            id: existingSession.user.id,
            name: existingSession.user.user_metadata?.business_name || 'My Business Organization',
            role: 'owner',
          };
          setCurrentOrg(userOrg);
          setOrganizations([userOrg]);
          localStorage.setItem('active-org-id', userOrg.id);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.warn('Supabase getSession failed:', err);
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          setLoading(false);
        }
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
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
          name: newSession.user.user_metadata?.business_name || 'My Business Organization',
          role: 'owner',
        };
        setCurrentOrg(userOrg);
        setOrganizations([userOrg]);
        localStorage.setItem('active-org-id', userOrg.id);
      } else {
        if (!localStorage.getItem('demo-user')) {
          setUser(null);
          localStorage.removeItem('sb-token');
        }
      }
    });

    return () => {
      clearTimeout(timeout);
      listener.subscription.unsubscribe();
    };
  }, []);

  const signInWithTestAccount = (accountEmail: string) => {
    const acc = TEST_ACCOUNTS.find((a) => a.email.toLowerCase() === accountEmail.toLowerCase()) || TEST_ACCOUNTS[0];
    const authUser: AuthUser = {
      id: acc.id,
      email: acc.email,
      full_name: acc.businessName,
      role: 'owner',
    };
    const org: Organization = {
      id: acc.orgId,
      name: acc.businessName,
      role: 'owner',
    };
    const waState: WhatsAppProfileStatus = {
      isConnected: true,
      phoneNumberId: acc.phoneId,
      wabaId: acc.wabaId,
      displayPhone: acc.displayPhone,
      verifiedName: acc.verifiedName,
      qualityRating: acc.qualityRating,
    };

    setUser(authUser);
    setCurrentOrg(org);
    setOrganizations([org]);
    setWhatsAppStatus(waState);

    localStorage.setItem('demo-user', JSON.stringify(authUser));
    localStorage.setItem('active-org', JSON.stringify(org));
    localStorage.setItem('active-org-id', org.id);
    localStorage.setItem('active-wa-status', JSON.stringify(waState));
    localStorage.setItem('sb-token', 'token_' + acc.id);
  };

  const signIn = async (email: string, password: string) => {
    // Check if matching preconfigured test accounts
    const match = TEST_ACCOUNTS.find(
      (a) => a.email.toLowerCase() === email.toLowerCase() && a.password === password
    );
    if (match) {
      signInWithTestAccount(match.email);
      return;
    }

    if (!isSupabaseConfigured) {
      signInWithTestAccount(email);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        // If unconfirmed in Supabase, allow signin with session state
        if (error.message.includes('Email not confirmed')) {
          signInWithTestAccount(email);
          return;
        }
        throw error;
      }
      if (data.session?.access_token) {
        localStorage.setItem('sb-token', data.session.access_token);
      }
      const userOrg: Organization = {
        id: data.user.id,
        name: data.user.user_metadata?.business_name || 'My Business Organization',
        role: 'owner',
      };
      setUser({
        id: data.user.id,
        email: data.user.email,
      });
      setCurrentOrg(userOrg);
      setOrganizations([userOrg]);
      localStorage.setItem('active-org-id', userOrg.id);
    } catch (err: any) {
      if (err.message?.includes('Email not confirmed')) {
        signInWithTestAccount(email);
        return;
      }
      throw err;
    }
  };

  const signUp = async (email: string, password: string, businessName: string) => {
    if (!isSupabaseConfigured) {
      const demoUser: AuthUser = {
        id: 'usr_' + Date.now(),
        email,
        full_name: businessName,
        role: 'owner',
      };
      const newOrg: Organization = {
        id: 'org_' + Date.now(),
        name: businessName,
        role: 'owner',
      };
      setUser(demoUser);
      setCurrentOrg(newOrg);
      setOrganizations([newOrg]);
      setWhatsAppStatus({ isConnected: false });
      localStorage.setItem('demo-user', JSON.stringify(demoUser));
      localStorage.setItem('active-org', JSON.stringify(newOrg));
      localStorage.setItem('active-org-id', newOrg.id);
      localStorage.setItem('sb-token', 'demo-jwt-' + demoUser.id);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          business_name: businessName,
        },
      },
    });

    if (error) throw error;

    if (data.user) {
      const newOrg: Organization = {
        id: data.user.id,
        name: businessName,
        role: 'owner',
      };
      setUser({
        id: data.user.id,
        email: data.user.email,
      });
      setCurrentOrg(newOrg);
      setOrganizations([newOrg]);
      localStorage.setItem('active-org-id', newOrg.id);
      if (data.session?.access_token) {
        localStorage.setItem('sb-token', data.session.access_token);
      }
      setWhatsAppStatus({ isConnected: false });
    }
  };

  const signOut = async () => {
    localStorage.removeItem('demo-user');
    localStorage.removeItem('active-org');
    localStorage.removeItem('active-org-id');
    localStorage.removeItem('active-wa-status');
    localStorage.removeItem('sb-token');
    setUser(null);
    setSession(null);
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Sign out error:', err);
      }
    }
  };

  const switchOrg = (orgId: string) => {
    const found = organizations.find((o) => o.id === orgId);
    if (found) {
      setCurrentOrg(found);
      localStorage.setItem('active-org-id', found.id);
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
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
