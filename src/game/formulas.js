// src/game/formulas.js
//
// Single source of truth for combat & economy formulas (M83 refactor, M84 rework).
//
// RULES:
//   - Pure functions only. Do NOT import GameState, DOM, or anything stateful.
//   - Every exported function exposes `.formula` (human-readable) and
//     `.inputs` (list of logical input paths) so a future in-game Codex screen
//     and Combat Simulator can render the math.
//
// ─── M84 CANONICAL DAMAGE PIPELINE ─────────────────────────────────────────
//   raw
//     → hit roll (rollToHit); dodge is baked into the hit roll
//     → if hit: block roll (shields only, via rollBlock + applyBlock)
//     → mitigation (applyMitigation):
//         type='physical'  → armor (flat, StarCraft-style). Floor 0.
//         type='magic'     → magic resist (parallel formula). Floor 0.
//         type='true'      → bypass everything.
//       Flat pen: subtract from target armor/resist before mitigation.
//       % pen (RESERVED for legendary/unique affixes, not rolled yet):
//       applied BEFORE flat pen.
//     → final HP damage
//
// Combat log tags:
//   - "deflected" when a physical hit is fully absorbed by armor.
//   - "resisted"  when a magic hit is fully absorbed by magic resist.
//   - "blocked"   when a shield fully absorbs the hit.
//   - "blocked X" when a shield partially absorbs the hit.
//   - true damage never emits deflected/resisted.
//
// See memory/m83_rebalance_plan.md for the broader plan.

import { getPassiveBonuses as _getPassiveBonuses, computeMaxHp as _computeMaxHp, computeMaxMp as _computeMaxMp } from './passives.js';
import { getEquipmentAffixBonuses as _getEquipmentAffixBonuses } from './equipBonuses.js';
import { getBalance } from './balance-loader.js';

// ---------------------------------------------------------------------------
// Passives / max pools (re-exported; already pure in passives.js)
// ---------------------------------------------------------------------------

export function getPassiveBonuses(member) {
  return _getPassiveBonuses(member);
}
getPassiveBonuses.formula = "sum of unlocked passive node bonuses on member";
getPassiveBonuses.inputs = ['member.passives'];
getPassiveBonuses.section = 'stats';

export function computeMaxHp(member) {
  return _computeMaxHp(member);
}
computeMaxHp.formula = "50 + effectiveCON * 10 + passive.maxHp";
computeMaxHp.inputs = ['member.attrs.CON', 'member.passives'];
computeMaxHp.section = 'stats';

export function computeMaxMp(member) {
  return _computeMaxMp(member);
}
computeMaxMp.formula = "30 + effectiveINT * 8 + passive.maxMp";
computeMaxMp.inputs = ['member.attrs.INT', 'member.passives'];
computeMaxMp.section = 'stats';

// ---------------------------------------------------------------------------
// Hero combat stat derivations (extracted from CombatScreen._memberToCombatant)
// ---------------------------------------------------------------------------

/**
 * Equipment-derived armor total.
 * Source: CombatScreen.js L141-145.
 */
export function computeHeroArmor(equipment) {
  const eqp = equipment || {};
  let eqpArmor = 0;
  for (const item of Object.values(eqp)) {
    if (item?.armor) eqpArmor += item.armor;
  }
  return eqpArmor;
}
computeHeroArmor.formula = "sum(item.armor for item in equipment)";
computeHeroArmor.inputs = ['member.equipment[*].armor'];
computeHeroArmor.section = 'armor';

/**
 * Equipment-derived flat damage bonus (averaged weapon dmg * 0.3).
 * Source: CombatScreen.js L141-145.
 */
export function computeHeroEquipDmgBonus(equipment) {
  const eqp = equipment || {};
  let eqpDmgBonus = 0;
  for (const item of Object.values(eqp)) {
    if (item?.dmg) eqpDmgBonus += Math.floor((item.dmg[0] + item.dmg[1]) / 2 * 0.3);
  }
  return eqpDmgBonus;
}
computeHeroEquipDmgBonus.formula = "sum(floor(avg(item.dmg) * 0.3) for weapon items in equipment)";
computeHeroEquipDmgBonus.inputs = ['member.equipment[*].dmg'];
computeHeroEquipDmgBonus.section = 'combat';

/**
 * Hero basic-attack damage range [min, max].
 * M95: damage driver depends on equipped weapon category —
 *   heavy  → STR (axes, hammers, greatswords, swords)
 *   light  → DEX (daggers, rapiers, bows, spears)
 *   magic  → INT (wands, staves, orbs, tomes) + spell-power bonus
 * Unknown/undefined category defaults to 'heavy' for backcompat.
 */
export function computeHeroDamage(stats, equipBonus, weaponCategory = 'heavy') {
  let primary;
  if (weaponCategory === 'light')       primary = stats.DEX || 8;
  else if (weaponCategory === 'magic')  primary = stats.INT || 8;
  else                                  primary = stats.STR || 8;
  const d = getBalance().combat.damage;
  const spellBonus = weaponCategory === 'magic'
    ? Math.floor((stats.INT || 8) * d.magicSpellBonusCoef)
    : 0;
  return [
    Math.max(d.minFloor, Math.round(primary * d.minCoef + equipBonus * d.equipMinMult) + spellBonus),
    Math.max(d.maxFloor, Math.round(primary * d.maxCoef + equipBonus * d.equipMaxMult) + spellBonus),
  ];
}
computeHeroDamage.formula = "heavy→[max(1,round(STR*0.4+eb)), max(3,round(STR*1.0+eb*1.5))]; light→same w/ DEX; magic→same w/ INT plus floor(INT*0.25) spell-power bonus added to both ends";
computeHeroDamage.inputs = ['stats.STR', 'stats.DEX', 'stats.INT', 'equipBonus', 'weaponCategory'];
computeHeroDamage.section = 'combat';

/**
 * Hero hit-rating (0..95).
 * Source: CombatScreen.js L162.
 */
export function computeHeroHit(stats) {
  const h = getBalance().combat.hit;
  return Math.min(h.cap, h.base + Math.round(stats.DEX * h.dexMult));
}
computeHeroHit.formula = "min(95, 70 + round(DEX * 1.2))";
computeHeroHit.inputs = ['stats.DEX'];
computeHeroHit.section = 'combat';

/**
 * Hero dodge-rating. Companions are capped much lower than heroes.
 * Source: CombatScreen.js L163-165.
 */
export function computeHeroDodge(stats, isCompanion) {
  const d = getBalance().combat.dodge;
  const cfg = isCompanion ? d.companion : d.hero;
  return Math.min(cfg.cap, cfg.base + Math.round(stats.DEX * cfg.dexMult));
}
computeHeroDodge.formula = "companion ? min(15, 3 + round(DEX*0.35)) : min(40, 5 + round(DEX*0.8))";
computeHeroDodge.inputs = ['stats.DEX', 'isCompanion'];
computeHeroDodge.section = 'combat';

/**
 * Hero initiative (turn order seed, pre-roll).
 * Source: CombatScreen.js L166.
 */
export function computeHeroInitiative(stats, level) {
  const ini = getBalance().combat.initiative;
  return stats.DEX * ini.dexCoef + (level || 1) * ini.levelCoef;
}
computeHeroInitiative.formula = "DEX + level";
computeHeroInitiative.inputs = ['stats.DEX', 'member.level'];
computeHeroInitiative.section = 'combat';

// ---------------------------------------------------------------------------
// Combat resolution
// ---------------------------------------------------------------------------

/**
 * Chance to hit, with diminishing returns above the soft-cap knee.
 *
 * M418 — previously a hard clamp at 95% meant any actor with hit >> dodge
 * always landed at the cap. Players reported zero misses with their party,
 * which is correct under the old formula but feels broken. The new curve:
 *
 *   raw = actor.hit - target.dodge
 *   if raw <= knee:   chance = max(min_floor, raw)
 *   else:             chance = knee + (raw - knee) * falloff   (asymptotic)
 *
 * Default knee = 95, falloff = 0.2, min_floor = 5. Caller-side `hitRoll.max`
 * still clamps at 99 to preserve a guaranteed miss-window. Per-target
 * `target.minDodgeFloor` (set by enemy data, default 3) ensures even the
 * weakest defender forces at least a small miss chance.
 */
export function rollToHit(actor, target) {
  const hr = getBalance().combat.hitRoll;
  const knee = (hr.softCapKnee == null) ? 95 : hr.softCapKnee;
  const falloff = (hr.softCapFalloff == null) ? 0.2 : hr.softCapFalloff;
  const ceil = (hr.ceil == null) ? 99 : hr.ceil;
  const raw = actor.hit - target.dodge;
  let chance;
  if (raw <= knee) chance = raw;
  else chance = knee + (raw - knee) * falloff;
  // Per-target minimum miss floor: every enemy gets at least this much
  // miss chance baked in; bosses/champions raise it; explicit target data wins.
  let targetMinFloor;
  if (target && target.minMissFloor != null) {
    targetMinFloor = target.minMissFloor;
  } else if (target && target.boss) {
    targetMinFloor = 6;
  } else if (target && (target.isChampion || target.elite)) {
    targetMinFloor = 4;
  } else {
    targetMinFloor = 3;
  }
  const ceilWithFloor = Math.min(ceil, 100 - targetMinFloor);
  return Math.max(hr.min, Math.min(ceilWithFloor, chance));
}
rollToHit.formula = "softcap(actor.hit - target.dodge, knee=95, falloff=0.2, ceil=99 - target.minMissFloor)";
rollToHit.inputs = ['actor.hit', 'target.dodge'];
rollToHit.section = 'combat';

/**
 * M207: Curve-DR armor mitigation. DR = min(cap, armor / (armor + k)).
 * Gated behind config — callers pick which path via liveFormula / simulatorFormula.
 */
export function applyCurveDr(rawDmg, armor) {
  const cfg = getBalance().combat.mitigation.curveDr || { k: 100, cap: 0.95 };
  const k = cfg.k || 100;
  const cap = cfg.cap == null ? 0.95 : cfg.cap;
  const a = Math.max(0, armor || 0);
  const dr = Math.min(cap, a / (a + k));
  return Math.max(0, Math.round((rawDmg || 0) * (1 - dr)));
}
applyCurveDr.formula = "round(rawDmg * (1 - min(cap, armor/(armor+k))))";
applyCurveDr.inputs = ['rawDmg', 'target.armor'];
applyCurveDr.section = 'armor';

/**
 * Returns {armorDr, miscDr, totalDr} — all in 0..1 — for UI display on hero
 * stat panels. armorDr uses the curve (armor/(armor+k)) when live formula is
 * curve-dr; when it's flat (legacy), armorDr is 0 since the flat formula
 * doesn't have a percentage view. miscDr comes from passive resistAll (%).
 * total = 1 - (1-armorDr) * (1-miscDr) to match combat order of operations.
 */
export function computeDamageReduction(armor, miscPct = 0) {
  const mit = getBalance().combat.mitigation;
  let armorDr = 0;
  if (mit.liveFormula === 'curve-dr') {
    const cfg = mit.curveDr || { k: 100, cap: 0.95 };
    const a = Math.max(0, armor || 0);
    armorDr = Math.min(cfg.cap ?? 0.95, a / (a + (cfg.k || 100)));
  }
  const miscDr = Math.max(0, Math.min(0.95, (miscPct || 0) / 100));
  const totalDr = 1 - (1 - armorDr) * (1 - miscDr);
  return { armorDr, miscDr, totalDr };
}
computeDamageReduction.formula = "armorDr = min(cap, armor/(armor+k)); total = 1 - (1-armorDr)*(1-miscDr)";
computeDamageReduction.inputs = ['armor', 'miscPct'];
computeDamageReduction.section = 'armor';

/**
 * LEGACY armor mitigation (pre-M84). Kept for tests that pin old behavior.
 * M207: routes to curve-DR when simulatorFormula='curve-dr'.
 * @deprecated Use applyMitigation instead.
 */
export function applyArmorMitigation(rawDmg, armor) {
  const mit = getBalance().combat.mitigation;
  if (mit.simulatorFormula === 'curve-dr') return applyCurveDr(rawDmg, armor);
  const frac = mit.legacyFloorFraction;
  return Math.max(Math.ceil(rawDmg * frac), rawDmg - armor);
}
applyArmorMitigation.formula = "curve-dr OR max(ceil(rawDmg * 0.15), rawDmg - armor)  [legacy]";
applyArmorMitigation.inputs = ['rawDmg', 'target.armor'];
applyArmorMitigation.section = 'armor';

/**
 * M84: Flat armor reduction, StarCraft-style. Floor 0.
 * M207: routes to curve-DR when liveFormula='curve-dr'.
 */
export function applyArmorReduction(rawDmg, armor) {
  if (getBalance().combat.mitigation.liveFormula === 'curve-dr') return applyCurveDr(rawDmg, armor);
  return Math.max(0, rawDmg - Math.max(0, armor));
}
applyArmorReduction.formula = "curve-dr OR max(0, rawDmg - max(0, armor))";
applyArmorReduction.inputs = ['rawDmg', 'target.armor'];
applyArmorReduction.section = 'armor';

/**
 * M84: Flat magic-resist reduction. Parallel to armor. Floor 0.
 */
export function applyResistMitigation(rawDmg, magicResist) {
  return Math.max(0, rawDmg - Math.max(0, magicResist));
}
applyResistMitigation.formula = "max(0, rawDmg - max(0, magicResist))";
applyResistMitigation.inputs = ['rawDmg', 'target.magicResist'];
applyResistMitigation.section = 'armor';

/**
 * M84: Unified mitigation entry point. Routes by damage type and handles
 * flat + (reserved) % penetration.
 *
 * @param {number} rawDmg - pre-mitigation damage, post-block.
 * @param {object} target - combatant with `.armor` and `.magicResist`.
 * @param {object} opts
 * @param {'physical'|'magic'|'true'} opts.type
 * @param {number} [opts.armorPen=0]    - flat armor penetration
 * @param {number} [opts.resistPen=0]   - flat magic-resist penetration
 * @param {number} [opts.armorPenPct=0] - % armor pen (0..1). RESERVED for legendary/unique affixes.
 * @param {number} [opts.resistPenPct=0]- % resist pen (0..1). RESERVED for legendary/unique affixes.
 */
export function applyMitigation(rawDmg, target, opts = {}) {
  const type = opts.type || 'physical';
  if (type === 'true') return Math.max(0, Math.round(rawDmg));
  const armorPenPct  = opts.armorPenPct  || 0;
  const resistPenPct = opts.resistPenPct || 0;
  const armorPen  = opts.armorPen  || 0;
  const resistPen = opts.resistPen || 0;
  if (type === 'physical') {
    let eff = target?.armor || 0;
    eff = eff * Math.max(0, 1 - armorPenPct); // % first
    eff = eff - armorPen;                     // then flat
    eff = Math.max(0, eff);
    if (getBalance().combat.mitigation.liveFormula === 'curve-dr') {
      return applyCurveDr(rawDmg, eff);
    }
    return Math.max(0, Math.round(rawDmg) - Math.round(eff));
  }
  if (type === 'magic') {
    let eff = target?.magicResist || 0;
    eff = eff * Math.max(0, 1 - resistPenPct);
    eff = eff - resistPen;
    eff = Math.max(0, eff);
    return Math.max(0, Math.round(rawDmg) - Math.round(eff));
  }
  return Math.max(0, Math.round(rawDmg));
}
applyMitigation.formula =
  "type=true: rawDmg; type=phys: max(0, rawDmg - max(0, armor*(1-armorPenPct) - armorPen)); type=magic: max(0, rawDmg - max(0, MR*(1-resistPenPct) - resistPen))";
applyMitigation.inputs = ['rawDmg', 'target.armor', 'target.magicResist', 'opts.type', 'opts.armorPen', 'opts.resistPen', 'opts.armorPenPct', 'opts.resistPenPct'];
applyMitigation.section = 'dmgtypes';

/**
 * Returns 'deflected' | 'resisted' | null — combat log tag for a mitigation
 * outcome. True damage always returns null (never deflected/resisted).
 */
export function mitigationLogTag(rawDmg, finalDmg, type) {
  if (type === 'true') return null;
  if (rawDmg > 0 && finalDmg <= 0) {
    return type === 'magic' ? 'resisted' : 'deflected';
  }
  return null;
}
mitigationLogTag.formula = "rawDmg>0 && finalDmg<=0 && type!='true' ? (type=='magic'?'resisted':'deflected') : null";
mitigationLogTag.inputs = ['rawDmg', 'finalDmg', 'type'];
mitigationLogTag.section = 'dmgtypes';

// ---------------------------------------------------------------------------
// Block system — shields only (M84)
// ---------------------------------------------------------------------------

/**
 * Scans equipment for shield block affixes; returns { blockChance, blockPower }.
 * Multiple shields (shouldn't happen) are summed.
 */
export function getCharacterBlockStats(member) {
  const eqp = member?.equipment || {};
  let chance = 0, power = 0;
  for (const item of Object.values(eqp)) {
    if (!item) continue;
    // Shield discriminator: baseKey==='shield' OR item.isShield OR blockChance set on base.
    const isShield = item.isShield || item.baseKey === 'shield' || item.subtype === 'shield';
    if (!isShield) continue;
    for (const affix of (item.affixes || [])) {
      if (affix.stat === 'block_chance') chance += +affix.value || 0;
      if (affix.stat === 'block_power')  power  += +affix.value || 0;
    }
  }
  return { blockChance: Math.min(1, chance), blockPower: power };
}
getCharacterBlockStats.formula = "sum(block_chance/block_power affixes across equipped shields), blockChance capped at 1.0";
getCharacterBlockStats.inputs = ['member.equipment[*].affixes'];
getCharacterBlockStats.section = 'block';

/**
 * Deterministic block roll. `rand` is injected so tests can pin the result.
 */
export function rollBlock(target, rand = Math.random) {
  return rand() < (target?.blockChance || 0);
}
rollBlock.formula = "rand() < target.blockChance";
rollBlock.inputs = ['target.blockChance'];
rollBlock.section = 'block';

/**
 * Subtracts blockPower from raw damage. Floor 0.
 */
export function applyBlock(rawDmg, target) {
  return Math.max(0, Math.round(rawDmg) - Math.round(target?.blockPower || 0));
}
applyBlock.formula = "max(0, rawDmg - target.blockPower)";
applyBlock.inputs = ['rawDmg', 'target.blockPower'];
applyBlock.section = 'block';

// ---------------------------------------------------------------------------
// Rewards
// ---------------------------------------------------------------------------

/**
 * Gold reward rolled from one defeated enemy. `rand` is injected so tests can
 * pin the roll; defaults to Math.random for live play.
 *
 * M93: goldFind affix now applied. `party` may be either an array of hero
 * members (raw shape — summed via getEquipmentAffixBonuses) or an options
 * object `{ goldFindBonus: number }` for callers that pre-computed the bonus.
 * Companions are NOT counted at the call site per the "find/loot stats are
 * hero-only" rule (see m83_rebalance_plan.md skill-check section).
 */
export function computeGoldReward(enemy, party, rand = Math.random) {
  const g = enemy.gold || [0, 0];
  const rolled = g[0] + Math.floor(rand() * (g[1] - g[0] + 1));
  let bonus = 0;
  if (party && !Array.isArray(party) && typeof party.goldFindBonus === 'number') {
    bonus = party.goldFindBonus;
  } else if (Array.isArray(party)) {
    for (const m of party) {
      // Accept raw members (with .equipment) OR pre-built combatants that still
      // reference their source member via ._srcMember. Combatants without
      // equipment contribute 0, which is a no-op.
      const src = m?.equipment ? m : m?._srcMember;
      if (src) bonus += _getEquipmentAffixBonuses(src).goldFind || 0;
    }
  }
  const mul = getBalance().economy.globalMultipliers.gold;
  return Math.round(rolled * (1 + Math.max(0, bonus)) * mul);
}
computeGoldReward.formula =
  "round((enemy.gold[0] + floor(rand() * (enemy.gold[1] - enemy.gold[0] + 1))) * (1 + sum(hero.goldFind affixes)))";
computeGoldReward.inputs = ['enemy.gold', 'party[*].equipment[*].affixes(goldFind)'];
computeGoldReward.section = 'rewards';

/**
 * XP reward from one defeated enemy.
 * Source: CombatScreen.js L1344.
 */
export function computeXpReward(enemy, party) {
  const base = enemy.xpValue || 0;
  let bonus = 0;
  if (party && !Array.isArray(party) && typeof party.xpFindBonus === 'number') {
    bonus = party.xpFindBonus;
  } else if (Array.isArray(party)) {
    for (const m of party) {
      const src = m?.equipment ? m : m?._srcMember;
      if (src) bonus += _getEquipmentAffixBonuses(src).xpFind || 0;
    }
  }
  const mul = getBalance().economy.globalMultipliers.xp;
  return Math.round(base * (1 + Math.max(0, bonus)) * mul);
}
computeXpReward.formula =
  "round(enemy.xpValue * (1 + sum(hero.xpFind affixes)))";
computeXpReward.inputs = ['enemy.xpValue', 'party[*].equipment[*].affixes(xpFind)'];
computeXpReward.section = 'rewards';

// ---------------------------------------------------------------------------
// Enemy scaling (NG+)
// ---------------------------------------------------------------------------

/**
 * Compute scaled per-enemy numbers for a given NG+ level.
 * Returns `{ hp, dmg, armor, hit, dodge, xpValue }` — does not mutate `enemy`.
 * Source: CombatScreen.js L185-213.
 */
export function enemyScalingForNgPlus(enemy, ngLevel) {
  const ng = ngLevel | 0;
  const isBoss = !!enemy.isBoss;
  const b = getBalance();
  const ngp = b.enemies.ngPlus;
  const gm = b.enemies.globalMultipliers;
  let hpMul = 1, dmgMul = 1, armorMul = 1, hitBonus = 0, dodgeBonus = 0;
  if (ng > 0) {
    hpMul    = Math.pow(ngp.hpBase, ng)  * (isBoss ? ngp.hpBossMult  : 1);
    dmgMul   = Math.pow(ngp.dmgBase, ng) * (isBoss ? ngp.dmgBossMult : 1);
    armorMul = 1 + ng * ngp.armorLinear;
    hitBonus = ng * ngp.hitBonusPerNg;
    dodgeBonus = ng * ngp.dodgeBonusPerNg;
  }
  // M1 rebalance: apply global multipliers on every scale (including ng=0).
  hpMul    *= gm.hp;
  dmgMul   *= gm.damage;
  armorMul *= gm.armor;
  const hp = Math.round(enemy.hp * hpMul);
  const dmg = enemy.dmg.map(d => Math.round(d * dmgMul));
  const armor = Math.round(enemy.armor * armorMul);
  const xpBonus = ng > 0 ? Math.round(enemy.xpValue * (ngp.xpBonusLinear * ng + (isBoss ? ngp.xpBossAdder : 0))) : 0;
  return {
    hp,
    dmg,
    armor,
    hit: Math.min(ngp.hitCap, Math.round((enemy.hit + hitBonus) * gm.hit)),
    dodge: Math.min(ngp.dodgeCap, Math.round((enemy.dodge + dodgeBonus) * gm.dodge)),
    xpValue: Math.round((enemy.xpValue + xpBonus) * b.economy.globalMultipliers.xp),
  };
}
enemyScalingForNgPlus.formula =
  "ng>0 ? { hp:round(hp*4.5^ng*(boss?1.35:1)), dmg:round(dmg*2.8^ng*(boss?1.2:1)), armor:round(armor*(1+ng*0.55)), hit:min(95,hit+ng*5), dodge:min(45,dodge+ng*3), xpValue:xpValue+round(xpValue*(0.8*ng+(boss?1:0))) } : passthrough";
enemyScalingForNgPlus.inputs = ['enemy.hp', 'enemy.dmg', 'enemy.armor', 'enemy.hit', 'enemy.dodge', 'enemy.xpValue', 'enemy.isBoss', 'ngLevel'];
enemyScalingForNgPlus.section = 'scaling';

// ---------------------------------------------------------------------------
// Affix wiring stub (M84)
// ---------------------------------------------------------------------------

/**
 * M93: Real affix wiring. Delegates to equipBonuses.js so passives.js can
 * import the same helper without creating a circular dep through formulas.js.
 * Schema keys: str/dex/int/con, hp, mp, hit, dodge, initiative, dmg, armor,
 * goldFind, manaRegen. Unknown affix keys (legacy burnChance/bleedChance on
 * pre-M93 save data) are silently ignored.
 */
export function getEquipmentAffixBonuses(member) {
  return _getEquipmentAffixBonuses(member);
}
getEquipmentAffixBonuses.formula =
  "sum(affix.value for affix in item.affixes for item in equipment), grouped by canonical stat key; unknown keys ignored";
getEquipmentAffixBonuses.inputs = ['member.equipment[*].affixes'];
getEquipmentAffixBonuses.section = 'stats';

// ---------------------------------------------------------------------------
// Spell / magic formulas (M85 Codex additions)
// ---------------------------------------------------------------------------

/**
 * INT-derived spell multiplier (M116 coefficient).
 * Source: CombatScreen.js L1327.
 */
export function computeSpellPower(member) {
  const INT = (member?.attrs?.INT) || (member?.stats?.INT) || 8;
  const coef = getBalance().combat.spell.intSpellPowerCoef;
  return +((INT * coef).toFixed(2));
}
computeSpellPower.formula = "INT * 0.025  (e.g. 20 INT → 0.50, i.e. +50% spell multiplier)";
computeSpellPower.inputs = ['member.attrs.INT'];
computeSpellPower.section = 'healing';
computeSpellPower.description = "Base spell-power ratio derived from INT. Added to the Potency (spellPower) affix total before scaling any spell or heal.";

/**
 * Pre-mitigation spell damage for a skill cast.
 * M411 — every skill scales off the equipped weapon's damage midpoint.
 * Magic-type skills (and heal) layer the spellPower bonus on top; physical
 * skills layer attackPower. Source: CombatScreen.js _executeSkill.
 */
export function computeSpellDamage(member, skill) {
  const attrs = member?.attrs || { STR: 8, DEX: 8, INT: 8, CON: 8 };
  const spellPower = computeSpellPower(member);
  const affixSP = _getEquipmentAffixBonuses(member).spellPower || 0;
  const w = member?.equipment?.weapon;
  const dmg = w?.dmg || [1, 2];
  const weaponMid = ((dmg[0] || 1) + (dmg[1] || 2)) / 2;
  const isMagic = skill?.type === 'magic' || skill?.type === 'heal'
                || skill?.damageCategory === 'magic';
  const powerBonus = isMagic
    ? (spellPower + affixSP)
    : (Math.round((attrs.STR || 8) * 1.5) * 0.05);
  const mult = skill?.damageMult || 1.0;
  return Math.round(mult * weaponMid * (1 + powerBonus));
}
computeSpellDamage.formula = "round(skill.damageMult * weaponMid * (1 + powerBonus));  weaponMid = mid(equipment.weapon.dmg);  powerBonus = magic ? (INT*0.025 + affix.spellPower) : (STR*1.5*0.05)";
computeSpellDamage.inputs = ['member.equipment.weapon.dmg', 'member.attrs.INT', 'member.attrs.STR', 'skill.damageMult', 'skill.type', 'member.equipment[*].affixes(spellPower)'];
computeSpellDamage.section = 'healing';
computeSpellDamage.description = "Pre-mitigation skill damage. Scales off equipped weapon damage midpoint. Magic/heal skills layer spellPower (INT-derived); physical skills layer attackPower (STR-derived).";

/**
 * Heal amount for a heal-type skill.
 * M411 — heals scale off equipped weapon damage midpoint, same as damage
 * skills, with spellPower layered on top.
 */
export function computeHealAmount(member, skill) {
  const attrs = member?.attrs || { STR: 8, DEX: 8, INT: 8, CON: 8 };
  const spellPower = computeSpellPower(member);
  const affixSP = _getEquipmentAffixBonuses(member).spellPower || 0;
  const healStatKey = (skill?.healStat || skill?.effect?.healStat || 'damage');
  let healStatVal;
  if (String(healStatKey).toLowerCase() === 'damage') {
    const w = member?.equipment?.weapon;
    const dmg = w?.dmg || [1, 2];
    healStatVal = ((dmg[0] || 1) + (dmg[1] || 2)) / 2;
  } else if (healStatKey === 'str') healStatVal = attrs.STR || 8;
  else if (healStatKey === 'dex') healStatVal = attrs.DEX || 8;
  else if (healStatKey === 'con') healStatVal = attrs.CON || 8;
  else healStatVal = attrs.INT || 8;
  const healMult = skill?.healMult || 1.5;
  const flatFloor = skill?.healAmount || skill?.effect?.healAmount || 0;
  const scaled = Math.round(healMult * healStatVal * (1 + spellPower + affixSP));
  return Math.max(flatFloor, scaled);
}
computeHealAmount.formula = "max(skill.healAmount, round(skill.healMult * weaponMid * (1 + INT*0.025 + affix.spellPower)))";
computeHealAmount.inputs = ['member.equipment.weapon.dmg', 'member.attrs.INT', 'skill.healMult', 'skill.healStat', 'skill.healAmount', 'member.equipment[*].affixes(spellPower)'];
computeHealAmount.section = 'healing';
computeHealAmount.description = "HP restored by a heal skill. Scales off equipped weapon damage midpoint and spellPower. skill.healAmount acts as a flat floor (e.g. Second Wind's 80 HP base).";

/**
 * Per-round DoT tick damage (burn / poison / bleed).
 * Source: CombatScreen.js L2015-2017 and L1802-1804.
 * If status.power is set explicitly it is used directly; otherwise INT scales it.
 */
export function computeDotTick(member, status) {
  if (status?.power != null) return Math.max(1, status.power);
  const INT = (member?.attrs?.INT) || (member?.stats?.INT) || 8;
  const s = getBalance().combat.spell;
  return Math.max(s.dotMin, Math.floor(INT * s.dotIntCoef));
}
computeDotTick.formula = "status.power != null ? max(1, status.power) : max(3, floor(INT * 0.15))";
computeDotTick.inputs = ['status.power', 'member.attrs.INT'];
computeDotTick.section = 'status';
computeDotTick.description = "HP lost per round from burn, poison, or bleed. Explicit skill power is used when set; otherwise defaults to caster INT * 0.15 (floor 3).";

/**
 * Overheal-to-barrier: excess HP from a heal becomes a temporary barrier.
 * Source: src/mods/statusModel.js overhealToBarrier.
 */
export function computeBarrierAbsorb(actor, incomingHeal) {
  if (!actor || !incomingHeal) return 0;
  const max = actor.maxHp || actor.hpMax || 100;
  const cur = actor.hp || 0;
  return Math.max(0, (cur + incomingHeal) - max);
}
computeBarrierAbsorb.formula = "max(0, (actor.hp + incomingHeal) - actor.maxHp)";
computeBarrierAbsorb.inputs = ['actor.hp', 'actor.maxHp', 'incomingHeal'];
computeBarrierAbsorb.section = 'healing';
computeBarrierAbsorb.description = "HP overflow above max that converts into a 3-round barrier status. Zero if not over-healed.";

/**
 * Mana regen per round.
 * Source: CombatScreen.js L2086 + L2095.
 */
export function computeRegenTick(member) {
  const INT = (member?.attrs?.INT) || 8;
  const s = getBalance().combat.spell;
  const base = Math.max(s.manaRegenMin, Math.round(INT * s.manaRegenIntCoef));
  const affixBonus = Math.round(_getEquipmentAffixBonuses(member).manaRegen || 0);
  return base + affixBonus;
}
computeRegenTick.formula = "max(1, round(INT * 0.3)) + affix.manaRegen";
computeRegenTick.inputs = ['member.attrs.INT', 'member.equipment[*].affixes(manaRegen)'];
computeRegenTick.section = 'healing';
computeRegenTick.description = "MP recovered each round in combat. Base scales with INT; Mana Regen affixes add flat bonus.";

/**
 * Life steal — HP returned to attacker after dealing damage.
 * Source: CombatScreen.js L1962.
 */
export function computeLifeSteal(dmg, member) {
  const pct = _getEquipmentAffixBonuses(member).lifeSteal || 0;
  return Math.floor(dmg * pct / getBalance().combat.steal.lifeStealDivisor);
}
computeLifeSteal.formula = "floor(finalDmg * affix.lifeSteal / 100)";
computeLifeSteal.inputs = ['finalDmg', 'member.equipment[*].affixes(lifeSteal)'];
computeLifeSteal.section = 'combat';
computeLifeSteal.description = "HP healed on the attacker after landing a hit. Driven by Life Steal affix (integer %).";

/**
 * Mana steal — MP returned to attacker after dealing damage.
 * Source: CombatScreen.js L1969.
 */
export function computeManaSteal(dmg, member) {
  const pct = _getEquipmentAffixBonuses(member).manaSteal || 0;
  return Math.floor(dmg * pct / getBalance().combat.steal.manaStealDivisor);
}
computeManaSteal.formula = "floor(finalDmg * affix.manaSteal / 100)";
computeManaSteal.inputs = ['finalDmg', 'member.equipment[*].affixes(manaSteal)'];
computeManaSteal.section = 'combat';
computeManaSteal.description = "MP restored on the attacker after landing a hit. Driven by Mana Steal affix (integer %).";

/**
 * Total crit chance (%) for a combatant.
 * Source: CombatScreen.js L1252-1253 and L1768.
 * critBonus is flat % from passive talents; critChance affix is fractional (0.15 = 15%).
 */
export function computeCritChance(member) {
  const ab = _getEquipmentAffixBonuses(member);
  const c = getBalance().combat.crit;
  const passive = (member?.critBonus || 0);
  return Math.min(c.cap, c.base + passive + (ab.critChance || 0) * 100);
}
computeCritChance.formula = "min(75, 5 + passive.critBonus + affix.critChance*100)  [%]";
computeCritChance.inputs = ['member.critBonus', 'member.equipment[*].affixes(critChance)'];
computeCritChance.section = 'combat';
computeCritChance.description = "Percentage chance to land a critical hit. Base 5%, capped at 75%. Passive talent critBonus (flat %) and critChance affix (fractional) both add to it.";

/**
 * Crit damage multiplier.
 * Source: CombatScreen.js L1254 and L1769.
 */
export function computeCritDamage(member) {
  const ab = _getEquipmentAffixBonuses(member);
  return getBalance().combat.crit.baseDamageMult + (ab.critDamage || 0);
}
computeCritDamage.formula = "1.5 + affix.critDamage";
computeCritDamage.inputs = ['member.equipment[*].affixes(critDamage)'];
computeCritDamage.section = 'combat';
computeCritDamage.description = "Multiplier applied to raw damage on a crit. Base 1.5x; critDamage affix adds directly (e.g. 0.5 → 2.0x total).";

// ---------------------------------------------------------------------------
// Introspection helpers (M85 Codex)
// ---------------------------------------------------------------------------

// Registry of every exported formula function, used by the Codex screen so
// new formulas appear automatically (never hand-maintained).
const _FORMULA_REGISTRY = {
  getPassiveBonuses, computeMaxHp, computeMaxMp,
  computeHeroArmor, computeHeroEquipDmgBonus, computeHeroDamage,
  computeHeroHit, computeHeroDodge, computeHeroInitiative,
  rollToHit, applyArmorMitigation, applyArmorReduction, applyResistMitigation,
  applyMitigation, mitigationLogTag,
  getCharacterBlockStats, rollBlock, applyBlock,
  computeGoldReward, computeXpReward, enemyScalingForNgPlus,
  getEquipmentAffixBonuses,
  // M85 Codex additions
  computeSpellPower, computeSpellDamage, computeHealAmount,
  computeDotTick, computeBarrierAbsorb, computeRegenTick,
  computeLifeSteal, computeManaSteal,
  computeCritChance, computeCritDamage,
};

// Expose a minimal surface on globalThis so items.js (which stays free of a
// formulas.js import to avoid circulars) can render live Total Damage in
// weapon tooltips. See getItemTooltip() for the consumer.
if (typeof globalThis !== 'undefined') {
  globalThis.__rsgFormulas = {
    computeHeroDamage,
    computeHeroEquipDmgBonus,
    getEquipmentAffixBonuses,
  };
}

export function getAllFormulas() {
  return _FORMULA_REGISTRY;
}

/**
 * Returns every formula whose `.inputs` list references the given stat
 * (case-insensitive match on `stats.STR`, `attrs.STR`, `member.attrs.STR`).
 * Used by the Codex per-stat detail pages.
 */
export function getFormulasUsingStat(statName) {
  if (!statName) return [];
  const needle = String(statName).toUpperCase();
  const out = [];
  for (const [name, fn] of Object.entries(_FORMULA_REGISTRY)) {
    const inputs = fn.inputs || [];
    const hit = inputs.some(p => String(p).toUpperCase().includes('.' + needle) || String(p).toUpperCase().endsWith(needle));
    if (hit) out.push({ name, fn, formula: fn.formula, inputs });
  }
  return out;
}
getFormulasUsingStat.formula = "filter(FORMULAS, fn => fn.inputs mentions stat)";
getFormulasUsingStat.inputs = ['statName'];
