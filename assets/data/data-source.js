/**
 * data-source.js (M299)
 *
 * Shared browser ESM module for all devtool catalog pages.
 * Loaded via: <script type="module" src="./data/data-source.js">
 *
 * Each getter returns a Promise resolving to live data fetched from the
 * JSON files under /assets/data/, OR a localStorage override if the user
 * has uploaded one via data-overrides.html.
 *
 * Override keys: emberveil.dataOverride.<type>
 * e.g. localStorage key "emberveil.dataOverride.companions" → parsed JSON
 */

const LS_PREFIX = 'emberveil.dataOverride.';

// Resolve the base path for data files relative to this script's location.
// This file lives at /assets/data/data-source.js so JSON files are siblings.
const _base = (function () {
  try {
    const u = new URL(import.meta.url);
    // Strip filename, keep directory.
    return u.href.replace(/\/[^/]+$/, '/');
  } catch (_) {
    return './';
  }
})();

/**
 * Fetch a JSON file with localStorage override support.
 * @param {string} type - e.g. 'companions', 'enemies'
 * @returns {Promise<any>}
 */
async function _get(type) {
  const lsKey = LS_PREFIX + type;
  const stored = localStorage.getItem(lsKey);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (_) {
      console.warn(`[data-source] Corrupt override for "${type}"; falling back to live data.`);
      localStorage.removeItem(lsKey);
    }
  }
  const url = _base + type + '.json';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`[data-source] Failed to fetch ${url}: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Public API — one getter per data type
// ---------------------------------------------------------------------------

/** @returns {Promise<Array>} Companions (pets, hireables, wild, dragon companions) */
export function getCompanions()    { return _get('companions'); }

/** @returns {Promise<Array>} Playable classes */
export function getClasses()       { return _get('classes'); }

/** @returns {Promise<Array>} All enemies across all acts */
export function getEnemies()       { return _get('enemies'); }

/** @returns {Promise<Array>} Dungeon definitions from mapData.js */
export function getDungeons()      { return _get('dungeons'); }

/** @returns {Promise<Array>} Status effect metadata from STATUS_META */
export function getStatusEffects() { return _get('status-effects'); }

/** @returns {Promise<Array>} Achievement definitions */
export function getAchievements()  { return _get('achievements'); }

/** @returns {Promise<Array>} Skill definitions */
export function getSkills()        { return _get('skills'); }

/** @returns {Promise<Object>} Affix pools (prefixes, suffixes, shield) */
export function getAffixes()       { return _get('affixes'); }

/** @returns {Promise<Object>} Item base types (weapons, armor) */
export function getItems()         { return _get('items'); }

/** @returns {Promise<Array>} Boss enemies (xpValue >= 200) */
export function getBosses()        { return _get('bosses'); }

/** @returns {Promise<Object>} Passive trees keyed by class id (M331). */
export function getPassives()      { return _get('passives'); }

// ---------------------------------------------------------------------------
// Override management utilities (used by data-overrides.html)
// ---------------------------------------------------------------------------

export const DATA_TYPES = [
  'companions', 'classes', 'enemies', 'dungeons',
  'status-effects', 'achievements', 'skills',
  'affixes', 'items', 'bosses', 'passives',
];

/**
 * Returns the current override status for each data type.
 * @returns {Object} { [type]: { hasOverride: bool, size: number|null } }
 */
export function getOverrideStatus() {
  const result = {};
  for (const type of DATA_TYPES) {
    const raw = localStorage.getItem(LS_PREFIX + type);
    result[type] = raw
      ? { hasOverride: true, size: raw.length }
      : { hasOverride: false, size: null };
  }
  return result;
}

/**
 * Store a JSON override for a data type.
 * @param {string} type
 * @param {any} data
 */
export function setOverride(type, data) {
  localStorage.setItem(LS_PREFIX + type, JSON.stringify(data));
}

/**
 * Remove override for a single type.
 * @param {string} type
 */
export function clearOverride(type) {
  localStorage.removeItem(LS_PREFIX + type);
}

/** Remove all overrides. */
export function clearAllOverrides() {
  for (const type of DATA_TYPES) {
    localStorage.removeItem(LS_PREFIX + type);
  }
}
