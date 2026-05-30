import { getEquipmentAffixBonuses } from './equipBonuses.js';
import { getBalance } from './balance-loader.js';

/**
 * Passive skill trees (M176 overhaul).
 *
 * Each class gets a 5-node tree themed to its role. Points are awarded via
 * xp.js (1 per 2 levels) and spent in SkillTreeScreen "Passive" tab. Every
 * node's effect is summed across ranks and surfaced through getPassiveBonuses().
 *
 * Pre-M176 trees were almost entirely flat stat bumps (+1 STR, +1 DEX). The
 * redesign keeps HP / MP / regen nodes (user-specified: "Passives that grant
 * life or mana regen can stay") and replaces most stat bumps with mechanics
 * that plug into existing combat systems:
 *
 *   blockChance     — % chance to block incoming physical hits for 0 dmg
 *                     (CombatScreen._resolveIncomingDamage).
 *   lifesteal       — % of outgoing damage healed back (auto-attack + skill
 *                     lifesteal pool).
 *   thorns          — % of incoming damage reflected to attacker
 *                     (recursion-safe ala soulbind/counterStance).
 *   burnOnHit       — per-hit probability to apply 3-turn burn, power = INT*0.15.
 *   poisonOnCrit    — per-crit probability to apply 3-turn poison, power = INT*0.2.
 *   manaOnKill      — flat MP restored when a hit kills a target.
 *   hpOnKill        — flat HP restored when a hit kills a target.
 *   chainOnHit      — probability that hits arc 50% dmg to a second enemy.
 *   resistAll       — flat % all-damage reduction (applied in mitigation).
 *   dodgePct        — flat % dodge chance (applied in hit roll).
 *
 * Each effect key has exactly one wire site — search CombatScreen.js for the
 * key name to find it.
 *
 * Storage shape on a party member:
 *   m.passiveRanks         — { [nodeId]: rank }
 *   m.pendingPassivePoints — integer, unspent points
 */

const N = {
  // ─── Preserved stat-bump nodes (HP/MP/regen) — user-approved to stay ───
  toughness: { id: 'toughness', name: 'Toughness', desc: '+10 Max HP per rank', maxRank: 3, effects: { maxHp: 10 } },
  devotion:  { id: 'devotion',  name: 'Devotion',  desc: '+10 Max HP per rank', maxRank: 3, effects: { maxHp: 10 } },
  manapool:  { id: 'mana_pool', name: 'Mana Pool', desc: '+10 Max MP per rank', maxRank: 3, effects: { maxMp: 10 } },
  regrowth:  { id: 'regrowth',  name: 'Regrowth',  desc: 'Regen +1 HP/turn per rank', maxRank: 3, effects: { hpRegen: 1 } },
  manaflow:  { id: 'mana_flow', name: 'Mana Flow', desc: 'Regen +1 MP/turn per rank', maxRank: 3, effects: { mpRegen: 1 } },
  wisdom:    { id: 'wisdom',    name: 'Wisdom',    desc: '+5 HP & +5 MP per rank', maxRank: 3, effects: { maxHp: 5, maxMp: 5 } },

  // ─── New mechanical nodes ──────────────────────────────────────────────
  // Defensive
  ironWall:    { id: 'iron_wall',    name: 'Iron Wall',     desc: '+5% block chance per rank',     maxRank: 3, effects: { blockChance: 5 } },
  thorns:      { id: 'thorns',       name: 'Thorns',        desc: 'Reflect 8% damage per rank',    maxRank: 3, effects: { thorns: 0.08 } },
  resistance:  { id: 'resistance',   name: 'Resistance',    desc: '+3% all-damage reduction per rank', maxRank: 3, effects: { resistAll: 3 } },
  aegis:       { id: 'aegis',        name: 'Aegis',         desc: '+3% block & +5 HP per rank',    maxRank: 3, effects: { blockChance: 3, maxHp: 5 } },

  // Offensive — on-hit / on-crit / on-kill
  vampirism:   { id: 'vampirism',    name: 'Vampirism',     desc: 'Lifesteal +5% per rank',        maxRank: 3, effects: { lifesteal: 0.05 } },
  killingBlow: { id: 'killing_blow', name: 'Killing Blow',  desc: 'Restore 10 HP on kill per rank', maxRank: 3, effects: { hpOnKill: 10 } },
  soulHarvest: { id: 'soul_harvest', name: 'Soul Harvest',  desc: 'Restore 8 MP on kill per rank', maxRank: 3, effects: { manaOnKill: 8 } },
  igniting:    { id: 'igniting',     name: 'Igniting',      desc: '15% chance/rank to burn on hit', maxRank: 3, effects: { burnOnHit: 0.15 } },
  venomous:    { id: 'venomous',     name: 'Venomous',      desc: '25% chance/rank to poison on crit', maxRank: 3, effects: { poisonOnCrit: 0.25 } },
  stormcharged:{ id: 'stormcharged', name: 'Stormcharged',  desc: '10% chance/rank to chain 50% dmg', maxRank: 3, effects: { chainOnHit: 0.10 } },

  // Evasion / finesse
  fleetfoot:   { id: 'fleetfoot',    name: 'Fleetfoot',     desc: '+4% dodge per rank',            maxRank: 3, effects: { dodgePct: 4 } },
  deadly:      { id: 'deadly_aim',   name: 'Deadly Aim',    desc: '+3% crit chance per rank',      maxRank: 3, effects: { critPct: 3 } },
  assassin:    { id: 'assassin',     name: 'Assassin',      desc: '+2% crit & 15%/rank poison on crit', maxRank: 3, effects: { critPct: 2, poisonOnCrit: 0.15 } },
};

/**
 * Per-class 5-node passive trees (M176).
 * Each tree keeps 1 HP/MP/regen staple and ~4 mechanical nodes tuned to role.
 */
export const PASSIVE_TREES = {
  warrior:      [N.toughness, N.ironWall,   N.thorns,       N.vampirism,   N.killingBlow],
  paladin:      [N.devotion,  N.ironWall,   N.resistance,   N.thorns,      N.killingBlow],
  ranger:       [N.regrowth,  N.fleetfoot,  N.deadly,       N.stormcharged,N.killingBlow],
  rogue:        [N.wisdom,    N.fleetfoot,  N.assassin,     N.vampirism,   N.venomous],
  cleric:       [N.devotion,  N.manapool,   N.manaflow,     N.aegis,       N.soulHarvest],
  bard:         [N.manaflow,  N.wisdom,     N.fleetfoot,    N.vampirism,   N.soulHarvest],
  mage:         [N.manapool,  N.manaflow,   N.igniting,     N.stormcharged,N.soulHarvest],
  necromancer:  [N.manapool,  N.manaflow,   N.soulHarvest,  N.vampirism,   N.venomous],
  warlock:      [N.manapool,  N.soulHarvest,N.igniting,     N.vampirism,   N.thorns],
  demon_hunter: [N.fleetfoot, N.deadly,     N.vampirism,    N.assassin,    N.killingBlow],
  scavenger:    [N.regrowth,  N.fleetfoot,  N.killingBlow,  N.soulHarvest, N.vampirism],
  swashbuckler: [N.wisdom,    N.fleetfoot,  N.deadly,       N.venomous,    N.vampirism],
  dragon_knight:[N.toughness, N.ironWall,   N.resistance,   N.igniting,    N.killingBlow],
  // M413: replaced duplicate igniting/stormcharged slots with themed nodes
  // (vampirism = fire drains heat from victims; deadly = precision lightning)
  // so each tree has 5 distinct passives. Existing rank investments preserved
  // — duplicates were never independently purchasable.
  pyromancer:   [N.manapool,  N.manaflow,   N.igniting,     N.vampirism,   N.soulHarvest],
  stormcaller:  [N.manapool,  N.manaflow,   N.stormcharged, N.deadly,      N.soulHarvest],
  druid:        [N.regrowth,  N.manaflow,   N.thorns,       N.resistance,  N.venomous],
  oracle:       [N.manapool,  N.manaflow,   N.wisdom,       N.resistance,  N.soulHarvest],
  tactician:    [N.wisdom,    N.manaflow,   N.deadly,       N.aegis,       N.killingBlow],
  chronomancer: [N.manapool,  N.manaflow,   N.wisdom,       N.stormcharged,N.resistance],
  // M269: Tinker — clockwork mechanist. Mana sustain + deadly precision + vampirism (Quick-Fix synergy).
  tinker:       [N.manapool,  N.manaflow,   N.deadly,       N.igniting,    N.vampirism],
};

const FALLBACK_TREE = [N.toughness, N.regrowth, N.vampirism, N.fleetfoot, N.soulHarvest];

export function getPassiveTree(classId) {
  return PASSIVE_TREES[classId] || FALLBACK_TREE;
}

/**
 * Sum a character's purchased passive effects into a flat bonus object.
 * Handles duplicate nodes by summing independent slot instances.
 */
export function getPassiveBonuses(member) {
  const out = {
    maxHp: 0, maxMp: 0, STR: 0, DEX: 0, INT: 0, CON: 0,
    critPct: 0, hpRegen: 0, mpRegen: 0,
    blockChance: 0, thorns: 0, resistAll: 0, dodgePct: 0,
    lifesteal: 0, burnOnHit: 0, poisonOnCrit: 0, chainOnHit: 0,
    hpOnKill: 0, manaOnKill: 0,
  };
  if (!member) return out;
  const ranks = member.passiveRanks || {};
  const tree = getPassiveTree(member.class);
  const counted = {};
  for (const node of tree) {
    if (counted[node.id]) continue;
    counted[node.id] = true;
    const r = ranks[node.id] || 0;
    if (r <= 0) continue;
    for (const [k, v] of Object.entries(node.effects || {})) {
      out[k] = (out[k] || 0) + v * r;
    }
  }
  return out;
}

/**
 * Return effective attributes (base + passive flat bonus). Used by the
 * inline stat formulas across combat, inventory, level-up, town rest, etc.
 */
export function getEffectiveAttrs(member) {
  const base = member?.attrs || { STR: 8, DEX: 8, INT: 8, CON: 8 };
  const b = getPassiveBonuses(member);
  return {
    STR: (base.STR || 8) + b.STR,
    DEX: (base.DEX || 8) + b.DEX,
    INT: (base.INT || 8) + b.INT,
    CON: (base.CON || 8) + b.CON,
  };
}

export function computeMaxHp(member) {
  const a = getEffectiveAttrs(member);
  const ab = getEquipmentAffixBonuses(member);
  const affixCon = ab.con || 0;
  const c = getBalance().combat.maxHp;
  return c.base + (a.CON + affixCon) * c.conMult + getPassiveBonuses(member).maxHp + (ab.hp || 0);
}
export function computeMaxMp(member) {
  const a = getEffectiveAttrs(member);
  const ab = getEquipmentAffixBonuses(member);
  const affixInt = ab.int || 0;
  const c = getBalance().combat.maxMp;
  return c.base + (a.INT + affixInt) * c.intMult + getPassiveBonuses(member).maxMp + (ab.mp || 0);
}

export function recalcPassiveStats(member) {
  if (!member) return;
  member.maxHp = computeMaxHp(member);
  member.maxMp = computeMaxMp(member);
  if (member.hp == null || member.hp > member.maxHp) member.hp = member.maxHp;
  if (member.mp == null || member.mp > member.maxMp) member.mp = member.maxMp;
}
