export const STORY_VERSION = 1;

export const QUEST_STATUS = Object.freeze({
  INACTIVE: 'inactive',
  ACTIVE: 'active',
  COMPLETE: 'complete',
  FAILED: 'failed',
});

export const STORYTELLERS = Object.freeze([
  { id: 'chronicler', name: 'The Chronicler', mechanic: 'Archive bonuses reward varied routes.' },
  { id: 'ash_prophet', name: 'The Ash Prophet', mechanic: 'Omens bend future encounters.' },
  { id: 'warbringer', name: 'The Warbringer', mechanic: 'Win streaks raise battlefield pressure.' },
  { id: 'trickster', name: 'The Trickster', mechanic: 'Every sixth turn can twist the route.' },
  { id: 'pilgrim', name: 'The Pilgrim', mechanic: 'Discovery rewards favor scouting.' },
  { id: 'iron_judge', name: 'The Iron Judge', mechanic: 'No fallback mercy on failed gambits.' },
]);

export const COMPANION_ROSTER = Object.freeze([
  { id: 'lyra_ashwalker', name: 'Lyra Ashwalker', classId: 'ranger', recruitAct: 1, personalQuestId: 'companion_lyra_personal' },
  { id: 'orren_gravetide', name: 'Orren Gravetide', classId: 'warrior', recruitAct: 1, personalQuestId: 'companion_orren_personal' },
  { id: 'tessaly_veil', name: 'Tessaly Veil', classId: 'rogue', recruitAct: 2, personalQuestId: 'companion_tessaly_personal' },
  { id: 'bram_coldfire', name: 'Bram Coldfire', classId: 'mage', recruitAct: 2, personalQuestId: 'companion_bram_personal' },
  { id: 'yasha_stonewill', name: 'Yasha Stonewill', classId: 'monk', recruitAct: 2, personalQuestId: 'companion_yasha_personal' },
  { id: 'captain_maer', name: 'Captain Maer', classId: 'warrior', recruitAct: 1, personalQuestId: 'companion_maer_personal' },
]);

export function createDefaultStoryLedger(opts = {}) {
  const campaignSeed = String(opts.campaignSeed || opts.seed || makeSeed());
  return {
    storyVersion: STORY_VERSION,
    campaignSeed,
    saltOffset: 0,
    storytellerId: normalizeStoryteller(opts.storytellerId),
    difficulty: opts.difficulty || 'normal',
    versions: { ledger: STORY_VERSION, predicate: 1, effects: 1 },
    act: 1,
    currentMapId: 'act1_emberfall_road',
    currentNodeId: 'story_start',
    rngState: hashString(campaignSeed),
    flags: {},
    counters: {},
    factions: {},
    quests: {},
    dialogHistory: {},
    loreDiscovered: [],
    worldMutations: [],
    worldCorruption: 0,
    bossHistory: [],
    maps: {},
    encounterHistory: [],
    recentHistory: {
      nodeIds: [],
      nodeTypes: [],
      outcomes: [],
      storytellerEvents: [],
      winStreak: 0,
      lossStreak: 0,
    },
    pressureMeter: 0,
    companions: COMPANION_ROSTER.map(c => ({
      id: c.id,
      name: c.name,
      classId: c.classId,
      personalQuestId: c.personalQuestId,
      recruited: false,
      active: false,
      alive: true,
      benchedAt: null,
      approval: 0,
      personalQuestStatus: QUEST_STATUS.INACTIVE,
    })),
    activeCompanionId: null,
    rumorPool: [],
    pendingTolls: [],
    pendingEncounters: [],
    pendingMapMutations: [],
    lastUndoableChoice: null,
    campaignStartDate: new Date().toISOString(),
    lastSaveDate: new Date().toISOString(),
  };
}

export const MIGRATIONS = {
  1(save) {
    const story = save.story || {};
    save.story = {
      ...createDefaultStoryLedger({
        campaignSeed: story.campaignSeed,
        storytellerId: story.storytellerId,
        difficulty: story.difficulty,
      }),
      ...story,
      storyVersion: STORY_VERSION,
      recentHistory: normalizeRecentHistory(story.recentHistory),
      pressureMeter: clampInt(story.pressureMeter, 0, 100),
      worldCorruption: clampInt(story.worldCorruption, 0, 100),
    };
    save.storyVersion = STORY_VERSION;
    return save;
  },
};

export function migrateStorySave(save) {
  if (!save || save.gameMode !== 'story') return save;
  let next = { ...save, story: { ...(save.story || {}) } };
  const version = Number(next.storyVersion || next.story?.storyVersion || 0);
  for (let v = version + 1; v <= STORY_VERSION; v++) {
    if (MIGRATIONS[v]) next = MIGRATIONS[v](next);
  }
  if (version >= STORY_VERSION) next = MIGRATIONS[STORY_VERSION](next);
  return next;
}

export function normalizeStoryteller(id) {
  return STORYTELLERS.some(s => s.id === id) ? id : STORYTELLERS[0].id;
}

export function hashString(input) {
  let h = 2166136261 >>> 0;
  const s = String(input || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h || 0x9e3779b9;
}

export function rngFromState(state) {
  let t = Number(state) >>> 0;
  return function next() {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function nextRngState(state, salt = '') {
  return (hashString(`${Number(state) >>> 0}:${salt}`) + 0x6D2B79F5) >>> 0;
}

export function nodeRng(gs, nodeId) {
  const story = requireStory(gs);
  return rngFromState((story.rngState ^ hashString(nodeId)) >>> 0);
}

export function commitRng(gs, salt = '') {
  const story = requireStory(gs);
  story.rngState = nextRngState(story.rngState, salt);
  story.lastSaveDate = new Date().toISOString();
  return story.rngState;
}

export function recordTick(gs, outcome = {}) {
  const h = requireStory(gs).recentHistory = normalizeRecentHistory(requireStory(gs).recentHistory);
  pushLimited(h.nodeIds, outcome.nodeId, 20);
  pushLimited(h.nodeTypes, outcome.nodeType, 20);
  pushLimited(h.outcomes, outcome.outcomeId || outcome.result, 20);
  if (outcome.storytellerEvent) pushLimited(h.storytellerEvents, outcome.storytellerEvent, 20);
  if (outcome.combatResult === 'win') {
    h.winStreak += 1;
    h.lossStreak = 0;
  } else if (outcome.combatResult === 'loss') {
    h.lossStreak += 1;
    h.winStreak = 0;
  }
  return h;
}

export function requireStory(gs) {
  if (!gs || !gs.story) throw new Error('Story state is required.');
  return gs.story;
}

export function clampInt(value, min, max) {
  const n = Math.trunc(Number(value) || 0);
  return Math.max(min, Math.min(max, n));
}

export function uniquePush(arr, value) {
  if (!Array.isArray(arr) || value == null) return arr;
  if (!arr.includes(value)) arr.push(value);
  return arr;
}

function normalizeRecentHistory(value) {
  const v = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    nodeIds: Array.isArray(v.nodeIds) ? [...v.nodeIds] : [],
    nodeTypes: Array.isArray(v.nodeTypes) ? [...v.nodeTypes] : [],
    outcomes: Array.isArray(v.outcomes) ? [...v.outcomes] : [],
    storytellerEvents: Array.isArray(v.storytellerEvents) ? [...v.storytellerEvents] : [],
    winStreak: Math.max(0, Math.trunc(Number(v.winStreak) || 0)),
    lossStreak: Math.max(0, Math.trunc(Number(v.lossStreak) || 0)),
  };
}

function pushLimited(arr, value, limit) {
  if (value == null) return;
  arr.push(value);
  while (arr.length > limit) arr.shift();
}

function makeSeed() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch (_) {}
  return `story_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
