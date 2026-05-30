/**
 * Protected core mechanics — ids that mods are not allowed to override.
 *
 * If a pack declares an entity with one of these ids, registry.js will skip
 * the registration and log a warning. This protects foundation systems that
 * the engine relies on (e.g. base status effect types, the starting classes'
 * identity, combat framework skills) from being silently replaced.
 *
 * Mods can still *reference* these ids (e.g. a custom skill that applies the
 * "burn" status). They just can't redefine them.
 */

export const PROTECTED_IDS = {
  skills: new Set([]),
  classes: new Set([
    'fighter', 'wizard', 'rogue', 'cleric',
    'paladin', 'ranger', 'barbarian', 'monk',
    'warlock', 'druid', 'sorcerer', 'bard',
    'necromancer', 'artificer'
  ]),
  items: new Set([]),
  events: new Set([]),
  appearances: new Set([]),
  characters: new Set([]),
  loot: new Set([])
};

export const PROTECTED_STATUS_TYPES = new Set([
  'burn', 'poison', 'bleed', 'stun', 'barrier', 'regen',
  'dmgBuff', 'critBonus', 'taunt', 'invisible', 'root', 'silence'
]);

export function isProtected(kind, id) {
  return !!(PROTECTED_IDS[kind] && PROTECTED_IDS[kind].has(id));
}
