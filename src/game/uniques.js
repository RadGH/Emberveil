/**
 * uniques.js — M305
 *
 * ~24 unique items distributed across 5 acts.
 *
 * Schema per unique:
 * {
 *   id            {string}   — key, also used in drop tables
 *   name          {string}   — display name
 *   slot          {string}   — equipment slot
 *   baseItemId    {string}   — WEAPON_BASES or ARMOR_BASES key
 *   act           {number}   — act gating (1–5)
 *   rarity        {string}   — always 'legendary'
 *   quality       {string}   — 'high' | 'elite' | 'exotic'
 *   fixedAffixes  {object[]} — [{ stat, value }] — always present
 *   randomAffixes {object[]} — [{ stat, min, max }] — rolled once on generation
 *   legendaryEffect { id, desc }
 *   lore          {string}   — flavour text
 *   bossSource    {string|null} — boss enemy id that drops this (null = open world)
 * }
 */

// M305 lifecycle imports — uniques need base item dmg/armor + weapon metadata
// so tooltips, auto-equip scoring, and damage formulas all see the same fields
// that generateItem() emits for regular drops.
import { WEAPON_BASES, ARMOR_BASES, QUALITY_MULT } from './items.js';
// canonical-data migration: the UNIQUES data const was extracted to
// public/data/uniques.json (schema public/schemas/v1/uniques.json) and is
// now loaded via the centralized dataLoader. ALL unique LOGIC
// (generateUnique, getUniquesForAct, getUniquesForBoss, _statDisplayName)
// stays here — only the data moved. Byte-parity proven by
// scripts/verify-items-parity.mjs.
import { UNIQUES_CANONICAL } from './dataLoader.js';

export const UNIQUES = UNIQUES_CANONICAL;

/**
 * Get all unique items that can drop in a given act or earlier.
 * @param {number} act
 * @returns {object[]}
 */
export function getUniquesForAct(act) {
  return Object.values(UNIQUES).filter(u => u.act <= act);
}

/**
 * Get unique items tied to a specific boss.
 * @param {string} bossId
 * @returns {object[]}
 */
export function getUniquesForBoss(bossId) {
  return Object.values(UNIQUES).filter(u => u.bossSource === bossId);
}

/**
 * Generate a unique item instance from its definition.
 * Rolls randomAffixes, stamps isUnique + uniqueId, preserves setId = null.
 *
 * @param {string|object} uniqueOrId — uniqueId string or UNIQUES entry
 * @returns {object|null} item object ready to place in inventory
 */
export function generateUnique(uniqueOrId) {
  const def = typeof uniqueOrId === 'string' ? UNIQUES[uniqueOrId] : uniqueOrId;
  if (!def) return null;

  const affixes = [
    // Fixed affixes — always present
    ...(def.fixedAffixes || []).map(a => ({ ...a, id: `fixed_${a.stat}`, name: _statDisplayName(a.stat), baseIntrinsic: false })),
    // Random affixes — roll once
    ...(def.randomAffixes || []).map(a => {
      const value = +(a.min + Math.random() * (a.max - a.min)).toFixed(2);
      return { ...a, value, id: `rand_${a.stat}`, name: _statDisplayName(a.stat) };
    }),
    // Legendary marker (not an equipBonuses key — purely display)
    { id: 'legendary_effect', name: 'Legendary', stat: 'cond_legendaryEffect', value: 1, descriptor: def.legendaryEffect?.desc || '', baseIntrinsic: false },
  ];

  // M305 fix — bake dmg/armor + weapon metadata from the base into the item
  // exactly the way generateItem() does. Previously these were dropped, which
  // made unique-weapon tooltips show no damage line, broke auto-equip scoring
  // (item.dmg was undefined → offense=0), and meant equipping a unique only
  // contributed via its STR/INT/spellPower affixes — never its actual weapon
  // damage range.
  const base = WEAPON_BASES[def.baseItemId] || ARMOR_BASES[def.baseItemId] || null;
  const qMult = (QUALITY_MULT && QUALITY_MULT[def.quality]) ?? 1.2;

  const item = {
    id: crypto.randomUUID(),
    uniqueId: def.id,
    name: def.name,
    type: base?.type
      || ((def.slot === 'weapon' || ['dagger','sword','wand','staff','bow','scepter','orb','tome'].includes(def.baseItemId)) ? 'weapon' : 'armor'),
    subtype: base?.subtype || base?.slot || def.slot,
    slot: def.slot,
    baseKey: def.baseItemId,
    weaponCategory: base?.weaponCategory || null,
    twoHanded: !!base?.twoHanded,
    offHandOk: !!base?.offHandOk,
    isShield: !!base?.isShield,
    isMagicShield: !!base?.isMagicShield,
    attackSpeed: base?.attackSpeed || null,
    rarity: 'legendary',
    quality: def.quality,
    isUnique: true,
    setId: null,
    legendaryEffectId: def.legendaryEffect?.id || null,
    lore: def.lore || '',
    affixes,
  };

  // Bake base stats (dmg / armor) using the same quality scaling generateItem()
  // applies. Uniques are legendary tier — quality is 'high' / 'elite' / 'exotic'
  // (all defined in QUALITY_MULT).
  if (base?.dmg) {
    item.dmg = [Math.round(base.dmg[0] * qMult), Math.round(base.dmg[1] * qMult)];
  }
  if (base?.armor !== undefined) {
    item.armor = Math.round(base.armor * qMult);
  }
  // Shield intrinsics — mirror generateItem() so unique shields keep their
  // baseline block stats too.
  if (base?.isShield) {
    if (base.blockChance && base.blockChance > 0) {
      item.affixes.push({ id: 'base_block_chance', name: 'Base Block', stat: 'block_chance', value: +(base.blockChance).toFixed(2), baseIntrinsic: true });
    }
    if (base.blockPower && base.blockPower > 0) {
      item.affixes.push({ id: 'base_block_power', name: 'Base Block Power', stat: 'block_power', value: Math.round(base.blockPower * qMult), baseIntrinsic: true });
    }
  }
  if (base?.isMagicShield) {
    if (base.barrier && base.barrier > 0) {
      item.affixes.push({ id: 'base_barrier', name: 'Barrier', stat: 'barrier', value: Math.round(base.barrier * qMult), baseIntrinsic: true });
    }
    if (base.barrierRegen && base.barrierRegen > 0) {
      item.affixes.push({ id: 'base_barrier_regen', name: 'Barrier Regen', stat: 'barrierRegen', value: Math.round(base.barrierRegen * qMult), baseIntrinsic: true });
    }
  }

  return item;
}

// Simple stat label lookup for affix display.
function _statDisplayName(stat) {
  const MAP = {
    str: 'Strength', dex: 'Dexterity', int: 'Intelligence', con: 'Constitution',
    hp: 'Max HP', mp: 'Max MP', hit: 'Hit Chance', dodge: 'Dodge',
    armor: 'Armor', dmg: 'Damage', initiative: 'Initiative',
    critChance: 'Crit Chance', critDamage: 'Crit Damage',
    spellPower: 'Spell Power', lifeSteal: 'Life Steal', manaSteal: 'Mana Steal',
    manaRegen: 'Mana Regen', magicResist: 'Magic Resist',
    block_chance: 'Block Chance', block_power: 'Block Power',
    goldFind: 'Gold Find', magicFind: 'Magic Find',
  };
  return MAP[stat] || stat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
