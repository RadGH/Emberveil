/**
 * infiniteDungeon.js — M306
 *
 * Data layer for the Infinite Depths mode:
 *   - Enemy pool across all acts
 *   - Floor scaling formulas
 *   - Floor effects (affixes)
 *   - Anchor-boss pool
 *   - Loot rarity bias by floor
 *   - Local leaderboard helpers
 *   - Run state helpers
 */

import { ENEMIES, ENEMIES_ACT4, ENEMIES_ACT5 } from '../maps/mapData.js';
import { GameState } from './gameState.js';

// ─── Unlock condition ─────────────────────────────────────────────────────────
export const ACT5_BOSS_IDS = ['emberveil_sovereign', 'the_unraveler'];

export function isInfiniteDepthsUnlocked() {
  const gs = GameState.get();
  const bosses = gs.completedBosses || [];
  return ACT5_BOSS_IDS.some(id => bosses.some(b => b === id || (typeof b === 'object' && b.id === id)));
}

// ─── Enemy pool (all acts) ────────────────────────────────────────────────────
// Each bucket: { enemies, minFloor, maxFloor }
// Enemies are picked proportionally from buckets appropriate for the floor.
const ENEMY_BUCKETS = [
  // Act 1 — floors 1-15
  {
    minFloor: 1, maxFloor: 15,
    enemies: [
      ENEMIES.goblin_scout,
      ENEMIES.goblin_warrior,
      ENEMIES.goblin_shaman,
      ENEMIES.corrupted_wolf,
      ENEMIES.bandit,
      ENEMIES.bandit_captain,
    ],
  },
  // Act 2 — floors 5-25
  {
    minFloor: 5, maxFloor: 25,
    enemies: [
      ENEMIES.ash_wraith,
      ENEMIES.cinder_hound,
      ENEMIES.molten_golem,
      ENEMIES.veil_cultist,
      ENEMIES.veil_sorcerer,
      ENEMIES.corrupted_bear,
    ],
  },
  // Act 3 — floors 10-35
  {
    minFloor: 10, maxFloor: 35,
    enemies: [
      ENEMIES.imp,
      ENEMIES.hell_knight,
      ENEMIES.void_shade,
      ENEMIES.demon_brute,
      ENEMIES.veil_warden,
    ],
  },
  // Act 4 — floors 20-50
  {
    minFloor: 20, maxFloor: 50,
    enemies: [
      ENEMIES_ACT4.star_horror,
      ENEMIES_ACT4.cosmic_titan,
      ENEMIES_ACT4.void_wraith,
      ENEMIES_ACT4.void_prophet,
    ],
  },
  // Act 5 — floors 30+
  {
    minFloor: 30, maxFloor: Infinity,
    enemies: [
      ENEMIES_ACT5.primordial_elemental,
      ENEMIES_ACT5.abyssal_knight,
      ENEMIES_ACT5.reality_shard,
      ENEMIES_ACT5.genesis_worm,
    ],
  },
];

// ─── Anchor-boss pool ─────────────────────────────────────────────────────────
export const ANCHOR_BOSSES = [
  { id: 'goblin_warlord',           name: 'Warlord of the Depths',   base: ENEMIES.goblin_warlord,            modifier: 'champion' },
  { id: 'bandit_captain',           name: 'Shadow Captain',          base: ENEMIES.bandit_captain,             modifier: 'enraged' },
  { id: 'veil_warden_anchor',       name: 'Eternal Veil Warden',     base: ENEMIES.veil_warden,               modifier: 'champion' },
  { id: 'molten_golem_anchor',      name: 'Molten Colossus',         base: ENEMIES.molten_golem,              modifier: 'enraged' },
  { id: 'archfiend_malgrath_anchor',name: 'Malgrath Ascendant',      base: ENEMIES.archfiend_malgrath,        modifier: 'champion' },
  { id: 'emberveil_sovereign_echo', name: 'Echo of the Sovereign',   base: ENEMIES.emberveil_sovereign,       modifier: 'enraged' },
  { id: 'cosmic_titan_anchor',      name: 'Primordial Titan',        base: ENEMIES_ACT4.cosmic_titan, modifier: 'champion' },
];

// Pick anchor boss for a given floor (deterministic by floor number).
export function getAnchorBossForFloor(floor) {
  const idx = Math.floor(floor / 5) % ANCHOR_BOSSES.length;
  return ANCHOR_BOSSES[idx];
}

// ─── Floor scaling ────────────────────────────────────────────────────────────
// HP × 1.15^N, damage × 1.10^N, level = max(playerLevel, 5 + N)
// Cap HP at 1,000,000 to avoid overflow display issues.

export function scaleEnemy(baseEnemy, floor, playerLevel = 1) {
  const hpScale  = Math.min(Math.pow(1.15, floor), 1000000 / Math.max(1, baseEnemy.hp));
  const dmgScale = Math.pow(1.10, floor);
  const scaledHp = Math.round(Math.min(baseEnemy.hp * hpScale, 1000000));
  const scaledDmg = [
    Math.round(baseEnemy.dmg[0] * dmgScale),
    Math.round(baseEnemy.dmg[1] * dmgScale),
  ];
  const scaledLevel = Math.max(playerLevel, 5 + floor);
  return {
    ...baseEnemy,
    hp: scaledHp,
    maxHp: scaledHp,
    dmg: scaledDmg,
    level: scaledLevel,
    xpValue: Math.round(baseEnemy.xpValue * Math.pow(1.08, floor)),
    gold: [
      Math.round(baseEnemy.gold[0] * Math.pow(1.06, floor)),
      Math.round(baseEnemy.gold[1] * Math.pow(1.06, floor)),
    ],
  };
}

// Scale anchor boss: extra +25% HP, +15% damage on top of normal scaling.
export function scaleAnchorBoss(boss, floor, playerLevel = 1) {
  const base = scaleEnemy(boss.base, floor, playerLevel);
  return {
    ...base,
    hp: Math.round(base.hp * 1.25),
    maxHp: Math.round(base.hp * 1.25),
    dmg: [Math.round(base.dmg[0] * 1.15), Math.round(base.dmg[1] * 1.15)],
    name: boss.name,
    id: boss.id,
    isBoss: true,
  };
}

// ─── Floor effects (affixes) ──────────────────────────────────────────────────
export const FLOOR_EFFECTS = [
  {
    id: 'champion_tide',
    name: 'Champion Tide',
    desc: 'All enemies are champions — increased stats and resistances.',
    icon: 'C',
    color: '#e8c030',
    applyToEnemy: (e) => ({
      ...e,
      hp: Math.round(e.hp * 1.4),
      maxHp: Math.round(e.hp * 1.4),
      dmg: [Math.round(e.dmg[0] * 1.2), Math.round(e.dmg[1] * 1.2)],
      armor: Math.round(e.armor * 1.3),
      _champion: true,
    }),
  },
  {
    id: 'heal_disabled',
    name: 'Sanguine Curse',
    desc: 'Healing is suppressed — cleric skills and shrine rests restore 50% less.',
    icon: 'S',
    color: '#c04060',
    combatMod: { healMult: 0.5 },
  },
  {
    id: 'double_damage',
    name: 'Glass and Fury',
    desc: 'Damage taken is doubled, but loot quantity is doubled this floor.',
    icon: 'D',
    color: '#ff6030',
    combatMod: { damageTakenMult: 2.0 },
    lootMod: { quantityMult: 2 },
  },
  {
    id: 'haste_enemies',
    name: 'Frenzied Pack',
    desc: 'All enemies gain +20% initiative and +15% damage.',
    icon: 'F',
    color: '#e08020',
    applyToEnemy: (e) => ({
      ...e,
      dmg: [Math.round(e.dmg[0] * 1.15), Math.round(e.dmg[1] * 1.15)],
      dodge: Math.min(50, (e.dodge || 10) + 8),
    }),
  },
  {
    id: 'volatile_ground',
    name: 'Volatile Ground',
    desc: 'Combat starts with both sides taking 10% of max HP as instant damage.',
    icon: 'V',
    color: '#c060e0',
    combatMod: { openingDamagePct: 0.10 },
  },
  {
    id: 'iron_skin',
    name: 'Iron Skin',
    desc: 'All enemies have +50% armor.',
    icon: 'I',
    color: '#8080c0',
    applyToEnemy: (e) => ({
      ...e,
      armor: Math.round((e.armor || 0) * 1.5 + 5),
    }),
  },
  {
    id: 'veil_rift',
    name: 'Veil Rift',
    desc: 'Enemies have 30% magic resistance and their spells deal +25% damage.',
    icon: 'R',
    color: '#a040c0',
    applyToEnemy: (e) => ({
      ...e,
      magicResist: Math.min(70, (e.magicResist || 0) + 30),
    }),
    combatMod: { enemySpellMult: 1.25 },
  },
  {
    id: 'extra_group',
    name: 'Horde Surge',
    desc: 'An additional enemy group joins this floor\'s encounter.',
    icon: 'H',
    color: '#e06030',
    floorMod: { extraGroup: true },
  },
  {
    id: 'blessed_loot',
    name: 'Cursed Plenty',
    desc: 'Item drop chance is tripled, but items cost 50% more to identify.',
    icon: 'P',
    color: '#40d080',
    lootMod: { dropChanceMult: 3.0 },
  },
  {
    id: 'soul_drain',
    name: 'Soul Drain',
    desc: 'Party MP does not regenerate between nodes on this floor.',
    icon: 'M',
    color: '#6040c0',
    combatMod: { noMpRegen: true },
  },
];

// Roll 1-2 floor effects for a given floor (seeded by floor number + run seed).
export function rollFloorEffects(floor, runSeed = 0) {
  // Cheap deterministic PRNG so effects are stable on re-entry.
  let s = (floor * 2654435761 + runSeed) >>> 0;
  function rng() {
    s = (s ^ (s >>> 16)) >>> 0;
    s = Math.imul(s, 0x45d9f3b) >>> 0;
    s = (s ^ (s >>> 16)) >>> 0;
    return (s >>> 0) / 4294967296;
  }
  const count = floor >= 5 ? (rng() < 0.45 ? 2 : 1) : 1;
  const pool = [...FLOOR_EFFECTS];
  const picked = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}

// ─── Loot rarity bias ─────────────────────────────────────────────────────────
// Returns { rarity, quality } for a floor-appropriate item roll.
export function rollLootForFloor(floor, lootMods = {}) {
  const quantityMult = lootMods.quantityMult || 1;
  const dropChanceMult = lootMods.dropChanceMult || 1;

  // Rarity thresholds scale with floor depth.
  const legendaryChance = Math.min(0.60, 0.02 + floor * 0.015);
  const rareChance      = Math.min(0.80, 0.10 + floor * 0.02);
  const r = Math.random();
  let rarity = 'magic';
  if (r < legendaryChance) rarity = 'legendary';
  else if (r < legendaryChance + rareChance) rarity = 'rare';

  const qualityTable = floor < 10 ? ['medium','medium','high'] :
                        floor < 20 ? ['high','high','elite'] :
                                      ['elite','elite','exotic'];
  const quality = qualityTable[Math.floor(Math.random() * qualityTable.length)];
  return { rarity, quality, quantityMult, dropChanceMult };
}

// ─── Floor encounter builder ──────────────────────────────────────────────────
// Returns an array of stage descriptors for a given floor.
// 3-5 nodes: combat(s) + optional mini-boss (anchor floors only) + optional treasure.
export function buildFloorStages(floor, effects = [], runSeed = 0) {
  let s = (floor * 7 + runSeed * 13) >>> 0;
  function rng() {
    s = (s ^ (s >>> 16)) >>> 0;
    s = Math.imul(s, 0x45d9f3b) >>> 0;
    s = (s ^ (s >>> 16)) >>> 0;
    return (s >>> 0) / 4294967296;
  }

  const isAnchor = floor > 0 && floor % 5 === 0;
  const hasExtraGroup = effects.some(e => e.id === 'extra_group');
  const combatCount = isAnchor ? 2 : (hasExtraGroup ? 3 : (2 + Math.floor(rng() * 2)));
  const stages = [];

  for (let i = 0; i < combatCount; i++) {
    stages.push({ type: 'combat' });
  }
  // Optional treasure node (40% chance, not on anchor floors)
  if (!isAnchor && rng() < 0.4) {
    stages.push({ type: 'treasure' });
  }
  // Anchor floors: boss at end
  if (isAnchor) {
    stages.push({ type: 'anchor_boss' });
  }

  return stages;
}

// ─── Run state helpers ────────────────────────────────────────────────────────
export function getInfiniteRun() {
  const gs = GameState.get();
  return gs.infiniteRun || null;
}

export function startInfiniteRun() {
  const gs = GameState.get();
  gs.infiniteRun = {
    active: true,
    floor: 1,
    runDeaths: 0,
    runLoot: [],
    runStartedAt: Date.now(),
    anchors: [], // floors where anchor boss was cleared
    seed: Math.floor(Math.random() * 0xFFFFFF),
  };
  return gs.infiniteRun;
}

export function endInfiniteRun(victory = false) {
  const gs = GameState.get();
  const run = gs.infiniteRun;
  if (!run) return;
  // Record leaderboard entry before clearing
  if (run.floor > 1) {
    recordLeaderboardEntry(run);
  }
  gs.infiniteRun = null;
}

export function advanceFloor() {
  const gs = GameState.get();
  if (!gs.infiniteRun) return;
  gs.infiniteRun.floor++;
}

export function markAnchorCleared(floor) {
  const gs = GameState.get();
  if (!gs.infiniteRun) return;
  if (!gs.infiniteRun.anchors.includes(floor)) {
    gs.infiniteRun.anchors.push(floor);
  }
}

export function addRunLoot(item) {
  const gs = GameState.get();
  if (!gs.infiniteRun) return;
  gs.infiniteRun.runLoot.push({ id: item.id, name: item.name, rarity: item.rarity });
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────
const LB_KEY = 'emberveil.infiniteLeaderboard';

export function getLeaderboard() {
  try {
    return JSON.parse(localStorage.getItem(LB_KEY) || '[]');
  } catch (_) {
    return [];
  }
}

export function recordLeaderboardEntry(run) {
  const gs = GameState.get();
  const hero = gs.party?.[0];
  if (!hero) return;

  const party = (gs.party || []).map(m => m.class || m.cls).filter(Boolean);
  const elapsed = Math.max(0, Math.round((Date.now() - (run.runStartedAt || Date.now())) / 1000));

  const entry = {
    heroName: hero.name || 'Unknown',
    heroClass: hero.class || hero.cls || '?',
    partyClasses: party.join(', '),
    deepestFloor: run.floor,
    runTime: elapsed,
    date: new Date().toISOString().slice(0, 10),
    anchorsCleared: (run.anchors || []).length,
  };

  try {
    const board = JSON.parse(localStorage.getItem(LB_KEY) || '[]');
    board.push(entry);
    // Sort by deepest floor desc, then run time asc.
    board.sort((a, b) => b.deepestFloor - a.deepestFloor || a.runTime - b.runTime);
    // Keep top 50
    localStorage.setItem(LB_KEY, JSON.stringify(board.slice(0, 50)));
  } catch (_) {}

  return entry;
}

export function formatRunTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Pick enemies for a floor ─────────────────────────────────────────────────
// Returns an array of 1-3 enemy groups for a combat node.
export function pickEnemiesForFloor(floor, effects = [], runSeed = 0) {
  // Get eligible buckets for this floor.
  const eligible = ENEMY_BUCKETS.filter(b => floor >= b.minFloor && floor <= b.maxFloor);
  if (eligible.length === 0) return [{ ...ENEMIES.imp, count: 2 }];

  // Bias toward higher-floor buckets as depth increases.
  const weights = eligible.map((b, i) => {
    const relevance = (b.maxFloor === Infinity ? 99 : b.maxFloor) - b.minFloor;
    return Math.min(relevance, floor - b.minFloor + 1);
  });
  const totalW = weights.reduce((a, b) => a + b, 0);

  function pick() {
    const r = Math.random() * totalW;
    let acc = 0;
    for (let i = 0; i < eligible.length; i++) {
      acc += weights[i];
      if (r <= acc) {
        const bucket = eligible[i];
        return bucket.enemies[Math.floor(Math.random() * bucket.enemies.length)];
      }
    }
    return eligible[eligible.length - 1].enemies[0];
  }

  // Build 1-3 groups.
  const groupCount = Math.min(3, 1 + Math.floor(floor / 8));
  const groups = [];
  const seenIds = new Set();
  for (let i = 0; i < groupCount; i++) {
    let base;
    let tries = 0;
    do {
      base = pick();
      tries++;
    } while (seenIds.has(base.id) && tries < 8);
    seenIds.add(base.id);
    const count = 1 + Math.floor(Math.random() * 2);
    groups.push({ ...base, count });
  }

  // Apply floor effects that modify enemy stats.
  return groups.map(g => {
    let e = g;
    for (const fx of effects) {
      if (fx.applyToEnemy) e = { ...e, ...fx.applyToEnemy(e) };
    }
    return e;
  });
}
