/**
 * DifficultyDialog — M279
 *
 * Mid-game dialog to swap difficulty + advanced toggles (fog, hardcore,
 * manual combat). Replaces the simple dropdown in Settings. Designed to
 * mirror the difficulty step on CharacterBuilderScreen but be reachable
 * from the in-game pause menu so the player can change settings without
 * starting a new game.
 *
 * Mobile-friendly: difficulty cards are in a horizontally scrollable strip
 * (CSS overflow-x:auto) so all three fit on a phone screen without wrapping.
 */
import { createEl, removeEl, injectStyles } from '../../utils/dom.js';
import { GameState } from '../../game/gameState.js';

const STYLES = `
.diffdlg-overlay { position: absolute; inset: 0; background: rgba(8,5,10,0.85);
  display: flex; align-items: center; justify-content: center; z-index: 9999;
  font-family: 'Inter', system-ui, sans-serif; }
.diffdlg-panel { background: #1a1018; border: 1px solid rgba(232,160,32,0.4);
  border-radius: 6px; padding: 1rem; max-width: 540px; width: calc(100vw - 2rem);
  max-height: calc(100vh - 2rem); overflow-y: auto; color: #f0e8d8; }
.diffdlg-h { font-family: 'Cinzel', serif; font-size: 1.1rem; color: #e8a020;
  text-align: center; letter-spacing: 0.1em; text-transform: uppercase;
  font-weight: 800; margin: 0 0 0.5rem; }
.diffdlg-sub { font-size: 0.75rem; color: #8a7a6a; text-align: center; margin: 0 0 0.75rem; }
/* M339 — three compact buttons (icon + name only) on a 3-col grid. The
   description for the SELECTED button renders below in .diffdlg-desc and
   updates as the user changes selection. Mobile collapses to 1 col only
   below 360px (still fits on iPhone SE). */
.diffdlg-cards { display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem; padding-bottom: 0.5rem; }
.diffdlg-card { background: rgba(0,0,0,0.4);
  border: 1.5px solid rgba(232,160,32,0.25); border-radius: 8px;
  padding: 0.85rem 0.6rem; cursor: pointer; transition: all 0.15s;
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 0.35rem; min-height: 84px;
  text-align: center; }
.diffdlg-card:hover { border-color: rgba(232,160,32,0.6); }
.diffdlg-card.active { border-color: #e8a020; background: rgba(232,160,32,0.12);
  box-shadow: 0 0 12px rgba(232,160,32,0.3); }
.diffdlg-card svg { width: 26px; height: 26px; color: currentColor;
  fill: currentColor; }
.diffdlg-card h3 { margin: 0; font-family: 'Cinzel', serif;
  font-size: 0.85rem; color: #e8a020; letter-spacing: 0.06em; }
.diffdlg-card.active h3 { color: #f8d880; }
.diffdlg-card[data-diff="easy"]   svg { color: #60c080; }
.diffdlg-card[data-diff="normal"] svg { color: #6db3ff; }
.diffdlg-card[data-diff="hard"]   svg { color: #c04030; }

.diffdlg-desc {
  background: rgba(0,0,0,0.35); border: 1px solid rgba(232,160,32,0.2);
  border-radius: 6px; padding: 0.7rem 0.85rem; margin: 0.5rem 0 0.75rem;
  font-size: 0.85rem; line-height: 1.55; color: #d0c8b0;
  min-height: 4.5rem;
}
.diffdlg-desc strong { color: #f8d880; font-family: 'Cinzel', serif; letter-spacing: 0.05em; }
.diffdlg-desc .ddd-bonuses {
  display: flex; gap: 0.6rem; margin-top: 0.5rem; flex-wrap: wrap;
  font-size: 0.78rem;
}
.diffdlg-desc .ddd-bonus {
  padding: 0.15rem 0.55rem; border-radius: 99px;
  background: rgba(232,160,32,0.12); border: 1px solid rgba(232,160,32,0.35);
  color: #f8d880; font-weight: 600;
}
.diffdlg-adv { margin-top: 0.75rem; padding: 0.7rem; background: rgba(0,0,0,0.3);
  border: 1px solid rgba(232,160,32,0.15); border-radius: 4px; }
.diffdlg-adv-h { font-size: 0.7rem; color: #8a7a6a; text-transform: uppercase;
  letter-spacing: 0.1em; margin: 0 0 0.5rem; font-weight: 700; }
/* M337: per-spec grid columns — auto sized checkbox column, 1fr text column. */
.diffdlg-toggle { display: grid; grid-template-columns: auto 1fr; align-items: start;
  gap: 0.55rem; padding: 0.45rem 0;
  font-size: 0.82rem; color: #e8d090; cursor: pointer; min-height: 44px; }
.diffdlg-toggle input { width: 18px; height: 18px; accent-color: #e8a020; margin-top: 2px; }
.diffdlg-toggle .desc { font-size: 0.7rem; color: #8a7a6a; display: block; margin-top: 0.15rem; }
.diffdlg-toggle > span { display: flex; flex-direction: column; }
.diffdlg-toggle input:disabled + span { opacity: 0.78; }
.dd-lock { display: inline-block; margin-top: 0.2rem; font-size: 0.68rem;
  color: #e8a020; letter-spacing: 0.04em; }
.dd-lock[hidden] { display: none; }
.diffdlg-toggle input:disabled { cursor: not-allowed; opacity: 0.55; }
.diffdlg-buttons { display: flex; gap: 0.5rem; margin-top: 0.75rem; }
.diffdlg-btn { flex: 1; background: rgba(20,16,12,0.8); border: 1px solid rgba(232,160,32,0.4);
  color: #e8d090; padding: 0.55rem 0.9rem; border-radius: 4px; cursor: pointer;
  font-weight: 600; min-height: 44px; }
.diffdlg-btn.primary { background: rgba(232,160,32,0.25); color: #f8e0a0; border-color: #e8a020; }
.diffdlg-btn:hover { background: rgba(232,160,32,0.15); }
`;

// M339 — icons + paragraph copy. Hard reports its MF / XP bonuses inline
// because those are gameplay-meaningful and the user wants visibility.
const ICON_HEART_SHIELD = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-4.5-9-10a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 5.5-9 10-9 10z"/></svg>';
const ICON_SHIELD       = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 4 5v7c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V5l-8-3z"/></svg>';
const ICON_SKULL        = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a8 8 0 0 0-5 14v3h2v-2h2v2h2v-2h2v2h2v-3a8 8 0 0 0-5-14zm-3 9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm6 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/></svg>';

const DIFFS = [
  {
    id: 'easy', label: 'Easy', icon: ICON_HEART_SHIELD,
    desc: 'Lower enemy damage and gentler scaling. Auto-managed attribute, passive, and active picks. Town entry restores HP/MP. Great for story play.',
  },
  {
    id: 'normal', label: 'Normal', icon: ICON_SHIELD,
    desc: 'Balanced challenge. The intended pace. Town entry restores HP/MP between fights.',
  },
  {
    id: 'hard', label: 'Hard', icon: ICON_SKULL,
    desc: 'Brutal enemies. Town no longer auto-heals. Save-and-quit only at towns. Combat rewards are richer to compensate.',
    bonuses: { mf: 20, xp: 10 },
  },
];

export class DifficultyDialog {
  constructor(manager, audio, opts = {}) {
    this.manager = manager;
    this.audio = audio;
    // M312 #16: prevent global ESC from opening GameMenuScreen inside this dialog.
    this.noGameMenuEsc = true;
    this._opts = opts;
    this._el = null;
    this._diff = localStorage.getItem('emberveil_difficulty') || 'normal';
    const gs = GameState.get();
    this._fog       = gs.fogOfWar !== false;
    this._hardcore  = !!gs.hardcore;
    this._manual    = !!gs.manualCombat;
    this._manualChars = !!gs.manualCharacters;
    this._mapSeed   = gs.mapSeed || '';
  }

  onEnter() {
    injectStyles('diffdlg-styles', STYLES);
    this._build();
  }
  // M312 #16: was onLeave() which never fired (ScreenManager calls onExit, not onLeave).
  onExit()    { this._cleanupKeyHandler(); removeEl(this._el); this._el = null; }
  onLeave()   { this._cleanupKeyHandler(); removeEl(this._el); this._el = null; }
  destroy()   { this._cleanupKeyHandler(); removeEl(this._el); this._el = null; }
  onPause()   { if (this._el) this._el.style.display = 'none'; }
  onResume()  { if (this._el) this._el.style.display = ''; }

  _build() {
    if (this._el) removeEl(this._el);
    this._el = createEl('div', 'diffdlg-overlay');
    this._el.innerHTML = `
      <div class="diffdlg-panel">
        <h2 class="diffdlg-h">Change Difficulty</h2>
        <p class="diffdlg-sub">Swap difficulty mid-run. Advanced options take effect on the next zone load.</p>
        <div class="diffdlg-cards" id="dd-cards">
          ${DIFFS.map(d => `
            <button type="button" class="diffdlg-card${d.id === this._diff ? ' active' : ''}" data-diff="${d.id}" aria-pressed="${d.id === this._diff}">
              ${d.icon}
              <h3>${d.label}</h3>
            </button>`).join('')}
        </div>
        <div class="diffdlg-desc" id="dd-desc"></div>
        <div class="diffdlg-adv">
          <div class="diffdlg-adv-h">Advanced Options</div>
          <label class="diffdlg-toggle">
            <input type="checkbox" id="dd-fog" ${this._fog ? 'checked' : ''}>
            <span>Fog of War <span class="desc">Hide map nodes until you scout them.</span></span>
          </label>
          <label class="diffdlg-toggle">
            <input type="checkbox" id="dd-hardcore" ${this._hardcore ? 'checked' : ''}>
            <span>Hardcore <span class="desc">Permadeath mode with no town revives.</span></span>
          </label>
          <label class="diffdlg-toggle">
            <input type="checkbox" id="dd-manual-chars" ${this._manualChars ? 'checked' : ''}>
            <span>Manual Characters <span class="desc">Disable automatic inventory, skills, passives, and attribute management.</span></span>
          </label>
          <label class="diffdlg-toggle" id="dd-manual-row">
            <input type="checkbox" id="dd-manual" ${this._manual ? 'checked' : ''} ${this._hardcore ? 'disabled' : ''}>
            <span>Manual Combat <span class="desc">Disable auto-combat and take each turn manually.</span><span class="dd-lock" id="dd-manual-lock" ${this._hardcore ? '' : 'hidden'} title="Hardcore — Manual only" aria-label="Locked: Hardcore requires Manual Combat"> 🔒 Hardcore — Manual only</span></span>
          </label>
          <label class="diffdlg-toggle" style="display:flex;flex-direction:column;align-items:flex-start;gap:0.2rem;padding-top:0.5rem">
            <span style="font-size:0.78rem;color:#e8d090">Map Seed (optional)</span>
            <input type="text" id="dd-seed" value="${this._mapSeed.replace(/"/g,'&quot;')}" placeholder="leave blank for random"
              style="width:100%;background:rgba(0,0,0,0.5);border:1px solid rgba(232,160,32,0.25);color:#f0e8d8;padding:0.4rem;border-radius:3px;font-family:monospace;min-height:44px">
            <span class="desc">Determines tavern rolls + future world generation.</span>
          </label>
        </div>
        <div class="diffdlg-buttons">
          <button type="button" class="diffdlg-btn" id="dd-cancel">Cancel</button>
          <button type="button" class="diffdlg-btn primary" id="dd-apply">Apply</button>
        </div>
      </div>
    `;
    this.manager.uiOverlay.appendChild(this._el);

    const renderDesc = () => {
      const d = DIFFS.find(x => x.id === this._diff) || DIFFS[1];
      const bonuses = d.bonuses
        ? `<div class="ddd-bonuses">
             <span class="ddd-bonus">+${d.bonuses.mf}% Magic Find</span>
             <span class="ddd-bonus">+${d.bonuses.xp}% XP</span>
           </div>`
        : '';
      const el = this._el?.querySelector('#dd-desc');
      if (el) el.innerHTML = `<strong>${d.label}.</strong> ${d.desc}${bonuses}`;
    };
    renderDesc();
    this._el.querySelectorAll('[data-diff]').forEach(card => card.addEventListener('click', () => {
      this._diff = card.dataset.diff;
      this.audio?.playSfx?.('click');
      this._el.querySelectorAll('[data-diff]').forEach(c => {
        const on = c.dataset.diff === this._diff;
        c.classList.toggle('active', on);
        c.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      renderDesc();
    }));
    this._el.querySelector('#dd-fog').addEventListener('change', e => { this._fog = e.target.checked; });
    // M393 — hardcore locks Manual on. Toggling hardcore on forces manual on
    // and disables the manual checkbox. Toggling hardcore off releases the
    // lock; the player keeps whatever manual state they had.
    this._el.querySelector('#dd-hardcore').addEventListener('change', e => {
      this._hardcore = e.target.checked;
      const manualCb = this._el.querySelector('#dd-manual');
      const lockBadge = this._el.querySelector('#dd-manual-lock');
      if (this._hardcore) {
        this._manual = true;
        if (manualCb) { manualCb.checked = true; manualCb.disabled = true; }
        if (lockBadge) lockBadge.hidden = false;
      } else {
        if (manualCb) manualCb.disabled = false;
        if (lockBadge) lockBadge.hidden = true;
      }
    });
    this._el.querySelector('#dd-manual').addEventListener('change', e => {
      if (this._hardcore) { e.target.checked = true; return; }
      this._manual = e.target.checked;
    });
    this._el.querySelector('#dd-manual-chars').addEventListener('change', e => { this._manualChars = e.target.checked; });
    this._el.querySelector('#dd-seed').addEventListener('change', e => { this._mapSeed = e.target.value; });
    this._el.querySelector('#dd-cancel').addEventListener('click', () => {
      this.audio?.playSfx?.('click'); this.manager.pop();
    });
    this._el.querySelector('#dd-apply').addEventListener('click', () => {
      this.audio?.playSfx?.('click');
      try { localStorage.setItem('emberveil_difficulty', this._diff); } catch (_) {}
      const gs = GameState.get();
      gs.fogOfWar     = this._fog;
      gs.hardcore     = this._hardcore;
      gs.manualCombat = this._manual;
      gs.manualCharacters = this._manualChars;
      gs.mapSeed      = this._mapSeed;
      this.manager.pop();
    });
    this._el.addEventListener('click', e => {
      if (e.target === this._el) { this.audio?.playSfx?.('click'); this.manager.pop(); }
    });
    // M312 #16: Escape key closes the dialog cleanly.
    this._keyHandler = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); this.audio?.playSfx?.('click'); this.manager.pop(); }
    };
    document.addEventListener('keydown', this._keyHandler, { capture: true });
  }

  _cleanupKeyHandler() {
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler, { capture: true });
      this._keyHandler = null;
    }
  }
}
