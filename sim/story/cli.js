#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { runCampaign } from './runCampaign.js';
import { directorAwarePolicy } from './policies/directorAwarePolicy.js';
import { deterministicPolicy } from './policies/deterministic.js';
import { randomPolicy } from './policies/random.js';
import { storyFirstPolicy } from './policies/storyFirst.js';
import { combatHeavyPolicy } from './policies/combatHeavy.js';
import { explorerPolicy } from './policies/explorer.js';
import { greedyPolicy } from './policies/greedy.js';

const POLICY_MAP = {
  directorAware: directorAwarePolicy,
  deterministic: deterministicPolicy,
  random: randomPolicy,
  storyFirst: storyFirstPolicy,
  combatHeavy: combatHeavyPolicy,
  explorer: explorerPolicy,
  greedy: greedyPolicy,
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const policy = POLICY_MAP[args.policy] || directorAwarePolicy;
  const results = [];
  for (let i = 0; i < args.seeds; i++) {
    results.push(await runCampaign({
      seed: args.seed + i,
      storyteller: args.storyteller,
      difficulty: args.difficulty,
      policy,
      maxNodes: args.maxNodes,
      recordCombatLogs: args.recordCombatLogs,
    }));
  }
  const payload = {
    timestamp: new Date().toISOString(),
    args,
    policy: policy.name,
    results,
  };
  if (args.out) {
    const outPath = resolve(process.cwd(), args.out);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(payload, null, 2));
  } else {
    console.log(JSON.stringify(payload, null, 2));
  }
}

function parseArgs(argv) {
  const out = {
    seeds: 1,
    seed: 1,
    storyteller: 'chronicler',
    difficulty: 'normal',
    policy: 'directorAware',
    maxNodes: 250,
    recordCombatLogs: false,
    out: null,
  };
  for (const arg of argv) {
    if (arg.startsWith('--seeds=')) out.seeds = Math.max(1, parseInt(arg.slice(8), 10) || 1);
    else if (arg.startsWith('--seed=')) out.seed = parseInt(arg.slice(7), 10) || 1;
    else if (arg.startsWith('--storyteller=')) out.storyteller = arg.slice(14);
    else if (arg.startsWith('--difficulty=')) out.difficulty = arg.slice(13);
    else if (arg.startsWith('--policy=')) out.policy = arg.slice(9);
    else if (arg.startsWith('--maxNodes=')) out.maxNodes = parseInt(arg.slice(11), 10) || 250;
    else if (arg === '--recordCombatLogs') out.recordCombatLogs = true;
    else if (arg.startsWith('--out=')) out.out = arg.slice(6);
  }
  return out;
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
