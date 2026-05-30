// Pin the Diablo-3-style item scoring weights so future tweaks to the
// weight table are an explicit decision. If a weight changes, the
// expected value here changes too — that's the point.
import { describe, it, expect } from 'vitest';
import { computeItemScores, ITEM_SCORE_WEIGHTS, getItemCompareTooltip } from '../items.js';

describe('computeItemScores — weights pinned (U7)', () => {
  it('returns zeros for null/empty input', () => {
    expect(computeItemScores(null)).toEqual({ offense: 0, defense: 0, utility: 0, total: 0 });
    expect(computeItemScores({})).toEqual({ offense: 0, defense: 0, utility: 0, total: 0 });
  });

  it('weight table values match documented Diablo-3-style scheme', () => {
    expect(ITEM_SCORE_WEIGHTS.dmg.weight).toBe(5);
    expect(ITEM_SCORE_WEIGHTS.critChance.weight).toBe(8);
    expect(ITEM_SCORE_WEIGHTS.critDamage.weight).toBe(6);
    expect(ITEM_SCORE_WEIGHTS.hit.weight).toBe(2);
    expect(ITEM_SCORE_WEIGHTS.spellPower.weight).toBe(4);
    expect(ITEM_SCORE_WEIGHTS.lifeSteal.weight).toBe(3);
    expect(ITEM_SCORE_WEIGHTS.armorPen.weight).toBe(4);
    expect(ITEM_SCORE_WEIGHTS.hp.weight).toBe(0.6);
    expect(ITEM_SCORE_WEIGHTS.armor.weight).toBe(1);
    expect(ITEM_SCORE_WEIGHTS.magicResist.weight).toBe(1);
    expect(ITEM_SCORE_WEIGHTS.blockChance.weight).toBe(4);
    expect(ITEM_SCORE_WEIGHTS.dodge.weight).toBe(4);
    expect(ITEM_SCORE_WEIGHTS.damageReduction.weight).toBe(6);
    expect(ITEM_SCORE_WEIGHTS.thorns.weight).toBe(2);
    expect(ITEM_SCORE_WEIGHTS.str.weight).toBe(4);
    expect(ITEM_SCORE_WEIGHTS.mp.weight).toBe(0.4);
    expect(ITEM_SCORE_WEIGHTS.manaRegen.weight).toBe(1); // M384: mana regen weight 3 -> 1 (rarer affix)
    expect(ITEM_SCORE_WEIGHTS.magicFind.weight).toBe(3);
    expect(ITEM_SCORE_WEIGHTS.goldFind.weight).toBe(2);
    expect(ITEM_SCORE_WEIGHTS.cooldownReduction.weight).toBe(4);
    expect(ITEM_SCORE_WEIGHTS.initiative.weight).toBe(1);
  });

  it('weapon damage midpoint contributes offense at 5× per +1 mid', () => {
    // dmg=[6,14] → mid=10 → offense=50
    const item = { dmg: [6, 14], affixes: [] };
    const s = computeItemScores(item);
    expect(s.offense).toBe(50);
    expect(s.defense).toBe(0);
    expect(s.utility).toBe(0);
    expect(s.total).toBe(50);
  });

  it('base armor contributes defense at 1× per point', () => {
    const item = { armor: 16, affixes: [] };
    const s = computeItemScores(item);
    expect(s.defense).toBe(16);
    expect(s.offense).toBe(0);
    expect(s.total).toBe(16);
  });

  it('flat damage affix +3 → 15 offense (5× weight)', () => {
    const item = { affixes: [{ id: 'sharp', name: 'Sharp', stat: 'dmg', value: 3 }] };
    expect(computeItemScores(item).offense).toBe(15);
  });

  it('crit chance affix 0.10 (10%) → 80 offense (8× per pp)', () => {
    const item = { affixes: [{ id: 'crit_chance', name: 'Deadly', stat: 'critChance', value: 0.10 }] };
    expect(computeItemScores(item).offense).toBe(80);
  });

  it('crit damage affix 0.35 (35%) → 210 offense (6× per pp)', () => {
    const item = { affixes: [{ id: 'crit_damage', name: 'Savage', stat: 'critDamage', value: 0.35 }] };
    expect(computeItemScores(item).offense).toBe(210);
  });

  it('lifeSteal stored as integer-percent → 5 → 15 offense (3× raw)', () => {
    const item = { affixes: [{ id: 'lifeSteal', name: 'Leeching', stat: 'lifeSteal', value: 5 }] };
    expect(computeItemScores(item).offense).toBe(15);
  });

  it('+HP affix 100 → 60 defense (0.6×)', () => {
    const item = { affixes: [{ id: 'of_hp', name: 'of Vitality', stat: 'hp', value: 100 }] };
    expect(computeItemScores(item).defense).toBe(60);
  });

  it('block chance 0.15 (15%) → 60 defense (4× per pp)', () => {
    const item = { affixes: [{ id: 'bulwark', name: 'Bulwark', stat: 'block_chance', value: 0.15 }] };
    expect(computeItemScores(item).defense).toBe(60);
  });

  it('+STR 4 → 16 utility (4×)', () => {
    const item = { affixes: [{ id: 'of_str', name: 'Sturdy', stat: 'str', value: 4 }] };
    expect(computeItemScores(item).utility).toBe(16);
  });

  it('mana_regen 3 → 3 utility (1×, M384 nerf)', () => {
    const item = { affixes: [{ id: 'of_mana_regen', name: 'of Regeneration', stat: 'mana_regen', value: 3 }] };
    expect(computeItemScores(item).utility).toBe(3);
  });

  it('goldFind 0.2 (20%) → 40 utility (2× per pp)', () => {
    const item = { affixes: [{ id: 'of_gold', name: 'of Fortune', stat: 'goldFind', value: 0.2 }] };
    expect(computeItemScores(item).utility).toBe(40);
  });

  it('total = offense + defense + utility, all integers', () => {
    const item = {
      dmg: [10, 20],            // mid=15 → offense 75
      armor: 8,                 // defense 8
      affixes: [
        { stat: 'str', value: 4 },         // utility 16
        { stat: 'critChance', value: 0.05 }, // offense 40
        { stat: 'hp', value: 50 },         // defense 30
      ],
    };
    const s = computeItemScores(item);
    expect(s.offense).toBe(75 + 40);
    expect(s.defense).toBe(8 + 30);
    expect(s.utility).toBe(16);
    expect(s.total).toBe(s.offense + s.defense + s.utility);
    expect(Number.isInteger(s.total)).toBe(true);
  });

  it('unknown affix stats are ignored, not crashed on', () => {
    const item = { affixes: [{ stat: 'mystery_stat', value: 99 }, { stat: 'str', value: 2 }] };
    const s = computeItemScores(item);
    expect(s.utility).toBe(8);
    expect(s.total).toBe(8);
  });

  it('shield base intrinsics (synthetic baseIntrinsic affixes) score', () => {
    // Mirrors what generateItem() produces for a tower_shield base
    const shield = {
      armor: 12,
      isShield: true,
      affixes: [
        { id: 'base_block_chance', stat: 'block_chance', value: 0.40, baseIntrinsic: true },
        { id: 'base_block_power',  stat: 'block_power',  value: 32,  baseIntrinsic: true },
      ],
    };
    const s = computeItemScores(shield);
    // 12 (armor) + 0.40*100*4 (160) + 32*1 (32) = 204
    expect(s.defense).toBe(204);
    expect(s.offense).toBe(0);
    expect(s.total).toBe(204);
  });
});

describe('getItemCompareTooltip — U8', () => {
  it('returns empty string for null item', () => {
    expect(getItemCompareTooltip(null, {})).toBe('');
  });

  it('handles vsItem=null with empty-slot upgrade hint', () => {
    const item = { name: 'Test', rarity: 'normal', quality: 'medium', affixes: [] };
    const html = getItemCompareTooltip(item, null, { slotLabel: 'weapon' });
    expect(html).toContain('Test');
    expect(html).toContain('empty');
  });

  it('produces Same / Gained / Lost groups vs an equipped item', () => {
    const a = {
      name: 'A', rarity: 'magic', quality: 'medium', dmg: [10, 20],
      affixes: [
        { id: 'sharp', name: 'Sharp', stat: 'dmg', value: 3 },
        { id: 'of_str', name: 'Sturdy', stat: 'str', value: 4 },
      ],
    };
    const b = {
      name: 'B', rarity: 'magic', quality: 'medium', dmg: [10, 20],
      affixes: [
        { id: 'sharp', name: 'Sharp', stat: 'dmg', value: 3 },        // same
        { id: 'of_dex', name: 'Swift', stat: 'dex', value: 2 },       // lost (B has, A doesn't)
      ],
    };
    const html = getItemCompareTooltip(a, b);
    expect(html).toContain('Comparing vs. B');
    expect(html).toContain('Same');
    expect(html).toContain('Gained');
    expect(html).toContain('Lost');
  });
});
