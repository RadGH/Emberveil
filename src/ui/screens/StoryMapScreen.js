import { GameState } from '../../game/gameState.js';
import { createEl, injectStyles, removeEl } from '../../utils/dom.js';

export class StoryMapScreen {
  constructor(manager, audio) {
    this.manager = manager;
    this.audio = audio;
    this._el = null;
  }

  onEnter() {
    injectStyles('story-map-foundation-styles', STORY_MAP_STYLES);
    this._el = createEl('div', 'story-map-foundation');
    this.manager.uiOverlay.appendChild(this._el);
    this._render();
  }

  _render() {
    const gs = GameState.get();
    const story = gs.story || {};
    this._el.innerHTML = `
      <section class="smf-panel">
        <div class="smf-kicker">Story Mode Foundation</div>
        <h1 class="smf-title">${story.currentMapId || 'Story Map'}</h1>
        <div class="smf-grid">
          <div><span>Storyteller</span><strong>${story.storytellerId || 'unknown'}</strong></div>
          <div><span>Difficulty</span><strong>${story.difficulty || 'normal'}</strong></div>
          <div><span>Seed</span><strong>${story.campaignSeed || 'unset'}</strong></div>
          <div><span>Pressure</span><strong>${story.pressureMeter ?? 0}</strong></div>
        </div>
        <p class="smf-note">Not done yet: generated map traversal, authored quests, dialog, encounters, companions, director balance, and full act content are intentionally blocked behind later redo milestones.</p>
        <button type="button" class="smf-back" id="smf-back">Return to Title</button>
      </section>
    `;
    this._el.querySelector('#smf-back').addEventListener('click', () => {
      this.audio.playSfx('click');
      this.manager.pop();
    });
  }

  update() {}
  draw() {}
  onExit() { removeEl(this._el); this._el = null; }
  destroy() { this.onExit(); }
}

const STORY_MAP_STYLES = `
.story-map-foundation { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at 50% 20%, rgba(80,42,34,0.42), rgba(5,2,8,0.98) 58%); color: #f0e8d8; font-family: Inter, sans-serif; padding: 1rem; }
.smf-panel { width: 100%; max-width: 520px; border: 1px solid rgba(232,160,32,0.28); background: rgba(14,8,14,0.9); border-radius: 8px; padding: 1rem; }
.smf-kicker { color: #e8a020; font-size: 0.72rem; letter-spacing: 0.12em; text-transform: uppercase; }
.smf-title { font-family: Cinzel, serif; font-size: 1.35rem; margin: 0.35rem 0 0.85rem; color: #f0c060; }
.smf-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.55rem; }
.smf-grid div { border: 1px solid rgba(232,160,32,0.12); border-radius: 6px; padding: 0.65rem; background: rgba(0,0,0,0.16); min-width: 0; }
.smf-grid span { display: block; color: #9c8c78; font-size: 0.68rem; }
.smf-grid strong { display: block; color: #f0e8d8; font-size: 0.82rem; overflow-wrap: anywhere; margin-top: 0.18rem; }
.smf-note { color: #c8b89c; font-size: 0.78rem; line-height: 1.5; margin: 1rem 0; }
.smf-back { width: 100%; min-height: 48px; border: 1px solid rgba(232,160,32,0.45); background: rgba(232,160,32,0.14); color: #e8a020; border-radius: 6px; cursor: pointer; font-weight: 700; }
@media (max-width: 480px) { .smf-grid { grid-template-columns: 1fr; } }
`;
