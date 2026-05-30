/**
 * storyTelemetry.js — Story Mode event tagging layer.
 *
 * Wraps story events with structured tags and forwards them to the global
 * telemetry bus (window.emberveilTelemetry) if it is defined. Designed to be
 * a thin shim — if telemetry is absent, every call is a no-op.
 *
 * Story-specific counters (trickster_events, corruption, etc.) are also
 * written directly into gs.story.counters so achievement checks can read them
 * without touching telemetry at all.
 *
 * M-S29: initial implementation.
 */

/**
 * Fire one story telemetry event.
 *
 * @param {string}  eventName  - dot-separated event identifier, e.g. "story.node.resolved"
 * @param {object}  payload    - free-form properties attached to the event
 * @param {object}  [gs]       - live game state; used to update counters/flags in-place
 */
export function storyEvent(eventName, payload = {}, gs = null) {
  // Stamp with story context from gs if available.
  const enriched = {
    event: eventName,
    ts: Date.now(),
    act: gs?.story?.act ?? null,
    storyteller: gs?.story?.storytellerId ?? null,
    difficulty: gs?.story?.difficulty ?? null,
    ...payload,
  };

  // Forward to global bus (optional integration; never throws).
  try {
    if (typeof window !== 'undefined' && typeof window.emberveilTelemetry?.track === 'function') {
      window.emberveilTelemetry.track(enriched);
    }
  } catch (_) {}

  // Dispatch DOM event so tool pages / devtools can listen without coupling.
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('emberveil-story-event', { detail: enriched }));
    }
  } catch (_) {}

  return enriched;
}

// ---------------------------------------------------------------------------
// Convenience wrappers — one per meaningful story action.
// ---------------------------------------------------------------------------

/** Player visits and resolves a map node. */
export function telemetryNodeResolved(gs, nodeId, nodeType, outcome) {
  return storyEvent('story.node.resolved', { nodeId, nodeType, outcome }, gs);
}

/** Player wins or loses a combat encounter. */
export function telemetryCombat(gs, nodeId, won, rounds) {
  if (gs?.story) {
    if (!won) {
      gs.story.counters = gs.story.counters || {};
      gs.story.counters.combatDeaths = (gs.story.counters.combatDeaths || 0) + 1;
    }
    // Track no-combat run (for pacifist achievement).
    if (won === false) {
      // Initiated combat means we are NOT in a pacifist run.
      if (gs.story.flags) gs.story.flags['story_no_combat_act1'] = false;
    }
  }
  return storyEvent('story.combat', { nodeId, won, rounds }, gs);
}

/** A companion's approval changed. */
export function telemetryCompanionApproval(gs, companionId, delta, newApproval) {
  // Check for devoted achievement threshold.
  if (gs?.story && newApproval >= 100) {
    gs.story.flags = gs.story.flags || {};
    // Mark that a companion reached devoted — achievement check reads this.
    gs.story.flags['story_companion_devoted'] = true;
  }
  return storyEvent('story.companion.approval', { companionId, delta, newApproval }, gs);
}

/** A Trickster wild-card event was accepted by the player. */
export function telemetryTricksterEvent(gs, eventId) {
  if (gs?.story) {
    gs.story.counters = gs.story.counters || {};
    gs.story.counters.trickster_events = (gs.story.counters.trickster_events || 0) + 1;
  }
  return storyEvent('story.trickster.accepted', { eventId }, gs);
}

/** Player's corruption counter changed. */
export function telemetryCorruption(gs, newValue) {
  if (gs?.story) {
    gs.story.counters = gs.story.counters || {};
    gs.story.counters.corruption = newValue;
    if (newValue >= 100) {
      gs.story.flags = gs.story.flags || {};
      gs.story.flags['story_corruption_max'] = true;
    }
  }
  return storyEvent('story.corruption.change', { newValue }, gs);
}

/** Act transition completed. */
export function telemetryActTransition(gs, fromAct, toAct) {
  if (gs?.story) {
    const storyteller = gs.story.storytellerId;
    if (toAct === 2 && gs.story.flags) {
      // Flag pacifist if no combat deaths occurred in act 1.
      if (!gs.story.flags['story_no_combat_act1'] !== false) {
        gs.story.flags['story_no_combat_act1'] = true;
      }
    }
    // Campaign-completion flags per storyteller.
    if (toAct > 3) {
      gs.story.flags = gs.story.flags || {};
      if (storyteller === 'iron_judge')   gs.story.flags['story_iron_judge_complete']  = true;
      if (storyteller === 'chronicler')   gs.story.flags['story_chronicler_complete']  = true;
    }
  }
  return storyEvent('story.act.transition', { fromAct, toAct }, gs);
}

/** Hidden path discovered. */
export function telemetryHiddenPath(gs, nodeId, totalHidden, discovered) {
  if (gs?.story && totalHidden > 0 && discovered / totalHidden >= 0.5) {
    gs.story.flags = gs.story.flags || {};
    gs.story.flags['hidden_paths_half_found'] = true;
  }
  return storyEvent('story.hidden_path.found', { nodeId, discovered, totalHidden }, gs);
}

/** Secret ending reached. */
export function telemetrySecretEnding(gs) {
  if (gs?.story) {
    gs.story.flags = gs.story.flags || {};
    gs.story.flags['secret_ending_reached'] = true;
  }
  return storyEvent('story.secret_ending', {}, gs);
}
