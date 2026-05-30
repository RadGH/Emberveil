/**
 * affixes.js — M305: 40 new affixes for elemental combos, conditional triggers,
 * set-bonus-helpers, defensive effects, and resource management.
 *
 * These extend the pools in items.js. Import and spread into affixPool
 * objects (prefixes / suffixes) when generating items.
 *
 * Each affix shape matches the existing AFFIXES_ACT1 convention:
 *   { id, name, stat, min, max, descriptor? }
 * Plus optional filter flags:
 *   physicalOnly, magicOnly, shieldOnly, magicPlus, slots[], armorTiers[]
 *
 * Stat keys must be registered in equipBonuses.js STAT_TO_KEY or handled
 * by the legendary / conditional hooks system (legendaryEffects.js).
 * Affixes whose stat begins with 'cond_' are conditional and handled by
 * the legendary hooks system; equipBonuses.js ignores unknown keys.
 *
 * M497 canonical-data migration: the six affix-pool data consts below are now
 * loaded via the centralized dataLoader (public/data/combat/affixes.json). The
 * derived AFFIXES_M305 flat array (spreads + 3 inline literals) and the
 * extendAffixPool() helper stay here as logic; only the pure data consts moved.
 */

import {
  ELEMENTAL_COMBO_AFFIXES_CANONICAL,
  CONDITIONAL_TRIGGER_AFFIXES_CANONICAL,
  SET_HELPER_AFFIXES_CANONICAL,
  DEFENSIVE_AFFIXES_CANONICAL,
  RESOURCE_AFFIXES_CANONICAL,
  ADVANCED_STAT_AFFIXES_CANONICAL,
} from './dataLoader.js';

export const ELEMENTAL_COMBO_AFFIXES    = ELEMENTAL_COMBO_AFFIXES_CANONICAL;
export const CONDITIONAL_TRIGGER_AFFIXES = CONDITIONAL_TRIGGER_AFFIXES_CANONICAL;
export const SET_HELPER_AFFIXES          = SET_HELPER_AFFIXES_CANONICAL;
export const DEFENSIVE_AFFIXES           = DEFENSIVE_AFFIXES_CANONICAL;
export const RESOURCE_AFFIXES            = RESOURCE_AFFIXES_CANONICAL;
export const ADVANCED_STAT_AFFIXES       = ADVANCED_STAT_AFFIXES_CANONICAL;

/**
 * All 40 new M305 affixes in a flat array.
 */
export const AFFIXES_M305 = [
  ...ELEMENTAL_COMBO_AFFIXES,    // 7
  ...CONDITIONAL_TRIGGER_AFFIXES, // 7
  ...SET_HELPER_AFFIXES,          // 2
  ...DEFENSIVE_AFFIXES,           // 7
  ...RESOURCE_AFFIXES,            // 6
  ...ADVANCED_STAT_AFFIXES,       // 8
  // 1 bonus extra to reach 40 total:
  { id: 'execute',            name: 'of Execution',       stat: 'cond_executeDmgPct',      min: 0.20, max: 0.40, descriptor: 'EXECUTE', physicalOnly: true },
  { id: 'mana_shield',        name: 'of the Mana Ward',   stat: 'cond_manaShieldOnHit',    min: 0.10, max: 0.25, descriptor: 'MANA SHIELD', magicPlus: true },
  { id: 'bleed_on_crit',      name: 'of Laceration',      stat: 'cond_bleedOnCrit',        min: 0.30, max: 0.60, descriptor: 'CRIT BLEED', physicalOnly: true },
];

// Exactly 40
if (AFFIXES_M305.length !== 40) {
  // Soft warning in dev — does not block prod build.
  // eslint-disable-next-line no-console
  console.warn(`[affixes.js] Expected 40 M305 affixes, got ${AFFIXES_M305.length}`);
}

/**
 * Build an extended affix pool by merging AFFIXES_ACT1-style object with M305 affixes.
 * Splits M305 affixes across prefixes (first half) and suffixes (second half)
 * by convention — "of X" names go to suffixes, others to prefixes.
 *
 * @param {object} basePool — existing { prefixes: [...], suffixes: [...] }
 * @returns {object}        — { prefixes: [...], suffixes: [...] }
 */
export function extendAffixPool(basePool) {
  const prefixes = AFFIXES_M305.filter(a => !a.name.startsWith('of '));
  const suffixes = AFFIXES_M305.filter(a => a.name.startsWith('of '));
  return {
    prefixes: [...(basePool.prefixes || []), ...prefixes],
    suffixes: [...(basePool.suffixes || []), ...suffixes],
  };
}
