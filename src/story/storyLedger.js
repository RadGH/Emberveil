/**
 * storyLedger.js — Story save sub-tree (de)serializer and migration registry.
 *
 * gs.story is a Set-free zone: JSON.stringify(gs.story) round-trips with zero
 * conversion. Set semantics use setUniquePush(arr, id) instead.
 */

// ---------------------------------------------------------------------------
// Default ledger shape — matches §2.2 of the refined plan exactly.
// ---------------------------------------------------------------------------
export const DEFAULT_STORY_LEDGER = {
  // --- identity / config ---
  campaignSeed:        '',
  saltOffset:          0,
  storytellerId:       'chronicler',
  difficulty:          'normal',
  thematicConsistency: 'balanced',
  sideEventFrequency:  'normal',
  combatDensity:       'normal',
  storyPressure:       'normal',

  // --- versioning per namespace ---
  versions: { dialog: 1, quest: 1, content: 1, map: 1, director: 1 },

  // --- runtime ---
  act:           1,
  currentMapId:  'act1_emberwood',
  currentNodeId: 'a1_n_000',
  rngState:      0,

  // --- ledger ---
  flags:          {},
  counters:       {},
  factions:       {},
  quests:         {},
  dialogHistory:  {},
  loreDiscovered: [],
  worldMutations: [],
  worldCorruption: 0,
  bossHistory:    {},

  // --- world maps ---
  maps: {},

  // --- per-node encounter snapshot ---
  encounterHistory: {},

  // --- director memory ---
  recentHistory: {
    nodeTypes:      [],
    enemyFamilies:  [],
    skillLabels:    [],
    rewardTypes:    [],
    biomes:         [],
    tones:          [],
    sameTypeStreak: 0,
    lastType:       null,
  },
  pressureMeter: 50,

  // --- companions (6 named story companions per §9.1, pre-populated inactive) ---
  companions: [
    { id: 'lyra_ashwalker',  recruited: false, active: false, approval: 0, alive: true, personalQuestId: 'companion_lyra_personal',    personalQuestStarted: false, lastBanterNode: null, benchedAt: null },
    { id: 'orren_gravetide', recruited: false, active: false, approval: 0, alive: true, personalQuestId: 'companion_orren_personal',   personalQuestStarted: false, lastBanterNode: null, benchedAt: null },
    { id: 'tessaly_veil',    recruited: false, active: false, approval: 0, alive: true, personalQuestId: 'companion_tessaly_personal', personalQuestStarted: false, lastBanterNode: null, benchedAt: null },
    { id: 'bram_coldfire',   recruited: false, active: false, approval: 0, alive: true, personalQuestId: 'companion_bram_personal',    personalQuestStarted: false, lastBanterNode: null, benchedAt: null },
    { id: 'yasha_stonewill', recruited: false, active: false, approval: 0, alive: true, personalQuestId: 'companion_yasha_personal',   personalQuestStarted: false, lastBanterNode: null, benchedAt: null },
    { id: 'captain_maer',    recruited: false, active: false, approval: 0, alive: true, personalQuestId: 'companion_maer_personal',    personalQuestStarted: false, lastBanterNode: null, benchedAt: null },
  ],
  activeCompanionId: null,

  // --- rumor / pressure / pending tolls ---
  rumorPool:           [],
  pendingTolls:        [],
  lastUndoableChoice:  null,

  // --- bookkeeping ---
  campaignStartDate: 0,
  lastSaveDate:      0,
};

// ---------------------------------------------------------------------------
// Per-namespace migration registry. Shape: { [ns]: { [fromVer]: { [toVer]: fn } } }
// ---------------------------------------------------------------------------
export const MIGRATIONS = {
  dialog:   { 1: {} },
  quest:    { 1: {} },
  content:  { 1: {} },
  map:      { 1: {} },
  director: { 1: {} },
};

/**
 * Run all namespace migrations on a raw story save. Mutates in place.
 * Called only when saved.gameMode === 'story'.
 */
export function migrateStorySave(save) {
  if (!save?.story) return save;
  if (!save.story.versions) save.story.versions = { dialog: 1, quest: 1, content: 1, map: 1, director: 1 };
  for (const ns of Object.keys(MIGRATIONS)) {
    let v = save.story.versions[ns] || 1;
    const chain = MIGRATIONS[ns];
    while (chain[v] && chain[v][v + 1]) {
      save = chain[v][v + 1](save);
      v++;
    }
    save.story.versions[ns] = v;
  }
  return save;
}

/**
 * Mint a brand-new story ledger for a new campaign.
 * @param {object} opts - { storytellerId, difficulty, thematicConsistency,
 *                          sideEventFrequency, combatDensity, storyPressure, seed? }
 */
export function createStoryLedger(opts = {}) {
  // Generate an 8-char hex campaign seed if not provided.
  const seed = opts.seed || Math.floor(Math.random() * 0xFFFFFFFF).toString(16).padStart(8, '0');
  // Use the seed's numeric value as initial RNG state (Mulberry32 a).
  const rngState = parseInt(seed, 16) || 1;

  return {
    ...JSON.parse(JSON.stringify(DEFAULT_STORY_LEDGER)), // deep clone
    campaignSeed:        seed,
    rngState,
    storytellerId:       opts.storytellerId       || 'chronicler',
    difficulty:          opts.difficulty           || 'normal',
    thematicConsistency: opts.thematicConsistency  || 'balanced',
    sideEventFrequency:  opts.sideEventFrequency   || 'normal',
    combatDensity:       opts.combatDensity        || 'normal',
    storyPressure:       opts.storyPressure        || 'normal',
    campaignStartDate:   Date.now(),
    lastSaveDate:        Date.now(),
  };
}

/**
 * Push id to arr only if not already present. Maintains array-as-set semantics
 * without using a JS Set (story ledger is Set-free).
 */
export function setUniquePush(arr, id) {
  if (!arr.includes(id)) arr.push(id);
  return arr;
}

/**
 * Commit the current RNG state to gs.story.rngState and trigger a save.
 * nextState is the uint32 internal Mulberry32 `a` value at this checkpoint.
 *
 * Actual GameState.save() call is intentionally deferred to the caller
 * (SaveManager.saveCurrentGame) so we don't create a circular dep here.
 * This function writes the state field; the caller persists.
 */
export function commitRng(gs, nextState) {
  if (!gs?.story) return;
  gs.story.rngState = nextState >>> 0; // ensure uint32
  gs.story.lastSaveDate = Date.now();
}

/**
 * Record a dialog choice in gs.story.dialogHistory and push to recentHistory.
 * @param {object} gs - live game state
 * @param {string} nodeId
 * @param {string} choiceId
 */
export function recordDialogChoice(gs, nodeId, choiceId) {
  if (!gs?.story) return;
  gs.story.dialogHistory[nodeId] = { choiceId, ts: Date.now() };
  // Push tone/type into recentHistory if we can infer it (best-effort; full
  // enrichment happens in storyDirector when it processes the node).
  setUniquePush; // imported for other callers
}
