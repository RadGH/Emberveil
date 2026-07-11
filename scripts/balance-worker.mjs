/**
 * balance-worker.mjs — ESM worker for build-storyteller-balance.cjs.
 *
 * Spawned by the CJS orchestrator via worker_threads.
 * workerData: { storytellerId, difficulty, seeds, rootDir }
 * Posts a single result message then exits.
 */

import { workerData, parentPort } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';

const { storytellerId, difficulty, seeds, rootDir } = workerData;

const STORYTELLERS = ['chronicler', 'ash_prophet', 'warbringer', 'trickster', 'pilgrim', 'iron_judge'];
const DIFFICULTIES  = ['relaxed', 'normal', 'hard', 'nightmare'];

let result;
try {
  const rcMod  = await import(path.join(rootDir, 'sim/story/runCampaign.js'));
  const sfMod  = await import(path.join(rootDir, 'sim/story/policies/storyFirst.js'));

  const runCampaign      = rcMod.runCampaign;
  const storyFirstPolicy = sfMod.storyFirstPolicy || sfMod.default;

  if (typeof runCampaign !== 'function') {
    throw new Error('runCampaign is not a function — check sim/story/runCampaign.js exports');
  }
  if (!storyFirstPolicy || typeof storyFirstPolicy.chooseNode !== 'function') {
    throw new Error('storyFirstPolicy.chooseNode not found');
  }

  const results = [];
  for (let s = 1; s <= seeds; s++) {
    const seed = s * 999 + STORYTELLERS.indexOf(storytellerId) * 100 + DIFFICULTIES.indexOf(difficulty);
    try {
      const r = await runCampaign({
        seed,
        storyteller:   storytellerId,
        difficulty,
        policy:        storyFirstPolicy,
        maxNodes:      200,
        immortalParty: true,  // measure routing, not combat attrition
      });
      results.push(r);
    } catch (e) {
      // Swallow per-run errors; they count as 0 acts completed
      results.push({ actsCompleted: 0 });
    }
  }

  const n          = results.length || 1;
  const act1Rate   = results.filter(r => (r.actsCompleted || 0) >= 1).length / n;
  const act2Rate   = results.filter(r => (r.actsCompleted || 0) >= 2).length / n;
  const act3Rate   = results.filter(r => (r.actsCompleted || 0) >= 3).length / n;
  const medianDeaths = results.reduce((a, r) => a + (r.deaths || 0), 0) / n;
  const variety    = results.reduce((a, r) => a + (r.variety || 0), 0) / n;
  const approval   = results.reduce((a, r) => a + (r.avgApproval || 0), 0) / n;
  const factions5  = results.reduce((a, r) => a + (r.factionsAtPlus5 || 0), 0) / n;

  result = { storytellerId, difficulty, seeds: results.length, act1Rate, act2Rate, act3Rate, medianDeaths, variety, approval, factions5 };
} catch (err) {
  result = { storytellerId, difficulty, seeds: 0, error: err.message };
}

parentPort.postMessage(result);
