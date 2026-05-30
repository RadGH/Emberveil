// Snapshot tests for src/game/formulas.js.
// Goal: freeze current (m83) math so any silent drift fails CI.

import { describe, it, expect } from 'vitest';
import {
  rollToHit,
  applyArmorMitigation,
  applyArmorReduction,
  applyResistMitigation,
  applyMitigation,
  mitigationLogTag,
  getCharacterBlockStats,
  rollBlock,
  applyBlock,
  computeHeroArmor,
  computeHeroEquipDmgBonus,
  computeHeroDamage,
  computeHeroHit,
  computeHeroDodge,
  computeHeroInitiative,
  computeGoldReward,
  computeXpReward,
  enemyScalingForNgPlus,
  getEquipmentAffixBonuses,
  computeMaxHp,
  computeMaxMp,
  getPassiveBonuses,
} from '../formulas.js';

const STATS = { STR: 14, DEX: 12, INT: 10, CON: 11 };
const EQUIPMENT = {
  mainhand: { dmg: [8, 14], armor: 0 },
  chest:    { armor: 6 },
  offhand:  { armor: 3 },
};
const MEMBER = { attrs: STATS, level: 5, equipment: EQUIPMENT, passives: {} };
const ACTOR  = { hit: 85, dodge: 20 };
const TARGET = { hit: 60, dodge: 30, armor: 8 };
const ENEMY  = {
  id: 'goblin', hp: 40, dmg: [4, 9], armor: 3,
  hit: 60, dodge: 10, xpValue: 25, gold: [5, 15],
  isBoss: false, count: 2, mp: 0,
};
const BOSS = { ...ENEMY, id: 'orc_king', hp: 200, dmg: [12, 20], armor: 8, xpValue: 200, isBoss: true };

describe('formulas.js metadata', () => {
  it('every exported function has .formula and .inputs', () => {
    const fns = [
      rollToHit, applyArmorMitigation,
      applyArmorReduction, applyResistMitigation, applyMitigation, mitigationLogTag,
      getCharacterBlockStats, rollBlock, applyBlock,
      computeHeroArmor, computeHeroEquipDmgBonus, computeHeroDamage,
      computeHeroHit, computeHeroDodge, computeHeroInitiative,
      computeGoldReward, computeXpReward, enemyScalingForNgPlus,
      getEquipmentAffixBonuses, computeMaxHp, computeMaxMp, getPassiveBonuses,
    ];
    for (const fn of fns) {
      expect(typeof fn.formula).toBe('string');
      expect(Array.isArray(fn.inputs)).toBe(true);
    }
  });
});

describe('combat formulas (pinned)', () => {
  it('rollToHit — normal', () => {
    expect(rollToHit(ACTOR, TARGET)).toMatchInlineSnapshot('55');
  });
  it('rollToHit — clamped low', () => {
    expect(rollToHit({ hit: 10 }, { dodge: 90 })).toMatchInlineSnapshot('5');
  });
  it('rollToHit — clamped high (M418 softcap)', () => {
    // raw=200, knee=95, falloff=0.2 → 95 + 105*0.2 = 116, clamped by 100-defaultMinMissFloor(3)=97
    expect(rollToHit({ hit: 200 }, { dodge: 0 })).toMatchInlineSnapshot('97');
  });
  it('applyArmorMitigation — normal', () => {
    expect(applyArmorMitigation(30, 8)).toMatchInlineSnapshot('22');
  });
  it('applyArmorMitigation — floored at 15%', () => {
    expect(applyArmorMitigation(20, 500)).toMatchInlineSnapshot('3');
  });
});

describe('hero stat derivations (pinned)', () => {
  it('computeHeroArmor', () => {
    expect(computeHeroArmor(EQUIPMENT)).toMatchInlineSnapshot('9');
  });
  it('computeHeroEquipDmgBonus', () => {
    expect(computeHeroEquipDmgBonus(EQUIPMENT)).toMatchInlineSnapshot('3');
  });
  it('computeHeroDamage', () => {
    expect(computeHeroDamage(STATS, 3)).toMatchInlineSnapshot(`
      [
        9,
        19,
      ]
    `);
  });
  it('computeHeroHit', () => {
    expect(computeHeroHit(STATS)).toMatchInlineSnapshot('84');
  });
  it('computeHeroDodge — hero', () => {
    expect(computeHeroDodge(STATS, false)).toMatchInlineSnapshot('15');
  });
  it('computeHeroDodge — companion', () => {
    expect(computeHeroDodge(STATS, true)).toMatchInlineSnapshot('7');
  });
  it('computeHeroInitiative', () => {
    expect(computeHeroInitiative(STATS, 5)).toMatchInlineSnapshot('17');
  });
});

describe('rewards (pinned)', () => {
  it('computeGoldReward — deterministic rand', () => {
    expect(computeGoldReward(ENEMY, [], () => 0)).toMatchInlineSnapshot('5');
    expect(computeGoldReward(ENEMY, [], () => 0.9999)).toMatchInlineSnapshot('15');
    expect(computeGoldReward(ENEMY, [], () => 0.5)).toMatchInlineSnapshot('10');
  });
  it('computeXpReward', () => {
    expect(computeXpReward(ENEMY, [])).toMatchInlineSnapshot('25');
  });
  it('computeGoldReward — goldFindBonus multiplier (M93 bug fix)', () => {
    // Base roll: 100 gold. 200% goldFind → 300 gold. Bug was: 2000% → ~80.
    const bigEnemy = { gold: [100, 100] };
    expect(computeGoldReward(bigEnemy, { goldFindBonus: 0 }, () => 0)).toBe(100);
    expect(computeGoldReward(bigEnemy, { goldFindBonus: 2.0 }, () => 0)).toBe(300);
    expect(computeGoldReward(bigEnemy, { goldFindBonus: 20.0 }, () => 0)).toBe(2100);
  });
});

describe('enemy scaling (pinned)', () => {
  it('enemyScalingForNgPlus — ng 0 passthrough', () => {
    // M315: dmg values reflect globalMultipliers.damage = 1.3 (was 1.0).
    expect(enemyScalingForNgPlus(ENEMY, 0)).toMatchInlineSnapshot(`
      {
        "armor": 3,
        "dmg": [
          5,
          12,
        ],
        "dodge": 10,
        "hit": 60,
        "hp": 80,
        "xpValue": 25,
      }
    `);
  });
  it('enemyScalingForNgPlus — ng 2 trash', () => {
    // M315: dmg values reflect globalMultipliers.damage = 1.3 (was 1.0).
    expect(enemyScalingForNgPlus(ENEMY, 2)).toMatchInlineSnapshot(`
      {
        "armor": 6,
        "dmg": [
          41,
          92,
        ],
        "dodge": 16,
        "hit": 70,
        "hp": 1620,
        "xpValue": 65,
      }
    `);
  });
  it('enemyScalingForNgPlus — ng 1 boss', () => {
    // M315: dmg values reflect globalMultipliers.damage = 1.3 (was 1.0).
    expect(enemyScalingForNgPlus(BOSS, 1)).toMatchInlineSnapshot(`
      {
        "armor": 12,
        "dmg": [
          52,
          87,
        ],
        "dodge": 13,
        "hit": 65,
        "hp": 2430,
        "xpValue": 560,
      }
    `);
  });
});

describe('affix bonuses (M93 wiring)', () => {
  it('returns zeros for a bare member', () => {
    expect(getEquipmentAffixBonuses({ equipment: {} })).toMatchInlineSnapshot(`
      {
        "armor": 0,
        "barrier": 0,
        "barrierRegen": 0,
        "con": 0,
        "critChance": 0,
        "critDamage": 0,
        "dex": 0,
        "dmg": 0,
        "dodge": 0,
        "goldFind": 0,
        "hit": 0,
        "hp": 0,
        "initiative": 0,
        "int": 0,
        "lifeSteal": 0,
        "magicFind": 0,
        "magicResist": 0,
        "manaRegen": 0,
        "manaSteal": 0,
        "mp": 0,
        "spellPower": 0,
        "str": 0,
      }
    `);
  });

  // Helper: build a member with a single item carrying one affix.
  const mk = (stat, value) => ({
    equipment: { weapon: { affixes: [{ stat, value }] } },
  });

  // One test per kept affix — asserts the shared helper lights up the key.
  it('of_str → +str', () => { expect(getEquipmentAffixBonuses(mk('str', 5)).str).toBe(5); });
  it('of_dex → +dex', () => { expect(getEquipmentAffixBonuses(mk('dex', 5)).dex).toBe(5); });
  it('of_int → +int', () => { expect(getEquipmentAffixBonuses(mk('int', 5)).int).toBe(5); });
  it('of_con → +con', () => { expect(getEquipmentAffixBonuses(mk('con', 5)).con).toBe(5); });
  it('sharp → +dmg', () => { expect(getEquipmentAffixBonuses(mk('dmg', 5)).dmg).toBe(5); });
  it('sturdy → +armor', () => { expect(getEquipmentAffixBonuses(mk('armor', 5)).armor).toBe(5); });
  it('of_hp → +hp', () => { expect(getEquipmentAffixBonuses(mk('hp', 15)).hp).toBe(15); });
  it('of_mp → +mp', () => { expect(getEquipmentAffixBonuses(mk('mp', 10)).mp).toBe(10); });
  it('of_hit → +hit', () => { expect(getEquipmentAffixBonuses(mk('hit', 6)).hit).toBe(6); });
  it('of_dodge → +dodge', () => { expect(getEquipmentAffixBonuses(mk('dodge', 4)).dodge).toBe(4); });
  it('of_speed → +initiative', () => { expect(getEquipmentAffixBonuses(mk('initiative', 2)).initiative).toBe(2); });
  it('of_gold → +goldFind', () => { expect(getEquipmentAffixBonuses(mk('goldFind', 0.2)).goldFind).toBeCloseTo(0.2); });
  it('of_mana_regen → +manaRegen', () => { expect(getEquipmentAffixBonuses(mk('mana_regen', 3)).manaRegen).toBe(3); });

  it('ignores unknown legacy keys (burnChance/bleedChance from saves)', () => {
    const m = { equipment: { weapon: { affixes: [
      { stat: 'burnChance', value: 0.5 },
      { stat: 'bleedChance', value: 0.5 },
      { stat: 'str', value: 3 },
    ] } } };
    const out = getEquipmentAffixBonuses(m);
    expect(out.str).toBe(3);
    expect(out.burnChance).toBeUndefined();
  });

  it('STR affix flows into computeHeroDamage', async () => {
    const { computeHeroDamage: chd } = await import('../formulas.js');
    const baseDmg = chd({ STR: 10, DEX: 8, INT: 8, CON: 8 }, 0);
    const withAffix = chd({ STR: 10 + 5, DEX: 8, INT: 8, CON: 8 }, 0);
    expect(withAffix[0]).toBeGreaterThan(baseDmg[0]);
    expect(withAffix[1]).toBeGreaterThan(baseDmg[1]);
  });

  it('HP affix flows into computeMaxHp', async () => {
    const { computeMaxHp: cmh } = await import('../formulas.js');
    const baseM = { attrs: { STR:8, DEX:8, INT:8, CON:10 }, equipment: {} };
    const withHpAffix = { ...baseM, equipment: { chest: { affixes: [{ stat: 'hp', value: 25 }] } } };
    expect(cmh(withHpAffix)).toBe(cmh(baseM) + 25);
  });

  it('CON affix flows into computeMaxHp (x10 per CON)', async () => {
    const { computeMaxHp: cmh } = await import('../formulas.js');
    const baseM = { attrs: { STR:8, DEX:8, INT:8, CON:10 }, equipment: {} };
    const withConAffix = { ...baseM, equipment: { ring: { affixes: [{ stat: 'con', value: 3 }] } } };
    expect(cmh(withConAffix)).toBe(cmh(baseM) + 30);
  });

  it('MP affix flows into computeMaxMp', async () => {
    const { computeMaxMp: cmm } = await import('../formulas.js');
    const baseM = { attrs: { STR:8, DEX:8, INT:8, CON:10 }, equipment: {} };
    const withMp = { ...baseM, equipment: { ring: { affixes: [{ stat: 'mp', value: 15 }] } } };
    expect(cmm(withMp)).toBe(cmm(baseM) + 15);
  });

  it('goldFind affix summed from a party raises computeGoldReward', async () => {
    const { computeGoldReward: cgr } = await import('../formulas.js');
    const enemy = { gold: [100, 100] };
    const heroA = { equipment: { ring: { affixes: [{ stat: 'goldFind', value: 0.5 }] } } };
    const heroB = { equipment: { necklace: { affixes: [{ stat: 'goldFind', value: 0.5 }] } } };
    const base = cgr(enemy, [], () => 0);
    const boosted = cgr(enemy, [heroA, heroB], () => 0);
    expect(base).toBe(100);
    expect(boosted).toBe(200); // +100% total
  });

  it('round-trip: generateItem rolls affixes that light up the helper', async () => {
    const { generateItem } = await import('../items.js');
    // Seed Math.random so we deterministically pull multiple affixes.
    let i = 0;
    const seq = [0.1, 0.3, 0.5, 0.7, 0.2, 0.4, 0.6, 0.8, 0.9, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95, 0.05, 0.12, 0.33];
    const origRand = Math.random;
    Math.random = () => seq[(i++) % seq.length];
    try {
      const item = generateItem('sword', 'rare', 'high');
      expect(item).toBeTruthy();
      expect(item.affixes.length).toBeGreaterThan(0);
      const member = { equipment: { weapon: item } };
      const bonuses = getEquipmentAffixBonuses(member);
      const nonZero = Object.values(bonuses).some(v => v !== 0);
      expect(nonZero).toBe(true);
    } finally {
      Math.random = origRand;
    }
  });

  it('schema: every affix in AFFIXES_ACT1 maps to a known bonus key', async () => {
    const { AFFIXES_ACT1 } = await import('../items.js');
    const bonuses = getEquipmentAffixBonuses({ equipment: {} });
    const allowedKeys = new Set(Object.keys(bonuses));
    // Canonicalize the item.js stat → bonus key mapping manually (mirror of
    // STAT_TO_KEY inside equipBonuses.js).
    const statAliases = { mana_regen: 'manaRegen', gold_find: 'goldFind' };
    const all = [...AFFIXES_ACT1.prefixes, ...AFFIXES_ACT1.suffixes];
    for (const aff of all) {
      const key = statAliases[aff.stat] || aff.stat;
      expect(allowedKeys.has(key)).toBe(true);
    }
  });
});

describe('M84 mitigation + block (pinned)', () => {
  const tgt = { armor: 10, magicResist: 5, blockChance: 0.5, blockPower: 20 };
  it('applyArmorReduction — normal', () => {
    expect(applyArmorReduction(25, 10)).toMatchInlineSnapshot('15');
  });
  it('applyArmorReduction — floored at 0', () => {
    expect(applyArmorReduction(5, 100)).toMatchInlineSnapshot('0');
  });
  it('applyResistMitigation — normal', () => {
    expect(applyResistMitigation(25, 5)).toMatchInlineSnapshot('20');
  });
  it('applyMitigation — physical', () => {
    expect(applyMitigation(30, tgt, { type: 'physical' })).toMatchInlineSnapshot('20');
  });
  it('applyMitigation — magic', () => {
    expect(applyMitigation(30, tgt, { type: 'magic' })).toMatchInlineSnapshot('25');
  });
  it('applyMitigation — true bypasses', () => {
    expect(applyMitigation(30, tgt, { type: 'true' })).toMatchInlineSnapshot('30');
  });
  it('applyMitigation — physical with flat armor pen', () => {
    expect(applyMitigation(30, tgt, { type: 'physical', armorPen: 5 })).toMatchInlineSnapshot('25');
  });
  it('applyMitigation — magic with flat resist pen', () => {
    expect(applyMitigation(30, tgt, { type: 'magic', resistPen: 5 })).toMatchInlineSnapshot('30');
  });
  it('applyMitigation — physical with % armor pen (reserved path)', () => {
    expect(applyMitigation(30, tgt, { type: 'physical', armorPenPct: 0.5 })).toMatchInlineSnapshot('25');
  });
  it('applyMitigation — physical with % + flat pen stacking', () => {
    // armor 10 → *0.5 = 5 → -3 = 2 → dmg 30-2=28
    expect(applyMitigation(30, tgt, { type: 'physical', armorPenPct: 0.5, armorPen: 3 })).toMatchInlineSnapshot('28');
  });
  it('applyMitigation — full mitigation floors at 0', () => {
    expect(applyMitigation(5, { armor: 100 }, { type: 'physical' })).toMatchInlineSnapshot('0');
  });
  it('mitigationLogTag — deflected', () => {
    expect(mitigationLogTag(10, 0, 'physical')).toMatchInlineSnapshot(`"deflected"`);
  });
  it('mitigationLogTag — resisted', () => {
    expect(mitigationLogTag(10, 0, 'magic')).toMatchInlineSnapshot(`"resisted"`);
  });
  it('mitigationLogTag — true never tags', () => {
    expect(mitigationLogTag(10, 0, 'true')).toMatchInlineSnapshot('null');
  });
  it('mitigationLogTag — partial hit untagged', () => {
    expect(mitigationLogTag(10, 4, 'physical')).toMatchInlineSnapshot('null');
  });
  it('rollBlock — deterministic true', () => {
    expect(rollBlock({ blockChance: 0.5 }, () => 0.1)).toMatchInlineSnapshot('true');
  });
  it('rollBlock — deterministic false', () => {
    expect(rollBlock({ blockChance: 0.5 }, () => 0.9)).toMatchInlineSnapshot('false');
  });
  it('applyBlock — partial', () => {
    expect(applyBlock(30, { blockPower: 20 })).toMatchInlineSnapshot('10');
  });
  it('applyBlock — full absorb', () => {
    expect(applyBlock(5, { blockPower: 20 })).toMatchInlineSnapshot('0');
  });
  it('getCharacterBlockStats — shield with affixes', () => {
    const member = {
      equipment: {
        offhand: {
          isShield: true,
          affixes: [
            { stat: 'block_chance', value: 0.4 },
            { stat: 'block_power',  value: 25 },
          ],
        },
      },
    };
    expect(getCharacterBlockStats(member)).toMatchInlineSnapshot(`
      {
        "blockChance": 0.4,
        "blockPower": 25,
      }
    `);
  });
  it('getCharacterBlockStats — no shield', () => {
    expect(getCharacterBlockStats({ equipment: { mainhand: { affixes: [] } } })).toMatchInlineSnapshot(`
      {
        "blockChance": 0,
        "blockPower": 0,
      }
    `);
  });
});

describe('max pools (pinned)', () => {
  it('computeMaxHp', () => {
    expect(computeMaxHp(MEMBER)).toMatchInlineSnapshot('160');
  });
  it('computeMaxMp', () => {
    expect(computeMaxMp(MEMBER)).toMatchInlineSnapshot('110');
  });
});
