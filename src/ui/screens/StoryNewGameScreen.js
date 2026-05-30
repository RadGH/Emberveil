import { createEl, injectStyles, removeEl } from '../../utils/dom.js';
import { mount as kbMount, unmount as kbUnmount } from '../../utils/keyboardNav.js';
import { CharacterBuilderScreen } from './CharacterBuilderScreen.js';
import { StoryMapScreen } from './StoryMapScreen.js';
import { newGame as newStoryGame } from '../../story/storyMode.js';
import { STORYTELLERS } from '../../story/storyLedger.js';

export class StoryNewGameScreen {
  constructor(manager, audio) {
    this.manager = manager;
    this.audio = audio;
    this.noGameMenuEsc = true;
    this._el = null;
    this._storytellerId = STORYTELLERS[0].id;
    this._difficulty = 'normal';
  }

  onEnter() {
    injectStyles('story-new-game-styles', STORY_NEW_GAME_STYLES);
    this._el = createEl('div', 'sng-screen');
    this.manager.uiOverlay.appendChild(this._el);
    this._render();
  }

  _render() {
    this._el.innerHTML = `
      <section class="sng-panel">
        <header class="sng-header">
          <div class="sng-title">New Game</div>
          <div class="sng-subtitle">Choose Classic Mode or begin the Story Mode rebuild foundation.</div>
        </header>
        <div class="sng-mode-grid">
          <button type="button" class="sng-mode-card" id="sng-classic">
            <span class="sng-mode-title">Classic Mode</span>
            <span class="sng-mode-copy">The current complete Emberveil RPG loop.</span>
          </button>
          <div class="sng-mode-card sng-story-card">
            <span class="sng-mode-title">Story Mode</span>
            <span class="sng-mode-copy">Redo build: separate saves, ledger, predicates, effects, and deterministic map traversal are active.</span>
            <div class="sng-storytellers">
              ${STORYTELLERS.map(s => `
                <button type="button" class="sng-storyteller${s.id === this._storytellerId ? ' selected' : ''}" data-storyteller="${s.id}">
                  <span>${s.name}</span>
                  <small>${s.mechanic}</small>
                </button>
              `).join('')}
            </div>
            <div class="sng-difficulty" aria-label="Story difficulty">
              ${['relaxed', 'normal', 'hard'].map(d => `
                <button type="button" class="sng-pill${d === this._difficulty ? ' selected' : ''}" data-difficulty="${d}">${d}</button>
              `).join('')}
            </div>
            <button type="button" class="sng-start-story" id="sng-start-story">Start Story Mode</button>
          </div>
        </div>
      </section>
      <button type="button" class="sng-back" id="sng-back">Back</button>
    `;

    this._el.querySelector('#sng-classic').addEventListener('click', () => {
      this.audio.playSfx('click');
      this.manager.replace(new CharacterBuilderScreen(this.manager, this.audio));
    });
    this._el.querySelectorAll('[data-storyteller]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.audio.playSfx('click');
        this._storytellerId = btn.dataset.storyteller;
        this._render();
      });
    });
    this._el.querySelectorAll('[data-difficulty]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.audio.playSfx('click');
        this._difficulty = btn.dataset.difficulty;
        this._render();
      });
    });
    this._el.querySelector('#sng-start-story').addEventListener('click', () => {
      this.audio.playSfx('click');
      newStoryGame({ storytellerId: this._storytellerId, difficulty: this._difficulty });
      this.manager.replace(new StoryMapScreen(this.manager, this.audio));
    });
    this._el.querySelector('#sng-back').addEventListener('click', () => {
      this.audio.playSfx('click');
      this.manager.pop();
    });
    kbUnmount(this._el);
    kbMount(this._el, { layout: 'vertical', focusFirst: true, onEscape: () => this.manager.pop() });
  }

  update() {}
  draw() {}
  onExit() { if (this._el) kbUnmount(this._el); removeEl(this._el); this._el = null; }
  destroy() { this.onExit(); }
}

const STORY_NEW_GAME_STYLES = `
.sng-screen { position: absolute; inset: 0; display: flex; align-items: flex-start; justify-content: center; background: rgba(5,2,8,0.97); color: #f0e8d8; font-family: Inter, sans-serif; overflow-y: auto; padding: 1.5rem 1rem 5rem; }
.sng-panel { width: 100%; max-width: 760px; }
.sng-header { text-align: center; margin: 0 0 1.25rem; }
.sng-title { font-family: Cinzel, serif; color: #e8a020; font-weight: 700; font-size: 1.45rem; letter-spacing: 0.08em; }
.sng-subtitle { margin-top: 0.35rem; color: #b8a890; font-size: 0.82rem; }
.sng-mode-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.85rem; }
.sng-mode-card { display: flex; flex-direction: column; align-items: stretch; gap: 0.6rem; text-align: left; border: 1px solid rgba(232,160,32,0.22); background: rgba(24,14,22,0.92); color: inherit; border-radius: 8px; padding: 1rem; min-height: 160px; }
button.sng-mode-card { cursor: pointer; }
button.sng-mode-card:hover, .sng-storyteller:hover, .sng-pill:hover, .sng-start-story:hover { border-color: rgba(232,160,32,0.65); background: rgba(42,26,28,0.94); }
.sng-mode-title { font-family: Cinzel, serif; color: #f0c060; font-weight: 700; }
.sng-mode-copy { color: #b8a890; font-size: 0.78rem; line-height: 1.45; }
.sng-storytellers { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.45rem; }
.sng-storyteller { min-height: 54px; display: flex; flex-direction: column; justify-content: center; gap: 0.18rem; border: 1px solid rgba(232,160,32,0.18); border-radius: 6px; background: rgba(0,0,0,0.18); color: #f0e8d8; padding: 0.45rem 0.55rem; text-align: left; cursor: pointer; }
.sng-storyteller small { color: #9c8c78; font-size: 0.64rem; line-height: 1.25; }
.sng-storyteller.selected, .sng-pill.selected { border-color: #e8a020; background: rgba(232,160,32,0.16); }
.sng-difficulty { display: flex; gap: 0.4rem; }
.sng-pill { min-height: 44px; flex: 1; border: 1px solid rgba(232,160,32,0.18); background: rgba(0,0,0,0.16); color: #f0e8d8; border-radius: 6px; text-transform: capitalize; cursor: pointer; }
.sng-start-story { min-height: 48px; border: 1px solid rgba(232,160,32,0.55); background: rgba(232,160,32,0.16); color: #e8a020; border-radius: 6px; font-weight: 700; cursor: pointer; }
.sng-back { position: fixed; left: 0; right: 0; bottom: 0; min-height: 48px; border: 0; border-top: 1px solid rgba(232,160,32,0.15); background: rgba(5,2,8,0.98); color: #b8a890; cursor: pointer; }
@media (max-width: 640px) { .sng-mode-grid, .sng-storytellers { grid-template-columns: 1fr; } .sng-screen { padding-top: 1rem; } }
`;
