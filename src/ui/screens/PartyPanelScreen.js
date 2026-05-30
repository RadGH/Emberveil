/**
 * PartyPanelScreen — M294 unified party management screen.
 *
 * Hosts five tabs in a single screen so the player can switch between
 * party management, inventory, spells, passives, and attributes without
 * screen transitions.
 *
 * Tabs: Party | Inventory | Spells | Passives | Attributes
 *
 * Each tab composes its corresponding existing screen by mounting it into
 * the tab body. A per-character avatar row below the tab bar selects the
 * active character across all tabs.
 */
import { createEl, removeEl, injectStyles } from '../../utils/dom.js';
import { mount as kbMount, unmount as kbUnmount } from '../../utils/keyboardNav.js';
import { GameState } from '../../game/gameState.js';
import { portraitImg, classIconSvg } from '../../game/spriteUtils.js';
import { POTIONS } from '../../game/items.js';

// ── Dual-compare desktop detection ─────────────────────────────────────────
const _isDesktopCompare = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(min-width: 700px) and (hover: hover)').matches;

// ── Styles ──────────────────────────────────────────────────────────────────
const PPS_STYLES = `
/* M312 #32: gold/brown palette, Inter as primary font (Cinzel only for tab labels + headers) */
.pps-screen {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  background: linear-gradient(180deg, #130a08 0%, #0e0806 100%);
  color: #e8d8b8; font-family: 'Inter', system-ui, sans-serif;
  overflow: hidden;
}

/* ─── Tab bar — mirrors town interface horizontal tabs ─── */
.pps-tab-bar {
  display: flex; flex-direction: row; flex-shrink: 0;
  border-bottom: 2px solid rgba(184,120,40,0.3);
  background: rgba(12,6,4,0.92);
  position: sticky; top: 0; z-index: 10;
  min-height: 44px; overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.pps-tab-bar::-webkit-scrollbar { display: none; }
.pps-tab {
  flex: 1; padding: 0 0.5rem;
  background: none; border: none;
  color: rgba(184,148,96,0.6);
  /* M312 #32: Cinzel only for active tab label */
  font-family: 'Inter', system-ui, sans-serif;
  font-size: clamp(0.62rem, 2.4vw, 0.8rem);
  font-weight: 600;
  letter-spacing: 0.03em; text-transform: uppercase;
  cursor: pointer; border-bottom: 2px solid transparent;
  margin-bottom: -2px; min-height: 44px;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
  display: flex; align-items: center; justify-content: center;
  white-space: nowrap;
}
.pps-tab.active {
  /* Active tab uses Cinzel per item 32 */
  font-family: 'Cinzel', Georgia, serif;
  color: #e8a020;
  border-bottom: 2px solid #e8a020;
  background: rgba(232,160,32,0.08);
}
.pps-tab:hover:not(.active) {
  color: rgba(232,160,32,0.7);
  background: rgba(232,160,32,0.05);
}

/* ─── Close button ─── */
.pps-close {
  flex-shrink: 0;
  background: none; border: 1px solid rgba(232,160,32,0.35);
  color: #e8a020; cursor: pointer;
  font-family: 'Inter', system-ui, sans-serif; font-size: 0.75rem;
  padding: 0 0.7rem; margin: 6px 6px 6px 0;
  border-radius: 4px; min-height: 32px;
}
.pps-close:hover { background: rgba(232,160,32,0.12); }

/* ─── Character selector row ─── */
/* M312 #32: gold/brown accent matching CharacterScreen old style */
.pps-char-row {
  display: flex; flex-direction: row; gap: 0.35rem;
  padding: 0.45rem 0.6rem; flex-shrink: 0;
  border-bottom: 1px solid rgba(184,120,40,0.2);
  background: rgba(10,5,3,0.7);
  overflow-x: auto; -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.pps-char-row::-webkit-scrollbar { display: none; }

.pps-char-btn {
  display: flex; flex-direction: column; align-items: center;
  gap: 0.15rem; padding: 0.3rem 0.45rem;
  background: rgba(120,80,20,0.1);
  border: 1px solid rgba(184,120,40,0.2);
  border-radius: 7px; cursor: pointer;
  min-width: 56px; flex-shrink: 0;
  transition: border-color 0.12s, background 0.12s;
}
.pps-char-btn:hover { border-color: rgba(232,160,32,0.5); background: rgba(232,160,32,0.07); }
.pps-char-btn.active {
  border-color: #e8a020;
  background: rgba(232,160,32,0.13);
}
.pps-char-btn img, .pps-char-btn .char-portrait {
  width: 36px !important; height: 36px !important;
  border-radius: 5px; object-fit: cover;
}
.pps-char-name {
  font-size: 0.55rem; color: #c8b88a;
  text-align: center; max-width: 56px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.pps-char-badge {
  display: inline-block;
  background: #c04030; color: #fff;
  font-size: 0.5rem; padding: 0.08rem 0.28rem;
  border-radius: 8px; margin-left: 0.15rem;
  line-height: 1.2; vertical-align: middle;
}

/* ─── Tab body ─── */
.pps-tab-body {
  flex: 1; overflow: hidden; position: relative;
}
/* Sub-screens mount into this container */
.pps-tab-body > .inv-screen,
.pps-tab-body > .skill-screen,
.pps-tab-body > .party-screen {
  position: absolute; inset: 0;
}
/* Hide the sub-screen's own header close button — we have our own */
.pps-tab-body .inv-close,
.pps-tab-body .ps-close,
.pps-tab-body .inv-header .inv-close {
  display: none !important;
}
/* Hide sub-screen character-tab row — we have our own selector */
.pps-tab-body .inv-char-tabs {
  display: none !important;
}
/* Hide the Party tab's close/action-bar (it's inside PartyPanelScreen) */
.pps-tab-body .ps-action-bar {
  display: none !important;
}
/* Skill screen: hide its own char tabs too */
/* M336 — the embedded SkillTreeScreen renders its own Skills/Passive/Attributes
   tab bar (.skill-mode-tabs). When mounted inside PartyPanel that bar is
   redundant with the outer PartyPanel tabs (Party/Inventory/Spells/Passives/
   Attributes) — hide it to remove the visual duplicate. The outer tab
   click handler (_mountSkillTab) controls which sub-tab is mounted. */
.pps-tab-body .skill-mode-tabs { display: none !important; }
.pps-tab-body .skill-char-tabs {
  display: none !important;
}
/* M313 #25: hide the entire skill-header bar (char tabs + close btn) inside PPS — redundant */
.pps-tab-body .skill-header {
  display: none !important;
}

/* ─── Potion Belt (M295) ─── */
.pps-pb-section {
  flex-shrink: 0;
  padding: 0.4rem 0.5rem 0.35rem;
  border-bottom: 1px solid rgba(255,200,80,0.14);
  background: rgba(6,2,12,0.7);
}
.pps-pb-label {
  font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.12em;
  color: rgba(200,180,130,0.55); margin-bottom: 0.3rem;
}
.pps-pb-slots {
  display: flex; gap: 0.35rem; align-items: center;
}
.pps-pb-slot {
  width: 44px; height: 44px;
  border: 1px dashed rgba(232,200,80,0.3);
  border-radius: 6px;
  background: rgba(255,255,255,0.03);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; position: relative;
  flex-shrink: 0;
  transition: border-color 0.12s;
}
.pps-pb-slot:hover { border-color: rgba(232,200,80,0.65); }
.pps-pb-slot.filled {
  border-style: solid;
  border-color: rgba(232,200,80,0.55);
  background: rgba(232,200,80,0.06);
}
.pps-pb-slot-name {
  font-size: 0.46rem; color: #c8b88a;
  text-align: center; padding: 0 1px;
  line-height: 1.2; word-break: break-word;
}
.pps-pb-clear {
  font-size: 0.5rem; position: absolute;
  top: 1px; right: 2px;
  color: rgba(255,80,60,0.7); cursor: pointer;
  line-height: 1;
}
.pps-pb-hint {
  font-size: 0.6rem; color: rgba(160,140,110,0.5);
  margin-left: 0.4rem; font-family: 'Inter', sans-serif;
}
.pps-pb-potion-picker {
  position: fixed; z-index: 200;
  background: #1a1218;
  border: 1px solid rgba(232,200,64,0.5);
  border-radius: 8px; padding: 0.5rem;
  min-width: 180px; box-shadow: 0 4px 20px rgba(0,0,0,0.6);
  font-family: 'Inter', sans-serif;
}
.pps-pb-picker-title {
  font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.1em;
  color: rgba(200,180,130,0.6); margin-bottom: 0.4rem;
  font-family: 'Cinzel', Georgia, serif;
}
.pps-pb-picker-opt {
  display: block; width: 100%;
  text-align: left; padding: 0.35rem 0.5rem;
  background: none; border: none;
  color: #e8e0d0; font-size: 0.78rem; cursor: pointer;
  border-radius: 4px; white-space: nowrap;
}
.pps-pb-picker-opt:hover { background: rgba(232,200,64,0.1); }
.pps-pb-picker-cancel {
  margin-top: 0.3rem;
  display: block; width: 100%;
  text-align: center; padding: 0.3rem;
  background: none; border: 1px solid rgba(200,160,80,0.3);
  color: #a09080; font-size: 0.7rem; cursor: pointer; border-radius: 4px;
}

/* M312 #14: visual consistency — normalize sub-screen headers inside PPS */
/* Inventory header cleanup — remove its own char-header top margin when nested */
.pps-tab-body .inv-char-header { margin-bottom: 0.35rem; }
/* Matching scroll behavior: sub-screens fill the tab body and scroll internally */
.pps-tab-body .inv-screen,
.pps-tab-body .skill-screen {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
/* Normalize panel-label in sub-screens to match gold palette */
.pps-tab-body .panel-label {
  color: rgba(184,140,60,0.8);
}

/* M312 #34: hide portrait inside equip-panel — already shown in char row */
.pps-tab-inventory .equip-panel .inv-portrait-wrap,
.pps-tab-inventory .equip-panel img.inv-portrait,
.pps-tab-spells    .equip-panel .inv-portrait-wrap,
.pps-tab-spells    .equip-panel img.inv-portrait,
.pps-tab-passives  .equip-panel .inv-portrait-wrap,
.pps-tab-passives  .equip-panel img.inv-portrait,
.pps-tab-attributes .equip-panel .inv-portrait-wrap,
.pps-tab-attributes .equip-panel img.inv-portrait {
  display: none !important;
}

/* M312 #35: "Auto-Equip Upgrades" checkbox styling — match green auto-toggle style */
.pps-tab-inventory .inv-autoequip-toggle {
  display: inline-flex !important;
  align-items: center;
  gap: 0.4rem;
  background: rgba(40,160,80,0.12);
  border: 1px solid rgba(40,160,80,0.35);
  border-radius: 5px;
  padding: 0.35rem 0.6rem;
  color: #60c080;
  font-size: 0.72rem;
  cursor: pointer;
  margin-top: 0.3rem;
}
.pps-tab-inventory .inv-autoequip-toggle:hover { background: rgba(40,160,80,0.2); }

/* M312 #37: bottom margin on .inv-char-class to match .panel-label spacing */
.inv-char-class { margin-bottom: 0.6rem; }

/* M322 — two-column layout for the stats grid on desktop, with a max-width
   so the rows don't stretch across a 2560px screen. Mobile keeps a single
   column. Applies to Attributes/Passives/Spells side panels and the
   inventory character-stats panel. */
.cs-stats-grid {
  display: grid; grid-template-columns: 1fr; gap: 0.75rem 1.25rem;
  max-width: 720px;
}
@media (min-width: 880px) {
  .cs-stats-grid { grid-template-columns: 1fr 1fr; }
}
.cs-stats-grid .cs-section { min-width: 0; }
.cs-stats-grid .cs-section .panel-label:first-child { margin-top: 0; }

/* ─── Dual-compare panel (desktop, task 5) ─── */
.pps-dual-cmp {
  display: flex; gap: 0.75rem; padding: 0.5rem;
  background: rgba(8,4,14,0.96);
  border-top: 1px solid rgba(232,200,64,0.2);
  flex-shrink: 0; flex-wrap: wrap;
}
.pps-dual-cmp-col {
  flex: 1; min-width: 180px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(232,200,64,0.2);
  border-radius: 6px; padding: 0.5rem;
  font-size: 0.78rem;
}
.pps-dual-cmp-label {
  font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.1em;
  color: rgba(200,180,130,0.6); margin-bottom: 0.35rem;
}
`;

// Tabs descriptor
const TABS = [
  { id: 'party',      label: 'Party'      },
  { id: 'inventory',  label: 'Inventory'  },
  { id: 'spells',     label: 'Spells'     },
  { id: 'passives',   label: 'Passives'   },
  { id: 'attributes', label: 'Attributes' },
];

export class PartyPanelScreen {
  constructor(manager, audio, opts = {}) {
    this.manager = manager;
    this.audio = audio;
    this._tab = opts.tab || 'party';
    this._el = null;
    this._subScreen = null;
    // Selected character index for the avatar row — synced into sub-screens.
    // M402: callers (PartyScreen detail buttons) can pre-focus a specific
    // hero via opts.charIdx so opening Skills/Inventory keeps the same
    // selection from the previous screen.
    this._charIdx = Number.isFinite(opts.charIdx) ? Math.max(0, opts.charIdx | 0) : 0;
    // Dual-compare state (task 5)
    this._dualCmpItem = null;
    this._dualCmpVisible = false;
  }

  onEnter() {
    injectStyles('pps-styles', PPS_STYLES);
    this._el = createEl('div', 'pps-screen');
    this.manager.uiOverlay.appendChild(this._el);
    this._render();
  }

  onPause() { if (this._el) this._el.style.display = 'none'; }
  onResume() { if (this._el) { this._el.style.display = 'flex'; } }
  onExit() {
    this._destroySubScreen();
    if (this._el) kbUnmount(this._el);
    removeEl(this._el);
    this._el = null;
  }
  update() {
    if (this._subScreen?.update) this._subScreen.update();
    // M398 — keep avatar-row pendingPoints badges in sync with live state.
    // Spending a passive/attr point in the sub-screen mutates the character
    // in place; the badge must reflect the new total without waiting for a
    // full _render pass.
    this._refreshCharBadges();
  }
  /**
   * Re-read pendingSkill/Passive/Attr points off each character and update
   * (or insert / remove) the .pps-char-badge inside each .pps-char-btn.
   * Cheap — runs once per update tick. No-op when DOM not mounted.
   */
  _refreshCharBadges() {
    if (!this._el) return;
    const gs = GameState.get();
    const chars = [...(gs.party || []), ...(gs.companions || [])];
    const btns = this._el.querySelectorAll('.pps-char-btn');
    btns.forEach((btn) => {
      const idx = parseInt(btn.dataset.cidx || '-1', 10);
      const c = chars[idx];
      if (!c) return;
      const isComp = c.isCompanion || c.class === 'companion';
      const p = isComp ? 0 : ((c.pendingSkillPoints || 0) + (c.pendingPassivePoints || 0) + (c.pendingAttrPoints || 0));
      const nameEl = btn.querySelector('.pps-char-name');
      if (!nameEl) return;
      let badge = nameEl.querySelector('.pps-char-badge');
      if (p > 0) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'pps-char-badge';
          nameEl.appendChild(badge);
        }
        const txt = String(p);
        if (badge.textContent !== txt) badge.textContent = txt;
      } else if (badge) {
        badge.remove();
      }
    });
  }
  draw()   { if (this._subScreen?.draw)   this._subScreen.draw(); }

  // ── Build ────────────────────────────────────────────────────────────────

  _render() {
    if (!this._el) return;
    const gs = GameState.get();
    const chars = [...(gs.party || []), ...(gs.companions || [])];
    if (this._charIdx >= chars.length) this._charIdx = 0;

    // Pending-points badge for each character
    const pendingFor = (m) => {
      if (!m || m.isCompanion || m.class === 'companion') return 0;
      return (m.pendingSkillPoints || 0) + (m.pendingPassivePoints || 0) + (m.pendingAttrPoints || 0);
    };

    const tabBarHtml = `
      <div class="pps-tab-bar" role="tablist" id="pps-tabs">
        ${TABS.map(t => `
          <button type="button" class="pps-tab${this._tab === t.id ? ' active' : ''}"
            role="tab" aria-selected="${this._tab === t.id}"
            data-tab="${t.id}">${t.label}</button>
        `).join('')}
        <button type="button" class="pps-close" id="pps-close" aria-label="Close">✕</button>
      </div>
    `;

    const charRowHtml = `
      <div class="pps-char-row" id="pps-char-row" aria-label="Select character">
        ${chars.map((c, i) => {
          const p = pendingFor(c);
          return `
          <button type="button" class="pps-char-btn${i === this._charIdx ? ' active' : ''}"
            data-cidx="${i}" aria-label="${c.name}">
            ${portraitImg(c, 36, 'pps-char-portrait')}
            <span class="pps-char-name">${c.name}${p > 0 ? `<span class="pps-char-badge">${p}</span>` : ''}</span>
          </button>
          `;
        }).join('')}
      </div>
    `;

    // Destroy existing sub-screen before rebuilding markup
    this._destroySubScreen();

    this._el.innerHTML = `
      ${tabBarHtml}
      ${charRowHtml}
      <div class="pps-tab-body pps-tab-${this._tab}" id="pps-tab-body"></div>
    `;

    // Wire tab buttons
    this._el.querySelectorAll('.pps-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.audio.playSfx('click');
        this._tab = btn.dataset.tab;
        this._render();
      });
    });

    // Wire close
    this._el.querySelector('#pps-close')?.addEventListener('click', () => {
      this.audio.playSfx('click');
      this.manager.pop();
    });

    // Wire character row
    this._el.querySelectorAll('.pps-char-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.audio.playSfx('click');
        this._charIdx = parseInt(btn.dataset.cidx, 10);
        this._syncCharToSubScreen();
        // Refresh the avatar row active state without full rebuild
        this._el.querySelectorAll('.pps-char-btn').forEach((b, i) => {
          b.classList.toggle('active', i === this._charIdx);
        });
      });
    });

    // Mount the sub-screen for current tab
    this._mountTab();

    // M297: keyboard navigation — re-mount after each render.
    // Tab bar and char row use horizontal layout; rest of content is vertical.
    // We mount at the screen level with vertical as default (sub-screens have their own buttons).
    kbUnmount(this._el);
    kbMount(this._el, {
      layout: 'vertical',
      focusFirst: false,
      onEscape: () => { this.audio.playSfx('click'); this.manager.pop(); },
    });
  }

  // ── Sub-screen mounting ──────────────────────────────────────────────────

  _destroySubScreen() {
    if (this._subScreen) {
      try { this._subScreen.onExit?.(); } catch (_) {}
      this._subScreen = null;
    }
  }

  /**
   * Create a shim "manager" that intercepts pop() calls — instead of popping
   * the whole PartyPanelScreen, a pop from a sub-screen just stays on the
   * current tab (the user uses our "X" button to close).
   */
  _makeSubManager() {
    const real = this.manager;
    return new Proxy(real, {
      get(target, prop) {
        if (prop === 'pop') {
          // Sub-screens that call manager.pop() (e.g. close button) do nothing
          // since we hide their close buttons. If they still fire pop, no-op.
          return () => {};
        }
        if (prop === 'push') {
          // Sub-screens that push a new screen (e.g. LevelUpScreen from SkillTree)
          // route to the real manager.
          return (...args) => real.push(...args);
        }
        const val = target[prop];
        return typeof val === 'function' ? val.bind(target) : val;
      }
    });
  }

  _mountTab() {
    const body = this._el?.querySelector('#pps-tab-body');
    if (!body) return;

    const shimManager = this._makeSubManager();

    if (this._tab === 'party') {
      this._mountPartyTab(body, shimManager);
    } else if (this._tab === 'inventory') {
      this._mountInventoryTab(body, shimManager);
    } else if (this._tab === 'spells') {
      this._mountSkillTab(body, shimManager, 'active');
    } else if (this._tab === 'passives') {
      this._mountSkillTab(body, shimManager, 'passive');
    } else if (this._tab === 'attributes') {
      this._mountSkillTab(body, shimManager, 'attrs');
    }
  }

  _mountPartyTab(body, shimManager) {
    import('./PartyScreen.js').then(({ PartyScreen }) => {
      if (!this._el) return;
      const screen = new PartyScreen(shimManager, this.audio);
      this._subScreen = screen;
      // Temporarily redirect uiOverlay to the tab body
      const realOverlay = this.manager.uiOverlay;
      shimManager.uiOverlay = body;
      screen.onEnter();
      shimManager.uiOverlay = realOverlay;
    }).catch(e => {
      body.innerHTML = `<div style="padding:1rem;color:#c04030">Failed to load Party: ${e.message}</div>`;
    });
  }

  _mountInventoryTab(body, shimManager) {
    // M295 — inject potion belt section above the inventory sub-screen
    this._renderPotionBelt(body);

    import('./InventoryScreen.js').then(({ InventoryScreen }) => {
      if (!this._el) return;
      const screen = new InventoryScreen(shimManager, this.audio);
      screen._selectedCharIdx = this._charIdx;
      this._subScreen = screen;
      const realOverlay = this.manager.uiOverlay;
      shimManager.uiOverlay = body;
      screen.onEnter();
      shimManager.uiOverlay = realOverlay;
      // Wire dual-compare (task 5) after mount
      if (_isDesktopCompare()) {
        this._wireDualCompare(screen, body);
      }
    }).catch(e => {
      body.innerHTML = `<div style="padding:1rem;color:#c04030">Failed to load Inventory: ${e.message}</div>`;
    });
  }

  // ── Potion Belt (M295) ───────────────────────────────────────────────────

  _renderPotionBelt(container) {
    // Remove any existing belt section
    container.querySelector('.pps-pb-section')?.remove();

    const gs = GameState.get();
    const chars = [...(gs.party || []), ...(gs.companions || [])];
    const char = chars[this._charIdx];
    if (!char) return;

    // Ensure potionBelt exists
    if (!Array.isArray(char.potionBelt)) char.potionBelt = [];

    const BELT_SIZE = 3;
    const slots = Array.from({ length: BELT_SIZE }, (_, i) => char.potionBelt[i] || null);

    const section = document.createElement('div');
    section.className = 'pps-pb-section';

    const slotsHtml = slots.map((pot, i) => {
      if (pot) {
        return `<div class="pps-pb-slot filled" data-belt-slot="${i}" title="${pot.name} — tap to remove">
          <span class="pps-pb-slot-name">${pot.name.replace('Potion','Pot.').replace('Flask','Flask').replace('Greater Healing','Gr. Heal')}</span>
          <span class="pps-pb-clear" data-belt-clear="${i}" aria-label="Remove">&times;</span>
        </div>`;
      }
      return `<div class="pps-pb-slot" data-belt-slot="${i}" title="Tap to assign a potion to this belt slot">
        <span style="font-size:0.65rem;color:rgba(200,180,130,0.3)">+</span>
      </div>`;
    }).join('');

    section.innerHTML = `
      <div class="pps-pb-label">Potion Belt <span style="font-size:0.55rem;color:rgba(160,140,110,0.4)">(${char.potionBelt.filter(Boolean).length}/${BELT_SIZE} slots used)</span></div>
      <div class="pps-pb-slots">
        ${slotsHtml}
        <span class="pps-pb-hint">Quick-use in combat</span>
      </div>
    `;
    // Prepend so it appears above the inventory sub-screen
    container.prepend(section);

    // Wire slot clicks — open picker
    section.querySelectorAll('[data-belt-slot]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-belt-clear]')) return; // handled below
        const slotIdx = parseInt(el.dataset.beltSlot, 10);
        this._openBeltPicker(el, slotIdx, char, container);
      });
    });
    // Wire clear buttons
    section.querySelectorAll('[data-belt-clear]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const slotIdx = parseInt(btn.dataset.beltClear, 10);
        char.potionBelt[slotIdx] = null;
        // Trim trailing nulls
        while (char.potionBelt.length && char.potionBelt[char.potionBelt.length - 1] === null) char.potionBelt.pop();
        this.audio.playSfx('click');
        this._renderPotionBelt(container);
      });
    });
  }

  _openBeltPicker(anchorEl, slotIdx, char, container) {
    // Close any open picker
    document.querySelectorAll('.pps-pb-potion-picker').forEach(p => p.remove());

    const gs = GameState.get();
    const potions = (gs.potions || []).filter(p => p.type === 'consumable');
    if (!potions.length) {
      this.audio.playSfx('click');
      return;
    }

    const picker = document.createElement('div');
    picker.className = 'pps-pb-potion-picker';

    // Position near anchor
    const rect = anchorEl.getBoundingClientRect();
    picker.style.top = `${Math.min(rect.bottom + 4, window.innerHeight - 200)}px`;
    picker.style.left = `${Math.min(rect.left, window.innerWidth - 200)}px`;

    picker.innerHTML = `<div class="pps-pb-picker-title">Assign to Slot ${slotIdx + 1}</div>` +
      potions.map(p => `<button type="button" class="pps-pb-picker-opt" data-pot-uid="${p.uid}">${p.name}</button>`).join('') +
      `<button type="button" class="pps-pb-picker-cancel">Cancel</button>`;
    document.body.appendChild(picker);

    picker.querySelectorAll('.pps-pb-picker-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        const pot = potions.find(p => p.uid === btn.dataset.potUid);
        if (!pot) { picker.remove(); return; }
        if (!Array.isArray(char.potionBelt)) char.potionBelt = [];
        char.potionBelt[slotIdx] = { id: pot.id, uid: pot.uid, name: pot.name, effect: pot.effect, target: pot.target };
        picker.remove();
        this.audio.playSfx('click');
        this._renderPotionBelt(container);
      });
    });
    picker.querySelector('.pps-pb-picker-cancel').addEventListener('click', () => {
      picker.remove();
    });

    // Close on outside click
    const closeOnOutside = (e) => {
      if (!picker.contains(e.target)) {
        picker.remove();
        document.removeEventListener('click', closeOnOutside, { capture: true });
      }
    };
    setTimeout(() => document.addEventListener('click', closeOnOutside, { capture: true }), 0);
  }

  _mountSkillTab(body, shimManager, tabName) {
    import('./SkillTreeScreen.js').then(({ SkillTreeScreen }) => {
      if (!this._el) return;
      const screen = new SkillTreeScreen(shimManager, this.audio);
      screen._selectedCharIdx = this._charIdx;
      screen._tab = tabName;
      // M384 — tell SkillTreeScreen the caller already chose a tab. Without
      // this flag, onEnter() would always re-route to whichever sub-tab has
      // pending points, so clicking Passives/Attributes from the unified
      // panel was silently bouncing back to Spells.
      screen._tabPinned = true;
      this._subScreen = screen;
      const realOverlay = this.manager.uiOverlay;
      shimManager.uiOverlay = body;
      screen.onEnter();
      shimManager.uiOverlay = realOverlay;
    }).catch(e => {
      body.innerHTML = `<div style="padding:1rem;color:#c04030">Failed to load skills: ${e.message}</div>`;
    });
  }

  // ── Character sync ───────────────────────────────────────────────────────

  _syncCharToSubScreen() {
    if (!this._subScreen) return;
    // Update the selected index on the sub-screen and re-render it.
    if ('_selectedCharIdx' in this._subScreen) {
      this._subScreen._selectedCharIdx = this._charIdx;
      try { this._subScreen._render?.(); } catch (_) {}
    }
  }

  // ── Task 5: Dual-compare (desktop only) ──────────────────────────────────

  /**
   * After the InventoryScreen mounts, intercept item card hover to show a
   * side-by-side comparison of both ring slots (or weapon+offhand) when on
   * a wide pointer device.
   *
   * Implementation: listen for tooltip-body renders on the existing tooltip,
   * and when an item with a secondary slot is active, inject a dual-compare
   * panel below the tab body.
   */
  _wireDualCompare(invScreen, body) {
    if (!_isDesktopCompare()) return;
    const { getItemCompareTooltip } = Promise.resolve().then(() =>
      import('../../game/items.js')
    );

    // Observe tooltip visibility by watching the #inv-tt element for display changes.
    // We poll at pointer-move resolution via the existing tooltip show path.
    // Simpler approach: intercept renderTooltipBody by patching _vsItemForCompare.
    const orig_vsItemForCompare = invScreen._vsItemForCompare.bind(invScreen);
    invScreen._vsItemForCompare = (char, item) => {
      const result = orig_vsItemForCompare(char, item);
      // Trigger dual-compare panel update asynchronously so tooltip renders first.
      requestAnimationFrame(() => this._updateDualCmpPanel(invScreen, item, char, body));
      return result;
    };

    // Hide dual-compare panel when tooltip hides.
    const origHideBody = body.querySelector;
    body.addEventListener('pointerleave', () => {
      this._hideDualCmpPanel(body);
    });
  }

  _updateDualCmpPanel(invScreen, item, char, body) {
    if (!item || !char || !_isDesktopCompare()) {
      this._hideDualCmpPanel(body); return;
    }
    const slots = invScreen._slotsForItem?.(char, item);
    if (!slots || slots.length < 2) { this._hideDualCmpPanel(body); return; }

    // Only show for rings or weapon+offhand
    const isRings = slots.includes('ring1') && slots.includes('ring2');
    const isWeapon = slots.includes('weapon') && slots.includes('offhand');
    if (!isRings && !isWeapon) { this._hideDualCmpPanel(body); return; }

    const eqp = char.equipment || {};
    const [slotA, slotB] = isRings ? ['ring1', 'ring2'] : ['weapon', 'offhand'];
    const vsA = eqp[slotA] || null;
    const vsB = eqp[slotB] || null;

    // Dynamically import items.js for the compare tooltip renderer
    import('../../game/items.js').then(({ getItemCompareTooltip }) => {
      if (!this._el) return;
      const labelA = isRings ? 'Ring Slot 1 vs New' : 'Main Hand vs New';
      const labelB = isRings ? 'Ring Slot 2 vs New' : 'Off-Hand vs New';
      const htmlA = getItemCompareTooltip(item, vsA, { hero: char, slotLabel: slotA });
      const htmlB = getItemCompareTooltip(item, vsB, { hero: char, slotLabel: slotB });

      let panel = body.querySelector('.pps-dual-cmp');
      if (!panel) {
        panel = document.createElement('div');
        panel.className = 'pps-dual-cmp';
        body.appendChild(panel);
      }
      panel.innerHTML = `
        <div class="pps-dual-cmp-col">
          <div class="pps-dual-cmp-label">${labelA}</div>
          ${htmlA}
        </div>
        <div class="pps-dual-cmp-col">
          <div class="pps-dual-cmp-label">${labelB}</div>
          ${htmlB}
        </div>
      `;
      panel.style.display = 'flex';
    }).catch(() => {});
  }

  _hideDualCmpPanel(body) {
    const panel = body?.querySelector('.pps-dual-cmp');
    if (panel) panel.style.display = 'none';
  }
}
