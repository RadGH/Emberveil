/**
 * byteParity.test.js — Verifies that runCampaign's combat nodes call the exact
 * same runSimulation function with identical parameters as a direct call would.
 *
 * This is the byte-parity contract from §10.3 of 3-refined-plan.md:
 *   "Every combat node calls the EXACT runSimulation from src/game/simulator.js.
 *    The encounter object is byte-identical. The seed is (rngState ^ hash(nodeId))."
 *
 * M-S09.
 */

import { describe, it, expect } from 'vitest';
import { runCampaign, combatSeedForNode, pickEncounterForNode, findEntryNode } from '../runCampaign.js';
import { buildSyntheticGs } from '../buildSyntheticGs.js';
import { runSimulation, mulberry32 } from '../../../src/game/simulator.js';
import { generateAct } from '../../../src/story/storyMapGen.js';
import { buildIndexes, serializeMapSave } from '../../../src/story/storyMapGraph.js';
import { deterministicPolicy } from '../policies/deterministic.js';

// Imports for ENCOUNTERS_CANONICAL
let ENCOUNTERS_CANONICAL;

async function getEncounters() {
  if (!ENCOUNTERS_CANONICAL) {
    const mod = await import('../../../src/game/dataLoader.js');
    ENCOUNTERS_CANONICAL = mod.ENCOUNTERS_CANONICAL;
  }
  return ENCOUNTERS_CANONICAL;
}

// ---------------------------------------------------------------------------
// Setup helpers — replicate exactly what runCampaign does internally
// ---------------------------------------------------------------------------

const SEED = 1;
const STRONG_PARTY = [
  { cls: 'warrior', level: 10 },
  { cls: 'mage',    level: 10 },
  { cls: 'ranger',  level: 10 },
  { cls: 'cleric',  level: 10 },
];

/**
 * Replicate the initial rng state that runCampaign has before the first node.
 * runCampaign does: campRng = mulberry32(seedNum), then rngState = (campRng() * 0xFFFFFFFF) >>> 0
 */
function replicateCampaignRngState(seedNum) {
  const campRng = mulberry32(seedNum);
  const rngState = (campRng() * 0xFFFFFFFF) >>> 0;
  return rngState;
}

/**
 * Find the first combat node in the act-1 map (deterministic path with deterministicPolicy).
 */
async function findFirstCombatNode(seedNum) {
  const mapGenSeed = (seedNum ^ 0xDEADBEEF) >>> 0;
  const { mapGraph } = generateAct({ seed: mapGenSeed, act: 1, salt: 0 });
  buildIndexes(mapGraph);

  // Walk the map following deterministicPolicy until we hit a combat node.
  let currentId = findEntryNode(mapGraph);
  const history = [];
  let steps = 0;

  while (currentId && steps < 50) {
    const node = mapGraph.nodes[currentId];
    if (!node) break;
    if (node.type === 'combat' || node.type === 'elite') {
      return { nodeId: currentId, node, mapGraph, step: steps };
    }
    history.push({ nodeId: currentId, nodeType: node.type, biome: node.biome || 'unknown' });
    currentId = deterministicPolicy.chooseNode(mapGraph, currentId, history);
    steps++;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('byte-parity: runCampaign combat == direct runSimulation', () => {
  it('first combat node produces identical combatResult to direct runSimulation call', async () => {
    const encounters = await getEncounters();
    const seedNum = SEED;

    // 1. Replicate campaign rng state at the entry point (before any nodes).
    const rngState = replicateCampaignRngState(seedNum);

    // 2. Build synthetic gs (same as runCampaign would).
    const gs = buildSyntheticGs({ seed: seedNum, storytellerId: 'chronicler', difficulty: 'normal', partyTemplate: STRONG_PARTY });

    // 3. Find the first combat node.
    const found = await findFirstCombatNode(seedNum);
    expect(found).not.toBeNull();
    const { nodeId, node } = found;

    // 4. Compute the exact combat seed runCampaign uses for this node.
    //    For the very first node: rngState is the initial state (step 0).
    //    runCampaign advances rngState once per non-combat node via campRng().
    //    We need to replicate those advances.
    //
    // Walk from entry to the combat node counting advances.
    const mapGenSeed = (seedNum ^ 0xDEADBEEF) >>> 0;
    const { mapGraph } = generateAct({ seed: mapGenSeed, act: 1, salt: 0 });
    buildIndexes(mapGraph);

    const campRng = mulberry32(seedNum);
    let simRngState = (campRng() * 0xFFFFFFFF) >>> 0; // initial advance

    let walkedId = findEntryNode(mapGraph);
    const walkHistory = [];

    while (walkedId && walkedId !== nodeId) {
      const walkedNode = mapGraph.nodes[walkedId];
      if (!walkedNode) break;
      // Non-combat nodes advance rngState once.
      simRngState = (campRng() * 0xFFFFFFFF) >>> 0;
      walkHistory.push({ nodeId: walkedId, nodeType: walkedNode.type, biome: walkedNode.biome || 'unknown' });
      walkedId = deterministicPolicy.chooseNode(mapGraph, walkedId, walkHistory);
    }

    // 5. Build the combat seed for the first combat node.
    const nodeSeed = combatSeedForNode(simRngState, nodeId);
    const nodeHash = nodeSeed % 0xFFFFFFFF || 1;

    // 6. Build the encounter (same as runCampaign does).
    const { encounter } = pickEncounterForNode(encounters, 1, node.type === 'boss', nodeHash);
    expect(encounter).toBeTruthy();

    // 7. Call runSimulation DIRECTLY with same params.
    const directResult = runSimulation({
      heroes: gs.party,
      encounter,
      act: 1,
      seed: nodeSeed,
    });

    // 8. Run the campaign and find the matching log entry.
    const campaignResult = await runCampaign({
      seed: seedNum,
      storyteller: 'chronicler',
      difficulty: 'normal',
      policy: deterministicPolicy,
      partyTemplate: STRONG_PARTY,
      maxNodes: found.step + 1, // run up to and including the first combat node
      recordCombatLogs: true,
    });

    // Find the log entry for the combat node.
    const combatEntry = campaignResult.log.find(e => e.nodeId === nodeId && (e.nodeType === 'combat' || e.nodeType === 'elite'));
    expect(combatEntry).toBeTruthy();

    const campaignCombatResult = combatEntry.combatResult;
    expect(campaignCombatResult).toBeTruthy();

    // 9. Assert byte-parity on deterministic fields.
    expect(campaignCombatResult.winner).toBe(directResult.winner);
    expect(campaignCombatResult.rounds).toBe(directResult.rounds);

    // Party outcome: hp and alive status must match.
    expect(campaignCombatResult.party.length).toBe(directResult.party.length);
    for (let i = 0; i < directResult.party.length; i++) {
      const dc = directResult.party[i];
      const cc = campaignCombatResult.party[i];
      expect(cc.alive).toBe(dc.alive);
      expect(cc.hp).toBe(dc.hp);
      expect(cc.id).toBe(dc.id);
    }

    // Enemy outcome must match.
    expect(campaignCombatResult.enemies.length).toBe(directResult.enemies.length);
    for (let i = 0; i < directResult.enemies.length; i++) {
      const de = directResult.enemies[i];
      const ce = campaignCombatResult.enemies[i];
      expect(ce.alive).toBe(de.alive);
      expect(ce.hp).toBe(de.hp);
    }
  }, 30000);

  it('combat seed formula is deterministic: same node + rngState = same seed', () => {
    const rngState = 0xDEADBEEF;
    const nodeId = 'a1_r0_c0_l0';
    const s1 = combatSeedForNode(rngState, nodeId);
    const s2 = combatSeedForNode(rngState, nodeId);
    expect(s1).toBe(s2);
    expect(s1).toBeGreaterThan(0);
  });

  it('encounter pick is deterministic: same hash = same encounter', async () => {
    const encounters = await getEncounters();
    const hash = 12345;
    const { key: k1 } = pickEncounterForNode(encounters, 1, false, hash);
    const { key: k2 } = pickEncounterForNode(encounters, 1, false, hash);
    expect(k1).toBe(k2);
    expect(typeof k1).toBe('string');
  });

  it('running 100 act-1 sims with greedy policy completes without throwing', async () => {
    const { greedyPolicy } = await import('../policies/greedy.js');
    const errors = [];
    const promises = [];
    for (let seed = 1; seed <= 100; seed++) {
      promises.push(
        runCampaign({ seed, storyteller: 'chronicler', difficulty: 'normal', policy: greedyPolicy, maxNodes: 20, partyTemplate: STRONG_PARTY })
          .catch(err => { errors.push(`seed ${seed}: ${err}`); })
      );
    }
    await Promise.all(promises);
    expect(errors).toHaveLength(0);
  }, 120000);

  it('running 100 act-1 sims with storyFirst policy completes without throwing', async () => {
    const { storyFirstPolicy } = await import('../policies/storyFirst.js');
    const errors = [];
    const promises = [];
    for (let seed = 1; seed <= 100; seed++) {
      promises.push(
        runCampaign({ seed, storyteller: 'chronicler', difficulty: 'normal', policy: storyFirstPolicy, maxNodes: 20, partyTemplate: STRONG_PARTY })
          .catch(err => { errors.push(`seed ${seed}: ${err}`); })
      );
    }
    await Promise.all(promises);
    expect(errors).toHaveLength(0);
  }, 120000);
});
