import { runSimulation } from '../../src/game/simulator.js';
import { generateAct } from '../../src/story/storyMapGen.js';
import { currentMap, visitNode } from '../../src/story/storyMapMutations.js';
import { buildEncounterForNode } from '../../src/story/storyEncounterBuilder.js';
import { getDirectorIntent, stepDirector } from '../../src/story/storyDirector.js';
import { createDialogSession, currentDialogNode, chooseDialogChoice } from '../../src/story/storyDialogConductor.js';
import { resolveStorySkillCheck } from '../../src/story/storySkillCheck.js';
import { tickQuestConditions } from '../../src/story/storyQuestEngine.js';
import { assembleCombatParty, syncCombatCompanion } from '../../src/story/storyCompanions.js';
import { buildSyntheticGs } from './buildSyntheticGs.js';
import { directorAwarePolicy } from './policies/directorAwarePolicy.js';

export async function runCampaign({
  seed = 1,
  storyteller = 'chronicler',
  difficulty = 'normal',
  policy = directorAwarePolicy,
  partyTemplate = null,
  maxNodes = 250,
  recordCombatLogs = false,
} = {}) {
  const gs = buildSyntheticGs({ seed, storyteller, difficulty, partyTemplate });
  const log = [];
  const startedAt = Date.now();
  let outcome = 'timeout';

  for (let i = 0; i < maxNodes; i++) {
    const { graph, mapSave } = currentMap(gs);
    const currentNode = graph.nodes[gs.story.currentNodeId] || graph.nodes[graph.entryNodeId];
    const preview = getDirectorIntent(gs);
    const intent = policy?.callsDirector
      ? policy.stepDirector(gs, { graph, mapSave, currentNode, preview })
      : stepDirector(gs);
    const candidates = preview.candidates;
    const chosenNodeId = chooseNodeId(policy, { gs, graph, mapSave, currentNode, intent, candidates, rng: mulberry(seed + i) });
    const nextNode = graph.nodes[chosenNodeId] || currentNode;
    const visited = visitNode(gs, nextNode.id);
    const nodeType = nextNode.type;
    const entry = {
      nodeIdx: i,
      nodeId: nextNode.id,
      nodeType,
      biome: nextNode.biome || null,
      regionId: nextNode.regionId || null,
      directorIntent: intent ? { id: intent.id, type: intent.type, biome: intent.biome, nodeId: intent.nodeId } : null,
      candidates: candidates.slice(0, 6).map(c => ({
        id: c.id,
        type: c.type,
        baseWeight: c.baseWeight,
        scoreBeforeNorm: c.scoreBeforeNorm ?? null,
        scoreAfterNorm: c.scoreAfterNorm ?? null,
        prob: c.prob ?? null,
      })),
      encounterTemplate: null,
      encounterInstance: null,
      combatResult: null,
      dialogNodeId: null,
      dialogChoiceId: null,
      skillLabel: null,
      skillDC: null,
      skillResult: null,
      effects: [],
      flagsSet: [],
      flagsCleared: [],
      questsAdvanced: [],
      questsCompleted: [],
      companionApprovalDeltas: {},
      goldDelta: 0,
      xpAwarded: 0,
      hpBefore: null,
      hpAfter: null,
      deathsThisFight: 0,
      rngStateBefore: gs.story.rngState,
      rngStateAfter: gs.story.rngState,
      pressureBefore: gs.story.pressureMeter || 0,
      pressureAfter: gs.story.pressureMeter || 0,
      wallMs: 0,
    };

    if (!visited) break;

    if (nodeType === 'combat' || nodeType === 'boss') {
      const encounter = buildEncounterForNode(gs, nextNode.id);
      const heroes = assembleCombatParty(gs);
      syncCombatCompanion(gs);
      const combat = runSimulation({ heroes, encounter, act: nextNode.act || gs.story.act || 1, seed: seed + i, maxRounds: 80 });
      entry.encounterTemplate = encounter.id;
      entry.encounterInstance = { id: encounter.id, enemies: encounter.enemies.map(e => ({ id: e.id, count: e.count || 1, name: e.name })) };
      entry.combatResult = { winner: combat.winner, rounds: combat.rounds, logLen: combat.log.length };
      entry.deathsThisFight = combat.party.filter(p => !p.alive || p.hp <= 0).length;
      if (combat.winner !== 'party') {
        outcome = 'dead';
        log.push(entry);
        break;
      }
      gs.story.recentHistory.winStreak = (gs.story.recentHistory.winStreak || 0) + 1;
      gs.story.recentHistory.lossStreak = 0;
      entry.xpAwarded = Math.round((combat.enemies || []).reduce((acc, e) => acc + (e.xpValue || 0), 0));
    } else if (nodeType === 'dialog') {
      const session = createDialogSession(gs, 'pool:arrival#arrival_emberwood_001');
      let dialog = currentDialogNode(session, gs);
      if (dialog?.choices?.length) {
        const choiceId = policy?.chooseDialog?.({ choices: dialog.choices, node: nextNode, gs, intent }) || dialog.choices[0].id;
        const result = chooseDialogChoice(session, choiceId, gs);
        dialog = result.node || dialog;
        entry.dialogNodeId = dialog?.id || null;
        entry.dialogChoiceId = choiceId;
        entry.effects = result.effects?.applied || [];
      }
    } else if (nodeType === 'shrine' || nodeType === 'rest') {
      gs.story.pressureMeter = Math.max(0, (gs.story.pressureMeter || 0) - 10);
    } else if (nodeType === 'lore') {
      gs.story.loreDiscovered = gs.story.loreDiscovered || [];
      gs.story.loreDiscovered.push(`lore_${nextNode.id}`);
    } else if (nodeType === 'merchant') {
      gs.gold = (gs.gold || 0) + 15;
      entry.goldDelta = 15;
    } else if (nodeType === 'event') {
      const skill = resolveStorySkillCheck(gs, { skill: 'lore', dc: 10 + (nextNode.regionIndex || 0) });
      entry.skillLabel = skill.skillLabel;
      entry.skillDC = skill.dc;
      entry.skillResult = skill.outcome;
    }

    tickQuestConditions(gs);
    maybeAdvanceAct(gs, nextNode, nodeType);
    entry.rngStateAfter = gs.story.rngState;
    entry.pressureAfter = gs.story.pressureMeter || 0;
    entry.wallMs = Date.now() - startedAt;
    log.push(entry);
  }

  if (outcome !== 'dead') outcome = 'timeout';
  return summarizeResult({ seed, storyteller, difficulty, policy, outcome, gs, log, startedAt, recordCombatLogs });
}

function chooseNodeId(policy, state) {
  if (!policy?.chooseNode) return state.intent?.nodeId || state.currentNode?.id || null;
  return policy.chooseNode(state) || state.intent?.nodeId || state.currentNode?.id || null;
}

function maybeAdvanceAct(gs, node, nodeType) {
  if (gs.story.act >= 3) return;
  const { graph } = currentMap(gs);
  const hasOutgoing = (graph.edges || []).some(edge => edge.from === node.id && edge.kind === 'open');
  const shouldAdvance = nodeType === 'boss' || !hasOutgoing;
  if (!shouldAdvance) return;
  const nextAct = (gs.story.act || 1) + 1;
  if (nextAct > 3) return;
  const generated = generateAct({ seed: gs.story.campaignSeed, act: nextAct, salt: (gs.story.saltOffset || 0) + nextAct });
  gs.story.act = nextAct;
  gs.story.currentMapId = generated.graph.mapId;
  gs.story.currentNodeId = generated.graph.entryNodeId;
  gs.story.maps[generated.graph.mapId] = generated.mapSave;
  gs.act = nextAct;
  gs.zoneId = generated.graph.mapId;
  gs.nodeId = generated.graph.entryNodeId;
  gs.story.flags[`act${nextAct}_started`] = true;
}

function summarizeResult({ seed, storyteller, difficulty, policy, outcome, gs, log, startedAt, recordCombatLogs }) {
  const nodeTypeBreakdown = {};
  for (const entry of log) nodeTypeBreakdown[entry.nodeType] = (nodeTypeBreakdown[entry.nodeType] || 0) + 1;
  const uniqueNodeTypes = new Set(log.map(entry => entry.nodeType)).size;
  const uniqueBiomes = new Set(log.map(entry => entry.biome).filter(Boolean)).size;
  const uniqueSkillLabels = new Set(log.map(entry => entry.skillLabel).filter(Boolean)).size;
  const maxSameTypeStreak = streakMax(log.map(entry => entry.nodeType));
  const avgSameTypeStreak = streakMean(log.map(entry => entry.nodeType));
  return {
    seed,
    saltOffset: gs.story.saltOffset || 0,
    storytellerId: storyteller,
    difficulty,
    policy: policy?.name || 'unknown',
    outcome,
    actsCompleted: gs.story.act || 1,
    nodesVisited: log.length,
    nodeTypeBreakdown,
    combatWinRate: log.filter(entry => entry.combatResult?.winner === 'party').length / Math.max(1, log.filter(entry => entry.combatResult).length),
    totalDeaths: log.reduce((acc, entry) => acc + (entry.deathsThisFight || 0), 0),
    goldFinal: gs.gold || 0,
    gearScoreFinal: (gs.party || []).length,
    questsCompleted: { primary: Object.values(gs.story.quests || {}).filter(q => q.status === 'complete').length, secondary: 0, side: 0 },
    flagsSet: Object.keys(gs.story.flags || {}),
    factionsFinal: { ...(gs.story.factions || {}) },
    companionApprovalFinal: Object.fromEntries((gs.story.companions || []).map(c => [c.id, c.approval || 0])),
    varietyMetrics: {
      uniqueNodeTypes,
      uniqueBiomes,
      uniqueEnemyFamilies: new Set(log.map(entry => entry.encounterTemplate).filter(Boolean)).size,
      uniqueSkillLabels,
      avgSameTypeStreak,
      maxSameTypeStreak,
    },
    durationMs: Date.now() - startedAt,
    log: recordCombatLogs ? log : log.map(({ combatResult: _combatResult, encounterInstance: _encounterInstance, ...rest }) => rest),
  };
}

function streakMax(values) {
  let max = 0;
  let last = null;
  let streak = 0;
  for (const value of values) {
    if (value === last) streak += 1;
    else {
      last = value;
      streak = 1;
    }
    if (streak > max) max = streak;
  }
  return max;
}

function streakMean(values) {
  if (!values.length) return 0;
  let last = null;
  let streak = 0;
  const runs = [];
  for (const value of values) {
    if (value === last) streak += 1;
    else {
      if (streak > 0) runs.push(streak);
      last = value;
      streak = 1;
    }
  }
  if (streak > 0) runs.push(streak);
  return runs.reduce((a, b) => a + b, 0) / runs.length;
}

function mulberry(seed) {
  let a = (seed | 0) || 1;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
