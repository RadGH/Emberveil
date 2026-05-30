/**
 * StoryDialogScreen — Story Mode dialog renderer (§5.5 of refined plan).
 *
 * Extends DialogScreen and overrides three methods:
 *   _filterChoices(choices)    — predicate-based filtering + companion badges.
 *   _applyChoiceEffects(choice) — delegates to storyDialogConductor.applyChoice.
 *   _renderEffectFeedback(effects) — renders a slide-in effect-chip panel.
 *
 * The parent class (DialogScreen) handles all rendering, text reveal, skip
 * logic, and keyboard navigation. This subclass only replaces the story-mode-
 * specific parts. The 5500 lines of Classic dialog content are never modified.
 *
 * Mobile portrait target: 393×852 CSS px (iPhone 14 Pro).
 * All interactive elements: min-height 44px.
 * Text: minimum 14px (inline badges permitted at 11px).
 */

import { DialogScreen }          from './DialogScreen.js';
import { injectStyles }          from '../../utils/dom.js';
import { GameState }             from '../../game/gameState.js';
import { evalPredicate }         from '../../story/storyPredicate.js';
import { storyMode }             from '../../story/storyMode.js';
import {
  filterChoices,
  applyChoice,
  adaptLegacyChoice,
}                                from '../../story/storyDialogConductor.js';

export class StoryDialogScreen extends DialogScreen {
  /**
   * @param {object} manager        - ScreenManager
   * @param {object} audio          - AudioManager
   * @param {object} dialogEvent    - same shape DialogScreen accepts
   * @param {Function} onComplete   - callback(outcomeKey, outcome)
   * @param {object} [storyCtx]     - { poolId, nodeId } for routing; optional
   */
  constructor(manager, audio, dialogEvent, onComplete, storyCtx = {}) {
    super(manager, audio, dialogEvent, onComplete);
    this._poolId    = storyCtx.poolId  || 'inline';
    this._storyNodeId = storyCtx.nodeId || dialogEvent.id || 'node';
    this._feedbackEl  = null;
  }

  // ---------------------------------------------------------------------------
  // Override: filter choices through story predicate system
  // ---------------------------------------------------------------------------

  /**
   * Override _showChoices to intercept the choices array before rendering.
   * We build the filtered list then hand it to the parent by temporarily
   * patching the active choices on the event / current node.
   */
  _showChoices() {
    const gs  = GameState.get?.();
    const ctx = gs?.story ? storyMode.buildCtx(gs) : null;

    if (ctx) {
      // Get the raw choices from the current state (parent accessor)
      const rawChoices = this._activeChoices();
      const filtered   = filterChoices({ choices: rawChoices }, ctx);

      // Annotate with companion badge text for the parent renderer.
      // We store the filtered list in a transient property that the
      // overridden _buildChoiceHtml reads.
      this._storyFilteredChoices = filtered;
    } else {
      this._storyFilteredChoices = null;
    }

    super._showChoices();
  }

  /**
   * Override _activeChoices to return the story-filtered list when available.
   */
  _activeChoices() {
    if (this._storyFilteredChoices !== null && this._storyFilteredChoices !== undefined) {
      return this._storyFilteredChoices;
    }
    return super._activeChoices();
  }

  // ---------------------------------------------------------------------------
  // Override: apply choice effects through the story conductor
  // ---------------------------------------------------------------------------

  /**
   * Override _selectChoice to route choice effects through storyDialogConductor
   * before delegating outcome display to the parent.
   */
  _selectChoice(idx) {
    const choice = this._activeChoices()[idx];
    if (!choice) return;

    const gs = GameState.get?.();
    if (gs?.story) {
      const ctx = storyMode.buildCtx(gs);
      const adapted = adaptLegacyChoice(choice);

      // Apply story effects and get feedback strings
      const { effectFeedback } = applyChoice(
        gs, choice, ctx, this._poolId, this._storyNodeId
      );

      // Show effect-chip panel if there is anything to display
      if (effectFeedback.length) {
        this._showEffectFeedback(effectFeedback);
      }
    }

    // Delegate outcome rendering to parent (handles skill checks, outcome text,
    // node routing, rewards display, etc.)
    super._selectChoice(idx);
  }

  // ---------------------------------------------------------------------------
  // Effect-chip panel (slide-in, 200 ms, above the choice bar)
  // ---------------------------------------------------------------------------

  /**
   * Renders a slide-in panel of effect chips above the choice area.
   * Slides in over 200ms, auto-dismisses after 2.5 s.
   *
   * @param {string[]} feedbackLines - human-readable effect summaries
   */
  _showEffectFeedback(feedbackLines) {
    // Remove any existing feedback panel
    if (this._feedbackEl) {
      this._feedbackEl.remove();
      this._feedbackEl = null;
    }
    if (!feedbackLines.length || !this._el) return;

    injectStyles('story-dialog-styles', STORY_DIALOG_STYLES);

    const panel = document.createElement('div');
    panel.className = 'sdlg-feedback-panel sdlg-feedback-panel--hidden';
    panel.setAttribute('aria-live', 'polite');
    panel.setAttribute('aria-label', 'Effect feedback');

    panel.innerHTML = feedbackLines
      .map(line => `<div class="sdlg-chip">${_sanitize(line)}</div>`)
      .join('');

    // Insert above the choices area
    const choicesEl = this._el.querySelector('#dlg-choices');
    if (choicesEl) {
      choicesEl.before(panel);
    } else {
      this._el.appendChild(panel);
    }
    this._feedbackEl = panel;

    // Trigger slide-in
    requestAnimationFrame(() => {
      panel.classList.remove('sdlg-feedback-panel--hidden');
      panel.classList.add('sdlg-feedback-panel--visible');
    });

    // Auto-dismiss after 2.5 s
    setTimeout(() => {
      if (!panel.isConnected) return;
      panel.classList.remove('sdlg-feedback-panel--visible');
      panel.classList.add('sdlg-feedback-panel--hidden');
      setTimeout(() => { if (panel.isConnected) panel.remove(); }, 220);
    }, 2500);
  }

  // ---------------------------------------------------------------------------
  // Companion badge in choice buttons
  // ---------------------------------------------------------------------------

  /**
   * Provide a choice label that includes a [Companion] badge when present.
   * Called by parent _showChoices when building button HTML (via our
   * _storyFilteredChoices annotation).
   */
  _choiceLabel(choice) {
    const badge = choice._companionLabel
      ? `<span class="sdlg-companion-badge">${_sanitize(choice._companionLabel)}</span>`
      : '';
    return `${badge}${choice.text || ''}`;
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  onExit() {
    this._feedbackEl = null;
    super.onExit();
  }

  destroy() {
    this._feedbackEl = null;
    super.destroy();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _sanitize(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ---------------------------------------------------------------------------
// CSS — injected once, static values only via class names
// ---------------------------------------------------------------------------

const STORY_DIALOG_STYLES = `
.sdlg-feedback-panel {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  padding: 0.45rem 0.75rem;
  margin: 0 0.75rem 0.25rem;
  background: rgba(12, 8, 20, 0.88);
  border: 1px solid rgba(168, 120, 240, 0.3);
  border-radius: 8px;
  transform: translateY(8px);
  opacity: 0;
  transition: opacity 0.2s ease-out, transform 0.2s ease-out;
  pointer-events: none;
}
.sdlg-feedback-panel--visible {
  opacity: 1;
  transform: translateY(0);
}
.sdlg-feedback-panel--hidden {
  opacity: 0;
  transform: translateY(8px);
}
.sdlg-chip {
  font-size: 0.75rem;
  font-family: 'Cinzel', serif;
  color: #c8a0f0;
  background: rgba(120, 80, 200, 0.15);
  border: 1px solid rgba(120, 80, 200, 0.3);
  border-radius: 4px;
  padding: 0.15rem 0.5rem;
  white-space: nowrap;
  letter-spacing: 0.04em;
}
.sdlg-companion-badge {
  display: inline-block;
  font-size: 0.65rem;
  font-weight: 700;
  font-family: 'Cinzel', serif;
  letter-spacing: 0.06em;
  color: #c8a0f0;
  background: rgba(120, 80, 200, 0.2);
  border: 1px solid rgba(120, 80, 200, 0.4);
  border-radius: 3px;
  padding: 0.08rem 0.35rem;
  margin-right: 0.4rem;
  vertical-align: middle;
  text-transform: uppercase;
}
@media (max-width: 420px) {
  .sdlg-chip { font-size: 0.7rem; }
  .sdlg-companion-badge { font-size: 0.6rem; }
}
`;
