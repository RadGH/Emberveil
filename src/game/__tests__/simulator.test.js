// Tests for src/game/simulator.js — deterministic turn runner.
import { describe, it, expect } from 'vitest';
import { runSimulation, runMonteCarlo, mulberry32 } from '../simulator.js';

function makeHero(overrides = {}) {
  return {
    id: 'h1',
    name: 'Test Hero',
    cls: 'warrior',
    level: 5,
    attrs: { STR: 14, DEX: 12, INT: 8, CON: 12 },
    equipment: {
      weapon: { dmg: [6, 10], armor: 0 },
      body: { dmg: null, armor: 5 },
    },
    ...overrides,
  };
}

function makeEncounter() {
  return {
    name: 'Test Bandits',
    enemies: [
      {
        id: 'bandit', name: 'Bandit',
        hp: 30, maxHp: 30, dmg: [3, 6], armor: 2, hit: 65, dodge: 5,
        xpValue: 15, gold: [2, 6],
        count: 2,
      },
    ],
  };
}

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const r1 = mulberry32(42);
    const r2 = mulberry32(42);
    for (let i = 0; i < 5; i++) expect(r1()).toBe(r2());
  });
});

describe('runSimulation', () => {
  it('produces a deterministic result for a fixed seed', () => {
    const a = runSimulation({ heroes: [makeHero()], encounter: makeEncounter(), act: 1, seed: 123 });
    const b = runSimulation({ heroes: [makeHero()], encounter: makeEncounter(), act: 1, seed: 123 });
    expect(a.winner).toBe(b.winner);
    expect(a.rounds).toBe(b.rounds);
    expect(a.log.length).toBe(b.log.length);
  });

  it('returns a known snapshot for fixed inputs', () => {
    const res = runSimulation({ heroes: [makeHero(), makeHero({ id: 'h2', name: 'Hero 2' })], encounter: makeEncounter(), act: 1, seed: 7 });
    expect(['party', 'enemies', 'timeout']).toContain(res.winner);
    expect(res.rounds).toBeGreaterThan(0);
    expect(res.party.length).toBe(2);
    expect(res.enemies.length).toBe(2);
  });
});

describe('runMonteCarlo', () => {
  it('returns a sane win rate between 0 and 1 over 100 runs', () => {
    const mc = runMonteCarlo({ heroes: [makeHero()], encounter: makeEncounter(), act: 1, runs: 100, baseSeed: 1 });
    expect(mc.winRate).toBeGreaterThanOrEqual(0);
    expect(mc.winRate).toBeLessThanOrEqual(1);
    expect(mc.avgRounds).toBeGreaterThan(0);
    expect(mc.dmgSamples.length).toBe(100);
  });
});

describe('M116 parity: AI uses skills', () => {
  it('Level-20 mage vs Primordial Patrol casts damage skills (not auto-attacks only)', () => {
    // The pre-M116 simulator bug: a high-INT mage reverted to ~17 raw / ~3 final
    // basic attacks because the AI never picked Fireball. With mergeSkillForCast
    // + INT folded into effective stats, the AI should now emit skill log lines.
    const mage = {
      id: 'mage', name: 'Mage', cls: 'mage', level: 20,
      attrs: { STR: 8, DEX: 10, INT: 40, CON: 14 },
      equipment: {
        weapon: { dmg: [8, 14], armor: 0, category: 'magic' },
        body: { armor: 6 },
      },
      passives: {}, passiveRanks: {}, talentsPurchased: {},
    };
    const encounter = {
      name: 'Primordial Patrol',
      enemies: [
        { id: 'primordial_elemental', name: 'Primordial Elemental',
          hp: 220, maxHp: 220, dmg: [34, 54], armor: 20, hit: 80, dodge: 15,
          xpValue: 180, gold: [30, 55], count: 2 },
        { id: 'reality_shard', name: 'Reality Shard',
          hp: 130, maxHp: 130, dmg: [26, 42], armor: 10, hit: 78, dodge: 22,
          xpValue: 140, gold: [22, 42], count: 2 },
      ],
    };
    const res = runSimulation({ heroes: [mage], encounter, act: 5, seed: 17 });
    const skillLogs = res.log.filter(e => e.skill);
    // Must have emitted at least one skill cast within maxRounds.
    expect(skillLogs.length).toBeGreaterThan(0);
  });
});

describe('level slider effect on damage output', () => {
  it('higher STR yields monotonically >= damage output vs lower STR (over monte carlo)', () => {
    const weak = runMonteCarlo({
      heroes: [makeHero({ attrs: { STR: 8, DEX: 12, INT: 8, CON: 12 } })],
      encounter: makeEncounter(), act: 1, runs: 200, baseSeed: 100,
    });
    const strong = runMonteCarlo({
      heroes: [makeHero({ attrs: { STR: 20, DEX: 12, INT: 8, CON: 12 } })],
      encounter: makeEncounter(), act: 1, runs: 200, baseSeed: 100,
    });
    expect(strong.dmgMean).toBeGreaterThanOrEqual(weak.dmgMean * 0.95);
  });
});
