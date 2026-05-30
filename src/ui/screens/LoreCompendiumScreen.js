/**
 * LoreCompendiumScreen — M298
 *
 * Tabbed lore browser. Categories: World, Factions, Bestiary, Locations, History, Arcana.
 * Entries are locked until the player meets the unlockedBy condition.
 * Accessible from GameMenuScreen (replaces the old CodexScreen "lore" slot).
 */
import { createEl, removeEl, injectStyles } from '../../utils/dom.js';
import { mount as kbMount, unmount as kbUnmount } from '../../utils/keyboardNav.js';
import { GameState } from '../../game/gameState.js';
import { LORE_ENTRIES, LORE_CATEGORIES, isLoreUnlocked } from '../../game/lore.js';

const STYLES = `
.lore-screen {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  background: rgba(4,2,10,0.97);
  color: #f0e8d8; font-family: 'Inter', 'Segoe UI', sans-serif;
  overflow: hidden;
}
.lore-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1.2rem 0.7rem;
  border-bottom: 1px solid rgba(232,160,32,0.2);
  background: rgba(232,160,32,0.04);
  flex-shrink: 0;
}
.lore-title { font-family: 'Cinzel', serif; font-size: 1.25rem; color: #e8a020; letter-spacing: 0.1em; }
.lore-close {
  background: transparent; border: 1px solid rgba(240,232,216,0.2);
  color: #f0e8d8; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer;
  font-size: 0.78rem; min-height: 44px;
}
.lore-cat-bar {
  display: flex; flex-wrap: nowrap; overflow-x: auto; gap: 0;
  border-bottom: 1px solid rgba(232,160,32,0.15);
  background: rgba(0,0,0,0.3);
  flex-shrink: 0;
  -webkit-overflow-scrolling: touch;
}
.lore-cat-tab {
  flex: 1 0 auto; padding: 0.7rem 1rem;
  background: transparent; border: none; border-bottom: 2px solid transparent;
  color: rgba(240,232,216,0.55); font-family: 'Cinzel', serif;
  /* M337 — bumped from 0.72 to 0.92rem so the category bar is legible
     on desktop. */
  font-size: 0.92rem; letter-spacing: 0.06em; cursor: pointer;
  white-space: nowrap; transition: color 0.15s, border-color 0.15s;
  min-height: 44px;
}
.lore-cat-tab.active { color: #e8a020; border-bottom-color: #e8a020; }
.lore-cat-tab:hover:not(.active) { color: rgba(240,232,216,0.85); }
.lore-cat-count {
  font-family: 'Inter', sans-serif; font-size: 0.62rem;
  color: rgba(240,232,216,0.4); margin-left: 4px;
}
.lore-body {
  display: flex; flex: 1; overflow: hidden; min-height: 0;
}
/* Sidebar: entry list */
.lore-list {
  width: 200px; min-width: 160px; flex-shrink: 0;
  overflow-y: auto; border-right: 1px solid rgba(232,160,32,0.12);
  -webkit-overflow-scrolling: touch;
}
.lore-entry-btn {
  display: block; width: 100%; text-align: left;
  padding: 0.65rem 0.9rem; border: none; background: transparent;
  /* M337 — entry list 0.72 -> 0.88rem; widened sidebar to fit. */
  color: rgba(240,232,216,0.7); font-size: 0.88rem; line-height: 1.4;
  cursor: pointer; border-bottom: 1px solid rgba(232,160,32,0.06);
  transition: background 0.12s, color 0.12s;
  min-height: 44px;
}
.lore-entry-btn:hover { background: rgba(232,160,32,0.06); color: #f0e8d8; }
.lore-entry-btn.active { background: rgba(232,160,32,0.12); color: #e8a020; }
.lore-entry-btn.locked { color: rgba(240,232,216,0.3); cursor: default; }
.lore-lock-icon { color: rgba(240,232,216,0.25); font-size: 0.65rem; display: block; }
/* Entry reader */
.lore-reader {
  flex: 1; overflow-y: auto; padding: 1.2rem 1.25rem;
  -webkit-overflow-scrolling: touch;
}
.lore-reader-empty {
  display: flex; align-items: center; justify-content: center;
  height: 100%; color: rgba(240,232,216,0.3); font-size: 0.85rem;
  text-align: center; padding: 2rem;
}
.lore-reader-title {
  font-family: 'Cinzel', serif; font-size: 1.4rem; color: #e8a020;
  margin: 0 0 0.5rem; letter-spacing: 0.08em;
}
.lore-reader-cat {
  font-size: 0.78rem; letter-spacing: 0.14em; text-transform: uppercase;
  color: rgba(240,232,216,0.45); margin-bottom: 1rem;
}
.lore-reader-body {
  /* M337 — body bumped 0.84 -> 1rem for desktop readability. */
  font-size: 1rem; line-height: 1.75; color: #d8c8b8;
  white-space: pre-wrap;
}
.lore-reader-locked {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 0.75rem; padding: 2rem;
  color: rgba(240,232,216,0.35); text-align: center;
}
.lore-reader-locked svg { opacity: 0.3; }
.lore-cat-progress {
  font-family: 'Inter', sans-serif; font-size: 0.7rem;
  color: rgba(240,232,216,0.4); padding: 0.4rem 0.8rem;
  border-bottom: 1px solid rgba(232,160,32,0.06); flex-shrink: 0;
}
`;

export class LoreCompendiumScreen {
  constructor(manager, audio) {
    this.manager = manager;
    this.audio = audio;
    this._el = null;
    this._activeCategory = LORE_CATEGORIES[0];
    this._activeEntry = null;
  }

  onEnter() {
    injectStyles('lore-compendium-styles', STYLES);
    this._el = createEl('div', 'lore-screen');
    this.manager.uiOverlay.appendChild(this._el);
    this._render();
    // Set opened_lore_compendium flag
    try { GameState.setFlag && GameState.setFlag('opened_lore_compendium', true); } catch (_) {}
  }

  _getLoreUnlockedSet() {
    try {
      const gs = GameState.get();
      const raw = gs.loreUnlocked;
      if (raw instanceof Set) return raw;
      if (Array.isArray(raw)) return new Set(raw);
    } catch (_) {}
    return new Set();
  }

  _entriesForCategory(cat) {
    return LORE_ENTRIES.filter(e => e.category === cat);
  }

  _render() {
    const gs = GameState.get();
    const loreUnlocked = this._getLoreUnlockedSet();

    // Build category tabs with unlock counts
    const catTabsHtml = LORE_CATEGORIES.map(cat => {
      const entries = this._entriesForCategory(cat);
      const unlockedCount = entries.filter(e => isLoreUnlocked(e, gs, loreUnlocked)).length;
      return `<button type="button" class="lore-cat-tab${cat === this._activeCategory ? ' active' : ''}" data-cat="${cat}">
        ${cat}<span class="lore-cat-count">${unlockedCount}/${entries.length}</span>
      </button>`;
    }).join('');

    // Build sidebar list for active category
    const catEntries = this._entriesForCategory(this._activeCategory);
    const unlockedCount = catEntries.filter(e => isLoreUnlocked(e, gs, loreUnlocked)).length;

    const listHtml = catEntries.map(entry => {
      const unlocked = isLoreUnlocked(entry, gs, loreUnlocked);
      const isActive = this._activeEntry?.id === entry.id;
      if (unlocked) {
        return `<button type="button" class="lore-entry-btn${isActive ? ' active' : ''}" data-entry="${entry.id}">${entry.title}</button>`;
      } else {
        return `<button type="button" class="lore-entry-btn locked" data-entry="${entry.id}" disabled>
          <span>${entry.title}</span>
          <svg class="lore-lock-icon" viewBox="0 0 12 14" width="10" height="11" fill="currentColor" aria-hidden="true" style="margin-top:3px">
            <rect x="1" y="5" width="10" height="8" rx="1.5"/>
            <path d="M3 5V3.5a3 3 0 016 0V5" stroke="currentColor" stroke-width="1.2" fill="none"/>
          </svg>
        </button>`;
      }
    }).join('');

    // Reader panel
    let readerHtml;
    if (!this._activeEntry) {
      readerHtml = `<div class="lore-reader-empty">Select an entry to read.</div>`;
    } else {
      const entry = LORE_ENTRIES.find(e => e.id === this._activeEntry.id);
      const unlocked = entry && isLoreUnlocked(entry, gs, loreUnlocked);
      if (!entry || !unlocked) {
        readerHtml = `
          <div class="lore-reader-locked">
            <svg viewBox="0 0 24 28" width="40" height="46" fill="none" stroke="#f0e8d8" stroke-width="1.5">
              <rect x="2" y="10" width="20" height="17" rx="3"/>
              <path d="M6 10V7a6 6 0 0112 0v3"/>
            </svg>
            <div style="font-size:0.82rem">This entry is locked.</div>
            <div style="font-size:0.72rem;color:rgba(240,232,216,0.3)">Explore the world to unlock it.</div>
          </div>
        `;
      } else {
        readerHtml = `
          <div class="lore-reader-cat">${entry.category}</div>
          <div class="lore-reader-title">${entry.title}</div>
          <div class="lore-reader-body">${entry.body}</div>
        `;
      }
    }

    this._el.innerHTML = `
      <div class="lore-header">
        <div class="lore-title">Lore Compendium</div>
        <button type="button" class="lore-close" id="lore-close">Close</button>
      </div>
      <div class="lore-cat-bar">${catTabsHtml}</div>
      <div class="lore-cat-progress">${unlockedCount} of ${catEntries.length} entries unlocked in ${this._activeCategory}</div>
      <div class="lore-body">
        <div class="lore-list">${listHtml}</div>
        <div class="lore-reader">${readerHtml}</div>
      </div>
    `;

    // Wire events
    this._el.querySelector('#lore-close').addEventListener('click', () => {
      this.audio.playSfx('click');
      this.manager.pop();
    });

    this._el.querySelectorAll('.lore-cat-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.audio.playSfx('click');
        this._activeCategory = btn.dataset.cat;
        this._activeEntry = null;
        this._render();
      });
    });

    this._el.querySelectorAll('.lore-entry-btn:not(.locked)').forEach(btn => {
      btn.addEventListener('click', () => {
        this.audio.playSfx('click');
        const entry = LORE_ENTRIES.find(e => e.id === btn.dataset.entry);
        if (entry) {
          this._activeEntry = entry;
          this._render();
        }
      });
    });

    kbMount(this._el, {
      layout: 'vertical',
      onEscape: () => { this.audio.playSfx('click'); this.manager.pop(); },
    });
  }

  onPause()  { if (this._el) this._el.style.display = 'none'; }
  onResume() { if (this._el) this._el.style.display = ''; this._render(); }

  onExit() {
    if (this._el) kbUnmount(this._el);
    removeEl(this._el);
    this._el = null;
  }
  destroy() { this.onExit(); }
  update() {}
  draw() {}
}
