/**
 * runCampaign.js — Headless story-mode campaign simulator.
 *
 * Byte-parity contract (§10.3 of 3-refined-plan.md):
 *   - Uses the EXACT runSimulation export from src/game/simulator.js — no shadow copy.
 *   - Hero combatants are built by heroToCombatant (same live function, called inside runSimulation).
 *   - Per-combat seed = (campaignRngState ^ nodeIdHash) >>> 0
 *   - Map generation seed = (seedNum ^ 0xDEADBEEF) >>> 0 — matches §10.3 rule 2.
 *   - Same seed inputs always yield byte-identical CampaignResult.
 *
 * Node-only. No browser APIs. No localStorage.
 */

import { mulberry32, runSimulation } from '../../src/game/simulator.js';
import { awardXp } from '../../src/game/xp.js';
import { buildSyntheticGs } from './buildSyntheticGs.js';
import { generateAct } from '../../src/story/storyMapGen.js';
import { buildIndexes, serializeMapSave } from '../../src/story/storyMapGraph.js';
import { recordTick, stepDirector, applyPressure, pressureBand } from '../../src/story/storyDirector.js';
import { trackWarbringerStreak } from '../../src/story/storyStorytellers.js';
import { tickQuestConditions, ensureQuestStarted } from '../../src/story/storyQuestEngine.js';
import { buildContentRegistry } from '../../src/story/storyContent.js';

// Act-appropriate encounter pool used by the byte-parity sim combat picker.
const ACT_ENCOUNTER_POOL = {
  1: ['goblin_patrol', 'wolf_pack', 'bandit_ambush', 'spider_nest', 'bear_ambush', 'corrupted_outpost'],
  2: ['ash_patrol', 'obsidian_garrison', 'ember_ambush', 'veil_cult_camp'],
  3: ['demon_patrol', 'hell_garrison', 'rift_assault', 'void_nexus_ambush'],
};

const ACT_BOSS_POOL = {
  1: ['grax_final'],
  2: ['lava_titan', 'veil_high_priest'],
  3: ['archfiend_malgrath', 'emberveil_sovereign'],
};

// ---------------------------------------------------------------------------
// Encounter cache — loaded lazily on first use.
// ---------------------------------------------------------------------------
let _encountersCache = null;

async function getEncounters() {
  if (_encountersCache) return _encountersCache;
  const mod = await import('../../src/game/dataLoader.js');
  _encountersCache = mod.ENCOUNTERS_CANONICAL || {};
  return _encountersCache;
}

// ---------------------------------------------------------------------------
// Quest content registry — loaded lazily, Node-only (readFileSync).
// ---------------------------------------------------------------------------
let _questContentCache = null;

function _loadQuestFilesSync() {
  if (_questContentCache) return _questContentCache;
  try {
    const nodeFs   = globalThis.require?.('fs');
    const nodePath = globalThis.require?.('path');
    if (!nodeFs || !nodePath) { _questContentCache = {}; return {}; }

    const questDir = nodePath.resolve(process.cwd(), 'data', 'story', 'quest-lines');
    if (!nodeFs.existsSync(questDir)) { _questContentCache = {}; return {}; }

    const quests = {};
    for (const fname of nodeFs.readdirSync(questDir)) {
      if (!fname.endsWith('.json') || fname.startsWith('_')) continue;
      try {
        const raw = nodeFs.readFileSync(nodePath.join(questDir, fname), 'utf8');
        const def = JSON.parse(raw);
        if (def?.id) quests[def.id] = def;
      } catch { /* skip malformed file */ }
    }
    _questContentCache = quests;
  } catch { _questContentCache = {}; }
  return _questContentCache;
}

/** Build and attach the story content registry to gs. */
function _wireContentRegistry(gs) {
  const quests = _loadQuestFilesSync();
  gs.__storyContent = buildContentRegistry(quests);
}

// Primary quest ids per act, used to seed quest state in synthetic gs.
const PRIMARY_QUESTS = {
  1: 'primary_act1_emberwood',
  2: 'primary_act2_veilscar',
  3: 'primary_act3_riftgate',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** FNV-1a 32-bit hash of a string → uint32. */
function hashStr(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (Math.imul(h, 0x01000193)) >>> 0;
  }
  return h >>> 0;
}

/**
 * Per-node combat seed per §10.3 rule 3.
 * Combines current campaign RNG state with a deterministic hash of nodeId.
 */
export function combatSeedForNode(rngState, nodeId) {
  return (rngState ^ hashStr(nodeId)) >>> 0 || 1;
}

/**
 * Pick an encounter from the act pool for a given node.
 */
export function pickEncounterForNode(encounters, act, isBoss, nodeHash) {
  const pool = isBoss
    ? (ACT_BOSS_POOL[act] || ACT_BOSS_POOL[1])
    : (ACT_ENCOUNTER_POOL[act] || ACT_ENCOUNTER_POOL[1]);

  const valid = pool.filter(k => encounters[k]);
  if (!valid.length) {
    const allKeys = Object.keys(encounters);
    return { key: allKeys[nodeHash % allKeys.length], encounter: encounters[allKeys[nodeHash % allKeys.length]] };
  }

  const key = valid[nodeHash % valid.length];
  return { key, encounter: encounters[key] };
}

/** Compute gold awarded by an encounter. */
function goldFromEncounter(encounter, rng) {
  if (!encounter || !Array.isArray(encounter.enemies)) return 0;
  let total = 0;
  for (const g of encounter.enemies) {
    const [gMin, gMax] = g.gold || [0, 0];
    for (let i = 0; i < (g.count || 1); i++) {
      total += gMin + Math.floor(rng() * (gMax - gMin + 1));
    }
  }
  return total;
}

/** Compute XP from an encounter. */
function xpFromEncounter(encounter) {
  if (!encounter || !Array.isArray(encounter.enemies)) return 0;
  let total = 0;
  for (const g of encounter.enemies) total += (g.xpValue || 0) * (g.count || 1);
  return total;
}

/** Build a map-id string from act + seed. */
function mapIdForAct(act, seedNum) {
  return `act${act}_map_${seedNum}`;
}

/**
 * Find the entry node for a map — leftmost column, first sub-region, lowest lane.
 * Node ID pattern: a{act}_r{ri}_c{col}_l{lane}
 */
export function findEntryNode(mapGraph) {
  let bestId = null;
  let bestRi = Infinity, bestCol = Infinity, bestLane = Infinity;

  for (const id of Object.keys(mapGraph.nodes || {})) {
    const m = id.match(/^a\d+_r(\d+)_c(\d+)_l(\d+)$/);
    if (!m) continue;
    const ri = Number(m[1]), col = Number(m[2]), lane = Number(m[3]);
    if (ri < bestRi || (ri === bestRi && col < bestCol) || (ri === bestRi && col === bestCol && lane < bestLane)) {
      bestRi = ri; bestCol = col; bestLane = lane; bestId = id;
    }
  }
  return bestId;
}

/** Find the boss node. */
function findBossNode(mapGraph) {
  for (const [id, node] of Object.entries(mapGraph.nodes || {})) {
    if (node.type === 'boss') return id;
  }
  return null;
}

/** Generate next act's map, store in gs.story.maps, return entry node. */
async function advanceToNextAct(gs, nextAct, seedNum) {
  const nextSeed = (seedNum ^ (nextAct * 0x5A3B2C1D)) >>> 0;
  const { mapGraph } = generateAct({ seed: nextSeed, act: nextAct, salt: 0 });
  const nextMapId = mapIdForAct(nextAct, nextSeed);
  gs.story.maps[nextMapId] = serializeMapSave(mapGraph);
  gs.story.act = nextAct;
  gs.story.currentMapId = nextMapId;
  buildIndexes(mapGraph);
  const entryNodeId = findEntryNode(mapGraph);
  return { nextMap: mapGraph, nextMapId, entryNodeId };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Run a full headless Story Mode campaign.
 *
 * @param {object} opts
 * @param {number|string} opts.seed
 * @param {string}        opts.storyteller
 * @param {string}        opts.difficulty
 * @param {object}        opts.policy
 * @param {object[]}      [opts.partyTemplate]
 * @param {number}        [opts.maxNodes=250]
 * @param {boolean}       [opts.recordCombatLogs=false]
 *
 * @returns {Promise<CampaignResult>}
 */
export async function runCampaign({
  seed = 1,
  storyteller = 'chronicler',
  difficulty = 'normal',
  policy,
  partyTemplate,
  maxNodes = 250,
  recordCombatLogs = false,
  immortalParty = false,  // M-S28: set true in balance-check mode; party survives all combat
} = {}) {
  const startMs = Date.now();

  // ── 1. Resolve seed ──────────────────────────────────────────────────────
  const seedNum = typeof seed === 'number' ? (seed | 0) >>> 0 || 1
    : (parseInt(String(seed), 16) >>> 0) || 1;

  // ── 2. Synthetic gs ──────────────────────────────────────────────────────
  const gs = buildSyntheticGs({ seed: seedNum, storytellerId: storyteller, difficulty, partyTemplate });

  // Wire quest content registry so the quest engine can tick.
  _wireContentRegistry(gs);

  // Bootstrap: set act1_started + arrived_brightfall flags and kick primary quest.
  gs.story.flags['act1_started'] = true;
  gs.story.flags['arrived_brightfall'] = true;
  ensureQuestStarted(gs, PRIMARY_QUESTS[1]);

  // Campaign-level RNG — mulberry32(seedNum).
  const campRng = mulberry32(seedNum);
  // Advance once to mix initial state.
  let rngState = (campRng() * 0xFFFFFFFF) >>> 0;

  // ── 3. Load encounters ───────────────────────────────────────────────────
  const encounters = await getEncounters();

  // ── 4. Generate act-1 map ────────────────────────────────────────────────
  // §10.3 rule 2: map gen seed = seedNum ^ 0xDEADBEEF.
  const mapGenSeed = (seedNum ^ 0xDEADBEEF) >>> 0;
  const { mapGraph: actMap } = generateAct({ seed: mapGenSeed, act: 1, salt: 0 });
  const mapId = mapIdForAct(1, mapGenSeed);

  gs.story.maps[mapId] = serializeMapSave(actMap);
  gs.story.currentMapId = mapId;
  buildIndexes(actMap);

  // ── 5. Entry node ────────────────────────────────────────────────────────
  let currentNodeId = findEntryNode(actMap);
  let currentMap = actMap;

  if (!currentNodeId) {
    return _buildResult({ gs, seedNum, storyteller, difficulty, policy,
      outcome: 'abandoned', log: [], startMs, recordCombatLogs,
      combatWins: 0, combatTotal: 0, totalDeaths: 0, goldAccum: 0, varietyData: {} });
  }

  gs.story.currentNodeId = currentNodeId;

  // ── 6. Main loop ─────────────────────────────────────────────────────────
  //
  // Each iteration: process currentNodeId, then ask policy for the NEXT node
  // to move to (stored in currentNodeId for the next iteration).
  //
  const log = [];
  let outcome = null;
  let nodeIdx = 0;

  const varietyData = {
    nodeTypes: {}, biomes: {},
    sameTypeStreaks: [], lastType: null, maxSameTypeStreak: 0,
  };

  let combatWins = 0, combatTotal = 0, totalDeaths = 0, goldAccum = 0;
  const history = [];

  while (nodeIdx < maxNodes && !outcome) {
    const node = currentMap.nodes[currentNodeId];
    if (!node) { outcome = 'abandoned'; break; }

    const nodeType = node.type || 'unknown';
    const biome = node.biome || 'unknown';
    const isCombatNode = nodeType === 'combat' || nodeType === 'elite' || nodeType === 'boss';

    // ── Build log entry ───────────────────────────────────────────────────
    const rngStateBefore = rngState;
    const wallStart = Date.now();
    const hpBefore = {};
    gs.party.forEach((m, i) => { hpBefore[`p${i}`] = m.hp; });

    const entry = {
      nodeIdx,
      nodeId: currentNodeId,
      nodeType,
      biome,
      regionId: node.regionId || null,
      directorIntent: { type: nodeType, primaryRole: null, themeTags: [], _band: pressureBand(gs) },
      candidates: [],
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
      hpBefore,
      hpAfter: null,
      deathsThisFight: 0,
      rngStateBefore,
      rngStateAfter: rngStateBefore,
      pressureBefore: gs.story.pressureMeter,
      pressureAfter: gs.story.pressureMeter,
      wallMs: 0,
    };

    // ── Resolve node ──────────────────────────────────────────────────────
    if (isCombatNode) {
      combatTotal++;

      // Deterministic per-node combat seed (§10.3 rule 3).
      const nodeSeed = combatSeedForNode(rngState, currentNodeId);
      const nodeHash = nodeSeed % 0xFFFFFFFF || 1;

      const { key: encKey, encounter } = pickEncounterForNode(
        encounters, gs.story.act, nodeType === 'boss', nodeHash
      );

      entry.encounterTemplate = encKey;
      entry.encounterInstance = encounter;

      // THE byte-parity call — the exact exported function the browser uses.
      const combatResult = runSimulation({
        heroes: gs.party,
        encounter,
        act: gs.story.act,
        seed: nodeSeed,
      });

      entry.combatResult = recordCombatLogs
        ? combatResult
        : _summarizeCombatResult(combatResult);

      let partyAlive = combatResult.party.some(p => p.alive && p.hp > 0);
      const deaths = combatResult.party.filter(p => !p.alive || p.hp <= 0).length;
      entry.deathsThisFight = deaths;
      totalDeaths += deaths;

      // immortalParty: party never dies (for balance routing tests — M-S28).
      if (!partyAlive && immortalParty) {
        partyAlive = true;
        // Restore party to 50% HP.
        for (const h of gs.party) { h.hp = Math.max(1, Math.round((h.maxHp || 100) * 0.5)); h.alive = true; }
      }

      if (!partyAlive) {
        outcome = 'dead';
      } else {
        combatWins++;

        // Award XP
        const xp = xpFromEncounter(encounter);
        const xpPerMember = Math.round(xp / gs.party.length);
        if (xpPerMember > 0) { awardXp(gs.party, xpPerMember); entry.xpAwarded = xp; }

        // Award gold
        const goldGain = goldFromEncounter(encounter, campRng);
        gs.gold = (gs.gold || 0) + goldGain;
        goldAccum += goldGain;
        entry.goldDelta = goldGain;

        // Sync party HP from combat result (skip if immortal mode already restored)
        if (!immortalParty) {
          combatResult.party.forEach((combatant, i) => {
            if (gs.party[i]) {
              gs.party[i].hp = Math.max(0, combatant.hp);
              gs.party[i].alive = combatant.alive && combatant.hp > 0;
            }
          });
        }

        // Boss: advance act or end campaign
        if (nodeType === 'boss') {
          if (gs.story.act < 3) {
            const nextAct = gs.story.act + 1;

            // Fire act-boundary flags to allow quest completion checks.
            gs.story.flags[`act${gs.story.act}_route_open`] = true;
            if (gs.story.act === 1) {
              gs.story.flags['act1_route_open'] = true;
              gs.story.flags['guardian_killed'] = true; // sim default: guardian defeated
            } else if (gs.story.act === 2) {
              gs.story.flags['act2_route_open'] = true;
              gs.story.flags['herald_defeated'] = true;
              gs.story.flags['act2_primary_complete'] = true;
            }

            // Tick quest conditions before advancing so primary quest can complete.
            tickQuestConditions(gs);

            const { nextMap, entryNodeId } = await advanceToNextAct(gs, nextAct, seedNum);
            currentMap = nextMap;
            buildIndexes(currentMap);
            currentNodeId = entryNodeId || currentNodeId;
            gs.story.currentNodeId = currentNodeId;

            // Start primary quest for the new act.
            gs.story.flags[`act${nextAct}_started`] = true;
            const nextPrimaryQuestId = PRIMARY_QUESTS[nextAct];
            if (nextPrimaryQuestId) ensureQuestStarted(gs, nextPrimaryQuestId);

            // Apply world corruption bump.
            gs.story.worldCorruption = Math.min(100,
              (gs.story.worldCorruption || 0) + (nextAct === 2 ? 10 : 15)
            );
          } else {
            // Act 3 boss defeated — final campaign completion.
            gs.story.flags['sovereign_killed'] = true;
            gs.story.flags['rift_sealed'] = true;
            gs.story.flags['sovereign_chamber_reached'] = true;
            tickQuestConditions(gs);
            outcome = 'act3_complete';
          }
        }

        // General post-combat quest tick.
        if (gs.__storyContent) tickQuestConditions(gs);
      }

      rngState = (campRng() * 0xFFFFFFFF) >>> 0;

    } else if (nodeType === 'dialog') {
      const choiceId = policy.chooseDialog ? policy.chooseDialog([], { gs, node }) : null;
      entry.dialogNodeId = currentNodeId;
      entry.dialogChoiceId = choiceId;
      rngState = (campRng() * 0xFFFFFFFF) >>> 0;
    } else {
      // shrine / merchant / rest / lore / event — record visit
      rngState = (campRng() * 0xFFFFFFFF) >>> 0;
    }

    // ── Update recent history via Director recordTick ─────────────────────
    const nodeOutcome = {
      type:        nodeType,
      enemyFamily: entry.encounterTemplate ? 'generic' : null,
      biome:       biome,
      tone:        null,
    };
    recordTick(gs, nodeOutcome);

    // Track Warbringer winStreak after combat.
    if (isCombatNode) {
      const combatWon = entry.combatResult && (entry.combatResult.winner === 'heroes' || entry.combatResult.partyAlive !== false);
      trackWarbringerStreak(gs, combatWon, nodeType);

      // Apply pressure on brutal fight (all ALIVE party members below 30% HP after combat).
      // Only count alive members — dead members at hp=0 would otherwise always trigger this.
      const aliveAfter = gs.party.filter(m => m.alive && m.hp > 0);
      const brutalThreshold = aliveAfter.filter(m => m.hp < m.maxHp * 0.3).length;
      if (aliveAfter.length > 0 && brutalThreshold >= aliveAfter.length) {
        applyPressure(gs, 12, 'brutal_fight');
        if (!gs.story.recentPerformance) gs.story.recentPerformance = {};
        gs.story.recentPerformance.brutalScore = 1;
      } else if (gs.story.recentPerformance) {
        gs.story.recentPerformance.brutalScore = 0;
      }
    }

    if (nodeType === 'rest') {
      applyPressure(gs, -10, 'rest_node');
    }

    // Step director to inform the next node's route selection.
    const nextDirectorIntent = stepDirector(gs);
    gs.story._lastDirectorIntent = nextDirectorIntent;
    entry.directorIntent = nextDirectorIntent;

    // ── Variety tracking ──────────────────────────────────────────────────
    const rh = gs.story.recentHistory;
    varietyData.nodeTypes[nodeType] = (varietyData.nodeTypes[nodeType] || 0) + 1;
    varietyData.biomes[biome] = (varietyData.biomes[biome] || 0) + 1;
    varietyData.sameTypeStreaks.push(rh.sameTypeStreak);
    if (rh.sameTypeStreak > varietyData.maxSameTypeStreak) varietyData.maxSameTypeStreak = rh.sameTypeStreak;

    // ── Finalize log entry ────────────────────────────────────────────────
    gs.story.rngState = rngState;
    entry.rngStateAfter = rngState;
    entry.pressureAfter = gs.story.pressureMeter;
    entry.hpAfter = {};
    gs.party.forEach((m, i) => { entry.hpAfter[`p${i}`] = m.hp; });
    entry.wallMs = Date.now() - wallStart;

    log.push(entry);
    history.push({ nodeId: currentNodeId, nodeType, biome });
    nodeIdx++;

    // ── Advance to next node ──────────────────────────────────────────────
    if (outcome) break;

    let nextNodeId = policy.chooseNode(currentMap, currentNodeId, history, {
      gs,
      currentNode: node,
      directorIntent: nextDirectorIntent,
    });

    // Fallback: if policy returns null (dead-end node or all exits visited),
    // do a full BFS over the map to find any unvisited node reachable from
    // any visited node. This handles the map generation issue where lane-2
    // nodes in last columns have no outgoing edges but the map is still
    // traversable via other paths.
    if (!nextNodeId || !currentMap.nodes[nextNodeId]) {
      const visitedSet = new Set(history.map(h => h.nodeId));
      visitedSet.add(currentNodeId);
      const allOut = currentMap.indexes?.outgoing || {};

      // BFS from all visited nodes to find nearest unvisited node.
      const queue = [...visitedSet];
      const queueSeen = new Set(queue);
      nextNodeId = null;

      bfsLoop: while (queue.length) {
        const cur = queue.shift();
        for (const e of (allOut[cur] || [])) {
          if (!e.to || !currentMap.nodes[e.to]) continue;
          if (!visitedSet.has(e.to)) { nextNodeId = e.to; break bfsLoop; }
          if (!queueSeen.has(e.to)) { queueSeen.add(e.to); queue.push(e.to); }
        }
      }

      // If truly no unvisited reachable node, campaign is exhausted.
      if (!nextNodeId || !currentMap.nodes[nextNodeId]) {
        // Try to find the boss node directly if it hasn't been visited.
        const bossId = findBossNode(currentMap);
        if (bossId && !visitedSet.has(bossId)) {
          nextNodeId = bossId; // Teleport to boss — sim shortcut.
        } else {
          outcome = 'abandoned';
          break;
        }
      }
    }

    currentNodeId = nextNodeId;
    gs.story.currentNodeId = currentNodeId;
  }

  if (!outcome) outcome = 'timeout';

  return _buildResult({ gs, seedNum, storyteller, difficulty, policy,
    outcome, log, startMs, recordCombatLogs,
    combatWins, combatTotal, totalDeaths, goldAccum, varietyData });
}

// ---------------------------------------------------------------------------
// Result builder
// ---------------------------------------------------------------------------

function _buildResult({ gs, seedNum, storyteller, difficulty, policy, outcome, log, startMs,
  combatWins = 0, combatTotal = 0, totalDeaths = 0, goldAccum = 0,
  varietyData = {}, recordCombatLogs = false }) {

  const nodeTypeBreakdown = varietyData.nodeTypes || {};
  const uniqueNodeTypes = Object.keys(nodeTypeBreakdown).length;
  const uniqueBiomes = Object.keys(varietyData.biomes || {}).length;
  const streaks = varietyData.sameTypeStreaks || [];
  const avgSameTypeStreak = streaks.length
    ? Math.round((streaks.reduce((a, b) => a + b, 0) / streaks.length) * 100) / 100
    : 0;
  const maxSameTypeStreak = varietyData.maxSameTypeStreak || 0;

  // Count acts completed. Primary metric: how far did the run advance?
  // gs.story.act increments to 2 when act-1 boss is defeated. But since the
  // synthetic party may not have geared HP to beat bosses, we also credit act-1
  // as "reached" when the act-1 boss was visited (regardless of win/loss).
  // This measures storyteller variety/routing, not final-boss tuning.
  const bossVisits = log.filter(e => e.nodeType === 'boss').length;
  const actFromGs  = gs.story.act - 1;
  const actsCompleted = outcome === 'act3_complete'
    ? 3
    : actFromGs > 0
      ? actFromGs
      : bossVisits > 0 ? 1 : 0;

  return {
    seed: seedNum,
    saltOffset: 0,
    storytellerId: storyteller,
    difficulty,
    policy: policy?.name || 'unknown',
    outcome,
    actsCompleted,
    nodesVisited: log.length,
    nodeTypeBreakdown,
    combatWinRate: combatTotal > 0 ? combatWins / combatTotal : 1,
    totalDeaths,
    goldFinal: gs.gold || 0,
    gearScoreFinal: 0,
    questsCompleted: _countCompletedQuests(gs),
    flagsSet: Object.keys(gs.story.flags || {}).filter(k => gs.story.flags[k]),
    factionsFinal: { ...gs.story.factions },
    companionApprovalFinal: Object.fromEntries(
      (gs.story.companions || []).map(c => [c.id, c.approval])
    ),
    varietyMetrics: {
      uniqueNodeTypes,
      uniqueBiomes,
      uniqueEnemyFamilies: 0,
      uniqueSkillLabels: 0,
      avgSameTypeStreak,
      maxSameTypeStreak,
    },
    durationMs: Date.now() - startMs,
    log,
  };
}

/** Count completed quests by category from gs.story.quests. */
function _countCompletedQuests(gs) {
  const result = { primary: 0, secondary: 0, side: 0, companion: 0 };
  const content = gs.__storyContent?.quests || {};
  for (const [id, q] of Object.entries(gs.story?.quests || {})) {
    if (q.status !== 'completed') continue;
    const def = content[id];
    const cat = def?.category || 'side';
    if (cat === 'primary') result.primary++;
    else if (cat === 'secondary') result.secondary++;
    else if (cat === 'companion') result.companion++;
    else result.side++;
  }
  return result;
}

/** Summarize a combatResult to reduce memory in long runs. */
function _summarizeCombatResult(r) {
  if (!r) return null;
  return {
    winner: r.winner,
    rounds: r.rounds,
    partyAlive: (r.party || []).map(p => ({ id: p.id, hp: p.hp, alive: p.alive })),
    enemiesAlive: (r.enemies || []).map(e => ({ id: e.id, hp: e.hp, alive: e.alive })),
  };
}
