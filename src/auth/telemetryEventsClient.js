/**
 * telemetryEventsClient — M333 first-party Supabase mirror of GA events.
 *
 * Schema lives in `supabase/migrations/0003_telemetry_events.sql`. Every
 * call here is fire-and-forget — failures (offline, table missing, RLS
 * mismatch) are logged at warn level and never throw. The GA-side push in
 * `src/utils/consent.js` is the primary path; this is the optional
 * first-party mirror so we can run our own queries.
 *
 * Anonymous (signed-out) writes ARE allowed by the migration's RLS policy
 * (`user_id is null`), gated by a session_id 8–64 chars long. Per-user rows
 * trim to the latest 1000; anonymous rows trim to a global 50,000.
 */

import { supabase, supabaseConfigured } from './supabaseClient.js';
import { MILESTONE } from '../version.js';

const SESSION_KEY = 'rsg_sessionId';
const APP_VERSION = `M${MILESTONE}`;

function _sessionId() {
  try {
    let s = localStorage.getItem(SESSION_KEY);
    if (!s) {
      s = (crypto && crypto.randomUUID) ? crypto.randomUUID()
        : `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(SESSION_KEY, s);
    }
    return s;
  } catch (_) {
    return `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

async function _user() {
  if (!supabaseConfigured || !supabase) return null;
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user || null;
  } catch (_) { return null; }
}

/**
 * Insert a single row into public.telemetry_events. Always returns void;
 * never throws. Caller doesn't await.
 */
export async function recordEvent(eventName, props = {}) {
  if (!supabaseConfigured || !supabase) return;
  try {
    const user = await _user();
    const row = {
      user_id: user ? user.id : null,
      session_id: _sessionId(),
      event_name: String(eventName).slice(0, 64),
      props: props || {},
      app_version: APP_VERSION,
    };
    const { error } = await supabase.from('telemetry_events').insert(row);
    if (error) {
      // 42P01 = relation does not exist (migration not applied). Swallow.
      if (error.code === '42P01') return;
      console.warn('[telemetryEvents] insert failed (non-fatal):', error.message || error);
    }
  } catch (err) {
    console.warn('[telemetryEvents] threw (non-fatal):', err?.message || err);
  }
}
