import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = typeof __SUPABASE_URL__ !== 'undefined' ? __SUPABASE_URL__ : '';
const SUPABASE_PUBLISHABLE_KEY = typeof __SUPABASE_PUBLISHABLE_KEY__ !== 'undefined' ? __SUPABASE_PUBLISHABLE_KEY__ : '';

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

export const supabase = supabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        storageKey: 'emberveil-auth',
      },
    })
  : null;
