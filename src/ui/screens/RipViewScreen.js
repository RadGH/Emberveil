/**
 * RipViewScreen — read-only view of a fallen Hardcore run.
 *
 * Reachable from LoadGameScreen for any save with `rip != null`. Loads the
 * save into GameState (so the existing readers work) but does NOT route the
 * player back to play — instead shows party, gold, items, and stats.
 */

import { createEl, removeEl, injectStyles } from '../../utils/dom.js';
import { GameState } from '../../game/gameState.js';
import { portraitImg } from '../../game/spriteUtils.js';
import { RARITY_COLORS } from '../../game/items.js';
import { getCharStats, getCharLog } from '../../game/stats.js';

export class RipViewScreen {
  constructor(manager, audio) {
    this.manager = manager;
    this.audio = audio;
    this.noGameMenuEsc = true;
  }
  onEnter() {
    injectStyles('rip-styles', RIP_STYLES);
    this._el = createEl('div', 'rip-screen');
    document.body.appendChild(this._el);
    this._render();
  }
  onExit() { removeEl(this._el); this._el = null; }
  destroy() { removeEl(this._el); this._el = null; }
  update() {} draw() {}

  _render() {
    const gs = GameState.get();
    const rip = gs.rip || {};
    const party = [...(gs.party || []), ...(gs.companions || [])];
    const ripDate = rip.date ? new Date(rip.date).toLocaleString() : '—';

    this._el.innerHTML = `
      <div class="rip-header">
        <div class="rip-skull">⚰</div>
        <div class="rip-title-block">
          <div class="rip-title">RIP</div>
          <div class="rip-sub">Hardcore — fell ${ripDate} in <em>${rip.zoneId || 'an unknown place'}</em></div>
        </div>
        <button class="rip-close" id="rip-close">✕ Close</button>
      </div>

      <div class="rip-body">
        <div class="rip-section">
          <div class="rip-section-title">Final Party</div>
          <div class="rip-party">
            ${party.map(m => {
              const cs = getCharStats(m.id);
              return `
                <div class="rip-card">
                  <div class="rip-card-portrait">${portraitImg(m, 56, 'rip-portrait')}</div>
                  <div class="rip-card-info">
                    <div class="rip-card-name">${m.name}</div>
                    <div class="rip-card-class">${m.cls || m.class || 'companion'} · L${m.level || 1}</div>
                    <div class="rip-card-stats">
                      <span title="Kills">⚔ ${cs.kills}</span>
                      <span title="Damage Dealt">${this._fmt(cs.damageDealt)} dmg</span>
                      <span title="Heals Given">+${this._fmt(cs.heals)}</span>
                      <span title="Deaths">☠ ${cs.deaths}</span>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div class="rip-section">
          <div class="rip-section-title">Inventory</div>
          ${(gs.inventory || []).length ? `
            <div class="rip-items">
              ${gs.inventory.map(i => `
                <div class="rip-item" style="border-color:var(--rarity-${i.rarity}, #8a7a6a)">
                  <div class="rii-name" style="color:var(--rarity-${i.rarity}, #f0e8d8)">${i.name}</div>
                  <div class="rii-type">${i.subtype || i.type}</div>
                </div>
              `).join('')}
            </div>` : `<div class="rip-empty">No items remained.</div>`}
        </div>

        <div class="rip-section">
          <div class="rip-section-title">Final Log</div>
          <div class="rip-log">
            ${this._collectLog(party).slice(0, 30).map(e => `
              <div class="rip-log-row" data-type="${e.type}">
                <span class="rip-log-tag">${e.type}</span>
                <span class="rip-log-text">${e.who}: ${e.summary}</span>
              </div>
            `).join('') || `<div class="rip-empty">No notable events recorded.</div>`}
          </div>
        </div>

        <div class="rip-actions">
          <button class="rip-btn" id="rip-stats">📊 Full Statistics</button>
          <button class="rip-btn rip-btn-danger" id="rip-back">← Back</button>
        </div>
      </div>
    `;

    this._el.querySelector('#rip-close').addEventListener('click', () => { this.audio.playSfx('click'); this.manager.pop(); });
    this._el.querySelector('#rip-back').addEventListener('click', () => { this.audio.playSfx('click'); this.manager.pop(); });
    this._el.querySelector('#rip-stats').addEventListener('click', async () => {
      this.audio.playSfx('click');
      const { StatsScreen } = await import('./StatsScreen.js');
      this.manager.push(new StatsScreen(this.manager, this.audio, { tab: 'party' }));
    });
  }

  _collectLog(party) {
    const all = [];
    for (const p of party) {
      for (const e of getCharLog(p.id)) all.push({ ...e, who: p.name });
    }
    all.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    return all;
  }
  _fmt(v) { return v >= 1000 ? (v/1000).toFixed(1)+'k' : Math.round(v).toString(); }
}

const RIP_STYLES = `
.rip-screen { position: absolute; inset: 0; background: linear-gradient(180deg,#0a0608,#1a0808); color: #f0e8d8; font-family: 'Inter',sans-serif; overflow-y: auto; z-index: 100; display: flex; flex-direction: column; }
.rip-header { display: flex; align-items: center; gap: 1rem; padding: 1rem 1.25rem; border-bottom: 1px solid rgba(192,64,48,0.35); background: rgba(0,0,0,0.5); flex-shrink: 0; }
.rip-skull { font-size: 2rem; color: #c04030; }
.rip-title-block { flex: 1; }
.rip-title { font-family: 'Cinzel',serif; font-size: 1.5rem; font-weight: 900; letter-spacing: 0.2em; color: #c04030; text-transform: uppercase; }
.rip-sub { font-size: 0.78rem; color: #8a7a6a; }
.rip-sub em { color: #c0a070; font-style: normal; }
.rip-close { background: none; border: none; color: #8a7a6a; cursor: pointer; padding: 0.4rem 0.8rem; font-size: 0.78rem; }
.rip-body { padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 1rem; }
.rip-section-title { font-family: 'Cinzel',serif; font-size: 0.78rem; letter-spacing: 0.12em; text-transform: uppercase; color: #c0a070; margin-bottom: 0.5rem; }
.rip-party { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 8px; }
.rip-card { display: flex; gap: 0.65rem; background: rgba(0,0,0,0.35); border: 1px solid rgba(192,64,48,0.2); border-radius: 6px; padding: 0.6rem 0.75rem; }
.rip-card-portrait { width: 56px; height: 56px; flex-shrink: 0; overflow: hidden; border-radius: 6px; background: rgba(255,255,255,0.04); display: flex; align-items: center; justify-content: center; filter: grayscale(0.6); }
.rip-card-name { font-family: 'Cinzel',serif; font-size: 0.95rem; color: #e8a020; }
.rip-card-class { font-size: 0.7rem; color: #8a7a6a; text-transform: uppercase; letter-spacing: 0.06em; }
.rip-card-stats { display: flex; gap: 0.65rem; margin-top: 4px; font-family: 'JetBrains Mono', monospace; font-size: 0.74rem; color: #c0b090; }
.rip-items { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 6px; }
.rip-item { background: rgba(0,0,0,0.35); border: 1px solid; border-radius: 4px; padding: 0.4rem 0.6rem; opacity: 0.85; }
.rii-name { font-size: 0.78rem; font-weight: 600; }
.rii-type { font-size: 0.66rem; color: #8a7a6a; text-transform: uppercase; letter-spacing: 0.06em; }
.rip-log { display: flex; flex-direction: column; gap: 4px; max-height: 320px; overflow-y: auto; }
.rip-log-row { display: flex; gap: 0.5rem; padding: 0.35rem 0.6rem; background: rgba(0,0,0,0.25); border-radius: 4px; font-size: 0.78rem; }
.rip-log-tag { font-size: 0.62rem; color: #8a7a6a; text-transform: uppercase; letter-spacing: 0.08em; min-width: 80px; }
.rip-log-row[data-type="major_kill"] { border-left: 3px solid #e8a020; }
.rip-log-row[data-type="death"] { border-left: 3px solid #c04030; }
.rip-empty { padding: 1rem; text-align: center; color: #4a3a32; font-size: 0.85rem; }
.rip-actions { display: flex; justify-content: center; gap: 0.6rem; margin: 1rem 0 2rem; }
.rip-btn { background: rgba(232,160,32,0.1); border: 1px solid rgba(232,160,32,0.4); color: #e8a020; padding: 0.6rem 1rem; border-radius: 6px; font-size: 0.78rem; cursor: pointer; min-height: 44px; font-family: 'Cinzel',serif; letter-spacing: 0.06em; }
.rip-btn-danger { background: rgba(192,64,48,0.1); border-color: rgba(192,64,48,0.4); color: #ff8a70; }
`;
