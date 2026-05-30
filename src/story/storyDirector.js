/**
 * storyDirector.js — Storyteller Director engine v1 (M-S14).
 *
 * Public API:
 *   recordTick(gs, nodeOutcome)     — update recentHistory ringbuffer
 *   applyPressure(gs, delta, reason) — clamp 0..100
 *   pressureBand(gs)                — 'calm'|'tense'|'urgent'|'crisis'
 *   getDirectorIntent(gs, opts)     — 2-layer hard-filter + soft-score
 *   stepDirector(gs)                — wraps getDirectorIntent, persists rngState
 *   inspectCandidates(gs)           — debug score breakdown
 *   forceIntent(gs, intentObj)      — debug bypass
 *
 * Design constraints:
 *   - gs.story is Set-free; JSON.stringify round-trips cleanly.
 *   - RNG comes from mulberry32 seeded by gs.story.rngState.
 *   - No browser APIs; fully runnable in Node (sim harness).
 */

import { mulberry32 } from '../game/simulator.js';
import {
  getStoryteller,
  applyChroniclerCoherenceBonus,
  tryAshProphetOmen,
  tryTricksterChaos,
  applyPilgrimBonus,
  shouldIronJudgeAmbush,
} from './storyStorytellers.js';

// ---------------------------------------------------------------------------
// Ring-buffer caps (per §7.3)
// ---------------------------------------------------------------------------
const CAP_NODE_TYPES     = 10;
const CAP_ENEMY_FAMILIES = 10;
const CAP_SKILL_LABELS   = 10;
const CAP_REWARD_TYPES   = 10;
const CAP_BIOMES         = 5;
const CAP_TONES          = 8;

// ---------------------------------------------------------------------------
// FALLBACK_CANDIDATE — always-eligible, rock-bottom weight travel beat.
// Fired when every authored candidate fails the hard filter AND the storyteller
// allows fallback (fallbackAllowed === true).
// ---------------------------------------------------------------------------
export const FALLBACK_CANDIDATE = {
  id: '_fallback_travel_beat',
  type: 'event',
  biomes: ['anyBiome'],
  act: [1, 2, 3],
  themeTags: [],
  baseWeight: 0.01,
  enemyComposition: [],
  budgetWeight: 0,
  requires: null,
  factionRequirement: null,
  _isFallback: true,
};

// ---------------------------------------------------------------------------
// Difficulty presets (inline copy for Director; canonical at data/story/difficulty-presets.json)
// ---------------------------------------------------------------------------
const DIFFICULTY_PRESETS = {
  relaxed:   { budgetMult: 0.75 },
  normal:    { budgetMult: 1.0 },
  hard:      { budgetMult: 1.25 },
  nightmare: { budgetMult: 1.5 },
};

export { DIFFICULTY_PRESETS };

// ---------------------------------------------------------------------------
// Candidate registry — loaded lazily. In the sim we load encounter templates;
// in the browser the same function works via dynamic import.
// ---------------------------------------------------------------------------
let _candidateCache = null;

async function _loadCandidates() {
  if (_candidateCache) return _candidateCache;

  try {
    // Node path: read JSON directly.
    if (typeof process !== 'undefined' && process.versions?.node) {
      const { readFileSync } = await import('node:fs');
      const { fileURLToPath } = await import('node:url');
      const { dirname, resolve } = await import('node:path');

      // Walk up to game13 root from this module's location (ESM — no __dirname).
      const here = dirname(fileURLToPath(import.meta.url));
      const dataPath = resolve(here, '../../data/story/encounter-templates/_starter.json');
      const raw = JSON.parse(readFileSync(dataPath, 'utf8'));
      _candidateCache = Array.isArray(raw) ? raw : [raw];
    } else {
      // Browser: return empty; encounter-builder provides real templates.
      _candidateCache = [];
    }
  } catch {
    _candidateCache = [];
  }

  return _candidateCache;
}

/**
 * Synchronous candidate access (returns cached or empty). Used in hot paths
 * after an initial warm-up via getCandidates().
 */
function _getCandidatesSync() {
  return _candidateCache || [];
}

/**
 * Warm the candidate cache and return it.
 */
export async function getCandidates() {
  return _loadCandidates();
}

// ---------------------------------------------------------------------------
// Recent-history helpers
// ---------------------------------------------------------------------------

function _pushFront(arr, value, cap) {
  arr.unshift(value);
  if (arr.length > cap) arr.length = cap;
}

// ---------------------------------------------------------------------------
// recordTick — update recentHistory ringbuffer after a node resolves
// ---------------------------------------------------------------------------

/**
 * Push nodeOutcome fields into the recentHistory ringbuffer.
 *
 * @param {object} gs          — live game state
 * @param {object} nodeOutcome — { type, enemyFamily?, skillLabel?, rewardType?, biome?, tone? }
 */
export function recordTick(gs, nodeOutcome) {
  // Ensure recentHistory exists and has all required fields.
  if (!gs.story.recentHistory) {
    gs.story.recentHistory = {
      nodeTypes: [], enemyFamilies: [], skillLabels: [],
      rewardTypes: [], biomes: [], tones: [],
      sameTypeStreak: 0, lastType: null,
    };
  }
  const rh = gs.story.recentHistory;
  if (!Array.isArray(rh.nodeTypes))     rh.nodeTypes     = [];
  if (!Array.isArray(rh.enemyFamilies)) rh.enemyFamilies = [];
  if (!Array.isArray(rh.skillLabels))   rh.skillLabels   = [];
  if (!Array.isArray(rh.rewardTypes))   rh.rewardTypes   = [];
  if (!Array.isArray(rh.biomes))        rh.biomes        = [];
  if (!Array.isArray(rh.tones))         rh.tones         = [];
  if (rh.sameTypeStreak == null)        rh.sameTypeStreak = 0;

  const type        = nodeOutcome.type        || null;
  const enemyFamily = nodeOutcome.enemyFamily || null;
  const skillLabel  = nodeOutcome.skillLabel  || null;
  const rewardType  = nodeOutcome.rewardType  || null;
  const biome       = nodeOutcome.biome       || null;
  const tone        = nodeOutcome.tone        || (nodeOutcome.themeTags?.[0]) || null;

  // Streak tracking must happen BEFORE push.
  if (type === rh.lastType) {
    rh.sameTypeStreak = (rh.sameTypeStreak || 0) + 1;
  } else {
    rh.sameTypeStreak = 1;
    rh.lastType = type;
  }

  if (type        !== null) _pushFront(rh.nodeTypes,     type,        CAP_NODE_TYPES);
  if (enemyFamily !== null) _pushFront(rh.enemyFamilies, enemyFamily, CAP_ENEMY_FAMILIES);
  if (skillLabel  !== null) _pushFront(rh.skillLabels,   skillLabel,  CAP_SKILL_LABELS);
  if (rewardType  !== null) _pushFront(rh.rewardTypes,   rewardType,  CAP_REWARD_TYPES);
  if (biome       !== null) _pushFront(rh.biomes,        biome,       CAP_BIOMES);
  if (tone        !== null) _pushFront(rh.tones,         tone,        CAP_TONES);

  // Increment director tick counter.
  if (!gs.story.counters) gs.story.counters = {};
  gs.story.counters._director_ticks = (gs.story.counters._director_ticks || 0) + 1;
}

// ---------------------------------------------------------------------------
// Pressure meter
// ---------------------------------------------------------------------------

/**
 * Apply a pressure delta (positive or negative) clamped to 0..100.
 *
 * @param {object} gs     — game state
 * @param {number} delta  — amount to add (can be negative)
 * @param {string} [reason] — optional log reason
 */
export function applyPressure(gs, delta, reason) {
  if (typeof gs.story.pressureMeter !== 'number') gs.story.pressureMeter = 50;
  const prev = gs.story.pressureMeter;
  gs.story.pressureMeter = Math.max(0, Math.min(100, prev + delta));
  if (reason && gs.story.pressureMeter !== prev && gs.story.debugDirector) {
    // eslint-disable-next-line no-console
    if (typeof console !== 'undefined') console.debug(`[Director] pressure ${prev} -> ${gs.story.pressureMeter} (${reason})`);
  }
}

/**
 * Return the current pressure band name.
 *
 * @param {object} gs
 * @returns {'calm'|'tense'|'urgent'|'crisis'}
 */
export function pressureBand(gs) {
  const p = gs.story.pressureMeter ?? 50;
  if (p >= 80) return 'crisis';
  if (p >= 60) return 'urgent';
  if (p >= 30) return 'tense';
  return 'calm';
}

// ---------------------------------------------------------------------------
// Soft scoring (§7.2)
// ---------------------------------------------------------------------------

function _softScore(c, h, st) {
  let s = c.baseWeight;
  const nodeTypes    = h.nodeTypes    || [];
  const enemyFams    = h.enemyFamilies || [];
  const skillLabels  = h.skillLabels  || [];

  // Node-type recency decay.
  for (let i = 0; i < nodeTypes.length; i++) {
    if (nodeTypes[i] === c.type) s *= Math.pow(0.5, i + 1);
  }

  // Same-type streak penalty.
  if ((h.sameTypeStreak || 0) >= 2 && c.type === h.lastType) s *= 0.05;

  // Enemy-family recency decay.
  if (c.enemyFamily) {
    for (let i = 0; i < enemyFams.length; i++) {
      if (enemyFams[i] === c.enemyFamily) s *= Math.pow(0.6, i + 1);
    }
  }

  // Skill-label variety decay.
  if (c.primarySkill) {
    const floor = Math.max(0.2, st.skillCheckVariety);
    for (let i = 0; i < skillLabels.length; i++) {
      if (skillLabels[i] === c.primarySkill) s *= Math.pow(floor, i + 1);
    }
  }

  // Thematic consistency.
  const themeMatch = Array.isArray(c.themeTags) && c.themeTags.some(t => st.preferredThemes.includes(t));
  if (!themeMatch) s *= (1 - 0.5 * Math.max(0.2, st.thematicConsistency));

  return Math.max(0.001, s);
}

// ---------------------------------------------------------------------------
// Pressure-band candidate adjustment
// ---------------------------------------------------------------------------

function _applyPressureWeights(candidates, band) {
  for (const c of candidates) {
    if (band === 'calm') {
      if (c.type === 'dialog' || c.type === 'lore' || c.type === 'merchant') {
        c._softScore = (c._softScore || c.baseWeight) * 1.3;
      }
    } else if (band === 'urgent') {
      if (c.type === 'combat' || c.type === 'elite') {
        c._softScore = (c._softScore || c.baseWeight) * 1.25;
      }
      if (c.type === 'shrine' || c.type === 'rest') {
        c._softScore = (c._softScore || c.baseWeight) * 0.75;
      }
    }
    // crisis: handled by forcing crisis-tagged candidates (stepDirector tracks this separately)
  }
}

// ---------------------------------------------------------------------------
// Hard filter predicate helper
// ---------------------------------------------------------------------------

function _passesHardFilter(c, gs, storyteller) {
  const act = gs.story.act || 1;
  const rh  = gs.story.recentHistory || { sameTypeStreak: 0, lastType: null };

  // Act check.
  if (Array.isArray(c.act) && !c.act.includes(act)) return false;

  // Biome check (anyBiome bypasses).
  if (!c.biomes?.includes('anyBiome')) {
    const currentBiome = gs.story.currentBiome || 'emberwood';
    if (Array.isArray(c.biomes) && c.biomes.length && !c.biomes.includes(currentBiome)) {
      return false;
    }
  }

  // Streak check.
  const maxStreak = storyteller.rules?.maxSameTypeStreak ?? 3;
  if ((rh.sameTypeStreak || 0) >= maxStreak && c.type === rh.lastType) return false;

  // requires predicate (lightweight inline check — full storyPredicate used in dialog).
  if (c.requires) {
    // Support simple flag checks inline.
    if (c.requires.flag) {
      if (!gs.story.flags?.[c.requires.flag]) return false;
    }
    if (c.requires.not?.flag) {
      if (gs.story.flags?.[c.requires.not.flag]) return false;
    }
  }

  // factionRequirement.
  if (c.factionRequirement) {
    const { faction, min } = c.factionRequirement;
    const rep = gs.story.factions?.[faction] ?? 0;
    if (rep < (min ?? 0)) return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// getDirectorIntent — core 2-layer scoring
// ---------------------------------------------------------------------------

/**
 * Compute the next director intent.
 *
 * @param {object} gs
 * @param {object} [opts]
 * @param {object[]} [opts.candidateOverride] — inject test candidates
 * @returns {{ intent: object, candidates: object[], rngStateBefore: number, rngStateAfter: number }}
 */
export function getDirectorIntent(gs, opts = {}) {
  const storyteller = getStoryteller(gs.story.storytellerId) || getStoryteller('chronicler');
  const rh = gs.story.recentHistory || {
    nodeTypes: [], enemyFamilies: [], skillLabels: [],
    rewardTypes: [], biomes: [], tones: [],
    sameTypeStreak: 0, lastType: null,
  };
  const rngStateBefore = gs.story.rngState || 1;

  // Build RNG from current state.
  const rng = mulberry32(rngStateBefore);
  // Advance once to mix state.
  rng();

  // Candidate source.
  const rawCandidates = opts.candidateOverride ?? _getCandidatesSync();
  const band = pressureBand(gs);

  // ── Ash Prophet omen interrupt ───────────────────────────────────────────
  if (storyteller.uniqueMechanic === 'dark_omen_interrupt') {
    const omen = tryAshProphetOmen(gs, rng);
    if (omen) {
      const rngStateAfter = (rng() * 0xFFFFFFFF) >>> 0 || 1;
      gs.story.rngState = rngStateAfter;
      return {
        intent: omen,
        candidates: [omen],
        rngStateBefore,
        rngStateAfter,
        _omenFired: true,
      };
    }
  }

  // ── Trickster chaos check ────────────────────────────────────────────────
  const isChaosRoll = storyteller.uniqueMechanic === 'every_6th_random'
    ? tryTricksterChaos(gs)
    : false;

  // ── Layer 1: Hard filter ─────────────────────────────────────────────────
  let filtered = rawCandidates.filter(c => _passesHardFilter(c, gs, storyteller));

  // ── Iron Judge: ambush on empty filter ──────────────────────────────────
  if (filtered.length === 0 && storyteller.uniqueMechanic === 'no_fallback_ambush_instead') {
    const ambush = shouldIronJudgeAmbush(true, gs);
    if (ambush) {
      const rngStateAfter = (rng() * 0xFFFFFFFF) >>> 0 || 1;
      gs.story.rngState = rngStateAfter;
      return {
        intent: ambush,
        candidates: [ambush],
        rngStateBefore,
        rngStateAfter,
        _ironJudgeAmbush: true,
      };
    }
  }

  // ── Fallback append ──────────────────────────────────────────────────────
  if (filtered.length === 0 && storyteller.rules?.fallbackAllowed !== false) {
    filtered = [FALLBACK_CANDIDATE];
  }

  // If still empty (Iron Judge with no ambush pool), use fallback anyway.
  if (filtered.length === 0) {
    filtered = [FALLBACK_CANDIDATE];
  }

  // ── Trickster chaos: uniform pick from unfiltered ────────────────────────
  if (isChaosRoll) {
    const pool = rawCandidates.length ? rawCandidates : filtered;
    const idx  = Math.floor(rng() * pool.length);
    const intent = pool[idx];
    const rngStateAfter = (rng() * 0xFFFFFFFF) >>> 0 || 1;
    gs.story.rngState = rngStateAfter;
    return {
      intent,
      candidates: pool.map(c => ({ ...c, _softScore: c.baseWeight, _prob: 1 / pool.length })),
      rngStateBefore,
      rngStateAfter,
      _tricksterChaos: true,
    };
  }

  // ── Layer 2: Soft scoring ────────────────────────────────────────────────
  // Deep-clone to avoid mutating source objects.
  const scored = filtered.map(c => ({ ...c, _softScore: _softScore(c, rh, storyteller) }));

  // Apply pressure-band weights.
  _applyPressureWeights(scored, band);

  // Chronicler coherence bonus.
  if (storyteller.uniqueMechanic === 'narrative_coherence_bonus') {
    applyChroniclerCoherenceBonus(scored, rh, storyteller);
  }

  // Pilgrim discovery bonus.
  if (storyteller.uniqueMechanic === 'discovery_pool_3x') {
    applyPilgrimBonus(scored);
  }

  // Crisis band: boost crisis-tagged candidates.
  if (band === 'crisis') {
    for (const c of scored) {
      if (Array.isArray(c.themeTags) && c.themeTags.includes('crisis')) {
        c._softScore *= 10;
      }
    }
  }

  // Normalize.
  const total = scored.reduce((s, c) => s + (c._softScore || 0.001), 0);
  for (const c of scored) {
    c._prob = (c._softScore || 0.001) / total;
  }

  // Weighted sample via mulberry32.
  const roll = rng();
  let cumul = 0;
  let intent = scored[scored.length - 1]; // default to last
  for (const c of scored) {
    cumul += c._prob;
    if (roll < cumul) { intent = c; break; }
  }

  const rngStateAfter = (rng() * 0xFFFFFFFF) >>> 0 || 1;
  gs.story.rngState = rngStateAfter;

  return {
    intent,
    candidates: scored,
    rngStateBefore,
    rngStateAfter,
  };
}

// ---------------------------------------------------------------------------
// stepDirector — top-level wrapper used by sim and game loop
// ---------------------------------------------------------------------------

/**
 * Run one director tick:
 *   1. Compute intent via getDirectorIntent.
 *   2. Persist updated rngState back to gs.story.
 *   3. Return the intent.
 *
 * @param {object} gs
 * @param {object} [opts]
 * @returns {object} intent
 */
export function stepDirector(gs, opts = {}) {
  const result = getDirectorIntent(gs, opts);
  // rngState is already updated inside getDirectorIntent.
  return result.intent;
}

// ---------------------------------------------------------------------------
// inspectCandidates — debug API
// ---------------------------------------------------------------------------

/**
 * Returns candidates with full score breakdown for the current gs.
 * Does NOT advance rngState — uses a fresh rng from the current state.
 *
 * @param {object} gs
 * @returns {object[]} candidates with _softScore, _prob, _passesHard
 */
export function inspectCandidates(gs) {
  const storyteller = getStoryteller(gs.story.storytellerId) || getStoryteller('chronicler');
  const rh = gs.story.recentHistory;
  const rawCandidates = _getCandidatesSync();

  return rawCandidates.map(c => {
    const passesHard = _passesHardFilter(c, gs, storyteller);
    const score = _softScore(c, rh, storyteller);
    return {
      id: c.id,
      type: c.type,
      baseWeight: c.baseWeight,
      _passesHard: passesHard,
      _softScore: score,
      _prob: null, // normalized prob requires full set; call getDirectorIntent for that
    };
  });
}

// ---------------------------------------------------------------------------
// forceIntent — debug bypass
// ---------------------------------------------------------------------------

/**
 * Force a specific intent object (bypasses all scoring).
 * Advances rngState by one step to maintain stream consistency.
 *
 * @param {object} gs
 * @param {object} intentObj
 */
export function forceIntent(gs, intentObj) {
  const rng = mulberry32(gs.story.rngState || 1);
  rng(); // consume one value
  gs.story.rngState = (rng() * 0xFFFFFFFF) >>> 0 || 1;
  gs.story._forcedIntent = intentObj;
}
