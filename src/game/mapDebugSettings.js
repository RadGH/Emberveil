/**
 * mapDebugSettings.js — M221
 * Persistent Map Debug settings (localStorage key: rsg.mapDebug.v1).
 * Consumers call setMapDebugSettings() and listen for mapDebug:changed.
 */

const _KEY = 'rsg.mapDebug.v1';

// M242: default to 5% left/right, 2.5% top/bottom so map nodes sit inside
// the viewport by default. Margin values are applied in MapScreen._nodePos.
// M337: top margin bumped from 2.5% to 7% so the player star and the node
// label above it always render fully inside the canvas instead of clipping
// at the edge.
const _DEFAULTS = {
  boundaryOverlay: false,
  debugNodes: false,   // M406: log node travel + adjacency to console; toggleable from Settings.
  margin: { x: 5, y: 7, w: 5, h: 2.5 },
};

function _load() {
  try {
    const raw = localStorage.getItem(_KEY);
    if (!raw) return Object.assign({}, _DEFAULTS, { margin: Object.assign({}, _DEFAULTS.margin) });
    const parsed = JSON.parse(raw);
    return Object.assign(
      {},
      _DEFAULTS,
      parsed,
      {
        margin: Object.assign({}, _DEFAULTS.margin, parsed.margin || {}),
      }
    );
  } catch {
    return Object.assign({}, _DEFAULTS, { margin: Object.assign({}, _DEFAULTS.margin) });
  }
}

function _save(data) {
  try { localStorage.setItem(_KEY, JSON.stringify(data)); } catch {}
}

// Live state — one object, mutated in place so callers always have a ref.
let _current = _load();

/** Returns the current settings object (read-only reference — do not mutate directly). */
export function getMapDebugSettings() {
  return _current;
}

/**
 * Merges `partial` into settings, persists, and fires `mapDebug:changed`.
 * Handles nested `margin` merging.
 */
export function setMapDebugSettings(partial) {
  if (partial && typeof partial.margin === 'object') {
    _current.margin = Object.assign({}, _current.margin, partial.margin);
    const rest = Object.assign({}, partial);
    delete rest.margin;
    Object.assign(_current, rest);
  } else if (partial) {
    Object.assign(_current, partial);
  }
  _save(_current);
  try {
    window.dispatchEvent(new CustomEvent('mapDebug:changed', { detail: _current }));
  } catch {}
}

/** Resets all settings to defaults and persists. */
export function resetMapDebugSettings() {
  _current = Object.assign({}, _DEFAULTS, { margin: Object.assign({}, _DEFAULTS.margin) });
  _save(_current);
  try {
    window.dispatchEvent(new CustomEvent('mapDebug:changed', { detail: _current }));
  } catch {}
}
