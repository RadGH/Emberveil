/**
 * authManager — single source of truth for the game's auth session.
 * Wraps supabaseClient and exposes a tiny event emitter so UI can subscribe.
 */
import { supabase, supabaseConfigured } from './supabaseClient.js';
import { debug } from '../utils/debug.js';

// M436 — login UI is back on the title screen. The vibe.jam window has
// passed; cloud saves + auth surfaces are visible again.
export const LOGIN_UI_DISABLED = false;

const listeners = new Set();
let currentSession = null;
let currentUser = null;
let initialized = false;
let initPromise = null;

function notify(event) {
  debug.auth(`state: ${event}`, currentUser ? { email: currentUser.email, provider: currentUser.app_metadata?.provider } : null);
  for (const cb of listeners) {
    try { cb(currentSession, currentUser, event); }
    catch (e) { console.error('authManager listener error:', e); }
  }
}

async function init() {
  if (initialized) return;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (!supabaseConfigured) {
      debug.auth('init: supabase not configured');
      initialized = true;
      return;
    }
    const { data, error } = await supabase.auth.getSession();
    if (error) debug.auth('init getSession error', { error: error.message });
    currentSession = data?.session || null;
    currentUser = currentSession?.user || null;
    supabase.auth.onAuthStateChange((event, session) => {
      currentSession = session || null;
      currentUser = currentSession?.user || null;
      notify(event);
    });
    initialized = true;
    debug.auth('init complete', { signedIn: !!currentUser });
    notify('INITIAL_SESSION');
  })();
  return initPromise;
}

export const authManager = {
  init,
  get configured() { return supabaseConfigured; },
  get session() { return currentSession; },
  get user() { return currentUser; },
  get isSignedIn() { return !!currentUser; },

  onChange(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },

  async signUp(email, password) {
    if (!supabaseConfigured) return { error: new Error('Supabase not configured') };
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${window.location.origin}${window.location.pathname}` },
    });
    debug.auth('signUp', { email, error: error?.message, needsConfirm: !!data?.user && !data?.session });
    return { data, error };
  },

  async signIn(email, password) {
    if (!supabaseConfigured) return { error: new Error('Supabase not configured') };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    debug.auth('signIn', { email, error: error?.message });
    return { data, error };
  },

  async signInWithGoogle() {
    if (!supabaseConfigured) return { error: new Error('Supabase not configured') };
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${window.location.pathname}` },
    });
    debug.auth('signInWithGoogle', { error: error?.message });
    return { data, error };
  },

  async signOut() {
    if (!supabaseConfigured) return { error: new Error('Supabase not configured') };
    const { error } = await supabase.auth.signOut();
    debug.auth('signOut', { error: error?.message });
    return { error };
  },

  async resendConfirmation(email) {
    if (!supabaseConfigured) return { error: new Error('Supabase not configured') };
    const { error } = await supabase.auth.resend({
      type: 'signup', email,
      options: { emailRedirectTo: `${window.location.origin}${window.location.pathname}` },
    });
    debug.auth('resend', { email, error: error?.message });
    return { error };
  },
};

if (typeof window !== 'undefined') window.__auth = authManager;
