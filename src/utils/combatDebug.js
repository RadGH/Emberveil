/**
 * combatDebug.js — M377 Combat Debugging
 *
 * Structured, ring-buffered combat event log. When `combatDebug.enabled`
 * is true, every combat-relevant event is recorded as a structured
 * `{ ts, round, turn, actor, kind, data }` entry to:
 *
 *   1. an in-memory ring buffer (capped at ~5000 entries)
 *   2. the browser console (collapsible groups per round/turn)
 *
 * Goal: make discrepancies between the in-screen Combat Log, the
 * post-combat Combat Report, and the Damage Meter debuggable. Recent
 * example — a legendary on-kill fire effect was bucketed under "Attack"
 * in the meter instead of "Dragon Breath" because the breakdown source
 * never reached `_meterAddDamage`. With combat debugging on, every
 * `meter_add` event records its source string + side, so the bug shows
 * up as a `parity_warning` at end of combat.
 *
 * Performance: when disabled, every push() returns in O(1) at the very
 * first guard. Zero allocations, zero console calls.
 *
 * The buffer is mirrored to `window.__combatDebug` so it can be
 * inspected from DevTools at any time.
 *
 * Persisted toggle key: `localStorage.emberveil_combat_debug_log`
 */

const STORAGE_KEY = 'emberveil_combat_debug_log';
const MAX_BUFFER = 5000;

function _readEnabled() {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; }
  catch (_) { return false; }
}

export const combatDebug = {
  /** Master switch. Read once at boot, toggled live by SettingsScreen. */
  enabled: _readEnabled(),
  /** Ring buffer of structured events. */
  buffer: [],
  /** Encounter context filled in at fight start; used to tag every event. */
  context: { encounter: null, round: 0, turn: 0, actor: null },

  setEnabled(on) {
    this.enabled = !!on;
    try { localStorage.setItem(STORAGE_KEY, on ? '1' : '0'); } catch (_) {}
  },

  /**
   * Set the running context (round, turn index, current actor name).
   * Cheap helpers — also short-circuit when disabled.
   */
  setRound(round) {
    if (!this.enabled) return;
    this.context.round = round;
  },
  setTurn(turn, actor) {
    if (!this.enabled) return;
    this.context.turn = turn;
    this.context.actor = actor || null;
  },
  setEncounter(name) {
    if (!this.enabled) return;
    this.context.encounter = name || null;
  },

  /**
   * Push a structured event. NO-OP when disabled.
   * @param {string} kind  one of the documented event kinds
   * @param {object} data  arbitrary event payload
   */
  push(kind, data) {
    if (!this.enabled) return;
    const entry = {
      ts: Date.now(),
      round: this.context.round,
      turn: this.context.turn,
      actor: this.context.actor || (data && data.actor) || null,
      kind,
      data: data || {},
    };
    this.buffer.push(entry);
    if (this.buffer.length > MAX_BUFFER) {
      // Drop oldest 10% to amortize splice cost.
      this.buffer.splice(0, Math.floor(MAX_BUFFER * 0.1));
    }
    try {
      // Lightweight console echo. Each event is one console.debug call so
      // DevTools' built-in filtering ("kind:damage_apply") still works.
      // eslint-disable-next-line no-console
      console.debug(`[cbt-dbg ${kind}]`, entry);
    } catch (_) {}
  },

  group(label) {
    if (!this.enabled) return;
    try { console.groupCollapsed(`[cbt-dbg] ${label}`); } catch (_) {}
  },
  groupEnd() {
    if (!this.enabled) return;
    try { console.groupEnd(); } catch (_) {}
  },

  /** Return current buffer contents and clear. */
  dump() {
    const out = this.buffer.slice();
    this.buffer = [];
    return out;
  },

  clear() {
    this.buffer = [];
  },

  /**
   * Run a parity cross-check between meter, log lines, and the report
   * total. Pushes a `parity_warning` event for each pair that disagrees
   * by more than 5%, and emits a console.warn so the issue is visible
   * even if no one inspects the buffer.
   *
   * @param {object} totals
   *   { meter: number, log: number, report: number }
   * @param {object} [extra] optional extra context recorded in the warning
   * @returns {number} count of warnings pushed
   */
  checkParity(totals, extra = {}) {
    if (!this.enabled) return 0;
    const { meter = 0, log = 0, report = 0 } = totals || {};
    const max = Math.max(Math.abs(meter), Math.abs(log), Math.abs(report), 1);
    const tolerance = Math.max(5, max * 0.05);
    let count = 0;
    const checks = [
      ['meter_vs_report', meter, report],
      ['meter_vs_log', meter, log],
      ['log_vs_report', log, report],
    ];
    for (const [tag, a, b] of checks) {
      if (Math.abs(a - b) > tolerance) {
        this.push('parity_warning', {
          pair: tag,
          a, b,
          delta: a - b,
          tolerance,
          meter, log, report,
          ...extra,
        });
        try {
          // eslint-disable-next-line no-console
          console.warn('[combat-parity] mismatch', tag, { a, b, delta: a - b, tolerance, ...extra });
        } catch (_) {}
        count++;
      }
    }
    return count;
  },
};

// Mirror to window for DevTools inspection.
if (typeof window !== 'undefined') {
  window.__combatDebug = combatDebug;
}

/** Settings-screen helper. */
export function isCombatDebugLogging() {
  return combatDebug.enabled;
}
export function setCombatDebugLogging(on) {
  combatDebug.setEnabled(on);
}

/**
 * Parse a "{name} for N dmg" / "{name}: N dmg" / "for N damage" pattern
 * out of a raw log message. Returns the integer or null. Used by the
 * end-of-combat parity check to sum what the in-screen log actually
 * shows the player.
 */
export function parseDamageFromLogLine(msg) {
  if (!msg || typeof msg !== 'string') return null;
  // Common shapes:
  //   "Hero → Goblin: 12 dmg CRIT (deflected 2)"
  //   "Goblin uses Fire Bolt: 8 dmg"
  //   "Tap Fireball → 3 target(s): 24 dmg (rolled 8)"
  //   "Hero hits Goblin for 12 damage."
  //   "Hero heals Companion for 8"   ← intentionally NOT damage
  //   "Hero parries and counters Goblin for 14!"
  let m = msg.match(/:\s*(-?\d+)\s*dmg\b/i);
  if (m) return parseInt(m[1], 10);
  m = msg.match(/\bfor\s+(-?\d+)\s+(?:damage|dmg)\b/i);
  if (m) return parseInt(m[1], 10);
  // "counters X for N" — count as damage.
  m = msg.match(/counters?\s+\S+\s+for\s+(-?\d+)/i);
  if (m) return parseInt(m[1], 10);
  return null;
}
