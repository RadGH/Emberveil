/**
 * telemetry.js — Anonymous gameplay data capture.
 *
 * STATUS: M211 scaffold. Client-side in place; Supabase transport stubbed.
 * See public/docs/telemetry.md for the integration steps to turn this on.
 *
 * Privacy contract (MUST NOT drift):
 *   - No PII. No character names, no email, no IP-derived fields.
 *   - session_id is a random UUID kept in localStorage ('rsg_sessionId').
 *     Resettable from Settings.
 *   - Opt-in only. `rsg_telemetryOptIn === 'true'` gates every emit.
 *   - Every event carries `{ game: 'emberveil', version, sessionId }` so we
 *     can filter stale data post-balance-patch.
 *
 * Events emitted (keep stable; document any change in telemetry.md):
 *   run_started      { act, partySize, classes[] }
 *   encounter_result { act, encounterId, outcome, rounds, partySize }
 *   level_up         { class, level, attrs }
 *   combat_damage    { class, weaponCat, avgDmg, maxDmg, rounds }
 *   tap_damage       { weapon, avgDmg, hits }
 *   run_ended        { actReached, encountersCleared, outcome }
 *
 * The queue flushes lazily — `sendBeacon` on pagehide, batched on size.
 * No sync network in hot paths.
 */

import { MILESTONE } from '../version.js';
const APP_VERSION = `M${MILESTONE}`;

const OPT_IN_KEY = 'rsg_telemetryOptIn';
const SESSION_KEY = 'rsg_sessionId';
const QUEUE_KEY = 'rsg_telemetryQueue';
const MAX_QUEUE = 200;
const FLUSH_SIZE = 20;

// Transport endpoint. When null, events queue but never leave the device.
// Set via setTelemetryEndpoint() at boot once Supabase edge function URL is known.
let _endpoint = null;
let _queue = null;
let _flushing = false;

function _loadQueue() {
  if (_queue) return _queue;
  try {
    _queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch { _queue = []; }
  return _queue;
}

function _persistQueue() {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(_queue.slice(-MAX_QUEUE))); } catch {}
}

function _uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  // Fallback — not cryptographically strong, but session_id only needs uniqueness.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function getSessionId() {
  let id = null;
  try { id = localStorage.getItem(SESSION_KEY); } catch {}
  if (!id) {
    id = _uuid();
    try { localStorage.setItem(SESSION_KEY, id); } catch {}
  }
  return id;
}

export function resetSessionId() {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
}

export function isOptedIn() {
  try { return localStorage.getItem(OPT_IN_KEY) === 'true'; } catch { return false; }
}

export function setOptIn(value) {
  try { localStorage.setItem(OPT_IN_KEY, value ? 'true' : 'false'); } catch {}
}

export function hasAnsweredOptIn() {
  try { return localStorage.getItem(OPT_IN_KEY) != null; } catch { return false; }
}

export function setTelemetryEndpoint(url) {
  _endpoint = url || null;
}

/**
 * Record a telemetry event. No-op when opted out. Adds game/version/session
 * envelope automatically. Payload should be a plain object of anonymous facts.
 */
export function recordEvent(eventType, payload = {}) {
  if (!isOptedIn()) return;
  if (!eventType || typeof eventType !== 'string') return;
  const evt = {
    game: 'emberveil',
    version: APP_VERSION,
    sessionId: getSessionId(),
    eventType,
    payload: _sanitize(payload),
    createdAt: new Date().toISOString(),
  };
  _loadQueue().push(evt);
  _persistQueue();
  if (_queue.length >= FLUSH_SIZE) void flush();
}

/** Strip anything that smells like PII. Deep walk, drops string keys blacklisted. */
function _sanitize(obj) {
  if (obj == null || typeof obj !== 'object') return obj;
  const out = Array.isArray(obj) ? [] : {};
  const BLOCK = new Set(['name', 'characterName', 'heroName', 'email', 'ip', 'userAgent']);
  for (const [k, v] of Object.entries(obj)) {
    if (BLOCK.has(k)) continue;
    out[k] = (v && typeof v === 'object') ? _sanitize(v) : v;
  }
  return out;
}

export async function flush() {
  if (_flushing) return;
  if (!_endpoint) return; // queued-only mode — no transport configured
  const queue = _loadQueue();
  if (!queue.length) return;
  _flushing = true;
  const batch = queue.splice(0, FLUSH_SIZE);
  _persistQueue();
  try {
    const res = await fetch(_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    });
    if (!res.ok) throw new Error(`telemetry ${res.status}`);
  } catch (e) {
    // Requeue on failure (head-insert to preserve order).
    _queue.unshift(...batch);
    _persistQueue();
  } finally {
    _flushing = false;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    if (!_endpoint || !isOptedIn()) return;
    const queue = _loadQueue();
    if (!queue.length) return;
    try {
      navigator.sendBeacon(_endpoint, new Blob([JSON.stringify({ events: queue })], { type: 'application/json' }));
      _queue = [];
      _persistQueue();
    } catch {}
  });
}

// ─── M400 — JS error capture ─────────────────────────────────────────────────
//
// Captures uncaught errors + unhandled promise rejections and routes them
// through recordEvent('js_error', ...). Spam-resistant per device:
//   - Per-fingerprint rate limit: max 5 reports per error fingerprint per
//     session, then suppress (a tight loop won't dump 1,000 events).
//   - Per-session global cap: max 30 error events total per session window.
//   - Fingerprint = sha-ish hash of (message + first stack line). Collision
//     is fine — a real bug typically reports 1-3 distinct frames per session.
//
// Only fires when telemetry opt-in is true. The event payload carries
// message, fingerprint, stack (truncated to 800 chars), version, route, and
// userAgent (lightly scrubbed). No save data, no character names.

const ERROR_FP_LIMIT = 5;          // max events per fingerprint per session
const ERROR_TOTAL_LIMIT = 30;      // max total error events per session
const _errorFpCounts = new Map();  // fingerprint -> count
let _errorTotal = 0;

function _hashFingerprint(message, stackFirstLine) {
  const s = `${message}\n${stackFirstLine || ''}`;
  let h = 5381 >>> 0;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

function _firstStackLine(stack) {
  if (typeof stack !== 'string') return '';
  const m = stack.split('\n').slice(1, 2).join('\n').trim();
  return m.slice(0, 240);
}

function _scrubUA(ua) {
  return String(ua || '').slice(0, 200);
}

function _scrubRoute() {
  try {
    return (location.pathname + location.hash).slice(0, 200);
  } catch { return ''; }
}

export function reportJsError(err, source = 'window') {
  if (!isOptedIn()) return;
  const message = (err && err.message) ? String(err.message) : String(err || 'unknown');
  const stack = (err && err.stack) ? String(err.stack) : '';
  const stackFirst = _firstStackLine(stack);
  const fp = _hashFingerprint(message, stackFirst);
  if (_errorTotal >= ERROR_TOTAL_LIMIT) return;
  const cur = _errorFpCounts.get(fp) || 0;
  if (cur >= ERROR_FP_LIMIT) return;
  _errorFpCounts.set(fp, cur + 1);
  _errorTotal++;
  recordEvent('js_error', {
    fp,
    source,
    message: message.slice(0, 240),
    stackFirst,
    stack: stack.slice(0, 800),
    route: _scrubRoute(),
    userAgent: _scrubUA(typeof navigator !== 'undefined' ? navigator.userAgent : ''),
    occurrenceN: cur + 1,
  });
  // Force a flush every 5 unique errors so the user's iPhone reports land
  // before the page is closed.
  if (_errorTotal % 5 === 0) { try { void flush(); } catch (_) {} }
}

if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    try { reportJsError(e?.error || { message: e?.message, stack: '' }, 'window.onerror'); } catch (_) {}
  });
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e?.reason;
    try { reportJsError(reason?.message ? reason : { message: String(reason), stack: reason?.stack || '' }, 'unhandledrejection'); } catch (_) {}
  });
}
