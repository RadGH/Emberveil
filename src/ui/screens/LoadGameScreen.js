/**
 * LoadGameScreen — M56: unlimited keyed save list.
 */
import { createEl, removeEl, injectStyles } from '../../utils/dom.js';
import { mount as kbMount, unmount as kbUnmount } from '../../utils/keyboardNav.js';
import { SaveManager } from '../../engine/SaveManager.js';
import { TownScreen } from './TownScreen.js';

export class LoadGameScreen {
  constructor(manager, audio) {
    this.manager = manager;
    this.audio = audio;
    this.noGameMenuEsc = true;
    this._el = null;
    // M-S01: active tab ('classic' | 'story')
    this._tab = 'classic';
  }

  onEnter() { this._build(); }

  _build() {
    injectStyles('load-styles', LOAD_STYLES);
    this._el = createEl('div', 'load-screen');
    this.manager.uiOverlay.appendChild(this._el);
    this._render();
  }

  _render() {
    const allSaves = SaveManager.listSaves();
    // M-S01: split saves by gameMode. Pre-existing saves without the field default to classic.
    const saves = allSaves.filter(s => this._tab === 'story'
      ? s.gameMode === 'story'
      : s.gameMode !== 'story'
    );
    const hasStory   = allSaves.some(s => s.gameMode === 'story');
    const hasClassic = allSaves.some(s => s.gameMode !== 'story');
    const rows = saves.length
      ? saves.map(save => {
          const lvl = save.level ?? save.party?.[0]?.level ?? '?';
          const cls = save.class || save.party?.[0]?.className || 'Hero';
          // M302: party average level across heroes (excludes companions)
          const heroesOnly = (save.party || []).filter(m => m && !(m.isCompanion || m.class === 'companion'));
          const partyAvgLvl = heroesOnly.length
            ? Math.round(heroesOnly.reduce((s, m) => s + (m.level || 1), 0) / heroesOnly.length)
            : null;
          const isRip = !!save.rip;
          // M298: "Fallen" badge (text-only, no emoji)
          const ripBadge = isRip ? `<span class="lss-rip-badge" title="Hardcore — fallen">Fallen</span>` : '';
          // M330 — surface NG+ here (it was removed from the title screen).
          const ngPlus = save.ngPlus || 0;
          const ngBadge = ngPlus > 0 ? `<span class="lss-ng-badge" title="New Game Plus iteration">NG+${ngPlus > 1 ? ngPlus : ''}</span>` : '';
          // M298 (Manual #20): RIP saves are "disabled" — no Load button. Expose Stats + Delete.
          // Stats uses the existing View RIP screen; Delete removes the save.
          const actBtn = isRip
            ? `<button type="button" class="lss-load lss-rip" data-key="${save.key}" data-rip="1" title="View final stats for this fallen hero">View Stats</button>`
            : `<button type="button" class="lss-load" data-key="${save.key}">Load</button>`;
          // M291 — party + companion summary on each save card
          const _esc = (s) => String(s ?? '').replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
          const renderMember = (m, kind) => {
            if (!m) return '';
            const lvlBadge = `<span class="lss-mem-lvl">L${m.level || 1}</span>`;
            const clsLabel = _esc(m.className || m.class || (kind === 'companion' ? 'Pet' : 'Hero'));
            const dot = kind === 'companion' ? '🐾' : '⚔';
            return `<div class="lss-mem ${kind}" title="${_esc(m.name)} · ${clsLabel} · Level ${m.level||1}">
              <span class="lss-mem-dot">${dot}</span>
              <span class="lss-mem-name">${_esc(m.name || '?')}</span>
              <span class="lss-mem-cls">${clsLabel}</span>
              ${lvlBadge}
            </div>`;
          };
          const heroes = (save.party || []).filter(m => m && !(m.isCompanion || m.class === 'companion'));
          const companions = [
            ...(save.companions || []),
            ...((save.party || []).filter(m => m && (m.isCompanion || m.class === 'companion'))),
          ];
          // Advanced options summary — count + names of enabled flags.
          const advFlags = [
            { key: 'fogOfWar', label: 'Fog of War' },
            { key: 'hardcore', label: 'Hardcore' },
            { key: 'manualCharacters', label: 'Manual Characters' },
            { key: 'manualCombat', label: 'Manual Combat' },
          ];
          const advEnabled = advFlags.filter(f => !!save[f.key]);
          const advN = advEnabled.length;
          // M473 — surface the difficulty in the summary label. Hardcore saves
          // win out over the global emberveil_difficulty (which only stores
          // easy/normal/hard). Per-save difficulty isn't currently persisted,
          // so fall back to the current global setting for non-hardcore saves.
          let _diffLabel = 'Normal';
          if (save.hardcore) {
            _diffLabel = 'Hardcore';
          } else {
            let _diff = 'normal';
            try { _diff = localStorage.getItem('emberveil_difficulty') || 'normal'; } catch (_) {}
            _diffLabel = _diff === 'easy' ? 'Easy' : _diff === 'hard' ? 'Hard' : 'Normal';
          }
          const advHtml = `
            <details class="lss-adv">
              <summary class="lss-adv-summary">${_diffLabel} (${advN})</summary>
              <div class="lss-adv-list">
                ${advEnabled.length
                  ? advEnabled.map(f => `<span class="lss-adv-tag">${f.label}</span>`).join('')
                  : '<span class="lss-adv-empty">None enabled</span>'}
              </div>
            </details>
          `;
          const benchCount = (save.bench || []).length;
          const partyHtml = heroes.length || companions.length
            ? `<div class="lss-roster">
                ${heroes.map(m => renderMember(m, 'hero')).join('')}
                ${companions.map(m => renderMember(m, 'companion')).join('')}
                ${benchCount ? `<div class="lss-mem bench" title="${benchCount} on bench">
                  <span class="lss-mem-dot">＋</span>
                  <span class="lss-mem-name">${benchCount} on bench</span>
                </div>` : ''}
              </div>`
            : '';
          return `
            <div class="ls-slot has-save${isRip?' is-rip is-rip-disabled':''}" data-key="${save.key}">
              <div class="lss-info">
                <div class="lss-name">${_esc(save.heroName) || 'Unknown'} ${ripBadge} ${ngBadge}</div>
                <div class="lss-class">${cls} · Level ${lvl}${partyAvgLvl !== null && heroesOnly.length > 1 ? ` <span class="lss-avg-lvl" title="Party average level">(avg L${partyAvgLvl})</span>` : ''}</div>
                <div class="lss-progress">Act ${save.act || 1} · ${save.timestamp || ''}</div>
                ${isRip ? `<div class="lss-fallen-note">Hardcore run ended. Stats preserved for comparison.</div>` : ''}
                ${partyHtml}
                ${advHtml}
              </div>
              <div class="lss-actions">
                ${actBtn}
                <button type="button" class="lss-delete" data-key="${save.key}">${isRip ? 'Delete Run' : 'Delete'}</button>
              </div>
            </div>
          `;
        }).join('')
      : `<div class="ls-slot empty"><div class="lss-empty">No saves yet — start a new game.</div></div>`;

    // M-S01: show Classic/Story tabs only when both modes have saves.
    const tabsHtml = (hasClassic && hasStory) ? `
      <div class="ls-mode-tabs" role="tablist">
        <button type="button" class="ls-mode-tab${this._tab === 'classic' ? ' ls-mode-tab--active' : ''}"
                data-tab="classic" role="tab" aria-selected="${this._tab === 'classic'}">Classic</button>
        <button type="button" class="ls-mode-tab${this._tab === 'story' ? ' ls-mode-tab--active' : ''}"
                data-tab="story" role="tab" aria-selected="${this._tab === 'story'}">Story Mode</button>
      </div>
    ` : '';

    this._el.innerHTML = `
      <div class="ls-panel">
        <div class="ls-title">Load Game</div>
        ${tabsHtml}
        <div class="ls-slots" id="slot-list">${rows}</div>
      </div>
      <button type="button" class="ls-back ls-back-floating" id="ls-back">← Back</button>
    `;

    this._el.querySelectorAll('.ls-mode-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.audio.playSfx('click');
        this._tab = btn.dataset.tab;
        this._render();
      });
    });

    this._el.querySelector('#ls-back').addEventListener('click', () => { this.audio.playSfx('click'); this.manager.pop(); });

    this._el.querySelectorAll('.lss-load').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!SaveManager.loadKey(btn.dataset.key)) return;
        this.audio.playSfx('click');
        if (btn.dataset.rip) {
          const { RipViewScreen } = await import('./RipViewScreen.js');
          this.manager.replace(new RipViewScreen(this.manager, this.audio));
          return;
        }
        // M-S01: Story saves always route to StoryMapScreen (forbidden to cross-load as Classic).
        try {
          const { GameState } = await import('../../game/gameState.js');
          const gs = GameState.get();
          if (gs.gameMode === 'story') {
            const { StoryMapScreen } = await import('./StoryMapScreen.js');
            this.manager.replace(new StoryMapScreen(this.manager, this.audio));
            return;
          }
        } catch (_) { /* fall through */ }
        // M358: route based on the loaded GameState. If the player saved while
        // on an adventure node (not in a town), open the map at that node so
        // they don't get bounced back to the last town. Town saves still go
        // to TownScreen.
        try {
          const { GameState } = await import('../../game/gameState.js');
          const gs = GameState.get();
          // GameState exposes zoneId / nodeId. Adventure zones do NOT start
          // with "town_" and aren't the act-1 hub (emberglen). If the saved
          // zone is an adventure zone, route to the map so the player resumes
          // exactly where they saved.
          const zid = gs.zoneId || '';
          const isAdventureZone = zid && !zid.startsWith('town_') && zid !== 'emberglen';
          if (isAdventureZone && gs.nodeId) {
            const { MapScreen } = await import('./MapScreen.js');
            this.manager.replace(new MapScreen(this.manager, this.audio));
            return;
          }
        } catch (_) { /* fall through to TownScreen */ }
        this.manager.replace(new TownScreen(this.manager, this.audio, null, false));
      });
    });

    this._el.querySelectorAll('.lss-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!confirm('Delete this save?')) return;
        SaveManager.deleteKey(btn.dataset.key);
        this.audio.playSfx('click');
        this._render();
      });
    });

    // M297: keyboard navigation — vertical list of focusable slot buttons.
    kbUnmount(this._el);
    kbMount(this._el, {
      layout: 'vertical',
      focusFirst: true,
      onEscape: () => { this.audio.playSfx('click'); this.manager.pop(); },
    });
  }

  update() {}
  draw() {}
  onExit() { if (this._el) kbUnmount(this._el); removeEl(this._el); this._el = null; }
  destroy() { if (this._el) kbUnmount(this._el); removeEl(this._el); this._el = null; }
}

const LOAD_STYLES = `
.load-screen {
  position: absolute; inset: 0; display: flex; align-items: flex-start; justify-content: center;
  background: rgba(5,2,8,0.96); font-family: 'Inter', sans-serif; overflow-y: auto;
  padding: 2rem 0;
}
/* M-S01: Classic / Story mode tabs */
.ls-mode-tabs {
  display: flex; gap: 0;
  border: 1px solid rgba(232,160,32,0.25); border-radius: 6px; overflow: hidden;
}
.ls-mode-tab {
  flex: 1; padding: 0.55rem 1rem; min-height: 44px;
  border: none; background: transparent;
  color: #8a7a6a; font-family: 'Cinzel', serif; font-size: 0.78rem; font-weight: 600;
  letter-spacing: 0.06em; cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.ls-mode-tab--active { background: rgba(232,160,32,0.18); color: #e8a020; }
.ls-mode-tab:hover:not(.ls-mode-tab--active) { background: rgba(255,255,255,0.04); color: #c8b89c; }
/* M312 #19: bottom padding so last card isn't hidden under floating Back btn */
.ls-panel { width: 100%; max-width: 460px; padding: 2rem 2rem 6rem; display: flex; flex-direction: column; gap: 1.5rem; }
.ls-title { font-family: 'Cinzel', serif; font-size: 1.4rem; font-weight: 700; color: #e8a020; text-align: center; letter-spacing: 0.1em; }
/* M312 #19: remove max-height so cards grow freely; page itself scrolls */
.ls-slots { display: flex; flex-direction: column; gap: 0.75rem; }
.ls-slot {
  /* M312 #19: flex: 0 1 auto so cards shrink to content, not fixed height */
  flex: 0 1 auto;
  display: flex; align-items: flex-start; gap: 1rem;
  padding: 1rem 1.25rem; border-radius: 8px;
  border: 1px solid rgba(232,160,32,0.15); background: rgba(26,18,24,0.9);
  min-height: 72px;
}
.ls-slot.empty { opacity: 0.45; justify-content: center; }
.lss-info { flex: 1; }
.lss-name { font-family: 'Cinzel', serif; font-size: 1rem; font-weight: 700; color: #f0e8d8; }
.lss-class { font-size: 0.72rem; color: #8a7a6a; margin-top: 0.15rem; }
.lss-avg-lvl { color: #60c0a0; font-size: 0.68rem; }
.lss-progress { font-size: 0.68rem; color: #e8a020; margin-top: 0.15rem; }
.lss-empty { flex: 1; color: #4a3a32; font-size: 0.8rem; text-align: center; }
.lss-actions { display: flex; flex-direction: column; gap: 0.35rem; }
.lss-load, .lss-delete {
  padding: 0.35rem 0.85rem; border-radius: 5px; border: 1px solid;
  font-size: 0.72rem; font-weight: 600; cursor: pointer; min-height: 32px;
  transition: background 0.15s;
}
.lss-load { background: rgba(232,160,32,0.12); border-color: rgba(232,160,32,0.4); color: #e8a020; }
.lss-load:hover { background: rgba(232,160,32,0.24); }
.lss-delete { background: rgba(192,64,48,0.08); border-color: rgba(192,64,48,0.3); color: #c04030; }
.lss-delete:hover { background: rgba(192,64,48,0.18); }
.ls-back { background: none; border: none; color: #8a7a6a; font-size: 0.85rem; cursor: pointer; text-align: center; text-decoration: underline; padding: 0.4rem; }
.ls-back:hover { color: #f0e8d8; }
/* M312 #19: floating Back button fixed at bottom with safe-area inset */
.ls-back-floating {
  position: fixed; bottom: 0; left: 0; right: 0;
  padding: 0.85rem 1rem;
  padding-bottom: calc(0.85rem + env(safe-area-inset-bottom, 0px));
  background: rgba(5,2,8,0.97);
  border-top: 1px solid rgba(232,160,32,0.15);
  color: #8a7a6a; font-size: 0.85rem; cursor: pointer;
  text-decoration: underline; text-align: center;
  z-index: 10; min-height: 44px; display: flex; align-items: center; justify-content: center;
}
.ls-back-floating:hover { color: #f0e8d8; }
.ls-slot.is-rip { border-color: rgba(192,64,48,0.45); background: linear-gradient(180deg,rgba(40,12,12,0.5),rgba(20,6,8,0.5)); }
.lss-rip-badge { display: inline-block; margin-left: 0.4rem; font-size: 0.65rem; color: #ff8a70; letter-spacing: 0.1em; padding: 1px 6px; border: 1px solid rgba(192,64,48,0.4); border-radius: 3px; vertical-align: middle; }
.lss-ng-badge { display: inline-block; margin-left: 0.4rem; font-size: 0.65rem; color: #e8d040; letter-spacing: 0.1em; padding: 1px 6px; border: 1px solid rgba(232,208,64,0.5); border-radius: 3px; vertical-align: middle; font-weight: 700; }
.lss-load.lss-rip { background: rgba(192,64,48,0.12); border-color: rgba(192,64,48,0.45); color: #ff8a70; }
.lss-load.lss-rip:hover { background: rgba(192,64,48,0.24); }
/* M298 — Fallen (disabled) hardcore save slot */
.ls-slot.is-rip-disabled { opacity: 0.72; }
.ls-slot.is-rip-disabled .lss-name { color: rgba(240,232,216,0.65); }
.lss-fallen-note { font-size: 0.62rem; color: rgba(192,64,48,0.75); margin-top: 0.2rem; font-style: italic; }
/* M291 — party + companion roster summary on each save card */
.lss-roster {
  display: flex; flex-wrap: wrap; gap: 0.25rem;
  margin-top: 0.5rem; padding-top: 0.5rem;
  border-top: 1px solid rgba(232,160,32,0.08);
}
.lss-mem {
  display: inline-flex; align-items: center; gap: 0.3rem;
  background: rgba(0,0,0,0.35); border: 1px solid rgba(232,160,32,0.18);
  border-radius: 10px; padding: 0.15rem 0.5rem;
  font-size: 0.65rem;
}
.lss-mem.companion { border-color: rgba(96,192,224,0.25); }
.lss-mem.bench { border-style: dashed; opacity: 0.7; }
.lss-mem-dot { font-size: 0.75rem; opacity: 0.85; }
.lss-mem-name { color: #f0e8d8; font-weight: 600; }
.lss-mem-cls { color: #8a7a6a; }
.lss-mem-lvl {
  background: rgba(232,160,32,0.18); color: #e8a020;
  padding: 0 0.35rem; border-radius: 6px; font-weight: 700;
  font-size: 0.6rem; letter-spacing: 0.04em;
}
.lss-adv { margin-top: 0.45rem; }
.lss-adv-summary {
  cursor: pointer; font-size: 0.65rem; color: #8a7a6a;
  letter-spacing: 0.05em; padding: 0.15rem 0.45rem;
  display: inline-block;
  border: 1px solid rgba(232,160,32,0.18);
  border-radius: 10px;
  background: rgba(0,0,0,0.25);
  user-select: none;
}
.lss-adv-summary:hover { color: #f0e8d8; border-color: rgba(232,160,32,0.35); }
.lss-adv[open] .lss-adv-summary { color: #e8a020; border-color: rgba(232,160,32,0.4); }
.lss-adv-list {
  display: flex; flex-wrap: wrap; gap: 0.25rem;
  margin-top: 0.35rem;
}
.lss-adv-tag {
  font-size: 0.62rem; color: #f0e8d8;
  background: rgba(232,160,32,0.1);
  border: 1px solid rgba(232,160,32,0.25);
  padding: 0.1rem 0.4rem; border-radius: 8px;
}
.lss-adv-empty { font-size: 0.62rem; color: #4a3a32; font-style: italic; }
`;
