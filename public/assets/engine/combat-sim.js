/**
 * combat-sim.js — self-contained simplified combat simulator for game13.
 *
 * This module is intentionally hand-implemented and lives under public/assets
 * so it can be loaded directly by /assets/rebalance.html in both dev and on
 * GitHub Pages without depending on the Vite bundle. The formulas below
 * mirror the canonical ones in src/game/passives.js and the damageStat /
 * damageMult conventions in src/game/skills.js. When game balance changes,
 * update the constants here.
 *
 * Exports:
 *   CLASSES, COMPANIONS, HIREABLES, TAP_WEAPONS, TAP_UTILITIES, SCENARIOS
 *   buildHero(classId, level)           -> hero subject
 *   buildCompanion(spec)                -> companion subject
 *   buildScenario(baseId, actTier)      -> { name, enemies: [...] }
 *   simulate(subject, scenario, opts)   -> per-run metrics
 *   runBatch(subject, scenario, runs)   -> aggregated stats
 *   makeRng(seed)
 */

// ---------- RNG ----------
export function makeRng(seed) {
  let s = (seed >>> 0) || 0xC0FFEE;
  return function rng() {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Class data (mirrors src/game/classes.js — id, primaryAttr, role) ----------
export const CLASSES = [
  { id: 'warrior',      primaryAttr: 'STR', role: 'tank',     skill: { stat: 'STR', mult: 1.4, aoe: 1 } },
  { id: 'paladin',      primaryAttr: 'STR', role: 'tank',     skill: { stat: 'STR', mult: 1.2, aoe: 1, heal: 0.4 } },
  { id: 'ranger',       primaryAttr: 'DEX', role: 'dps',      skill: { stat: 'DEX', mult: 1.6, aoe: 2 } },
  { id: 'rogue',        primaryAttr: 'DEX', role: 'burst',    skill: { stat: 'DEX', mult: 2.0, aoe: 1 } },
  { id: 'cleric',       primaryAttr: 'INT', role: 'healer',   skill: { stat: 'INT', mult: 0.6, aoe: 1, heal: 1.6 } },
  { id: 'bard',         primaryAttr: 'INT', role: 'support',  skill: { stat: 'INT', mult: 0.8, aoe: 2, heal: 0.5 } },
  { id: 'mage',         primaryAttr: 'INT', role: 'aoe',      skill: { stat: 'INT', mult: 1.5, aoe: 5 } },
  { id: 'necromancer',  primaryAttr: 'INT', role: 'dot',      skill: { stat: 'INT', mult: 1.2, aoe: 5 } },
  { id: 'warlock',      primaryAttr: 'INT', role: 'dot',      skill: { stat: 'INT', mult: 1.3, aoe: 3 } },
  { id: 'demon_hunter', primaryAttr: 'DEX', role: 'dps',      skill: { stat: 'DEX', mult: 1.7, aoe: 1 } },
  { id: 'scavenger',    primaryAttr: 'DEX', role: 'dps',      skill: { stat: 'DEX', mult: 1.1, aoe: 2 } },
  { id: 'swashbuckler', primaryAttr: 'DEX', role: 'burst',    skill: { stat: 'DEX', mult: 1.7, aoe: 1 } },
  { id: 'dragon_knight',primaryAttr: 'STR', role: 'tank',     skill: { stat: 'STR', mult: 1.5, aoe: 3 } },
  { id: 'pyromancer',   primaryAttr: 'INT', role: 'aoe',      skill: { stat: 'INT', mult: 1.6, aoe: 5 } },
  { id: 'stormcaller',  primaryAttr: 'INT', role: 'aoe',      skill: { stat: 'INT', mult: 1.4, aoe: 3 } },
  { id: 'druid',        primaryAttr: 'INT', role: 'healer',   skill: { stat: 'INT', mult: 0.7, aoe: 1, heal: 1.4 } },
  { id: 'oracle',       primaryAttr: 'INT', role: 'support',  skill: { stat: 'INT', mult: 0.6, aoe: 1, heal: 1.0 } },
  { id: 'tactician',    primaryAttr: 'INT', role: 'support',  skill: { stat: 'INT', mult: 0.9, aoe: 2, heal: 0.3 } },
  { id: 'chronomancer', primaryAttr: 'INT', role: 'support',  skill: { stat: 'INT', mult: 1.0, aoe: 2 } },
];

// ---------- Companion / hireable specs (mirrors TownScreen.js) ----------
export const HIREABLES = [
  { id: 'aela',  classId: 'ranger',        level: 1, attrs: { STR:8, DEX:14, INT:8, CON:10 } },
  { id: 'borin', classId: 'warrior',       level: 1, attrs: { STR:15, DEX:8, INT:8, CON:9 } },
  { id: 'lysa',  classId: 'cleric',        level: 2, attrs: { STR:8, DEX:8, INT:15, CON:11 } },
  { id: 'rekk',  classId: 'rogue',         level: 1, attrs: { STR:8, DEX:14, INT:9, CON:9 } },
  { id: 'kaldrek',          classId: 'dragon_knight', level: 6, attrs: { STR:16, DEX:10, INT:12, CON:12 } },
  { id: 'syra_wyrmsworn',   classId: 'dragon_knight', level: 7, attrs: { STR:15, DEX:12, INT:13, CON:12 } },
  { id: 'vorin_emberjaw',   classId: 'dragon_knight', level: 8, attrs: { STR:16, DEX:11, INT:12, CON:15 } },
  { id: 'maelis_drakeblood',classId: 'dragon_knight', level: 9, attrs: { STR:15, DEX:14, INT:15, CON:12 } },
];

export const COMPANIONS = [
  { id: 'war_dog',          classId: 'ranger',  level: 1, attrs: { STR:10, DEX:12, INT:2,  CON:10 } },
  { id: 'dragon_hatchling', classId: 'pyromancer', level: 5, attrs: { STR:12, DEX:11, INT:14, CON:12 } },
  { id: 'frost_wyrmling',   classId: 'mage',    level: 5, attrs: { STR:11, DEX:12, INT:13, CON:13 } },
  { id: 'storm_drake',      classId: 'stormcaller', level: 6, attrs: { STR:12, DEX:14, INT:13, CON:12 } },
  { id: 'shadow_wyrm',      classId: 'warlock', level: 7, attrs: { STR:13, DEX:13, INT:15, CON:12 } },
];

// ---------- Tap items (mirrors src/game/tapWeapons.js) ----------
export const TAP_WEAPONS = [
  { id: 'blade',           power: [8,14],  cd: 1, targets: 1 },
  { id: 'bow',             power: [25,40], cd: 3, targets: 1 },
  { id: 'catapult',        power: [35,55], cd: 5, targets: 5 },
  { id: 'star_caller',     power: [45,65], cd: 4, targets: 5 },
  { id: 'ninja_stars',     power: [12,18], cd: 3, targets: 3 },
  { id: 'fireball',        power: [30,45], cd: 4, targets: 5 },
  { id: 'dragon_call',     power: [30,50], cd: 8, targets: 20 },
  { id: 'chain_lightning', power: [18,28], cd: 4, targets: 3 },
  { id: 'spirit_hammer',   power: [40,60], cd: 4, targets: 1 },
  { id: 'void_lance',      power: [25,40], cd: 3, targets: 5 },
];

export const TAP_UTILITIES = [
  { id: 'rejuvenate',      power: [15,25], cd: 3, healTargets: 1 },
  { id: 'heal',            power: [50,50], cd: 4, healTargets: 3 },
  { id: 'shield',          power: [25,25], cd: 3, healTargets: 3 },
  { id: 'deflect',         power: [20,20], cd: 5, healTargets: 1 },
  { id: 'enchant',         power: [10,10], cd: 2, healTargets: 1 },
  { id: 'cleanse',         power: [15,15], cd: 3, healTargets: 1 },
  { id: 'rally',           power: [12,12], cd: 6, healTargets: 4 },
  { id: 'haste',           power: [15,15], cd: 5, healTargets: 1 },
  { id: 'taunt_totem',     power: [10,10], cd: 6, healTargets: 4 },
  { id: 'phoenix_feather', power: [40,40], cd: 10, healTargets: 1 },
];

// ---------- Stat formulas (mirror src/game/passives.js) ----------
//   maxHp  = 50 + CON*10 + passiveMaxHp
//   maxMp  = 30 + INT*8 + passiveMaxMp
//   "attack" = STR*2 + level*3 + weaponBonus
//   "spell"  = INT*2 + level*3 + weaponBonus
//   "defense"= CON + armorTierBonus + level
// These are the simplified versions used by the simulator. They are pinned
// here so the simulator stays stable across game refactors; if the game
// changes the canonical formulas, update this comment block too.
export function computeMaxHp(attrs, passiveHp = 0) { return 50 + attrs.CON * 10 + passiveHp; }
export function computeAttack(attrs, level, gear = 0) { return attrs.STR * 2 + level * 3 + gear; }
// M95: Three weapon categories drive basic-attack damage via different stats.
//   heavy → STR, light → DEX, magic → INT (+ wand spell-power kicker).
export function computeAttackByCategory(attrs, level, gear = 0, weaponCategory = 'heavy') {
  if (weaponCategory === 'light') return attrs.DEX * 2 + level * 3 + gear;
  if (weaponCategory === 'magic') return attrs.INT * 2 + level * 3 + gear + Math.round(attrs.INT * 0.5);
  return attrs.STR * 2 + level * 3 + gear;
}
export function computeSpell(attrs, level, gear = 0)  { return attrs.INT * 2 + level * 3 + gear; }
export function computeDefense(attrs, level, armor = 0) { return attrs.CON + level + armor; }

const ARMOR_TIER = { heavy: 14, medium: 9, light: 5, cloth: 2 };
const ARMOR_TIER_BY_CLASS = {
  warrior:'heavy', paladin:'medium', dragon_knight:'heavy', tactician:'medium',
  ranger:'light', rogue:'light', demon_hunter:'light', scavenger:'light', swashbuckler:'light',
  cleric:'light', bard:'light', druid:'medium',
  mage:'cloth', necromancer:'cloth', warlock:'cloth', pyromancer:'cloth',
  stormcaller:'cloth', oracle:'cloth', chronomancer:'cloth',
};

// Default attribute pool: 8 base + (level * 2) into primary, +1 to others.
function rollAttrs(classDef, level, override) {
  if (override) {
    const cp = level - 1;
    return { STR: override.STR + (classDef.primaryAttr === 'STR' ? cp : 0),
             DEX: override.DEX + (classDef.primaryAttr === 'DEX' ? cp : 0),
             INT: override.INT + (classDef.primaryAttr === 'INT' ? cp : 0),
             CON: override.CON + Math.floor(cp / 2) };
  }
  const a = { STR: 8, DEX: 8, INT: 8, CON: 8 };
  // Spend allocation: +2 to primary per level, +1 to CON per level.
  a[classDef.primaryAttr] += (level - 1) * 2 + 6;
  a.CON += (level - 1) + 2;
  return a;
}

// Gear bonus scales with level (rough proxy for equipped items at that level).
function gearBonusFor(level) { return Math.floor(level * 4 + 4); }
function armorBonusFor(classId, level) {
  const tier = ARMOR_TIER_BY_CLASS[classId] || 'light';
  return ARMOR_TIER[tier] + Math.floor(level * 1.5);
}

// Crude passive HP: 1 point per 2 levels, mostly toughness/devotion = +10 hp/rank.
function passiveHpFor(level) {
  const points = Math.floor(level / 2);
  return points * 8;
}

export function buildHero(classId, level) {
  const cdef = CLASSES.find(c => c.id === classId);
  if (!cdef) throw new Error('unknown class ' + classId);
  const attrs = rollAttrs(cdef, level, null);
  const maxHp = computeMaxHp(attrs, passiveHpFor(level));
  const atk = computeAttack(attrs, level, gearBonusFor(level));
  const spl = computeSpell(attrs, level, gearBonusFor(level));
  const def = computeDefense(attrs, level, armorBonusFor(classId, level));
  return {
    kind: 'hero', id: classId, classId, level, attrs,
    maxHp, hp: maxHp, atk, spl, def,
    skill: cdef.skill, role: cdef.role,
  };
}

export function buildCompanion(spec) {
  const cdef = CLASSES.find(c => c.id === spec.classId) || CLASSES[0];
  const level = spec.level;
  const attrs = rollAttrs(cdef, level, spec.attrs);
  const maxHp = computeMaxHp(attrs, passiveHpFor(level));
  const atk = computeAttack(attrs, level, Math.floor(gearBonusFor(level) * 0.7));
  const spl = computeSpell(attrs, level, Math.floor(gearBonusFor(level) * 0.7));
  const def = computeDefense(attrs, level, armorBonusFor(spec.classId, level));
  return {
    kind: spec.id.includes('drake') || spec.id.includes('wyrm') || spec.id.includes('hatch') || spec.id === 'war_dog' || spec.id === 'frost_wyrmling' || spec.id === 'storm_drake' ? 'companion' : 'hireable',
    id: spec.id, classId: spec.classId, level, attrs,
    maxHp, hp: maxHp, atk, spl, def,
    skill: cdef.skill, role: cdef.role,
  };
}

// ---------- Scenarios ----------
const ACT_MULT = { 1:1.0, 2:1.4, 3:2.0, 4:2.8, 5:4.0, 6:5.5 };
const SCENARIO_BASES = {
  tank:  { count: 1,  hp: 3000, def: 30, atk: 60 },
  elite: { count: 1,  hp: 800,  def: 18, atk: 50 },
  group: { count: 5,  hp: 200,  def: 10, atk: 30 },
  swarm: { count: 20, hp: 50,   def: 4,  atk: 18 },
};

export const SCENARIO_BASE_IDS = ['tank','elite','group','swarm'];
export const ACT_TIERS = [1,2,3,4,5,6];

export function buildScenario(baseId, actTier) {
  const base = SCENARIO_BASES[baseId];
  const mult = ACT_MULT[actTier];
  const enemies = [];
  for (let i = 0; i < base.count; i++) {
    const hp = Math.round(base.hp * mult);
    enemies.push({ id: `${baseId}_${i}`, hp, maxHp: hp, def: Math.round(base.def * Math.sqrt(mult)), atk: Math.round(base.atk * Math.sqrt(mult)), alive: true, groupIndex: Math.floor(i / 5) });
  }
  return { id: `${baseId}_act${actTier}`, baseId, actTier, enemies };
}

export const SCENARIOS = (() => {
  const list = [];
  for (const t of ACT_TIERS) for (const b of SCENARIO_BASE_IDS) list.push({ baseId: b, actTier: t, key: `${b}_act${t}` });
  return list;
})();

// ---------- Combat loop ----------
const MAX_ROUNDS = 30;

function pickSkillDamage(actor) {
  // Use the class skill mult * relevant stat as base damage per target.
  const stat = actor.skill.stat === 'STR' ? actor.atk
              : actor.skill.stat === 'DEX' ? actor.atk * 0.9 + actor.spl * 0.1
              : actor.spl;
  return stat * actor.skill.mult;
}

export function simulateRun(subject, scenarioBaseId, actTier, rng) {
  const scen = buildScenario(scenarioBaseId, actTier);
  // Subject + 3 generic ally bots so there's a party for healers.
  const allies = [subject];
  // Add 3 "generic dummy" allies at subject's level so heals have somewhere to go.
  if (subject.kind === 'hero' || subject.kind === 'hireable' || subject.kind === 'companion') {
    for (let i = 0; i < 3; i++) {
      const dummy = buildHero('warrior', subject.level);
      dummy.id = `dummy_${i}`;
      // Reset to fresh hp.
      dummy.hp = dummy.maxHp;
      allies.push(dummy);
    }
  } else if (subject.kind === 'tap_weapon' || subject.kind === 'tap_utility') {
    // For tap items, the "subject" isn't an actor. Use a baseline level-10 warrior party.
    const base = buildHero('warrior', 10);
    base.hp = base.maxHp;
    allies[0] = base;
    for (let i = 0; i < 3; i++) { const d = buildHero('warrior', 10); allies.push(d); }
  }
  // Reset hp.
  for (const a of allies) a.hp = a.maxHp;

  let totalDamage = 0;
  let totalHealEffective = 0;
  let totalOverheal = 0;
  let rounds = 0;
  let killed = false;

  // Tap item state — cooldown counter for tap-only subjects.
  let tapCd = 0;

  for (let r = 1; r <= MAX_ROUNDS; r++) {
    rounds = r;
    // 1) Allies act.
    for (const ally of allies) {
      if (ally.hp <= 0) continue;
      // Pick a skill: damage if anyone alive, with possible heal from healers when an ally is hurt.
      const wantsHeal = ally.skill && ally.skill.heal && allies.some(a => a.hp > 0 && a.hp < a.maxHp * 0.6);
      if (wantsHeal) {
        const target = allies.filter(a => a.hp > 0).sort((a,b) => (a.hp/a.maxHp) - (b.hp/b.maxHp))[0];
        const healAmount = ally.spl * ally.skill.heal;
        const eff = Math.min(healAmount, target.maxHp - target.hp);
        target.hp += eff;
        totalHealEffective += eff;
        totalOverheal += (healAmount - eff);
      } else {
        const aliveEnemies = scen.enemies.filter(e => e.alive);
        if (!aliveEnemies.length) { killed = true; break; }
        const targetCount = Math.min(ally.skill.aoe || 1, aliveEnemies.length);
        const dmgPerTarget = pickSkillDamage(ally);
        // Apply variance.
        const variance = 0.85 + rng() * 0.3;
        for (let i = 0; i < targetCount; i++) {
          const t = aliveEnemies[i];
          const raw = dmgPerTarget * variance;
          const mitigated = Math.max(1, raw - t.def);
          const dealt = Math.min(t.hp, mitigated);
          t.hp -= dealt;
          totalDamage += dealt;
          if (t.hp <= 0) t.alive = false;
        }
      }
    }

    // 2) Tap item action (only when subject is a tap item).
    if (subject.kind === 'tap_weapon') {
      if (tapCd <= 0) {
        const aliveEnemies = scen.enemies.filter(e => e.alive);
        if (aliveEnemies.length) {
          const [pmin, pmax] = subject.power;
          const amt = pmin + rng() * (pmax - pmin);
          const targets = aliveEnemies.slice(0, subject.targets);
          for (const t of targets) {
            const dealt = Math.min(t.hp, Math.max(1, amt - t.def * 0.3));
            t.hp -= dealt;
            totalDamage += dealt;
            if (t.hp <= 0) t.alive = false;
          }
          tapCd = subject.cd;
        }
      } else { tapCd--; }
    } else if (subject.kind === 'tap_utility') {
      if (tapCd <= 0) {
        const [pmin, pmax] = subject.power;
        const amt = pmin + rng() * (pmax - pmin);
        // Damage party slightly so heals have somewhere to land.
        for (const a of allies) { if (a.hp > 0) a.hp = Math.max(1, a.hp - 5); }
        const targets = allies.filter(a => a.hp > 0).slice(0, subject.healTargets);
        for (const t of targets) {
          const eff = Math.min(amt, t.maxHp - t.hp);
          t.hp += eff;
          totalHealEffective += eff;
          totalOverheal += (amt - eff);
        }
        tapCd = subject.cd;
      } else { tapCd--; }
    }

    if (scen.enemies.every(e => !e.alive)) { killed = true; break; }

    // 3) Enemies act.
    for (const e of scen.enemies) {
      if (!e.alive) continue;
      const liveAllies = allies.filter(a => a.hp > 0);
      if (!liveAllies.length) break;
      const t = liveAllies[Math.floor(rng() * liveAllies.length)];
      const raw = e.atk * (0.85 + rng() * 0.3);
      const mit = Math.max(1, raw - t.def);
      t.hp -= mit;
    }

    if (allies.every(a => a.hp <= 0)) break;
  }

  const partySurvived = allies.some(a => a.hp > 0);
  return {
    dps: totalDamage / rounds,
    hps: totalHealEffective / rounds,
    overheal: totalOverheal,
    rounds,
    ttk: killed ? rounds : Infinity,
    survived: partySurvived ? 1 : 0,
  };
}

function aggregate(samples) {
  const n = samples.length;
  if (!n) return { mean: 0, std: 0, p5: 0, p95: 0 };
  const mean = samples.reduce((a, b) => a + b, 0) / n;
  const variance = samples.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const sorted = samples.slice().sort((a, b) => a - b);
  const p5 = sorted[Math.floor(0.05 * (n - 1))];
  const p95 = sorted[Math.floor(0.95 * (n - 1))];
  return { mean, std: Math.sqrt(variance), p5, p95 };
}

export function runBatch(subject, baseId, actTier, runs, seedBase = 1) {
  const dpsArr = [], hpsArr = [], ttkArr = [], survArr = [];
  let totalOverheal = 0;
  for (let i = 0; i < runs; i++) {
    const rng = makeRng(seedBase + i * 9301 + 49297);
    // Re-clone subject to reset hp between runs.
    const subj = { ...subject };
    const r = simulateRun(subj, baseId, actTier, rng);
    dpsArr.push(r.dps);
    hpsArr.push(r.hps);
    ttkArr.push(r.ttk === Infinity ? 999 : r.ttk);
    survArr.push(r.survived);
    totalOverheal += r.overheal;
  }
  return {
    dps: aggregate(dpsArr),
    hps: aggregate(hpsArr),
    ttk: aggregate(ttkArr),
    survival: survArr.reduce((a,b)=>a+b,0) / runs,
    overheal: totalOverheal / runs,
  };
}

export function buildTapWeaponSubject(spec) {
  return { kind: 'tap_weapon', id: spec.id, power: spec.power, cd: spec.cd, targets: spec.targets, level: 10 };
}
export function buildTapUtilitySubject(spec) {
  return { kind: 'tap_utility', id: spec.id, power: spec.power, cd: spec.cd, healTargets: spec.healTargets, level: 10 };
}
