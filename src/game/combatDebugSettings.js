/**
 * combatDebugSettings.js — M220
 * Persistent Combat Debug settings (localStorage key: rsg.combatDebug.v1).
 * Consumers fire combatDebug:changed when they need the CombatScreen to react.
 */

const _KEY = 'rsg.combatDebug.v1';

// M242: defaults per user spec. gridOverlay simplified to a single on/off
// ("Show Grid Placement") — old 'squares'/'rows'/'columns' radio retired
// since combat still resolves via rows+columns regardless and the overlay
// just visualises possible cells. Retain those string values as aliases
// so legacy saves don't crash — they coerce to 'on' in CombatScreen.
const _DEFAULTS = {
  gridOverlay: 'off',         // 'off' | 'on' | legacy: 'squares'/'rows'/'columns'
  // M480 — unified 1.5x scaling per user spec. Previously heroes + bosses
  // were 2.0x while enemies + companions were 1.5x; on top of that, bosses
  // had a hardcoded 2.5x multiplier in _drawUnitInner (removed M476).
  // Final answer: everyone renders at 1.5x.
  characterScale: 1.5,
  companionScale: 1.5,
  enemyScale: 1.5,
  bossScale: 1.5,
  placement: { x: 0, y: 0, w: 0, h: 0 },
  layout: 'stagger',
  staggerOffset: 12,
  // New lateral-offset knobs (replace layout dropdown for placement):
  offsetPct: 25,              // lateral % offset per row
  alternateStagger: true,     // alternate +offsetPct / -offsetPct per row
};

// M480 — one-time migration. Users with persisted v1 settings still have
// the old 2.0/1.5/1.5/2.0 defaults baked in. Bump the schema and reset the
// scale fields to the new unified 1.5 on first load.
const _SCHEMA_VERSION = 2;

function _load() {
  try {
    const raw = localStorage.getItem(_KEY);
    if (!raw) return Object.assign({}, _DEFAULTS, { _schemaV: _SCHEMA_VERSION, placement: Object.assign({}, _DEFAULTS.placement) });
    const parsed = JSON.parse(raw);
    // Migrate v1 → v2: blow away the per-faction scales so the new 1.5
    // defaults apply uniformly. Other fields (gridOverlay, layout, offsets,
    // placement) are preserved — user customization stays.
    if ((parsed._schemaV || 1) < 2) {
      delete parsed.characterScale;
      delete parsed.companionScale;
      delete parsed.enemyScale;
      delete parsed.bossScale;
      parsed._schemaV = _SCHEMA_VERSION;
    }
    return Object.assign(
      {},
      _DEFAULTS,
      parsed,
      {
        placement: Object.assign({}, _DEFAULTS.placement, parsed.placement || {}),
      }
    );
  } catch {
    return Object.assign({}, _DEFAULTS, { _schemaV: _SCHEMA_VERSION, placement: Object.assign({}, _DEFAULTS.placement) });
  }
}

function _save(data) {
  try { localStorage.setItem(_KEY, JSON.stringify(data)); } catch {}
}

// Live state — one object, mutated in place so callers always have a ref.
let _current = _load();

/** Returns the current settings object (read-only reference — do not mutate directly). */
export function getCombatDebugSettings() {
  return _current;
}

/**
 * Merges `partial` into settings, persists, and fires `combatDebug:changed`.
 * Handles nested `placement` merging.
 */
export function setCombatDebugSettings(partial) {
  if (partial.placement) {
    _current.placement = Object.assign({}, _current.placement, partial.placement);
    const rest = Object.assign({}, partial);
    delete rest.placement;
    Object.assign(_current, rest);
  } else {
    Object.assign(_current, partial);
  }
  _save(_current);
  try {
    window.dispatchEvent(new CustomEvent('combatDebug:changed', { detail: _current }));
  } catch {}
}

/** Resets all settings to defaults and persists. */
export function resetCombatDebugSettings() {
  _current = Object.assign({}, _DEFAULTS, { placement: Object.assign({}, _DEFAULTS.placement) });
  _save(_current);
  try {
    window.dispatchEvent(new CustomEvent('combatDebug:changed', { detail: _current }));
  } catch {}
}
