/**
 * balance-loader.js
 *
 * Single typed accessor for the rebalance config. All balance-affecting numbers
 * funnel through here. Defaults below = baseline 2026-04-21 (pre-rebalance M64
 * behavior). Live boot in browser overwrites defaults by fetching
 * public/data/balance/balance.active.json.
 *
 * Node (M2 simulator CLI) imports this module and calls setBalance() directly
 * with a parsed JSON — no fetch needed.
 *
 * Rules:
 *   - Sync reads. Throw loudly on missing keys (silent fallback hides bugs).
 *   - Never mutate the returned object.
 *   - Every key in DEFAULTS must exist in every preset.
 */

// ─── Embedded defaults: verbatim M64 baseline ─────────────────────────────
const DEFAULTS = Object.freeze({
  version: '2026-04-21-baseline',
  heroes: {
    hireCost: { base: 100, scaling: 0.10 },
    creation: { baseAttrValue: 8, baseAttrPoints: 8, attrPointsPerLevel: 2 },
  },
  progression: {
    // M323 — XP curve slowed so player level tracks zone level instead of
    // sprinting ahead. Old curve (100/250/450/...) had Act 1 zones over-
    // levelling the player by L4 because two prelude fights gave 50-80 XP
    // each. New curve front-loads more requirement so prologue + first 2
    // border fights leave the player at level 2-3, not level 5.
    // M418 — extended to L30. Curve continues the prior quadratic shape:
    // L20 = 15960; each additional level adds ~1.7k–2.4k XP, scaling a bit
    // more steeply than 1→20 so end-game zones still pace meaningfully.
    xpTable: [0, 120, 320, 600, 960, 1400, 1920, 2520, 3200, 3960, 4800, 5720, 6720, 7800, 8960, 10200, 11520, 12920, 14400, 15960, 17640, 19440, 21360, 23400, 25560, 27840, 30240, 32760, 35400, 38160],
    maxLevel: 30,
    statPointsPerLevel: 2,
    talentPointLevels: [3, 8, 13, 18, 23, 28],
    passivePointEveryNLevels: 5,
  },
  combat: {
    maxHp: { base: 50, conMult: 10 },
    maxMp: { base: 30, intMult: 8 },
    hit: { base: 70, dexMult: 1.2, cap: 95 },
    dodge: {
      hero: { base: 5, dexMult: 0.8, cap: 40 },
      companion: { base: 3, dexMult: 0.35, cap: 15 },
    },
    // M418 — soft-cap on hit chance with diminishing returns above 95%.
    // Effective ceil is 99% (or 100 - target.minMissFloor, whichever is lower).
    // raw=95→95; raw=100→96; raw=110→97; raw=200→99.
    hitRoll: { min: 5, max: 95, softCapKnee: 95, softCapFalloff: 0.2, ceil: 99, defaultMinMissFloor: 3 },
    initiative: { dexCoef: 1, levelCoef: 1 },
    crit: { base: 5, cap: 75, baseDamageMult: 1.5 },
    damage: {
      minCoef: 0.4, maxCoef: 1.0,
      equipMinMult: 1.0, equipMaxMult: 1.5,
      minFloor: 1, maxFloor: 3,
      magicSpellBonusCoef: 0.25,
    },
    spell: {
      intSpellPowerCoef: 0.025,
      manaRegenIntCoef: 0.3, manaRegenMin: 1,
      dotIntCoef: 0.15, dotMin: 3,
      healBaseMult: 1.5,
    },
    // M380 — global hero-skill damage multiplier. Brings spell/skill burst
    // closer to basic-attack damage so AoE finishers can't one-shot Act 3+
    // enemy waves. 1.0 = legacy. Lower values = more weighty fights.
    // M399 — per-category multipliers stack on top of heroDamageMult so we
    // can tune magic separately from heavy/light. Spells were running ~4×
    // basic attacks across a survey; magic at 0.55 brings them to ~1.5–2×.
    skill: {
      heroDamageMult: 1.0,
      heavyMult:      1.00,
      lightMult:      1.00,
      magicMult:      0.78,
    },
    steal: { lifeStealDivisor: 100, manaStealDivisor: 100 },
    mitigation: {
      liveFormula: 'flat',
      simulatorFormula: 'legacy',
      legacyFloorFraction: 0.15,
      curveDr: { k: 100, cap: 0.95 },
    },
  },
  enemies: {
    // M266 rebalance: skill additive-stacking bug fixed; skills now do
    // ~40% of pre-fix damage (matching tooltip numbers). To keep the
    // M265 "~10 round bosses" target, enemy HP dials back to 2.0× (was
    // 2.5× to compensate for the inflated skill damage). Sim shows this
    // lands trash at 6.8 rnd and bosses at 9.7 rnd — right on the goal.
    // M315 rebalance: damage multiplier raised from 1.0→1.3 so enemy hits
    // penetrate player armor and deal meaningful HP loss at all acts.
    // Combined with per-act stat increases in mapData.js this brings
    // Act 5 regular fights to ~30-50% HP loss (target: 35-60%).
    globalMultipliers: { hp: 2.0, damage: 1.3, armor: 1.0, hit: 1.0, dodge: 1.0 },
    // M380 — per-act multipliers stacked on top of globalMultipliers.
    // Acts 1-2 left at 1.0 (Acts 1-2 felt right). Acts 3-5 ramp to keep the
    // late game suspenseful — fight length should rise to 12-20 rounds with
    // a real risk of a hero or companion dropping. Reset to all-1.0 to
    // disable.
    actMultipliers: {
      // M386 — act 0 (prologue) added explicitly so user-supplied balance JSONs
      // omitting it don't silently fall back to 1.0/1.0 and brick solo wipes.
      0: { hp: 0.50, damage: 0.75 },
      1: { hp: 1.0, damage: 1.0 },
      2: { hp: 1.0, damage: 1.0 },
      3: { hp: 1.6, damage: 1.10 },
      4: { hp: 1.9, damage: 1.20 },
      5: { hp: 2.2, damage: 1.30 },
      6: { hp: 2.4, damage: 1.35 },
    },
    ngPlus: {
      hpBase: 4.5, hpBossMult: 1.35,
      dmgBase: 2.8, dmgBossMult: 1.2,
      armorLinear: 0.55,
      hitBonusPerNg: 5, dodgeBonusPerNg: 3,
      hitCap: 95, dodgeCap: 45,
      xpBonusLinear: 0.8, xpBossAdder: 1.0,
    },
  },
  economy: {
    globalMultipliers: { gold: 1.0, xp: 1.0, shopPrice: 1.0, dropRate: 1.0 },
  },
  // M382 — party-size-aware enemy damage. Solo runs aren't 4× harder than
  // full-party runs because enemy damage is scaled down by party size.
  // Lookup is by hero count (companions don't count).
  partySize: {
    enemyDmgMult: { 1: 0.55, 2: 0.75, 3: 0.90, 4: 1.0 },
  },
  // M380 — companion auto-scaling. When companion-level-sync is on, every
  // effective level above the template level grants the companion these
  // attribute bonuses, fed into HP/MP/damage/hit/dodge formulas. Without
  // scaling, a level-1 War Dog hired in Act 1 stays a level-1 War Dog in
  // Act 5 and contributes ~4 damage / hit. With 1 STR + 1 DEX + 1.5 CON
  // per level, an L19-effective War Dog gains +18 STR / +18 DEX / +27 CON,
  // moving it to ~270 HP and ~30 attack damage — still weaker than a
  // hero, but visible in the fight.
  companions: {
    statBonusPerLevel: { STR: 1.0, DEX: 1.0, CON: 1.5, INT: 0.5 },
  },
  tap: { globalMult: 1.0 },
  loot: {
    qualityMult: { low: 0.7, medium: 1.0, high: 1.2, elite: 1.4, exotic: 1.6 },
    rarityAffixCount: { normal: [0, 0], magic: [2, 2], rare: [3, 3], legendary: [5, 6] },
    accessoryAffixBonus: 1,
  },
  m3Preview: {
    curveDr: { enabled: false, k: 100, cap: 0.95 },
    tapPower: {
      enabled: false,
      tiers: [
        { rarity: 'magic', min: 0.05, max: 0.15 },
        { rarity: 'rare', min: 0.12, max: 0.25 },
        { rarity: 'legendary', min: 0.22, max: 0.40 },
      ],
      scopes: ['tapDamage', 'tapUtilityMagnitude', 'tapUtilityDuration'],
    },
  },
});

// ─── Current balance (starts as defaults; replaced by loadBalance*) ──────
let _current = deepFreeze(structuredClone(DEFAULTS));
let _origin = 'defaults';

// ─── Validation (shallow — ensures required sections exist) ───────────────
function validate(b) {
  const required = ['heroes', 'progression', 'combat', 'enemies', 'economy', 'loot'];
  for (const key of required) {
    if (b[key] == null) throw new Error(`[balance-loader] missing required section: ${key}`);
  }
  if (!Array.isArray(b.progression.xpTable)) {
    throw new Error('[balance-loader] progression.xpTable must be an array');
  }
  if (!b.combat.maxHp || typeof b.combat.maxHp.base !== 'number') {
    throw new Error('[balance-loader] combat.maxHp.base missing or not a number');
  }
  // M380 — backfill optional new sections so older balance JSONs don't break.
  if (!b.combat.skill) b.combat.skill = { heroDamageMult: 1.0 };
  if (b.combat.skill.heroDamageMult == null) b.combat.skill.heroDamageMult = 1.0;
  // M399 — backfill per-category multipliers (heavy/light/magic).
  if (b.combat.skill.heavyMult == null) b.combat.skill.heavyMult = 1.00;
  if (b.combat.skill.lightMult == null) b.combat.skill.lightMult = 1.00;
  if (b.combat.skill.magicMult == null) b.combat.skill.magicMult = 0.70;
  if (!b.enemies.actMultipliers) {
    b.enemies.actMultipliers = {
      0: { hp: 1.0, damage: 1.0 },
      1: { hp: 1.0, damage: 1.0 }, 2: { hp: 1.0, damage: 1.0 },
      3: { hp: 1.0, damage: 1.0 }, 4: { hp: 1.0, damage: 1.0 },
      5: { hp: 1.0, damage: 1.0 }, 6: { hp: 1.0, damage: 1.0 },
    };
  }
  if (!b.companions) b.companions = { statBonusPerLevel: { STR: 0, DEX: 0, CON: 0, INT: 0 } };
  if (!b.companions.statBonusPerLevel) b.companions.statBonusPerLevel = { STR: 0, DEX: 0, CON: 0, INT: 0 };
  if (!b.partySize) b.partySize = { enemyDmgMult: { 1: 1.0, 2: 1.0, 3: 1.0, 4: 1.0 } };
  if (!b.partySize.enemyDmgMult) b.partySize.enemyDmgMult = { 1: 1.0, 2: 1.0, 3: 1.0, 4: 1.0 };
  // M386 — game-developer flag: solo-paladin viability depends on this
  // table being keyed by hero count 1..4. Assert at load time so a future
  // edit can't silently break the contract.
  for (const k of [1, 2, 3, 4]) {
    if (typeof b.partySize.enemyDmgMult[k] !== 'number'
        && typeof b.partySize.enemyDmgMult[String(k)] !== 'number') {
      throw new Error(`[balance-loader] partySize.enemyDmgMult missing required key ${k}`);
    }
  }
}

function deepFreeze(obj) {
  if (obj == null || typeof obj !== 'object') return obj;
  for (const v of Object.values(obj)) deepFreeze(v);
  return Object.freeze(obj);
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Returns the current balance config (frozen). Cheap; callers may call on every
 * formula invocation. Safe in both browser and Node.
 */
export function getBalance() {
  return _current;
}

/**
 * Replace the current balance with a parsed JSON object. Validates shape.
 * Used by: Node sim CLI, browser boot once fetch resolves, tests.
 */
export function setBalance(obj, origin = 'external') {
  if (!obj || typeof obj !== 'object') throw new Error('[balance-loader] setBalance expects an object');
  // Clone first so validate() can backfill missing optional sections without
  // mutating the caller's object, and the result is what we freeze.
  const next = structuredClone(obj);
  validate(next);
  _current = deepFreeze(next);
  _origin = origin;
  return _current;
}

/**
 * Browser helper. Fetches JSON, sets it, swallows network errors (falls back to
 * defaults so the game still boots offline). Returns the active object.
 */
export async function loadBalanceFromUrl(url) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return setBalance(json, url);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`[balance-loader] failed to load ${url}, using embedded defaults:`, e.message);
    return _current;
  }
}

/** Reset to embedded defaults. Primarily for tests. */
export function resetBalance() {
  _current = deepFreeze(structuredClone(DEFAULTS));
  _origin = 'defaults';
  return _current;
}

/** Debug: where did the current config come from? */
export function balanceOrigin() {
  return _origin;
}

// Export DEFAULTS for tests / snapshots (frozen).
export const BALANCE_DEFAULTS = DEFAULTS;
