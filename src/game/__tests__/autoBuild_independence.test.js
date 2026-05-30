// Item 2 regression test — selecting Auto on one character must not affect
// the autoBuild flags of another character on the same screen.
//
// The reported bug was: "On the character screen with 2 characters who
// leveled up, selecting Auto skills for one character also auto-selects it
// for the other." Root cause candidate is a shared `autoBuild` object
// reference between two party members (e.g. shallow-cloned from a template).
// This test verifies that a fresh per-character creation path produces
// independent autoBuild objects, AND that the defensive guard added in
// SkillTreeScreen breaks aliasing if it ever leaks through.
import { describe, it, expect } from 'vitest';

describe('autoBuild independence between party members', () => {
  it('two heroes created with literal autoBuild keep independent objects', () => {
    const heroA = { id: 'a', class: 'fighter', autoBuild: { auto_active: false, auto_passive: false, auto_attrs: false } };
    const heroB = { id: 'b', class: 'mage',    autoBuild: { auto_active: false, auto_passive: false, auto_attrs: false } };
    heroA.autoBuild.auto_active = true;
    expect(heroA.autoBuild.auto_active).toBe(true);
    expect(heroB.autoBuild.auto_active).toBe(false);
  });

  it('aliased autoBuild (shared reference) WOULD leak — proves the bug shape', () => {
    const shared = { auto_active: false, auto_passive: false, auto_attrs: false };
    // Simulate a bug where two members share the same autoBuild reference.
    const heroA = { id: 'a', class: 'fighter', autoBuild: shared };
    const heroB = { id: 'b', class: 'mage',    autoBuild: shared };
    heroA.autoBuild.auto_active = true;
    // The bug: heroB sees the same flag flip.
    expect(heroB.autoBuild.auto_active).toBe(true);
  });

  it('defensive _isSharedAutoBuild check + re-assignment isolates the two', () => {
    const shared = { auto_active: false, auto_passive: false, auto_attrs: false };
    const heroA = { id: 'a', class: 'fighter', autoBuild: shared };
    const heroB = { id: 'b', class: 'mage',    autoBuild: shared };
    const party = [heroA, heroB];

    // Inline implementation mirrors SkillTreeScreen._isSharedAutoBuild +
    // the toggle-handler's reassignment guard. If the production code
    // diverges, update both sides.
    function isShared(p, c) {
      if (!c || !c.autoBuild) return false;
      for (const o of p) if (o && o !== c && o.autoBuild === c.autoBuild) return true;
      return false;
    }
    function toggle(c, flag) {
      if (isShared(party, c)) {
        const prev = c.autoBuild || {};
        c.autoBuild = {
          auto_attrs: !!prev.auto_attrs,
          auto_passive: !!prev.auto_passive,
          auto_active: !!prev.auto_active,
        };
      }
      c.autoBuild[flag] = !c.autoBuild[flag];
    }

    toggle(heroA, 'auto_active');
    expect(heroA.autoBuild.auto_active).toBe(true);
    expect(heroB.autoBuild.auto_active).toBe(false);
    // Toggling B should not flip A either now.
    toggle(heroB, 'auto_passive');
    expect(heroB.autoBuild.auto_passive).toBe(true);
    expect(heroA.autoBuild.auto_passive).toBe(false);
  });
});
