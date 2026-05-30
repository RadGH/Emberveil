// src/game/simulator.js
//
// Combat Simulator v2 engine — pure JS, deterministic turn runner.
// Imports formulas.js for all math (single source of truth). Does NOT touch
// CombatScreen — reimplements only the minimal loop needed to get DPS / TTK /
// EHP numbers. Designed to be safe to call from a debug UI or from tests.
//
// See memory/m83_rebalance_plan.md round-2 "Combat Simulator scope".

import {
  computeHeroArmor,
  computeHeroEquipDmgBonus,
  computeHeroDamage,
  computeHeroHit,
  computeHeroDodge,
  computeHeroInitiative,
  computeMaxHp,
  computeMaxMp,
  rollToHit,
  applyArmorMitigation,
  enemyScalingForNgPlus,
  getEquipmentAffixBonuses,
  getCharacterBlockStats,
} from './formulas.js';
import { getEquippedWeaponCategory, generateItem } from './items.js';
import { getUnlockedSkills, mergeSkillForCast } from './skills.js';
import { getPassiveBonuses } from './passives.js';
import { CLASSES } from './classes.js';
import { getCompanionPower, companionPowerMult } from './companions.js';
import { addDmgBuff, getDmgBuffMult, getCritBonusTotal, isSilenced } from '../mods/statusModel.js';
import { dispatchLegendaryHook, getActorLegendaryIds } from './legendaryEffects.js';
import { getActiveSetBonuses, getActiveLegendaryEffects } from './sets.js';
import { computeStatusTick, isDotStatus } from './statusTick.js';
import { combatDebug } from '../utils/combatDebug.js';
import { getBalance } from './balance-loader.js';
import { ENEMY_SPELLS, resolveSpells } from './enemySpells.js';

// ---------------------------------------------------------------------------
// Seeded RNG — Mulberry32. 10-line PRNG so simulations are reproducible.
// ---------------------------------------------------------------------------
export function mulberry32(seed) {
  let a = (seed | 0) || 1;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Combatant builders — pure, do not mutate inputs.
// ---------------------------------------------------------------------------

/**
 * Build a combatant from a party/companion member.
 * Mirrors the subset of CombatScreen._memberToCombatant that formulas.js owns.
 */
export function heroToCombatant(member, { isCompanion = false, vanillaOnly = false } = {}) {
  // Normalise class field so passives/skills/AI all see the same key.
  // M315: also lowercase class id — save files can have e.g. cls:"Rogue" (capital
  // from display-name storage) which broke getUnlockedSkills() lookup causing 0 skills.
  const classId = (member.cls || member.className || member.class || '').toLowerCase();
  const normalised = { ...member, class: classId, cls: classId };
  const baseStats = member.attrs || member.stats || { STR: 10, DEX: 10, INT: 10, CON: 10 };
  // M116 parity: fold passive + affix bonuses into the effective stats the
  // simulator hands to damage/heal formulas. Live combat uses the same stack
  // via computeMaxHp/Mp, so skills were previously driven by unbuffed base.
  const passive = getPassiveBonuses(normalised);
  const ab = getEquipmentAffixBonuses(normalised);
  // M380 — companion stat scaling parity with CombatScreen. Effective level
  // is set by the caller (playthrough sim or live combat) on member._effectiveLevel
  // OR via the explicit member.effectiveLevel field; bonuses scale per delta.
  let _scaleBonus = { STR: 0, DEX: 0, INT: 0, CON: 0 };
  const _effLvl = member._effectiveLevel || member.effectiveLevel || 0;
  if (isCompanion && _effLvl && _effLvl > (member.level || 1)) {
    try {
      const _bal = getBalance();
      const _b = _bal.companions?.statBonusPerLevel || {};
      const _delta = _effLvl - (member.level || 1);
      // M427 — power-tier multiplier on per-level scaling. P3 = baseline 1×,
      // P1 = 0.33×, P5 = 1.67×. Materially differentiates a War Dog from a
      // Frost Wyrmling at the same effective level.
      const _power = getCompanionPower(member);
      const _pm = companionPowerMult(_power);
      _scaleBonus = {
        STR: Math.round((_b.STR || 0) * _delta * _pm),
        DEX: Math.round((_b.DEX || 0) * _delta * _pm),
        INT: Math.round((_b.INT || 0) * _delta * _pm),
        CON: Math.round((_b.CON || 0) * _delta * _pm),
      };
    } catch (_) { /* keep zeros */ }
  }
  const effStats = {
    STR: (baseStats.STR || 8) + (passive.STR || 0) + (ab.str || 0) + _scaleBonus.STR,
    DEX: (baseStats.DEX || 8) + (passive.DEX || 0) + (ab.dex || 0) + _scaleBonus.DEX,
    INT: (baseStats.INT || 8) + (passive.INT || 0) + (ab.int || 0) + _scaleBonus.INT,
    CON: (baseStats.CON || 8) + (passive.CON || 0) + (ab.con || 0) + _scaleBonus.CON,
  };
  const equipBonus = computeHeroEquipDmgBonus(member.equipment);
  const armor = computeHeroArmor(member.equipment);
  // M95: weapon category drives which stat powers basic attacks.
  const weaponCategory = getEquippedWeaponCategory(member.equipment);
  const [dmgMin, dmgMax] = computeHeroDamage(effStats, equipBonus, weaponCategory);
  // M380 — recompute maxHp/Mp from the scaled CON/INT for synced companions
  // (computeMaxHp reads member.attrs which doesn't reflect the scaling bonus).
  let maxHp, maxMp;
  if (_scaleBonus.CON || _scaleBonus.INT) {
    try {
      const _bal = getBalance();
      const _h = _bal.combat.maxHp, _m = _bal.combat.maxMp;
      maxHp = _h.base + effStats.CON * _h.conMult + (passive.maxHp || 0) + (ab.hp || 0);
      maxMp = _m.base + effStats.INT * _m.intMult + (passive.maxMp || 0) + (ab.mp || 0);
    } catch (_) {
      maxHp = computeMaxHp(normalised);
      maxMp = computeMaxMp(normalised);
    }
  } else {
    maxHp = computeMaxHp(normalised);
    maxMp = computeMaxMp(normalised);
  }
  const level = member.level || 1;
  // Raw skills — merged per-cast via mergeSkillForCast so talents/upgrades apply.
  // M150: vanillaOnly strips mod-registered skills for the diff-view comparison.
  // M264 parity: respect the player's selected skills list (member.skills) when
  // present. Previously sim loaded every unlocked class skill, so a knight who
  // only picked Shield Bash would still have sim cast Holy Strike at L10.
  // Playtest only casts the skills the player has selected in the Skill Tree.
  let skills = getUnlockedSkills(classId, level).filter(s => s.type !== 'passive');
  const picked = Array.isArray(member.skills) ? member.skills.filter(Boolean) : null;
  if (picked && picked.length) {
    const pickedSet = new Set(picked);
    skills = skills.filter(s => pickedSet.has(s.id));
  }
  if (vanillaOnly) skills = skills.filter(s => !(s && s._pack && s._pack !== 'vanilla_skills_bootstrap'));
  return {
    kind: 'hero',
    id: member.id || member.name,
    name: member.name || 'Hero',
    cls: classId,
    level,
    stats: effStats,
    hp: maxHp,
    maxHp,
    mp: maxMp,
    maxMp,
    armor,
    dmg: [dmgMin, dmgMax],
    hit: computeHeroHit(effStats),
    dodge: computeHeroDodge(effStats, isCompanion),
    initiative: computeHeroInitiative(effStats, level),
    alive: true,
    isCompanion,
    lifeSteal: ab.lifeSteal || 0,
    // M265: block parity — shield block chance + block power were missing from
    // sim entirely, so characters with heavy shields (Ylva: 58% block chance,
    // 114 block power) were taking every hit full damage. CombatScreen uses
    // rollBlock + applyBlock via getCharacterBlockStats on the equipped shield.
    blockChance: (() => { try { return getCharacterBlockStats(member).blockChance || 0; } catch { return 0; } })(),
    blockPower:  (() => { try { return getCharacterBlockStats(member).blockPower  || 0; } catch { return 0; } })(),
    manaSteal: ab.manaSteal || 0,
    // M116 — crit affixes + Potency in simulator (live parity).
    critChance: ab.critChance || 0,
    critDamage: ab.critDamage || 0,
    affixSpellPower: ab.spellPower || 0,
    critBonus: (passive.critPct || 0) + (ab.hit || 0) * 0, // passives may add flat crit%
    weaponCategory,
    skills,
    skillCooldowns: {},
    // Back-ref so the AI can mergeSkillForCast with talents/upgrades.
    _member: normalised,
    // M378 — legendary effect IDs from active sets + unique items, mirroring
    // CombatScreen._memberToCombatant. Without this, dispatchLegendaryHook
    // never fires in the simulator.
    _legendaryEffectIds: (() => {
      try {
        const eqp = member.equipment || {};
        const activeSets = getActiveSetBonuses(eqp);
        const setEffects = getActiveLegendaryEffects(activeSets);
        const uniqueEffects = Object.values(eqp)
          .filter(it => it && it.isUnique && it.legendaryEffectId)
          .map(it => it.legendaryEffectId);
        return [...new Set([...setEffects, ...uniqueEffects])];
      } catch (_) { return []; }
    })(),
    // statuses[] is appended by simExecuteSkill / DoT application; ensure it
    // exists so legendary applyStatus shims can push without a guard.
    statuses: [],
  };
}

/**
 * Flatten an ENCOUNTERS entry (which has `enemies: [{ ...stats, count }]`)
 * into a list of combatant instances. Applies NG+ scaling via formulas.js.
 *
 * M315 fix: the `act` parameter no longer maps to NG+ level. Act-based enemy
 * difficulty is baked into the base stats in mapData.js (each act's enemy block
 * has progressively higher HP/dmg/armor). The ng (NG+ loop) field is separate
 * and defaults to 0 for a normal first playthrough. Passing act=5 previously
 * caused 4.5^4 ≈ 410× HP — completely wrong for normal play.
 *
 * @param {Object} encounter  - ENCOUNTERS entry
 * @param {Object} opts
 * @param {number} [opts.act=1]  - ignored for scaling (kept for caller compat)
 * @param {number} [opts.ng=0]   - actual NG+ loop level (0 = first playthrough)
 */
export function encounterToCombatants(encounter, { act = 1, ng = 0, partySize = 4 } = {}) {
  if (!encounter || !Array.isArray(encounter.enemies)) return [];
  // ng=0 for normal play; callers can pass ng explicitly for NG+ simulation.
  const ngLevel = Math.max(0, ng | 0);
  // M380: per-act multipliers stack on top of globalMultipliers.
  // M382: in NG+, shift the effective act so Act 1 enemies use Act 5's ramp
  // (an Act 1 prologue fight on NG+1 should feel like end-of-game Act 5,
  // not the Act 1 baseline).
  // M386: game-developer flag — old cap `min(6, act + 4*ng)` flattened every
  // NG+2+ zone to the Act-6 ceiling. Cap raised to 10 and actMultipliers
  // extended to acts 7-10 in balance config so each NG loop preserves the
  // early-vs-late gradient. ngPlus.hpBase/dmgBase still stack per loop for
  // raw HP/damage growth on top.
  const _bal = (typeof getBalance === 'function') ? getBalance() : null;
  const _effAct = ngLevel > 0 ? Math.min(10, (act | 0) + 4 * ngLevel) : (act | 0);
  const _actM = _bal?.enemies?.actMultipliers?.[_effAct] || _bal?.enemies?.actMultipliers?.[String(_effAct)];
  const actHpMul  = _actM?.hp     ?? 1.0;
  const actDmgMul = _actM?.damage ?? 1.0;
  // M382: party-size damage scaling — solo runs aren't 4× harder than full party.
  const _psTable = _bal?.partySize?.enemyDmgMult || {};
  const _psKey = Math.max(1, Math.min(4, partySize | 0));
  const partyDmgMul = _psTable[_psKey] ?? _psTable[String(_psKey)] ?? 1.0;
  const out = [];
  let idx = 0;
  for (const group of encounter.enemies) {
    const count = group.count || 1;
    for (let i = 0; i < count; i++) {
      const scaled = enemyScalingForNgPlus(group, ngLevel);
      // M380 — bosses already have inflated HP from M315; receive only the
      // sqrt-ish portion of the per-act mult so they don't become 50-round
      // grinds. Damage mult passes through unchanged. Heuristic for sim:
      // explicit isBoss flag, OR a single-count enemy whose name matches the
      // encounter (the canonical "boss + minions" shape in mapData).
      const _matchesEnc = (encounter.name && (group.name === encounter.name));
      const _isBoss = !!(group.isBoss || (count === 1 && _matchesEnc));
      const _bossDamp = _isBoss ? Math.max(1.0, 1.0 + (actHpMul - 1.0) * 0.35) : actHpMul;
      const actHp  = Math.max(1, Math.round(scaled.hp  * _bossDamp));
      const actDmg = scaled.dmg.map(d => Math.max(1, Math.round(d * actDmgMul * partyDmgMul)));
      out.push({
        kind: 'enemy',
        id: `${group.id || 'enemy'}_${idx++}`,
        name: ngLevel > 0 ? `${group.name || group.id || 'Enemy'} ${'*'.repeat(Math.min(ngLevel, 3))}` : (group.name || group.id || 'Enemy'),
        level: group.level || (1 + ngLevel * 2),
        hp: actHp,
        maxHp: actHp,
        armor: scaled.armor,
        dmg: actDmg,
        hit: scaled.hit,
        dodge: scaled.dodge,
        xpValue: scaled.xpValue,
        gold: group.gold || [0, 0],
        initiative: (group.dodge || 0) + (group.level || 1),
        alive: true,
        // M469: copy spell + block fields so simulator parity matches CombatScreen.
        spellList: group.spellList ? [...group.spellList] : [],
        spellChance: group.spellChance || 0,
        blockChance: group.blockChance || 0,
        blockMitigation: group.blockMitigation || 0.5,
        skillCooldowns: {},
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Core simulation loop
// ---------------------------------------------------------------------------

function pickTarget(candidates) {
  // lowest-HP alive target
  let best = null;
  for (const c of candidates) {
    if (!c.alive) continue;
    if (!best || c.hp < best.hp) best = c;
  }
  return best;
}

function rollInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/**
 * Resolve a stat key ('str', 'int', 'dex', 'str_int', etc.) to a numeric value.
 */
function getSkillStat(statKey, attrs, actor) {
  const sk = statKey ? String(statKey).toLowerCase() : '';
  if (!sk) return attrs.STR || 8;
  if (sk === 'damage') {
    const a = actor || attrs?._actor;
    const lo = (a?.dmg && a.dmg[0]) || 1;
    const hi = (a?.dmg && a.dmg[1]) || lo + 1;
    return (lo + hi) / 2;
  }
  if (sk === 'str') return attrs.STR || 8;
  if (sk === 'dex') return attrs.DEX || 8;
  if (sk === 'int') return attrs.INT || 8;
  if (sk === 'str_int') return Math.round(((attrs.STR || 8) + (attrs.INT || 8)) / 2);
  if (sk === 'str_dex') return Math.round(((attrs.STR || 8) + (attrs.DEX || 8)) / 2);
  if (sk === 'dex_int') return Math.round(((attrs.DEX || 8) + (attrs.INT || 8)) / 2);
  if (sk === 'dex_con') return Math.round(((attrs.DEX || 8) + (attrs.CON || 8)) / 2);
  return attrs.STR || 8;
}

/**
 * Simulator hero AI — mirrors CombatScreen._heroAI skill selection logic.
 * Returns { type: 'skill', skill, targets } or { type: 'attack' }.
 */
// M116 parity: classes treated as healers/supports for AI priority.
const HEALER_CLASSES = new Set(['cleric', 'priest', 'druid', 'oracle', 'shaman', 'paladin']);

function simHeroAI(actor, allies, enemies) {
  if (!actor.skills || !actor.skills.length) return { type: 'attack' };

  // M131: per-skill cooldown tick
  if (!actor.skillCooldowns) actor.skillCooldowns = {};
  for (const k of Object.keys(actor.skillCooldowns)) {
    if (--actor.skillCooldowns[k] <= 0) delete actor.skillCooldowns[k];
  }

  // Merge each candidate skill with talents/upgrades so mpCost/aoe/type
  // reflect the real castable skill (CombatScreen parity via mergeSkillForCast).
  const merged = actor.skills.map(s => mergeSkillForCast(s, actor._member || {}));
  const silenced = isSilenced(actor);
  const usable = merged.filter(s =>
    !actor.skillCooldowns[s.id] &&
    (s.mpCost || 0) <= actor.mp &&
    !(silenced && (s.type === 'magic' || s.type === 'heal' || (s.mpCost || 0) > 0))
  );
  if (!usable.length) return { type: 'attack' };

  const classId = actor.cls;
  const personality = actor._member?.personality || 'neutral';
  // M261: parity with CombatScreen — 'protective' personality also counts as healer,
  // and 'aggressive' personality prefers AoE/damage (matches playtest branching).
  const isHealer = HEALER_CLASSES.has(classId) || personality === 'protective';
  const healSkills = usable.filter(s => s.type === 'heal');
  const healSkill = healSkills.sort((a, b) => (b.mpCost || 0) - (a.mpCost || 0))[0];
  // Shield/barrier support skill (buff with dmgReduct / absorb).
  const shieldSkill = usable.find(s => s.type === 'buff' && s.effect && (s.effect.dmgReduct || s.effect.shield || s.effect.barrier));
  const anyHurt = allies.find(a => a.alive && a.hp / a.maxHp < 0.8);
  const criticalAlly = allies.find(a => a.alive && a.hp / a.maxHp < 0.3);
  const woundedAlly = allies.find(a => a.alive && a.hp / a.maxHp < 0.6);

  let picked = null;

  // 1. Revive fallen allies (highest priority).
  const fallenAlly = allies.find(a => !a.alive);
  const reviveSkill = usable.find(s => s.type === 'revive');
  if (fallenAlly && reviveSkill) {
    picked = reviveSkill;
  }
  // 2. Critical ally → heal (any class that has one).
  else if (healSkill && criticalAlly) {
    picked = healSkill;
  }
  // 3. Healer class with wounded ally → heal.
  else if (isHealer && healSkill && anyHurt) {
    picked = healSkill;
  }
  // 4. Healer/support with wounded ally and shield available → shield.
  // M262 parity: only healers pick shield/dmgReduct buffs as a support action.
  // Previously any class with effect.dmgReduct (e.g. knight_taunt) would spam
  // it every turn; CombatScreen only does this for isHealer + urgentHurt.
  // Also skip if actor already has dmgReduct active (buff not yet expired).
  else if (isHealer && woundedAlly && shieldSkill && !(actor.dmgReduct > 0)) {
    picked = shieldSkill;
  }
  else {
    // M429 — score damage skills by expected damage = mult × hits × target count.
    // Replaces the prior mpCost-as-proxy sort which let cheap multi-bolt skills
    // sort under heavier-mp single-targets, and let Magic Missile out-rank
    // Fireball against 6 enemies even though Fireball has higher expected dmg.
    const _enemyCount = enemies.length;
    const damageScore = (s) => {
      const mult = s.damageMult || 0;
      if (mult <= 0) return 0;
      const hits = s.hits || 1;
      const aoe = s.aoe || 'single';
      let targets;
      if (aoe === 'all')                                                  targets = _enemyCount;
      else if (aoe === 'group2' || aoe === 'random4' || aoe === 'random5') targets = Math.min(_enemyCount, 4);
      else if (aoe === 'group' || aoe === 'row' || aoe === 'random3' || aoe === 'chain' || aoe === 'chain3' || aoe === 'multi3') targets = Math.min(_enemyCount, 3);
      else if (aoe === 'row2' || aoe === 'multi4')                        targets = Math.min(_enemyCount, 4);
      else if (aoe === 'adjacent' || aoe === 'adjacent2')                 targets = Math.min(_enemyCount, 2);
      else if (s.target === 'all_enemies')                                targets = _enemyCount;
      else                                                                targets = 1;
      return mult * hits * targets + (s.mpCost || 0) * 0.001;
    };
    picked = usable.filter(s => (s.type === 'melee' || s.type === 'magic' || s.type === 'ranged' || s.type === 'zone') && (s.damageMult || 0) > 0)
      .sort((a, b) => damageScore(b) - damageScore(a))[0];
    // 7. Buff / shield self-cast.
    if (!picked) picked = usable.find(s => s.type === 'buff');
    // 8. Fallback — any usable.
    if (!picked) picked = usable[0];
  }

  if (picked) return { type: 'skill', skill: picked };
  return { type: 'attack' };
}

/**
 * M378 — meter-attribute helper. Mirrors CombatScreen's per-actor / per-source
 * damage bucketing so legendary procs (Dragon Breath, Mana Shockwave, Echo
 * Cast, Arcane Bounce, etc.) end up under their own row instead of being
 * folded into the parent skill or "Attack". Called from the legendary
 * applyDmg shim AND from regular damage paths.
 */
function meterAdd(simCtx, actor, target, amount, source) {
  if (!actor || amount <= 0) return;
  if (actor.kind === 'hero') {
    simCtx.damageDealtByHero.set(actor.id, (simCtx.damageDealtByHero.get(actor.id) || 0) + amount);
    // Per-source breakdown (M369 parity).
    if (!simCtx.damageBySource.has(actor.id)) simCtx.damageBySource.set(actor.id, new Map());
    const m = simCtx.damageBySource.get(actor.id);
    const key = source || 'Attack';
    m.set(key, (m.get(key) || 0) + amount);
  }
  combatDebug.push('meter_add', {
    actor: actor.name, kind: 'dmg', amount, source: source || 'Attack',
    target: target ? target.name : null, side: actor.kind === 'hero' ? 'party' : 'enemy',
  });
}

/**
 * M378 — apply a flat damage amount to a target. Used by the legendary
 * applyDmg shim; bypasses the full skill formula but still goes through
 * armor/dmgReduct so legendary effects don't ignore mitigation. Pushes
 * damage_apply + meter_add (with the supplied sourceName).
 */
function simApplyDamage(simCtx, actor, target, amount, sourceName, element) {
  if (!target || !target.alive) return;
  // No mitigation pipeline here — legendary effects in CombatScreen call
  // _applyDamage directly, which DOES skip the resolveIncomingDamage step
  // (rawDmg has already been computed by the legendary). Match that.
  const dmg = Math.max(0, Math.round(amount));
  combatDebug.push('damage_apply', {
    actor: actor?.name, target: target.name, raw: amount, final: dmg,
    source: sourceName || null, element: element || null, legendary: true,
    hpAfter: Math.max(0, target.hp - dmg),
  });
  target.hp -= dmg;
  meterAdd(simCtx, actor, target, dmg, sourceName);
  if (target.hp <= 0) {
    target.hp = 0; target.alive = false;
    // Legendary kill chains: dispatch onKill for the source actor too.
    if (actor && actor.kind === 'hero') {
      dispatchSimLegendary(simCtx, 'onKill', actor, { target, dealt: dmg });
    }
  }
}

/**
 * M378 — build a ctx + dispatch a legendary hook. The ctx provides the same
 * helpers as CombatScreen: applyDmg, applyStatus, heal, log, allies, enemies.
 */
function dispatchSimLegendary(simCtx, hookName, actor, extra = {}) {
  const ids = getActorLegendaryIds(actor);
  if (!ids.length) return;
  combatDebug.push('legendary_proc', {
    actor: actor?.name, actorId: actor?.id,
    hook: hookName,
    effectIds: ids.slice(),
    ctx: { target: extra?.target?.name, dealt: extra?.dealt, isCrit: !!extra?.isCrit, rawDmg: extra?.rawDmg, skillId: extra?.skillId },
  });
  const allies  = (actor.kind === 'hero' ? simCtx.party : simCtx.enemies).filter(a => a && a.alive);
  const enemies = (actor.kind === 'hero' ? simCtx.enemies : simCtx.party).filter(e => e && e.alive);
  const ctx = {
    actor,
    allies,
    enemies,
    log: (msg) => { simCtx.log.push({ round: simCtx.round, type: 'legendary_log', actor: actor.name, msg }); },
    applyStatus: (tgt, type, dur, pow) => {
      if (!tgt) return;
      tgt.statuses = tgt.statuses || [];
      const existing = tgt.statuses.find(s => s.type === type);
      if (existing) { existing.duration = Math.max(existing.duration, dur); }
      else { tgt.statuses.push({ type, duration: dur, power: pow }); }
      combatDebug.push('status_apply', { target: tgt.name, type, duration: dur, power: pow, src: 'legendary' });
    },
    applyDmg: (src, tgt, amt, color, sourceName, element) => {
      simApplyDamage(simCtx, src, tgt, amt, sourceName, element);
    },
    heal: (tgt, amt) => {
      if (!tgt || !tgt.alive) return;
      const actual = Math.min(amt, (tgt.maxHp || 0) - (tgt.hp || 0));
      if (actual > 0) tgt.hp += actual;
    },
    ...extra,
  };
  dispatchLegendaryHook(hookName, ctx, ids);
}

/**
 * Execute a skill in the simulation, applying damage/healing/buffs.
 * Returns log entries array.
 */
function simExecuteSkill(actor, skill, allies, enemies, rng, damageDealtByHero, simCtx) {
  const s = actor.stats;
  // M116: parity with CombatScreen._castSkill — INT * 0.025.
  const spellPower = +((s.INT || 8) * 0.025).toFixed(2);
  const affixSP = (actor.affixSpellPower || 0); // M181: fraction
  const entries = [];

  combatDebug.push('skill_cast_attempt', {
    actor: actor.name, skill: skill.name, skillId: skill.id, mpCost: skill.mpCost || 0,
    mpBefore: actor.mp,
  });
  actor.mp -= (skill.mpCost || 0);
  if (!actor.skillCooldowns) actor.skillCooldowns = {};
  actor.skillCooldowns[skill.id] = skill.cooldown || 2;

  // Heal
  if (skill.type === 'heal') {
    const target = [...allies].filter(a => a.alive).sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
    if (!target) return entries;
    const healStatKey = skill.healStat || (skill.effect && skill.effect.healStat) || 'damage';
    const healStatVal = getSkillStat(healStatKey, s, actor);
    const healMult = skill.healMult || 1.5;
    const scaledHeal = Math.round(healMult * healStatVal * (1 + spellPower));
    const flatFloor = skill.healAmount || (skill.effect && skill.effect.healAmount) || 0;
    const healAmt = Math.max(flatFloor, scaledHeal);
    target.hp = Math.min(target.maxHp, target.hp + healAmt);
    entries.push({ type: 'heal', actor: actor.name, target: target.name, heal: healAmt, skill: skill.name });
    return entries;
  }

  // Revive
  if (skill.type === 'revive') {
    const fallen = allies.filter(a => !a.alive);
    if (!fallen.length) return entries;
    const eff = skill.effect || {};
    const hpPct = eff.reviveHp || 0.25;
    const target = fallen[0];
    target.alive = true;
    target.hp = Math.max(1, Math.floor(target.maxHp * hpPct));
    actor.skillCooldowns[skill.id] = Math.max(actor.skillCooldowns[skill.id] || 0, skill.cooldown || 12);
    entries.push({ type: 'revive', actor: actor.name, target: target.name, skill: skill.name });
    return entries;
  }

  // Buff
  if (skill.type === 'buff') {
    const eff = skill.effect || {};
    const dur = eff.duration || 2;
    let buffTargets = [];
    if (skill.target === 'party') buffTargets = allies.filter(a => a.alive);
    else if (skill.target === 'self') buffTargets = [actor];
    else buffTargets = [actor];
    for (const t of buffTargets) {
      if (eff.dmgBuff) { addDmgBuff(t, eff.dmgBuff, dur); }
      if (eff.dmgReduct) { t.dmgReduct = eff.dmgReduct; t.dmgReductRounds = dur; }
    }
    entries.push({ type: 'buff', actor: actor.name, skill: skill.name, targets: buffTargets.length });
    return entries;
  }

  // Debuff / zone / trap / counter / utility — simplified: log and return
  if (['debuff', 'zone', 'trap', 'counter', 'utility', 'passive'].includes(skill.type)) {
    entries.push({ type: 'skill_other', actor: actor.name, skill: skill.name, skillType: skill.type });
    return entries;
  }

  // Damage skills (melee / magic)
  // M399 — hybrid stat resolution mirrors CombatScreen._resolveHybridStat so
  // Holy Strike with a heavy mace lands as STR-only, with a wand as INT-only.
  const _hybrid = (() => {
    const ds = (skill.damageStat || '').toLowerCase();
    if (!ds.includes('_')) return { stat: ds, category: null, hybrid: false };
    const wcat = (actor?.weaponCategory || '').toLowerCase();
    const isHeavy = /2h|hammer|maul|axe/.test(wcat);
    const isMagic = /staff|wand|scepter|orb|tome/.test(wcat);
    if (ds === 'str_int') return isHeavy ? { stat: 'str', category: 'heavy', hybrid: true }
                                : isMagic ? { stat: 'int', category: 'magic', hybrid: true }
                                : { stat: 'str', category: 'light', hybrid: true };
    if (ds === 'str_dex') return isHeavy ? { stat: 'str', category: 'heavy', hybrid: true }
                                : { stat: 'dex', category: 'light', hybrid: true };
    if (ds === 'dex_int') return isMagic ? { stat: 'int', category: 'magic', hybrid: true }
                                : { stat: 'dex', category: 'light', hybrid: true };
    return { stat: ds, category: null, hybrid: false };
  })();
  const _resolvedDamageStat = _hybrid.hybrid ? _hybrid.stat : (skill.damageStat || '');
  let statVal = getSkillStat(_resolvedDamageStat || skill.damageStat, s);
  // Weapon Scaling is always on — drive skill damage off weapon midpoint.
  // Sim uses midpoint (not a random roll) so its mean estimate stays clean
  // and matches the panel preview (CombatScreen rolls per-hit; over many
  // trials the mean converges to this midpoint, preserving sim parity).
  {
    const lo = (actor.dmg && actor.dmg[0]) || 1;
    const hi = (actor.dmg && actor.dmg[1]) || lo + 1;
    statVal = (lo + hi) / 2;
  }
  // M380: global hero skill multiplier knob lets us pull all spell/skill
  // damage closer to basic-attack damage without editing every skill.
  const _skBal = (typeof getBalance === 'function' ? getBalance().combat?.skill : null);
  const _heroSkillMult = (_skBal && typeof _skBal.heroDamageMult === 'number') ? _skBal.heroDamageMult : 1.0;
  // M399 — per-category multiplier (heavy/light/magic) parity with the live
  // CombatScreen damage path so sim numbers track production. Hybrid skills
  // inherit category from the resolved stat (heavy mace → heavy etc.).
  const _category = (() => {
    if (skill.damageCategory) return skill.damageCategory;
    // M411 — weapon category is the source of truth (parity with CombatScreen).
    const wcat = (actor?.weaponCategory || '').toLowerCase();
    if (skill.type === 'magic' || skill.type === 'heal') return 'magic';
    if (wcat === 'magic' || wcat === 'heavy' || wcat === 'light') return wcat;
    return 'heavy';
  })();
  const _categoryMult = _category === 'magic' ? ((_skBal?.magicMult ?? 0.78))
                      : _category === 'heavy' ? ((_skBal?.heavyMult ?? 1.00))
                      : ((_skBal?.lightMult ?? 1.00));
  const mult = (skill.damageMult || 1.0) * _heroSkillMult * _categoryMult;
  // M399 — isSpell tracks the resolved category (so a str_int + heavy mace
  // skill is no longer "magic" and doesn't get spellPower).
  const isSpell = (_category === 'magic')
    || (!_hybrid.hybrid && (skill.damageStat === 'int' || skill.type === 'magic'));
  const powerBonus = isSpell ? (spellPower + affixSP) : 0;
  // M262 parity: CombatScreen adds weaponFlavor = 10% of weapon roll on
  // non-spell skills. Sim approximates with actor.weaponDmgAvg (falls back
  // to actor.dmg midpoint if present).
  const weaponMid = actor.dmg ? (actor.dmg[0] + actor.dmg[1]) / 2 : (actor.weaponDmgAvg || 0);
  const weaponFlavor = isSpell ? 0 : Math.round(weaponMid * 0.1);
  const baseDmg = Math.round(mult * statVal * (1 + powerBonus)) + weaponFlavor;

  // Determine targets based on AoE (M116 parity).
  let targets = [];
  const aoe = skill.aoe;
  const alive = enemies.filter(e => e.alive);
  if (aoe === 'all' || aoe === 'group' || aoe === 'row' || aoe === 'row2') {
    targets = alive;
  } else if (aoe === 'adjacent' || aoe === 'adjacent2' || aoe === 'group2' || aoe === 'chain') {
    targets = alive.slice(0, 3);
  } else if (aoe === 'chain3' || aoe === 'multi3' || aoe === 'random3') {
    targets = alive.slice(0, 3);
  } else if (aoe === 'multi4' || aoe === 'random4') {
    targets = alive.slice(0, 4);
  } else if (aoe === 'pierce_row') {
    targets = alive.slice(0, 3);
  } else {
    const t = pickTarget(enemies);
    if (t) targets = [t];
  }

  // M116: Multi-target damage falloff — matches CombatScreen.
  const tc = targets.length;
  const FALLOFF = tc <= 1 ? 1.0 : tc === 2 ? 0.8 : tc === 3 ? 0.6 : 0.5;

  for (const target of targets) {
    const chance = rollToHit(actor, target);
    const roll = rng() * 100;
    combatDebug.push('hit_check', { actor: actor.name, target: target.name, chance, roll, hit: roll <= chance, skill: skill.name });
    if (roll > chance) {
      entries.push({ round: 0, actor: actor.name, target: target.name, type: 'miss', dmg: 0 });
      continue;
    }
    let scaled = Math.round(baseDmg * FALLOFF);
    // M262 parity: skill.effect vs-type damage bonuses (e.g. knight_holy_strike
    // +50% vs demons/undead). Target.type carries 'demon'/'undead' tags.
    const eff = skill.effect || {};
    const tgtTags = target.tags || [];
    const tgtType = target.enemyType || target.type || '';
    // M263 parity: match CombatScreen — reads eff.bonusVsDemon / eff.bonusVsUndead
    // (the Holy Strike family) in addition to dmgBuffVs* (knight skills).
    const tgtId = target.enemyId || target.id || '';
    const tagBlob = (Array.isArray(tgtTags) ? tgtTags.join(' ') : String(tgtTags)) + ' ' + tgtType + ' ' + tgtId;
    // Match CombatScreen's `/demon/i.test(tags)` / `/undead/i.test(tags)` — intentionally
    // narrow; dragons are NOT demons per lore, so Holy Strike's vs-demon bonus should
    // NOT apply to them here or in playtest. If playtest IS applying it, that's a
    // playtest bug, not a sim miss.
    const isDemon = /demon|fiend|imp/i.test(tagBlob);
    const isUndead = /undead|wraith|bone|skeleton|lich|ghoul/i.test(tagBlob);
    const vsDemonBonus = (eff.bonusVsDemon || 0) + (eff.dmgBuffVsDemon || 0);
    const vsUndeadBonus = (eff.bonusVsUndead || 0) + (eff.dmgBuffVsUndead || 0);
    if (vsDemonBonus && isDemon) scaled = Math.round(scaled * (1 + vsDemonBonus));
    if (vsUndeadBonus && isUndead) scaled = Math.round(scaled * (1 + vsUndeadBonus));
    // M116: crit affix parity. 5% base + critChance (fractional) + critBonus (flat %).
    const critPct = Math.min(75, 5 + getCritBonusTotal(actor) + (actor.critChance || 0) * 100);
    const critMult = 1.5 + (actor.critDamage || 0);
    const critRoll = rng() * 100;
    const isCrit = critRoll < critPct;
    combatDebug.push('crit_check', { actor: actor.name, target: target.name, chance: critPct, roll: critRoll, crit: isCrit, skill: skill.name });
    if (isCrit) scaled = Math.round(scaled * critMult);
    combatDebug.push('damage_calc', {
      actor: actor.name, target: target.name, skill: skill.name,
      base: baseDmg, falloff: FALLOFF, postCrit: scaled, isCrit,
    });
    // M265: physical block roll before armor mitigation (matches CombatScreen order).
    let preArmor = scaled;
    if (target.kind === 'hero' && (target.blockChance || 0) > 0 && rng() < target.blockChance) {
      preArmor = Math.max(0, preArmor - (target.blockPower || 0));
    }
    const mitigated = applyArmorMitigation(preArmor, target.armor || 0);
    // Apply dmg reduction buff on target
    let dmg = Math.max(0, mitigated);
    if (target.dmgReduct) dmg = Math.max(0, Math.round(dmg * (1 - target.dmgReduct)));
    // Apply dmg buff on actor (M168: unified via statusModel)
    const db = getDmgBuffMult(actor);
    if (db) dmg = Math.round(dmg * (1 + db));
    target.hp -= dmg;
    // M262 parity: life steal from attacker affixes / passives.
    let stolenLife = 0;
    if (actor.lifeSteal > 0 && dmg > 0) {
      const stolen = Math.floor(dmg * actor.lifeSteal / 100);
      if (stolen > 0 && actor.hp < actor.maxHp) {
        actor.hp = Math.min(actor.maxHp, actor.hp + stolen);
        stolenLife += stolen;
      }
    }
    // M263 parity: skill.effect.lifesteal (Holy-Strike-family) — % of damage
    // healed back to caster. This is separate from affix lifesteal.
    const effLS = (skill.effect && skill.effect.lifesteal) || 0;
    if (effLS > 0 && dmg > 0) {
      const heal = Math.floor(dmg * effLS);
      if (heal > 0 && actor.hp < actor.maxHp) {
        actor.hp = Math.min(actor.maxHp, actor.hp + heal);
        stolenLife += heal;
      }
    }
    if (actor.kind === 'hero') {
      damageDealtByHero.set(actor.id, (damageDealtByHero.get(actor.id) || 0) + dmg);
    }
    // M378 — meter_add + damage_apply for parity with CombatScreen.
    combatDebug.push('damage_apply', {
      actor: actor.name, target: target.name, raw: baseDmg, final: dmg,
      source: skill.name, isCrit, hpAfter: Math.max(0, target.hp),
    });
    if (simCtx) {
      // Add meter_add directly (skip meterAdd helper because we already
      // bumped damageDealtByHero above for legacy compatibility).
      if (actor.kind === 'hero') {
        if (!simCtx.damageBySource.has(actor.id)) simCtx.damageBySource.set(actor.id, new Map());
        const m = simCtx.damageBySource.get(actor.id);
        m.set(skill.name, (m.get(skill.name) || 0) + dmg);
      }
      combatDebug.push('meter_add', {
        actor: actor.name, kind: 'dmg', amount: dmg, source: skill.name,
        target: target.name, side: actor.kind === 'hero' ? 'party' : 'enemy', crit: isCrit,
      });
    }
    const targetKilled = target.hp <= 0;
    if (targetKilled) { target.hp = 0; target.alive = false; }
    entries.push({
      round: 0, actor: actor.name, target: target.name, type: 'hit',
      raw: baseDmg, dmg, lifeSteal: stolenLife, targetHpAfter: target.hp, skill: skill.name,
      crit: isCrit,
    });
    // M378 — legendary onHit / onCrit / onKill dispatch (heroes only).
    if (simCtx && actor.kind === 'hero' && dmg > 0) {
      dispatchSimLegendary(simCtx, 'onHit', actor, { target, rawDmg: baseDmg, dealt: dmg, isCrit, skillId: skill.id });
      if (isCrit) dispatchSimLegendary(simCtx, 'onCrit', actor, { target, rawDmg: baseDmg, dealt: dmg, skillId: skill.id });
      if (targetKilled) dispatchSimLegendary(simCtx, 'onKill', actor, { target, dealt: dmg, skillId: skill.id });
    }
  }
  // M378 — onCast fires once per skill use (not per target). Mirrors
  // CombatScreen._castSkill which dispatches after the skill resolves.
  // Pass last-target so effects like Echo Cast / Arcane Bounce can use it.
  if (simCtx && actor.kind === 'hero') {
    const lastTarget = targets.length ? targets[targets.length - 1] : null;
    dispatchSimLegendary(simCtx, 'onCast', actor, {
      target: lastTarget,
      skillId: skill.id,
      dealt: entries.filter(e => e.type === 'hit').reduce((a, e) => a + (e.dmg || 0), 0),
    });
  }
  return entries;
}

/**
 * Runs a single deterministic encounter.
 *
 * @param {Object}   opts
 * @param {Object[]} opts.heroes  party members (already shaped like combat input)
 * @param {Object}   opts.encounter  an ENCOUNTERS entry
 * @param {number}   opts.act     act (1..5)
 * @param {number}   opts.seed    PRNG seed
 * @param {number}   [opts.maxRounds=50]
 */
export function runSimulation({ heroes, encounter, act = 1, ng = 0, seed = 1, maxRounds = 50, vanillaOnly = false }) {
  const _heroCount = (heroes || []).filter(h => !(h.isCompanion || h.class === 'companion' || h.cls === 'companion')).length || 1;
  const rng = mulberry32(seed);
  const party = heroes.map(h => heroToCombatant(h, { isCompanion: !!h.isCompanion, vanillaOnly }));
  const enemies = encounterToCombatants(encounter, { act, ng, partySize: _heroCount });

  const log = [];
  const damageDealtByHero = new Map(); // hero.id -> total dmg
  const damageBySource = new Map();    // hero.id -> Map(source -> dmg)
  const hpHistoryByHero = new Map();   // hero.name -> array of hp per round
  party.forEach(h => {
    damageDealtByHero.set(h.id, 0);
    damageBySource.set(h.id, new Map());
    hpHistoryByHero.set(h.name, [h.hp]);
  });

  // M378 — sim context shared with skill execution + legendary dispatch.
  const simCtx = { party, enemies, log, damageDealtByHero, damageBySource, round: 0 };

  combatDebug.setEncounter(encounter?.name || encounter?.id || 'unknown');

  // M378 — onCombatStart for each living hero with legendary effects.
  for (const h of party) {
    if (h.alive) dispatchSimLegendary(simCtx, 'onCombatStart', h, {});
  }

  const all = [...party, ...enemies];
  // M378 — initiative_roll events + turn_order build.
  for (const c of all) {
    combatDebug.push('initiative_roll', { actor: c.name, kind: c.kind, initiative: c.initiative });
  }
  all.sort((a, b) => (b.initiative || 0) - (a.initiative || 0));

  let round = 0;
  let winner = null;
  while (round < maxRounds) {
    round++;
    simCtx.round = round;
    combatDebug.setRound(round);
    combatDebug.push('turn_order', { round, order: all.filter(c => c.alive).map(c => c.name) });

    // M378 — apply per-round status ticks (DoT damage + regen) BEFORE actor
    // turns, mirroring CombatScreen._processStatusEffects placement (it runs
    // per-round). DoT damage attributes to the status type.
    for (const c of all) {
      if (!c.alive || !Array.isArray(c.statuses)) continue;
      c.statuses = c.statuses.filter(s => {
        const tick = computeStatusTick(s);
        // Only tick & decrement here for tick-bearing statuses (DoT / regen).
        // dmgBuff / critBonus / dmgReduct are decremented by the legacy buff
        // pass below to preserve original sim behavior.
        if (tick.kind === 'none') return true;
        if (tick.kind === 'dot') {
          c.hp -= tick.amount;
          combatDebug.push('status_tick', {
            target: c.name, type: tick.type, amount: tick.amount,
            duration: s.duration, hpAfter: Math.max(0, c.hp),
          });
          log.push({ round, actor: c.name, target: c.name, type: 'status_tick', dmg: tick.amount, statusType: tick.type });
          if (c.hp <= 0) { c.hp = 0; c.alive = false; }
        } else if (tick.kind === 'heal' && c.hp < c.maxHp) {
          c.hp = Math.min(c.maxHp, c.hp + tick.amount);
          combatDebug.push('status_tick', {
            target: c.name, type: tick.type, amount: tick.amount, duration: s.duration, hpAfter: c.hp, kind: 'heal',
          });
        }
        s.duration = (s.duration || 0) - 1;
        return s.duration > 0;
      });
    }

    // Tick buff durations at round start
    for (const c of all) {
      // M168: dmgBuff already migrated to statuses[] (handled in tick above
      // for duration decrement). Keep legacy decrement for any non-DoT
      // statuses that still rely on this path (dmgBuff, critBonus).
      if (Array.isArray(c.statuses)) {
        c.statuses = c.statuses.map(s => (s.type === 'dmgBuff' || s.type === 'critBonus') ? { ...s, duration: (s.duration || 0) - 1 } : s)
          .filter(s => !(s.type === 'dmgBuff' || s.type === 'critBonus') || s.duration > 0);
      }
      if (c.dmgReductRounds !== undefined) {
        c.dmgReductRounds--;
        if (c.dmgReductRounds <= 0) { c.dmgReduct = 0; c.dmgReductRounds = undefined; }
      }
      // Mana regen: 1 MP per round for heroes
      if (c.kind === 'hero' && c.alive && c.maxMp > 0) {
        c.mp = Math.min(c.maxMp, c.mp + 1);
      }
    }
    let turnIdx = 0;
    for (const actor of all) {
      if (!actor.alive) continue;
      const foes = actor.kind === 'hero' ? enemies : party;
      const friendlies = actor.kind === 'hero' ? party : enemies;
      const aliveFoes = foes.filter(e => e.alive);
      if (!aliveFoes.length) break;

      turnIdx++;
      combatDebug.setTurn(turnIdx, actor.name);
      combatDebug.push('turn_start', { round, turnIdx, actor: actor.name, hp: actor.hp, mp: actor.mp });

      // Hero AI: try to use skills first
      if (actor.kind === 'hero') {
        const decision = simHeroAI(actor, friendlies, aliveFoes);
        combatDebug.push('ai_decision', {
          actor: actor.name, decision: decision.type,
          skill: decision.skill ? decision.skill.name : null,
          skillId: decision.skill ? decision.skill.id : null,
        });
        if (decision.type === 'skill') {
          const skillEntries = simExecuteSkill(actor, decision.skill, friendlies, aliveFoes, rng, damageDealtByHero, simCtx);
          for (const e of skillEntries) { e.round = round; log.push(e); }
          continue;
        }
      }

      // M469: Enemy spell AI — mirrors CombatScreen._enemyAI spell-cast branch.
      // Before basic attack, roll spellChance and pick an available (off-cooldown) spell.
      if (actor.kind === 'enemy') {
        // Decrement per-spell cooldowns at turn start (mirrors CombatScreen._executeTurn behavior).
        if (actor.skillCooldowns) {
          for (const k of Object.keys(actor.skillCooldowns)) {
            if (--actor.skillCooldowns[k] <= 0) delete actor.skillCooldowns[k];
          }
        }
        if (actor.spellList && actor.spellList.length > 0 && !isSilenced(actor)) {
          const availableSpells = resolveSpells(actor.spellList).filter(sp => {
            const cd = (actor.skillCooldowns || {})[sp.id] || 0;
            return cd <= 0;
          });
          if (availableSpells.length > 0 && rng() < (actor.spellChance || 0)) {
            const spell = availableSpells[Math.floor(rng() * availableSpells.length)];
            if (!actor.skillCooldowns) actor.skillCooldowns = {};
            actor.skillCooldowns[spell.id] = spell.cooldown || 2;
            const eff = spell.effect || {};
            const spellTargets = spell.target === 'aoe' ? [...aliveFoes] : (aliveFoes.length ? [aliveFoes[0]] : []);
            let spellDmgTotal = 0;
            for (const st of spellTargets) {
              if (eff.damage) {
                const spellDmg = Math.max(0, Math.round(eff.damage) - Math.round(st.magicResist || 0));
                st.hp -= spellDmg;
                spellDmgTotal += spellDmg;
                if (st.hp <= 0) { st.hp = 0; st.alive = false; }
              }
            }
            combatDebug.push('enemy_spell', {
              actor: actor.name, spell: spell.id, spellName: spell.name,
              targets: spellTargets.map(t => t.name), dmg: spellDmgTotal,
            });
            log.push({
              round, actor: actor.name, target: spellTargets.map(t => t.name).join(','),
              type: 'spell', spell: spell.id, dmg: spellDmgTotal,
            });
            continue;
          }
        }
      }

      // Basic attack fallback
      const target = pickTarget(foes);
      if (!target) break;

      const chance = rollToHit(actor, target);
      const roll = rng() * 100;
      combatDebug.push('hit_check', { actor: actor.name, target: target.name, chance, roll, hit: roll <= chance, skill: 'Attack' });
      if (roll > chance) {
        log.push({ round, actor: actor.name, target: target.name, type: 'miss', dmg: 0 });
        continue;
      }
      const raw = rollInt(rng, actor.dmg[0], actor.dmg[1]);
      // M469: block roll for both hero and enemy defenders (enemy uses percentage-based blockMitigation).
      let preArmor = raw;
      let didBlock = false;
      if ((target.blockChance || 0) > 0 && rng() < target.blockChance) {
        didBlock = true;
        if (target.kind === 'hero') {
          preArmor = Math.max(0, preArmor - (target.blockPower || 0));
        } else {
          // Enemy block: percentage-based (default 50% reduction, matches CombatScreen).
          preArmor = Math.max(0, Math.round(preArmor * (1 - (target.blockMitigation || 0.5))));
        }
      }
      const mitigated = applyArmorMitigation(preArmor, target.armor || 0);
      let dmg = Math.max(0, mitigated);
      // Apply damage buffs/reductions
      if (target.dmgReduct) dmg = Math.max(0, Math.round(dmg * (1 - target.dmgReduct)));
      const dbAtk = getDmgBuffMult(actor);
      if (dbAtk) dmg = Math.round(dmg * (1 + dbAtk));
      combatDebug.push('damage_calc', { actor: actor.name, target: target.name, raw, mitigated, final: dmg, source: 'Attack' });
      target.hp -= dmg;
      if (actor.kind === 'hero') {
        damageDealtByHero.set(actor.id, (damageDealtByHero.get(actor.id) || 0) + dmg);
        const m = damageBySource.get(actor.id);
        m.set('Attack', (m.get('Attack') || 0) + dmg);
      }
      combatDebug.push('damage_apply', {
        actor: actor.name, target: target.name, raw, final: dmg,
        source: 'Attack', hpAfter: Math.max(0, target.hp),
      });
      combatDebug.push('meter_add', {
        actor: actor.name, kind: 'dmg', amount: dmg, source: 'Attack',
        target: target.name, side: actor.kind === 'hero' ? 'party' : 'enemy',
      });
      // Life steal / mana steal
      if (dmg > 0 && actor.lifeSteal > 0) {
        const stolen = Math.floor(dmg * actor.lifeSteal / 100);
        if (stolen > 0) actor.hp = Math.min(actor.maxHp, actor.hp + stolen);
      }
      if (dmg > 0 && actor.manaSteal > 0) {
        const stolen = Math.floor(dmg * actor.manaSteal / 100);
        if (stolen > 0) actor.mp = Math.min(actor.maxMp || 80, (actor.mp || 0) + stolen);
      }
      const targetKilled = target.hp <= 0;
      if (targetKilled) {
        target.hp = 0;
        target.alive = false;
      }
      log.push({
        round, actor: actor.name, target: target.name, type: 'hit',
        raw, dmg, targetHpAfter: target.hp,
        blocked: didBlock || undefined,
      });
      // M378 — basic-attack legendary hooks (heroes only). Crit/onCrit isn't
      // tracked on basic attacks in sim (no crit branch above), so only
      // onHit + onKill fire here.
      if (actor.kind === 'hero' && dmg > 0) {
        dispatchSimLegendary(simCtx, 'onHit', actor, { target, rawDmg: raw, dealt: dmg, isCrit: false, skillId: 'attack' });
        if (targetKilled) dispatchSimLegendary(simCtx, 'onKill', actor, { target, dealt: dmg, skillId: 'attack' });
      }
    }
    // record hp per hero after each round
    for (const h of party) {
      hpHistoryByHero.get(h.name).push(h.hp);
    }
    const partyAlive = party.some(h => h.alive);
    const enemyAlive = enemies.some(e => e.alive);
    if (!partyAlive) { winner = 'enemies'; break; }
    if (!enemyAlive) { winner = 'party'; break; }
  }
  if (!winner) winner = 'timeout';

  combatDebug.push('report_finalize', {
    winner, rounds: round,
    partyDmgTotal: [...damageDealtByHero.values()].reduce((a, b) => a + b, 0),
  });

  // Stats — use display name as key so UI shows human-readable labels
  const dpsPerHero = {};
  for (const h of party) {
    const dealt = damageDealtByHero.get(h.id) || 0;
    // assume 1 round ~ 6 seconds of in-fiction time for dps
    dpsPerHero[h.name] = round > 0 ? dealt / (round * 6) : 0;
  }
  const ehpPerHero = {};
  for (const h of party) {
    // EHP = maxHp * (1 + armor/100). Cheap approximation for the readout.
    ehpPerHero[h.name] = Math.round(h.maxHp * (1 + (h.armor || 0) / 100));
  }

  // TTK estimates: enemy side = rounds it took party to kill them (if they won).
  const ttk = {
    partyKillsEnemies: winner === 'party' ? round : null,
    enemiesKillEarty: winner === 'enemies' ? round : null,
  };

  // M378 — per-source breakdown by hero name (mirrors meter sources view).
  const damageBySourceByName = {};
  for (const h of party) {
    const m = damageBySource.get(h.id);
    if (!m) continue;
    damageBySourceByName[h.name] = Object.fromEntries(m);
  }

  return {
    winner,
    rounds: round,
    log,
    party,
    enemies,
    stats: {
      dpsPerHero,
      ehpPerHero,
      ttk,
      hpHistoryByHero: Object.fromEntries(hpHistoryByHero),
      totalPartyDps: Object.values(dpsPerHero).reduce((a, b) => a + b, 0),
      damageBySource: damageBySourceByName,
    },
  };
}

/**
 * Monte Carlo: run N simulations varying the seed, return aggregate stats.
 * Synchronous; safe for tests. UIs prefer runMonteCarloAsync (M398) which
 * yields between batches so the page doesn't lock up for a full second.
 */
export function runMonteCarlo({ heroes, encounter, act = 1, runs = 1000, baseSeed = 1 }) {
  let wins = 0;
  let totalRounds = 0;
  const dmgSamples = [];
  for (let i = 0; i < runs; i++) {
    const res = runSimulation({ heroes, encounter, act, seed: baseSeed + i });
    if (res.winner === 'party') wins++;
    totalRounds += res.rounds;
    // dmg sample: total party damage across the run
    let totalDmg = 0;
    for (const e of res.log) if (e.type === 'hit') totalDmg += e.dmg;
    dmgSamples.push(totalDmg);
  }
  const mean = dmgSamples.reduce((a, b) => a + b, 0) / runs;
  const variance = dmgSamples.reduce((a, b) => a + (b - mean) ** 2, 0) / runs;
  return {
    runs,
    winRate: wins / runs,
    avgRounds: totalRounds / runs,
    dmgMean: mean,
    dmgVariance: variance,
    dmgSamples,
  };
}

/** Synchronous alias for tests / non-UI callers. */
export const runMonteCarloSync = runMonteCarlo;

/**
 * M398 — async Monte Carlo: same math as runMonteCarlo, but processes in
 * batches of `batchSize` (default 25) and yields to the browser via
 * requestAnimationFrame between batches so the UI thread doesn't freeze.
 * Default `runs` lowered to 200 (from 1000) on user feedback.
 *
 * Optional `onProgress(done, total)` is called once per batch.
 */
export async function runMonteCarloAsync({ heroes, encounter, act = 1, runs = 200, baseSeed = 1, batchSize = 25, onProgress = null }) {
  let wins = 0;
  let totalRounds = 0;
  const dmgSamples = [];
  const yieldFrame = () => new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });
  for (let i = 0; i < runs; i++) {
    const res = runSimulation({ heroes, encounter, act, seed: baseSeed + i });
    if (res.winner === 'party') wins++;
    totalRounds += res.rounds;
    let totalDmg = 0;
    for (const e of res.log) if (e.type === 'hit') totalDmg += e.dmg;
    dmgSamples.push(totalDmg);
    if ((i + 1) % batchSize === 0 && (i + 1) < runs) {
      if (onProgress) try { onProgress(i + 1, runs); } catch {}
      await yieldFrame();
    }
  }
  if (onProgress) try { onProgress(runs, runs); } catch {}
  const mean = dmgSamples.reduce((a, b) => a + b, 0) / runs;
  const variance = dmgSamples.reduce((a, b) => a + (b - mean) ** 2, 0) / runs;
  return {
    runs,
    winRate: wins / runs,
    avgRounds: totalRounds / runs,
    dmgMean: mean,
    dmgVariance: variance,
    dmgSamples,
  };
}

// ---------------------------------------------------------------------------
// Auto-assignment helpers for CombatSimulatorScreen (M116).
//
// When a user drops a "premade" character in the sim without explicitly
// rolling stats, we need attributes + equipment that actually scale with the
// picked level — otherwise a L20 mage ends up with the same 12 INT a L1 does,
// and Fireball misbehaves in the AI branch.
// ---------------------------------------------------------------------------

/**
 * Derive a class-appropriate base attribute block for a given level.
 * Warrior/Knight/Barbarian → STR heavy, Rogue/Ranger → DEX, Mage/Wizard → INT.
 * Tactician/Bard split DEX+INT. CON always scales modestly.
 */
export function autoAssignAttrs(classId, level, opts = {}) {
  const lvl = Math.max(1, level | 0);
  const cls = (CLASSES || []).find(c => c.id === classId || c.name === classId) || null;

  // M399 — when a build preset is supplied (or the caller passes one through
  // opts.build), allocate against the build's targetAttrs distribution and
  // honor plateau caps. This replaces the old single-stat dump (everything
  // into the class primary) with the player-chosen distribution.
  const build = opts.build || null;
  if (build && build.targetAttrs) {
    const target = build.targetAttrs; // { STR, DEX, INT, CON } weights, sum to 100
    // Total budget: ~14 base (4 stats × 8 = 32 floor) + 2 per level past 1.
    // Use roughly 2.2 attribute points per level to match legacy growth, with
    // a CON floor like the old code (CON gets +1.2/level baked in via base).
    const totalBudget = 30 + Math.floor(lvl * 2.2 * 4);
    const sumWeights = (target.STR||0) + (target.DEX||0) + (target.INT||0) + (target.CON||0) || 100;
    const out = { STR: 8, DEX: 8, INT: 8, CON: 8 };
    let remaining = totalBudget - 32;
    for (const k of ['STR','DEX','INT','CON']) {
      const w = (target[k] || 0) / sumWeights;
      const add = Math.floor(remaining * w);
      out[k] = 8 + add;
    }
    // Plateau cap: DEX → until hit95. Computed from class-relevant heuristic;
    // for sim purposes we cap DEX at 30 once "hit95" is set, redistributing
    // the surplus to the next-highest-weight stat.
    if (build.plateaus?.DEX?.until === 'hit95') {
      const cap = 30; // approx where hit chance maxes
      if (out.DEX > cap) {
        const surplus = out.DEX - cap;
        out.DEX = cap;
        // Redirect surplus into the next-highest-weight non-DEX stat.
        const ranked = ['STR','INT','CON'].sort((a,b) => (target[b]||0) - (target[a]||0));
        const sink = ranked.find(k => (target[k] || 0) > 0) || 'CON';
        out[sink] += surplus;
      }
    }
    // Plateau floor: CON ≥ atLeast (e.g. tank builds keep CON ≥ 50% of budget).
    if (build.plateaus?.CON?.atLeast) {
      const minCon = 8 + Math.floor((totalBudget - 32) * build.plateaus.CON.atLeast);
      if (out.CON < minCon) {
        const need = minCon - out.CON;
        // Pull from the highest non-CON stat above its base.
        const donors = ['STR','DEX','INT'].sort((a,b) => out[b] - out[a]);
        let stillNeed = need;
        for (const d of donors) {
          if (stillNeed <= 0) break;
          const can = Math.max(0, out[d] - 8);
          const take = Math.min(can, stillNeed);
          out[d] -= take;
          stillNeed -= take;
        }
        out.CON = minCon - stillNeed;
      }
    }
    return out;
  }

  // Legacy fallback (no build picked): dump into the class primary.
  const primary = cls && cls.primaryAttr ? cls.primaryAttr.toUpperCase() : 'STR';
  const base = { STR: 8, DEX: 8, INT: 8, CON: 8 + Math.floor(lvl * 1.2) };
  const primBonus = 10 + Math.floor(lvl * 2.2) - 8; // add on top of the 8 floor
  // Hybrid classes that split two offensive stats evenly.
  if (classId === 'bard' || classId === 'tactician') {
    const split = Math.floor(primBonus * 0.6);
    base.DEX += split;
    base.INT += split;
  } else {
    base[primary] = 8 + primBonus;
  }
  return base;
}

/**
 * Generate a plausible equipment bundle for a class at a given level.
 * Uses CLASSES[].startingEquipment as the item key list and bumps rarity by
 * level bracket: L1–3 normal, L4–8 magic, L9–15 rare, L16+ legendary.
 */
/**
 * M396 — Benchmark levels for the standardized gear-pack sim runs. The user
 * asked for a typical-player gear curve at these eight checkpoints so each
 * class's skill output can be compared on the same footing without random
 * rolls swinging the numbers. Cap rarity at "rare" — endgame legendary /
 * unique tuning is deferred to a later milestone.
 */
// M422 — extended through 30 to match the new max level cap.
export const BENCHMARK_LEVELS = [1, 3, 5, 7, 10, 15, 20, 25, 30];

/**
 * Returns the rarity tier a typical player would have at the given level
 * along the benchmark curve. Capped at "rare" by design.
 */
export function benchmarkRarityForLevel(level) {
  if (level >= 15) return 'rare';
  if (level >= 7)  return 'magic';
  return 'normal';
}

/**
 * Pick a build axis ('str' | 'dex' | 'int') from a class id. Drives which
 * affix family the benchmark gear pack rolls.
 */
function _benchmarkAxisFor(classId) {
  const cls = (CLASSES || []).find(c => c.id === classId || c.name === classId);
  const primary = (cls && cls.primaryAttr) ? cls.primaryAttr.toUpperCase() : 'STR';
  if (primary === 'INT') return 'int';
  if (primary === 'DEX') return 'dex';
  return 'str';
}

/**
 * Equivalent affix targets per axis at each benchmark level. Each axis lists
 * the cumulative bonus a typical-player kit at that level should sit at;
 * downstream code maps these onto explicit affix entries on the gear bundle.
 *
 * Tuned so STR/DEX/INT builds reach the same total offensive uplift at the
 * same level, only differing by attribute. (str/dex use weapon damage +
 * accuracy + crit; int uses spell power + a small flat magic damage +
 * crit.)
 */
const BENCHMARK_AFFIXES = {
  // [bonus.dmg, bonus.crit pct, bonus.accuracy pct, bonus.spellPower]
  1:  { str: { dmg: 0,  crit: 0,  acc: 0,  sp: 0    },
        dex: { dmg: 0,  crit: 0,  acc: 0,  sp: 0    },
        int: { dmg: 0,  crit: 0,  acc: 0,  sp: 0    } },
  3:  { str: { dmg: 1,  crit: 1,  acc: 1,  sp: 0    },
        dex: { dmg: 1,  crit: 2,  acc: 0,  sp: 0    },
        int: { dmg: 0,  crit: 1,  acc: 0,  sp: 0.04 } },
  5:  { str: { dmg: 2,  crit: 2,  acc: 1,  sp: 0    },
        dex: { dmg: 2,  crit: 3,  acc: 1,  sp: 0    },
        int: { dmg: 1,  crit: 2,  acc: 0,  sp: 0.06 } },
  7:  { str: { dmg: 3,  crit: 3,  acc: 2,  sp: 0    },
        dex: { dmg: 3,  crit: 4,  acc: 2,  sp: 0    },
        int: { dmg: 2,  crit: 2,  acc: 1,  sp: 0.10 } },
  10: { str: { dmg: 5,  crit: 4,  acc: 3,  sp: 0    },
        dex: { dmg: 5,  crit: 5,  acc: 2,  sp: 0    },
        int: { dmg: 3,  crit: 3,  acc: 2,  sp: 0.14 } },
  15: { str: { dmg: 8,  crit: 6,  acc: 4,  sp: 0    },
        dex: { dmg: 8,  crit: 7,  acc: 3,  sp: 0    },
        int: { dmg: 4,  crit: 4,  acc: 3,  sp: 0.20 } },
  20: { str: { dmg: 12, crit: 7,  acc: 5,  sp: 0    },
        dex: { dmg: 12, crit: 8,  acc: 4,  sp: 0    },
        int: { dmg: 6,  crit: 5,  acc: 4,  sp: 0.28 } },
  25: { str: { dmg: 16, crit: 8,  acc: 6,  sp: 0    },
        dex: { dmg: 16, crit: 9,  acc: 5,  sp: 0    },
        int: { dmg: 8,  crit: 6,  acc: 5,  sp: 0.36 } },
  30: { str: { dmg: 22, crit: 9,  acc: 7,  sp: 0    },
        dex: { dmg: 22, crit: 11, acc: 6,  sp: 0    },
        int: { dmg: 11, crit: 7,  acc: 6,  sp: 0.46 } },
};

/**
 * Standardized "typical player" gear pack for benchmarking. Returns the same
 * shape as autoGenerateEquipment but with deterministic rarity (no leg/uniq)
 * and an explicit `_benchmarkAffix` payload on the weapon so the sim hero
 * builder can apply consistent affix totals across builds. Heroes drink from
 * this pack instead of randomly rolled items so per-run noise drops to ~0%.
 */
export function getBenchmarkGearPack(classId, level) {
  const equipment = autoGenerateEquipment(classId, level);
  // Force-cap rarity by stripping legendary/unique flags if any leaked in.
  for (const slot of Object.keys(equipment)) {
    const it = equipment[slot];
    if (!it) continue;
    if (it.rarity === 'legendary' || it.rarity === 'unique') it.rarity = 'rare';
    delete it.unique;
    delete it.legendary;
  }
  const axis = _benchmarkAxisFor(classId);
  const tierKey = BENCHMARK_LEVELS.reduce((acc, l) => (l <= level ? l : acc), 1);
  const targets = BENCHMARK_AFFIXES[tierKey]?.[axis] || { dmg: 0, crit: 0, acc: 0, sp: 0 };
  // Stamp explicit affix targets onto the weapon (or a synthetic _stub if
  // the class somehow has no weapon slot — shouldn't happen but defensive).
  const w = equipment.weapon || (equipment.weapon = { type: 'weapon', rarity: 'normal', name: 'Benchmark Weapon', affixes: [] });
  w._benchmarkAffix = { ...targets, axis };
  // Surface the same totals as flat fields so heroToCombatant picks them up
  // via the existing affix bonus path. Keys mirror affixes.js naming.
  w.affixes = w.affixes || [];
  if (targets.dmg > 0)  w.affixes.push({ key: 'dmg',          value: targets.dmg });
  if (targets.crit > 0) w.affixes.push({ key: 'critChancePct',value: targets.crit });
  if (targets.acc > 0)  w.affixes.push({ key: 'hitPct',       value: targets.acc });
  if (targets.sp > 0)   w.affixes.push({ key: 'spellPower',   value: targets.sp });
  return equipment;
}

export function autoGenerateEquipment(classId, level) {
  const equipment = {};
  const cls = (CLASSES || []).find(c => c.id === classId || c.name === classId);
  if (!cls || !Array.isArray(cls.startingEquipment)) return equipment;
  const lvl = Math.max(1, level | 0);
  // M396: cap rarity at "rare" for sim — endgame leg/uniq tuning is deferred.
  const rarity = lvl >= 9 ? 'rare' : lvl >= 4 ? 'magic' : 'normal';
  // Track dual-wield: a second weapon slots into offhand.
  let sawWeapon = false;
  let sawRing = false;
  for (const key of cls.startingEquipment) {
    let item;
    try { item = generateItem(key, rarity, 'medium'); } catch (_) { item = null; }
    if (!item) continue;
    let slot = item.type || 'body';
    if (slot === 'weapon') {
      if (sawWeapon) slot = 'offhand'; else sawWeapon = true;
    } else if (slot === 'ring') {
      if (sawRing) slot = 'ring2'; else sawRing = true;
    }
    equipment[slot] = item;
  }
  return equipment;
}

/**
 * Rewards-per-minute estimate given a sim result and an encounters/min rate.
 */
export function rewardsPerMinute(result, encountersPerMinute = 2) {
  let xp = 0;
  let goldMin = 0;
  let goldMax = 0;
  for (const e of result.enemies) {
    xp += e.xpValue || 0;
    goldMin += (e.gold && e.gold[0]) || 0;
    goldMax += (e.gold && e.gold[1]) || 0;
  }
  return {
    xpPerMin: Math.round(xp * encountersPerMinute),
    goldPerMin: Math.round(((goldMin + goldMax) / 2) * encountersPerMinute),
  };
}
