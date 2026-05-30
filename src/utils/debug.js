/**
 * debug — opt-in console logger gated by Settings → Debug Mode.
 * Persisted to localStorage under `emberveil_debug` as JSON.
 *
 * Auth/saves events are ALWAYS captured into an in-memory ring buffer
 * (up to 200 entries) regardless of the enabled flag, so that a user
 * can grab a diagnostic log AFTER reproducing a bug without having to
 * enable debug mode in advance. Console printing still requires the
 * flag, to keep the console quiet during normal play.
 */
const KEY = 'emberveil_debug';
const DEFAULTS = {
  enabled: false, combat: false, map: false, audio: false,
  state: false, simulator: false, auth: false, saves: false,
};

let _flags = { ...DEFAULTS };

function _load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) _flags = { ...DEFAULTS, ...JSON.parse(raw) };
    else _flags = { ...DEFAULTS };
  } catch (_) {
    _flags = { ...DEFAULTS };
  }
}
_load();

// Ring buffer for diagnostic reporting. Retained across toggles.
const RING_MAX = 200;
const _ring = [];
function _ringPush(tag, args) {
  try {
    _ring.push({
      t: new Date().toISOString(),
      tag,
      msg: args.map(a => {
        if (a === null || a === undefined) return String(a);
        if (typeof a === 'string') return a;
        try { return JSON.stringify(a); } catch { return String(a); }
      }).join(' '),
    });
    if (_ring.length > RING_MAX) _ring.shift();
  } catch (_) {}
}

export const debug = {
  reload() { _load(); },
  get flags() { return { ..._flags }; },
  set(partial) {
    _flags = { ..._flags, ...(partial || {}) };
    try { localStorage.setItem(KEY, JSON.stringify(_flags)); } catch (_) {}
  },

  combat(...args) { if (_flags.enabled && _flags.combat) console.log('[combat]', ...args); },
  map(...args)    { if (_flags.enabled && _flags.map)    console.log('[map]', ...args); },
  audio(...args)  { if (_flags.enabled && _flags.audio)  console.log('[audio]', ...args); },
  state(...args)  { if (_flags.enabled && _flags.state)  console.log('[state]', ...args); },

  // Auth/saves: always captured to ring buffer for bug-report dumps.
  auth(...args)  { _ringPush('auth', args);  if (_flags.enabled && _flags.auth)  console.log('[auth]', ...args); },
  saves(...args) { _ringPush('saves', args); if (_flags.enabled && _flags.saves) console.log('[saves]', ...args); },

  /**
   * Returns a multi-line diagnostic string suitable for pasting into a bug report.
   * Includes: flags, ring buffer, browser metadata, storage counts, last session.
   */
  async getDiagnosticLog() {
    const lines = [];
    lines.push('=== Emberveil diagnostic log ===');
    lines.push(`captured_at: ${new Date().toISOString()}`);
    lines.push(`ua: ${navigator.userAgent}`);
    lines.push(`url: ${window.location.href}`);
    lines.push(`flags: ${JSON.stringify(_flags)}`);

    // Count saves in localStorage
    let localSaveCount = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('emberveil_save_')) localSaveCount++;
      }
    } catch (_) {}
    lines.push(`local_saves: ${localSaveCount}`);

    // Current session (best-effort — supabase client may not be ready)
    try {
      const mod = await import('../auth/supabaseClient.js');
      if (mod.supabaseConfigured && mod.supabase) {
        const { data } = await mod.supabase.auth.getSession();
        const s = data?.session;
        if (s) {
          lines.push(`session_user: ${s.user.email || s.user.id}`);
          lines.push(`session_provider: ${s.user.app_metadata?.provider || 'unknown'}`);
          lines.push(`session_expires_at: ${s.expires_at}`);
        } else {
          lines.push('session_user: (signed out)');
        }
      } else {
        lines.push('supabase: not configured');
      }
    } catch (e) {
      lines.push(`session_error: ${e.message}`);
    }

    lines.push('');
    lines.push(`=== ring buffer (last ${_ring.length}) ===`);
    for (const ev of _ring) lines.push(`[${ev.t}] [${ev.tag}] ${ev.msg}`);
    return lines.join('\n');
  },

  clearRingBuffer() { _ring.length = 0; },
};

if (typeof window !== 'undefined') window.__debug = debug;
