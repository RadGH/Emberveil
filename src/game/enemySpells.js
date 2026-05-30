/**
 * enemySpells.js — Enemy spell definitions (M303)
 *
 * Each spell:
 *   id          — unique key
 *   name        — display name shown in combat log
 *   fxKind      — 'fire'|'ice'|'shadow'|'holy'|'nature' (drives spellFx)
 *   cooldown    — rounds before this spell can be used again
 *   target      — 'single' | 'aoe' | 'self' | 'ally_lowest_hp'
 *   effect      — { damage?, status?, heal?, selfHeal?, statuses? }
 *     damage    — flat damage amount
 *     status    — { type, duration, power, chance } applied to target(s)
 *     statuses  — array of the above (for multi-effect spells)
 *     heal      — amount healed on a single ally
 *     selfHeal  — amount healed on the caster
 *   animationMs — duration of the FX animation in ms
 *   windUp      — optional boss wind-up config:
 *     rounds    — # rounds to wind up (1 = telegraph one round, strike next)
 *     interruptThreshold — damage dealt during wind-up that fizzles the spell
 *   stealable   — if true, can be purloined by Pilfer Magic / dispel
 *
 * Boss spells have windUp defined. Only bosses are assigned these.
 *
 * M497 canonical-data migration: the ENEMY_SPELLS data const is now loaded via
 * the centralized dataLoader (public/data/combat/enemy-spells.json). All
 * per-spell LOGIC (resolveSpells) stays here; only the data const moved.
 */

import { ENEMY_SPELLS_CANONICAL } from './dataLoader.js';

export const ENEMY_SPELLS = ENEMY_SPELLS_CANONICAL;

/**
 * Resolve a list of spell ids into full spell objects.
 * Missing ids are skipped silently.
 */
export function resolveSpells(ids = []) {
  return ids.map(id => ENEMY_SPELLS[id]).filter(Boolean);
}
