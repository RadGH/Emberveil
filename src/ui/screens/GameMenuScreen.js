/**
 * GameMenuScreen — M47 ESC menu / overlay menu
 * Accessible everywhere except title and combat.
 * Resume, Save/Load, Party, Codex, Trophies, Quests.
 */
import { createEl, removeEl, injectStyles } from '../../utils/dom.js';
import { mount as kbMount, unmount as kbUnmount } from '../../utils/keyboardNav.js';
import { PartyScreen } from './PartyScreen.js';
import { PartyPanelScreen } from './PartyPanelScreen.js';
import { TapInventoryScreen } from './TapInventoryScreen.js';
import { CodexScreen } from './CodexScreen.js';
import { FormulaCodexScreen } from './FormulaCodexScreen.js';
import { AchievementsScreen } from './AchievementsScreen.js';
import { StatsDashboardScreen } from './StatsDashboardScreen.js';
import { DifficultyDialog } from './DifficultyDialog.js';
import { LoadGameScreen } from './LoadGameScreen.js';
import { QuestLogScreen } from './QuestLogScreen.js';
import { LoreCompendiumScreen } from './LoreCompendiumScreen.js';
import { SaveManager } from '../../engine/SaveManager.js';
import { SettingsScreen } from './SettingsScreen.js';
import { TitleScreen } from './TitleScreen.js';
import { newBadgeIfRecent } from '../../game/featureRegistry.js';
import { GameState } from '../../game/gameState.js';
import { getNextFameThreshold } from '../../game/fame.js';

injectStyles('game-menu-styles', `
  .gm-overlay {
    position: fixed; inset: 0;
    background: rgba(10, 6, 8, 0.88);
    display: flex; align-items: flex-start; justify-content: center;
    z-index: 1000;
    padding: 16px 16px 16px;
    overflow-y: auto; -webkit-overflow-scrolling: touch;
  }
  .gm-panel {
    background: #1a1218;
    border: 1px solid rgba(232,160,32,0.45);
    border-radius: 12px;
    padding: 1.25rem 1.25rem 1rem;
    min-width: 280px; max-width: 880px; width: 92%;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.4);
    color: #f0e8d8;
    font-family: 'Cinzel', Georgia, serif;
    margin: auto 0;
  }
  /* M335: structured menu — hero row, three column groups, footer.
     Mobile (<640px) collapses the columns into a single stack. */
  .gm-section {
    margin-bottom: 0.85rem;
  }
  .gm-section-title {
    font-size: 0.65rem; color: #8a7a6a; letter-spacing: 0.18em;
    text-transform: uppercase; margin: 0 0 0.4rem;
    border-bottom: 1px solid rgba(232,160,32,0.18); padding-bottom: 0.25rem;
  }
  .gm-cols {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.7rem;
    margin-bottom: 0.85rem;
  }
  .gm-col { display: flex; flex-direction: column; gap: 0.45rem; }
  .gm-col .gm-btn { margin-bottom: 0; }
  .gm-row { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.85rem; }
  .gm-row .gm-btn { flex: 1 1 calc(50% - 0.25rem); margin-bottom: 0; }
  .gm-footer-row {
    display: flex; gap: 0.85rem; flex-wrap: wrap; margin-top: 0.5rem;
    padding-top: 0.5rem; border-top: 1px solid rgba(232,160,32,0.18);
    justify-content: center;
  }
  /* M337 — footer entries are de-emphasized text links, not full buttons. */
  .gm-footer-link {
    background: none; border: none;
    color: rgba(232,160,32,0.7); cursor: pointer;
    font-family: 'Cinzel', Georgia, serif; font-size: 0.7rem;
    letter-spacing: 0.12em; text-transform: uppercase;
    padding: 0.4rem 0.5rem; min-height: 36px;
    text-decoration: underline; text-decoration-thickness: 1px;
    text-underline-offset: 3px;
  }
  .gm-footer-link:hover { color: #f8d880; }
  @media (max-width: 640px) {
    .gm-cols { grid-template-columns: 1fr; }
    .gm-panel { max-width: 480px; }
  }
  .gm-title {
    font-family: 'Cinzel', Georgia, serif;
    font-size: 1.25rem; font-weight: 700;
    color: #e8a020; letter-spacing: 0.12em;
    margin: 0 0 1rem; text-align: center;
    text-transform: uppercase;
  }
  .gm-btn {
    display: flex; align-items: center; gap: 0.75rem;
    width: 100%; padding: 0.75rem 1rem; margin-bottom: 0.45rem;
    background: rgba(232,160,32,0.08);
    border: 1px solid rgba(232,160,32,0.35);
    color: #f0e8d8;
    font-family: 'Cinzel', Georgia, serif;
    font-size: 0.9rem; font-weight: 600;
    letter-spacing: 0.08em; text-transform: uppercase;
    border-radius: 6px; cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
    min-height: 44px;
  }
  .gm-btn:hover {
    background: rgba(232,160,32,0.18);
    border-color: rgba(232,160,32,0.6);
    color: #f8d880;
  }
  .gm-btn.gm-primary {
    background: rgba(232,160,32,0.22);
    border-color: rgba(232,160,32,0.75);
    color: #f8d880;
  }
  .gm-btn.gm-primary:hover {
    background: rgba(232,160,32,0.32);
    border-color: #f8c040;
  }
  .gm-msg { font-size: 0.8rem; color: #8a7a6a; text-align: center; margin-top: 0.75rem; min-height: 1em; font-family: 'Cinzel', Georgia, serif; letter-spacing: 0.05em; }
  /* M495 — prominent save confirmation. The old #gm-msg text was too
     subtle (low-contrast grey, no motion) so it was unclear whether a
     save actually happened. This pulses a gold pill that fades out. */
  .gm-msg.gm-msg--ok {
    color: #1a0e08; background: linear-gradient(180deg,#f0c850,#d8a020);
    border: 1px solid #f8e8a0; border-radius: 6px; font-weight: 700;
    padding: 0.5rem 0.9rem; box-shadow: 0 2px 12px rgba(232,200,80,0.5);
    animation: gmSavePop 1.8s ease forwards;
  }
  .gm-msg.gm-msg--err {
    color: #fff; background: #8a2018; border: 1px solid #c04030;
    border-radius: 6px; font-weight: 700; padding: 0.5rem 0.9rem;
  }
  @keyframes gmSavePop {
    0%   { transform: scale(0.85); opacity: 0; }
    14%  { transform: scale(1.04); opacity: 1; }
    28%  { transform: scale(1); opacity: 1; }
    78%  { opacity: 1; }
    100% { opacity: 0; }
  }
  .gm-fame-chip { font-size: 0.68rem; color: #a08040; text-align: center; margin-bottom: 0.6rem;
    background: rgba(232,120,16,0.1); border: 1px solid rgba(232,120,16,0.25);
    border-radius: 16px; padding: 0.25rem 0.6rem; font-family: 'Cinzel', serif; letter-spacing: 0.05em; }
  .gm-confirm-modal {
    position: fixed; inset: 0; background: rgba(0,0,0,0.8);
    display: flex; align-items: center; justify-content: center;
    z-index: 1100; padding: 16px;
    font-family: 'Cinzel', Georgia, serif;
  }
  .gm-confirm-box {
    background: #1a1218;
    border: 1px solid rgba(232,160,32,0.6);
    border-radius: 12px;
    padding: 1.5rem 1.25rem 1.25rem;
    max-width: 340px; width: 92%;
    color: #f0e8d8;
    box-shadow: 0 10px 40px rgba(0,0,0,0.6);
  }
  .gm-confirm-title {
    font-size: 1rem; color: #e8a020;
    letter-spacing: 0.12em; text-transform: uppercase;
    margin: 0 0 0.75rem; text-align: center;
  }
  .gm-confirm-text {
    font-family: 'Inter', 'Segoe UI', sans-serif;
    font-size: 0.85rem; line-height: 1.45;
    color: #c8b8a8; text-align: center; margin: 0 0 1.25rem;
  }
  .gm-confirm-row { display: flex; gap: 0.6rem; }
  .gm-confirm-row .gm-btn { margin-bottom: 0; }
  /* What's New modal */
  .gm-whatsnew-modal {
    position: fixed; inset: 0; background: rgba(0,0,0,0.82);
    display: flex; align-items: center; justify-content: center;
    z-index: 1100; padding: 16px;
    font-family: 'Cinzel', Georgia, serif;
  }
  .gm-whatsnew-box {
    background: #1a1218;
    border: 1px solid rgba(232,160,32,0.6);
    border-radius: 12px;
    padding: 1.5rem 1.25rem 1.25rem;
    max-width: 380px; width: 92%;
    color: #f0e8d8;
    box-shadow: 0 10px 40px rgba(0,0,0,0.6);
    max-height: 80vh; overflow-y: auto;
  }
  .gm-whatsnew-title {
    font-size: 1rem; color: #e8a020;
    letter-spacing: 0.12em; text-transform: uppercase;
    margin: 0 0 0.25rem; text-align: center;
  }
  .gm-whatsnew-meta {
    font-family: 'Inter', sans-serif;
    font-size: 0.72rem; color: #8a7a6a;
    text-align: center; margin: 0 0 0.9rem;
  }
  .gm-whatsnew-body {
    font-family: 'Inter', 'Segoe UI', sans-serif;
    font-size: 0.84rem; line-height: 1.55;
    color: #c8b8a8; margin: 0 0 1.25rem;
    white-space: pre-wrap; word-break: break-word;
  }
  .gm-whatsnew-link {
    display: block; text-align: center;
    color: #e8a020; font-size: 0.76rem;
    text-decoration: underline; margin-bottom: 1rem;
    font-family: 'Inter', sans-serif;
  }
`);

export class GameMenuScreen {
  constructor(manager, audio) {
    this.manager = manager;
    this.audio = audio;
    this._el = null;
  }

  _buildFameChip() {
    try {
      const gs = GameState.get();
      const fame = gs.fame || 0;
      if (fame <= 0) return '';
      const title = gs.getFameTitle ? gs.getFameTitle() : '';
      const fmtFame = fame.toLocaleString('en-US');
      const next = getNextFameThreshold(fame);
      const nextPart = next
        ? ` &middot; Next: ${next.fame.toLocaleString('en-US')}`
        : ' &middot; Max';
      return `<div class="gm-fame-chip">Fame: ${fmtFame}${title ? ` (${title})` : ''}${nextPart}</div>`;
    } catch (_) { return ''; }
  }

  onEnter() {
    this._el = createEl('div', 'gm-overlay');
    this._el.innerHTML = `
      <div class="gm-panel">
        <h2 class="gm-title">Menu</h2>
        ${this._buildFameChip()}

        <div class="gm-section">
          <div class="gm-section-title">Hero</div>
          <div class="gm-row">
            <button type="button" class="gm-btn" data-act="party">Party</button>
            <button type="button" class="gm-btn" data-act="tapinv">Tap Items</button>
          </div>
        </div>

        <div class="gm-cols">
          <div class="gm-col">
            <div class="gm-section-title">Game</div>
            <button type="button" class="gm-btn gm-primary" data-act="resume">Resume</button>
            <button type="button" class="gm-btn" data-act="save">Save Game</button>
            <button type="button" class="gm-btn" data-act="load">Load Game</button>
          </div>
          <div class="gm-col">
            <div class="gm-section-title">Library</div>
            <button type="button" class="gm-btn" data-act="quests">Quests</button>
            <button type="button" class="gm-btn" data-act="codex">Codex</button>
            <button type="button" class="gm-btn" data-act="lore">Lore Compendium${newBadgeIfRecent('lore_compendium')}</button>
            <button type="button" class="gm-btn" data-act="trophies">Achievements${newBadgeIfRecent('achievements')}</button>
            <button type="button" class="gm-btn" data-act="stats">Statistics</button>
          </div>
          <div class="gm-col">
            <div class="gm-section-title">Settings</div>
            <button type="button" class="gm-btn" data-act="changediff">Change Difficulty</button>
            <button type="button" class="gm-btn" data-act="settings">Settings</button>
            <button type="button" class="gm-btn" data-act="title">Main Menu</button>
          </div>
        </div>

        <div class="gm-footer-row">
          <button type="button" class="gm-footer-link" data-act="whatsnew">What's New${newBadgeIfRecent('whats_new_button')}</button>
          <button type="button" class="gm-footer-link" data-act="feedback">Send Feedback</button>
        </div>

        <div class="gm-msg" id="gm-msg"></div>
      </div>
    `;
    this.manager.uiOverlay.appendChild(this._el);

    this._el.addEventListener('click', (e) => {
      if (e.target === this._el) { this.audio.playSfx('click'); this.manager.pop(); return; }
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const act = btn.dataset.act;
      this.audio.playSfx('click');
      if (act === 'resume') { this.manager.pop(); return; }
      if (act === 'save') {
        try {
          SaveManager.saveCurrentGame();
          // Track last-save timestamp so the Main Menu confirm can be skipped
          // within a 60s cooldown (see 'title' handler below).
          try { window.__lastSavedAt = Date.now(); } catch (_) {}
          const _m = this._el.querySelector('#gm-msg');
          _m.className = 'gm-msg gm-msg--ok';
          _m.textContent = '✓ Game saved';
          // Re-trigger the pop animation if saved again quickly.
          _m.style.animation = 'none'; void _m.offsetWidth; _m.style.animation = '';
        }
        catch (_) {
          const _m = this._el.querySelector('#gm-msg');
          _m.className = 'gm-msg gm-msg--err';
          _m.textContent = '✕ Save failed';
        }
        return;
      }
      if (act === 'load')     { this.manager.push(new LoadGameScreen(this.manager, this.audio)); return; }
      if (act === 'party')    { this.manager.push(new PartyPanelScreen(this.manager, this.audio)); return; }
      if (act === 'tapinv')   { this.manager.push(new TapInventoryScreen(this.manager, this.audio)); return; }
      if (act === 'quests')   { this.manager.push(new QuestLogScreen(this.manager, this.audio)); return; }
      if (act === 'codex')    { this.manager.push(new FormulaCodexScreen(this.manager, this.audio)); return; }
      if (act === 'lore')     { this.manager.push(new LoreCompendiumScreen(this.manager, this.audio)); return; }
      if (act === 'trophies') { this.manager.push(new AchievementsScreen(this.manager, this.audio)); return; }
      if (act === 'stats')    { this.manager.push(new StatsDashboardScreen(this.manager, this.audio, { mode: 'in_game' })); return; }
      if (act === 'changediff'){ this.manager.push(new DifficultyDialog(this.manager, this.audio)); return; }
      if (act === 'settings') { this.manager.push(new SettingsScreen(this.manager, this.audio)); return; }
      if (act === 'whatsnew') { this._showWhatsNew(); return; }
      if (act === 'feedback') {
        window.open('https://docs.google.com/forms/d/e/1FAIpQLScWHFEQ8Kbxvsxg5nKerJOPqkYntAkRLCihqQchypNdqayvmA/viewform?usp=publish-editor', '_blank', 'noopener');
        return;
      }
      if (act === 'title') {
        // Skip confirm if the game was saved within the last 60s —
        // no meaningful progress can be lost in that window.
        const lastSaved = window.__lastSavedAt || 0;
        if (Date.now() - lastSaved < 60000) {
          this._goToTitle();
          return;
        }
        this._showMainMenuConfirm();
        return;
      }
    });

    this._esc = (e) => { if (e.code === 'Escape') { this.audio.playSfx('click'); this.manager.pop(); } };
    window.addEventListener('keydown', this._esc);

    // M297: keyboard navigation — vertical button list, focusFirst so keyboard
    // users land on Resume immediately after opening the menu.
    kbMount(this._el, {
      layout: 'vertical',
      focusFirst: true,
      onEscape: () => { this.audio.playSfx('click'); this.manager.pop(); },
    });
  }

  _goToTitle() {
    while (this.manager._stack.length) this.manager.pop();
    this.manager.push(new TitleScreen(this.manager, this.audio));
  }

  _showMainMenuConfirm() {
    if (this._confirmEl) return;
    const wrap = createEl('div', 'gm-confirm-modal');
    wrap.innerHTML = `
      <div class="gm-confirm-box" role="dialog" aria-modal="true" aria-labelledby="gm-confirm-title">
        <div class="gm-confirm-title" id="gm-confirm-title">Return to Main Menu?</div>
        <div class="gm-confirm-text">Unsaved progress will be lost. Save the game first if you want to keep it.</div>
        <div class="gm-confirm-row">
          <button type="button" class="gm-btn" data-c-act="cancel">Cancel</button>
          <button type="button" class="gm-btn gm-primary" data-c-act="ok">OK</button>
        </div>
      </div>
    `;
    this._confirmEl = wrap;
    this.manager.uiOverlay.appendChild(wrap);
    const close = () => {
      if (!this._confirmEl) return;
      try { this._confirmEl.remove(); } catch (_) {}
      this._confirmEl = null;
    };
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap) { this.audio.playSfx('click'); close(); return; }
      const b = e.target.closest('[data-c-act]');
      if (!b) return;
      this.audio.playSfx('click');
      const act = b.dataset.cAct;
      close();
      if (act === 'ok') this._goToTitle();
    });
  }

  _showWhatsNew() {
    if (this._whatsNewEl) return;
    const wrap = document.createElement('div');
    wrap.className = 'gm-whatsnew-modal';
    wrap.innerHTML = `
      <div class="gm-whatsnew-box" role="dialog" aria-modal="true" aria-labelledby="gm-wn-title">
        <div class="gm-whatsnew-title" id="gm-wn-title">What's New</div>
        <div class="gm-whatsnew-meta" id="gm-wn-meta">Loading...</div>
        <div class="gm-whatsnew-body" id="gm-wn-body"></div>
        <a class="gm-whatsnew-link" href="${import.meta.env.BASE_URL}assets/changelog.html" target="_blank" rel="noopener">Full history</a>
        <div class="gm-confirm-row">
          <button type="button" class="gm-btn gm-primary" id="gm-wn-close">Close</button>
        </div>
      </div>
    `;
    this._whatsNewEl = wrap;
    this.manager.uiOverlay.appendChild(wrap);
    wrap.querySelector('#gm-wn-close').addEventListener('click', () => {
      this.audio.playSfx('click');
      this._closeWhatsNew();
    });
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap) { this.audio.playSfx('click'); this._closeWhatsNew(); }
    });

    // Fetch the baked release summary JSON — honor Vite BASE_URL for sub-path deploys
    fetch(`${import.meta.env.BASE_URL}assets/release-summary.json`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!this._whatsNewEl) return;
        const meta = wrap.querySelector('#gm-wn-meta');
        const body = wrap.querySelector('#gm-wn-body');
        if (data && data.milestone) {
          if (meta) meta.textContent = `Milestone ${data.milestone}${data.date ? '  ·  ' + data.date : ''}`;
          if (body) body.textContent = data.summary || 'No summary recorded.';
        } else {
          if (meta) meta.textContent = '';
          if (body) body.textContent = 'Release notes unavailable.';
        }
      })
      .catch(() => {
        if (!this._whatsNewEl) return;
        const body = wrap.querySelector('#gm-wn-body');
        if (body) body.textContent = 'Could not load release notes.';
      });
  }

  _closeWhatsNew() {
    if (!this._whatsNewEl) return;
    try { this._whatsNewEl.remove(); } catch (_) {}
    this._whatsNewEl = null;
  }

  onPause() { if (this._el) this._el.style.display = 'none'; }
  onResume() { if (this._el) this._el.style.display = 'flex'; }
  onExit() {
    window.removeEventListener('keydown', this._esc);
    if (this._el) kbUnmount(this._el);
    if (this._confirmEl) { try { this._confirmEl.remove(); } catch (_) {} this._confirmEl = null; }
    this._closeWhatsNew();
    removeEl(this._el);
    this._el = null;
  }
  destroy() { this.onExit(); }
  update() {}
  draw() {}
}
