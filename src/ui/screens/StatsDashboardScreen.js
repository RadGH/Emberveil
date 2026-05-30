/**
 * StatsDashboardScreen — M279 base, expanded M285-M289.
 *
 * Multi-tab analytics dashboard with chart.js charts and a filter bar that
 * re-renders charts live. Same screen serves both the in-game pause menu
 * and the main-menu Stats button; the `mode` constructor arg toggles
 * extra tabs that only make sense in one context.
 *
 * Modes:
 *   'in_game'   — every tab is available; uses live GameState
 *   'main_menu' — disables tabs that need a live run, exposes Cross-Run
 *
 * Tabs:
 *   overview       — top-level KPIs + 4 chart.js mini charts
 *   characters     — per-character cards (HP/MP/crit/blocks + DPS line)
 *   damage         — damage timeline (chart.js line) + per-skill bar (M289)
 *   loot           — drops by rarity / by zone / magic find rolling (M287)
 *   power          — character power growth (M288)
 *   combat         — chronological combat log
 *   lifetime       — cross-session totals + run history
 *   crossrun       — main-menu only: best-run cards + run-vs-run line (M286)
 *
 * Filters (apply globally across all charts):
 *   timeRange: 'fight' | '5min' | 'zone' | 'run' | 'lifetime'
 *   memberId : 'all' | <member.id>
 *   fightKind: 'all' | 'regular' | 'boss' | 'dungeon'
 */
import { createEl, removeEl, injectStyles } from '../../utils/dom.js';
import { mount as kbMount, unmount as kbUnmount } from '../../utils/keyboardNav.js';
import { GameState } from '../../game/gameState.js';
import { SaveManager } from '../../engine/SaveManager.js';
import { computeItemScores } from '../../game/items.js';
import {
  ensureStats, getLifeStats, getCharStats, getCharLog, getDpsSeries,
  getDropsForView, getPowerSeriesForView, getDamageBySkillForView,
  getDamageByElementForView, getDamageTakenBySourceForView,
} from '../../game/stats.js';
import Chart from 'chart.js/auto';

// Project palette
const PALETTE = ['#e8a020','#60c0e0','#a060e0','#40a060','#e85020','#c04030','#f0d090','#80c0a0','#c08060','#6080e0'];

const STYLES = `
.sd-screen { position: absolute; inset: 0; background: #0b0810; color: #f0e8d8;
  display: flex; flex-direction: column; font-family: 'Inter', system-ui, sans-serif; overflow: hidden; }
.sd-header { padding: 0.75rem 1rem; display: flex; align-items: center; gap: 0.5rem;
  border-bottom: 1px solid rgba(232,160,32,0.25); background: rgba(20,16,12,0.65); }
.sd-title { font-family: 'Cinzel', serif; color: #e8a020; font-size: 1rem; font-weight: 800;
  letter-spacing: 0.08em; text-transform: uppercase; flex: 1; }
.sd-mode-badge { font-size: 0.6rem; color: #8a7a6a; letter-spacing: 0.08em;
  text-transform: uppercase; padding: 0.15rem 0.45rem; border: 1px solid rgba(232,160,32,0.25);
  border-radius: 8px; }
.sd-back { background: rgba(20,16,12,0.65); border: 1px solid rgba(232,160,32,0.4);
  color: #e8d090; padding: 0.4rem 0.7rem; border-radius: 4px; cursor: pointer;
  min-height: 44px; min-width: 44px; }
.sd-tabs { display: flex; gap: 0.25rem; padding: 0.4rem 0.6rem; background: rgba(0,0,0,0.3);
  overflow-x: auto; -webkit-overflow-scrolling: touch; flex-shrink: 0; }
.sd-tab-select {
  display: none; width: 100%;
  background: rgba(10,6,8,0.97); border: none; border-bottom: 2px solid rgba(232,160,32,0.4);
  color: #f8e0a0; padding: 0.75rem 1rem; font-size: 0.82rem; font-weight: 600;
  font-family: inherit; cursor: pointer; flex-shrink: 0;
  -webkit-appearance: none; appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23e8a020' stroke-width='1.5' fill='none'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 0.75rem center;
  padding-right: 2.5rem; min-height: 44px;
}
@media (max-width: 700px) {
  .sd-tabs { display: none; }
  .sd-tab-select { display: block; }
}
.sd-tab { background: rgba(20,16,12,0.6); border: 1px solid rgba(232,160,32,0.25);
  color: #c0a878; padding: 0.45rem 0.85rem; border-radius: 4px; cursor: pointer;
  white-space: nowrap; font-size: 0.78rem; font-weight: 600; min-height: 44px; }
.sd-tab.active { background: rgba(232,160,32,0.18); color: #f8e0a0; border-color: #e8a020; }
.sd-tab[disabled] { opacity: 0.35; cursor: not-allowed; }
.sd-filters { display: flex; gap: 0.4rem; padding: 0.4rem 0.6rem; background: rgba(0,0,0,0.45);
  border-bottom: 1px solid rgba(232,160,32,0.15); overflow-x: auto;
  -webkit-overflow-scrolling: touch; flex-shrink: 0; }
.sd-filter { display: flex; align-items: center; gap: 0.35rem; flex-shrink: 0; }
.sd-filter label { font-size: 0.6rem; color: #8a7a6a; text-transform: uppercase; letter-spacing: 0.08em; }
.sd-filter select { background: rgba(20,16,12,0.85); border: 1px solid rgba(232,160,32,0.3);
  color: #f0e8d8; padding: 0.35rem 0.45rem; border-radius: 3px; font-size: 0.75rem;
  font-family: inherit; min-height: 36px; }
.sd-body { flex: 1; overflow-y: auto; padding: 1rem; padding-bottom: 4rem; }
.sd-grid { display: grid; gap: 0.75rem; grid-template-columns: 1fr; }
@media (min-width: 600px) { .sd-grid { grid-template-columns: 1fr 1fr; } }
.sd-card { background: rgba(20,16,12,0.7); border: 1px solid rgba(232,160,32,0.18);
  border-radius: 6px; padding: 0.75rem; }
.sd-card h3 { margin: 0 0 0.5rem; font-family: 'Cinzel', serif; color: #e8a020;
  font-size: 0.85rem; letter-spacing: 0.06em; text-transform: uppercase; }
.sd-stat-row { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.5rem; }
.sd-stat { background: rgba(0,0,0,0.4); border: 1px solid rgba(232,160,32,0.15);
  padding: 0.4rem 0.6rem; border-radius: 4px; min-width: 100px; flex: 1; }
.sd-stat .k { font-size: 0.6rem; color: #8a7a6a; text-transform: uppercase; letter-spacing: 0.08em; }
.sd-stat .v { font-size: 1.05rem; color: #f5d97a; font-weight: 700; font-family: 'Cinzel', serif; }
.sd-chart-wrap { position: relative; height: 220px; width: 100%; }
.sd-chart-wrap.tall { height: 260px; }
.sd-chart-wrap canvas { max-height: 100%; }
.sd-svg { width: 100%; height: 180px; display: block; }
.sd-empty { text-align: center; color: #8a7a6a; padding: 2rem 1rem; font-style: italic; }
.sd-log { font-size: 0.78rem; }
.sd-log-row { padding: 0.35rem 0.5rem; border-left: 3px solid #4a3a2a; margin-bottom: 0.25rem;
  background: rgba(0,0,0,0.25); border-radius: 0 3px 3px 0; }
.sd-log-row.major_kill { border-left-color: #e8a020; }
.sd-log-row.elite_kill { border-left-color: #c060e0; }
.sd-log-row.death      { border-left-color: #c04030; }
.sd-log-row.near_death { border-left-color: #e85020; }
.sd-log-row.story      { border-left-color: #60a0e0; }
.sd-log-row .t { color: #8a7a6a; font-size: 0.65rem; }
.sd-list { font-size: 0.78rem; }
.sd-list-row { display: flex; justify-content: space-between; padding: 0.3rem 0.4rem;
  border-bottom: 1px solid rgba(255,255,255,0.05); }
.sd-list-row strong { color: #e8d090; }
.sd-list-row .meta { color: #8a7a6a; font-size: 0.7rem; }
.sd-bestrun { background: linear-gradient(135deg, rgba(232,160,32,0.15), rgba(192,96,224,0.1));
  border-color: rgba(232,160,32,0.4); }
.sd-hero-tbl { width: 100%; border-collapse: collapse; font-size: 0.78rem; margin-top: 0.4rem; }
.sd-hero-tbl th { text-align: left; padding: 0.3rem 0.5rem;
  border-bottom: 1px solid rgba(232,160,32,0.3); color: #c8a060;
  font-weight: 500; letter-spacing: 0.04em; }
.sd-hero-tbl th.num, .sd-hero-tbl td.num { text-align: right; font-variant-numeric: tabular-nums; }
.sd-hero-tbl td { padding: 0.3rem 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); color: #d0c0a0; }
.sd-hero-tbl tbody tr:hover { background: rgba(232,160,32,0.05); }
.sd-combat-row summary { display: flex; align-items: center; gap: 0.5rem; }
.sd-combat-row summary::-webkit-details-marker { display: none; }
.sd-combat-row[open] summary { border-bottom: 1px solid rgba(232,160,32,0.15); }
.sd-filter.sd-filter-slot select { min-width: 11rem; max-width: 18rem; }
.sd-filter.sd-filter-slot select option { font-family: inherit; }
.sd-last50-notice {
  margin-top: 1rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.68rem;
  color: #8a7a6a;
  text-align: center;
  font-style: italic;
  border-top: 1px dashed rgba(232,160,32,0.12);
  letter-spacing: 0.02em;
}
.sd-slot-empty {
  background: rgba(20,16,12,0.55);
  border: 1px dashed rgba(232,160,32,0.2);
  color: #8a7a6a;
  padding: 1rem;
  border-radius: 6px;
  text-align: center;
  font-style: italic;
  font-size: 0.78rem;
  margin: 0.5rem 0;
}
`;

function _esc(s) { return String(s ?? '').replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c])); }

// ── chart.js global defaults (dark theme) ─────────────────────────────────────
Chart.defaults.color = '#c0a878';
Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
Chart.defaults.font.size = 11;
Chart.defaults.borderColor = 'rgba(232,160,32,0.15)';
Chart.defaults.plugins.legend.labels.boxWidth = 12;
Chart.defaults.plugins.legend.labels.padding = 8;

// ── Screen ────────────────────────────────────────────────────────────────────

const TIME_RANGES = [
  ['fight', 'Current Fight'], ['5min', 'Last 5 Min'], ['zone', 'Current Zone'],
  ['run', 'Current Run'], ['lifetime', 'Lifetime'],
];
const FIGHT_KINDS = [
  ['all', 'All Fights'], ['regular', 'Regular'], ['boss', 'Bosses'], ['dungeon', 'Dungeon'],
];

export class StatsDashboardScreen {
  /**
   * @param {object} manager
   * @param {object} audio
   * @param {object} [opts] - { mode: 'in_game'|'main_menu' }
   */
  constructor(manager, audio, opts = {}) {
    this.manager = manager;
    this.audio = audio;
    // M312 #20: opt out of global ESC→GameMenu; we handle Escape ourselves (pop).
    this.noGameMenuEsc = true;
    this._mode = opts.mode || 'in_game';
    this._el = null;
    this._charts = []; // chart.js instances to dispose on rebuild
    this._tab = 'overview';
    this._filters = {
      timeRange: this._mode === 'main_menu' ? 'lifetime' : 'run',
      memberId: 'all',
      fightKind: 'all',
      // M? — save-slot filter. 'all' or a SaveManager save.key.
      slotKey: 'all',
    };
    // Cloud combat history loaded on mount — persists across sessions.
    // Null = not yet fetched; [] = fetched but empty/signed-out.
    this._cloudCombatHistory = null;
    this._cloudCombatLoading = false;
  }
  onEnter() {
    injectStyles('sd-styles', STYLES);
    this._build();
    // Kick off background cloud fetch so the Combat tab populates from cloud
    // data when the user opens it (even after a page refresh or new device).
    this._fetchCloudCombatHistory();
  }
  onLeave() { this._destroyCharts(); if (this._el) kbUnmount(this._el); removeEl(this._el); this._el = null; }
  onExit()  { this._destroyCharts(); if (this._el) kbUnmount(this._el); removeEl(this._el); this._el = null; }
  destroy() { this._destroyCharts(); if (this._el) kbUnmount(this._el); removeEl(this._el); this._el = null; }

  _destroyCharts() {
    for (const c of this._charts) { try { c.destroy(); } catch (_) {} }
    this._charts = [];
  }

  /**
   * Load the last 50 combat sessions from Supabase and cache them on this
   * instance. Re-renders the combat tab if it's already visible. Fires
   * once per mount; subsequent tab-switches read from the cache.
   */
  async _fetchCloudCombatHistory() {
    if (this._cloudCombatLoading) return;
    this._cloudCombatLoading = true;
    try {
      const { runStatsClient } = await import('../../auth/runStatsClient.js');
      const rows = await runStatsClient.listCombatHistory({ limit: 50 });
      this._cloudCombatHistory = rows;
      // M474 — re-render whatever tab is currently active, not just combat.
      // The Kills-by-Hero / Damage-by-Hero charts on the Overview tab also
      // depend on the merged cloud history; otherwise they show empty for
      // the entire session because the synchronous Overview render fires
      // before this async fetch resolves.
      if (this._el && typeof this._renderBody === 'function') {
        // M475b — also rebuild the slot dropdown options so the per-slot
        // "N fights" counts reflect the freshly-loaded cloud history. The
        // dropdown is constructed in _build() before the async fetch, so
        // it initially shows 0 for every slot.
        this._refreshSlotDropdown();
        this._renderBody();
      }
      if (window.__statsDebug) {
        console.log('[stats] cloud history loaded', { rows: rows.length, tab: this._tab });
      }
    } catch (_) {
      this._cloudCombatHistory = [];
    } finally {
      this._cloudCombatLoading = false;
    }
  }

  /**
   * Merge local combatHistory (current run, in-memory) with cloud history.
   * Local entries take precedence for the current run; cloud entries fill in
   * history from previous sessions. Returns newest-first, capped at 50.
   */
  _mergedCombatHistory() {
    const combined = this._mergedCombatHistoryRaw();
    // Apply save-slot filter, if any.
    const slot = this._selectedSlot();
    if (!slot) return combined;
    const wantName = String(slot.heroName || '').toLowerCase();
    const wantClass = String(slot.heroClass || '').toLowerCase();
    const gs = GameState.get();
    const isActiveSlot = gs.currentSaveKey && gs.currentSaveKey === slot.key;
    return combined.filter(e => this._entryMatchesSlot(e, wantName, wantClass, isActiveSlot));
  }

  _availableTabs() {
    // M482c — main_menu always shows ALL tabs. Tabs that need an active
    // party render from cloud history when none is loaded (Overview chart
    // members union live + cloud per M477; Lifetime per-hero charts read
    // from combat_history per M475). Previously the no-party branch hid
    // every tab except lifetime/crossrun, surprising users who expected
    // the same nav after a refresh as after a quit-to-menu.
    const t = ['overview', 'characters', 'damage', 'loot', 'power', 'combat', 'lifetime'];
    if (this._mode === 'main_menu') return [...t, 'crossrun'];
    return t;
  }

  _build() {
    this._destroyCharts();
    if (this._el) removeEl(this._el);
    this._el = createEl('div', 'sd-screen');
    const tabs = this._availableTabs();
    if (!tabs.includes(this._tab)) this._tab = tabs[0];
    const labels = {
      overview: 'Overview', characters: 'Per-Character', damage: 'Damage',
      loot: 'Loot & MF', power: 'Power', combat: 'Combat Log',
      lifetime: 'Lifetime', crossrun: 'Cross-Run',
    };
    const members = this._partyMembers();
    const memberOptions = ['<option value="all">All Heroes</option>',
      ...members.map(m => `<option value="${_esc(m.id)}"${m.id === this._filters.memberId ? ' selected' : ''}>${_esc(m.name)}</option>`)].join('');
    // M? — save-slot filter options. Each option shows the hero label and
    // the count of recorded combat sessions for that slot.
    const slots = this._listSaveSlots();
    // If the previously-selected slot no longer exists (deleted save), fall
    // back to 'all' so the UI doesn't show an empty selection.
    if (this._filters.slotKey !== 'all' && !slots.some(s => s.key === this._filters.slotKey)) {
      this._filters.slotKey = 'all';
    }
    const totalCount = this._mergedCombatHistoryRaw().length;
    const slotOptions = [
      `<option value="all"${this._filters.slotKey === 'all' ? ' selected' : ''}>All slots — ${totalCount} fight${totalCount === 1 ? '' : 's'}</option>`,
      ...slots.map(s => {
        const sel = s.key === this._filters.slotKey ? ' selected' : '';
        return `<option value="${_esc(s.key)}"${sel}>${_esc(s.label)} — ${s.count} fight${s.count === 1 ? '' : 's'}</option>`;
      }),
    ].join('');
    this._el.innerHTML = `
      <div class="sd-header">
        <button type="button" class="sd-back" id="sd-back">←</button>
        <div class="sd-title">Statistics</div>
        <div class="sd-mode-badge">${this._mode === 'main_menu' ? 'Main Menu' : 'In Game'}</div>
      </div>
      <select class="sd-tab-select" id="sd-tab-select" aria-label="Select statistics tab">
        ${tabs.map(t => `<option value="${t}"${t === this._tab ? ' selected' : ''}>${labels[t]}</option>`).join('')}
      </select>
      <div class="sd-tabs">
        ${tabs.map(t => `<button type="button" class="sd-tab${t === this._tab ? ' active' : ''}" data-tab="${t}">${labels[t]}</button>`).join('')}
      </div>
      <div class="sd-filters">
        <div class="sd-filter sd-filter-slot">
          <label>Slot</label>
          <select id="f-slot" aria-label="Filter stats by save slot">${slotOptions}</select>
        </div>
        <div class="sd-filter">
          <label>Range</label>
          <select id="f-time">
            ${TIME_RANGES.map(([v,l]) => `<option value="${v}"${v === this._filters.timeRange ? ' selected':''}>${l}</option>`).join('')}
          </select>
        </div>
        <div class="sd-filter">
          <label>Hero</label>
          <select id="f-member">${memberOptions}</select>
        </div>
        <div class="sd-filter">
          <label>Fight</label>
          <select id="f-fight">
            ${FIGHT_KINDS.map(([v,l]) => `<option value="${v}"${v === this._filters.fightKind ? ' selected':''}>${l}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="sd-body" id="sd-body"></div>
    `;
    this.manager.uiOverlay.appendChild(this._el);
    this._el.querySelector('#sd-back').addEventListener('click', () => {
      this.audio?.playSfx?.('click');
      // M290 — eagerly tear down the screen DOM + chart instances on back-tap.
      // Some screen-manager pop paths from main_menu didn't invoke onLeave
      // synchronously, leaving the dashboard layered behind the title screen.
      this._destroyCharts();
      if (this._el) { removeEl(this._el); this._el = null; }
      this.manager.pop();
    });
    this._el.querySelector('#sd-tab-select')?.addEventListener('change', (e) => {
      this._tab = e.target.value; this.audio?.playSfx?.('click'); this._build();
    });
    this._el.querySelectorAll('.sd-tab').forEach(b => b.addEventListener('click', () => {
      this._tab = b.dataset.tab; this.audio?.playSfx?.('click'); this._build();
    }));
    this._el.querySelector('#f-slot')?.addEventListener('change', e => {
      this._filters.slotKey = e.target.value; this._renderBody();
    });
    this._el.querySelector('#f-time').addEventListener('change', e => { this._filters.timeRange = e.target.value; this._renderBody(); });
    this._el.querySelector('#f-member').addEventListener('change', e => { this._filters.memberId = e.target.value; this._renderBody(); });
    this._el.querySelector('#f-fight').addEventListener('change', e => { this._filters.fightKind = e.target.value; this._renderBody(); });
    this._renderBody();

    // M297: keyboard navigation — re-mount after each _build call.
    kbUnmount(this._el);
    kbMount(this._el, {
      layout: 'vertical',
      focusFirst: false,
      onEscape: () => {
        this.audio?.playSfx?.('click');
        this._destroyCharts();
        if (this._el) { removeEl(this._el); this._el = null; }
        this.manager.pop();
      },
    });
  }

  _renderBody() {
    this._destroyCharts();
    const body = this._el.querySelector('#sd-body');
    body.innerHTML = '';
    if (this._tab === 'overview')   this._renderOverview(body);
    else if (this._tab === 'characters') this._renderCharacters(body);
    else if (this._tab === 'damage')     this._renderDamage(body);
    else if (this._tab === 'loot')       this._renderLoot(body);
    else if (this._tab === 'power')      this._renderPower(body);
    else if (this._tab === 'combat')     this._renderCombatLog(body);
    else if (this._tab === 'lifetime')   this._renderLifetime(body);
    else if (this._tab === 'crossrun')   this._renderCrossRun(body);
    // M? — persistent "last 50 sessions" notice across every tab. Static
    // copy explaining the cloud-sync cap. Subtle styling via CSS class.
    const notice = document.createElement('div');
    notice.className = 'sd-last50-notice';
    notice.textContent = 'Only the last 50 combat sessions per save slot are kept in cloud sync.';
    body.appendChild(notice);
  }

  /**
   * List save slots from SaveManager. Each slot exposes a label
   * "<heroName> (<class> L<level>)" matching LoadGameScreen's convention,
   * plus a combat-session count computed from the merged history.
   *
   * Combat-session matching is best-effort: cloud history rows carry
   * `_heroName` + `_heroClass` per entry; local in-memory entries on the
   * active run carry no slot id, so we associate them with the current
   * GameState's save key.
   */
  _listSaveSlots() {
    let saves = [];
    try { saves = SaveManager.listSaves() || []; } catch (_) { saves = []; }
    return saves.map(s => {
      const lvl = s.level ?? s.party?.[0]?.level ?? '?';
      const cls = s.class || s.party?.[0]?.className || 'Hero';
      const name = s.heroName || 'Unknown';
      const label = `${name} (${cls} L${lvl})`;
      return {
        key: s.key,
        heroName: name,
        heroClass: cls,
        level: lvl,
        label,
        count: this._combatCountForSlot(s),
      };
    });
  }

  /**
   * Count combat sessions belonging to a save slot. Cloud entries are
   * matched on heroName + heroClass (case-insensitive). Local current-run
   * entries are credited to the active save key (`gs.currentSaveKey`).
   */
  /** Rebuild the slot-filter <select> options in place after cloud
   *  history has loaded, so the "N fights" counts no longer read 0. */
  _refreshSlotDropdown() {
    const sel = this._el?.querySelector('#f-slot');
    if (!sel) return;
    const slots = this._listSaveSlots();
    const totalCount = this._mergedCombatHistoryRaw().length;
    const current = this._filters.slotKey;
    const opts = [
      `<option value="all"${current === 'all' ? ' selected' : ''}>All slots — ${totalCount} fight${totalCount === 1 ? '' : 's'}</option>`,
      ...slots.map(s => `<option value="${_esc(s.key)}"${s.key === current ? ' selected' : ''}>${_esc(s.label)} — ${s.count} fight${s.count === 1 ? '' : 's'}</option>`),
    ].join('');
    sel.innerHTML = opts;
  }

  _combatCountForSlot(save) {
    if (!save) return 0;
    const merged = this._mergedCombatHistoryRaw();
    const wantName = String(save.heroName || '').toLowerCase();
    const wantClass = String(save.class || save.party?.[0]?.className || '').toLowerCase();
    const gs = GameState.get();
    const isActiveSlot = gs.currentSaveKey && gs.currentSaveKey === save.key;
    let n = 0;
    for (const e of merged) {
      if (this._entryMatchesSlot(e, wantName, wantClass, isActiveSlot)) n++;
    }
    return n;
  }

  /**
   * Returns true if a combat-history entry belongs to the given slot.
   * Cloud entries carry `_heroName` / `_heroClass`; local entries (current
   * run) carry neither and are credited to the active save.
   */
  _entryMatchesSlot(entry, wantName, wantClass, isActiveSlot) {
    const en = String(entry._heroName || '').toLowerCase();
    const ec = String(entry._heroClass || '').toLowerCase();
    if (!en && !ec) {
      // Local entry (no cloud metadata) — only the active slot owns it.
      return !!isActiveSlot;
    }
    // Match name; class is a tiebreaker when present on both sides.
    if (en && wantName && en !== wantName) return false;
    if (ec && wantClass && ec !== wantClass) return false;
    return true;
  }

  /** Raw merged history without the slot filter applied. */
  _mergedCombatHistoryRaw() {
    const gs = GameState.get();
    const local = Array.isArray(gs.stats?.combatHistory) ? gs.stats.combatHistory : [];
    const cloud = Array.isArray(this._cloudCombatHistory) ? this._cloudCombatHistory : [];
    const seen = new Set(local.map(e => e.ts));
    const combined = [...local];
    for (const entry of cloud) {
      if (!seen.has(entry.ts)) {
        seen.add(entry.ts);
        combined.push(entry);
      }
    }
    combined.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    return combined.slice(0, 50);
  }

  /** Returns the currently selected save slot record, or null for "all". */
  _selectedSlot() {
    if (!this._filters.slotKey || this._filters.slotKey === 'all') return null;
    return this._listSaveSlots().find(s => s.key === this._filters.slotKey) || null;
  }

  _partyMembers() {
    const gs = GameState.get();
    return [...(gs.party || []), ...(gs.companions || []), ...(gs.bench || [])]
      .filter(m => m && !(m.isCompanion || m.class === 'companion'));
  }

  _filteredMembers() {
    const all = this._partyMembers();
    if (this._filters.memberId === 'all') return all;
    return all.filter(m => m.id === this._filters.memberId);
  }

  // ── Overview ───────────────────────────────────────────────────────────────

  _renderOverview(body) {
    ensureStats();
    const gs = GameState.get();
    const s = gs.stats || {};
    const g = s.global || {};
    const life = getLifeStats().global;
    const members = this._filteredMembers();
    // Cloud combat history session count for the KPI row.
    const cloudSessions = this._mergedCombatHistory().length;
    const cloudNote = this._cloudCombatHistory === null
      ? '<span style="color:#8a7a6a;font-size:0.7rem">(sign in for cloud)</span>'
      : this._cloudCombatLoading
        ? '<span style="color:#8a7a6a;font-size:0.7rem">(loading...)</span>'
        : `<span style="color:#60c0e0;font-size:0.7rem">(${cloudSessions} cross-session)</span>`;

    body.innerHTML = `
      <div class="sd-stat-row">
        <div class="sd-stat"><div class="k">Run Damage</div><div class="v">${(g.totalDamage||0).toLocaleString()}</div></div>
        <div class="sd-stat"><div class="k">Run Kills</div><div class="v">${(g.totalKills||0).toLocaleString()}</div></div>
        <div class="sd-stat"><div class="k">Run Heals</div><div class="v">${(g.totalHeals||0).toLocaleString()}</div></div>
        <div class="sd-stat"><div class="k">Fights Won</div><div class="v">${g.fightsWon||0} / ${(g.fightsWon||0)+(g.fightsLost||0)}</div></div>
        <div class="sd-stat"><div class="k">Perfect Wins</div><div class="v">${g.perfectVictories||0}</div></div>
        <div class="sd-stat"><div class="k">Lifetime Kills</div><div class="v">${(life.totalKills||0).toLocaleString()}</div></div>
        <div class="sd-stat"><div class="k">Combat Sessions ${cloudNote}</div><div class="v">${cloudSessions}</div></div>
      </div>
      <div class="sd-grid">
        <div class="sd-card"><h3>Damage Dealt by Hero</h3><div class="sd-chart-wrap" id="ov-dmg-bar"></div></div>
        <div class="sd-card"><h3>Kills by Hero</h3><div class="sd-chart-wrap" id="ov-kill-bar"></div></div>
        <div class="sd-card"><h3>Damage Taken by Hero</h3><div class="sd-chart-wrap" id="ov-taken-bar"></div></div>
        <div class="sd-card"><h3>Healing by Hero</h3><div class="sd-chart-wrap" id="ov-heal-bar"></div></div>
        <div class="sd-card"><h3>Win / Loss</h3><div class="sd-chart-wrap" id="ov-wl-donut"></div></div>
        <div class="sd-card"><h3>Gold Flow</h3><div class="sd-chart-wrap" id="ov-gold-donut"></div></div>
      </div>
    `;

    // M469 fix — "Kills by Hero" / "Damage by Hero" / "Damage Taken" / "Healing"
    // must survive a page refresh. In-memory gs.stats.perChar resets to zero
    // after hard reload when there is no cached run. Aggregate from
    // _mergedCombatHistory() (cloud) as the ground-truth fallback, then take
    // max of live vs cloud so we never show a stale lower value.
    const merged = this._mergedCombatHistory();
    const histKills = {};
    const histDmg = {};
    const histTaken = {};
    const histHeals = {};
    for (const entry of merged) {
      for (const c of (entry.perChar || [])) {
        const label = c.name || c.id;
        histKills[label] = (histKills[label] || 0) + (c.kills || 0);
        histDmg[label]   = (histDmg[label]   || 0) + (c.dmgDealt || 0);
        histTaken[label] = (histTaken[label] || 0) + (c.dmgTaken || 0);
        histHeals[label] = (histHeals[label] || 0) + (c.heals || 0);
      }
    }
    if (window.__statsDebug) {
      console.log('[stats] overview — perChar from memory:', s.perChar);
      console.log('[stats] overview — kills from combatHistory:', histKills);
      console.log('[stats] overview — dmg from combatHistory:', histDmg);
      console.log('[stats] overview — mergedCombatHistory.length:', merged.length);
    }
    // M476b — Chart labels include both live party AND every hero that
    // appears in the merged (cloud + local) history. Previously only the
    // live party was shown; after loading a save with one hero and going
    // back to main menu, the charts locked to that hero even with
    // "All slots" selected. Now we union both lists so historical heroes
    // from other slots show up too. Slot filter still narrows via
    // _mergedCombatHistory() upstream.
    const liveById = new Map(members.map(m => [m.id, m]));
    const liveByName = new Map(members.map(m => [(m.name || '').toLowerCase(), m]));
    const chartMembers = [...members];
    const seen = new Set([...liveById.keys(), ...members.map(m => m.name)]);
    for (const name of Object.keys(histKills)) {
      if (seen.has(name)) continue;
      if (liveByName.has(name.toLowerCase())) continue;
      chartMembers.push({ name, id: name });
      seen.add(name);
    }
    const memberKills = chartMembers.map(m => {
      const live  = getCharStats(m.id).kills || 0;
      const cloud = histKills[m.name] || histKills[m.id] || 0;
      return Math.max(live, cloud);
    });
    const memberDmg = chartMembers.map(m => {
      const live  = getCharStats(m.id).damageDealt || 0;
      const cloud = histDmg[m.name] || histDmg[m.id] || 0;
      return Math.max(live, cloud);
    });

    const memberTaken = chartMembers.map(m => {
      const live  = getCharStats(m.id).damageTaken || 0;
      const cloud = histTaken[m.name] || histTaken[m.id] || 0;
      return Math.max(live, cloud);
    });
    const memberHeals = chartMembers.map(m => {
      const live  = getCharStats(m.id).heals || 0;
      const cloud = histHeals[m.name] || histHeals[m.id] || 0;
      return Math.max(live, cloud);
    });
    this._barChart('ov-dmg-bar',
      chartMembers.map(m => m.name),
      memberDmg,
      'Damage', '#e8a020');
    this._barChart('ov-kill-bar',
      chartMembers.map(m => m.name),
      memberKills,
      'Kills', '#c04030');
    this._barChart('ov-taken-bar',
      chartMembers.map(m => m.name),
      memberTaken,
      'Taken', '#a05050');
    this._barChart('ov-heal-bar',
      chartMembers.map(m => m.name),
      memberHeals,
      'Healed', '#40a060');
    this._donutChart('ov-wl-donut',
      ['Won','Lost'],
      [g.fightsWon||0, g.fightsLost||0],
      ['#40a060','#c04030']);
    this._donutChart('ov-gold-donut',
      ['Earned','Spent'],
      [g.totalGoldEarned||0, g.totalGoldSpent||0],
      ['#e8a020','#8a4020']);
  }

  // ── Characters ─────────────────────────────────────────────────────────────

  _renderCharacters(body) {
    const members = this._filteredMembers();
    if (!members.length) { body.innerHTML = '<div class="sd-empty">No party members yet.</div>'; return; }
    const cards = members.map(m => {
      const cs = getCharStats(m.id);
      return `<div class="sd-card">
        <h3>${_esc(m.name)} <span style="color:#8a7a6a;font-size:0.65rem;font-weight:400;letter-spacing:0">Lv ${m.level||1} ${_esc(m.className||m.class||'')}</span></h3>
        <div class="sd-stat-row">
          <div class="sd-stat"><div class="k">Crits</div><div class="v">${cs.crits||0}</div></div>
          <div class="sd-stat"><div class="k">Dodges</div><div class="v">${cs.dodges||0}</div></div>
          <div class="sd-stat"><div class="k">Blocks</div><div class="v">${cs.blocks||0}</div></div>
          <div class="sd-stat"><div class="k">Best Hit</div><div class="v">${cs.mostDamageHit||0}</div></div>
          <div class="sd-stat"><div class="k">Streak</div><div class="v">${cs.longestKillStreak||0}</div></div>
          <div class="sd-stat"><div class="k">Deaths</div><div class="v">${cs.deaths||0}</div></div>
        </div>
        <div class="sd-chart-wrap" id="ch-${_esc(m.id)}-bar"></div>
        <h3 style="margin-top:0.75rem">DPS Over Time</h3>
        <div class="sd-chart-wrap tall" id="ch-${_esc(m.id)}-dps"></div>
      </div>`;
    }).join('');
    body.innerHTML = `<div class="sd-grid">${cards}</div>`;
    members.forEach(m => {
      const cs = getCharStats(m.id);
      this._barChart(`ch-${m.id}-bar`,
        ['Dmg Dealt','Dmg Taken','Heals','Kills'],
        [cs.damageDealt, cs.damageTaken, cs.heals, cs.kills],
        m.name, ['#e8a020','#c04030','#60c0e0','#a060e0']);
      const dps = getDpsSeries(m.id, 5);
      this._lineChart(`ch-${m.id}-dps`,
        dps.map(b => b.t),
        [{ label: 'DPS', data: dps.map(b => b.dps), color: '#e8a020' }]);
    });
  }

  // ── Damage (M289 view) ─────────────────────────────────────────────────────

  _renderDamage(body) {
    const members = this._filteredMembers();
    if (!members.length) { body.innerHTML = '<div class="sd-empty">No party members yet.</div>'; return; }
    body.innerHTML = `
      <div class="sd-grid">
        <div class="sd-card" style="grid-column:1/-1"><h3>Damage Per Minute</h3><div class="sd-chart-wrap tall" id="dmg-timeline"></div></div>
        <div class="sd-card"><h3>Damage by Skill (Top 10)</h3><div class="sd-chart-wrap tall" id="dmg-by-skill"></div></div>
        <div class="sd-card"><h3>Damage Type Distribution</h3><div class="sd-chart-wrap tall" id="dmg-by-element"></div></div>
        <div class="sd-card"><h3>Damage Taken — Sources</h3><div class="sd-chart-wrap tall" id="dmg-taken-by-src"></div></div>
        <div class="sd-card"><h3>Top Hits</h3><div id="dmg-top-hits" class="sd-list"></div></div>
      </div>
    `;
    // Damage-per-minute timeline (one series per filtered member)
    const series = members.map((m, i) => {
      const dps = getDpsSeries(m.id, 60);
      return { label: m.name, data: dps.map(b => b.dps), color: PALETTE[i % PALETTE.length], _t: dps.map(b => b.t) };
    });
    const allTs = [...new Set(series.flatMap(s => s._t))].sort((a,b)=>a-b);
    this._lineChart('dmg-timeline', allTs, series);

    // Damage by skill (M289 data)
    const skillBars = getDamageBySkillForView(this._filters);
    this._barChart('dmg-by-skill',
      skillBars.map(r => r.label).slice(0, 10),
      skillBars.map(r => r.value).slice(0, 10),
      'Damage', '#a060e0');

    // Damage by element donut
    const elBuckets = getDamageByElementForView(this._filters);
    this._donutChart('dmg-by-element',
      elBuckets.map(r => r.label),
      elBuckets.map(r => r.value),
      elBuckets.map((_, i) => PALETTE[i % PALETTE.length]));

    // Damage taken by source
    const taken = getDamageTakenBySourceForView(this._filters);
    this._donutChart('dmg-taken-by-src',
      taken.map(r => r.label),
      taken.map(r => r.value),
      taken.map((_, i) => PALETTE[(i + 3) % PALETTE.length]));

    // Top hits list
    const top = members.map(m => ({ name: m.name, hit: getCharStats(m.id).mostDamageHit || 0 }))
      .sort((a, b) => b.hit - a.hit).slice(0, 6);
    body.querySelector('#dmg-top-hits').innerHTML = top.length
      ? top.map(t => `<div class="sd-list-row"><strong>${_esc(t.name)}</strong><span>${t.hit.toLocaleString()} dmg</span></div>`).join('')
      : '<div class="sd-empty">No damage recorded yet.</div>';

    // M289 — skill cast counts (per-character or aggregated)
    const gs = GameState.get();
    const counts = gs.stats?.skillCastCounts || {};
    const memberIds = members.map(m => m.id);
    const aggregate = {};
    for (const [cid, perSkill] of Object.entries(counts)) {
      if (this._filters.memberId !== 'all' && !memberIds.includes(cid)) continue;
      for (const [sid, n] of Object.entries(perSkill)) {
        aggregate[sid] = (aggregate[sid] || 0) + n;
      }
    }
    const castEntries = Object.entries(aggregate).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (castEntries.length) {
      const card = document.createElement('div');
      card.className = 'sd-card';
      card.style.gridColumn = '1/-1';
      card.innerHTML = `<h3>Skill Cast Frequency</h3><div class="sd-chart-wrap tall" id="dmg-cast-counts"></div>`;
      body.querySelector('.sd-grid').appendChild(card);
      this._barChart('dmg-cast-counts',
        castEntries.map(([id]) => id),
        castEntries.map(([_, n]) => n),
        'Casts', '#60c0e0');
    }
  }

  // ── Loot & Magic Find (M287) ───────────────────────────────────────────────

  _renderLoot(body) {
    const drops = getDropsForView(this._filters);
    if (!drops.length) { body.innerHTML = '<div class="sd-empty">No drops recorded yet — fight monsters and open chests to populate.</div>'; return; }
    // Aggregations
    const byRarity = {};
    const byZone = {};
    const mfTimeline = []; // { t, mf }
    for (const d of drops) {
      byRarity[d.rarity || 'normal'] = (byRarity[d.rarity || 'normal'] || 0) + 1;
      const z = d.zoneId || 'unknown';
      byZone[z] = (byZone[z] || 0) + 1;
      if (typeof d.magicFind === 'number') mfTimeline.push({ t: d.t, mf: d.magicFind });
    }
    const rarityOrder = ['normal','magic','rare','legendary','unique'];
    const rarityColors = ['#c8c8c8','#6080ff','#e8a020','#c060e0','#e85020'];
    body.innerHTML = `
      <div class="sd-stat-row">
        <div class="sd-stat"><div class="k">Total Drops</div><div class="v">${drops.length}</div></div>
        <div class="sd-stat"><div class="k">Rare+</div><div class="v">${(byRarity.rare||0)+(byRarity.legendary||0)+(byRarity.unique||0)}</div></div>
        <div class="sd-stat"><div class="k">Avg MF %</div><div class="v">${mfTimeline.length ? Math.round(mfTimeline.reduce((s,p)=>s+p.mf,0) / mfTimeline.length) : 0}</div></div>
      </div>
      <div class="sd-grid">
        <div class="sd-card"><h3>Loot Rarity</h3><div class="sd-chart-wrap tall" id="loot-rarity"></div></div>
        <div class="sd-card"><h3>Drops by Zone</h3><div class="sd-chart-wrap tall" id="loot-zones"></div></div>
        <div class="sd-card" style="grid-column:1/-1"><h3>Magic Find Over Time</h3><div class="sd-chart-wrap tall" id="loot-mf"></div></div>
        <div class="sd-card" style="grid-column:1/-1"><h3>Recent Drops</h3><div id="loot-recent" class="sd-list"></div></div>
      </div>
    `;
    this._donutChart('loot-rarity',
      rarityOrder.filter(r => byRarity[r]),
      rarityOrder.filter(r => byRarity[r]).map(r => byRarity[r]),
      rarityOrder.filter(r => byRarity[r]).map(r => rarityColors[rarityOrder.indexOf(r)]));
    const zoneKeys = Object.keys(byZone);
    this._barChart('loot-zones', zoneKeys, zoneKeys.map(k => byZone[k]), 'Drops', '#60c0e0');
    if (mfTimeline.length) {
      this._lineChart('loot-mf',
        mfTimeline.map(p => p.t),
        [{ label: 'Magic Find %', data: mfTimeline.map(p => p.mf), color: '#c060e0' }]);
    } else {
      body.querySelector('#loot-mf').innerHTML = '<div class="sd-empty">MF history empty — equip MF gear and kill monsters.</div>';
    }
    body.querySelector('#loot-recent').innerHTML = drops.slice(-15).reverse().map(d => `
      <div class="sd-list-row">
        <strong style="color:${rarityColors[rarityOrder.indexOf(d.rarity)] || '#c8c8c8'}">${_esc(d.name || d.itemId || 'Item')}</strong>
        <span class="meta">${_esc(d.rarity || 'normal')} · ${_esc(d.zoneId || '')}</span>
      </div>`).join('');
  }

  // ── Power (M288) ───────────────────────────────────────────────────────────

  _renderPower(body) {
    const members = this._filteredMembers();
    if (!members.length) { body.innerHTML = '<div class="sd-empty">No party members yet.</div>'; return; }
    body.innerHTML = `
      <div class="sd-grid">
        <div class="sd-card" style="grid-column:1/-1"><h3>Power Growth Over Time</h3><div class="sd-chart-wrap tall" id="pow-line"></div></div>
        <div class="sd-card"><h3>Current Power</h3><div class="sd-chart-wrap tall" id="pow-bar"></div></div>
        <div class="sd-card"><h3>Role Mix</h3><div class="sd-chart-wrap tall" id="pow-roles"></div></div>
      </div>
    `;
    const series = members.map((m, i) => {
      const arr = getPowerSeriesForView(m.id, this._filters);
      return { label: m.name, data: arr.map(p => p.power), color: PALETTE[i % PALETTE.length], _t: arr.map(p => p.t) };
    });
    const allTs = [...new Set(series.flatMap(s => s._t))].sort((a,b)=>a-b);
    this._lineChart('pow-line', allTs, series);
    // Current power bar — final sample of each series, fall back to derive
    const current = members.map(m => {
      const arr = getPowerSeriesForView(m.id, this._filters);
      return arr.length ? arr[arr.length - 1].power : 0;
    });
    this._barChart('pow-bar', members.map(m => m.name), current, 'Power', '#e8a020');

    // Role mix: aggregate offense/defense/utility scores from equipped items
    let off = 0, def = 0, util = 0;
    for (const m of members) {
      const eqp = m.equipment || {};
      for (const slot of Object.keys(eqp)) {
        const it = eqp[slot]; if (!it) continue;
        try {
          const sc = computeItemScores(it, m);
          off += sc.offense; def += sc.defense; util += sc.utility;
        } catch (_) {}
      }
    }
    this._donutChart('pow-roles',
      ['Offense','Defense','Utility'],
      [off, def, util],
      ['#e8a020','#60c0e0','#a060e0']);
  }

  // ── Combat Log ─────────────────────────────────────────────────────────────

  _renderCombatLog(body) {
    const history = this._mergedCombatHistory();
    const members = this._filteredMembers();

    // Cloud status banner
    let cloudBanner = '';
    if (this._cloudCombatLoading) {
      cloudBanner = '<div class="sd-empty" style="color:#e8a020;margin-bottom:0.5rem">Loading cloud combat history...</div>';
    } else if (this._cloudCombatHistory === null) {
      cloudBanner = '<div class="sd-empty" style="margin-bottom:0.5rem">Sign in to load cloud combat history across sessions.</div>';
    } else if (this._cloudCombatHistory.length === 0 && history.length === 0) {
      // No data at all
    } else {
      const cloudCount = (this._cloudCombatHistory || []).length;
      if (cloudCount > 0) {
        cloudBanner = `<div class="sd-empty" style="color:#60c0e0;margin-bottom:0.5rem;font-style:normal">Showing ${history.length} combat sessions (${cloudCount} from cloud, persisted across devices)</div>`;
      }
    }

    if (!history.length && !members.length) {
      body.innerHTML = cloudBanner + '<div class="sd-empty">No combat history yet — fight monsters to populate.</div>';
      return;
    }
    // Slot filter selected but no sessions on disk for that hero — show a
    // graceful empty-state. The persistence layer may still be syncing, so
    // we phrase it forgivingly: this UI auto-recovers when data lands.
    const slotSel = this._selectedSlot();
    if (slotSel && history.length === 0) {
      body.innerHTML = cloudBanner + `<div class="sd-slot-empty">No combat sessions recorded yet for <strong>${_esc(slotSel.label)}</strong>. Fight monsters with this hero, or wait for cloud sync to catch up.</div>`;
      return;
    }

    // ── Per-combat history table ───────────────────────────────────────────
    const historyRows = history.length
      ? history.map(e => {
          const date = new Date(e.ts || e.startedAt || 0);
          const dateStr = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`;
          const result = e.won ? '<span style="color:#40a060">Win</span>' : '<span style="color:#c04030">Loss</span>';
          const duration = e.durationSec ? `${e.durationSec}s` : '—';
          const totalDmg = e.totals?.damage ?? 0;
          const totalHeal = e.totals?.heals ?? 0;
          const zone = e.zoneId ? _esc(e.zoneId) : '—';
          const mvp = (e.perChar || []).find(c => c.mvp);
          const mvpStr = mvp ? `<span title="MVP">${_esc(mvp.name||mvp.id)}</span>` : '—';
          // Expand per-char breakdown on click via details/summary
          const perCharRows = (e.perChar || []).map(c =>
            `<div class="sd-list-row" style="font-size:0.72rem;padding:0.2rem 0.6rem">
               <strong>${_esc(c.name||c.id)}</strong>
               <span class="meta">${(c.dmgDealt||0).toLocaleString()} dmg / ${(c.dmgTaken||0).toLocaleString()} taken / ${c.heals||0} heals / ${c.kills||0} kills</span>
             </div>`).join('');
          return `<details class="sd-combat-row">
            <summary class="sd-list-row" style="cursor:pointer;list-style:none">
              <span style="min-width:130px;display:inline-block;color:#8a7a6a;font-size:0.7rem">${dateStr}</span>
              <strong style="min-width:3rem;display:inline-block">${result}</strong>
              <span class="meta" style="min-width:3rem;display:inline-block">${duration}</span>
              <span class="meta" style="flex:1">${zone}</span>
              <span class="meta">${totalDmg.toLocaleString()} dmg</span>
              <span class="meta" style="min-width:5rem;text-align:right">MVP: ${mvpStr}</span>
            </summary>
            <div style="background:rgba(0,0,0,0.3);border-top:1px solid rgba(232,160,32,0.1)">${perCharRows || '<div style="padding:0.3rem 0.6rem;color:#8a7a6a;font-size:0.75rem">No per-character data</div>'}</div>
          </details>`;
        }).join('')
      : '<div class="sd-empty">No combat sessions recorded yet.</div>';

    // ── Per-character story log (existing) ────────────────────────────────
    const logCards = members.length
      ? members.map(m => {
          const log = getCharLog(m.id);
          const rows = log.length
            ? log.slice(0, 30).map(e2 => `<div class="sd-log-row ${_esc(e2.type)}">
                <div class="t">${new Date(e2.ts).toLocaleString()} · ${_esc(e2.zoneId || '')}</div>
                <div>${_esc(e2.summary)}</div>
              </div>`).join('')
            : '<div class="sd-empty">No log entries yet.</div>';
          return `<div class="sd-card sd-log"><h3>${_esc(m.name)} — Story Log</h3>${rows}</div>`;
        }).join('')
      : '';

    body.innerHTML = `
      ${cloudBanner}
      <div class="sd-card" style="margin-bottom:0.75rem">
        <h3>Last ${Math.min(history.length, 50)} Combat Sessions</h3>
        <div class="sd-combat-header sd-list-row" style="font-size:0.65rem;color:#8a7a6a;text-transform:uppercase;letter-spacing:0.06em;padding-bottom:0.3rem;border-bottom:1px solid rgba(232,160,32,0.15)">
          <span style="min-width:130px;display:inline-block">Date</span>
          <span style="min-width:3rem;display:inline-block">Result</span>
          <span style="min-width:3rem;display:inline-block">Duration</span>
          <span style="flex:1">Zone</span>
          <span>Damage</span>
          <span style="min-width:5rem;text-align:right">MVP</span>
        </div>
        <div class="sd-log">${historyRows}</div>
      </div>
      <div class="sd-grid">${logCards}</div>
    `;
  }

  // ── Lifetime ───────────────────────────────────────────────────────────────

  _renderLifetime(body) {
    const life = getLifeStats();
    const g = life.global;
    // M475 — aggregate per-hero stats from the merged cloud combat_history
    // so the Lifetime view shows damage/kills/fights per hero across ALL
    // past runs, not just the current run. Each entry in combat_history has
    // perChar[{ name, class, dmgDealt, dmgTaken, kills, heals }].
    const merged = this._mergedCombatHistory();
    const heroAgg = {}; // name → { name, class, dmgDealt, dmgTaken, kills, heals, fights }
    for (const entry of merged) {
      for (const c of (entry.perChar || [])) {
        const key = c.name || c.id || 'Unknown';
        const slot = heroAgg[key] || (heroAgg[key] = { name: key, class: c.class || '', dmgDealt: 0, dmgTaken: 0, kills: 0, heals: 0, fights: 0 });
        slot.dmgDealt += c.dmgDealt || 0;
        slot.dmgTaken += c.dmgTaken || 0;
        slot.kills    += c.kills    || 0;
        slot.heals    += c.heals    || 0;
        slot.fights   += 1;
        if (!slot.class && c.class) slot.class = c.class;
      }
    }
    const heroes = Object.values(heroAgg).sort((a, b) => b.dmgDealt - a.dmgDealt);
    const hasPerHero = heroes.length > 0;
    if (window.__statsDebug) console.log('[stats] lifetime perHero', heroes);
    body.innerHTML = `
      <div class="sd-stat-row">
        <div class="sd-stat"><div class="k">Total Runs</div><div class="v">${g.runsStarted||0}</div></div>
        <div class="sd-stat"><div class="k">Completed</div><div class="v">${g.runsCompleted||0}</div></div>
        <div class="sd-stat"><div class="k">Hardcore Deaths</div><div class="v">${g.hardcoreDeaths||0}</div></div>
        <div class="sd-stat"><div class="k">Lifetime Damage</div><div class="v">${(g.totalDamage||0).toLocaleString()}</div></div>
        <div class="sd-stat"><div class="k">Lifetime Kills</div><div class="v">${(g.totalKills||0).toLocaleString()}</div></div>
        <div class="sd-stat"><div class="k">Lifetime XP</div><div class="v">${(g.totalXp||0).toLocaleString()}</div></div>
        <div class="sd-stat"><div class="k">Cloud Sessions</div><div class="v">${merged.length}</div></div>
      </div>
      ${hasPerHero ? `
      <div class="sd-grid">
        <div class="sd-card"><h3>Damage Dealt by Hero (all runs)</h3><div class="sd-chart-wrap tall" id="lt-hero-dmg"></div></div>
        <div class="sd-card"><h3>Kills by Hero (all runs)</h3><div class="sd-chart-wrap tall" id="lt-hero-kill"></div></div>
        <div class="sd-card"><h3>Damage Taken by Hero</h3><div class="sd-chart-wrap tall" id="lt-hero-taken"></div></div>
        <div class="sd-card"><h3>Healing by Hero</h3><div class="sd-chart-wrap tall" id="lt-hero-heal"></div></div>
      </div>
      <div class="sd-card" style="margin-top:0.75rem">
        <h3>Hero Totals (all runs)</h3>
        <table class="sd-hero-tbl">
          <thead><tr><th>Hero</th><th>Class</th><th class="num">Fights</th><th class="num">Damage Dealt</th><th class="num">Damage Taken</th><th class="num">Kills</th><th class="num">Healing</th></tr></thead>
          <tbody>
            ${heroes.map(h => `<tr>
              <td>${_esc(h.name)}</td>
              <td>${_esc(h.class)}</td>
              <td class="num">${h.fights.toLocaleString()}</td>
              <td class="num">${h.dmgDealt.toLocaleString()}</td>
              <td class="num">${h.dmgTaken.toLocaleString()}</td>
              <td class="num">${h.kills.toLocaleString()}</td>
              <td class="num">${h.heals.toLocaleString()}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      ` : '<div class="sd-empty">No cloud combat history yet — sign in and finish a fight to populate per-hero stats here.</div>'}
      <div class="sd-grid" style="margin-top:0.75rem">
        <div class="sd-card"><h3>Lifetime Win/Loss</h3><div class="sd-chart-wrap tall" id="lt-wl"></div></div>
        <div class="sd-card"><h3>Lifetime Gold</h3><div class="sd-chart-wrap tall" id="lt-gold"></div></div>
      </div>
    `;
    if (hasPerHero) {
      const names = heroes.map(h => h.name);
      this._barChart('lt-hero-dmg',   names, heroes.map(h => h.dmgDealt), 'Damage', '#e8a020');
      this._barChart('lt-hero-kill',  names, heroes.map(h => h.kills),    'Kills',  '#c04030');
      this._barChart('lt-hero-taken', names, heroes.map(h => h.dmgTaken), 'Taken',  '#a05050');
      this._barChart('lt-hero-heal',  names, heroes.map(h => h.heals),    'Healed', '#40a060');
    }
    this._donutChart('lt-wl', ['Won','Lost'], [g.fightsWon||0, g.fightsLost||0], ['#40a060','#c04030']);
    this._donutChart('lt-gold', ['Earned','Spent'], [g.totalGoldEarned||0, g.totalGoldSpent||0], ['#e8a020','#8a4020']);
  }

  // ── Cross-Run (main-menu only, M286) ───────────────────────────────────────

  _renderCrossRun(body) {
    const life = getLifeStats();
    const runs = (life.runHistory || []).slice().sort((a, b) => a.startedAt - b.startedAt);
    if (!runs.length) { body.innerHTML = '<div class="sd-empty">No archived runs yet — finish or RIP a run to populate this view.</div>'; return; }
    // Best-run picks
    const bestDmg    = runs.reduce((b, r) => (r.global?.totalDamage||0) > (b.global?.totalDamage||0) ? r : b, runs[0]);
    const mostKills  = runs.reduce((b, r) => (r.global?.totalKills||0) > (b.global?.totalKills||0) ? r : b, runs[0]);
    const longestPlay= runs.reduce((b, r) => ((r.endedAt-r.startedAt)) > ((b.endedAt-b.startedAt)) ? r : b, runs[0]);
    const completedCount = runs.filter(r => r.completed).length;
    const hardcoreDeaths = runs.filter(r => r.hardcore && !r.completed).length;
    const fmtDur = ms => `${Math.round(ms/60000)} min`;
    // M286: class playtime — count occurrences of each class across archived
    // runs (each run contributes once per hero in its party).
    const classCounts = {};
    for (const r of runs) {
      for (const c of (r.classes || [])) {
        classCounts[c] = (classCounts[c] || 0) + 1;
      }
    }
    const classKeys = Object.keys(classCounts).sort((a, b) => classCounts[b] - classCounts[a]);
    // Aggregate drops-by-rarity across all runs
    const lifetimeDrops = { normal: 0, magic: 0, rare: 0, legendary: 0, unique: 0 };
    for (const r of runs) {
      for (const [k, v] of Object.entries(r.dropsByRarity || {})) {
        lifetimeDrops[k] = (lifetimeDrops[k] || 0) + v;
      }
    }
    body.innerHTML = `
      <div class="sd-stat-row">
        <div class="sd-stat"><div class="k">Total Runs</div><div class="v">${runs.length}</div></div>
        <div class="sd-stat"><div class="k">Completed</div><div class="v">${completedCount}</div></div>
        <div class="sd-stat"><div class="k">Hardcore Deaths</div><div class="v">${hardcoreDeaths}</div></div>
      </div>
      <div class="sd-grid">
        <div class="sd-card sd-bestrun"><h3>Best Run — Damage</h3>
          <div class="sd-stat"><div class="k">${_esc(bestDmg.label||'')}</div><div class="v">${(bestDmg.global?.totalDamage||0).toLocaleString()}</div></div>
          <div class="sd-list-row" style="margin-top:0.5rem"><span class="meta">Heroes</span><strong>${_esc((bestDmg.heroNames||[]).join(', ')||'—')}</strong></div></div>
        <div class="sd-card sd-bestrun"><h3>Most Kills</h3>
          <div class="sd-stat"><div class="k">${_esc(mostKills.label||'')}</div><div class="v">${(mostKills.global?.totalKills||0).toLocaleString()}</div></div></div>
        <div class="sd-card sd-bestrun"><h3>Longest Run</h3>
          <div class="sd-stat"><div class="k">${_esc(longestPlay.label||'')}</div><div class="v">${fmtDur(longestPlay.endedAt-longestPlay.startedAt)}</div></div></div>
        <div class="sd-card" style="grid-column:1/-1"><h3>Run-by-Run Damage</h3><div class="sd-chart-wrap tall" id="cr-dmg"></div></div>
        <div class="sd-card" style="grid-column:1/-1"><h3>Run-by-Run Win Rate</h3><div class="sd-chart-wrap tall" id="cr-wr"></div></div>
        <div class="sd-card"><h3>Class Playtime</h3><div class="sd-chart-wrap tall" id="cr-class"></div></div>
        <div class="sd-card"><h3>Lifetime Loot</h3><div class="sd-chart-wrap tall" id="cr-loot"></div></div>
        <div class="sd-card" style="grid-column:1/-1"><h3>Hardcore Deaths Timeline</h3><div class="sd-chart-wrap tall" id="cr-hcd"></div></div>
        <div class="sd-card" style="grid-column:1/-1"><h3>Run History</h3><div id="cr-list" class="sd-list"></div></div>
      </div>
    `;
    const labels = runs.map((r, i) => `#${i+1}`);
    this._barChart('cr-dmg', labels, runs.map(r => r.global?.totalDamage || 0), 'Damage', '#e8a020');
    this._lineChart('cr-wr', runs.map((_, i) => i+1), [{
      label: 'Win %',
      data: runs.map(r => {
        const w = r.global?.fightsWon || 0, l = r.global?.fightsLost || 0; const t = w+l;
        return t ? Math.round(w * 100 / t) : 0;
      }),
      color: '#40a060',
    }]);
    if (classKeys.length) {
      this._donutChart('cr-class', classKeys, classKeys.map(k => classCounts[k]), classKeys.map((_, i) => PALETTE[i % PALETTE.length]));
    }
    const rarityOrder = ['normal','magic','rare','legendary','unique'];
    const rarityColors = ['#c8c8c8','#6080ff','#e8a020','#c060e0','#e85020'];
    const lootKeys = rarityOrder.filter(r => lifetimeDrops[r]);
    if (lootKeys.length) {
      this._donutChart('cr-loot', lootKeys, lootKeys.map(k => lifetimeDrops[k]),
        lootKeys.map(k => rarityColors[rarityOrder.indexOf(k)]));
    } else {
      this._el.querySelector('#cr-loot').innerHTML = '<div class="sd-empty">No loot recorded yet (M287 instrumentation; pre-M287 runs lack drop data).</div>';
    }
    // Hardcore deaths over time (bucketed by week)
    const hcdRuns = runs.filter(r => r.hardcore);
    if (hcdRuns.length) {
      this._barChart('cr-hcd', hcdRuns.map(r => new Date(r.startedAt).toLocaleDateString()),
        hcdRuns.map(r => r.completed ? 0 : 1), 'Deaths', '#c04030');
    } else {
      this._el.querySelector('#cr-hcd').innerHTML = '<div class="sd-empty">No hardcore runs yet.</div>';
    }
    body.querySelector('#cr-list').innerHTML = runs.slice().reverse().map(r => {
      const ended = r.completed ? '<span style="color:#40a060">✓ completed</span>' : (r.hardcore ? '<span style="color:#c04030">⚰ RIP</span>' : '<span style="color:#8a7a6a">archived</span>');
      return `<div class="sd-list-row">
        <strong>${_esc(r.label||'')}</strong>
        <span class="meta">${new Date(r.startedAt).toLocaleDateString()} · ${(r.global?.totalKills||0)} kills · ${(r.global?.totalDamage||0).toLocaleString()} dmg · ${ended}</span>
      </div>`;
    }).join('');
  }

  // ── Chart helpers ──────────────────────────────────────────────────────────

  _ensureCanvas(containerId) {
    const wrap = this._el.querySelector('#' + containerId);
    if (!wrap) return null;
    wrap.innerHTML = '<canvas></canvas>';
    return wrap.querySelector('canvas');
  }

  _barChart(containerId, labels, data, dsLabel, colorOrColors) {
    const cv = this._ensureCanvas(containerId);
    if (!cv) return;
    if (!data || !data.length || data.every(v => !v)) {
      this._el.querySelector('#' + containerId).innerHTML = '<div class="sd-empty">No data yet</div>'; return;
    }
    const isMulti = Array.isArray(colorOrColors);
    const c = new Chart(cv, {
      type: 'bar',
      data: { labels, datasets: [{ label: dsLabel, data,
        backgroundColor: isMulti ? colorOrColors : labels.map(() => colorOrColors),
        borderRadius: 3 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        indexAxis: data.length > 4 ? 'y' : 'x',
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { maxRotation: 45, minRotation: 0 }, grid: { color: 'rgba(232,160,32,0.07)' } },
          y: { ticks: { precision: 0 }, grid: { color: 'rgba(232,160,32,0.07)' } },
        },
      },
    });
    this._charts.push(c);
  }

  _lineChart(containerId, xs, series) {
    const cv = this._ensureCanvas(containerId);
    if (!cv) return;
    if (!series.length || !series[0].data.length) {
      this._el.querySelector('#' + containerId).innerHTML = '<div class="sd-empty">No data yet</div>'; return;
    }
    const c = new Chart(cv, {
      type: 'line',
      data: {
        labels: xs.map(t => `${Math.round(t)}s`),
        datasets: series.map(s => ({
          label: s.label, data: s.data,
          borderColor: s.color, backgroundColor: s.color + '33',
          tension: 0.25, pointRadius: 0, pointHoverRadius: 4, borderWidth: 1.5, fill: false,
        })),
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        scales: {
          x: { grid: { color: 'rgba(232,160,32,0.07)' } },
          y: { beginAtZero: true, grid: { color: 'rgba(232,160,32,0.07)' } },
        },
        interaction: { mode: 'index', intersect: false },
      },
    });
    this._charts.push(c);
  }

  _donutChart(containerId, labels, data, colors) {
    const cv = this._ensureCanvas(containerId);
    if (!cv) return;
    const total = (data || []).reduce((s, v) => s + (v || 0), 0);
    if (!total) { this._el.querySelector('#' + containerId).innerHTML = '<div class="sd-empty">No data yet</div>'; return; }
    const c = new Chart(cv, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } },
          tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.parsed.toLocaleString()} (${Math.round(ctx.parsed*100/total)}%)` } },
        },
        cutout: '55%',
      },
    });
    this._charts.push(c);
  }
}
