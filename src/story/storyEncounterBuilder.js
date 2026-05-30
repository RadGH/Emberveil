/**
 * storyEncounterBuilder.js — Full encounter builder (M-S16).
 *
 * Builds encounter objects from director-assigned
 * templates using role-family resolution, budget scaling, and 4 guardrails.
 *
 * Public API:
 *   resolveEnemyId(role, family, act, rng)     — role-family → enemy id
 *   buildEncounterForNode(gs, nodeId, template) — full encounter object
 *   queueEncounter(gs, templateId)             — set pending flag
 *   encounterBudget(gs, candidate, storyteller) — 4-guardrail budget
 */

import { ENEMIES, ENCOUNTERS } from '../maps/mapData.js';
import { DIFFICULTY_PRESETS } from './storyDirector.js';

// ---------------------------------------------------------------------------
// Role-family index — built once at module load.
// ---------------------------------------------------------------------------

const ROLE_FAMILY_INDEX = (() => {
  const idx = new Map();
  for (const eid of Object.keys(ENEMIES)) {
    const e = ENEMIES[eid];
    const role = e.role || _inferRole(e);
    const fam  = e.family || 'generic';
    const key  = `${role}::${fam}`;
    if (!idx.has(key)) idx.set(key, []);
    idx.get(key).push(eid);
  }
  return idx;
})();

function _inferRole(e) {
  if ((e.armor || 0) > 8) return 'frontline';
  if ((e.spells || []).length) return 'caster';
  if (Array.isArray(e.dmg) && e.dmg[1] > 20) return 'striker';
  return 'frontline';
}

// ---------------------------------------------------------------------------
// Encounter-template registry (loaded lazily in Node; injected in browser)
// ---------------------------------------------------------------------------

let _templateCache = null;

async function _loadTemplates() {
  if (_templateCache) return _templateCache;
  try {
    if (typeof process !== 'undefined' && process.versions?.node) {
      const { readFileSync } = await import('node:fs');
      const { fileURLToPath } = await import('node:url');
      const { dirname, resolve } = await import('node:path');
      const here = dirname(fileURLToPath(import.meta.url));
      const dataPath = resolve(here, '../../data/story/encounter-templates/_starter.json');
      const raw = JSON.parse(readFileSync(dataPath, 'utf8'));
      _templateCache = {};
      for (const t of (Array.isArray(raw) ? raw : [raw])) {
        _templateCache[t.id] = t;
      }
    } else {
      _templateCache = {};
    }
  } catch {
    _templateCache = {};
  }
  return _templateCache;
}

function _getTemplatesSync() {
  return _templateCache || {};
}

export async function warmTemplateCache() {
  return _loadTemplates();
}

// ---------------------------------------------------------------------------
// resolveEnemyId — §8.2 role-family resolver
// ---------------------------------------------------------------------------

/**
 * Resolve an enemy id from a role + family descriptor.
 *
 * @param {string}   role   — 'frontline'|'caster'|'striker'|'support'
 * @param {string}   family — e.g. 'cultist', 'beast', 'generic'
 * @param {number}   act    — current act (unused for now; reserved for act-gating)
 * @param {Function} rng    — seeded rng function
 * @returns {string|null}   — enemy id or null if no match found
 */
export function resolveEnemyId(role, family, act, rng) {
  const key = `${role}::${family}`;
  const pool = ROLE_FAMILY_INDEX.get(key) || ROLE_FAMILY_INDEX.get(`${role}::generic`) || [];
  if (!pool.length) {
    // Last resort: any enemy in the role.
    const fallbackPool = [];
    for (const [k, ids] of ROLE_FAMILY_INDEX.entries()) {
      if (k.startsWith(`${role}::`)) fallbackPool.push(...ids);
    }
    if (!fallbackPool.length) return null;
    return fallbackPool[Math.floor(rng() * fallbackPool.length)];
  }
  return pool[Math.floor(rng() * pool.length)];
}

// ---------------------------------------------------------------------------
// encounterBudget — §8.5 four-guardrail formula
// ---------------------------------------------------------------------------

/**
 * Compute encounter budget (point total for enemy scaling).
 *
 * @param {object} gs          — game state
 * @param {object} candidate   — encounter template (has budgetWeight)
 * @param {object} storyteller — storyteller profile
 * @returns {number}           — budget integer
 */
export function encounterBudget(gs, candidate, storyteller) {
  const party = gs.party || [];
  const partyAvgLevel = party.length
    ? Math.round(party.reduce((s, m) => s + (m.level || 1), 0) / party.length)
    : 1;

  let base = (candidate.budgetWeight ?? 1.0) * (10 * partyAvgLevel + 5 * (gs.story.act || 1));

  // Guardrail 1: post-brutal-fight de-escalation.
  if ((gs.story.recentPerformance?.brutalScore ?? 0) >= 1) base *= 0.8;

  // Guardrail 2: pressure meter.
  const pressure = gs.story.pressureMeter ?? 50;
  if (pressure >= 80) base *= 1.2;
  else if (pressure <= 30) base *= 0.9;

  // Guardrail 3: Warbringer momentum.
  if (storyteller?.uniqueMechanic === 'momentum_escalation') {
    base *= 1 + Math.min(0.5, 0.1 * (gs.story.counters?.winStreak || 0));
  }

  // Guardrail 4: difficulty preset.
  const preset = DIFFICULTY_PRESETS[gs.story.difficulty] || DIFFICULTY_PRESETS.normal;
  base *= preset.budgetMult;

  return Math.max(1, Math.round(base));
}

// ---------------------------------------------------------------------------
// buildEncounterForNode — main builder
// ---------------------------------------------------------------------------

/**
 * Build a flat encounter object that runSimulation expects.
 *
 * @param {object} gs         — game state
 * @param {string} nodeId     — current node id
 * @param {object} [template] — encounter template; if omitted, looks up from pending queue
 * @param {Function} [rng]    — optional seeded rng (uses gs.story.rngState if omitted)
 * @returns {object}          — encounter object with enemies[] array
 */
export function buildEncounterForNode(gs, nodeId, template, rng) {
  // If no template supplied, check for a queued template.
  if (!template) {
    // Look for a _queued_encounter_ flag.
    const queuedKey = Object.keys(gs.story.flags || {})
      .find(k => k.startsWith('_queued_encounter_'));
    if (queuedKey) {
      const templateId = queuedKey.replace('_queued_encounter_', '');
      delete gs.story.flags[queuedKey];
      template = _getTemplatesSync()[templateId] || null;
    }
  }

  // No template resolved → fall back to a random ENCOUNTERS entry from
  // mapData.js so combat ALWAYS starts on a combat node in the live game.
  // M520 — root cause of "Travel does nothing" was no-template returning null.
  // The Director-driven template-queue layer can later override by setting
  // a `_queued_encounter_<id>` flag before travel resolves.
  if (!template) {
    const keys = Object.keys(ENCOUNTERS);
    if (keys.length) {
      // Pick deterministically per node so re-entry doesn't reroll.
      const { mulberry32 } = _mulberry32Import();
      const seed = (_hashStr(nodeId) ^ (gs.story?.rngState || 1)) >>> 0 || 1;
      const r = mulberry32(seed);
      const k = keys[Math.floor(r() * keys.length)];
      return _normalizeRawEncounter(k, ENCOUNTERS[k]) || _guaranteedFallbackEncounter(nodeId, r);
    }
    const { mulberry32 } = _mulberry32Import();
    const r = mulberry32((_hashStr(nodeId) ^ (gs.story?.rngState || 1)) >>> 0 || 1);
    return _guaranteedFallbackEncounter(nodeId, r);
  }

  // Build seeded rng if not provided.
  if (!rng) {
    const { mulberry32 } = _mulberry32Import();
    const nodeSeed = _hashStr(nodeId) ^ (gs.story.rngState || 1);
    rng = mulberry32(nodeSeed >>> 0 || 1);
  }

  const act = gs.story.act || 1;
  const enemies = [];

  for (const comp of (template.enemyComposition || [])) {
    const count  = comp.count || 1;
    const role   = comp.role   || 'frontline';
    const family = comp.family || 'generic';

    const enemyId = resolveEnemyId(role, family, act, rng);
    if (enemyId) {
      // Check if this enemy id exists in ENEMIES; if not, try a generic ENCOUNTERS entry.
      const baseEnemy = ENEMIES[enemyId];
      enemies.push({
        id: enemyId,
        count,
        ...(baseEnemy ? {} : {}), // let runSimulation look up by id
      });
    }
  }

  // Fallback: if no enemies resolved, pick from raw ENCOUNTERS.
  if (!enemies.length) {
    const keys = Object.keys(ENCOUNTERS);
    if (keys.length) {
      const k = keys[Math.floor(rng() * keys.length)];
      return _normalizeRawEncounter(k, ENCOUNTERS[k]) || _guaranteedFallbackEncounter(nodeId, rng);
    }
    return _guaranteedFallbackEncounter(nodeId, rng);
  }

  // Determine gold range from template.
  const goldRange = template.rewards?.goldRange || [20, 60];

  return {
    id: template.id,
    enemies,
    goldRange,
    lootTier: template.rewards?.lootTier || 1,
    themeTags: template.themeTags || [],
    _fromTemplate: template.id,
  };
}

function _normalizeRawEncounter(key, encounter) {
  if (!encounter) return null;
  if (Array.isArray(encounter.enemies)) {
    return {
      id: encounter.id || key,
      ...encounter,
      enemies: encounter.enemies,
      _fromRawEncounters: true,
    };
  }
  return null;
}

function _guaranteedFallbackEncounter(nodeId, rng = Math.random) {
  const ids = Object.keys(ENEMIES);
  if (!ids.length) {
    return {
      id: `story_fallback_${nodeId || 'node'}`,
      enemies: [],
      goldRange: [0, 0],
      lootTier: 0,
      themeTags: ['fallback'],
      _fallbackReason: 'enemy_registry_empty',
    };
  }

  const enemyId = ids[Math.floor(rng() * ids.length)] || ids[0];
  const enemy = ENEMIES[enemyId] || {};
  return {
    id: `story_fallback_${nodeId || 'node'}`,
    enemies: [{ id: enemyId, count: 1, ...enemy }],
    goldRange: enemy.gold || [5, 15],
    lootTier: 1,
    themeTags: ['fallback'],
    _fallbackReason: 'encounter_template_unresolved',
  };
}

// ---------------------------------------------------------------------------
// queueEncounter — set pending flag
// ---------------------------------------------------------------------------

/**
 * Queue an encounter template for the next node resolution.
 *
 * @param {object} gs         — game state
 * @param {string} templateId — encounter template id
 */
export function queueEncounter(gs, templateId) {
  if (!gs?.story) return;
  if (!gs.story.flags) gs.story.flags = {};
  gs.story.flags[`_queued_encounter_${templateId}`] = true;

  // Also record in encounterHistory for the current node.
  const nodeId = gs.story.currentNodeId || '_unknown';
  if (!gs.story.encounterHistory) gs.story.encounterHistory = {};
  gs.story.encounterHistory[nodeId] = { templateId, builtAt: Date.now() };
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/** FNV-1a 32-bit hash. */
function _hashStr(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (Math.imul(h, 0x01000193)) >>> 0;
  }
  return h >>> 0;
}

/** Lazy mulberry32 import (avoids circular dep at module init time). */
let _mulberry32Cache = null;
function _mulberry32Import() {
  if (_mulberry32Cache) return _mulberry32Cache;
  // Synchronous import won't work for ESM dynamic — use the inline copy.
  _mulberry32Cache = {
    mulberry32(seed) {
      let a = (seed | 0) || 1;
      return function () {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
  };
  return _mulberry32Cache;
}
