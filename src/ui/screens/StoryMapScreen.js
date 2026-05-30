/**
 * StoryMapScreen — Full implementation (M-S06).
 *
 * Layout per §13.1 (393×852 portrait):
 *   48pt  top bar (Back / Title / Menu)
 *   28pt  pressure chip (collapsible, default collapsed)
 *   36pt  sub-region tab strip
 *   ~484pt map canvas
 *   96pt  peek drawer (collapsed; swipe-up -> 360pt expanded)
 *   64pt  bottom action bar (Party / Inventory / Quests / Rest)
 *
 * Map engine:
 *   - onEnter: generates or hydrates act-1 map, persists via serializeMapSave.
 *   - Canvas: 3-lane layout, horizontal pan, node tap -> peek drawer.
 *   - Sub-region pagination: edge swipe past 60px rubber-band triggers 200ms slide.
 *   - Tab tap: 150ms fade jump.
 *
 * No inline style="..." for static values. All static CSS in injectStyles block.
 * gs.story.* is a Set-free zone throughout.
 */

import { createEl, removeEl, injectStyles } from '../../utils/dom.js';
import { GameState } from '../../game/gameState.js';
import { generateAct }        from '../../story/storyMapGen.js';
import { buildIndexes, serializeMapSave, hydrateMapSave, computeNodeVisibility } from '../../story/storyMapGraph.js';
import {
  nodeXYFromLane,
  drawNode,
  drawEdge,
  hitTestNode,
  drawBiomeBackground,
  NODE_VISUAL_R,
  NODE_HIT_R,
  NODE_MIN_H_SPACING,
} from '../../story/storyMapRendererShared.js';

// ---------------------------------------------------------------------------
// Style injection (once per page load)
// ---------------------------------------------------------------------------
const STYLE_ID = 'story-map-screen-styles';
injectStyles(STYLE_ID, `
.story-map-screen {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: #0a0608;
  color: #f0e8d8;
  font-family: Inter, sans-serif;
  overflow: hidden;
  touch-action: none;
}

/* --- Top bar --- */
.sms-topbar {
  display: flex;
  align-items: center;
  gap: 0;
  height: 48px;
  flex-shrink: 0;
  background: rgba(10,6,8,0.92);
  border-bottom: 1px solid rgba(232,160,32,0.18);
  padding: 0 4px;
}
.sms-topbar-btn {
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
.sms-topbar-btn:hover,
.sms-topbar-btn:active { background: rgba(232,160,32,0.12); }
.sms-topbar-title {
  flex: 1;
  text-align: center;
  font-family: Cinzel, serif;
  font-size: 15px;
  font-weight: 600;
  color: #e8c070;
  letter-spacing: 0.06em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* --- Pressure chip (fix #9) --- */
.sms-pressure-chip {
  flex-shrink: 0;
  overflow: hidden;
  background: rgba(20,10,30,0.7);
  border-bottom: 1px solid rgba(180,80,220,0.15);
  cursor: pointer;
  transition: height 0.18s ease;
  height: 28px;
}
.sms-pressure-chip.expanded-chip { height: 60px; }
.sms-chip-collapsed-row {
  display: flex;
  align-items: center;
  height: 28px;
  padding: 0 12px;
  gap: 8px;
}
.sms-chip-expanded-row {
  display: flex;
  align-items: center;
  height: 32px;
  padding: 0 12px;
  gap: 10px;
  overflow: hidden;
}
.sms-pressure-label {
  font-size: 12px;
  font-weight: 500;
  color: #a080d0;
  flex: 1;
}
.sms-chip-band-label {
  font-size: 11px;
  font-weight: 600;
  color: #c090f0;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  min-width: 48px;
}
.sms-chip-history {
  display: flex;
  gap: 4px;
  align-items: center;
}
.sms-chip-hist-glyph {
  font-size: 11px;
  color: rgba(160,128,220,0.6);
  line-height: 1;
}
.sms-pressure-pips {
  display: flex;
  gap: 3px;
}
.sms-pip {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(180,80,220,0.3);
}
.sms-pip.active { background: #a060e0; }

/* --- Sub-region tab strip --- */
.sms-tab-strip {
  height: 36px;
  flex-shrink: 0;
  display: flex;
  align-items: stretch;
  background: rgba(10,6,8,0.88);
  border-bottom: 1px solid rgba(232,160,32,0.12);
  overflow-x: auto;
  scrollbar-width: none;
}
.sms-tab-strip::-webkit-scrollbar { display: none; }
.sms-tab {
  flex-shrink: 0;
  padding: 0 14px;
  display: flex;
  align-items: center;
  font-size: 12px;
  font-weight: 500;
  color: #7a6850;
  border: none;
  background: transparent;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: color 0.12s, border-color 0.12s;
  white-space: nowrap;
  min-height: 36px;
}
.sms-tab.active {
  color: #e8c070;
  border-bottom-color: #e8a020;
  font-weight: 700;
}
.sms-tab:hover:not(.sms-tab-locked) { color: #c0a050; }
.sms-tab-locked {
  color: #4a3a2a;
  opacity: 0.55;
  cursor: not-allowed;
}

/* --- Map canvas wrap --- */
.sms-canvas-wrap {
  flex: 1;
  min-height: 0;
  position: relative;
  overflow: hidden;
  cursor: grab;
}
.sms-canvas-wrap.panning { cursor: grabbing; }
.sms-map-canvas {
  position: absolute;
  top: 0;
  left: 0;
  display: block;
  touch-action: none;
}

/* --- Peek drawer (fix #10: 128pt default, 360pt expanded, 4×40px handle) --- */
.sms-drawer {
  flex-shrink: 0;
  height: 128px;
  background: rgba(12,6,18,0.97);
  border-top: 1px solid rgba(232,160,32,0.25);
  display: flex;
  flex-direction: column;
  transition: height 0.22s ease;
  overflow: hidden;
}
.sms-drawer.expanded { height: 360px; }
.sms-drawer-handle {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: ns-resize;
  flex-shrink: 0;
}
.sms-drawer-pip {
  width: 40px;
  height: 4px;
  border-radius: 2px;
  background: rgba(232,160,32,0.35);
}
.sms-drawer-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0 14px 8px;
  overflow-y: auto;
}
.sms-drawer-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 60px;
  color: #4a3a2a;
  font-size: 13px;
}
.sms-drawer-node-name {
  font-family: Cinzel, serif;
  font-size: 15px;
  font-weight: 600;
  color: #e8c070;
}
.sms-drawer-node-meta {
  font-size: 12px;
  color: #8a7a6a;
  display: flex;
  gap: 8px;
}
.sms-drawer-badge {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 10px;
  background: rgba(80,60,30,0.6);
  color: #c0a060;
}
.sms-drawer-btns {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}
.sms-drawer-btn {
  flex: 1;
  height: 44px;
  min-height: 44px;
  border-radius: 8px;
  border: 1px solid rgba(232,160,32,0.4);
  background: rgba(232,160,32,0.12);
  color: #e8a020;
  font-family: Cinzel, serif;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.12s;
}
.sms-drawer-btn:hover,
.sms-drawer-btn:active { background: rgba(232,160,32,0.25); }
.sms-drawer-btn.secondary {
  background: rgba(60,60,80,0.2);
  border-color: rgba(140,120,200,0.3);
  color: #a090c0;
}
.sms-drawer-detail {
  font-size: 13px;
  color: #a09080;
  line-height: 1.5;
}

/* --- Bottom action bar --- */
.sms-action-bar {
  height: 64px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  background: rgba(6,4,10,0.97);
  border-top: 1px solid rgba(232,160,32,0.12);
}
.sms-action-btn {
  flex: 1;
  height: 64px;
  min-height: 44px;
  border: none;
  background: transparent;
  color: #7a6850;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  transition: color 0.12s;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.sms-action-btn:hover,
.sms-action-btn:active { color: #e8c070; }
.sms-action-icon {
  font-size: 18px;
  line-height: 1;
}

/* --- Desktop layout (fix #12: ≥700px uses full horizontal space) --- */
@media (min-width: 700px) {
  .story-map-screen {
    max-width: none;
  }
  .sms-canvas-wrap {
    /* Allow horizontal overflow for wider maps on desktop. */
    overflow-x: auto;
  }
  .sms-tab-strip {
    font-size: 13px;
  }
  .sms-drawer {
    height: 160px;
  }
  .sms-drawer.expanded {
    height: 400px;
  }
}

/* --- Page indicator dots --- */
.sms-page-dots {
  position: absolute;
  bottom: 6px;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  pointer-events: none;
}
.sms-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(200,160,80,0.25);
  transition: background 0.15s;
}
.sms-dot.active { background: #e8a020; }
`);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PAN_THRESHOLD_PX  = 8;   // px moved before tap is suppressed
const RUBBER_BAND_PX    = 60;  // extra px allowed past edge before pagination
const PAGINATE_MS       = 200; // slide animation duration
const FADE_MS           = 150; // tab-tap fade duration

// Biome palette fallbacks (biomeId -> [dark, mid, light, accent]).
// Canonical values loaded from canonical-biomes.json at runtime; these are
// the hard-coded defaults so the canvas never falls back to black/gray.
const BIOME_PALETTE_FALLBACK = {
  emberwood:  ['#602010', '#c84828', '#e8a020', '#f0d090'],
  stoneward:  ['#404850', '#808090', '#c0b080', '#e0d8c0'],
  fen:        ['#203010', '#405030', '#80a040', '#c0d880'],
  old_road:   ['#504030', '#908060', '#c0a840', '#f0e0a0'],
  gloomridge: ['#181020', '#302838', '#5040a0', '#9080e0'],
  veilscar:   ['#200830', '#401858', '#8028b0', '#d060f0'],
  // Generic fallback.
  _default:   ['#1a1210', '#3a2a18', '#786040', '#d0b070'],
};

// Biome icon glyphs (Font Awesome idea mapped to Unicode fallbacks).
// These are drawn as canvas text labels at top of map.
const BIOME_ICON = {
  emberwood:  '\u{1F525}', // fire (note: emoji; stripped to text via font-variant-emoji:text)
  stoneward:  '⛰',    // mountain
  fen:        '⌇',    // wavy line (water-like)
  old_road:   '╲',    // diagonal — road-like
  gloomridge: '⌂',    // house/fortress shape
  _default:   '◆',    // diamond
};

// ---------------------------------------------------------------------------
// Class
// ---------------------------------------------------------------------------
export class StoryMapScreen {
  constructor(manager, audio) {
    this.manager = manager;
    this.audio   = audio;
    this._el     = null;

    // Map state.
    this._graph      = null;  // in-memory mapGraph
    this._regionIdx  = 0;     // current sub-region index
    this._selectedId = null;  // selected node id

    // Canvas / pan.
    this._canvas     = null;
    this._ctx        = null;
    this._panX       = 0;    // current horizontal offset within sub-region
    this._panStart   = null; // { x, y, panX }
    this._didPan     = false;
    this._rubberBand = 0;    // extra px past content edge
    this._t          = 0;    // animation time (seconds)
    this._raf        = null;
    this._lastFrameMs = 0;   // for ember-particle budget guard

    // Drawer.
    this._drawerExpanded = false;
    this._drawerDragStart = null;

    // Column positions cache (rebuilt each render region change).
    this._nodePosCache = {};

    // Visibility cache (computeNodeVisibility result; rebuilt on map load + node resolve).
    this._visibilityCache = null;

    // Biome data loaded from canonical-biomes.json (keyed by biome id).
    this._biomeData = null;

    // Ember particle pool for atmosphere (Bug 3).
    this._embers = [];
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  onEnter() {
    this._build();
    this._loadBiomeData().then(() => {
      this._loadOrGenerateMap();
    });
    this._startLoop();
    this._playBiomeMusic();
  }

  async _loadBiomeData() {
    try {
      const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';
      const res = await fetch(`${base}assets/data/story/canonical-biomes.json`);
      if (res.ok) {
        const arr = await res.json();
        this._biomeData = {};
        for (const b of arr) {
          this._biomeData[b.id] = b;
        }
      }
    } catch (_) {
      // Biome data is cosmetic — fall back to hardcoded palettes.
      this._biomeData = {};
    }
  }

  _playBiomeMusic() {
    try {
      const gs  = GameState.get();
      const act = gs.story?.act || 1;
      const musicMap = {
        1: 'overworld_act1.ogg',
        2: 'overworld_act2.ogg',
        3: 'overworld_act3.ogg',
      };
      const track = musicMap[act] || musicMap[1];
      this.audio?.playMusic?.(track);
    } catch (_) {}
  }

  onResume() {
    this._startLoop();
  }

  onPause() {
    this._stopLoop();
  }

  onExit() {
    this._stopLoop();
    removeEl(this._el);
    this._el = null;
    this._canvas = null;
    this._ctx = null;
  }

  destroy() {
    this.onExit();
  }

  update() {}
  draw()   {}

  // ---------------------------------------------------------------------------
  // Map loading
  // ---------------------------------------------------------------------------

  _loadOrGenerateMap() {
    const gs = GameState.get();
    if (!gs.story) return;

    const mapId = gs.story.currentMapId || 'act1_map';
    const act   = gs.story.act || 1;

    if (gs.story.maps?.[mapId]) {
      // Hydrate from saved state.
      const seed = gs.story.maps[mapId].seed || gs.story.campaignSeed || 'default';
      const { mapGraph } = generateAct({ seed, act, salt: gs.story.saltOffset || 0 });
      this._graph = hydrateMapSave(mapGraph, gs.story.maps[mapId]);
    } else {
      // Generate fresh.
      const seed = gs.story.campaignSeed || 'default';
      const { mapGraph, fallbackUsed } = generateAct({ seed, act, salt: gs.story.saltOffset || 0 });
      this._graph = mapGraph;

      // Persist.
      if (!gs.story.maps) gs.story.maps = {};
      gs.story.maps[mapId] = serializeMapSave(mapGraph);
      gs.story.currentMapId = mapGraph.mapId;

      if (fallbackUsed) {
        console.warn('[StoryMapScreen] Map generation failed after 10 attempts — using safety-net fallback.');
      }
    }

    this._rebuildPosCache();
    this._rebuildVisibilityCache();
    this._renderMap();
    this._refreshTabs();
    this._refreshDots();
  }

  _rebuildVisibilityCache() {
    if (!this._graph) { this._visibilityCache = null; return; }
    const gs = GameState.get();
    const mapId = gs.story?.currentMapId;
    const save  = gs.story?.maps?.[mapId];
    this._visibilityCache = computeNodeVisibility(this._graph, save);
  }

  // ---------------------------------------------------------------------------
  // DOM construction
  // ---------------------------------------------------------------------------

  _build() {
    const gs = GameState.get();
    const act = gs.story?.act || 1;

    this._el = createEl('div', 'story-map-screen');

    // Top bar.
    const topBar = createEl('div', 'sms-topbar');
    topBar.innerHTML = `
      <span class="sms-topbar-btn sms-topbar-spacer" aria-hidden="true"></span>
      <span class="sms-topbar-title" id="sms-title">Act ${act} · Story Map</span>
      <button type="button" class="sms-topbar-btn" id="sms-menu" aria-label="Menu">&#9776;</button>
    `;
    this._el.appendChild(topBar);

    // Storyteller pressure chip — collapsed: name + pips (28pt).
    // Expanded: band label + recent history strip (60pt). (Fix #9)
    const chip = createEl('div', 'sms-pressure-chip');
    chip.id = 'sms-pressure-chip';
    chip.setAttribute('role', 'button');
    chip.setAttribute('tabindex', '0');
    chip.setAttribute('aria-label', 'Storyteller pressure — tap to expand');
    chip.innerHTML = `
      <div class="sms-chip-collapsed-row">
        <span class="sms-pressure-label" id="sms-pressure-label">Chronicler</span>
        <div class="sms-pressure-pips" id="sms-pips">
          <div class="sms-pip"></div><div class="sms-pip"></div><div class="sms-pip"></div>
          <div class="sms-pip"></div><div class="sms-pip"></div>
        </div>
      </div>
      <div class="sms-chip-expanded-row" id="sms-chip-expanded" aria-hidden="true">
        <span class="sms-chip-band-label" id="sms-band-label">Calm</span>
        <div class="sms-chip-history" id="sms-chip-history"></div>
      </div>
    `;
    chip.addEventListener('click', () => this._togglePressureChip());
    chip.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') this._togglePressureChip(); });
    this._el.appendChild(chip);
    this._refreshPressureChip();

    // Tab strip.
    const tabStrip = createEl('div', 'sms-tab-strip');
    tabStrip.id = 'sms-tab-strip';
    this._el.appendChild(tabStrip);

    // Canvas wrap.
    const wrap = createEl('div', 'sms-canvas-wrap');
    wrap.id = 'sms-canvas-wrap';
    const canvas = document.createElement('canvas');
    canvas.id = 'sms-map-canvas';
    canvas.className = 'sms-map-canvas';
    wrap.appendChild(canvas);

    // Page dots overlay inside canvas wrap.
    const dots = createEl('div', 'sms-page-dots');
    dots.id = 'sms-page-dots';
    wrap.appendChild(dots);

    this._el.appendChild(wrap);

    // Peek drawer.
    const drawer = createEl('div', 'sms-drawer');
    drawer.id = 'sms-drawer';
    drawer.innerHTML = `
      <div class="sms-drawer-handle" id="sms-drawer-handle">
        <div class="sms-drawer-pip"></div>
      </div>
      <div class="sms-drawer-body" id="sms-drawer-body">
        <div class="sms-drawer-empty">Tap a node to explore</div>
      </div>
    `;
    this._el.appendChild(drawer);

    // Bottom action bar.
    const actionBar = createEl('div', 'sms-action-bar');
    actionBar.innerHTML = `
      <button type="button" class="sms-action-btn" id="sms-party" aria-label="Party">
        <span class="sms-action-icon">&#9812;</span>Party
      </button>
      <button type="button" class="sms-action-btn" id="sms-inventory" aria-label="Inventory">
        <span class="sms-action-icon">&#9827;</span>Items
      </button>
      <button type="button" class="sms-action-btn" id="sms-quests" aria-label="Quests">
        <span class="sms-action-icon">&#9733;</span>Quests
      </button>
      <button type="button" class="sms-action-btn" id="sms-rest" aria-label="Rest">
        <span class="sms-action-icon">&#9790;</span>Rest
      </button>
    `;
    this._el.appendChild(actionBar);

    this.manager.uiOverlay.appendChild(this._el);

    // Wire up events.
    this._canvas = canvas;
    this._ctx    = canvas.getContext('2d');
    this._setupCanvas();
    this._bindEvents();
  }

  _setupCanvas() {
    const wrap = this._el.querySelector('#sms-canvas-wrap');
    // Desktop (≥700px): use full available width, not locked to ~393px (fix #12).
    const wW = wrap.clientWidth  || (window.innerWidth >= 700 ? window.innerWidth : 393);
    const wH = wrap.clientHeight || 484;
    this._canvas.width  = wW;
    this._canvas.height = wH;
    this._canvas.style.width  = `${wW}px`;
    this._canvas.style.height = `${wH}px`;
    this._canvasW = wW;
    this._canvasH = wH;
    this._isDesktop = window.innerWidth >= 700;
  }

  // ---------------------------------------------------------------------------
  // Tabs + dots
  // ---------------------------------------------------------------------------

  /**
   * Returns true if sub-region at index `ri` is unlocked for tab navigation.
   *
   * Tab-lock rule (fix #8): a region is reachable only when:
   *   - It is the first region (always open), OR
   *   - At least one node in this region has been VISITED (state = visited/cleared), OR
   *   - At least one node in the PREVIOUS region has been VISITED.
   *
   * This prevents the full-graph BFS visibility from unlocking all tabs on a
   * fresh map. The trailhead "discovered" state counts as visited for region-0
   * only (it's the entry point). Cross-region unlocks only happen on visit.
   */
  _isRegionReachable(ri) {
    if (!this._graph || ri < 0) return false;
    if (ri === 0) return true; // first region is always reachable

    const gs = GameState.get();
    const mapId = gs.story?.currentMapId;
    const save = gs.story?.maps?.[mapId];
    const nodeSave = save?.nodes || {};

    // Helper: check if ANY node in a given region index has been visited.
    const hasVisited = (regionIdx) => {
      const r = this._graph.subRegions[regionIdx];
      if (!r) return false;
      for (const nodeId of r.nodeIds) {
        const ns = nodeSave[nodeId];
        const state = ns?.state || 'unexplored';
        if (state === 'visited' || state === 'cleared') return true;
      }
      return false;
    };

    // Current region has a visited node → unlocked.
    if (hasVisited(ri)) return true;

    // Previous region has a visited node → current region is now accessible.
    if (ri > 0 && hasVisited(ri - 1)) return true;

    return false;
  }

  _refreshTabs() {
    const strip = this._el?.querySelector('#sms-tab-strip');
    if (!strip || !this._graph) return;
    strip.innerHTML = '';
    for (let i = 0; i < this._graph.subRegions.length; i++) {
      const region = this._graph.subRegions[i];
      const reachable = this._isRegionReachable(i);
      const btn = document.createElement('button');
      btn.type = 'button';
      // Locked tabs: dimmed + padlock, no click response (fix #8).
      btn.className = `sms-tab${i === this._regionIdx ? ' active' : ''}${!reachable ? ' sms-tab-locked' : ''}`;
      btn.setAttribute('aria-disabled', !reachable ? 'true' : 'false');
      btn.innerHTML = reachable ? region.name : `&#128274; ${region.name}`;
      if (reachable) {
        btn.addEventListener('click', () => this._goToRegion(i, 'fade'));
      }
      strip.appendChild(btn);
    }
  }

  _refreshDots() {
    const dotsEl = this._el?.querySelector('#sms-page-dots');
    if (!dotsEl || !this._graph) return;
    dotsEl.innerHTML = '';
    for (let i = 0; i < this._graph.subRegions.length; i++) {
      const d = document.createElement('div');
      d.className = `sms-dot${i === this._regionIdx ? ' active' : ''}`;
      dotsEl.appendChild(d);
    }
  }

  // ---------------------------------------------------------------------------
  // Pan recognizer + pagination
  // ---------------------------------------------------------------------------

  _bindEvents() {
    const canvas = this._canvas;

    // Pointer events for pan + tap.
    canvas.addEventListener('pointerdown', e => this._onPointerDown(e));
    canvas.addEventListener('pointermove', e => this._onPointerMove(e));
    canvas.addEventListener('pointerup',   e => this._onPointerUp(e));
    canvas.addEventListener('pointercancel', () => this._onPointerCancel());

    // Drawer swipe up/down.
    const drawer = this._el.querySelector('#sms-drawer');
    const handle = this._el.querySelector('#sms-drawer-handle');
    handle.addEventListener('pointerdown', e => this._onDrawerPointerDown(e));

    // Top bar buttons. M519: back button removed per UX feedback — Story Mode
    // is a committed run; the menu icon is the only top-bar exit (push GameMenu).
    this._el.querySelector('#sms-menu').addEventListener('click', () => {
      this.audio?.playSfx?.('click');
      // M-S06: stub — open game menu when available.
      (async () => {
        try {
          const { GameMenuScreen } = await import('./GameMenuScreen.js');
          this.manager.push(new GameMenuScreen(this.manager, this.audio));
        } catch { /* no GameMenuScreen */ }
      })();
    });

    // Bottom action bar — wired in M-S25.
    this._el.querySelector('#sms-party').addEventListener('click', () => {
      this.audio?.playSfx?.('click');
      (async () => {
        try {
          const { PartyScreen } = await import('./PartyScreen.js');
          this.manager.push(new PartyScreen(this.manager, this.audio));
        } catch {
          console.warn('[StoryMapScreen] PartyScreen not available');
        }
      })();
    });

    this._el.querySelector('#sms-inventory').addEventListener('click', () => {
      this.audio?.playSfx?.('click');
      (async () => {
        try {
          const { InventoryScreen } = await import('./InventoryScreen.js');
          this.manager.push(new InventoryScreen(this.manager, this.audio));
        } catch {
          console.warn('[StoryMapScreen] InventoryScreen not available');
        }
      })();
    });

    this._el.querySelector('#sms-quests').addEventListener('click', () => {
      this.audio?.playSfx?.('click');
      import('./StoryJournalScreen.js').then(({ StoryJournalScreen }) => {
        this.manager.push(new StoryJournalScreen(this.manager, this.audio));
      }).catch(err => console.warn('[StoryMapScreen] StoryJournalScreen import failed', err));
    });

    this._el.querySelector('#sms-rest').addEventListener('click', () => {
      this.audio?.playSfx?.('click');
      // Rest is only fully functional at a rest node.
      const gs = GameState.get();
      const currentNodeId = gs.story?.currentNodeId;
      const node = currentNodeId && this._graph?.nodes?.[currentNodeId];
      if (node?.type === 'rest') {
        // Full heal at rest nodes.
        if (gs.party) {
          for (const hero of gs.party) {
            if (hero.alive !== false) hero.hp = hero.maxHp || hero.hp;
          }
        }
        import('../../engine/SaveManager.js')
          .then(m => m.SaveManager.saveCurrentGame(gs.currentSaveKey))
          .catch(() => {});
        this._showToast('Party rested — HP restored.');
      } else {
        this._showToast('Find a rest node on the map to recover.');
      }
    });
  }

  _onPointerDown(e) {
    e.preventDefault();
    this._panStart  = { x: e.clientX, y: e.clientY, panX: this._panX };
    this._didPan    = false;
    this._rubberBand = 0;
    this._canvas.setPointerCapture(e.pointerId);
    this._el.querySelector('#sms-canvas-wrap').classList.add('panning');
  }

  _onPointerMove(e) {
    if (!this._panStart) return;
    const dx = e.clientX - this._panStart.x;
    if (!this._didPan && Math.abs(dx) > PAN_THRESHOLD_PX) {
      this._didPan = true;
    }
    if (this._didPan) {
      const maxPanX = Math.max(0, this._regionContentWidth() - this._canvasW);
      const rawPan  = this._panStart.panX - dx;
      if (rawPan < 0) {
        this._panX = 0;
        this._rubberBand = Math.min(-rawPan, RUBBER_BAND_PX);
      } else if (rawPan > maxPanX) {
        this._panX = maxPanX;
        this._rubberBand = Math.min(rawPan - maxPanX, RUBBER_BAND_PX);
      } else {
        this._panX = rawPan;
        this._rubberBand = 0;
      }
    }
  }

  _onPointerUp(e) {
    this._el.querySelector('#sms-canvas-wrap').classList.remove('panning');
    if (!this._panStart) return;
    const dx = e.clientX - this._panStart.x;
    const vx = dx; // velocity proxy: total displacement

    if (!this._didPan) {
      // It was a tap — handle node selection.
      this._handleTap(e);
    } else {
      // Check rubber-band pagination.
      if (this._rubberBand >= RUBBER_BAND_PX * 0.5) {
        if (vx < 0 && this._regionIdx < this._graph.subRegions.length - 1) {
          this._goToRegion(this._regionIdx + 1, 'slide');
        } else if (vx > 0 && this._regionIdx > 0) {
          this._goToRegion(this._regionIdx - 1, 'slide');
        } else {
          this._snapBack();
        }
      }
    }
    this._panStart   = null;
    this._rubberBand = 0;
  }

  _onPointerCancel() {
    this._el?.querySelector('#sms-canvas-wrap')?.classList.remove('panning');
    this._panStart   = null;
    this._rubberBand = 0;
  }

  _snapBack() {
    // Animate rubber-band back to 0 — handled in draw loop.
  }

  _goToRegion(idx, mode = 'slide') {
    if (!this._graph) return;
    idx = Math.max(0, Math.min(idx, this._graph.subRegions.length - 1));
    if (idx === this._regionIdx && mode !== 'init') return;
    this._regionIdx = idx;
    this._panX = 0;
    this._selectedId = null;
    this._rebuildPosCache();

    if (mode === 'fade') {
      // Quick fade: briefly dim, re-render.
      if (this._canvas) {
        this._canvas.style.transition = `opacity ${FADE_MS}ms`;
        this._canvas.style.opacity = '0';
        setTimeout(() => {
          if (this._canvas) {
            this._canvas.style.opacity = '1';
            this._renderMap();
          }
        }, FADE_MS);
      }
    } else {
      this._renderMap();
    }
    this._refreshTabs();
    this._refreshDots();
    this._renderDrawer(null);
  }

  // ---------------------------------------------------------------------------
  // Node tap handling
  // ---------------------------------------------------------------------------

  _handleTap(e) {
    if (!this._graph) return;
    const rect   = this._canvas.getBoundingClientRect();
    const tapX   = e.clientX - rect.left + this._panX;
    const tapY   = e.clientY - rect.top;

    const region  = this._graph.subRegions[this._regionIdx];
    if (!region) return;

    let hit = null;
    for (const nodeId of region.nodeIds) {
      const pos = this._nodePosCache[nodeId];
      if (!pos) continue;
      if (hitTestNode(tapX, tapY, pos.x, pos.y)) {
        hit = nodeId;
        break;
      }
    }

    if (hit) {
      this._selectedId = hit;
      this._renderDrawer(hit);
    } else {
      this._selectedId = null;
      this._renderDrawer(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Drawer
  // ---------------------------------------------------------------------------

  _onDrawerPointerDown(e) {
    this._drawerDragStart = { y: e.clientY, expanded: this._drawerExpanded };
    const drawer = this._el.querySelector('#sms-drawer');
    const onMove = (ev) => {
      const dy = this._drawerDragStart.y - ev.clientY;
      if (dy > 30 && !this._drawerExpanded) {
        this._setDrawerExpanded(true);
        cleanup();
      } else if (dy < -30 && this._drawerExpanded) {
        this._setDrawerExpanded(false);
        cleanup();
      }
    };
    const onUp = () => cleanup();
    const cleanup = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  _setDrawerExpanded(expanded) {
    this._drawerExpanded = expanded;
    const drawer = this._el?.querySelector('#sms-drawer');
    if (!drawer) return;
    if (expanded) {
      drawer.classList.add('expanded');
    } else {
      drawer.classList.remove('expanded');
    }
  }

  _renderDrawer(nodeId) {
    const body = this._el?.querySelector('#sms-drawer-body');
    if (!body) return;
    if (!nodeId || !this._graph) {
      body.innerHTML = '<div class="sms-drawer-empty">Tap a node to explore</div>';
      this._setDrawerExpanded(false);
      return;
    }

    const node = this._graph.nodes[nodeId];
    const save = this._graph.nodeSave?.[nodeId] || {};
    if (!node) {
      body.innerHTML = '<div class="sms-drawer-empty">Unknown node</div>';
      return;
    }

    const typeName  = node.type.charAt(0).toUpperCase() + node.type.slice(1);
    const biomeName = node.biome.replace(/_/g, ' ');
    const stateStr  = save.state || 'unexplored';
    const wpState   = save.waypointState;

    body.innerHTML = `
      <div class="sms-drawer-node-name">${typeName} · ${biomeName}</div>
      <div class="sms-drawer-node-meta">
        <span class="sms-drawer-badge">${stateStr}</span>
        ${node.type === 'boss' ? '<span class="sms-drawer-badge">BOSS</span>' : ''}
        ${wpState ? `<span class="sms-drawer-badge">Waypoint: ${wpState}</span>` : ''}
      </div>
      <div class="sms-drawer-btns">
        <button type="button" class="sms-drawer-btn" id="sms-travel-btn">Travel</button>
        ${wpState === 'activated' ? '<button type="button" class="sms-drawer-btn secondary" id="sms-ft-btn">Fast Travel</button>' : ''}
      </div>
      ${this._drawerExpanded ? `<div class="sms-drawer-detail">Region: ${biomeName} · Node: ${nodeId}</div>` : ''}
    `;

    body.querySelector('#sms-travel-btn')?.addEventListener('click', () => {
      this.audio?.playSfx?.('click');
      this._resolveNodeTravel(nodeId);
    });

    body.querySelector('#sms-ft-btn')?.addEventListener('click', () => {
      this.audio?.playSfx?.('click');
      this._fastTravelTo(nodeId);
    });
  }

  // ---------------------------------------------------------------------------
  // Fast travel (fix #7)
  // ---------------------------------------------------------------------------

  /**
   * Teleport the party to an activated waypoint by setting currentNodeId
   * and re-centering the map. No combat, no movement cost.
   */
  _fastTravelTo(nodeId) {
    if (!this._graph || !nodeId) return;
    const gs = GameState.get();
    if (!gs.story) return;
    const node = this._graph.nodes[nodeId];
    if (!node) return;

    // Verify the waypoint is activated.
    const mapId = gs.story.currentMapId;
    const ns = gs.story.maps?.[mapId]?.nodes?.[nodeId];
    if (!ns || ns.waypointState !== 'activated') {
      this._showToast('This waypoint is not yet activated.');
      return;
    }

    // Teleport: update currentNodeId without triggering an encounter.
    gs.story.currentNodeId = nodeId;

    // Switch to the sub-region containing this node.
    const regionIdx = this._graph.subRegions.findIndex(r => r.nodeIds.includes(nodeId));
    if (regionIdx >= 0 && regionIdx !== this._regionIdx) {
      this._goToRegion(regionIdx, 'fade');
    } else {
      this._rebuildPosCache();
      this._renderMap();
    }

    // Re-center on the node.
    const pos = this._nodePosCache[nodeId];
    if (pos) {
      this._panX = Math.max(0, pos.x - this._canvasW / 2);
    }

    this._renderDrawer(null);
    this._showToast(`Fast traveled to ${node.type === 'trailhead' ? 'Trailhead' : node.biome.replace(/_/g, ' ')}.`);

    // Persist.
    import('../../engine/SaveManager.js').then(m => {
      m.SaveManager.saveCurrentGame(gs.currentSaveKey);
    }).catch(() => {});
  }

  /**
   * Called after combat returns (via onResume hook) — if the party is dead,
   * respawn at lastWaypointId (fix #7 death respawn).
   */
  _checkDeathRespawn() {
    const gs = GameState.get();
    if (!gs.story || !gs.party) return;
    const allDead = gs.party.every(h => h.alive === false || (h.hp != null && h.hp <= 0));
    if (!allDead) return;

    const respawnId = gs.story.lastWaypointId || this._graph?.entryNodeId;
    if (!respawnId) return;

    // Restore party to 1 HP so they can keep playing.
    for (const hero of gs.party) {
      hero.alive = true;
      hero.hp    = Math.max(1, Math.floor((hero.maxHp || 10) * 0.25));
    }
    gs.story.currentNodeId = respawnId;
    this._showToast('Party defeated — respawned at last waypoint.');

    const regionIdx = this._graph?.subRegions.findIndex(r => r.nodeIds.includes(respawnId));
    if (regionIdx >= 0 && regionIdx !== this._regionIdx) {
      this._goToRegion(regionIdx, 'fade');
    }
  }

  // ---------------------------------------------------------------------------
  // Node travel resolution (Bug 1 fix)
  // ---------------------------------------------------------------------------

  /**
   * Mark nodeId current, persist state, then dispatch to the correct sub-screen
   * based on node.type. Falls back to a toast for types with no content ready.
   */
  _resolveNodeTravel(nodeId) {
    if (!this._graph || !nodeId) return;
    const node = this._graph.nodes[nodeId];
    if (!node) return;

    const gs = GameState.get();
    if (!gs.story) return;

    // --- 1. Update save state ---
    gs.story.currentNodeId = nodeId;
    const mapId = gs.story.currentMapId;
    if (mapId && gs.story.maps?.[mapId]?.nodes?.[nodeId]) {
      gs.story.maps[mapId].nodes[nodeId].state = 'visited';
      // Reveal adjacent open-edge neighbours.
      const outgoing = this._graph.indexes?.outgoing || {};
      for (const edge of (outgoing[nodeId] || [])) {
        if (edge.kind === 'open' && gs.story.maps[mapId]?.nodes?.[edge.to]) {
          const ns = gs.story.maps[mapId].nodes[edge.to];
          if (ns.visibility === 'hidden') ns.visibility = 'visible';
        }
      }
    }

    // Advance pressure meter (field is pressureMeter, not pressure).
    if (typeof gs.story.pressureMeter === 'number') {
      const delta = node.type === 'rest' ? -10 : 5;
      gs.story.pressureMeter = Math.max(0, Math.min(100, gs.story.pressureMeter + delta));
    }

    // Tick recentHistory counter + track node type for chip history strip.
    // gs.story.recentHistory is the director object { nodeTypes:[], biomes:[], ... }
    // per storyLedger.js. Push to nodeTypes[] for the pressure chip glyph strip.
    gs.story.recentHistoryCount = (gs.story.recentHistoryCount || 0) + 1;
    if (!gs.story.recentHistory || typeof gs.story.recentHistory !== 'object' || Array.isArray(gs.story.recentHistory)) {
      gs.story.recentHistory = { nodeTypes: [], enemyFamilies: [], skillLabels: [], rewardTypes: [], biomes: [], tones: [], sameTypeStreak: 0, lastType: null };
    }
    if (!Array.isArray(gs.story.recentHistory.nodeTypes)) gs.story.recentHistory.nodeTypes = [];
    gs.story.recentHistory.nodeTypes.push(node.type);
    if (gs.story.recentHistory.nodeTypes.length > 20) gs.story.recentHistory.nodeTypes.shift();
    gs.story.recentHistory.lastType = node.type;

    // Track lastWaypointId whenever visiting a waypoint (fix #7 death respawn).
    const isWaypoint = node.tags?.includes('waypoint') || node.type === 'trailhead' || node.type === 'town';
    if (isWaypoint) {
      gs.story.lastWaypointId = nodeId;
      // Auto-activate waypoint state.
      const wpMapSave = gs.story.maps?.[mapId]?.nodes?.[nodeId];
      if (wpMapSave && (!wpMapSave.waypointState || wpMapSave.waypointState === 'unexplored' || wpMapSave.waypointState === 'discovered')) {
        wpMapSave.waypointState = 'activated';
      }
    }

    // Rebuild visibility cache immediately so map re-draws correct state.
    this._rebuildVisibilityCache();

    // --- 2. Dispatch by type ---
    const type = node.type;

    // Trailhead: no-op node — just shows location name and closes drawer (fix #5).
    if (type === 'trailhead') {
      const mapName = this._graph.subRegions?.[0]?.name || 'Emberveil';
      const body = this._el?.querySelector('#sms-drawer-body');
      if (body) {
        body.innerHTML = `
          <div class="sms-drawer-node-name">Trailhead &mdash; ${mapName}</div>
          <div class="sms-drawer-node-meta"><span class="sms-drawer-badge">Waypoint</span><span class="sms-drawer-badge activated">Activated</span></div>
          <div class="sms-drawer-btns">
            <button type="button" class="sms-drawer-btn" id="sms-trailhead-continue">Continue</button>
          </div>
        `;
        body.querySelector('#sms-trailhead-continue')?.addEventListener('click', () => {
          this._renderDrawer(null);
          this._setDrawerExpanded(false);
        });
      }
      // Mark waypoint as activated if not already.
      const mapId = gs.story.currentMapId;
      if (mapId && gs.story.maps?.[mapId]?.nodes?.[nodeId]) {
        gs.story.maps[mapId].nodes[nodeId].waypointState = 'activated';
        gs.story.maps[nodeId]?.state !== 'visited' && (gs.story.maps[mapId].nodes[nodeId].state = 'visited');
      }
      gs.story.lastWaypointId = nodeId;
      return;
    }

    if (type === 'town') {
      // Town node: push TownScreen adapted for Story Mode (fix #6).
      // Town tier = act number: 1=basic, 2=adds blacksmith, 3=adds enchanter.
      // We store the tier on gs so TownScreen can read it.
      if (gs.story) {
        gs.story.townTier = gs.story.act || 1;
      }
      this._afterNodeResolved(gs, nodeId);
      // Update lastWaypointId since town is a waypoint.
      gs.story.lastWaypointId = nodeId;
      const mapId = gs.story.currentMapId;
      if (mapId && gs.story.maps?.[mapId]?.nodes?.[nodeId]) {
        gs.story.maps[mapId].nodes[nodeId].waypointState = 'activated';
      }
      import('./TownScreen.js').then(({ TownScreen }) => {
        const hero = gs.party?.[0] || null;
        this.manager.push(new TownScreen(this.manager, this.audio, hero, false));
      }).catch(() => {
        this._showToast('Town services unavailable — returning to map.');
        this._renderDrawer(null);
      });
      return;
    }

    if (type === 'rest') {
      // Heal party to full HP + MP.
      if (gs.party) {
        for (const hero of gs.party) {
          if (hero.alive !== false) {
            hero.hp = hero.maxHp ?? hero.hp;
            if (typeof hero.mp === 'number') hero.mp = hero.maxMp ?? hero.mp;
          }
        }
      }
      this._afterNodeResolved(gs, nodeId);
      this._showToast(`Rested at ${node.biome.replace(/_/g, ' ')} — party fully restored.`);
      this._renderDrawer(null);
      return;
    }

    if (type === 'combat' || type === 'elite' || type === 'boss') {
      // Build encounter via storyEncounterBuilder then push CombatScreen.
      import('../../story/storyEncounterBuilder.js').then(({ buildEncounterForNode }) => {
        const encounter = buildEncounterForNode(gs, nodeId);
        if (!encounter) {
          this._showToast(`Travelled through ${node.biome.replace(/_/g, ' ')}.`);
          this._afterNodeResolved(gs, nodeId);
          this._renderDrawer(null);
          return;
        }
        import('./CombatScreen.js').then(({ CombatScreen }) => {
          const combat = new CombatScreen(this.manager, this.audio, null, encounter);
          // Set up post-combat callback via a one-time onResume hook.
          const _origResume = this.onResume.bind(this);
          this.onResume = () => {
            this.onResume = _origResume; // restore
            this._afterNodeResolved(gs, nodeId);
            this._checkDeathRespawn(); // respawn if party wiped (fix #7)
            this._rebuildVisibilityCache();
            this._renderMap();
            this._refreshTabs(); // tabs may unlock after fog-of-war reveal (fix #8)
            _origResume();
          };
          this.manager.push(combat);
        }).catch(() => {
          this._showToast(`Travelled through ${node.biome.replace(/_/g, ' ')}.`);
          this._afterNodeResolved(gs, nodeId);
          this._renderDrawer(null);
        });
      }).catch(() => {
        this._showToast(`Travelled through ${node.biome.replace(/_/g, ' ')}.`);
        this._afterNodeResolved(gs, nodeId);
        this._renderDrawer(null);
      });
      return;
    }

    if (type === 'dialog' || type === 'event' || type === 'shrine' || type === 'lore' || type === 'merchant') {
      const poolMap = {
        dialog:   'arrival',
        event:    'ambush',
        shrine:   'shrine',
        lore:     'lore',
        merchant: 'merchant',
      };
      const poolId = poolMap[type] || type;
      import('../../story/storyContent.js').then(({ loadDialoguePool }) => {
        const poolPromise = loadDialoguePool(poolId);
        const resolvePool = (pool) => {
          const nodes = Array.isArray(pool) ? pool : (pool?.nodes || []);
          // Prefer same biome + act, else pick any.
          const act = gs.story.act || 1;
          const matches = nodes.filter(n =>
            (!n.biome || n.biome === node.biome) &&
            (!n.act   || n.act === act)
          );
          const candidates = matches.length ? matches : nodes;
          const picked = candidates[Math.floor(Math.random() * candidates.length)];
          if (!picked) {
            this._showToast(`Travelled through ${node.biome.replace(/_/g, ' ')}.`);
            this._afterNodeResolved(gs, nodeId);
            this._renderDrawer(null);
            return;
          }
          import('./StoryDialogScreen.js').then(({ StoryDialogScreen }) => {
            const screen = new StoryDialogScreen(
              this.manager, this.audio, picked,
              () => {
                this._afterNodeResolved(gs, nodeId);
                this._rebuildVisibilityCache();
                this._renderMap();
                this._renderDrawer(null);
              },
              { poolId, nodeId }
            );
            this.manager.push(screen);
          }).catch(() => {
            this._showToast(`Travelled through ${node.biome.replace(/_/g, ' ')}.`);
            this._afterNodeResolved(gs, nodeId);
            this._renderDrawer(null);
          });
        };
        if (poolPromise && typeof poolPromise.then === 'function') {
          poolPromise.then(resolvePool).catch(() => {
            this._showToast(`Travelled through ${node.biome.replace(/_/g, ' ')}.`);
            this._afterNodeResolved(gs, nodeId);
            this._renderDrawer(null);
          });
        } else {
          resolvePool(poolPromise);
        }
      }).catch(() => {
        this._showToast(`Travelled through ${node.biome.replace(/_/g, ' ')}.`);
        this._afterNodeResolved(gs, nodeId);
        this._renderDrawer(null);
      });
      return;
    }

    // Unrecognized type: toast fallback (never an alert).
    this._showToast(`Travelled through ${node.biome.replace(/_/g, ' ')}.`);
    this._afterNodeResolved(gs, nodeId);
    this._renderDrawer(null);
  }

  _afterNodeResolved(gs, nodeId) {
    import('../../story/storyMode.js').then(({ storyMode }) => {
      storyMode.afterNodeResolved(gs, nodeId);
    }).catch(() => {});
    // Persist save.
    import('../../engine/SaveManager.js').then(m => {
      m.SaveManager.saveCurrentGame(gs.currentSaveKey);
    }).catch(() => {});
  }

  // ---------------------------------------------------------------------------
  // Pressure chip expand/collapse
  // ---------------------------------------------------------------------------

  _togglePressureChip() {
    const chip = this._el?.querySelector('#sms-pressure-chip');
    if (!chip) return;
    const isExpanded = chip.classList.contains('expanded-chip');
    chip.classList.toggle('expanded-chip', !isExpanded);
    const expandedRow = chip.querySelector('#sms-chip-expanded');
    if (expandedRow) expandedRow.setAttribute('aria-hidden', isExpanded ? 'true' : 'false');
    this._refreshPressureChip();
  }

  _refreshPressureChip() {
    const gs    = GameState.get();
    const label = this._el?.querySelector('#sms-pressure-label');
    const pips  = this._el?.querySelector('#sms-pips');
    const bandEl = this._el?.querySelector('#sms-band-label');
    const histEl = this._el?.querySelector('#sms-chip-history');
    if (!gs.story) return;

    const storytellerId = gs.story.storytellerId || 'chronicler';
    const pressure      = gs.story.pressureMeter || gs.story.pressure || 0;
    const band          = pressure < 25 ? 'Calm' : pressure < 50 ? 'Tense' : pressure < 75 ? 'Urgent' : 'Crisis';

    // Collapsed row: name + pips.
    if (label) {
      const stName = {
        chronicler: 'The Chronicler', ash_prophet: 'The Ash Prophet',
        warbringer: 'The Warbringer', trickster: 'The Trickster',
        pilgrim: 'The Pilgrim', iron_judge: 'The Iron Judge',
      };
      label.textContent = stName[storytellerId] || storytellerId;
    }
    if (pips) {
      const pipCount = Math.min(5, Math.round(pressure / 20)); // 0-5 pips
      pips.querySelectorAll('.sms-pip').forEach((p, i) => p.classList.toggle('active', i < pipCount));
    }

    // Expanded row: band label + last-5 node types as glyphs.
    if (bandEl) bandEl.textContent = band;
    if (histEl) {
      const typeGlyph = { combat:'⚔', elite:'☠', boss:'♛', dialog:'❁', shrine:'✶',
        lore:'℘', merchant:'◎', rest:'☽', event:'✵', trailhead:'⚑', town:'⌂' };
      // recentHistory is the director object { nodeTypes: [] }; fall back to array if legacy.
      const historySource = Array.isArray(gs.story.recentHistory)
        ? gs.story.recentHistory
        : (gs.story.recentHistory?.nodeTypes || []);
      const history = historySource.slice(-5);
      histEl.innerHTML = history.map(t => {
        const g = typeGlyph[t] || '?';
        return `<span class="sms-chip-hist-glyph" title="${t}">${g}</span>`;
      }).join('');
    }
  }

  // ---------------------------------------------------------------------------
  // Toast helper
  // ---------------------------------------------------------------------------

  _showToast(msg) {
    try {
      import('../../ui/components/toast.js').then(m => m.showToast(msg, { duration: 3000 })).catch(() => {});
    } catch (_) {}
    // Fallback: inject a simple ephemeral label.
    const el = document.createElement('div');
    el.className = 'sms-toast-msg';
    el.textContent = msg;
    el.setAttribute('role', 'status');
    if (!document.querySelector('#sms-toast-styles')) {
      const s = document.createElement('style');
      s.id = 'sms-toast-styles';
      s.textContent = `.sms-toast-msg{position:fixed;bottom:96px;left:50%;transform:translateX(-50%);background:rgba(20,12,28,0.95);color:#e8c070;font-size:14px;padding:10px 18px;border-radius:8px;border:1px solid rgba(232,160,32,0.3);pointer-events:none;z-index:9999;animation:sms-fadein 0.2s ease}@keyframes sms-fadein{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`;
      document.head.appendChild(s);
    }
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2800);
  }

  // ---------------------------------------------------------------------------
  // Position cache
  // ---------------------------------------------------------------------------

  _regionContentWidth() {
    if (!this._graph) return this._canvasW;
    const region = this._graph.subRegions[this._regionIdx];
    if (!region) return this._canvasW;
    const maxCol = Math.max(...region.nodeIds.map(id => this._graph.nodes[id]?.col || 0));
    return (maxCol + 2) * NODE_MIN_H_SPACING + NODE_MIN_H_SPACING;
  }

  _rebuildPosCache() {
    this._nodePosCache = {};
    if (!this._graph) return;
    const region = this._graph.subRegions[this._regionIdx];
    if (!region) return;
    const h = this._canvasH || 484;
    for (const nodeId of region.nodeIds) {
      const node = this._graph.nodes[nodeId];
      if (!node) continue;
      this._nodePosCache[nodeId] = nodeXYFromLane(node, this._canvasW, h);
    }
  }

  // ---------------------------------------------------------------------------
  // Render loop
  // ---------------------------------------------------------------------------

  _startLoop() {
    if (this._raf) return;
    let last = performance.now();
    const tick = (now) => {
      this._raf = requestAnimationFrame(tick);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      this._t += dt;
      this._renderMap();
    };
    this._raf = requestAnimationFrame(tick);
  }

  _stopLoop() {
    if (this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = null;
    }
  }

  _renderMap() {
    const ctx = this._ctx;
    if (!ctx || !this._graph) return;

    const w = this._canvasW;
    const h = this._canvasH;
    const frameStart = performance.now();

    ctx.clearRect(0, 0, w, h);

    const region = this._graph.subRegions[this._regionIdx];

    // --- Biome-themed background (fix #13: use image if available, else palette) ---
    const biomeName = region?.biome || 'emberwood';
    const biomeEntry = this._biomeData?.[biomeName] || null;
    const palette    = this._getBiomePalette(biomeName);
    if (biomeEntry && typeof drawBiomeBackground === 'function') {
      // drawBiomeBackground handles gradient + optional backgroundImage + darken.
      drawBiomeBackground(ctx, biomeEntry, w, h, this._t, () => {
        // Image loaded mid-session — the next render tick will show it.
      });
    } else {
      // Palette gradient fallback.
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0,   palette[0]);
      grad.addColorStop(0.4, palette[1]);
      grad.addColorStop(1,   palette[0]);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }

    // Parchment noise texture (lightweight programmatic cross-hatch).
    this._drawParchmentTexture(ctx, w, h, palette);

    if (!region) return;

    // --- Ember motes background particles (performance-budgeted) ---
    const budgetOk = this._lastFrameMs < 12;
    this._updateEmbers(w, h, budgetOk);
    if (budgetOk) this._drawEmbers(ctx);

    // Apply pan translation.
    ctx.save();
    ctx.translate(-this._panX, 0);

    // Draw edges first (under nodes).
    this._drawEdges(ctx, region, w, h);

    // Draw stitch arrows to next/prev regions.
    this._drawStitchArrows(ctx, region, w, h);

    // Draw nodes using computed visibility cache (no dev shortcut).
    const vis = this._visibilityCache;
    for (const nodeId of region.nodeIds) {
      const node  = this._graph.nodes[nodeId];
      const pos   = this._nodePosCache[nodeId];
      if (!node || !pos) continue;

      // Visibility from cache; if no cache yet fall back to nodeSave.
      const cachedVis = vis ? vis.get(nodeId) : null;
      const save      = this._graph.nodeSave?.[nodeId] || {};
      const resolvedVis = cachedVis ?? save.visibility ?? 'visible';

      if (resolvedVis === 'hidden') continue; // Bug 2 fix: skip hidden nodes

      const stateInfo = {
        state:         save.state || 'unexplored',
        visibility:    resolvedVis,
        waypointState: save.waypointState || null,
        overlay:       save.overlay || null,
        selected:      nodeId === this._selectedId,
        hovered:       false,
      };

      drawNode(ctx, pos.x, pos.y, node.type, stateInfo);
    }

    ctx.restore();

    // --- Sub-region label at top of canvas ---
    this._drawRegionLabel(ctx, w, region, biomeName, palette);

    // --- Vignette overlay ---
    this._drawVignette(ctx, w, h);

    // Track frame time for ember budget.
    this._lastFrameMs = performance.now() - frameStart;
  }

  /** Get biome palette array from loaded data or BIOME_PALETTE_FALLBACK. */
  _getBiomePalette(biomeId) {
    if (this._biomeData?.[biomeId]?.palette) {
      const p = this._biomeData[biomeId].palette;
      // canonical-biomes has 4 entries: [dark, mid, light, accent].
      return [p[0] || '#1a1210', p[1] || '#3a2a18', p[2] || '#786040', p[3] || '#d0b070'];
    }
    return BIOME_PALETTE_FALLBACK[biomeId] || BIOME_PALETTE_FALLBACK._default;
  }

  /** Lightweight programmatic parchment cross-hatch (very subtle). */
  _drawParchmentTexture(ctx, w, h, palette) {
    ctx.save();
    ctx.globalAlpha = 0.04;
    ctx.strokeStyle = palette[2]; // light tone
    ctx.lineWidth = 0.5;
    const step = 18;
    for (let x = 0; x < w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Draw the biome name label near the top of the visible canvas area. */
  _drawRegionLabel(ctx, w, region, biomeName, palette) {
    const label = region?.name || (biomeName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.font = `700 13px Cinzel, serif`;
    ctx.fillStyle = palette[3]; // accent color (light/bright tone)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(label.toUpperCase(), w / 2, 6);
    ctx.restore();
  }

  /** Radial vignette around canvas edges. */
  _drawVignette(ctx, w, h) {
    ctx.save();
    const grd = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.75);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  /** Seed ember particle pool with random motes. */
  _initEmbers(w, h) {
    this._embers = [];
    const COUNT = 18;
    for (let i = 0; i < COUNT; i++) {
      this._embers.push(this._spawnEmber(w, h, true));
    }
  }

  _spawnEmber(w, h, initialScatter = false) {
    return {
      x:     Math.random() * w,
      y:     initialScatter ? Math.random() * h : h + 4,
      vx:    (Math.random() - 0.5) * 0.3,
      vy:    -(0.2 + Math.random() * 0.4),
      alpha: 0.04 + Math.random() * 0.1,
      r:     1 + Math.random() * 1.5,
      life:  1,
    };
  }

  _updateEmbers(w, h, budgetOk) {
    if (!budgetOk) return; // skip update when frame is already slow
    if (!this._embers.length) this._initEmbers(w, h);
    for (let i = this._embers.length - 1; i >= 0; i--) {
      const e = this._embers[i];
      e.x    += e.vx;
      e.y    += e.vy;
      e.alpha -= 0.0003;
      if (e.y < -4 || e.alpha <= 0) {
        this._embers[i] = this._spawnEmber(w, h);
      }
    }
  }

  _drawEmbers(ctx) {
    ctx.save();
    for (const e of this._embers) {
      ctx.globalAlpha = e.alpha;
      ctx.fillStyle = '#f0a030';
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  _drawEdges(ctx, region, w, h) {
    const outgoing      = this._graph.indexes?.outgoing || {};
    const regionNodeSet = new Set(region.nodeIds);
    const vis           = this._visibilityCache;

    for (const nodeId of region.nodeIds) {
      // Skip edges from hidden nodes (they shouldn't be visible at all).
      const fromVis = vis ? vis.get(nodeId) : 'visible';
      if (fromVis === 'hidden') continue;

      const edges   = outgoing[nodeId] || [];
      const fromPos = this._nodePosCache[nodeId];
      if (!fromPos) continue;

      for (const edge of edges) {
        if (!regionNodeSet.has(edge.to)) continue; // cross-region drawn separately

        // Bug 2 fix: if the destination node is hidden, skip drawing this edge.
        const toVis = vis ? vis.get(edge.to) : 'visible';
        if (!toVis || toVis === 'hidden') continue;

        const toPos = this._nodePosCache[edge.to];
        if (!toPos) continue;

        // For hidden-kind edges into revealed nodes: use 'hidden' draw style.
        const drawKind = (edge.kind === 'hidden' || edge.kind === 'blocked')
          ? (toVis === 'revealed' ? 'hidden' : 'blocked')
          : edge.kind;

        drawEdge(ctx, fromPos.x, fromPos.y, toPos.x, toPos.y, drawKind, this._t);
      }
    }
  }

  _drawStitchArrows(ctx, region, w, h) {
    // Draw dashed arrows from rightmost nodes pointing off-screen right
    // toward the next region (§6.5 cross-region transition pattern).
    const outgoing = this._graph.indexes?.outgoing || {};
    const regions  = this._graph.subRegions;
    const currentRegionNodeSet = new Set(region.nodeIds);

    if (this._regionIdx < regions.length - 1) {
      const maxCol = Math.max(...region.nodeIds.map(id => this._graph.nodes[id]?.col || 0));
      for (const nodeId of region.nodeIds) {
        const node = this._graph.nodes[nodeId];
        if ((node?.col || 0) < maxCol) continue;
        const pos = this._nodePosCache[nodeId];
        if (!pos) continue;

        const edges = outgoing[nodeId] || [];
        const hasStitch = edges.some(e => !currentRegionNodeSet.has(e.to));
        if (!hasStitch) continue;

        // Dashed arrow to right edge.
        const edgeX = w - this._panX + 24; // past visible edge
        drawEdge(ctx, pos.x, pos.y, edgeX, pos.y, 'stitch', this._t);

        // Tap zone: triangle arrowhead on right edge.
        const arrowX = w - this._panX + 4;
        ctx.save();
        ctx.fillStyle = 'rgba(232,192,96,0.8)';
        ctx.beginPath();
        ctx.moveTo(arrowX, pos.y - 8);
        ctx.lineTo(arrowX + 10, pos.y);
        ctx.lineTo(arrowX, pos.y + 8);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }
}
