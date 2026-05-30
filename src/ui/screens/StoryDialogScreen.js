import { createEl, injectStyles, removeEl } from '../../utils/dom.js';
import { GameState } from '../../game/gameState.js';
import { chooseDialogChoice, createDialogSession, currentDialogNode } from '../../story/storyDialogConductor.js';

export class StoryDialogScreen {
  constructor(manager, audio, dialogRef, onComplete = null) {
    this.manager = manager;
    this.audio = audio;
    this.dialogRef = dialogRef;
    this.onComplete = onComplete;
    this._el = null;
    this._session = null;
  }

  onEnter() {
    injectStyles('story-dialog-styles', STORY_DIALOG_STYLES);
    this._session = createDialogSession(GameState.get(), this.dialogRef);
    this._el = createEl('div', 'story-dialog-screen');
    this.manager.uiOverlay.appendChild(this._el);
    this._render();
  }

  _render() {
    const node = currentDialogNode(this._session, GameState.get());
    this._el.innerHTML = `
      <section class="sds-panel">
        <div class="sds-speaker">${node.speaker || 'Emberveil'}</div>
        <p class="sds-text">${escapeHtml(node.text || '')}</p>
        <div class="sds-choices">
          ${node.choices.map(choice => `<button type="button" class="sds-choice" data-choice="${choice.id}">${escapeHtml(choice.label)}</button>`).join('')}
        </div>
      </section>
    `;
    this._el.querySelectorAll('[data-choice]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.audio.playSfx('click');
        const result = chooseDialogChoice(this._session, btn.dataset.choice, GameState.get());
        if (result.completed) {
          this.onComplete?.(result);
          this.manager.pop();
          return;
        }
        this._render();
      });
    });
  }

  update() {}
  draw() {}
  onExit() { removeEl(this._el); this._el = null; }
  destroy() { this.onExit(); }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
}

const STORY_DIALOG_STYLES = `
.story-dialog-screen { position: absolute; inset: 0; z-index: 20; display: flex; align-items: flex-end; justify-content: center; background: rgba(4,2,6,0.66); color: #f0e8d8; font-family: Inter, sans-serif; padding: 1rem 1rem calc(1rem + env(safe-area-inset-bottom, 0px)); }
.sds-panel { width: 100%; max-width: 560px; border: 1px solid rgba(232,160,32,0.28); border-radius: 8px; background: rgba(12,8,13,0.98); padding: 1rem; }
.sds-speaker { color: #f0c060; font-family: Cinzel, serif; font-weight: 700; margin-bottom: 0.55rem; }
.sds-text { color: #d8ccb8; line-height: 1.5; font-size: 0.9rem; margin: 0 0 0.9rem; }
.sds-choices { display: flex; flex-direction: column; gap: 0.5rem; }
.sds-choice { min-height: 48px; border: 1px solid rgba(232,160,32,0.28); border-radius: 6px; background: rgba(232,160,32,0.12); color: #f0e8d8; font-weight: 700; text-align: left; padding: 0.6rem 0.75rem; cursor: pointer; }
`;
