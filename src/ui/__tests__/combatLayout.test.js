import { describe, it, expect } from 'vitest';
import { computeCombatLayout, SPRITE_W_AT_1 } from '../combatLayout.js';

const baseOpts = {
  w: 393, h: 852, groundY: 852 * 0.85,
  placementPct: { x: 0, y: 0, w: 0, h: 0 },
  isMobile: true,
};

function unit(id, extra = {}) { return { id, ...extra }; }

describe('computeCombatLayout', () => {
  it('places heroes column left, enemies right, with a gap between zones', () => {
    const r = computeCombatLayout({
      ...baseOpts,
      heroes: [unit('h1'), unit('h2'), unit('h3')],
      companions: [unit('c1')],
      enemyGroups: [[unit('e1'), unit('e2'), unit('e3')]],
    });
    const heroX = r.placements.find(p => p.id === 'h1').x;
    const compX = r.placements.find(p => p.id === 'c1').x;
    const enemyX = r.placements.find(p => p.id === 'e1').x;
    expect(heroX).toBeLessThan(compX);
    expect(compX).toBeLessThan(enemyX);
    // Enemy column should sit in the right half of the screen.
    expect(enemyX).toBeGreaterThan(baseOpts.w * 0.5);
  });

  it('shifts heroes toward the center when there are no companions', () => {
    const withComp = computeCombatLayout({
      ...baseOpts,
      heroes: [unit('h1')], companions: [unit('c1')],
      enemyGroups: [[unit('e1')]],
    });
    const noComp = computeCombatLayout({
      ...baseOpts,
      heroes: [unit('h1')], companions: [],
      enemyGroups: [[unit('e1')]],
    });
    const hX1 = withComp.placements.find(p => p.id === 'h1').x;
    const hX2 = noComp.placements.find(p => p.id === 'h1').x;
    expect(hX2).toBeGreaterThan(hX1);
  });

  it('centers a single enemy group inside the enemy zone', () => {
    const r1 = computeCombatLayout({
      ...baseOpts,
      heroes: [unit('h1')], companions: [],
      enemyGroups: [[unit('e1')]],
    });
    const r3 = computeCombatLayout({
      ...baseOpts,
      heroes: [unit('h1')], companions: [],
      enemyGroups: [[unit('e1')], [unit('e2')], [unit('e3')]],
    });
    // With 1 group its single column sits between 2nd and 3rd group centers
    // when there are 3 groups — i.e. roughly centered in the enemy zone.
    const single = r1.placements.find(p => p.id === 'e1').x;
    const group2 = r3.placements.find(p => p.id === 'e2').x;
    expect(Math.abs(single - group2)).toBeLessThan(baseOpts.w * 0.18);
  });

  it('stacks units in a vertical column (descending y per index)', () => {
    const r = computeCombatLayout({
      ...baseOpts,
      heroes: [unit('h1'), unit('h2'), unit('h3')],
      companions: [], enemyGroups: [[unit('e1')]],
    });
    const ys = r.placements.filter(p => p.role === 'hero').map(p => p.y);
    expect(ys[0]).toBeGreaterThan(ys[1]);
    expect(ys[1]).toBeGreaterThan(ys[2]);
  });

  it('keeps adjacent column centers ≥ minColDist apart so sprites cannot overlap', () => {
    const r = computeCombatLayout({
      ...baseOpts,
      heroes: [unit('h1')], companions: [unit('c1')],
      enemyGroups: [[unit('e1')]],
    });
    const xs = r.placements.map(p => p.x).sort((a,b) => a-b);
    for (let i = 1; i < xs.length; i++) {
      // Adjacent column distance must be at least one sprite width × scale.
      expect(xs[i] - xs[i-1]).toBeGreaterThanOrEqual(SPRITE_W_AT_1 * r.scale - 1);
    }
  });

  it('responds to placement.x left margin by shifting all columns right', () => {
    const r0 = computeCombatLayout({
      ...baseOpts,
      heroes: [unit('h1')], companions: [], enemyGroups: [[unit('e1')]],
    });
    const r30 = computeCombatLayout({
      ...baseOpts,
      placementPct: { x: 30, y: 0, w: 0, h: 0 },
      heroes: [unit('h1')], companions: [], enemyGroups: [[unit('e1')]],
    });
    const h0 = r0.placements.find(p => p.id === 'h1').x;
    const h30 = r30.placements.find(p => p.id === 'h1').x;
    expect(h30).toBeGreaterThan(h0);
    // Roughly proportional to 30% of viewport width.
    expect(h30 - h0).toBeGreaterThan(baseOpts.w * 0.10);
  });

  it('compresses pitch so a tall column never escapes the grid rect', () => {
    const r = computeCombatLayout({
      ...baseOpts,
      heroes: [unit('h1'), unit('h2'), unit('h3'), unit('h4'), unit('h5'), unit('h6')],
      companions: [], enemyGroups: [[unit('e1')]],
    });
    const heroPlace = r.placements.filter(p => p.role === 'hero');
    const minY = Math.min(...heroPlace.map(p => p.y));
    expect(minY).toBeGreaterThanOrEqual(r.rect.gridTop - 1);
  });
});
