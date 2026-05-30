import { hashString, rngFromState } from './storyLedger.js';
import { buildIndexes, createMapSave, syncRegionVisibility } from './storyMapGraph.js';
import { runMapValidators } from './storyMapValidator.js';

const ACT_REGIONS = {
  1: [
    { id: 'emberwood', name: 'Emberwood', biome: 'emberwood' },
    { id: 'stoneward', name: 'Stoneward Rise', biome: 'stoneward' },
    { id: 'fen', name: 'Lantern Fen', biome: 'fen' },
    { id: 'old_road', name: 'The Old Road', biome: 'old_road' },
    { id: 'gloomridge', name: 'Gloomridge', biome: 'gloomridge' },
  ],
  2: [
    { id: 'veilscar', name: 'Veilscar', biome: 'veilscar' },
    { id: 'plague_fen', name: 'Plague Fen', biome: 'plague_fen' },
    { id: 'ash_plains', name: 'Ash Plains', biome: 'ash_plains' },
    { id: 'library_ruins', name: 'Library Ruins', biome: 'library_ruins' },
    { id: 'crossroads', name: 'Crossroads', biome: 'crossroads' },
  ],
  3: [
    { id: 'riftgate', name: 'Riftgate', biome: 'riftgate' },
    { id: 'architects_verge', name: "Architect's Verge", biome: 'architects_verge' },
    { id: 'ember_hollow', name: 'Ember Hollow', biome: 'ember_hollow' },
    { id: 'sovereigns_approach', name: "Sovereign's Approach", biome: 'sovereigns_approach' },
  ],
};

const NODE_DISTS = {
  emberwood: { combat: 0.4, dialog: 0.22, shrine: 0.08, lore: 0.1, merchant: 0.06, rest: 0.08, event: 0.06 },
  default: { combat: 0.42, dialog: 0.18, shrine: 0.08, lore: 0.1, merchant: 0.06, rest: 0.08, event: 0.08 },
};

const LOCK_POOLS = {
  1: ['lantern_fen_bell', 'stoneward_oath', 'emberwood_scout', 'gloomridge_rune'],
  2: ['veilscar_antidote', 'library_index', 'ash_plains_signal'],
  3: ['riftgate_key', 'architect_cipher', 'sovereign_brand'],
};

export function generateAct(opts = {}) {
  const act = Number(opts.act || 1);
  const seed = String(opts.seed || opts.campaignSeed || 'story');
  for (let attempt = 0; attempt < 10; attempt++) {
    const graph = buildGraph({ seed, act, salt: Number(opts.salt || 0) + attempt });
    const results = runMapValidators(graph);
    if (results.every(r => r.ok)) {
      const mapSave = syncRegionVisibility(graph, createMapSave(graph));
      return { graph, mapSave, validators: results, usedSafetyNet: false };
    }
  }
  const graph = buildGraph({ seed: `${seed}:safety`, act, salt: 999 });
  const mapSave = syncRegionVisibility(graph, createMapSave(graph));
  return { graph, mapSave, validators: runMapValidators(graph), usedSafetyNet: true };
}

export function regenerateFromSave(story, mapId = story.currentMapId) {
  const saved = story.maps?.[mapId];
  const act = saved?.act || story.act || 1;
  const salt = saved?.salt || story.saltOffset || 0;
  const generated = generateAct({ seed: story.campaignSeed, act, salt });
  const graph = generated.graph;
  if (!saved) return generated;
  return { graph, mapSave: syncRegionVisibility(graph, saved), validators: runMapValidators(graph), usedSafetyNet: false };
}

function buildGraph({ seed, act, salt }) {
  const rng = rngFromState(hashString(`${seed}:${act}:${salt}:map`) ^ 0xDEADBEEF);
  const regions = ACT_REGIONS[act] || ACT_REGIONS[1];
  const nodes = {};
  const edges = [];
  const subRegions = [];
  const lockSatisfiers = {};

  regions.forEach((regionDef, regionIndex) => {
    const cols = act === 3 ? randInt(rng, 4, 5) : randInt(rng, 3, 4);
    const lanes = 3;
    const regionId = `act${act}_${regionDef.id}`;
    const nodeIds = [];
    for (let col = 0; col < cols; col++) {
      for (let lane = 0; lane < lanes; lane++) {
        if (!(regionIndex === 0 && col === 0) && col === 0 && lane !== 1 && rng() < 0.2) continue;
        if (col === cols - 1 && lane !== 1 && rng() < 0.25) continue;
        const id = `${regionId}_c${col}_l${lane}`;
        const tags = [];
        if (regionIndex === 0 && col === 0 && lane === 1) tags.push('entry');
        if (col === Math.floor(cols / 2) && lane === ((regionIndex + act) % 3)) tags.push('waypoint');
        const isBoss = regionIndex === regions.length - 1 && col === cols - 1 && lane === 1;
        if (isBoss) tags.push('boss', 'quest_critical');
        const forcedOpeningDialog = regionIndex === 0 && col === 0 && lane !== 1;
        nodes[id] = {
          id,
          act,
          biome: regionDef.biome,
          regionId,
          regionIndex,
          lane,
          col,
          x: col / Math.max(1, cols - 1),
          y: lane / 2,
          type: isBoss ? 'boss' : forcedOpeningDialog ? 'dialog' : pickType(rng, regionDef.biome),
          tags,
          baseWeight: 1,
        };
        nodeIds.push(id);
      }
    }
    subRegions.push({ id: regionId, name: regionDef.name, biome: regionDef.biome, nodeIds, xOffset: regionIndex });
    connectRegion(nodes, edges, nodeIds, cols, rng);
    const firstCol = nodeIds.filter(id => nodes[id].col === 0);
    const entry = firstCol.find(id => nodes[id].lane === 1) || firstCol[0];
    for (const id of firstCol) if (id !== entry) addEdge(edges, entry, id, 'open');
  });

  for (let i = 0; i < subRegions.length - 1; i++) {
    const left = subRegions[i].nodeIds.filter(id => nodes[id].col === maxCol(nodes, subRegions[i].nodeIds));
    const right = subRegions[i + 1].nodeIds.filter(id => nodes[id].col === 0);
    const count = Math.min(randInt(rng, 1, 3), left.length, right.length);
    for (let n = 0; n < count; n++) {
      addEdge(edges, pick(rng, left), pick(rng, right), 'open');
    }
    for (const id of right) addEdge(edges, pick(rng, left), id, 'open');
  }

  addHiddenEdges(nodes, edges, subRegions, LOCK_POOLS[act] || LOCK_POOLS[1], lockSatisfiers, rng);

  const entryNodeId = subRegions[0].nodeIds.find(id => nodes[id].tags.includes('entry'));
  const bossNodeId = Object.values(nodes).find(n => n.tags.includes('boss'))?.id;
  return buildIndexes({
    mapId: `act${act}_story_map`,
    act,
    salt,
    subRegions,
    nodes,
    edges,
    entryNodeId,
    bossNodeId,
    lockSatisfiers,
  });
}

function connectRegion(nodes, edges, nodeIds, cols, rng) {
  for (let col = 0; col < cols - 1; col++) {
    const froms = nodeIds.filter(id => nodes[id].col === col);
    const tos = nodeIds.filter(id => nodes[id].col === col + 1);
    for (const from of froms) {
      const same = tos.find(id => nodes[id].lane === nodes[from].lane) || pick(rng, tos);
      addEdge(edges, from, same, 'open');
      if (rng() < 0.6) addEdge(edges, from, pick(rng, tos), 'open');
    }
  }
}

function addHiddenEdges(nodes, edges, subRegions, locks, lockSatisfiers, rng) {
  for (const region of subRegions) {
    const ids = region.nodeIds;
    const hiddenCount = Math.max(1, Math.floor(ids.length * 0.1));
    for (let i = 0; i < hiddenCount; i++) {
      const from = pick(rng, ids.filter(id => nodes[id].col < maxCol(nodes, ids)));
      const candidates = ids.filter(id => nodes[id].col > nodes[from].col);
      const to = pick(rng, candidates);
      if (!from || !to) continue;
      const lockId = pick(rng, locks);
      lockSatisfiers[lockId] = `story.flags.reveal_${lockId}`;
      addEdge(edges, from, to, 'hidden', lockId);
    }
  }
}

function pickType(rng, biome) {
  const dist = NODE_DISTS[biome] || NODE_DISTS.default;
  let roll = rng();
  for (const [type, weight] of Object.entries(dist)) {
    roll -= weight;
    if (roll <= 0) return type;
  }
  return 'event';
}

function addEdge(edges, from, to, kind, lockId) {
  if (!from || !to || from === to) return;
  if (edges.some(edge => edge.from === from && edge.to === to)) return;
  edges.push({ id: `${from}__${to}`, from, to, kind, ...(lockId ? { lockId } : {}) });
}

function maxCol(nodes, ids) {
  return Math.max(...ids.map(id => nodes[id].col));
}

function pick(rng, arr) {
  if (!arr.length) return null;
  return arr[Math.floor(rng() * arr.length)];
}

function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}
