// Balanced 3-hero party: tank + dps + healer. Stat points → primary + CON.
import { generateItem } from '../../src/game/items.js';

function makeGear(classId, level) {
  const rarity = level >= 16 ? 'legendary' : level >= 9 ? 'rare' : level >= 4 ? 'magic' : 'normal';
  const tier = level >= 15 ? 'large' : level >= 8 ? 'medium' : 'small';
  const eq = {};
  const slots = {
    warrior: [['longsword', 'weapon'], ['shield', 'offhand'], ['heavy_chest', 'body'], ['heavy_helm', 'head'], ['heavy_gauntlets', 'hands']],
    rogue:   [['dagger', 'weapon'], ['dagger', 'offhand'], ['light_chest', 'body'], ['light_boots', 'feet']],
    cleric:  [['scepter', 'weapon'], ['shield', 'offhand'], ['medium_chest', 'body'], ['medium_helm', 'head']],
  }[classId] || [];
  for (const [key, slot] of slots) {
    try {
      const item = generateItem(key, rarity, tier);
      if (item) eq[slot] = item;
    } catch {}
  }
  return eq;
}

function attrsFor(classId, level) {
  const pool = 8 + (level - 1) * 2;
  const base = { STR: 8, DEX: 8, INT: 8, CON: 8 };
  if (classId === 'warrior') { base.STR += Math.round(pool * 0.6); base.CON += Math.round(pool * 0.4); }
  else if (classId === 'rogue') { base.DEX += Math.round(pool * 0.7); base.CON += Math.round(pool * 0.3); }
  else if (classId === 'cleric') { base.INT += Math.round(pool * 0.6); base.CON += Math.round(pool * 0.4); }
  return base;
}

export function buildParty(level = 1) {
  return [
    { id: 'warrior', name: 'Warrior', cls: 'warrior', level, xp: 0, attrs: attrsFor('warrior', level), equipment: makeGear('warrior', level) },
    { id: 'rogue',   name: 'Rogue',   cls: 'rogue',   level, xp: 0, attrs: attrsFor('rogue', level),   equipment: makeGear('rogue', level) },
    { id: 'cleric',  name: 'Cleric',  cls: 'cleric',  level, xp: 0, attrs: attrsFor('cleric', level),  equipment: makeGear('cleric', level) },
  ];
}

export function rebuildForLevel(member) {
  member.attrs = attrsFor(member.cls, member.level);
  member.equipment = makeGear(member.cls, member.level);
}

export const policyMeta = { name: 'balanced', size: 3 };
