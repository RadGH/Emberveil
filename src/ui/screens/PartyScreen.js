/**
 * PartyScreen — manage the active party and bench
 * Players can swap heroes/companions between party and bench,
 * reorder the party, and view each member's stats.
 */
import { createEl, removeEl, injectStyles } from '../../utils/dom.js';
import { GameState } from '../../game/gameState.js';
import { preserveScroll } from '../components/ScrollPreserve.js';
import { SaveManager } from '../../engine/SaveManager.js';
import { PartyPanelScreen } from './PartyPanelScreen.js';
import { portraitImg, classIconSvg } from '../../game/spriteUtils.js';
import { CLASSES } from '../../game/classes.js';
import { newBadgeIfRecent } from '../../game/featureRegistry.js';
import { xpForLevel, xpForNextLevel } from '../../game/xp.js';

export function isCompanionEntity(m) {
  if (!m) return false;
  return !!m.isCompanion || m.class === 'companion';
}
export function isHeroEntity(m) { return !isCompanionEntity(m); }

const STYLES = `
.party-screen {
  position: absolute; inset: 0; background: rgba(4,2,10,0.97);
  display: flex; flex-direction: column; overflow: hidden; color: #e8e0d0;
  font-family: 'Cinzel', Georgia, serif;
}
.ps-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1rem 0.5rem; border-bottom: 1px solid rgba(255,200,80,0.25);
  flex-shrink: 0;
}
.ps-title { font-size: 1.1rem; color: #e8c840; letter-spacing: 0.1em; }
.ps-close {
  background: none; border: 1px solid rgba(255,200,80,0.4); color: #e8c840;
  padding: 0.35rem 0.8rem; border-radius: 4px; cursor: pointer; font-size: 0.85rem;
  font-family: inherit;
}
.ps-body {
  flex: 1; overflow-y: auto; padding: 0.75rem;
  display: flex; flex-direction: column; gap: 0.75rem;
}
.ps-section-title {
  font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.15em;
  color: rgba(232,200,64,0.7); margin-bottom: 0.25rem;
}
.ps-slots {
  display: grid; grid-template-columns: 1fr; gap: 0.4rem;
}
@media (min-width: 560px) {
  .ps-slots { grid-template-columns: 1fr 1fr; }
}
.ps-slot {
  display: flex; align-items: center; gap: 0.6rem;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px; padding: 0.5rem 0.75rem; cursor: pointer;
  transition: border-color 0.15s;
}
.ps-slot:hover { border-color: rgba(232,200,64,0.5); }
.ps-slot.ps-selected { border-color: #e8c840; background: rgba(232,200,64,0.1); }
.ps-slot.ps-empty {
  border-style: dashed; border-color: rgba(255,255,255,0.15);
  cursor: default; opacity: 0.5;
}
.ps-slot-icon {
  width: 80px; height: 80px; border-radius: 8px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 1rem; background: rgba(255,255,255,0.08); overflow: hidden;
  padding: 5px; box-sizing: border-box;
}
.ps-slot-icon .char-portrait {
  border-radius: 6px; background: rgba(255,255,255,0.06);
  width: 100% !important; height: 100% !important;
}
.ps-slot-class-icon { margin-left: 4px; display: inline-flex; vertical-align: middle; }
.ps-slot-info { flex: 1; min-width: 0; }
.ps-slot-name { font-size: 0.9rem; font-weight: 700; color: #f0e8d8; }
.ps-slot-class { font-size: 0.72rem; color: rgba(200,180,140,0.7); text-transform: uppercase; letter-spacing: 0.08em; }
.ps-slot-stats { font-size: 0.72rem; color: rgba(200,180,140,0.6); margin-top: 0.15rem; }
/* M337 — XP progress strip beneath HP/MP. Hover reveals current/next-level
   target via the title attribute set in _xpBar(). */
.ps-xp-row { display: flex; align-items: center; gap: 0.4rem; margin-top: 0.3rem; }
.ps-xp-label { font-size: 0.62rem; letter-spacing: 0.08em; text-transform: uppercase; color: #e8c840; font-weight: 700; flex: 0 0 auto; }
.ps-xp-bar { flex: 1 1 auto; height: 5px; background: rgba(255,255,255,0.06); border-radius: 2px; overflow: hidden; border: 1px solid rgba(232,200,64,0.25); }
.ps-xp-fill { height: 100%; background: linear-gradient(90deg, #c89020, #f8e890); border-radius: 2px; transition: width 0.25s ease; }
.ps-slot-badge { display: none; }
.ps-columns { display: flex; flex-direction: column; gap: 0.75rem; }
@media (min-width: 760px) {
  .ps-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; align-items: start; }
  .ps-col { display: flex; flex-direction: column; gap: 0.75rem; }
}
.ps-detail {
  margin-top: 0.5rem; padding: 0.6rem 0.75rem; background: rgba(232,200,64,0.06);
  border: 1px solid rgba(232,200,64,0.3); border-radius: 6px;
}
.ps-detail-title { color: #e8c840; font-size: 0.85rem; margin-bottom: 0.35rem; display: flex; flex-wrap: wrap; align-items: center; gap: 0.35rem; }
.ps-rename-display { cursor: text; padding: 1px 4px; border-radius: 3px; border: 1px dashed transparent; }
.ps-rename-display:hover, .ps-rename-display:focus { border-color: rgba(232,200,64,0.5); outline: none; }
.ps-rename-input {
  font-family: inherit; font-size: 0.85rem; color: #f0e8d8;
  background: rgba(0,0,0,0.5); border: 1px solid rgba(232,200,64,0.55);
  border-radius: 3px; padding: 2px 6px; min-height: 28px; min-width: 9rem;
}
.ps-default-name { font-size: 0.65rem; color: rgba(232,200,64,0.55); font-style: italic; letter-spacing: 0.04em; }
.ps-detail-btns { display: flex; gap: 0.4rem; flex-wrap: wrap; }
.ps-detail-btn {
  background: rgba(232,200,64,0.15); border: 1px solid rgba(232,200,64,0.5);
  color: #e8c840; padding: 0.35rem 0.75rem; border-radius: 4px; cursor: pointer;
  font-family: inherit; font-size: 0.72rem;
}
.ps-action-bar {
  flex-shrink: 0; padding: 0.75rem; display: flex; gap: 0.5rem; justify-content: center;
  border-top: 1px solid rgba(255,200,80,0.15);
}
.ps-btn {
  background: rgba(232,200,64,0.15); border: 1px solid rgba(232,200,64,0.5);
  color: #e8c840; padding: 0.5rem 1.2rem; border-radius: 5px; cursor: pointer;
  font-family: inherit; font-size: 0.85rem;
}
.ps-btn:hover { background: rgba(232,200,64,0.25); }
.ps-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.ps-hint {
  font-size: 0.72rem; color: rgba(200,180,140,0.55); text-align: center;
  padding: 0.35rem 0; font-family: sans-serif; letter-spacing: 0;
}
.ps-divider { height: 1px; background: rgba(255,200,80,0.12); margin: 0.25rem 0; }
.ps-slot-actions { display: flex; gap: 0.3rem; flex-shrink: 0; }
.ps-slot-btn {
  font-family: inherit; font-size: 0.65rem; padding: 0.25rem 0.5rem; border-radius: 4px;
  cursor: pointer; border: 1px solid; background: none; white-space: nowrap;
}
.ps-slot-btn.dismiss { color: #c08040; border-color: rgba(192,128,64,0.5); }
.ps-slot-btn.dismiss:hover { background: rgba(192,128,64,0.15); }
.ps-slot-btn.recruit { color: #60c060; border-color: rgba(96,192,96,0.5); }
.ps-slot-btn.recruit:hover { background: rgba(96,192,96,0.15); }
.ps-slot-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.ps-toast {
  position: absolute; bottom: 5rem; left: 50%; transform: translateX(-50%);
  background: rgba(20,12,28,0.95); border: 1px solid rgba(232,200,64,0.4);
  color: #e8c840; padding: 0.5rem 1rem; border-radius: 6px; font-size: 0.78rem;
  pointer-events: none; z-index: 10; animation: ps-fade 2s ease-out forwards;
}
@keyframes ps-fade { 0%{opacity:1} 70%{opacity:1} 100%{opacity:0} }
.ps-role-badge {
  display: inline-flex; align-items: center; justify-content: center;
  width: 16px; height: 16px; border-radius: 3px;
  background: rgba(120,120,120,0.18);
  border: 1px solid rgba(120,120,120,0.35);
  vertical-align: middle; margin-left: 3px; cursor: default;
  flex-shrink: 0; opacity: 0.92;
}
`;

// M293 — Role badge. Derives canonical role from CLASSES[].role string;
// returns an SVG chip with color-coded fill (tank=blue, healer=green,
// support=yellow, dps=red). Companions get no badge.
const ROLE_DEFS = {
  tank:    { label: 'Tank',    color: '#4080c0', svg: '<rect x="3" y="7" width="8" height="7" rx="1"/><path d="M7 3L3 7h8z"/>' },
  healer:  { label: 'Healer', color: '#40c080', svg: '<path d="M7 3v8M3 7h8"/>' },
  support: { label: 'Support', color: '#c8a020', svg: '<path d="M7 2l1.5 4H13l-3.5 2.5 1.3 4L7 10 3.2 12.5l1.3-4L1 6h4.5z"/>' },
  dps:     { label: 'DPS',    color: '#c04040', svg: '<path d="M3 11L11 3M9 3h2v2"/><path d="M3 11l3-1 1-3"/>' },
};

function _classRoleKey(member) {
  if (!member.class || member.class === 'companion' || member.isCompanion) return null;
  const cls = CLASSES.find(c => c.id === member.class);
  const role = cls?.role || '';
  if (/tank|front|wall|fortress/i.test(role)) return 'tank';
  if (/heal|cleric|medic|restor/i.test(role)) return 'healer';
  if (/support|buff|maestro|bard|shaman/i.test(role)) return 'support';
  return 'dps';
}

function _roleBadgeSvg(member) {
  const key = _classRoleKey(member);
  if (!key) return '';
  const def = ROLE_DEFS[key];
  return `<span class="ps-role-badge" title="${def.label}" aria-label="Role: ${def.label}" style="--rb-color:${def.color}"><svg viewBox="0 0 14 14" width="14" height="14" fill="${def.color}" stroke="${def.color}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${def.svg}</svg></span>${newBadgeIfRecent('role_badges')}`;
}

function _hpBar(m) {
  // M450: defensive clamp at display time. Some code paths add HP without
  // a Math.min (e.g. legacy heal effects, save loads where maxHp got
  // recomputed lower) so we'd otherwise show "365/180" or "201/200".
  // The persisted hp also gets clamped here so subsequent reads match.
  if (typeof m.hp === 'number' && typeof m.maxHp === 'number' && m.hp > m.maxHp) {
    m.hp = m.maxHp;
  }
  const pct = Math.round(((m.hp || 0) / (m.maxHp || 1)) * 100);
  const col = pct > 60 ? '#60c060' : pct > 30 ? '#e8c840' : '#e06040';
  const hpCur = typeof m.hp === 'number' ? Math.floor(m.hp) : (m.hp ?? '?');
  const hpMax = typeof m.maxHp === 'number' ? Math.floor(m.maxHp) : (m.maxHp ?? '?');
  return `HP: <span style="color:${col}">${hpCur}/${hpMax}</span>`;
}

// M337 — XP progress strip for the Party Management slot. Companions
// don't level via XP so they get an empty placeholder.
function _xpBar(m) {
  if (!m || m.isCompanion || m.class === 'companion') return '';
  const lvl = m.level || 1;
  const xp = m.xp || 0;
  const cur = xpForLevel(lvl);
  const next = xpForNextLevel(lvl);
  if (next == null) {
    return `<div class="ps-xp-row"><span class="ps-xp-label">XP:</span><div class="ps-xp-bar" title="MAX (Level ${lvl})"><div class="ps-xp-fill" style="width:100%"></div></div></div>`;
  }
  const span = Math.max(1, next - cur);
  const into = Math.max(0, xp - cur);
  const pct = Math.max(0, Math.min(100, Math.round((into / span) * 100)));
  const tip = `XP: ${xp} / ${next} (Level ${lvl} → ${lvl + 1})`;
  return `<div class="ps-xp-row"><span class="ps-xp-label">XP:</span><div class="ps-xp-bar" title="${tip}"><div class="ps-xp-fill" style="width:${pct}%"></div></div></div>`;
}

export class PartyScreen {
  constructor(manager, audio) {
    this.manager = manager;
    this.audio = audio;
    this._el = null;
    this._selectedA = null; // { source: 'party'|'companions'|'bench', index }
  }

  onEnter() { this._build(); }
  onPause() { if (this._el) this._el.style.display = 'none'; }
  onResume() { if (this._el) this._el.style.display = 'flex'; }
  onExit() { removeEl(this._el); this._el = null; }

  _build() {
    injectStyles('party-screen-styles', STYLES);
    this._el = createEl('div', 'party-screen');
    this.manager.uiOverlay.appendChild(this._el);
    this._render();
  }

  _render() {
    return preserveScroll(this._el, () => this._renderImpl());
  }

  _renderImpl() {
    const gs = GameState.get();
    const bench = gs.bench || [];
    const inactiveHeroes = bench.filter(m => !isCompanionEntity(m));
    const inactiveCompanions = bench.filter(m => isCompanionEntity(m));
    const heroCol = `
      <div class="ps-col">
        <div class="ps-section-title">Active Heroes (${gs.party.length}/4)</div>
        <div class="ps-slots">
          ${gs.party.map((m,i) => this._slotHTML(m, 'party', i)).join('')}
          ${gs.party.length < 4 ? `<div class="ps-slot ps-empty"><div class="ps-slot-icon">＋</div><div class="ps-slot-info" style="color:rgba(200,180,140,0.4)">Empty slot</div></div>` : ''}
        </div>
        <div class="ps-section-title">Inactive Heroes (${inactiveHeroes.length})</div>
        <div class="ps-slots">
          ${inactiveHeroes.length > 0 ? inactiveHeroes.map(m => this._slotHTML(m, 'bench', bench.indexOf(m))).join('') :
            '<div class="ps-hint">No inactive heroes.</div>'}
        </div>
      </div>`;
    const compCol = `
      <div class="ps-col">
        <div class="ps-section-title">Companions (${gs.companions.length}/4)</div>
        <div class="ps-slots">
          ${gs.companions.length > 0 ? gs.companions.map((m,i) => this._slotHTML(m, 'companions', i)).join('') :
            '<div class="ps-hint">No companions.</div>'}
        </div>
        <div class="ps-section-title">Inactive Companions (${inactiveCompanions.length})</div>
        <div class="ps-slots">
          ${inactiveCompanions.length > 0 ? inactiveCompanions.map(m => this._slotHTML(m, 'bench', bench.indexOf(m))).join('') :
            '<div class="ps-hint">No inactive companions.</div>'}
        </div>
      </div>`;
    this._el.innerHTML = `
      <div class="ps-header">
        <div class="ps-title">Party Management</div>
        <button type="button" class="ps-close" id="ps-close">✕ Close</button>
      </div>
      <div class="ps-body">
        <div class="ps-columns">${heroCol}${compCol}</div>
        ${this._selectedA ? this._detailHTML() : ''}
      </div>
      <div class="ps-action-bar">
        <button type="button" class="ps-btn" id="ps-swap" ${!this._canSwap() ? 'disabled' : ''}>⇄ Swap</button>
        <button type="button" class="ps-btn" id="ps-move-up" ${!this._canMoveUp() ? 'disabled' : ''}>↑ Up</button>
        <button type="button" class="ps-btn" id="ps-move-down" ${!this._canMoveDown() ? 'disabled' : ''}>↓ Down</button>
        <button type="button" class="ps-btn" id="ps-stats"><svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><rect x="1" y="7" width="2" height="4"/><rect x="5" y="4" width="2" height="7"/><rect x="9" y="1" width="2" height="10"/></svg> Stats</button>
      </div>
      <div class="ps-hint">${this._selectedA ? '✓ Selected: ' + this._getSelected()?.name + ' — select another to swap, or use Up/Down to reorder.' : 'Tap a hero to select them.'}</div>
    `;
    this._wire();
  }

  _detailHTML() {
    const m = this._getSelected();
    if (!m) return '';
    // M398 — surface the default name as a hint when the player has set a
    // custom one. Editing happens inline on click.
    const defaultName = m.defaultName || m.name;
    const customNote = (m.customName && m.customName !== defaultName)
      ? `<span class="ps-default-name" title="Default name (cleared if rename is left blank)">orig: ${defaultName}</span>`
      : '';
    return `
      <div class="ps-detail">
        <div class="ps-detail-title">
          <span id="ps-rename-display" class="ps-rename-display" tabindex="0" role="button" aria-label="Rename ${m.name}" title="Tap name to rename">${m.name}</span>
          <input type="text" id="ps-rename-input" class="ps-rename-input" value="${(m.customName || '').replace(/"/g,'&quot;')}" placeholder="${defaultName}" maxlength="24" hidden>
          ${classIconSvg(m, 14, 'ps-slot-class-icon')} — ${m.className || m.class} Lv.${m.level || 1}
          ${customNote}
        </div>
        <div class="ps-detail-btns">
          <button type="button" class="ps-detail-btn" id="ps-detail-rename">Rename</button>
          <button type="button" class="ps-detail-btn" id="ps-detail-inv">Inventory</button>
          <button type="button" class="ps-detail-btn" id="ps-detail-spells">Spells</button>
          <button type="button" class="ps-detail-btn" id="ps-detail-passives">Passives</button>
          <button type="button" class="ps-detail-btn" id="ps-detail-attrs">Attributes</button>
        </div>
      </div>`;
  }

  // M398 — rename support. customName overrides the original (default) name
  // for display; clearing customName falls back to defaultName so the player
  // can always undo. We mutate `name` too so every existing UI reader keeps
  // working without a bulk getter refactor.
  _commitRename(input) {
    const m = this._getSelected();
    if (!m || !input) return;
    const raw = (input.value || '').trim();
    if (!m.defaultName) m.defaultName = m.name;
    if (!raw) {
      // Blank → revert to default.
      m.customName = '';
      m.name = m.defaultName;
    } else if (raw === m.defaultName) {
      m.customName = '';
      m.name = m.defaultName;
    } else {
      m.customName = raw;
      m.name = raw;
    }
    try { SaveManager.saveCurrentGame?.(); } catch (_) {}
    this._render();
  }
  _wireRename() {
    const root = this._el;
    if (!root) return;
    const display = root.querySelector('#ps-rename-display');
    const input   = root.querySelector('#ps-rename-input');
    const btn     = root.querySelector('#ps-detail-rename');
    if (!display || !input) return;
    const showInput = () => {
      display.hidden = true;
      input.hidden = false;
      input.focus();
      input.select();
    };
    const hideInput = () => {
      input.hidden = true;
      display.hidden = false;
    };
    display.addEventListener('click', showInput);
    display.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showInput(); }
    });
    btn?.addEventListener('click', () => { this.audio?.playSfx?.('click'); showInput(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this._commitRename(input); }
      else if (e.key === 'Escape') { e.preventDefault(); hideInput(); }
    });
    input.addEventListener('blur', () => { this._commitRename(input); });
  }

  _slotHTML(m, source, index) {
    const isSel = this._selectedA && this._selectedA.source === source && this._selectedA.index === index;
    const badgeText = source === 'bench' ? 'reserve' : source === 'companions' ? 'companion' : 'party';
    const gs = GameState.get();
    // Dismiss: active party/companions can be sent to bench (keep at least 1 hero)
    const canDismiss = (source === 'party' && gs.party.length > 1) || source === 'companions';
    // Recruit: bench members can be called to active (respect 4+4 limits)
    const isCompType = m.isCompanion || m.class === 'companion';
    const canRecruit = source === 'bench' && (isCompType ? gs.companions.length < 4 : gs.party.length < 4);
    return `<div class="ps-slot${isSel ? ' ps-selected' : ''}" data-source="${source}" data-index="${index}">
      <div class="ps-slot-icon">${portraitImg(m, 32)}</div>
      <div class="ps-slot-info">
        <div class="ps-slot-name">${m.name}${m.isPet && m.ownerName ? ` (${m.ownerName}'s pet)` : ''} ${classIconSvg(m, 14, 'ps-slot-class-icon')}${_roleBadgeSvg(m)}</div>
        <div class="ps-slot-class">${m.class || 'companion'} · Lv.${m.level || 1}</div>
        <div class="ps-slot-stats">${_hpBar(m)} · MP: ${m.mp ?? '?'}/${m.maxMp ?? '?'}</div>
        ${_xpBar(m)}
      </div>
      <div class="ps-slot-actions">
        ${canDismiss ? `<button type="button" class="ps-slot-btn dismiss" data-dismiss="${source}:${index}">Stand Down</button>` : ''}
        ${canRecruit ? `<button type="button" class="ps-slot-btn recruit" data-recruit="${index}">Add to Party</button>` : ''}
      </div>
      <div class="ps-slot-badge${source === 'bench' ? ' bench' : ''}">${badgeText}</div>
    </div>`;
  }

  _wire() {
    this._el.querySelector('#ps-close').addEventListener('click', () => {
      this.audio.playSfx('click');
      this.manager.pop();
    });
    this._el.querySelector('#ps-stats')?.addEventListener('click', async () => {
      this.audio.playSfx('click');
      const { StatsScreen } = await import('./StatsScreen.js');
      this.manager.push(new StatsScreen(this.manager, this.audio, { tab: 'party' }));
    });
    // M398 — rename inline editor (only present when a member is selected).
    this._wireRename();

    this._el.querySelectorAll('.ps-slot[data-source]').forEach(el => {
      el.addEventListener('click', () => {
        const source = el.dataset.source;
        const index = parseInt(el.dataset.index);
        this._onSlotClick(source, index);
      });
    });

    // Dismiss buttons
    this._el.querySelectorAll('[data-dismiss]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const [source, idx] = btn.dataset.dismiss.split(':');
        const index = parseInt(idx);
        const gs = GameState.get();
        const arr = source === 'party' ? gs.party : gs.companions;
        if (source === 'party' && gs.party.length <= 1) return;
        const [member] = arr.splice(index, 1);
        gs.bench = gs.bench || [];
        gs.bench.push(member);
        // If dismissing a hero, also dismiss their pets
        if (!member.isCompanion && member.id) {
          const petFilter = p => p.isPet && p.ownerId === member.id;
          const petComps = gs.companions.filter(petFilter);
          gs.companions = gs.companions.filter(p => !petFilter(p));
          for (const pet of petComps) gs.bench.push(pet);
        }
        this._selectedA = null;
        this.audio.playSfx('click');
        SaveManager.saveCurrentGame();
        this._render();
      });
    });

    // Recruit buttons
    this._el.querySelectorAll('[data-recruit]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.recruit);
        const gs = GameState.get();
        const [member] = gs.bench.splice(index, 1);
        const isComp = member.isCompanion || member.class === 'companion';
        if (isComp) {
          if (gs.companions.length >= 4) return;
          gs.companions.push(member);
        } else {
          if (gs.party.length >= 4) return;
          gs.party.push(member);
        }
        this._selectedA = null;
        this.audio.playSfx('click');
        SaveManager.saveCurrentGame();
        this._render();
      });
    });

    // M402: Skills/Inventory route to the unified PartyPanelScreen with the
    // appropriate tab pre-selected and the same hero pre-focused. The legacy
    // SkillTreeScreen/InventoryScreen still exist (~15 entry points) but the
    // PartyScreen detail buttons should always use the new layout.
    // M404: use manager.replace() so closing the PartyPanelScreen returns
    // directly to whatever screen was below PartyScreen — without it, the
    // user got "double-instance" feeling because PartyScreen sat in the
    // stack underneath PartyPanelScreen and they had to close twice.
    const _openPanel = (tab) => {
      const m = this._getSelected();
      if (!m) return;
      this.audio.playSfx('click');
      const gs = GameState.get();
      const inParty = gs.party.includes(m) || gs.companions.includes(m);
      gs.inventoryContext = inParty ? 'default' : 'party-inactive';
      gs.inventoryFocusId = m.id;
      const chars = [...(gs.party || []), ...(gs.companions || [])];
      const charIdx = Math.max(0, chars.findIndex(c => c && c.id === m.id));
      this.manager.replace(new PartyPanelScreen(this.manager, this.audio, { tab, charIdx }));
    };
    this._el.querySelector('#ps-detail-inv')?.addEventListener('click', () => _openPanel('inventory'));
    this._el.querySelector('#ps-detail-spells')?.addEventListener('click', () => _openPanel('spells'));
    this._el.querySelector('#ps-detail-passives')?.addEventListener('click', () => _openPanel('passives'));
    this._el.querySelector('#ps-detail-attrs')?.addEventListener('click', () => _openPanel('attributes'));

    const swapBtn = this._el.querySelector('#ps-swap');
    if (swapBtn && !swapBtn.disabled) swapBtn.addEventListener('click', () => this._doSwap());

    const upBtn = this._el.querySelector('#ps-move-up');
    if (upBtn && !upBtn.disabled) upBtn.addEventListener('click', () => this._doMove(-1));

    const downBtn = this._el.querySelector('#ps-move-down');
    if (downBtn && !downBtn.disabled) downBtn.addEventListener('click', () => this._doMove(1));
  }

  _onSlotClick(source, index) {
    if (!this._selectedA) {
      this._selectedA = { source, index };
    } else if (this._selectedA.source === source && this._selectedA.index === index) {
      this._selectedA = null; // deselect
    } else {
      // Two different slots selected — auto-swap
      this._doSwapWith({ source, index });
      return;
    }
    this._render();
  }

  _getSelected() {
    if (!this._selectedA) return null;
    const gs = GameState.get();
    const arr = this._selectedA.source === 'party' ? gs.party : this._selectedA.source === 'companions' ? gs.companions : gs.bench;
    return arr[this._selectedA.index];
  }

  _canSwap() {
    return this._selectedA !== null;
  }

  _canMoveUp() {
    return this._selectedA && this._selectedA.source === 'party' && this._selectedA.index > 0;
  }

  _canMoveDown() {
    const gs = GameState.get();
    return this._selectedA && this._selectedA.source === 'party' && this._selectedA.index < gs.party.length - 1;
  }

  _doSwap() {
    // Swap selected with next bench member (or first bench)
    const gs = GameState.get();
    if (!this._selectedA || gs.bench.length === 0) return;
    const arr = this._selectedA.source === 'party' ? gs.party : gs.companions;
    const member = arr[this._selectedA.index];
    const benchMember = gs.bench[0];
    arr[this._selectedA.index] = benchMember;
    gs.bench[0] = member;
    // Keep bench clean (remove nulls)
    gs.bench.splice(0, 1, member);
    this._selectedA = null;
    this._autosave();
    this._render();
  }

  _doSwapWith(targetSel) {
    const gs = GameState.get();
    const getArr = s => s === 'party' ? gs.party : s === 'companions' ? gs.companions : gs.bench;
    const arrA = getArr(this._selectedA.source);
    const arrB = getArr(targetSel.source);
    const a = arrA[this._selectedA.index];
    const b = arrB[targetSel.index];
    if (this._selectedA.source === 'companions' && b && !isCompanionEntity(b)) { this._selectedA = null; this._render(); return; }
    if (targetSel.source === 'companions' && a && !isCompanionEntity(a)) { this._selectedA = null; this._render(); return; }
    if (this._selectedA.source === 'party' && b && isCompanionEntity(b)) { this._selectedA = null; this._render(); return; }
    if (targetSel.source === 'party' && a && isCompanionEntity(a)) { this._selectedA = null; this._render(); return; }
    const tmp = arrA[this._selectedA.index];
    arrA[this._selectedA.index] = arrB[targetSel.index];
    arrB[targetSel.index] = tmp;
    // Ensure party never has null entries
    gs.party = gs.party.filter(Boolean);
    gs.companions = gs.companions.filter(Boolean);
    this._selectedA = null;
    this._autosave();
    this._render();
  }

  _autosave() {
    try { SaveManager.saveCurrentGame(); } catch (_) {}
  }

  _doMove(dir) {
    const gs = GameState.get();
    if (!this._selectedA || this._selectedA.source !== 'party') return;
    const i = this._selectedA.index;
    const j = i + dir;
    if (j < 0 || j >= gs.party.length) return;
    [gs.party[i], gs.party[j]] = [gs.party[j], gs.party[i]];
    this._selectedA.index = j;
    this._render();
  }
}
