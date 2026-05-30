// Solo warrior, CON + STR, heavy armor.
import { generateItem } from '../../src/game/items.js';

function makeGear(level) {
  const rarity = level >= 16 ? 'legendary' : level >= 9 ? 'rare' : level >= 4 ? 'magic' : 'normal';
  const tier = level >= 15 ? 'large' : level >= 8 ? 'medium' : 'small';
  const eq = {};
  for (const [key, slot] of [['longsword', 'weapon'], ['shield', 'offhand'], ['heavy_chest', 'body'], ['heavy_helm', 'head'], ['heavy_gauntlets', 'hands']]) {
    try { const it = generateItem(key, rarity, tier); if (it) eq[slot] = it; } catch {}
  }
  return eq;
}

function attrsFor(level) {
  const pool = 8 + (level - 1) * 2;
  return {
    STR: 8 + Math.round(pool * 0.4),
    DEX: 8,
    INT: 8,
    CON: 8 + Math.round(pool * 0.6),
  };
}

export function buildParty(level = 1) {
  return [{ id: 'warrior', name: 'Warrior', cls: 'warrior', level, xp: 0, attrs: attrsFor(level), equipment: makeGear(level) }];
}

export function rebuildForLevel(member) {
  member.attrs = attrsFor(member.level);
  member.equipment = makeGear(member.level);
}

export const policyMeta = { name: 'greedy-tank', size: 1 };
