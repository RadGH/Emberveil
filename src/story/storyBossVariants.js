/**
 * storyBossVariants.js — Boss variant system (M-S17 §8.4).
 *
 * Reads variant definitions from data/story/boss-variants/<bossId>.json.
 * Evaluates conditions via evalPredicate (lightweight inline for common ops).
 * Applies variant statMultipliers, nameOverride, and registers variant phases
 * via registerVariantPhases (added to bossPhases.js in this same milestone).
 *
 * Public API:
 *   resolveVariant(gs, bossId)    — returns matched variant object or null
 *   applyVariant(encounter, variant, gs) — applies stat changes + phase registration
 */

import { evalPredicate } from './storyPredicate.js';
import { registerVariantPhases } from '../game/bossPhases.js';

// ---------------------------------------------------------------------------
// Variant registry cache
// ---------------------------------------------------------------------------
const _variantCache = {};

/**
 * Load variant definitions for a bossId. Synchronous in Node (readFileSync);
 * falls back to {} in browser (variants registered at build time eventually).
 *
 * @param {string} bossId
 * @returns {object|null} — the variant file { bossId, variants: [...] }
 */
function _loadVariantDefs(bossId) {
  if (_variantCache[bossId] !== undefined) return _variantCache[bossId];

  try {
    if (typeof process !== 'undefined' && process.versions?.node) {
      // Use globalThis.require to avoid ESLint no-undef on 'require' in ESM.
      const nodeFs   = globalThis.require?.('fs');
      const nodePath = globalThis.require?.('path');
      const here = process.cwd();
      if (nodeFs && nodePath) {
        const filePath = nodePath.resolve(here, `src/story/../../data/story/boss-variants/${bossId}.json`);
        if (nodeFs.existsSync(filePath)) {
          _variantCache[bossId] = JSON.parse(nodeFs.readFileSync(filePath, 'utf8'));
        } else {
          _variantCache[bossId] = null;
        }
      } else {
        _variantCache[bossId] = null;
      }
    } else {
      _variantCache[bossId] = null;
    }
  } catch {
    _variantCache[bossId] = null;
  }

  return _variantCache[bossId];
}

/**
 * Register variant definitions at runtime (for test injection or browser use).
 *
 * @param {string} bossId
 * @param {object} defs — { bossId, variants: [...] }
 */
export function registerVariantDefs(bossId, defs) {
  _variantCache[bossId] = defs;
}

// ---------------------------------------------------------------------------
// resolveVariant
// ---------------------------------------------------------------------------

/**
 * Evaluate variant conditions for a boss and return the first matching variant.
 *
 * Conditions use the storyPredicate evalPredicate DSL. All flag/counter/faction
 * predicates are supported. Additionally, companion conditions are checked via
 * the gs.story.companions array.
 *
 * @param {object} gs     — game state
 * @param {string} bossId — enemy id of the boss
 * @returns {object|null} — matched variant object or null
 */
export function resolveVariant(gs, bossId) {
  const defs = _loadVariantDefs(bossId);
  if (!defs || !Array.isArray(defs.variants)) return null;

  // Build predicate context from gs.story.
  const ctx = _buildPredicateCtx(gs);

  for (const variant of defs.variants) {
    if (!variant.condition) continue; // no condition = never matches automatically

    try {
      if (evalPredicate(variant.condition, ctx)) {
        return variant;
      }
    } catch {
      // Malformed condition — skip.
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// applyVariant
// ---------------------------------------------------------------------------

/**
 * Apply a resolved variant to an encounter object.
 *
 * Mutates:
 *   - encounter.enemies[0].name (nameOverride)
 *   - encounter.enemies[0] stat fields (statMultipliers)
 *   - Registers variant phases via registerVariantPhases
 *
 * @param {object} encounter — encounter object from buildEncounterForNode
 * @param {object} variant   — resolved variant from resolveVariant
 * @param {string} bossId    — boss enemy id (needed for phase registration)
 * @returns {object}         — mutated encounter (same reference)
 */
export function applyVariant(encounter, variant, bossId) {
  if (!encounter || !variant) return encounter;

  const boss = Array.isArray(encounter.enemies) ? encounter.enemies[0] : null;

  if (boss) {
    // Apply name override.
    if (variant.nameOverride) {
      boss.name = variant.nameOverride;
      boss._variantName = variant.nameOverride;
    }

    // Apply stat multipliers.
    if (variant.statMultipliers) {
      for (const [k, mult] of Object.entries(variant.statMultipliers)) {
        if (k === 'hp') {
          boss.hp    = Math.round((boss.hp    || 100) * mult);
          boss.maxHp = Math.round((boss.maxHp || 100) * mult);
        } else if (k === 'dmg' && Array.isArray(boss.dmg)) {
          boss.dmg = boss.dmg.map(d => Math.round(d * mult));
        } else if (boss[k] != null && typeof boss[k] === 'number') {
          boss[k] = Math.round(boss[k] * mult);
        }
      }
    }

    boss._variantId = variant.id;
  }

  // Register variant phases with bossPhases.js.
  if (Array.isArray(variant.phases) && variant.phases.length && bossId) {
    registerVariantPhases(bossId, variant.phases);
  }

  encounter._variantId = variant.id;
  return encounter;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function _buildPredicateCtx(gs) {
  const story = gs.story || {};
  return {
    flags:      story.flags      || {},
    counters:   story.counters   || {},
    factions:   story.factions   || {},
    quests:     story.quests     || {},
    party:      gs.party         || [],
    companions: story.companions || [],
    gs,
  };
}
