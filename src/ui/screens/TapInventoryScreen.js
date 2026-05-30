import { createEl, removeEl, injectStyles } from '../../utils/dom.js';
import { GameState } from '../../game/gameState.js';
import { TAP_WEAPONS, TAP_UTILITIES, getTapItem } from '../../game/tapWeapons.js';

injectStyles('tap-inv-styles', `
  .tapinv-screen { position: fixed; inset: 0; background: linear-gradient(180deg, #0e0a14 0%, #1a1020 100%); color: #f0e8d8; font-family: 'Inter', sans-serif; display: flex; flex-direction: column; z-index: 500; overflow: hidden; }
  .tapinv-header { display: flex; align-items: center; gap: 0.75rem; padding: 0.85rem 1rem; border-bottom: 1px solid rgba(232,160,32,0.22); background: rgba(0,0,0,0.35); }
  .tapinv-title { font-size: 1.05rem; font-weight: 700; color: #ffe080; letter-spacing: 0.05em; flex: 1; }
  .tapinv-cd { font-size: 0.75rem; color: #c0a060; font-weight: 600; }
  .tapinv-back { background: #2a1f38; border: 1px solid #5a4068; color: #f0e8d8; padding: 0.45rem 0.85rem; border-radius: 6px; cursor: pointer; font-size: 0.8rem; min-height: 40px; }
  .tapinv-back:hover { background: #3a2d48; }
  .tapinv-body { flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; padding: 0.75rem; overflow: hidden; min-height: 0; }
  @media (max-width: 560px) { .tapinv-body { grid-template-columns: 1fr; overflow-y: auto; } }
  .tapinv-col { display: flex; flex-direction: column; min-height: 0; background: rgba(20, 12, 28, 0.55); border: 1px solid rgba(232,160,32,0.18); border-radius: 10px; overflow: hidden; }
  .tapinv-col-title { font-size: 0.7rem; font-weight: 700; color: #e8a020; letter-spacing: 0.12em; text-transform: uppercase; padding: 0.6rem 0.8rem; border-bottom: 1px solid rgba(232,160,32,0.18); background: rgba(0,0,0,0.35); }
  .tapinv-equipped { padding: 0.75rem; border-bottom: 1px solid rgba(232,160,32,0.14); display: flex; gap: 0.75rem; align-items: center; background: rgba(40,30,60,0.35); }
  .tapinv-eq-icon { width: 72px; height: 72px; flex-shrink: 0; background: rgba(0,0,0,0.45); border: 2px solid #e8a020; border-radius: 8px; box-shadow: 0 0 14px rgba(232,160,32,0.35); }
  .tapinv-eq-info { flex: 1; min-width: 0; }
  .tapinv-eq-name { font-size: 0.95rem; font-weight: 700; color: #ffe080; margin-bottom: 0.15rem; }
  .tapinv-eq-cd { font-size: 0.68rem; color: #c0a060; margin-bottom: 0.25rem; }
  .tapinv-eq-desc { font-size: 0.7rem; line-height: 1.35; color: #c0b090; }
  .tapinv-eq-none { padding: 0.75rem; color: #8a7a6a; font-size: 0.75rem; font-style: italic; text-align: center; border-bottom: 1px solid rgba(232,160,32,0.14); background: rgba(40,30,60,0.2); }
  .tapinv-list { flex: 1; overflow-y: auto; padding: 0.5rem; display: flex; flex-direction: column; gap: 0.4rem; min-height: 0; }
  .tapinv-row { display: flex; gap: 0.6rem; align-items: center; padding: 0.5rem; background: rgba(30,22,42,0.55); border: 1px solid rgba(232,160,32,0.12); border-radius: 6px; cursor: pointer; transition: background 0.12s, border-color 0.12s; min-height: 56px; }
  .tapinv-row:hover { background: rgba(50,38,70,0.65); border-color: rgba(232,160,32,0.35); }
  .tapinv-row.is-equipped { border-color: #e8a020; background: rgba(60,42,80,0.65); }
  .tapinv-row.is-locked { opacity: 0.4; cursor: default; }
  .tapinv-row.is-locked:hover { background: rgba(30,22,42,0.55); border-color: rgba(232,160,32,0.12); }
  .tapinv-row-icon { width: 44px; height: 44px; flex-shrink: 0; background: rgba(0,0,0,0.4); border-radius: 6px; }
  .tapinv-row-info { flex: 1; min-width: 0; }
  .tapinv-row-name { font-size: 0.78rem; font-weight: 700; color: #f0e8d8; }
  .tapinv-row-cd { font-size: 0.6rem; color: #8a7a6a; margin-top: 0.1rem; }
  .tapinv-row-desc { font-size: 0.62rem; color: #8a7a6a; line-height: 1.3; margin-top: 0.15rem; }
  .tapinv-empty { color: #6a5a48; font-size: 0.72rem; font-style: italic; text-align: center; padding: 1rem; }
`);

export class TapInventoryScreen {
  constructor(manager, audio) {
    this.manager = manager;
    this.audio = audio;
    this._el = null;
  }

  onEnter() {
    this._el = createEl('div', 'tapinv-screen');
    this._render();
    this.manager.uiOverlay.appendChild(this._el);
    this._esc = (e) => { if (e.code === 'Escape') { this.audio.playSfx('click'); this.manager.pop(); } };
    window.addEventListener('keydown', this._esc);
  }

  _cdLabel(def) {
    if (!def) return '';
    const c = def.cooldown;
    if (!c || !c.amount) return 'No cooldown';
    return `Cooldown: ${c.amount} ${c.unit}`;
  }

  _drawIcon(canvas, def) {
    if (!def) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    try { def.icon(ctx, w / 2, h / 2, Math.min(w, h)); } catch (_) {}
  }

  _renderColumn(type) {
    const owned = GameState.getTapInventory();
    const pool = type === 'weapon' ? TAP_WEAPONS : TAP_UTILITIES;
    const equippedId = type === 'weapon' ? GameState.getEquippedTapWeapon() : GameState.getEquippedTapUtility();
    const equippedDef = equippedId ? getTapItem(equippedId) : null;

    const equippedHtml = equippedDef ? `
      <div class="tapinv-equipped">
        <canvas class="tapinv-eq-icon" width="96" height="96" data-eq-icon="${type}"></canvas>
        <div class="tapinv-eq-info">
          <div class="tapinv-eq-name">${equippedDef.name}</div>
          <div class="tapinv-eq-cd">${this._cdLabel(equippedDef)}</div>
          <div class="tapinv-eq-desc">${equippedDef.description}</div>
        </div>
      </div>
    ` : `<div class="tapinv-eq-none">No ${type} equipped</div>`;

    const ownedDefs = pool.filter(d => owned.includes(d.id));
    const unownedDefs = pool.filter(d => !owned.includes(d.id));

    const rowHtml = (d, locked) => `
      <div class="tapinv-row ${!locked && d.id === equippedId ? 'is-equipped' : ''} ${locked ? 'is-locked' : ''}" data-id="${d.id}" data-type="${type}" data-locked="${locked}">
        <canvas class="tapinv-row-icon" width="64" height="64" data-row-icon="${d.id}"></canvas>
        <div class="tapinv-row-info">
          <div class="tapinv-row-name">${d.name}${locked ? ' 🔒' : ''}</div>
          <div class="tapinv-row-cd">${this._cdLabel(d)}</div>
          <div class="tapinv-row-desc">${d.description}</div>
        </div>
      </div>
    `;

    const listHtml = `
      <div class="tapinv-list">
        ${ownedDefs.length ? ownedDefs.map(d => rowHtml(d, false)).join('') : '<div class="tapinv-empty">None owned yet.</div>'}
        ${unownedDefs.map(d => rowHtml(d, true)).join('')}
      </div>
    `;

    return `
      <div class="tapinv-col" data-col="${type}">
        <div class="tapinv-col-title">Tap ${type === 'weapon' ? 'Weapons' : 'Utilities'}</div>
        ${equippedHtml}
        ${listHtml}
      </div>
    `;
  }

  _render() {
    const gs = GameState.get();
    const cdText = gs.tapCooldown > 0 ? `Cooldown ${gs.tapCooldown} ${gs.tapCooldownUnit}` : 'Ready';
    this._el.innerHTML = `
      <header class="tapinv-header">
        <div class="tapinv-title">Tap Inventory</div>
        <div class="tapinv-cd">${cdText}</div>
        <button type="button" class="tapinv-back" id="tapinv-back">Back</button>
      </header>
      <div class="tapinv-body">
        ${this._renderColumn('weapon')}
        ${this._renderColumn('utility')}
      </div>
    `;

    this._el.querySelectorAll('[data-eq-icon]').forEach(c => {
      const type = c.dataset.eqIcon;
      const id = type === 'weapon' ? GameState.getEquippedTapWeapon() : GameState.getEquippedTapUtility();
      const def = id ? getTapItem(id) : null;
      if (def) this._drawIcon(c, def);
    });
    this._el.querySelectorAll('[data-row-icon]').forEach(c => {
      const def = getTapItem(c.dataset.rowIcon);
      if (def) this._drawIcon(c, def);
    });

    this._el.querySelector('#tapinv-back').addEventListener('click', () => {
      this.audio.playSfx('click');
      this.manager.pop();
    });

    this._el.querySelectorAll('.tapinv-row').forEach(row => {
      row.addEventListener('click', () => {
        if (row.dataset.locked === 'true') return;
        const id = row.dataset.id;
        const type = row.dataset.type;
        this.audio.playSfx('click');
        if (type === 'weapon') GameState.equipTapWeapon(id);
        else GameState.equipTapUtility(id);
        this._render();
      });
    });
  }

  onPause() { if (this._el) this._el.style.display = 'none'; }
  onResume() { if (this._el) this._el.style.display = 'flex'; }
  onExit() {
    window.removeEventListener('keydown', this._esc);
    removeEl(this._el);
    this._el = null;
  }
  destroy() { this.onExit(); }
  update() {}
  draw() {}
}
