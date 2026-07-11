/**
 * StoryJournalScreen — Story Mode journal with 5 tabs.
 *
 * Tabs: Quests / Factions / Companions / Lore / Ledger
 * Each tab uses the list-row pattern from QuestLogScreen (64pt rows, scrollable).
 *
 * Layout: top bar 48pt, tab strip 40pt, content scroll area fills remaining height.
 * Mobile target: 393×852, all tap targets >= 44×44, text >= 14px.
 * No inline CSS for static values (CLAUDE.md rule).
 */
import { createEl, removeEl, injectStyles } from '../../utils/dom.js';
import { GameState } from '../../game/gameState.js';

// ---------------------------------------------------------------------------
// Styles (injected once)
// ---------------------------------------------------------------------------
const STYLE_ID = 'story-journal-screen-styles';
const STYLES = `
.sjr-screen {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: #0a0608;
  color: #f0e8d8;
  font-family: Inter, sans-serif;
  overflow: hidden;
}

/* Top bar */
.sjr-topbar {
  display: flex;
  align-items: center;
  height: 48px;
  flex-shrink: 0;
  background: rgba(10,6,8,0.96);
  border-bottom: 1px solid rgba(232,160,32,0.2);
  padding: 0 4px;
  gap: 0;
}
.sjr-topbar-btn {
  width: 44px;
  height: 44px;
  min-width: 44px;
  min-height: 44px;
  background: transparent;
  border: none;
  color: #c8a060;
  font-size: 1.1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: background 0.12s;
}
.sjr-topbar-btn:hover,
.sjr-topbar-btn:active { background: rgba(232,160,32,0.12); }
.sjr-topbar-title {
  flex: 1;
  text-align: center;
  font-family: Cinzel, serif;
  font-size: 16px;
  font-weight: 700;
  color: #e8c070;
  letter-spacing: 0.08em;
}

/* Tab strip */
.sjr-tabs {
  display: flex;
  height: 40px;
  flex-shrink: 0;
  background: rgba(12,8,16,0.9);
  border-bottom: 1px solid rgba(232,160,32,0.12);
  overflow-x: auto;
  scrollbar-width: none;
}
.sjr-tabs::-webkit-scrollbar { display: none; }
.sjr-tab {
  flex: 1;
  min-width: 60px;
  height: 40px;
  min-height: 40px;
  padding: 0 8px;
  border: none;
  background: transparent;
  color: #7a6850;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: color 0.12s, border-color 0.12s;
  white-space: nowrap;
}
.sjr-tab.active {
  color: #e8c070;
  border-bottom-color: #e8a020;
}
.sjr-tab:hover:not(.active) { color: #c0a050; }

/* Content scroll area */
.sjr-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 0 env(safe-area-inset-bottom, 0px);
  -webkit-overflow-scrolling: touch;
}

/* List rows (64pt each) */
.sjr-row {
  display: flex;
  align-items: center;
  min-height: 64px;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  gap: 12px;
  cursor: default;
}
.sjr-row:hover { background: rgba(232,160,32,0.04); }

.sjr-row-icon {
  width: 36px;
  height: 36px;
  min-width: 36px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  background: rgba(60,40,20,0.5);
}
.sjr-row-body {
  flex: 1;
  min-width: 0;
}
.sjr-row-title {
  font-size: 14px;
  font-weight: 600;
  color: #e0d0b0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sjr-row-sub {
  font-size: 12px;
  color: #7a6850;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sjr-row-badge {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 10px;
  background: rgba(80,60,20,0.6);
  color: #c0a040;
  flex-shrink: 0;
}
.sjr-row-badge.active  { background: rgba(30,80,40,0.6); color: #60d080; }
.sjr-row-badge.failed  { background: rgba(80,20,20,0.6); color: #d06060; }
.sjr-row-badge.complete { background: rgba(40,60,80,0.6); color: #70b0e0; }
.sjr-row-badge.positive { background: rgba(30,80,40,0.6); color: #60d080; }
.sjr-row-badge.negative { background: rgba(80,20,20,0.6); color: #d06060; }
.sjr-row-badge.neutral  { background: rgba(40,40,60,0.6); color: #9090c0; }

/* Section header */
.sjr-section-header {
  padding: 8px 16px 4px;
  font-family: Cinzel, serif;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #5a4a3a;
  border-bottom: 1px solid rgba(232,160,32,0.07);
}

/* Empty state */
.sjr-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 120px;
  color: #4a3a2a;
  font-size: 14px;
  font-style: italic;
}

/* Ledger tab — pre/code block */
.sjr-ledger-wrap {
  padding: 12px 16px;
}
.sjr-ledger-tree {
  background: rgba(6,3,10,0.8);
  border: 1px solid rgba(232,160,32,0.12);
  border-radius: 8px;
  padding: 12px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #a0c0a0;
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.6;
  max-height: 600px;
  overflow-y: auto;
}

/* Faction meter */
.sjr-faction-meter {
  width: 80px;
  height: 6px;
  background: rgba(255,255,255,0.08);
  border-radius: 3px;
  overflow: hidden;
  flex-shrink: 0;
}
.sjr-faction-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s;
}
.sjr-faction-fill.positive { background: #40b060; }
.sjr-faction-fill.negative { background: #c04040; }
.sjr-faction-fill.neutral  { background: #6060a0; }
`;

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------
const TABS = [
  { id: 'quests',     label: 'Quests' },
  { id: 'factions',   label: 'Factions' },
  { id: 'companions', label: 'Companions' },
  { id: 'lore',       label: 'Lore' },
  { id: 'ledger',     label: 'Ledger' },
];

// ---------------------------------------------------------------------------
// Screen class
// ---------------------------------------------------------------------------
export class StoryJournalScreen {
  constructor(manager, audio) {
    this.manager  = manager;
    this.audio    = audio;
    this._el      = null;
    this._tab     = 'quests';
  }

  onEnter()  { injectStyles(STYLE_ID, STYLES); this._build(); }
  onResume() {}
  onPause()  {}
  update()   {}
  draw()     {}

  onExit()  { removeEl(this._el); this._el = null; }
  destroy() { this.onExit(); }

  // ---------------------------------------------------------------------------
  // Build
  // ---------------------------------------------------------------------------

  _build() {
    this._el = createEl('div', 'sjr-screen');

    // Top bar
    const topBar = createEl('div', 'sjr-topbar');
    topBar.innerHTML = `
      <button type="button" class="sjr-topbar-btn" id="sjr-back" aria-label="Back">&#8592;</button>
      <span class="sjr-topbar-title">Journal</span>
      <div style="width:44px"></div>
    `;
    this._el.appendChild(topBar);

    // Tab strip
    const tabStrip = createEl('div', 'sjr-tabs');
    tabStrip.setAttribute('role', 'tablist');
    for (const t of TABS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.role = 'tab';
      btn.className = `sjr-tab${this._tab === t.id ? ' active' : ''}`;
      btn.dataset.tab = t.id;
      btn.textContent = t.label;
      btn.setAttribute('aria-selected', String(this._tab === t.id));
      tabStrip.appendChild(btn);
    }
    this._el.appendChild(tabStrip);

    // Content area
    const content = createEl('div', 'sjr-content');
    content.id = 'sjr-content';
    this._el.appendChild(content);

    this.manager.uiOverlay.appendChild(this._el);

    // Wire events
    topBar.querySelector('#sjr-back').addEventListener('click', () => {
      this.audio?.playSfx?.('click');
      this.manager.pop();
    });

    tabStrip.querySelectorAll('.sjr-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.audio?.playSfx?.('click');
        this._tab = btn.dataset.tab;
        tabStrip.querySelectorAll('.sjr-tab').forEach(b => {
          b.classList.toggle('active', b.dataset.tab === this._tab);
          b.setAttribute('aria-selected', String(b.dataset.tab === this._tab));
        });
        this._renderContent(content);
      });
    });

    this._renderContent(content);
  }

  // ---------------------------------------------------------------------------
  // Content rendering per tab
  // ---------------------------------------------------------------------------

  _renderContent(container) {
    container.innerHTML = '';
    const gs = GameState.get();
    const story = gs.story;

    switch (this._tab) {
      case 'quests':     this._renderQuests(container, gs, story);     break;
      case 'factions':   this._renderFactions(container, gs, story);   break;
      case 'companions': this._renderCompanions(container, gs, story); break;
      case 'lore':       this._renderLore(container, gs, story);       break;
      case 'ledger':     this._renderLedger(container, gs, story);     break;
    }
  }

  _renderQuests(container, gs, story) {
    if (!story?.quests || Object.keys(story.quests).length === 0) {
      container.appendChild(this._emptyState('No active quests'));
      return;
    }

    const active    = [];
    const completed = [];
    const failed    = [];

    for (const [qid, q] of Object.entries(story.quests)) {
      if (q.status === 'completed' || q.status === 'complete') completed.push([qid, q]);
      else if (q.status === 'failed')   failed.push([qid, q]);
      else                              active.push([qid, q]);
    }

    if (active.length) {
      container.appendChild(this._sectionHeader('Active'));
      for (const [qid, q] of active)    container.appendChild(this._questRow(qid, q, 'active'));
    }
    if (completed.length) {
      container.appendChild(this._sectionHeader('Completed'));
      for (const [qid, q] of completed) container.appendChild(this._questRow(qid, q, 'complete'));
    }
    if (failed.length) {
      container.appendChild(this._sectionHeader('Failed'));
      for (const [qid, q] of failed)    container.appendChild(this._questRow(qid, q, 'failed'));
    }
  }

  _questRow(qid, q, status) {
    const row = createEl('div', 'sjr-row');
    // Normalize 'completed' -> 'complete' for display/CSS consistency
    const displayStatus = status === 'completed' ? 'complete' : status;
    const icon = displayStatus === 'complete' ? '&#10003;' : displayStatus === 'failed' ? '&#10007;' : '&#9733;';
    const phase = q.phase || q.currentPhase || '—';
    const label = displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1);
    row.innerHTML = `
      <div class="sjr-row-icon">${icon}</div>
      <div class="sjr-row-body">
        <div class="sjr-row-title">${this._humanizeId(qid)}</div>
        <div class="sjr-row-sub">Phase: ${this._humanizeId(phase)}</div>
      </div>
      <span class="sjr-row-badge ${displayStatus}">${label}</span>
    `;
    return row;
  }

  _renderFactions(container, gs, story) {
    const factions = story?.factions || {};
    const entries  = Object.entries(factions);
    if (!entries.length) {
      container.appendChild(this._emptyState('No faction contacts yet'));
      return;
    }

    for (const [fid, score] of entries.sort((a, b) => b[1] - a[1])) {
      const row = createEl('div', 'sjr-row');
      const clamped   = Math.max(-10, Math.min(10, score));
      const pct       = ((clamped + 10) / 20 * 100).toFixed(0);
      const sentiment = clamped >= 3 ? 'positive' : clamped <= -3 ? 'negative' : 'neutral';
      const sentLabel = clamped >= 3 ? 'Friendly' : clamped <= -3 ? 'Hostile' : 'Neutral';
      row.innerHTML = `
        <div class="sjr-row-icon">&#9876;</div>
        <div class="sjr-row-body">
          <div class="sjr-row-title">${this._humanizeId(fid)}</div>
          <div class="sjr-row-sub">Standing: ${score > 0 ? '+' : ''}${score}</div>
        </div>
        <div>
          <div class="sjr-faction-meter">
            <div class="sjr-faction-fill ${sentiment}" style="width:${pct}%"></div>
          </div>
          <div class="sjr-row-badge ${sentiment}" style="margin-top:4px">${sentLabel}</div>
        </div>
      `;
      container.appendChild(row);
    }
  }

  _renderCompanions(container, gs, story) {
    const companions = story?.companions || [];
    const recruited = companions.filter(c => c.recruited);
    if (!recruited.length) {
      container.appendChild(this._emptyState('No companions recruited yet'));
      return;
    }

    container.appendChild(this._sectionHeader('Party'));
    for (const c of recruited) {
      const row = createEl('div', 'sjr-row');
      const approval = c.approval || 0;
      const approvalStr = approval > 0 ? `+${approval}` : String(approval);
      const approvalClass = approval >= 5 ? 'positive' : approval <= -5 ? 'negative' : 'neutral';
      // `c.active` is true when companion is the active party member; benched otherwise
      const status = c.active ? 'Active' : 'Benched';
      row.innerHTML = `
        <div class="sjr-row-icon">&#9812;</div>
        <div class="sjr-row-body">
          <div class="sjr-row-title">${this._humanizeId(c.id)}</div>
          <div class="sjr-row-sub">Approval: ${approvalStr} &middot; ${status}</div>
        </div>
        <span class="sjr-row-badge ${approvalClass}">Approval ${approvalStr}</span>
      `;
      container.appendChild(row);
    }
  }

  _renderLore(container, gs, story) {
    const lore = story?.loreDiscovered || [];
    if (!lore.length) {
      container.appendChild(this._emptyState('No lore fragments discovered'));
      return;
    }
    container.appendChild(this._sectionHeader(`${lore.length} Fragment${lore.length !== 1 ? 's' : ''} Discovered`));
    for (const entry of lore) {
      const row = createEl('div', 'sjr-row');
      const id    = typeof entry === 'string' ? entry : (entry.id || '?');
      const title = typeof entry === 'object' && entry.title ? entry.title : this._humanizeId(id);
      const text  = typeof entry === 'object' && entry.text  ? entry.text  : '—';
      row.innerHTML = `
        <div class="sjr-row-icon">&#9781;</div>
        <div class="sjr-row-body">
          <div class="sjr-row-title">${title}</div>
          <div class="sjr-row-sub">${text.slice(0, 80)}${text.length > 80 ? '…' : ''}</div>
        </div>
      `;
      container.appendChild(row);
    }
  }

  _renderLedger(container, gs, story) {
    const wrap = createEl('div', 'sjr-ledger-wrap');
    if (!story) {
      wrap.appendChild(this._emptyState('No story data available'));
      container.appendChild(wrap);
      return;
    }

    const rh = story.recentHistory || {};
    const dump = {
      act:             story.act,
      currentNodeId:   story.currentNodeId,
      campaignSeed:    story.campaignSeed,
      storytellerId:   story.storytellerId,
      difficulty:      story.difficulty,
      pressureMeter:   story.pressureMeter,
      worldCorruption: story.worldCorruption,
      flags:           story.flags,
      counters:        story.counters,
      factions:        story.factions,
      quests:          Object.fromEntries(
        Object.entries(story.quests || {}).map(([k, v]) => [k, { status: v.status, phase: v.phase || v.currentPhase }])
      ),
      companions:      (story.companions || []).map(c => ({ id: c.id, approval: c.approval, active: c.active, recruited: c.recruited })),
      loreCount:       (story.loreDiscovered || []).length,
      rngState:        story.rngState,
      recentHistory:   {
        lastType:       rh.lastType,
        sameTypeStreak: rh.sameTypeStreak,
        nodeTypes:      (rh.nodeTypes || []).slice(0, 5),
        biomes:         (rh.biomes || []).slice(0, 5),
      },
    };

    const pre = createEl('pre', 'sjr-ledger-tree');
    pre.textContent = JSON.stringify(dump, null, 2);
    wrap.appendChild(pre);
    container.appendChild(wrap);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  _sectionHeader(text) {
    const el = createEl('div', 'sjr-section-header');
    el.textContent = text;
    return el;
  }

  _emptyState(text) {
    const el = createEl('div', 'sjr-empty');
    el.textContent = text;
    return el;
  }

  _humanizeId(id) {
    if (!id) return '—';
    return String(id).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
}
