/**
 * storytellerDifferentiation.test.js
 *
 * Guards the marquee Story Mode feature: the 6 storytellers must produce
 * MEASURABLY DIFFERENT node-type mixes for the same seed. This is the #1
 * documented failure that this test was written to prevent from regressing.
 *
 * Uses the directorAware policy (now the default) and an immortal party so runs
 * reach a useful length (routing is only observable if the party survives).
 */

import { describe, it, expect } from 'vitest';
import { runCampaign } from '../runCampaign.js';
import { directorAwarePolicy } from '../policies/directorAware.js';

const STORYTELLERS = ['chronicler', 'ash_prophet', 'warbringer', 'trickster', 'pilgrim', 'iron_judge'];
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

/** Sum combat-family node visits (combat + elite + boss). */
function combatCount(breakdown) {
  return (breakdown.combat || 0) + (breakdown.elite || 0) + (breakdown.boss || 0);
}
/** Sum narrative/discovery node visits (lore + dialog + shrine). */
function loreCount(breakdown) {
  return (breakdown.lore || 0) + (breakdown.dialog || 0) + (breakdown.shrine || 0);
}

/** Run one seed across all 6 storytellers, return { storyteller: breakdown }. */
async function runSeedAcrossStorytellers(seed) {
  const out = {};
  for (const st of STORYTELLERS) {
    const result = await runCampaign({
      seed,
      storyteller: st,
      difficulty: 'normal',
      policy: directorAwarePolicy,
      maxNodes: 50,
      immortalParty: true,
    });
    out[st] = result.nodeTypeBreakdown;
  }
  return out;
}

describe('storyteller differentiation (routing)', () => {
  it('runCampaign defaults to the directorAware policy', async () => {
    const result = await runCampaign({ seed: 1, storyteller: 'chronicler', maxNodes: 5, immortalParty: true });
    expect(result.policy).toBe('directorAware');
  });

  it('produces DIFFERENT node-type breakdowns across the 6 storytellers per seed', async () => {
    for (const seed of [1, 2, 3, 4]) {
      const bySt = await runSeedAcrossStorytellers(seed);
      const fingerprints = STORYTELLERS.map(st => JSON.stringify(bySt[st]));
      const unique = new Set(fingerprints);
      // At least 4 of the 6 must be distinct for this seed. (Some pairs may
      // coincide on a given seed, but the mix as a whole must differ.)
      expect(unique.size).toBeGreaterThanOrEqual(4);
    }
  });

  it('warbringer averages MORE combat nodes than chronicler and pilgrim', async () => {
    const totals = Object.fromEntries(STORYTELLERS.map(st => [st, { combat: 0, lore: 0, n: 0 }]));
    for (const seed of SEEDS) {
      const bySt = await runSeedAcrossStorytellers(seed);
      for (const st of STORYTELLERS) {
        totals[st].combat += combatCount(bySt[st]);
        totals[st].lore += loreCount(bySt[st]);
        totals[st].n += 1;
      }
    }
    const avg = (st, key) => totals[st][key] / totals[st].n;

    const warCombat = avg('warbringer', 'combat');
    const chronCombat = avg('chronicler', 'combat');
    const pilgrimCombat = avg('pilgrim', 'combat');

    // Warbringer (combatFrequency 0.7) must be clearly more combat-heavy.
    expect(warCombat).toBeGreaterThan(chronCombat);
    expect(warCombat).toBeGreaterThan(pilgrimCombat);
    expect(warCombat - pilgrimCombat).toBeGreaterThanOrEqual(3);

    // Lore-leaning storytellers must average more narrative nodes than warbringer.
    const warLore = avg('warbringer', 'lore');
    expect(avg('pilgrim', 'lore')).toBeGreaterThan(warLore);
    expect(avg('chronicler', 'lore')).toBeGreaterThan(warLore);
  });

  it('is deterministic — same seed+storyteller yields the same breakdown', async () => {
    const a = await runCampaign({ seed: 5, storyteller: 'warbringer', policy: directorAwarePolicy, maxNodes: 40, immortalParty: true });
    const b = await runCampaign({ seed: 5, storyteller: 'warbringer', policy: directorAwarePolicy, maxNodes: 40, immortalParty: true });
    expect(a.nodeTypeBreakdown).toEqual(b.nodeTypeBreakdown);
  });
});
