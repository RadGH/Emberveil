import { describe, expect, it } from 'vitest';
import { runCampaign } from '../runCampaign.js';
import { deterministicPolicy } from '../policies/deterministic.js';

describe('story campaign sim', () => {
  it('runs a short deterministic campaign without throwing', async () => {
    const result = await runCampaign({
      seed: 42,
      storyteller: 'chronicler',
      difficulty: 'normal',
      policy: deterministicPolicy,
      maxNodes: 5,
    });
    expect(result.nodesVisited).toBeGreaterThan(0);
    expect(result.log).toHaveLength(result.nodesVisited);
  });

  it('stays deterministic for the same seed and storyteller', async () => {
    const a = await runCampaign({ seed: 7, storyteller: 'trickster', difficulty: 'normal', policy: deterministicPolicy, maxNodes: 6 });
    const b = await runCampaign({ seed: 7, storyteller: 'trickster', difficulty: 'normal', policy: deterministicPolicy, maxNodes: 6 });
    expect(a.nodesVisited).toBe(b.nodesVisited);
    expect(a.nodeTypeBreakdown).toEqual(b.nodeTypeBreakdown);
  });

  it('returns a summary for the director-aware policy', async () => {
    const result = await runCampaign({ seed: 11, storyteller: 'chronicler', difficulty: 'normal', maxNodes: 10 });
    expect(result.policy).toBe('directorAware');
    expect(result.nodesVisited).toBeGreaterThan(0);
  });
});
