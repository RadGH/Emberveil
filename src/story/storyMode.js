/**
 * storyMode.js — Story Mode entry point and new-game orchestrator.
 *
 * Classic Mode never imports this file. The dynamic import boundary is here —
 * Vite tree-shakes all of src/story/ out of the Classic bundle.
 *
 * Public API:
 *   storyMode.newGame(opts)        -> void  (setup + pushes StoryMapScreen)
 *   storyMode.newGameSetup(opts)   -> Promise<void>  (setup only, no screen push)
 *   storyMode.commitRng(gs, nextState)
 *   storyMode.buildCtx(gs)         -> predicate/effect ctx
 */

import { GameState } from '../game/gameState.js';
import { SaveManager } from '../engine/SaveManager.js';
import { createStoryLedger, commitRng as _ledgerCommitRng } from './storyLedger.js';
import { tickQuestConditions, ensureQuestStarted } from './storyQuestEngine.js';
import {
  revealPath as _revealPath,
  blockPath as _blockPath,
  revealNodesByTag as _revealNodesByTag,
  mutateNode as _mutateNode,
  unlockTransition as _unlockTransition,
  setWaypointState as _setWaypointState,
  applyWorldMutation as _applyWorldMutation,
} from './storyMapMutations.js';
import { generateAct } from './storyMapGen.js';
import { buildIndexes, serializeMapSave } from './storyMapGraph.js';

const STORY_PREFIX = 'emberveil_save_story_';

/**
 * Generate a story-mode save key.
 * Uses a separate prefix from Classic saves so LoadGameScreen can split them.
 */
function _makeStoryKey(heroName) {
  const slug = String(heroName || 'story').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 20) || 'story';
  const ts   = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${STORY_PREFIX}${slug}_${ts}${rand}`;
}

export const storyMode = {
  /**
   * Create a new Story Mode campaign and push the StoryMapScreen.
   * For the new flow (M518), newGameSetup() is called first by StoryCharBuilderScreen,
   * and then the per-storyteller cinematic is pushed before StoryMapScreen.
   * This fallback still works for direct calls and load-from-save.
   *
   * @param {object} opts - { manager, audio, party, storytellerId, difficulty,
   *                          thematicConsistency, sideEventFrequency,
   *                          combatDensity, storyPressure }
   */
  newGame(opts = {}) {
    const { manager, audio } = opts;
    this.newGameSetup(opts).then(() => {
      import('../ui/screens/StoryMapScreen.js').then(({ StoryMapScreen }) => {
        manager.push(new StoryMapScreen(manager, audio));
      });
    }).catch(() => {
      import('../ui/screens/StoryMapScreen.js').then(({ StoryMapScreen }) => {
        manager.push(new StoryMapScreen(manager, audio));
      });
    });
  },

  /**
   * Set up the Story Mode ledger, generate the Act 1 map, and persist the save.
   * Does NOT push any screen — this is the M518 separation point that allows
   * the per-storyteller cinematic to be shown before StoryMapScreen.
   *
   * Called by StoryCharBuilderScreen after character creation completes.
   * Also called internally by newGame() for backward compat.
   *
   * @param {object} opts
   * @returns {Promise<void>}
   */
  async newGameSetup(opts = {}) {
    const { party } = opts;

    // Build the story ledger with chosen options.
    const ledger = createStoryLedger({
      storytellerId:       opts.storytellerId       || 'chronicler',
      difficulty:          opts.difficulty           || 'normal',
      thematicConsistency: opts.thematicConsistency  || 'balanced',
      sideEventFrequency:  opts.sideEventFrequency   || 'normal',
      combatDensity:       opts.combatDensity        || 'normal',
      storyPressure:       opts.storyPressure        || 'normal',
    });

    // If GameState is already initialized (by CharacterBuilderScreen), overlay
    // story fields. Otherwise init fresh.
    const gs = GameState.get();
    const heroName = party?.[0]?.name || gs.party?.[0]?.name || 'Hero';
    if (!gs.party || !gs.party.length) {
      GameState.init(party?.[0] || { name: heroName, level: 1, party: [] });
    }
    const gsLive = GameState.get();
    gsLive.gameMode    = 'story';
    gsLive.storyVersion = 1;
    gsLive.story       = ledger;
    if (Array.isArray(party) && party.length) gsLive.party = party;

    // Set act1_started flag.
    gsLive.story.flags['act1_started'] = true;
    gsLive.story.flags['arrived_brightfall'] = true;
    gsLive.story.act = 1;

    // Generate Act 1 map and store it in the ledger.
    const mapGenSeed = ((gsLive.story.rngState || 1) ^ 0xDEADBEEF) >>> 0;
    const { mapGraph } = generateAct({ seed: mapGenSeed, act: 1, salt: 0 });
    const mapId = `act1_map_${mapGenSeed}`;
    gsLive.story.maps = gsLive.story.maps || {};
    gsLive.story.maps[mapId] = serializeMapSave(mapGraph);
    gsLive.story.currentMapId = mapId;
    buildIndexes(mapGraph);

    // Kick off primary quest if content registry is available.
    if (gsLive.__storyContent) {
      ensureQuestStarted(gsLive, 'primary_act1_emberwood');
    }

    // Persist save.
    const key = _makeStoryKey(heroName);
    gsLive.currentSaveKey = key;
    SaveManager.saveCurrentGame(key);
  },

  /**
   * Build the predicate/effect evaluation context from the live gs.
   */
  buildCtx(gs) {
    if (!gs?.story) return {};
    return {
      gs,
      flags:      gs.story.flags,
      factions:   gs.story.factions,
      counters:   gs.story.counters,
      quests:     gs.story.quests,
      party:      gs.party || [],
      companions: gs.story.companions || [],
      // Map-mutation helpers.
      revealPath:         (from, to)     => _revealPath(gs, from, to),
      blockPath:          (from, to)     => _blockPath(gs, from, to),
      revealNodesByTag:   (tag, count)   => _revealNodesByTag(gs, tag, count),
      mutateNode:         (id, overlay)  => _mutateNode(gs, id, overlay),
      unlockTransition:   (mapId)        => _unlockTransition(gs, mapId),
      setWaypointState:   (id, state)    => _setWaypointState(gs, id, state),
      applyWorldMutation: (mutId)        => _applyWorldMutation(gs, mutId),
      queueEncounter:     (template) => {
        // Lazy import to avoid circular deps; storyEncounterBuilder landed in M-S16.
        import('./storyEncounterBuilder.js')
          .then(m => m.queueEncounter ? m.queueEncounter(gs, template) : null)
          .catch(() => { gs.story.flags[`_queued_encounter_${template}`] = true; });
      },
    };
  },

  /**
   * Called after every story map node is resolved (player leaves a node).
   * Ticks all active quest conditions and fires any banter that may be due.
   *
   * @param {object} gs - live game state
   * @param {string} nodeId - the node that was just resolved
   */
  afterNodeResolved(gs, nodeId) {
    if (!gs?.story) return;
    // Tick quest phase/outcome conditions.
    if (gs.__storyContent) tickQuestConditions(gs);
    // Banter scheduler.
    // Import lazily so Classic Mode never pays the cost.
    import('./storyCompanions.js')
      .then(m => m.maybeFireBanter(gs, nodeId, 'nodeResolved'))
      .catch(() => {}); // companions not yet landed in early milestones
    // Story achievement check — M-S29.
    import('../game/achievements.js')
      .then(m => m.checkAchievements())
      .catch(() => {});
    // Node-resolved telemetry event — M-S29.
    import('./storyTelemetry.js')
      .then(m => m.telemetryNodeResolved(gs, nodeId, gs.story?.currentNode?.type ?? null, null))
      .catch(() => {});
  },

  /**
   * Called when the act-1 boss is defeated and unlock_map_transition fires for act2_veilscar.
   * Also called between act 2 → 3. Generates the next act's map, applies world mutations,
   * and starts the next act's primary quest.
   *
   * @param {object} gs - live game state
   * @param {number} nextAct - 2 or 3
   */
  transitionToAct(gs, nextAct) {
    if (!gs?.story) return;

    const prevAct = nextAct - 1;

    // Apply act-boundary world mutations.
    if (prevAct === 1) {
      _applyWorldMutation(gs, 'veil_spread_ash');
      _applyWorldMutation(gs, 'quarantine_plague_fen');
    } else if (prevAct === 2) {
      _applyWorldMutation(gs, 'ember_hollow_destabilized');
      _applyWorldMutation(gs, 'oathless_mobilize');
    }

    // Generate the next act's map.
    const mapGenSeed = ((gs.story.rngState || nextAct) ^ (0xDEADBEEF * nextAct)) >>> 0;
    const { mapGraph } = generateAct({ seed: mapGenSeed, act: nextAct, salt: 0 });
    const mapId = `act${nextAct}_map_${mapGenSeed}`;

    gs.story.maps = gs.story.maps || {};
    gs.story.maps[mapId] = serializeMapSave(mapGraph);
    gs.story.act = nextAct;
    gs.story.currentMapId = mapId;
    buildIndexes(mapGraph);

    // Set the act-started flag.
    gs.story.flags[`act${nextAct}_started`] = true;

    // World corruption increments at act boundaries.
    const corruptionBump = nextAct === 2 ? 10 : 15;
    gs.story.worldCorruption = Math.min(100,
      (gs.story.worldCorruption || 0) + corruptionBump
    );

    // Start the next act's primary quest.
    const primaryQuestMap = {
      2: 'primary_act2_veilscar',
      3: 'primary_act3_riftgate',
    };
    const nextQuestId = primaryQuestMap[nextAct];
    if (nextQuestId && gs.__storyContent) {
      ensureQuestStarted(gs, nextQuestId);
    }

    // Telemetry + achievement check on act transition — M-S29.
    import('./storyTelemetry.js')
      .then(m => m.telemetryActTransition(gs, prevAct, nextAct))
      .catch(() => {});
    import('../game/achievements.js')
      .then(m => m.checkAchievements())
      .catch(() => {});
  },

  /**
   * Write the RNG checkpoint to gs.story.rngState.
   * Caller is responsible for calling SaveManager.saveCurrentGame() afterward.
   */
  commitRng(gs, nextState) {
    _ledgerCommitRng(gs, nextState);
  },
};
