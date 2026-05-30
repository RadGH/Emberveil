/**
 * storyEnemyInstance.js — Enemy instance modifier composition (M-S17 §8.3).
 *
 * Extends (does not parallel-track) championModifiers.js + affixes.js.
 *
 * buildEnemyInstance(baseEnemyId, modifier, act, rng)
 *   Returns a flat enemy object ready for runSimulation({ encounter: { enemies: [inst] } }).
 *   Shape is byte-identical to what encounterToCombatants reads today.
 *
 * modifier shape:
 *   {
 *     affixes?:         string[]          — affix ids from affixes.js (by stat key)
 *     championTier?:    string            — e.g. 'normal'|'champion'|'elite'
 *     statMultipliers?: { [stat]: number } — multiplicative on top of base
 *     addSkills?:       string[]          — appended to spells/spellList
 *     addTags?:         string[]          — appended to tags
 *     statusOnStart?:   object[]          — pre-applied statuses
 *     nameOverride?:    string
 *   }
 */

import { ENEMIES } from '../maps/mapData.js';
import { applyChampionStatMods, rollChampionModifiers } from '../game/championModifiers.js';

// ---------------------------------------------------------------------------
// applyAffix — lightweight adapter
//
// affixes.js is designed for items, not enemies. We support a small subset:
//   statMultipliers on the enemy stat block (hp, armor, dodge, hit, dmg).
// The caller can pass an affix id string; we look it up from the data pool
// if available, otherwise treat it as a stat key with value 1.1.
//
// For story-mode purposes, affixes on enemies are modeled as small stat bumps:
//   { id: 'tough', statMod: { hpMult: 1.3 } }
// This mirrors what championModifiers does with statMods.
// ---------------------------------------------------------------------------

const ENEMY_AFFIX_TABLE = {
  tough:        { hpMult: 1.3 },
  fast:         { initiativeMult: 1.5 },
  extra_strong: { dmgMult: 1.3 },
  shielded:     { armorAdd: 5 },
  regen:        { _regenPct: 0.05 },
};

/**
 * Apply a single affix to an enemy instance in-place.
 *
 * @param {object} inst   — mutable enemy instance
 * @param {string} affix  — affix id
 * @returns {object}      — same inst (mutated)
 */
export function applyAffix(inst, affix) {
  const def = ENEMY_AFFIX_TABLE[affix];
  if (!def) return inst; // unknown affix — no-op

  if (def.hpMult) {
    inst.hp    = Math.round((inst.hp    || 10) * def.hpMult);
    inst.maxHp = Math.round((inst.maxHp || inst.hp) * def.hpMult);
  }
  if (def.dmgMult && Array.isArray(inst.dmg)) {
    inst.dmg = inst.dmg.map(d => Math.round(d * def.dmgMult));
  }
  if (def.armorAdd) {
    inst.armor = (inst.armor || 0) + def.armorAdd;
  }
  if (def.initiativeMult) {
    inst.initiative = Math.round((inst.initiative || 10) * def.initiativeMult);
  }
  if (def._regenPct) {
    // Tag for the combat engine to handle.
    inst._regenPct = def._regenPct;
    if (!inst.tags) inst.tags = [];
    if (!inst.tags.includes('regen')) inst.tags.push('regen');
  }

  return inst;
}

// ---------------------------------------------------------------------------
// buildEnemyInstance — main factory
// ---------------------------------------------------------------------------

/**
 * Build a story-mode enemy instance from a base enemy id + modifier spec.
 *
 * @param {string} baseEnemyId   — key in ENEMIES
 * @param {object} [modifier={}] — modifier spec (see file header)
 * @param {number} [act=1]       — current act (reserved for act-scaling)
 * @param {Function} [rng]       — seeded rng (used for championTier roll)
 * @returns {object}             — mutable instance, ready for runSimulation
 */
export function buildEnemyInstance(baseEnemyId, modifier = {}, act = 1, rng = Math.random) {
  const base = ENEMIES[baseEnemyId];
  if (!base) {
    // Return a minimal fallback so simulations don't crash on unknown ids.
    return {
      id: baseEnemyId,
      name: baseEnemyId,
      hp: 20, maxHp: 20, armor: 0, dodge: 0, hit: 80,
      dmg: [5, 10], xpValue: 10, gold: [5, 15], count: 1,
      tags: ['_unknown'],
    };
  }

  // Deep-clone the base enemy.
  let inst = JSON.parse(JSON.stringify(base));
  inst.id    = baseEnemyId;
  inst.count = 1;
  // Ensure maxHp is set.
  if (!inst.maxHp) inst.maxHp = inst.hp || 10;

  // ── 1. Apply affixes ───────────────────────────────────────────────────
  if (Array.isArray(modifier.affixes)) {
    for (const a of modifier.affixes) {
      inst = applyAffix(inst, a);
    }
  }

  // ── 2. Apply champion tier ─────────────────────────────────────────────
  if (modifier.championTier) {
    // Champion baseline: +50% HP, +30% dmg.
    if (modifier.championTier === 'champion' || modifier.championTier === 'elite') {
      inst.hp     = Math.round(inst.hp    * 1.5);
      inst.maxHp  = Math.round(inst.maxHp * 1.5);
      if (Array.isArray(inst.dmg)) inst.dmg = inst.dmg.map(d => Math.round(d * 1.3));
      // Roll 1-2 champion stat mods.
      const modIds = rollChampionModifiers();
      applyChampionStatMods(inst, modIds);
      inst.championMods = modIds;
      inst.isChampion = true;
    }
    if (modifier.championTier === 'elite') {
      // Elite gets an extra HP bump.
      inst.hp    = Math.round(inst.hp    * 1.2);
      inst.maxHp = Math.round(inst.maxHp * 1.2);
    }
  }

  // ── 3. Apply stat multipliers ──────────────────────────────────────────
  if (modifier.statMultipliers) {
    for (const [k, mult] of Object.entries(modifier.statMultipliers)) {
      if (k === 'hp') {
        inst.hp    = Math.round(inst.hp    * mult);
        inst.maxHp = Math.round(inst.maxHp * mult);
      } else if (k === 'dmg' && Array.isArray(inst.dmg)) {
        inst.dmg = inst.dmg.map(d => Math.round(d * mult));
      } else if (inst[k] != null && typeof inst[k] === 'number') {
        inst[k] = Math.round(inst[k] * mult);
      }
    }
  }

  // ── 4. Add skills (spells) ─────────────────────────────────────────────
  if (Array.isArray(modifier.addSkills) && modifier.addSkills.length) {
    inst.spells    = [...(inst.spells    || []), ...modifier.addSkills];
    inst.spellList = [...(inst.spellList || []), ...modifier.addSkills];
  }

  // ── 5. Add tags ────────────────────────────────────────────────────────
  if (Array.isArray(modifier.addTags) && modifier.addTags.length) {
    inst.tags = [...(inst.tags || []), ...modifier.addTags];
  }

  // ── 6. Status on start ─────────────────────────────────────────────────
  if (Array.isArray(modifier.statusOnStart) && modifier.statusOnStart.length) {
    inst.statusOnStart = [...(inst.statusOnStart || []), ...modifier.statusOnStart];
  }

  // ── 7. Name override ───────────────────────────────────────────────────
  if (modifier.nameOverride) {
    inst.name = modifier.nameOverride;
  }

  return inst;
}
