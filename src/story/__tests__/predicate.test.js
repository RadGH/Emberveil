/**
 * predicate.test.js — Unit tests for evalPredicate (30 tests, one per op + composition).
 */
import { describe, it, expect, vi } from 'vitest';
import { evalPredicate, formatPredicate } from '../storyPredicate.js';

// ---------------------------------------------------------------------------
// Test context factory
// ---------------------------------------------------------------------------
function ctx(overrides = {}) {
  return {
    flags:      {},
    factions:   {},
    quests:     {},
    counters:   {},
    party:      [],
    companions: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('evalPredicate', () => {
  // 1. null/undefined pred -> true
  it('null pred returns true', () => {
    expect(evalPredicate(null, ctx())).toBe(true);
  });
  it('undefined pred returns true', () => {
    expect(evalPredicate(undefined, ctx())).toBe(true);
  });

  // 2. flag — truthy
  it('flag true when set', () => {
    expect(evalPredicate({ flag: 'shrine_purified' }, ctx({ flags: { shrine_purified: true } }))).toBe(true);
  });
  // 3. flag — falsy
  it('flag false when unset', () => {
    expect(evalPredicate({ flag: 'shrine_purified' }, ctx())).toBe(false);
  });
  // 4. flag — non-boolean truthy value
  it('flag truthy for non-boolean value', () => {
    expect(evalPredicate({ flag: 'x' }, ctx({ flags: { x: 42 } }))).toBe(true);
  });

  // 5. faction gte pass
  it('faction gte pass', () => {
    expect(evalPredicate({ faction: 'emberguard', gte: 3 }, ctx({ factions: { emberguard: 5 } }))).toBe(true);
  });
  // 6. faction gte fail
  it('faction gte fail', () => {
    expect(evalPredicate({ faction: 'emberguard', gte: 5 }, ctx({ factions: { emberguard: 3 } }))).toBe(false);
  });
  // 7. faction lte pass
  it('faction lte pass', () => {
    expect(evalPredicate({ faction: 'ashen_veil', lte: -5 }, ctx({ factions: { ashen_veil: -7 } }))).toBe(true);
  });
  // 8. faction lte fail
  it('faction lte fail', () => {
    expect(evalPredicate({ faction: 'ashen_veil', lte: -5 }, ctx({ factions: { ashen_veil: -2 } }))).toBe(false);
  });
  // 9. faction eq pass
  it('faction eq pass', () => {
    expect(evalPredicate({ faction: 'emberguard', eq: 0 }, ctx({ factions: {} }))).toBe(true);
  });
  // 10. faction missing defaults to 0
  it('faction missing defaults to 0', () => {
    expect(evalPredicate({ faction: 'x' }, ctx())).toBe(false); // v=0, no op -> v !== 0 -> false
  });

  // 11. quest exists pass
  it('quest exists pass', () => {
    expect(evalPredicate({ quest: 'q1' }, ctx({ quests: { q1: { status: 'active', phase: 'p1' } } }))).toBe(true);
  });
  // 12. quest missing
  it('quest missing -> false', () => {
    expect(evalPredicate({ quest: 'q1' }, ctx())).toBe(false);
  });
  // 13. quest phase match
  it('quest phase match', () => {
    expect(evalPredicate({ quest: 'q1', phase: 'p1' }, ctx({ quests: { q1: { phase: 'p1', status: 'active' } } }))).toBe(true);
  });
  // 14. quest status match
  it('quest status match', () => {
    expect(evalPredicate({ quest: 'q1', status: 'completed' }, ctx({ quests: { q1: { phase: 'end', status: 'completed' } } }))).toBe(true);
  });

  // 15. counter gte pass
  it('counter gte pass', () => {
    expect(evalPredicate({ counter: 'kills', gte: 5 }, ctx({ counters: { kills: 7 } }))).toBe(true);
  });
  // 16. counter lte fail
  it('counter lte fail', () => {
    expect(evalPredicate({ counter: 'kills', lte: 3 }, ctx({ counters: { kills: 5 } }))).toBe(false);
  });
  // 17. counter default 0
  it('counter missing defaults 0 (> 0 -> false)', () => {
    expect(evalPredicate({ counter: 'x' }, ctx())).toBe(false);
  });

  // 18. item match
  it('item in equipment -> true', () => {
    const p = [{ equipment: { weapon: { id: 'veil_lens' } } }];
    expect(evalPredicate({ item: 'veil_lens' }, ctx({ party: p }))).toBe(true);
  });
  // 19. item missing
  it('item not in equipment -> false', () => {
    expect(evalPredicate({ item: 'veil_lens' }, ctx({ party: [{ equipment: {} }] }))).toBe(false);
  });

  // 20. class match
  it('class match -> true', () => {
    expect(evalPredicate({ class: 'mage' }, ctx({ party: [{ class: 'mage' }] }))).toBe(true);
  });
  // 21. class miss
  it('class mismatch -> false', () => {
    expect(evalPredicate({ class: 'mage' }, ctx({ party: [{ class: 'warrior' }] }))).toBe(false);
  });

  // 22. stat gte pass
  it('stat gte pass on leader', () => {
    expect(evalPredicate({ stat: 'STR', gte: 10 }, ctx({ party: [{ attrs: { STR: 14 } }] }))).toBe(true);
  });
  // 23. stat lte fail
  it('stat lte fail', () => {
    expect(evalPredicate({ stat: 'INT', lte: 5 }, ctx({ party: [{ attrs: { INT: 8 } }] }))).toBe(false);
  });

  // 24. companion recruited + active pass
  it('companion active pass', () => {
    const comps = [{ id: 'lyra', recruited: true, active: true, approval: 7 }];
    expect(evalPredicate({ companion: 'lyra', active: true, approval: { gte: 5 } }, ctx({ companions: comps }))).toBe(true);
  });
  // 25. companion not recruited -> false
  it('companion not recruited -> false', () => {
    const comps = [{ id: 'lyra', recruited: false, active: false, approval: 0 }];
    expect(evalPredicate({ companion: 'lyra' }, ctx({ companions: comps }))).toBe(false);
  });
  // 26. companion approval lte
  it('companion approval lte pass', () => {
    const comps = [{ id: 'orren', recruited: true, active: false, approval: -3 }];
    expect(evalPredicate({ companion: 'orren', approval: { lte: 0 } }, ctx({ companions: comps }))).toBe(true);
  });

  // 27. skillCheck always true at runtime
  it('skillCheck always true at runtime', () => {
    expect(evalPredicate({ skillCheck: 'diplomacy', gte: 15 }, ctx())).toBe(true);
  });

  // 28. all: AND composition
  it('all (AND) both true -> true', () => {
    const c = ctx({ flags: { a: true, b: true } });
    expect(evalPredicate({ all: [{ flag: 'a' }, { flag: 'b' }] }, c)).toBe(true);
  });
  // 29. all: one false -> false
  it('all (AND) one false -> false', () => {
    const c = ctx({ flags: { a: true } });
    expect(evalPredicate({ all: [{ flag: 'a' }, { flag: 'b' }] }, c)).toBe(false);
  });

  // 30. not: negation
  it('not: negates inner', () => {
    expect(evalPredicate({ not: { flag: 'evil' } }, ctx())).toBe(true);
  });

  // Bonus: any (OR) composition
  it('any: one true -> true', () => {
    expect(evalPredicate({ any: [{ flag: 'missing' }, { flag: 'present' }] }, ctx({ flags: { present: true } }))).toBe(true);
  });

  // Unknown op -> false + console.warn
  it('unknown op returns false with console.warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(evalPredicate({ weirdOp: 'value' }, ctx())).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// formatPredicate smoke test
// ---------------------------------------------------------------------------
describe('formatPredicate', () => {
  it('formats a flag predicate', () => {
    expect(formatPredicate({ flag: 'x' })).toContain('flag(x)');
  });
  it('formats an all predicate', () => {
    const out = formatPredicate({ all: [{ flag: 'a' }] });
    expect(out).toContain('ALL');
    expect(out).toContain('flag(a)');
  });
  it('formats null', () => {
    expect(formatPredicate(null)).toBe('null');
  });
});
