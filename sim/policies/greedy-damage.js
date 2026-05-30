// Solo monk, all DEX (the canonical "breaks the game" build).
import { generateItem } from '../../src/game/items.js';

function makeGear(level) {
  const rarity = level >= 16 ? 'legendary' : level >= 9 ? 'rare' : level >= 4 ? 'magic' : 'normal';
  const tier = level >= 15 ? 'large' : level >= 8 ? 'medium' : 'small';
  const eq = {};
  for (const [key, slot] of [['quarterstaff', 'weapon'], ['cloth_chest', 'body'], ['light_boots', 'feet']]) {
    try { const it = generateItem(key, rarity, tier); if (it) eq[slot] = it; } catch {}
  }
  return eq;
}

function attrsFor(level) {
  // Creation budget: 8 points at L1 + 2 per level thereafter. Dump all into DEX.
  const pool = 8 + (level - 1) * 2;
  return { STR: 8, DEX: 8 + pool, INT: 8, CON: 8 };
}

export function buildParty(level = 1) {
  return [{ id: 'monk', name: 'Monk', cls: 'monk', level, xp: 0, attrs: attrsFor(level), equipment: makeGear(level) }];
}

export function rebuildForLevel(member) {
  member.attrs = attrsFor(member.level);
  member.equipment = makeGear(member.level);
}

export const policyMeta = { name: 'greedy-damage', size: 1 };
