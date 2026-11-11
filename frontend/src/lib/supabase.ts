import { createClient, SupabaseClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if valid URL and non-placeholder key
const isValidUrl = (url?: string): boolean => {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

export const isSupabaseConfigured = Boolean(
  isValidUrl(rawUrl) && 
  rawKey && 
  rawKey !== 'placeholder' && 
  !rawUrl.includes('placeholder.supabase.co')
);

// Fallback dummy URL & key to prevent createClient from throwing on module import
const safeUrl = isSupabaseConfigured ? rawUrl! : 'https://placeholder-project.supabase.co';
const safeKey = isSupabaseConfigured ? rawKey! : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy';

export const supabase: SupabaseClient = createClient(safeUrl, safeKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type AuthUser = {
  id: string;
  email?: string;
  full_name?: string;
  role?: string;
  platform_admin?: boolean;
};
