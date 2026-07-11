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

// Re-export so routing consumers (sim policy, live game) can resolve a profile
// without a second import path.
export { getStoryteller };

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
// Node-type → theme affinity (routing source of truth)
//
// Map nodes carry a `type` but rarely carry themeTags. To let the storyteller
// profile (preferredThemes) actually bias which map nodes get chosen, we map
// each node type to the theme tags it embodies. A storyteller "wants" a node
// type when any of that type's themes is in its preferredThemes list.
// ---------------------------------------------------------------------------
export const NODE_TYPE_THEMES = {
  combat:   ['combat', 'ambush', 'siege', 'glory', 'judgment', 'punishment', 'trial', 'doom'],
  elite:    ['combat', 'ambush', 'siege', 'glory', 'judgment', 'trial'],
  boss:     ['combat', 'glory', 'judgment', 'siege', 'doom'],
  dialog:   ['lore', 'investigation', 'faction', 'memory', 'mystery', 'surprise'],
  lore:     ['lore', 'investigation', 'ancient', 'memory', 'hidden', 'discovery', 'prophecy'],
  shrine:   ['omen', 'ash', 'prophecy', 'ancient', 'hidden', 'discovery', 'doom'],
  event:    ['chaos', 'surprise', 'mystery', 'trick', 'omen', 'discovery'],
  merchant: ['trade', 'faction', 'surprise'],
  rest:     ['memory', 'discovery'],
  town:     ['faction', 'trade', 'lore'],
  hidden:   ['hidden', 'discovery', 'ancient', 'lore', 'mystery'],
  trailhead: [],
};

// Node types the game treats as "combat" for combatFrequency bias.
const COMBAT_NODE_TYPES = new Set(['combat', 'elite', 'boss']);

/**
 * scoreNodeForStoryteller — the single routing-bias score for a map node.
 *
 * Used by BOTH the headless sim (directorAware policy) and the live game
 * (StoryMapScreen recommendation) so routing is identical in both.
 *
 * Combines four storyteller-driven terms into a positive score:
 *   1. Novelty       — unvisited nodes preferred (keeps runs moving).
 *   2. CombatBias    — combatFrequency pushes toward/away from fights.
 *   3. ThemeAffinity — preferredThemes matching the node's themes.
 *   4. IntentMatch   — the director's current intent.type (soft nudge).
 *
 * All terms are additive and bounded so nothing can drive the score negative
 * (the flaw the roast called out). Result is always > 0.
 *
 * @param {object} node        — map node ({ type, biome, tags, themeTags })
 * @param {string} nodeId
 * @param {Set}    visitedSet
 * @param {object} storyteller — profile from getStoryteller()
 * @param {object} [ctx]       — { intent, band }
 * @returns {number} score (>0)
 */
export function scoreNodeForStoryteller(node, nodeId, visitedSet, storyteller, ctx = {}) {
  const st = storyteller || {};
  const nodeType = node?.type || 'unknown';
  const isCombat = COMBAT_NODE_TYPES.has(nodeType);

  // Base so nothing is ever zero; keeps weighted sampling well-formed.
  let score = 1;

  // 1. Novelty — always prefer somewhere new.
  if (visitedSet && !visitedSet.has(nodeId)) score += 8;

  // 2. Combat-frequency bias. combatFrequency in [0.35, 0.7]. Center on 0.5:
  //    warbringer(0.7) strongly favors combat; pilgrim(0.35) strongly avoids it.
  const cf = typeof st.combatFrequency === 'number' ? st.combatFrequency : 0.5;
  const combatPull = (cf - 0.5) * 40; // range roughly -6 .. +8
  if (isCombat) {
    score += 12 + combatPull;          // combat nodes: high base, scaled by cf
  } else {
    score += 8 - combatPull;           // non-combat: rewarded when cf is low
  }

  // 3. Theme affinity — does this node type embody a preferred theme?
  const themes = new Set([
    ...(NODE_TYPE_THEMES[nodeType] || []),
    ...(Array.isArray(node?.themeTags) ? node.themeTags : []),
    ...(Array.isArray(node?.tags) ? node.tags : []),
  ]);
  const preferred = Array.isArray(st.preferredThemes) ? st.preferredThemes : [];
  let themeHits = 0;
  for (const t of preferred) if (themes.has(t)) themeHits++;
  // thematicConsistency scales how hard preferred themes pull.
  const themeWeight = 6 * (0.4 + (st.thematicConsistency ?? 0.6));
  score += themeHits * themeWeight;

  // 4. Director intent nudge (soft — a fraction of the profile terms so the
  //    profile, not one sampled intent, dominates routing).
  const intent = ctx.intent;
  if (intent) {
    if (intent.type && intent.type === nodeType) score += 5;
    const wantTags = new Set([
      ...(Array.isArray(intent.themeTags) ? intent.themeTags : []),
    ]);
    for (const t of themes) if (wantTags.has(t)) score += 1.5;
    // Iron Judge ambush / fallback-combat lean.
    if (intent._ironJudgeAmbush && isCombat) score += 10;
    if (intent._isFallback && isCombat) score += 2;
  }

  // Pressure band: urgent/crisis nudge toward combat, calm toward respite.
  if (ctx.band === 'urgent' || ctx.band === 'crisis') {
    if (isCombat) score += 4;
  } else if (ctx.band === 'calm') {
    if (nodeType === 'rest' || nodeType === 'shrine' || nodeType === 'lore') score += 2;
  }

  return Math.max(0.001, score);
}

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

// Soft-score temperature: a floor multiplier so stacked penalties can dampen a
// candidate but never annihilate it. Without this, three or four recency hits
// drive s toward ~0 and every candidate ends up equally (in)eligible, making
// the weighted sample arbitrary (the flaw the design roast flagged).
const SOFT_FLOOR = 0.15;

function _decayFactor(matchCount, ratePerHit) {
  // Bounded decay: geometric but floored at SOFT_FLOOR so it never collapses.
  const raw = Math.pow(ratePerHit, matchCount);
  return SOFT_FLOOR + (1 - SOFT_FLOOR) * raw;
}

function _softScore(c, h, st) {
  let s = c.baseWeight;
  const nodeTypes    = h.nodeTypes    || [];
  const enemyFams    = h.enemyFamilies || [];
  const skillLabels  = h.skillLabels  || [];

  // Node-type recency decay (variety), bounded.
  let typeHits = 0;
  for (let i = 0; i < nodeTypes.length; i++) if (nodeTypes[i] === c.type) typeHits++;
  if (typeHits) s *= _decayFactor(typeHits, 0.6);

  // Same-type streak penalty — bounded, not annihilating.
  if ((h.sameTypeStreak || 0) >= 2 && c.type === h.lastType) s *= SOFT_FLOOR;

  // Enemy-family recency decay, bounded.
  if (c.enemyFamily) {
    let famHits = 0;
    for (let i = 0; i < enemyFams.length; i++) if (enemyFams[i] === c.enemyFamily) famHits++;
    if (famHits) s *= _decayFactor(famHits, 0.65);
  }

  // Skill-label variety decay, bounded by skillCheckVariety.
  if (c.primarySkill) {
    const rate = Math.max(0.3, st.skillCheckVariety ?? 0.5);
    let skHits = 0;
    for (let i = 0; i < skillLabels.length; i++) if (skillLabels[i] === c.primarySkill) skHits++;
    if (skHits) s *= _decayFactor(skHits, rate);
  }

  // Thematic bias — a REWARD for matching preferred themes (not just a penalty
  // for missing), scaled by thematicConsistency. This is what makes different
  // storytellers weight the same candidate pool differently.
  const preferred = Array.isArray(st.preferredThemes) ? st.preferredThemes : [];
  const nodeThemes = new Set([
    ...(Array.isArray(c.themeTags) ? c.themeTags : []),
    ...(NODE_TYPE_THEMES[c.type] || []),
  ]);
  let themeHits = 0;
  for (const t of preferred) if (nodeThemes.has(t)) themeHits++;
  const consistency = Math.max(0.2, st.thematicConsistency ?? 0.6);
  if (themeHits > 0) {
    s *= 1 + consistency * Math.min(themeHits, 3); // up to ~3x for strong match
  } else {
    s *= 1 - 0.4 * consistency; // mild penalty for off-theme
  }

  // Combat-frequency bias on the candidate itself.
  const cf = typeof st.combatFrequency === 'number' ? st.combatFrequency : 0.5;
  if (COMBAT_NODE_TYPES.has(c.type)) {
    s *= 1 + (cf - 0.5) * 1.2;   // warbringer boosts combat, pilgrim damps it
  } else {
    s *= 1 - (cf - 0.5) * 1.2;
  }

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
  const intent = result.intent || {};
  // Stamp routing context onto the intent so the router (sim policy AND the
  // live game) can bias node choice by the storyteller profile — the single
  // source of truth for storyteller differentiation.
  const storyteller = getStoryteller(gs.story.storytellerId) || getStoryteller('chronicler');
  intent._profile = storyteller;
  intent._storytellerId = storyteller?.id || gs.story.storytellerId || null;
  intent._band = pressureBand(gs);
  if (result._ironJudgeAmbush) intent._ironJudgeAmbush = true;
  if (result._tricksterChaos) intent._tricksterChaos = true;
  if (result._omenFired) intent._omenFired = true;
  return intent;
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
