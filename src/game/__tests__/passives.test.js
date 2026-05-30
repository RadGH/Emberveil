// M273: tests for passives.getPassiveBonuses — guards against the M272 fix
// to the slot-duplicate multiplier (pyromancer / stormcaller). The previous
// `mult = r * slotCount[node.id]` would silently 2× rank effects; this test
// pins the corrected single-rank-per-purchase behavior.
import { describe, it, expect } from 'vitest';
import { getPassiveBonuses } from '../passives.js';

describe('getPassiveBonuses — base behavior', () => {
  it('returns zeros for a member with no passives', () => {
    const m = { class: 'warrior', passiveRanks: {} };
    const b = getPassiveBonuses(m);
    expect(b.maxHp).toBe(0);
    expect(b.STR).toBe(0);
  });

  it('applies a single purchased rank exactly once', () => {
    // warrior tree includes toughness, ironWall, thorns, vampirism, killingBlow.
    // toughness: { maxHp: +N }. We don't depend on the precise N — we just
    // assert "buying 1 rank gives the per-rank effect, buying 2 gives 2×".
    const m1 = { class: 'warrior', passiveRanks: { toughness: 1 } };
    const m2 = { class: 'warrior', passiveRanks: { toughness: 2 } };
    const b1 = getPassiveBonuses(m1);
    const b2 = getPassiveBonuses(m2);
    expect(b1.maxHp).toBeGreaterThan(0);
    expect(b2.maxHp).toBe(b1.maxHp * 2);
  });
});

describe('getPassiveBonuses — slot-duplicate parity (M272 fix)', () => {
  it('pyromancer 1 rank of igniting matches mage 1 rank of igniting', () => {
    // Both classes' trees include `igniting`, but pyromancer lists it twice.
    // Pre-fix: pyro 1 rank produced 2× the bonus; post-fix they match.
    const pyro = { class: 'pyromancer', passiveRanks: { igniting: 1 } };
    const mage = { class: 'mage',       passiveRanks: { igniting: 1 } };
    const bp = getPassiveBonuses(pyro);
    const bm = getPassiveBonuses(mage);
    expect(bp.burnOnHit).toBe(bm.burnOnHit);
  });

  it('stormcaller 1 rank of stormcharged matches mage 1 rank of stormcharged', () => {
    const sc   = { class: 'stormcaller', passiveRanks: { stormcharged: 1 } };
    const mage = { class: 'mage',        passiveRanks: { stormcharged: 1 } };
    const bsc = getPassiveBonuses(sc);
    const bm  = getPassiveBonuses(mage);
    expect(bsc.chainOnHit).toBe(bm.chainOnHit);
  });

  it('rank progression on duplicate-slot passives still scales linearly', () => {
    const r1 = getPassiveBonuses({ class: 'pyromancer', passiveRanks: { igniting: 1 } });
    const r2 = getPassiveBonuses({ class: 'pyromancer', passiveRanks: { igniting: 2 } });
    const r3 = getPassiveBonuses({ class: 'pyromancer', passiveRanks: { igniting: 3 } });
    if (r1.burnOnHit > 0) {
      expect(r2.burnOnHit).toBeCloseTo(r1.burnOnHit * 2);
      expect(r3.burnOnHit).toBeCloseTo(r1.burnOnHit * 3);
    }
  });
});

describe('getPassiveBonuses — fallback tree', () => {
  it('uses FALLBACK_TREE for unknown class ids', () => {
    const b = getPassiveBonuses({ class: 'not_a_real_class', passiveRanks: { toughness: 1 } });
    // Fallback tree has toughness as a node, so 1 rank should grant maxHp.
    expect(b.maxHp).toBeGreaterThan(0);
  });
});
