/**
 * storyStorytellers.js — 6 storyteller profile objects + unique mechanic hooks.
 *
 * Profiles are also mirrored to data/story/storytellers/*.json for moddability.
 * This module loads from JSON if present (Node environment); falls back to
 * inline definitions so the browser bundle works without filesystem access.
 *
 * Unique mechanics (§7.5):
 *   chronicler   — narrative_coherence_bonus   (after 3-consecutive themeTag streak)
 *   ash_prophet  — dark_omen_interrupt          (every 8-12 ticks, forced omen)
 *   warbringer   — momentum_escalation          (winStreak counter)
 *   trickster    — every_6th_random             (6th decision skips soft scoring)
 *   pilgrim      — discovery_pool_3x            (lore/hidden baseWeight ×3)
 *   iron_judge   — no_fallback_ambush_instead   (filter empty → synthesize ambush)
 */

// ---------------------------------------------------------------------------
// Inline profile registry (authoritative definitions, identical to JSON files)
// ---------------------------------------------------------------------------
const STORYTELLER_PROFILES = {
  chronicler: {
    id: 'chronicler',
    displayName: 'The Chronicler',
    bio: 'Weaves consistent narrative threads across the campaign. Rewards players who follow a thematic arc with coherence bonuses.',
    portraitImage: 'images/openai_v2/storyteller_chronicler_portrait.png',
    preferredThemes: ['lore', 'investigation', 'faction', 'memory'],
    combatFrequency: 0.45,
    skillCheckVariety: 0.6,
    thematicConsistency: 0.85,
    pressureBias: 0.0,
    rules: {
      maxSameTypeStreak: 2,
      minNodesBetweenBosses: 25,
      forceRestAfterBrutalFight: true,
      fallbackAllowed: true,
    },
    uniqueMechanic: 'narrative_coherence_bonus',
  },

  ash_prophet: {
    id: 'ash_prophet',
    displayName: 'The Ash Prophet',
    bio: 'Speaks in omens. The road ahead is always shadowed by dark portents that interrupt the expected path.',
    portraitImage: 'images/openai_v2/storyteller_ash_prophet_portrait.png',
    preferredThemes: ['omen', 'ash', 'prophecy', 'doom'],
    combatFrequency: 0.55,
    skillCheckVariety: 0.5,
    thematicConsistency: 0.7,
    pressureBias: 0.2,
    rules: {
      maxSameTypeStreak: 3,
      minNodesBetweenBosses: 20,
      forceRestAfterBrutalFight: true,
      fallbackAllowed: true,
    },
    uniqueMechanic: 'dark_omen_interrupt',
  },

  warbringer: {
    id: 'warbringer',
    displayName: 'The Warbringer',
    bio: 'Victory builds on victory. A win streak escalates the danger — and the rewards — with each consecutive combat triumph.',
    portraitImage: 'images/openai_v2/storyteller_warbringer_portrait.png',
    preferredThemes: ['combat', 'glory', 'ambush', 'siege'],
    combatFrequency: 0.7,
    skillCheckVariety: 0.4,
    thematicConsistency: 0.6,
    pressureBias: 0.15,
    rules: {
      maxSameTypeStreak: 4,
      minNodesBetweenBosses: 15,
      forceRestAfterBrutalFight: false,
      fallbackAllowed: true,
    },
    uniqueMechanic: 'momentum_escalation',
  },

  trickster: {
    id: 'trickster',
    displayName: 'The Trickster',
    bio: 'Embraces chaos. Every sixth decision ignores soft scoring entirely and picks from the unfiltered eligible set.',
    portraitImage: 'images/openai_v2/storyteller_trickster_portrait.png',
    preferredThemes: ['chaos', 'surprise', 'mystery', 'trick'],
    combatFrequency: 0.5,
    skillCheckVariety: 0.85,
    thematicConsistency: 0.4,
    pressureBias: 0.0,
    rules: {
      maxSameTypeStreak: 3,
      minNodesBetweenBosses: 20,
      forceRestAfterBrutalFight: false,
      fallbackAllowed: true,
    },
    uniqueMechanic: 'every_6th_random',
  },

  pilgrim: {
    id: 'pilgrim',
    displayName: 'The Pilgrim',
    bio: 'Seeks hidden truths. Lore and hidden nodes are three times as likely to appear, and rest events grant extra healing.',
    portraitImage: 'images/openai_v2/storyteller_pilgrim_portrait.png',
    preferredThemes: ['lore', 'hidden', 'discovery', 'ancient'],
    combatFrequency: 0.35,
    skillCheckVariety: 0.7,
    thematicConsistency: 0.7,
    pressureBias: -0.1,
    rules: {
      maxSameTypeStreak: 2,
      minNodesBetweenBosses: 28,
      forceRestAfterBrutalFight: true,
      fallbackAllowed: true,
    },
    uniqueMechanic: 'discovery_pool_3x',
  },

  iron_judge: {
    id: 'iron_judge',
    displayName: 'The Iron Judge',
    bio: 'There is no mercy on the road. If the filter yields nothing, an ambush is synthesized — there is no safe fallback.',
    portraitImage: 'images/openai_v2/storyteller_iron_judge_portrait.png',
    preferredThemes: ['combat', 'judgment', 'punishment', 'trial'],
    combatFrequency: 0.6,
    skillCheckVariety: 0.5,
    thematicConsistency: 0.75,
    pressureBias: 0.25,
    rules: {
      maxSameTypeStreak: 3,
      minNodesBetweenBosses: 18,
      forceRestAfterBrutalFight: false,
      fallbackAllowed: false,
    },
    uniqueMechanic: 'no_fallback_ambush_instead',
  },
};

// Dark-omen pool for Ash Prophet (expanded M515 — 7 varied entries)
const DARK_OMEN_POOL = [
  {
    id: 'omen_veil_whisper',
    type: 'event',
    themeTags: ['omen', 'ash'],
    baseWeight: 1,
    effects: [
      { type: 'pressure', amount: 10 },
      { type: 'set_flag', flag: 'omen_witnessed' },
    ],
  },
  {
    id: 'omen_ashen_tide',
    type: 'event',
    themeTags: ['omen', 'ash', 'doom'],
    baseWeight: 1,
    effects: [
      { type: 'pressure', amount: 15 },
      { type: 'corruption', amount: 8 },
      { type: 'set_flag', flag: 'omen_ashen_tide_seen' },
    ],
  },
  {
    id: 'omen_ember_extinction',
    type: 'event',
    themeTags: ['omen', 'prophecy', 'doom'],
    baseWeight: 1,
    effects: [
      { type: 'faction_delta', faction: 'emberguard', amount: -2 },
      { type: 'lore_unlock', loreId: 'lore_veil_older_than_kingdom' },
      { type: 'set_flag', flag: 'omen_ember_extinction_seen' },
    ],
  },
  {
    id: 'omen_shattered_sky',
    type: 'event',
    themeTags: ['omen', 'prophecy', 'ash'],
    baseWeight: 1,
    effects: [
      { type: 'pressure', amount: 8 },
      { type: 'faction_delta', faction: 'ashen_veil', amount: 1 },
      { type: 'set_flag', flag: 'omen_shattered_sky_seen' },
    ],
  },
  {
    id: 'omen_black_water',
    type: 'event',
    themeTags: ['omen', 'ash', 'prophecy'],
    baseWeight: 1,
    effects: [
      { type: 'corruption', amount: 12 },
      { type: 'lore_unlock', loreId: 'lore_rift_not_accident' },
      { type: 'set_flag', flag: 'omen_black_water_seen' },
    ],
  },
  {
    id: 'omen_silent_bells',
    type: 'event',
    themeTags: ['omen', 'doom'],
    baseWeight: 1,
    effects: [
      { type: 'pressure', amount: 12 },
      { type: 'faction_delta', faction: 'thornpact', amount: -1 },
      { type: 'set_flag', flag: 'omen_silent_bells_seen' },
    ],
  },
  {
    id: 'omen_second_shadow',
    type: 'event',
    themeTags: ['omen', 'ash', 'doom'],
    baseWeight: 1,
    effects: [
      { type: 'pressure', amount: 6 },
      { type: 'corruption', amount: 5 },
      { type: 'lore_unlock', loreId: 'lore_sovereign_origin' },
      { type: 'set_flag', flag: 'omen_second_shadow_seen' },
    ],
  },
];

// Iron Judge ambush pool (expanded M515 — 7 varied entries across acts 1/2/3)
const IRON_JUDGE_AMBUSH_POOL = [
  {
    id: '_iron_judge_ambush_synthesized',
    type: 'combat',
    themeTags: ['combat', 'judgment', 'ambush'],
    baseWeight: 1,
    biomes: ['emberwood', 'old_road', 'stoneward'],
    act: [1],
    _synthesized: true,
    enemyComposition: [
      { role: 'frontline', count: 2, family: 'generic' },
    ],
  },
  {
    id: '_iron_judge_ambush_road_thugs',
    type: 'combat',
    themeTags: ['combat', 'ambush', 'punishment'],
    baseWeight: 1,
    biomes: ['old_road', 'crossroads'],
    act: [1, 2],
    _synthesized: true,
    enemyComposition: [
      { role: 'frontline', count: 1, family: 'bandit' },
      { role: 'ranged', count: 2, family: 'bandit' },
    ],
  },
  {
    id: '_iron_judge_ambush_fen_predators',
    type: 'combat',
    themeTags: ['combat', 'trial', 'ambush'],
    baseWeight: 1,
    biomes: ['fen', 'plague_fen'],
    act: [1, 2],
    _synthesized: true,
    enemyComposition: [
      { role: 'frontline', count: 3, family: 'beast' },
    ],
  },
  {
    id: '_iron_judge_ambush_ridge_hunters',
    type: 'combat',
    themeTags: ['combat', 'judgment', 'trial'],
    baseWeight: 1,
    biomes: ['gloomridge', 'stoneward'],
    act: [1, 2],
    _synthesized: true,
    enemyComposition: [
      { role: 'frontline', count: 2, family: 'soldier' },
      { role: 'support', count: 1, family: 'shaman' },
    ],
  },
  {
    id: '_iron_judge_ambush_veil_acolytes',
    type: 'combat',
    themeTags: ['combat', 'punishment', 'judgment'],
    baseWeight: 1,
    biomes: ['veilscar', 'ash_plains'],
    act: [2],
    _synthesized: true,
    enemyComposition: [
      { role: 'ranged', count: 2, family: 'cultist' },
      { role: 'frontline', count: 1, family: 'cultist' },
      { role: 'support', count: 1, family: 'cultist' },
    ],
  },
  {
    id: '_iron_judge_ambush_rift_shades',
    type: 'combat',
    themeTags: ['combat', 'judgment', 'trial'],
    baseWeight: 1,
    biomes: ['riftgate', 'ember_hollow'],
    act: [3],
    _synthesized: true,
    enemyComposition: [
      { role: 'frontline', count: 2, family: 'rift_shade' },
      { role: 'ranged', count: 1, family: 'rift_shade' },
    ],
  },
  {
    id: '_iron_judge_ambush_sovereign_vanguard',
    type: 'combat',
    themeTags: ['combat', 'punishment', 'judgment'],
    baseWeight: 1,
    biomes: ['sovereigns_approach', 'architects_verge'],
    act: [3],
    _synthesized: true,
    enemyComposition: [
      { role: 'frontline', count: 2, family: 'sovereign_guard' },
      { role: 'support', count: 1, family: 'sovereign_guard' },
      { role: 'ranged', count: 1, family: 'sovereign_guard' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get a storyteller profile by id. Returns the inline definition.
 * In a moddable future, this could load from JSON with overrides.
 *
 * @param {string} id
 * @returns {object|null}
 */
export function getStoryteller(id) {
  return STORYTELLER_PROFILES[id] || null;
}

/**
 * All storyteller ids in canonical order.
 */
export const ALL_STORYTELLER_IDS = Object.keys(STORYTELLER_PROFILES);

// ---------------------------------------------------------------------------
// Unique mechanic hooks
// ---------------------------------------------------------------------------

/**
 * Chronicler: narrative_coherence_bonus
 *
 * After 3 consecutive nodes sharing >=1 themeTag, the next candidate gets
 * +50% to its softScore if it shares that theme.
 *
 * @param {object[]} candidates     — already soft-scored candidates (mutates in place)
 * @param {object}   history        — gs.story.recentHistory
 * @param {object}   storyteller    — storyteller profile
 * @returns {object[]}              — mutated candidates (same array)
 */
export function applyChroniclerCoherenceBonus(candidates, history, storyteller) {
  if (storyteller.uniqueMechanic !== 'narrative_coherence_bonus') return candidates;

  // Determine the dominant theme over recent tones (use tones array as theme record, or
  // detect from the last 3 recentHistory entries via nodeTypes — Director records themeTags
  // in recentHistory.tones starting with M-S14).
  const tones = history.tones || [];
  if (tones.length < 3) return candidates;

  // Check if last 3 tones share a common themeTag value.
  const last3 = tones.slice(0, 3);
  const themeCount = {};
  for (const t of last3) {
    if (t) themeCount[t] = (themeCount[t] || 0) + 1;
  }
  const matchingTheme = Object.entries(themeCount).find(([, c]) => c >= 3)?.[0];
  if (!matchingTheme) return candidates;

  // Apply +50% softScore multiplier to candidates sharing this theme.
  for (const c of candidates) {
    if (Array.isArray(c.themeTags) && c.themeTags.includes(matchingTheme)) {
      c._softScore = (c._softScore || c.baseWeight) * 1.5;
    }
  }

  return candidates;
}

/**
 * Ash Prophet: dark_omen_interrupt
 *
 * Every 8-12 ticks (uniform random), forces a candidate from the dark-omen pool
 * regardless of soft score. That candidate sets a negative flag and increments pressure.
 *
 * @param {object} gs   — game state
 * @param {Function} rng — seeded rng function
 * @returns {object|null} — forced omen candidate, or null if not firing
 */
export function tryAshProphetOmen(gs, rng) {
  const counters = gs.story.counters || {};
  const ticksSinceOmen = counters._ash_prophet_omen_tick || 0;
  const nextOmenAt = counters._ash_prophet_omen_next || 0;
  const totalTicks = counters._director_ticks || 0;

  if (nextOmenAt === 0) {
    // First time — set the next omen tick.
    gs.story.counters._ash_prophet_omen_next = totalTicks + 8 + Math.floor(rng() * 5);
    return null;
  }

  if (totalTicks < nextOmenAt) return null;

  // Omen fires.
  const omenIdx = Math.floor(rng() * DARK_OMEN_POOL.length);
  const omen = DARK_OMEN_POOL[omenIdx];

  // Schedule the next omen (8-12 ticks from now).
  gs.story.counters._ash_prophet_omen_next = totalTicks + 8 + Math.floor(rng() * 5);
  gs.story.counters._ash_prophet_omen_tick = totalTicks;

  return omen;
}

/**
 * Warbringer: momentum_escalation
 *
 * Tracks a win streak counter. Increments on combat win, resets on rest or loss.
 *
 * @param {object}  gs         — game state
 * @param {boolean} combatWon  — true if the most recent combat was won
 * @param {string}  nodeType   — current node type (used to detect rest nodes)
 */
export function trackWarbringerStreak(gs, combatWon, nodeType) {
  if (!gs.story.counters) gs.story.counters = {};

  if (nodeType === 'rest') {
    gs.story.counters.winStreak = 0;
    return;
  }

  if (combatWon) {
    gs.story.counters.winStreak = (gs.story.counters.winStreak || 0) + 1;
  } else if (combatWon === false) {
    // Explicit loss (not undefined/non-combat).
    gs.story.counters.winStreak = 0;
  }
}

/**
 * Trickster: every_6th_random
 *
 * Every 6th director call returns true (signal to skip soft scoring).
 *
 * @param {object} gs — game state
 * @returns {boolean} — true if this is a chaos tick
 */
export function tryTricksterChaos(gs) {
  if (!gs.story.counters) gs.story.counters = {};
  gs.story.counters._trickster_call = (gs.story.counters._trickster_call || 0) + 1;
  return gs.story.counters._trickster_call % 6 === 0;
}

/**
 * Pilgrim: discovery_pool_3x
 *
 * Multiplies baseWeight of lore and hidden type candidates by 3.
 *
 * @param {object[]} candidates — candidates after hard filter
 * @returns {object[]}          — mutated in place
 */
export function applyPilgrimBonus(candidates) {
  for (const c of candidates) {
    if (c.type === 'lore' || c.type === 'hidden') {
      c._pilgrimWeight = true;
      c._softScore = (c._softScore !== undefined ? c._softScore : c.baseWeight) * 3;
    }
  }
  return candidates;
}

/**
 * Iron Judge: no_fallback_ambush_instead
 *
 * When the hard filter returns empty, synthesize an ambush candidate.
 * brutal-fight does NOT force rest (handled by rule: forceRestAfterBrutalFight=false).
 *
 * @param {boolean} filterWasEmpty — true when hard filter produced no candidates
 * @param {object}  gs             — game state
 * @returns {object|null}          — synthesized ambush or null
 */
export function shouldIronJudgeAmbush(filterWasEmpty, gs, rng = Math.random) {
  if (!filterWasEmpty) return null;
  const act = gs.story?.act || 1;
  const biome = gs.story?.currentBiome || '';

  // Prefer entries matching current act + biome; fall back to act match; then any.
  const matchBoth = IRON_JUDGE_AMBUSH_POOL.filter(
    e => e.act.includes(act) && (e.biomes.includes(biome) || e.biomes.includes('anyBiome'))
  );
  const matchAct  = IRON_JUDGE_AMBUSH_POOL.filter(e => e.act.includes(act));
  const pool = matchBoth.length ? matchBoth : matchAct.length ? matchAct : IRON_JUDGE_AMBUSH_POOL;

  const entry = pool[Math.floor(rng() * pool.length)];
  return { ...entry, act: [act] };
}
