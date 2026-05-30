/**
 * MapScreen — Node map navigation
 * Renders zone map on canvas with clickable nodes
 */
import { createEl, removeEl, injectStyles } from '../../utils/dom.js';
import { GameState } from '../../game/gameState.js';
import { computeItemScores } from '../../game/items.js';
import { PROLOGUE_ZONES, ACT1_ZONES, ACT2_ZONES, ACT3_ZONES, ACT4_ZONES, ACT5_ZONES, ACT6_ZONES, NODE_TYPES, DIALOG_EVENTS, ENCOUNTERS, ZONE_ENCOUNTER_POOLS, findNearestTown, resolveBigFightEncounter, isHiddenNodeUnlocked, getHiddenBossEncounter, HIDDEN_BOSS_ENCOUNTERS } from '../../maps/mapData.js';
import { getRandomEvent, RANDOM_EVENTS } from '../../maps/randomEvents.js';

const ALL_ZONES = [...PROLOGUE_ZONES, ...ACT1_ZONES, ...ACT2_ZONES, ...ACT3_ZONES, ...ACT4_ZONES, ...ACT5_ZONES, ...ACT6_ZONES];
const ACT_LABELS = {
  1: 'Act I \u00B7 The Goblin Frontier',
  2: 'Act II \u00B7 The Ashen Wastes',
  3: 'Act III \u00B7 The Hell Breach',
  4: 'Act IV \u00B7 The Cosmic Void',
  5: 'Act V \u00B7 The Primordial Abyss',
  6: "Act VI \u00B7 The Dragon's Reach",
};
import { CombatScreen } from './CombatScreen.js';
import { debug } from '../../utils/debug.js';
import { DialogScreen } from './DialogScreen.js';
import { mount as kbMount, unmount as kbUnmount } from '../../utils/keyboardNav.js';
import { getMapDebugSettings } from '../../game/mapDebugSettings.js';

const NODE_ICONS = {
  [NODE_TYPES.COMBAT]:   { color: '#c04030', label: 'Combat' },
  [NODE_TYPES.DIALOG]:   { color: '#4080c0', label: 'Encounter' },
  [NODE_TYPES.TOWN]:     { color: '#40a860', label: 'Town' },
  [NODE_TYPES.TREASURE]: { color: '#e8a020', label: 'Treasure' },
  [NODE_TYPES.AMBUSH]:   { color: '#8a2020', label: 'Ambush' },
  [NODE_TYPES.BOSS]:      { color: '#9040c0', label: 'Boss' },
  [NODE_TYPES.LORE]:      { color: '#6a9040', label: 'Discovery' },
  // M337 — separate Shrine, Challenge, Skill Check labels and shapes.
  // Previously Challenge appeared twice in the legend (CHALLENGE + SKILL_CHECK
  // both labeled "Challenge"). Shrine color was also a near-twin of skill
  // check teal. Now: Shrine = mint green-blue, Challenge = orange, Skill
  // Check = cyan, and each non-default node carries a distinct glyph.
  [NODE_TYPES.SHRINE]:      { color: '#80e0c8', label: 'Shrine',     glyph: '✦' },
  [NODE_TYPES.CHALLENGE]:   { color: '#e06020', label: 'Challenge',  glyph: '!' },
  [NODE_TYPES.DUNGEON]:     { color: '#c060e0', label: 'Dungeon',    glyph: '◆' },
  [NODE_TYPES.SKILL_CHECK]: { color: '#40c8e0', label: 'Skill Check', glyph: '?' },
};

// M406 — checks both the persistent mapDebugSettings.debugNodes flag and the
// legacy window.__mapDebug console flag so either mechanism enables debug output.
function _isMapDebugOn() {
  try { return !!(getMapDebugSettings().debugNodes || window.__mapDebug); } catch { return false; }
}

// Fallback encounter when node has no encounter key
const FALLBACK_ENCOUNTER = ENCOUNTERS.goblin_patrol;

// M406 — Shrine buff management. Buffs are stored in gs.shrineBuffs as an
// array of { type, combatsLeft, ...params }. CombatScreen reads and
// decrements combatsLeft on each fight end. Only one entry per type is
// kept; re-applying the same type resets the counter.
function _pushShrineBuff(gs, buff) {
  if (!Array.isArray(gs.shrineBuffs)) gs.shrineBuffs = [];
  const existing = gs.shrineBuffs.findIndex(b => b.type === buff.type);
  if (existing >= 0) gs.shrineBuffs[existing] = buff;
  else gs.shrineBuffs.push(buff);
}

export class MapScreen {
  constructor(manager, audio) {
    this.manager = manager;
    this.audio = audio;
    this._el = null;
    this._hovered = null;
    this._t = 0;
    this._travel = null; // { from:{x,y}, to:{x,y}, elapsed, duration, node }
    // Set current zone from GameState
    const gs = GameState.get();
    this._zone = ALL_ZONES.find(z => z.id === gs.zoneId) || ACT1_ZONES[0];
    // M56: if nodeId isn't in the current zone (e.g. loaded mid-travel or stale), recover it.
    if (!this._zone.nodes.find(n => n.id === gs.nodeId)) {
      const remembered = GameState.getZoneNode(this._zone.id);
      gs.nodeId = (remembered && this._zone.nodes.find(n => n.id === remembered))
        ? remembered
        : this._zone.nodes[0]?.id;
    }
    if (gs.nodeId) GameState.setZoneNode(this._zone.id, gs.nodeId);
  }

  onEnter() {
    // M69: start (or resume) overworld music for this zone's act.
    try {
      const gs = GameState.get();
      const partyZone = ALL_ZONES.find(z => z.id === gs.zoneId) || this._zone;
      const act = partyZone?.act || gs.act || 1;
      this.audio.playOverworldMusic(act, partyZone?.id || null);
    } catch (_) {}
    this._build();
    // M450 — when the map opens (typically after exiting Town), scroll the
    // .map-canvas-wrap so the party's current node is horizontally centered
    // in the viewport. Previously the scroll always reset to 0, leaving
    // mid- and right-side town nodes off-screen until the user manually
    // scrolled.
    try { this._centerScrollOnPartyNode(); } catch (_) {}
    // M302: seed overlays for current zone on enter
    try { this._ensureZoneOverlays(this._zone); } catch (_) {}
    // Map graph debug: log node table when window.__mapDebug = true.
    // Also runs a stray-edge validator unconditionally (warnings only) to
    // catch any node.exits that point to non-existent ids in the zone.
    try { this._validateZoneGraph(this._zone); } catch (_) {}
    try { if (_isMapDebugOn()) this._dumpZoneGraph(this._zone); } catch (_) {}
    // M276 B4: drain pending boss chest immediately when MapScreen opens.
    this._maybeOpenBossChest();
    // M380 — ESC opens GameMenu directly. The global window-level ESC handler
    // in main.js was supposed to fire automatically, but in practice keypress
    // events on the map (often with focus inside an injected modal or the
    // zone-select dropdown) didn't reliably bubble to window. Bind explicitly.
    if (!this._escBound) {
      this._escBound = true;
      this._escHandler = (e) => {
        if (e.key !== 'Escape' && e.code !== 'Escape') return;
        // Skip if a stack screen above the map has its own escape (e.g. dialog,
        // shrine modal isn't a stack entry — those use DOM overlays handled
        // elsewhere). For the map itself, push the menu.
        const top = this.manager?._stack?.[this.manager._stack.length - 1];
        if (top !== this) return;
        e.preventDefault();
        this.audio?.playSfx?.('click');
        (async () => {
          try {
            const { GameMenuScreen } = await import('./GameMenuScreen.js');
            this.manager.push(new GameMenuScreen(this.manager, this.audio));
          } catch (err) { console.warn('GameMenu open failed', err); }
        })();
      };
      window.addEventListener('keydown', this._escHandler);
    }
  }

  onLeave() {
    if (this._escHandler) {
      window.removeEventListener('keydown', this._escHandler);
      this._escHandler = null;
      this._escBound = false;
    }
  }

  _getUnlockedZones() {
    const gs = GameState.get();
    const unlocked = gs.unlockedZones || ['border_roads'];
    return ALL_ZONES.filter(z => unlocked.includes(z.id));
  }

  // M276 N2 — zone tabs at the top of the map should NOT show prologue once
  // the player has progressed beyond it. The zone data still exists in
  // mapData.js (NG+ resets back into prologue), but the player can't tab into
  // a finished prologue from the overworld. If the party is currently still
  // IN the prologue (act 0 / unlockedZones === ['prologue']), show it.
  _getVisibleZoneTabs() {
    const gs = GameState.get();
    const all = this._getUnlockedZones();
    const partyInPrologue = gs.zoneId === 'prologue';
    if (partyInPrologue) return all;
    return all.filter(z => z.id !== 'prologue');
  }

  // M65+: cross-zone connectors. If the party is standing on the first node of
  // a zone, they can step back to the last node of the previous zone (and the
  // reverse for the last node). "Previous/next" is taken in ALL_ZONES order so
  // this naturally bridges act boundaries as well as intra-act zoneIndex jumps.
  // M311 (issue 10): restore previous zone to the last-visited node via
  //   GameState.getZoneNode rather than always landing on the zone's last node.
  _getCrossZoneLink() {
    const gs = GameState.get();
    const zone = this._zone;
    if (!zone || zone.id !== gs.zoneId) return null;
    const nodes = zone.nodes;
    if (!nodes || nodes.length === 0) return null;
    const firstNode = nodes[0];
    const lastNode = nodes[nodes.length - 1];
    const unlocked = gs.unlockedZones || ['border_roads'];
    const zoneIdx = ALL_ZONES.findIndex(z => z.id === zone.id);
    const links = [];
    if (gs.nodeId === firstNode.id && zoneIdx > 0) {
      const prev = ALL_ZONES[zoneIdx - 1];
      if (unlocked.includes(prev.id)) {
        // M311: land on the last-visited position in the previous zone if known.
        const savedNodeId = GameState.getZoneNode(prev.id);
        const savedNode = savedNodeId ? prev.nodes.find(n => n.id === savedNodeId) : null;
        const targetNode = savedNode || prev.nodes[prev.nodes.length - 1];
        links.push({ side: 'left', zone: prev, node: targetNode, anchor: firstNode });
      }
    }
    if (gs.nodeId === lastNode.id && zoneIdx < ALL_ZONES.length - 1) {
      const next = ALL_ZONES[zoneIdx + 1];
      if (unlocked.includes(next.id)) {
        const targetNode = next.nodes[0];
        links.push({ side: 'right', zone: next, node: targetNode, anchor: lastNode });
      }
    }
    return links.length ? links : null;
  }

  _drawCrossZoneLinks(ctx, w, h) {
    const links = this._getCrossZoneLink();
    // M311 (issue 9): left-side "back" link uses a DOM floating popup.
    // M414c: right-side "forward" link now uses the same DOM popup pattern
    // so the user gets an explicit "Travel forward to {Zone}" dialog with an
    // OK button instead of a canvas-rendered edge label. Canvas still draws
    // the dashed arrow line for both sides.
    this._updateCrossZoneBackPopup(links, w, h);
    this._updateCrossZoneForwardPopup(links, w, h);
    if (!links) return;
    this._crossZoneHit = [];
    for (const link of links) {
      const anchorPos = this._nodePos(link.anchor, w, h);
      const edgeX = link.side === 'left' ? 0 : w;
      const midY = anchorPos.y;

      ctx.save();
      // Glowing dashed line from anchor to off-screen edge
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#e8c060';
      ctx.strokeStyle = 'rgba(232,192,96,0.9)';
      ctx.lineWidth = 3;
      const dashOffset = (this._t * 30) % 16;
      ctx.lineDashOffset = -dashOffset;
      ctx.setLineDash([10, 6]);
      ctx.beginPath();
      ctx.moveTo(anchorPos.x, anchorPos.y);
      ctx.lineTo(edgeX, midY);
      ctx.stroke();
      ctx.restore();

      // Both sides handled by DOM popups (back + forward). Canvas only
      // draws the dashed arrow above; popup handles label + interaction.
    }
  }

  // M311 (issue 9): floating DOM popup for "travel back" shown below (or above)
  // the player node. Avoids covering other map nodes. Viewport-aware: tries
  // below first, then above, then keeps it within bounds.
  _updateCrossZoneBackPopup(links, canvasW, canvasH) {
    const wrap = this._el?.querySelector('.map-canvas-wrap');
    if (!wrap) return;

    // Remove any stale popup first.
    let popup = wrap.querySelector('#czb-back-popup');
    const backLink = links && links.find(l => l.side === 'left');
    if (!backLink) {
      if (popup) popup.remove();
      return;
    }

    // Create popup if not present.
    if (!popup) {
      popup = document.createElement('div');
      popup.id = 'czb-back-popup';
      popup.className = 'czb-back-popup';
      popup.innerHTML = '';
      wrap.appendChild(popup);
    }

    // M367 fix: previously this function reset innerHTML every frame, which
    // discarded the OK button mid-click — pressing OK appeared to do nothing
    // because the button element was replaced between mousedown and click.
    // Now: only rewrite content if the destination zone actually changed,
    // and stash the link on the popup so the persistent click handler always
    // jumps to the right place even after re-renders.
    popup._backLink = backLink;
    const zoneName = backLink.zone.name;
    const zoneId = backLink.zone.id;
    if (popup.dataset.zoneId !== zoneId) {
      popup.innerHTML =
        `<span class="czb-label">Travel back to <strong>${zoneName}</strong></span>` +
        `<button type="button" class="czb-ok-btn" id="czb-ok">OK</button>`;
      popup.dataset.zoneId = zoneId;
      popup.querySelector('#czb-ok').addEventListener('click', () => {
        this.audio.playSfx('click');
        const link = popup._backLink;
        if (link) this._crossZoneJump(link);
      });
    }

    // M450: position relative to canvas CSS box (full content), not the
    // viewport-clipped wrap. Same bug as the forward popup.
    const canvasEl = wrap.querySelector('canvas');
    const cssCanvasW = canvasEl ? (canvasEl.clientWidth || canvasW) : canvasW;
    const cssCanvasH = canvasEl ? (canvasEl.clientHeight || canvasH) : canvasH;
    const scaleX = cssCanvasW / canvasW;
    const scaleY = cssCanvasH / canvasH;
    const anchorPos = this._nodePos(backLink.anchor, canvasW, canvasH);
    const nodeCx = anchorPos.x * scaleX;
    const nodeCy = anchorPos.y * scaleY;

    // Popup approximate dimensions before paint \u2014 estimate, then clamp.
    const popW = Math.min(260, wrap.clientWidth - 16);
    const popH = 68; // approx height in px
    const nodeR = 18; // node visual radius
    // M322: bump the gap below the anchor so the popup clears the node's
    // label text instead of colliding with it.
    const gap = 23;

    let top, left;
    left = nodeCx - popW / 2;

    // Try below node first.
    const tryBelow = nodeCy + nodeR + gap;
    const tryAbove = nodeCy - nodeR - gap - popH;

    if (tryBelow + popH <= cssCanvasH - 4) {
      top = tryBelow;
    } else if (tryAbove >= 4) {
      top = tryAbove;
    } else {
      top = Math.max(4, Math.min(tryBelow, cssCanvasH - popH - 4));
    }

    // M450: clamp within the canvas content box (not viewport) so the
    // popup sits next to the anchor, not the visible-viewport edge.
    left = Math.max(8, Math.min(left, cssCanvasW - popW - 8));

    popup.style.width = popW + 'px';
    popup.style.left = left + 'px';
    popup.style.top = top + 'px';
  }

  // M414c — symmetric DOM popup for the "forward" cross-zone link. Mirrors
  // the back-popup behavior: a "Travel forward to {NextZone}" label + OK
  // button anchored to the boss/last node, viewport-clamped, removed when
  // the player walks away from the last node.
  _updateCrossZoneForwardPopup(links, canvasW, canvasH) {
    const wrap = this._el?.querySelector('.map-canvas-wrap');
    if (!wrap) return;
    let popup = wrap.querySelector('#czb-fwd-popup');
    const fwdLink = links && links.find(l => l.side === 'right');
    if (!fwdLink) {
      if (popup) popup.remove();
      return;
    }
    if (!popup) {
      popup = document.createElement('div');
      popup.id = 'czb-fwd-popup';
      popup.className = 'czb-back-popup czb-fwd-popup';
      wrap.appendChild(popup);
    }
    popup._fwdLink = fwdLink;
    const zoneName = fwdLink.zone.name;
    const zoneId = fwdLink.zone.id;
    if (popup.dataset.zoneId !== zoneId) {
      popup.innerHTML =
        `<span class="czb-label">Travel forward to <strong>${zoneName}</strong></span>` +
        `<button type="button" class="czb-ok-btn" id="czb-fwd-ok">OK</button>`;
      popup.dataset.zoneId = zoneId;
      popup.querySelector('#czb-fwd-ok').addEventListener('click', () => {
        this.audio.playSfx('click');
        const link = popup._fwdLink;
        if (link) this._crossZoneJump(link);
      });
    }
    // M450 — scroll-aware positioning. The popup is position:absolute
    // inside .map-canvas-wrap, so its `left` is relative to the wrap's
    // CONTENT BOX (which equals the canvas CSS width — wider than the
    // visible viewport when MIN_CANVAS_W kicks in on mobile). Previously
    // we rescaled anchor.x by wrap.clientWidth/canvasW, which gave a
    // viewport-relative number and made the popup land far to the LEFT of
    // the boss — or, after clamping, pinned to the visible-viewport right
    // edge instead of the map's right edge.
    //
    // Correct math: the canvas is rendered at CSS width = canvas.style.width
    // ≈ canvas.width (1:1 mapping enforced in _build). Treat anchor.x as
    // canvas-CSS-px directly. The clamp uses the wrap's SCROLL WIDTH (full
    // content) instead of clientWidth.
    const canvasEl = wrap.querySelector('canvas');
    const cssCanvasW = canvasEl ? (canvasEl.clientWidth || canvasW) : canvasW;
    const cssCanvasH = canvasEl ? (canvasEl.clientHeight || canvasH) : canvasH;
    const scaleX = cssCanvasW / canvasW;
    const scaleY = cssCanvasH / canvasH;
    const anchorPos = this._nodePos(fwdLink.anchor, canvasW, canvasH);
    const nodeCx = anchorPos.x * scaleX;
    const nodeCy = anchorPos.y * scaleY;
    const popW = Math.min(260, wrap.clientWidth - 16);
    const popH = 68;
    const nodeR = 18;
    const gap = 23;
    let left = nodeCx - popW / 2;
    const tryBelow = nodeCy + nodeR + gap;
    const tryAbove = nodeCy - nodeR - gap - popH;
    let top;
    if (tryBelow + popH <= cssCanvasH - 4) top = tryBelow;
    else if (tryAbove >= 4) top = tryAbove;
    else top = Math.max(4, Math.min(tryBelow, cssCanvasH - popH - 4));
    // Clamp left within the FULL canvas content box, not just the visible
    // viewport. So the popup sits next to the boss node regardless of
    // current scroll.
    left = Math.max(8, Math.min(left, cssCanvasW - popW - 8));
    popup.style.width = popW + 'px';
    popup.style.left = left + 'px';
    popup.style.top = top + 'px';
  }

  _build() {
    injectStyles('map-styles', MAP_STYLES);
    this._el = createEl('div', 'map-screen');
    const unlockedZones = this._getVisibleZoneTabs();

    const _gsTop = GameState.get();
    // M65: use the party's ACTUAL zone (not the currently viewed tab) to decide
    // whether we're at the act's starting node. Previously, switching zone tabs
    // hid the Back-to-Town button even when the party itself hadn't moved.
    const _partyZone = ALL_ZONES.find(z => z.id === _gsTop.zoneId) || this._zone;
    // M65: "Back to Town" is only valid when standing on an actual town node.
    // Previously this fired on the first node of any zone, which made return-
    // to-town inconsistent (sometimes available, sometimes not depending on
    // which zone you were in). Portals remain the way to leave non-town zones.
    const _currentNode = _partyZone.nodes.find(n => n.id === _gsTop.nodeId);
    const _atStart = _currentNode?.type === 'town';
    this._el.innerHTML = `
      <div class="map-header">
        <div class="map-header-row">
          ${(() => {
            // M279: always-available Inventory + Town buttons (left), Menu (right).
            // Player can manage party/inventory mid-overworld without quitting to
            // main menu. Old "Back to Town" button is replaced by the new Town
            // button (same effect when standing on a town node).
            const gs = GameState.get();
            const pending = [...gs.party, ...gs.companions, ...gs.bench]
              .filter(m => !(m.isCompanion || m.class === 'companion'))
              .reduce((s,m) => s + (m.pendingAttrPoints||0) + (m.pendingSkillPoints||0) + (m.pendingPassivePoints||0), 0);
            const partyBadge = pending > 0
              ? ` <span class="map-hdr-badge" style="background:#c04030;color:#fff;font-size:0.55rem;padding:0.1rem 0.3rem;border-radius:8px;margin-left:0.3rem">${pending}</span>`
              : '';
            // M335: Town badge counts unread unlocks + completed-untaken quests
            // — NOT skill points. Skill points belong to the Party button only.
            const newUnlocks  = gs._townNewBadge?.unlocks || 0;
            const questsReady = (gs.quests || []).filter(q => q && q.complete && !q.turnedIn).length;
            const townN = newUnlocks + questsReady;
            const townBadge = townN > 0
              ? ` <span class="map-hdr-badge" style="background:#c04030;color:#fff;font-size:0.55rem;padding:0.1rem 0.3rem;border-radius:8px;margin-left:0.3rem">${townN}</span>`
              : '';
            const townBtnLabel = _atStart ? `← Back to Town${townBadge}` : `Town${townBadge}`;
            const townBtnDisabled = _atStart ? '' : 'disabled title="Walk back to a town node first"';
            return `
              <button type="button" class="map-toolbtn" id="map-inv" aria-label="Open party panel">Party${partyBadge}</button>
              <button type="button" class="map-back" id="map-town" ${townBtnDisabled}>${townBtnLabel}</button>
              <button type="button" class="map-toolbtn" id="map-menu" title="Menu">☰ Menu</button>
            `;
          })()}
          <div class="map-act-tag" style="flex:1;text-align:right;">${ACT_LABELS[this._zone.act] || 'Act I'}</div>
        </div>
        <div class="map-zone-tabs" id="map-zone-tabs">
          ${(() => {
            const gs = GameState.get();
            // M382: NG+ always uses the dropdown — once the player has crossed
            // the wrap-around once, the tab strip starts mixing prologue/Act 1
            // sub-zones with carry-over unlocks and the layout looks legacy.
            const _isNgPlus = (typeof GameState.getNgPlus === 'function' && GameState.getNgPlus() > 0);
            if (unlockedZones.length >= 4 || _isNgPlus) {
              // M294: dropdown for 4+ zones (tabs don't fit on phone at this count)
              const opts = unlockedZones.map(z => {
                const isNew = !gs.visitedNodes || ![...gs.visitedNodes].some(id => z.nodes.some(n => n.id === id));
                const isPartyHere = z.id === gs.zoneId;
                const prefix = isPartyHere ? '★ ' : '';
                const suffix = (isNew && z.id !== this._zone.id) ? ' [NEW]' : '';
                return `<option value="${z.id}"${z.id === this._zone.id ? ' selected' : ''}>${prefix}${z.name}${suffix}</option>`;
              }).join('');
              return `<select class="mzt-dropdown" id="mzt-dropdown" aria-label="Select zone">${opts}</select>`;
            }
            // Original tab buttons for 1-3 zones
            return unlockedZones.map(z => {
              const isNew = !gs.visitedNodes || ![...gs.visitedNodes].some(id => z.nodes.some(n => n.id === id));
              const isPartyHere = z.id === gs.zoneId;
              const star = isPartyHere ? '<span class="mzt-star" aria-label="Current zone" title="Current zone">&#9733;</span> ' : '';
              return `<button type="button" class="mzt${z.id === this._zone.id ? ' active' : ''}${isNew && z.id !== this._zone.id ? ' mzt-new' : ''}" data-zone="${z.id}">${star}${z.name}${isNew && z.id !== this._zone.id ? ' <span class="mzt-badge">NEW</span>' : ''}</button>`;
            }).join('');
          })()}
        </div>
      </div>
      <div class="map-canvas-wrap">
        <canvas id="map-canvas"></canvas>
        <div id="map-node-tooltip" class="map-node-tooltip" style="display:none"></div>
      </div>
      ${this._renderPortalBar()}
      <div class="map-legend">
        ${Object.entries(NODE_ICONS).map(([type, info]) =>
          `<div class="legend-item"><div class="legend-dot" style="background:${info.color}"></div><span>${info.label}</span></div>`
        ).join('')}
      </div>
    `;
    this.manager.uiOverlay.appendChild(this._el);

    // M279: split former "Back to Town" into Town + Inventory + Menu trio.
    this._el.querySelector('#map-town')?.addEventListener('click', () => {
      this.audio.playSfx('click');
      this.manager.pop();
    });
    this._el.querySelector('#map-inv')?.addEventListener('click', async () => {
      this.audio.playSfx('click');
      try {
        const { PartyPanelScreen } = await import('./PartyPanelScreen.js');
        this.manager.push(new PartyPanelScreen(this.manager, this.audio));
      } catch (e) { console.warn('PartyPanelScreen open failed', e); }
    });
    this._el.querySelector('#map-menu')?.addEventListener('click', async () => {
      this.audio.playSfx('click');
      try {
        const { GameMenuScreen } = await import('./GameMenuScreen.js');
        this.manager.push(new GameMenuScreen(this.manager, this.audio));
      } catch (e) { console.warn('GameMenuScreen open failed', e); }
    });

    // Portal bar buttons
    this._el.querySelector('#portal-use-btn')?.addEventListener('click', () => {
      this.audio.playSfx('click');
      const gs = GameState.get();
      // Consume a portal scroll
      const idx = (gs.potions || []).findIndex(p => p.id === 'portal_scroll');
      if (idx >= 0) gs.potions.splice(idx, 1);
      GameState.openPortal(gs.nodeId, gs.zoneId);
      // M71: route to NEAREST town in current zone, not zone-start.
      const nearest = findNearestTown(gs.zoneId, gs.nodeId);
      if (nearest) { gs.zoneId = nearest.zoneId; gs.nodeId = nearest.nodeId; GameState.setZoneNode(nearest.zoneId, nearest.nodeId); }
      this.manager.pop();
    });
    this._el.querySelector('#portal-return-btn')?.addEventListener('click', () => {
      this.audio.playSfx('click');
      const gs = GameState.get();
      const nearest = findNearestTown(gs.zoneId, gs.nodeId);
      if (nearest) { gs.zoneId = nearest.zoneId; gs.nodeId = nearest.nodeId; GameState.setZoneNode(nearest.zoneId, nearest.nodeId); }
      this.manager.pop();
    });

    // M294: zone navigation handler — shared between tabs and dropdown.
    const _navigateToZone = (zoneId) => {
      const zone = ALL_ZONES.find(z => z.id === zoneId);
      if (!zone) return;
      this.audio.playSfx('click');
      // M56: persist current party position in old zone before viewing a different one
      const _gsOld = GameState.get();
      if (_gsOld.zoneId && _gsOld.nodeId && ALL_ZONES.find(z => z.id === _gsOld.zoneId)?.nodes.some(n => n.id === _gsOld.nodeId)) {
        GameState.setZoneNode(_gsOld.zoneId, _gsOld.nodeId);
      }
      // M56 bug fix: viewing another zone must NOT mutate the party's actual
      // zoneId/nodeId. Only change the locally-viewed zone.
      this._zone = zone;
      // Rebuild with new zone active
      removeEl(this._el);
      this._el = null;
      this._build();
    };

    this._el.querySelectorAll('.mzt').forEach(btn => {
      btn.addEventListener('click', () => _navigateToZone(btn.dataset.zone));
    });

    // M294: dropdown handler for 4+ unlocked zones
    const dropdown = this._el.querySelector('#mzt-dropdown');
    if (dropdown) {
      dropdown.addEventListener('change', () => _navigateToZone(dropdown.value));
      // Keyboard: Enter key also triggers navigation (select already handles arrow keys natively)
      dropdown.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); _navigateToZone(dropdown.value); }
      });
    }

    // Auto-scroll active zone tab into view — only applies when using tab buttons.
    // M294: skip when using dropdown (no .mzt.active exists then).
    const activeTab = this._el.querySelector('.mzt.active');
    if (activeTab) {
      const bar = activeTab.parentElement;
      if (bar && bar.scrollWidth > bar.clientWidth) {
        bar.scrollLeft = activeTab.offsetLeft - (bar.clientWidth - activeTab.offsetWidth) / 2;
      }
    }

    this._setupCanvas();

    // M297: keyboard navigation — vertical list covers zone tabs + HUD buttons.
    // The canvas itself is not keyboard-accessible (node selection is mouse/touch);
    // the HUD buttons (Town, Inventory, Menu) are all reachable via Tab.
    kbUnmount(this._el);
    kbMount(this._el, {
      layout: 'vertical',
      focusFirst: false,
      onEscape: null, // global ESC → GameMenuScreen
    });
  }

  _renderPortalBar() {
    const gs = GameState.get();
    const hasScroll = (gs.potions || []).some(p => p.id === 'portal_scroll');
    const portal = GameState.getPortal();
    const atPortalNode = portal && portal.nodeId === gs.nodeId && portal.zoneId === gs.zoneId;

    let buttons = '';
    if (atPortalNode) {
      buttons = `<button type="button" class="portal-bar-btn" id="portal-return-btn"><svg width="14" height="14" viewBox="0 0 14 14" style="vertical-align:-2px;margin-right:4px"><defs><radialGradient id="pbg1" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#5aa0ff"/><stop offset="60%" stop-color="#3070e0"/><stop offset="100%" stop-color="#1040a0"/></radialGradient></defs><circle cx="7" cy="7" r="5.5" fill="url(#pbg1)" stroke="#ffffff" stroke-width="1.2"/><ellipse cx="7" cy="7" rx="2.5" ry="4" fill="none" stroke="#ffffff" stroke-width="0.8" opacity="0.75"/></svg>Return to Town through Portal</button>`;
    } else if (hasScroll) {
      buttons = `<button type="button" class="portal-bar-btn" id="portal-use-btn">✦ Use Portal Scroll</button>`;
    }
    if (!buttons) return '';
    return `<div class="map-portal-bar">${buttons}</div>`;
  }

  _setupCanvas() {
    const wrap = this._el.querySelector('.map-canvas-wrap');
    const canvas = this._el.querySelector('#map-canvas');
    // M345/M347 — Per-zone minimum width. Prologue + small zones (≤6
    // nodes) fit on a single screen with no scroll; the regular FTL
    // 14-column zones get ~50px columns via a 700px floor.
    const nodeCount = (this._zone?.nodes || []).length;
    const isPrologue = this._zone?.id === 'prologue';
    const MIN_CANVAS_W = isPrologue ? 0 : (nodeCount <= 6 ? 0 : 700);
    const w = Math.max(wrap.clientWidth, MIN_CANVAS_W);
    canvas.width  = w;
    canvas.height = wrap.clientHeight;
    // Match the CSS pixel size so node hit-testing maps cleanly between
    // (event.clientX - rect.left) and canvas.width.
    canvas.style.width  = `${w}px`;
    canvas.style.height = `${wrap.clientHeight}px`;

    canvas.addEventListener('click', e => this._onClick(e, canvas));
    canvas.addEventListener('mousemove', e => this._onHover(e, canvas));
    canvas.addEventListener('mouseleave', () => { this._hovered = null; this._hideNodeTooltip(); });

    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');
    this._drawMap();
  }

  _nodePos(node, w, h) {
    return { x: node.x * w, y: node.y * h };
  }

  // M450 — scroll the map-canvas-wrap so the party's current node sits in
  // the horizontal center of the viewport. No-op if the canvas is no
  // wider than the wrap (nothing to scroll).
  _centerScrollOnPartyNode() {
    const wrap = this._el?.querySelector('.map-canvas-wrap');
    const canvas = this._el?.querySelector('#map-canvas');
    if (!wrap || !canvas) return;
    const gs = GameState.get();
    if (!gs?.nodeId) return;
    // Use whichever zone the party is actually in (gs.zoneId may differ
    // from the currently viewed tab).
    const partyZone = ALL_ZONES.find(z => z.id === gs.zoneId) || this._zone;
    if (!partyZone) return;
    const partyNode = (partyZone.nodes || []).find(n => n.id === gs.nodeId);
    if (!partyNode) return;
    // Only scroll if the canvas is wider than the visible viewport.
    const cssCanvasW = canvas.clientWidth || canvas.width;
    const wrapW = wrap.clientWidth;
    if (cssCanvasW <= wrapW + 4) return;
    const targetX = partyNode.x * cssCanvasW;
    const desired = Math.max(0, Math.min(cssCanvasW - wrapW, targetX - wrapW / 2));
    // Use 'auto' (no smooth) on the first paint — Safari sometimes drops
    // smooth scrolls fired before the canvas has laid out.
    wrap.scrollLeft = desired;
  }

  _buildSkyLayer(kind, w, h) {
    const c = (typeof OffscreenCanvas !== 'undefined')
      ? new OffscreenCanvas(Math.max(2, Math.floor(w)), Math.max(2, Math.floor(h)))
      : (() => { const el = document.createElement('canvas'); el.width = Math.max(2, Math.floor(w)); el.height = Math.max(2, Math.floor(h)); return el; })();
    const cx = c.getContext('2d');
    let seed = kind.charCodeAt(0) * 9973;
    const rand = () => { seed = (seed * 1664525 + 1013904223) | 0; return ((seed >>> 0) % 10000) / 10000; };
    if (kind === 'far') {
      // Distant star/dust haze
      cx.fillStyle = 'rgba(120,200,140,0.05)';
      cx.fillRect(0, 0, w, h * 0.6);
      cx.fillStyle = 'rgba(200,230,200,0.35)';
      for (let i = 0; i < 60; i++) {
        const x = rand() * w;
        const y = rand() * h * 0.7;
        cx.fillRect(x, y, 1, 1);
      }
    } else if (kind === 'mid') {
      // Soft cloud bands
      for (let i = 0; i < 10; i++) {
        const x = rand() * w;
        const y = rand() * h * 0.55;
        const r = 30 + rand() * 50;
        const grad = cx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, 'rgba(80,140,100,0.12)');
        grad.addColorStop(1, 'rgba(80,140,100,0)');
        cx.fillStyle = grad;
        cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2); cx.fill();
      }
    } else if (kind === 'near') {
      // Closer, faster wisps
      for (let i = 0; i < 6; i++) {
        const x = rand() * w;
        const y = rand() * h * 0.4;
        const rw = 40 + rand() * 70;
        const rh = 6 + rand() * 10;
        const grad = cx.createRadialGradient(x, y, 0, x, y, rw);
        grad.addColorStop(0, 'rgba(180,220,180,0.14)');
        grad.addColorStop(1, 'rgba(180,220,180,0)');
        cx.fillStyle = grad;
        cx.beginPath(); cx.ellipse(x, y, rw, rh, 0, 0, Math.PI * 2); cx.fill();
      }
    }
    return c;
  }

  _drawZoneBackground(ctx, w, h) {
    try {
      if (window.__gfxDisableBg) return;
      const zoneId = this._zone?.id;
      if (!zoneId) return;
      // M322: cache 404s per-zone so we don't re-fire image requests every
      // frame (the prologue zone in particular has no map_bg JPG yet, which
      // produced thousands of 404s per second of map idle).
      this._bgFailed = this._bgFailed || new Set();
      if (this._bgFailed.has(zoneId)) return;
      if (!this._bgImg || this._bgImg._zoneId !== zoneId) {
        const img = new Image();
        // Zones whose background art lives outside /images/map_bg/ (e.g. dragon expansion pack).
        const ZONE_BG_OVERRIDE = {
          dragons_reach: 'images/dragon_expansion/dragon_reach_bg.jpg',
          dragon_throne: 'images/dragon_expansion/dragon_throne_bg.jpg',
        };
        const rel = ZONE_BG_OVERRIDE[zoneId] || `images/map_bg/${zoneId}.jpg`;
        img.src = `${import.meta.env.BASE_URL}${rel}`;
        img._zoneId = zoneId;
        img.onerror = () => { this._bgFailed.add(zoneId); this._bgImg = null; };
        this._bgImg = img;
      }
      if (this._bgImg.complete && this._bgImg.naturalWidth > 0) {
        ctx.globalAlpha = 0.55;
        ctx.drawImage(this._bgImg, 0, 0, w, h);
        ctx.globalAlpha = 1;
        const dark = ctx.createLinearGradient(0, 0, 0, h);
        dark.addColorStop(0, 'rgba(5,8,10,0.45)');
        dark.addColorStop(1, 'rgba(5,8,10,0.75)');
        ctx.fillStyle = dark;
        ctx.fillRect(0, 0, w, h);
      }
    } catch (_) {}
  }

  _drawParallaxSky(ctx, w, h) {
    const key = `${Math.floor(w)}x${Math.floor(h)}`;
    if (!this._parallaxCache || this._parallaxCache.key !== key) {
      this._parallaxCache = {
        key,
        far: this._buildSkyLayer('far', w, h),
        near: this._buildSkyLayer('near', w, h),
      };
    }
    const t = this._t || 0;
    const speeds = { far: 2, mid: 6, near: 14 };
    const alphas = { far: 0.6, mid: 0.85, near: 1 };
    for (const k of ['far', 'near']) {
      const layer = this._parallaxCache[k];
      if (!layer) continue;
      let ox = (t * speeds[k]) % w;
      if (ox < 0) ox += w;
      const bob = Math.sin(t * 0.3 + (k === 'mid' ? 1 : k === 'near' ? 2 : 0)) * 2;
      ctx.globalAlpha = alphas[k];
      ctx.drawImage(layer, -ox, bob);
      ctx.drawImage(layer, w - ox, bob);
      ctx.globalAlpha = 1;
    }
  }

  _drawMap() {
    const ctx = this._ctx;
    const w = this._canvas.width;
    const h = this._canvas.height;
    const gs = GameState.get();

    // Background
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#080e08');
    bg.addColorStop(1, '#0d180e');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    this._drawZoneBackground(ctx, w, h);

    // Grid overlay
    ctx.strokeStyle = 'rgba(64,168,96,0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

    const zone = this._zone;

    // Reset cross-zone hit list; populated by _drawCrossZoneLinks below.
    this._crossZoneHit = [];

    // Draw edges first
    const currentNodeId = gs.nodeId;
    const currentNode = zone.nodes.find(n => n.id === currentNodeId);
    const forwardExits = new Set(currentNode?.exits || []);
    // M280 Fog of War: when enabled, only nodes adjacent to a visited node are
    // revealed. Once revealed, stay revealed (we union the set across draws).
    const fogOn = !!gs.fogOfWar;
    const revealedSet = fogOn ? this._computeRevealed(zone, gs) : null;
    const isRevealed = (id) => !fogOn || revealedSet.has(id);

    for (const node of zone.nodes) {
      const from = this._nodePos(node, w, h);
      // Skip drawing edges OUT of a hidden+locked node (its node won't render).
      if (node.hidden && !isHiddenNodeUnlocked(node, gs)) continue;
      for (const exitId of node.exits) {
        const toNode = zone.nodes.find(n => n.id === exitId);
        if (!toNode) continue;
        // Skip edges INTO a hidden+locked target — otherwise we draw a stray
        // dotted line out to a node that never renders (the M64+ "stray
        // connection that goes south to a non-existing node" bug).
        if (toNode.hidden && !isHiddenNodeUnlocked(toNode, gs)) continue;
        // Hide edges where either endpoint is fogged.
        if (!isRevealed(node.id) || !isRevealed(exitId)) continue;
        const to = this._nodePos(toNode, w, h);
        const fromVisited = gs.visitedNodes?.has(node.id);
        const toVisited = gs.visitedNodes?.has(exitId);
        const isForward = node.id === currentNodeId && !toVisited;
        const isBothVisited = fromVisited && toVisited;

        ctx.save();
        if (isForward) {
          // Glowing forward-available path
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#e8c060';
          ctx.strokeStyle = 'rgba(232,192,96,0.85)';
          ctx.lineWidth = 2.5;
          const dashOffset = (this._t * 30) % 16;
          ctx.lineDashOffset = -dashOffset;
          ctx.setLineDash([8, 8]);
        } else if (isBothVisited) {
          ctx.strokeStyle = 'rgba(72,184,108,0.7)';
          ctx.lineWidth = 2.2;
          ctx.setLineDash([]);
        } else {
          // M322: bump opacity, width, and dash size so unvisited connections
          // are actually readable against the map background. Old 0.25/1px
          // dashes effectively vanished on busy zones.
          ctx.strokeStyle = 'rgba(180,150,100,0.55)';
          ctx.lineWidth = 1.6;
          ctx.setLineDash([6, 5]);
        }
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        ctx.restore();
        ctx.setLineDash([]);
      }
    }

    // Draw nodes
    for (const node of zone.nodes) {
      // Skip fogged nodes entirely.
      if (!isRevealed(node.id)) continue;
      // M304: skip hidden boss nodes whose precondition is not yet met
      if (node.hidden && !isHiddenNodeUnlocked(node, gs)) continue;
      const pos = this._nodePos(node, w, h);
      const info = NODE_ICONS[node.type] || { color: '#8a7a6a', label: node.type };
      const visited = gs.visitedNodes?.has(node.id);
      const isCurrent = gs.nodeId === node.id;
      const isHovered = this._hovered === node.id;
      const isAccessible = this._isAccessible(node, zone, gs);

      // Node glow
      if (isCurrent || isHovered) {
        const glow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 30);
        glow.addColorStop(0, `${info.color}40`);
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 30, 0, Math.PI * 2);
        ctx.fill();
      }

      // Node circle
      const radius = node.type === NODE_TYPES.BOSS ? 18 : node.type === NODE_TYPES.TOWN ? 16 : 13;
      // M18: blue fast-travel ring around visited towns in the active zone.
      if (node.type === NODE_TYPES.TOWN && visited && this._zone.id === gs.zoneId) {
        ctx.save();
        const pulse = 0.6 + 0.4 * Math.sin(this._t * 3);
        ctx.strokeStyle = `rgba(96,160,232,${0.55 * pulse})`;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#5aa0ff';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.save();
      ctx.globalAlpha = isAccessible || visited ? 1 : 0.35;
      ctx.fillStyle = visited ? info.color : isCurrent ? info.color : 'rgba(20,15,10,0.9)';
      ctx.strokeStyle = info.color;
      ctx.lineWidth = isCurrent ? 3 : isHovered ? 2.5 : 1.5;
      ctx.shadowBlur = isCurrent ? 15 : isHovered ? 10 : 0;
      ctx.shadowColor = info.color;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Node icon / letter
      // M473: When the node fill is the colored info.color (visited OR
      // isCurrent — e.g. after revive-at-town where the player is current
      // but the town isn't flagged visited yet), the letter must be dark
      // for contrast. Otherwise (unvisited & inactive), the circle is dark
      // and the letter takes the type color.
      const _filledCircle = visited || isCurrent;
      ctx.fillStyle = _filledCircle ? '#0a0608' : info.color;
      ctx.font = `bold ${radius * 0.85}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // M337 — prefer the per-type glyph from NODE_ICONS so Shrine / Challenge
      // / Skill Check / Dungeon read at a glance with distinct symbols
      // instead of all sharing 'C' / 'S'. Default to the first letter.
      const letter = info.glyph
        || (node.type === NODE_TYPES.BOSS ? 'B'
          : node.type === NODE_TYPES.TOWN ? 'T'
          : node.type[0].toUpperCase());
      ctx.fillText(letter, pos.x, pos.y);

      // M359: completed-dialog checkmark badge. Once a dialog event has
      // been resolved, draw a small green check on the node so the player
      // knows they don't need to revisit.
      if (node.type === NODE_TYPES.DIALOG && gs.seenEvents?.includes?.(node.id)) {
        ctx.save();
        ctx.fillStyle = '#40c860';
        ctx.beginPath();
        ctx.arc(pos.x + radius - 2, pos.y - radius + 2, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0a0608';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pos.x + radius - 5, pos.y - radius + 2);
        ctx.lineTo(pos.x + radius - 3, pos.y - radius + 4);
        ctx.lineTo(pos.x + radius + 1, pos.y - radius - 1);
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = '#0a0608';
        ctx.stroke();
        ctx.restore();
      }

      // Node label — M322: add a dark text shadow so labels stay legible
      // against bright map backgrounds (the old transparent fillStyle vs.
      // sun-lit zone art was unreadable).
      ctx.fillStyle = isAccessible ? '#f0e8d8' : '#a8988a';
      ctx.font = `${radius < 14 ? '10' : '11'}px Inter, sans-serif`;
      ctx.shadowBlur = 4;
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.fillText(this._displayedNodeName(node), pos.x, pos.y + radius + 13);
      ctx.shadowBlur = 0;

      ctx.restore();
    }

    // Current position indicator (animated if traveling)
    // M56 bug fix: only draw on the party's actual zone, not every tab viewed.
    const isPartyZone = zone.id === gs.zoneId;
    const current = isPartyZone ? zone.nodes.find(n => n.id === gs.nodeId) : null;
    let markerPos = null;
    if (this._travel && isPartyZone) {
      const tt = Math.min(1, this._travel.elapsed / this._travel.duration);
      // easeInOutQuad
      const eased = tt < 0.5 ? 2 * tt * tt : 1 - Math.pow(-2 * tt + 2, 2) / 2;
      markerPos = {
        x: this._travel.from.x + (this._travel.to.x - this._travel.from.x) * eased,
        y: this._travel.from.y + (this._travel.to.y - this._travel.from.y) * eased,
      };
    } else if (current) {
      markerPos = this._nodePos(current, w, h);
    }
    if (markerPos) {
      ctx.save();
      ctx.fillStyle = '#f0e8d8';
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#e8a020';
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('★', markerPos.x, markerPos.y - 26);
      ctx.restore();
    }

    // M347 — Traveling overlay moved to a fixed-position DOM element so it
    // stays centered on the viewport (not the scrolled canvas width).
    // Previously the canvas-drawn label was anchored to canvas-x = w/2,
    // which on iPhone-portrait scrolled off-screen as the user dragged
    // the map. The DOM element is created/removed in _updateTravelLabel.
    this._updateTravelLabel();

    // Portal indicator
    const portal = GameState.getPortal();
    if (portal && portal.zoneId === zone.id) {
      const portalNode = zone.nodes.find(n => n.id === portal.nodeId);
      if (portalNode) {
        const pos = this._nodePos(portalNode, w, h);
        const pulse = 0.6 + 0.4 * Math.sin(this._t * 4);
        const cx = pos.x + 16, cy = pos.y - 16, pr = 9;
        ctx.save();
        const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 22);
        glow.addColorStop(0, `rgba(90,160,255,${0.55 * pulse})`);
        glow.addColorStop(0.6, `rgba(48,112,224,${0.2 * pulse})`);
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, cy, 22, 0, Math.PI * 2);
        ctx.fill();
        const body = ctx.createRadialGradient(cx - 2, cy - 2, 1, cx, cy, pr);
        body.addColorStop(0, '#6ab0ff');
        body.addColorStop(0.55, '#3070e0');
        body.addColorStop(1, '#1040a0');
        ctx.fillStyle = body;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#5aa0ff';
        ctx.beginPath();
        ctx.arc(cx, cy, pr, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = `rgba(255,255,255,${0.9 * pulse})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(cx, cy, pr, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${0.7 * pulse})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(cx, cy, pr * 0.45, pr * 0.8, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Cross-zone connectors (drawn last so they overlay everything)
    this._drawCrossZoneLinks(ctx, w, h);
  }

  /**
   * M280 Fog of War — set of node ids visible in this zone.
   *   - All visited nodes are revealed.
   *   - Nodes adjacent to a visited node (one hop) are revealed.
   *   - Once revealed, persisted into `gs.fogRevealed[zoneId]` so a later
   *     change to graph topology doesn't re-fog something.
   * Town/boss markers obey the same rule (per user spec — full fog).
   */
  _computeRevealed(zone, gs) {
    if (!gs.fogRevealed) gs.fogRevealed = {};
    const persisted = new Set(gs.fogRevealed[zone.id] || []);
    const visited = gs.visitedNodes || new Set();
    for (const node of zone.nodes) {
      if (visited.has(node.id)) {
        persisted.add(node.id);
        for (const exitId of node.exits || []) persisted.add(exitId);
      }
    }
    // Always reveal the current node + its exits (so the player can see where
    // they are even on a brand-new zone).
    if (gs.nodeId) {
      persisted.add(gs.nodeId);
      const cur = zone.nodes.find(n => n.id === gs.nodeId);
      for (const exitId of cur?.exits || []) persisted.add(exitId);
    }
    gs.fogRevealed[zone.id] = [...persisted];
    return persisted;
  }

  _isAccessible(node, zone, gs) {
    // M49: node-by-node travel — only current node + its direct exits are reachable.
    if (gs.nodeId === node.id) return true;
    if (gs.nodeId) {
      const current = zone.nodes.find(n => n.id === gs.nodeId);
      if (current) {
        if (current.exits?.includes(node.id)) return true;
        // Bidirectional: allow travel back along an exit even if only current → node is listed.
        if (node.exits?.includes(gs.nodeId)) return true;
        return false;
      }
      // M56: nodeId is stale (different zone or post-defeat) — allow first node of this zone.
      if (zone.nodes[0]?.id === node.id) return true;
      return false;
    }
    if (!gs.nodeId && zone.nodes[0]?.id === node.id) return true;
    return false;
  }

  _onClick(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);
    const gs = GameState.get();
    if (this._travel) return; // input disabled while traveling

    // Cross-zone connector hit test (off-screen labels on left/right edges)
    if (this._crossZoneHit && this._crossZoneHit.length) {
      for (const hit of this._crossZoneHit) {
        if (mx >= hit.x && mx <= hit.x + hit.w && my >= hit.y && my <= hit.y + hit.h) {
          this.audio.playSfx('click');
          this._crossZoneJump(hit.link);
          return;
        }
      }
    }

    for (const node of this._zone.nodes) {
      // M304: hidden nodes that aren't unlocked are invisible — skip click hits
      if (node.hidden && !isHiddenNodeUnlocked(node, gs)) continue;
      const pos = this._nodePos(node, canvas.width, canvas.height);
      const dist = Math.hypot(mx - pos.x, my - pos.y);
      const radius = node.type === NODE_TYPES.BOSS ? 18 : 14;
      if (dist <= radius + 8) {
        // M18: fast-travel — towns only. Clicking a TOWN node teleports the
        // party directly (no travel animation, no edge-walk requirement) as
        // long as the target is in the party's current zone tab. On Hard
        // difficulty, fast-travel is restricted to visited towns only.
        if (node.type === NODE_TYPES.TOWN && this._zone.id === gs.zoneId && node.id !== gs.nodeId) {
          let difficulty = '';
          try { difficulty = (localStorage.getItem('emberveil_difficulty') || '').toLowerCase(); } catch (_) { /* localStorage unavailable */ }
          const visited = gs.visitedNodes?.has(node.id);
          if (difficulty === 'hard' && !visited) {
            // Hard mode: cannot fast-travel to an unvisited town. Fall through
            // to normal accessibility check below (walk via adjacency).
          } else {
            this.audio.playSfx('click');
            // M335: animate the star to the destination first; the update
            // loop fires _navigateToNode on travel completion. Previously
            // this jumped straight into the town dialog with no animation.
            this._startTravel(node);
            return;
          }
        }
        if (!this._isAccessible(node, this._zone, gs)) return;
        if (node.id === gs.nodeId) { this._navigateToNode(node); return; }
        // M56: revisited combat/ambush — offer sneak skill-check variants
        const isRevisitCombat = (node.type === NODE_TYPES.COMBAT || node.type === NODE_TYPES.AMBUSH)
          && gs.visitedNodes?.has(node.id);
        if (isRevisitCombat) {
          this.audio.playSfx('click');
          this._showSneakPrompt(node);
          return;
        }
        this.audio.playSfx('click');
        this._startTravel(node);
        return;
      }
    }
  }

  _sneakOptionsFor(node) {
    // Deterministic variant pick by node id hash, so each revisit node feels distinct.
    let h = 0;
    for (let i = 0; i < node.id.length; i++) h = ((h << 5) - h + node.id.charCodeAt(i)) | 0;
    const abs = Math.abs(h);
    const ALL = [
      { stat: 'DEX', label: 'Slip past unseen',     flavor: 'Weave through shadows and blind spots.' },
      { stat: 'INT', label: 'Misdirect their watch', flavor: 'Lure their attention elsewhere.' },
      { stat: 'STR', label: 'Silence a lone sentry', flavor: 'A quick, quiet takedown clears a path.' },
      { stat: 'CON', label: 'Endure the long way',   flavor: 'Skirt the site through hostile terrain.' },
    ];
    // 2 or 3 options based on hash, with varying DCs scaled by act
    const act = this._zone.act || 1;
    const baseDc = 10 + act * 2; // act1=12, act5=20
    const variants = [
      [0, 1],          // DEX + INT
      [0, 2],          // DEX + STR
      [1, 3],          // INT + CON
      [0, 1, 2],       // DEX + INT + STR
      [0, 2, 3],       // DEX + STR + CON
      [1, 2, 3],       // INT + STR + CON
    ];
    const pick = variants[abs % variants.length];
    return pick.map((idx, i) => ({
      ...ALL[idx],
      dc: baseDc + ((abs >> (i + 1)) & 3) - 1, // +-1..+2 jitter
    }));
  }

  _showSneakPrompt(node) {
    const gs = GameState.get();
    const partyOnly = gs.party || [];
    const opts = this._sneakOptionsFor(node);

    const modal = createEl('div', 'sneak-modal');
    modal.innerHTML = `
      <div class="sn-overlay"></div>
      <div class="sn-box">
        <div class="sn-title">Previously Cleared</div>
        <div class="sn-sub">${node.name} — the enemies here are back, but weaker and distracted. You can try to slip past.</div>
        <div class="sn-opts">
          ${opts.map((o, i) => {
            const maxStat = Math.max(0, ...partyOnly.map(m => m?.attrs?.[o.stat] || 0));
            const disabled = maxStat <= 0;
            return `<button type="button" class="sn-opt${disabled ? ' disabled' : ''}" data-idx="${i}"${disabled ? ' disabled' : ''}>
              <span class="sn-badge">${o.stat} ${o.dc}</span>
              <span class="sn-lbl">${o.label}</span>
              <span class="sn-flavor">${o.flavor}</span>
            </button>`;
          }).join('')}
          <button type="button" class="sn-opt sn-fight" data-idx="fight">
            <span class="sn-badge sn-badge-red">FIGHT</span>
            <span class="sn-lbl">Engage them directly</span>
            <span class="sn-flavor">Full combat — reduced rewards on cleared nodes.</span>
          </button>
          <button type="button" class="sn-opt sn-cancel" data-idx="cancel">
            <span class="sn-lbl">Cancel</span>
          </button>
        </div>
      </div>
    `;
    this.manager.uiOverlay.appendChild(modal);

    if (!document.getElementById('sneak-modal-styles')) {
      const s = document.createElement('style');
      s.id = 'sneak-modal-styles';
      s.textContent = `
        .sneak-modal{position:absolute;inset:0;z-index:600;display:flex;align-items:center;justify-content:center;font-family:'Inter',sans-serif}
        .sn-overlay{position:absolute;inset:0;background:rgba(0,0,0,0.75)}
        .sn-box{position:relative;z-index:1;background:#1a1218;border:1px solid rgba(232,160,32,0.35);border-radius:10px;padding:1.25rem;min-width:290px;max-width:360px;width:92%}
        .sn-title{font-family:'Cinzel',serif;font-size:1.05rem;font-weight:700;color:#e8a020;text-align:center;letter-spacing:0.06em}
        .sn-sub{font-size:0.75rem;color:#c0b8a8;margin:0.4rem 0 0.9rem;text-align:center;line-height:1.35}
        .sn-opts{display:flex;flex-direction:column;gap:0.45rem}
        .sn-opt{display:flex;flex-direction:column;gap:0.15rem;padding:0.55rem 0.75rem;background:rgba(26,18,24,0.9);border:1px solid rgba(232,160,32,0.2);border-radius:6px;color:#f0e8d8;cursor:pointer;text-align:left;min-height:48px}
        .sn-opt:hover:not(.disabled){border-color:rgba(232,160,32,0.55);background:rgba(40,26,34,0.95)}
        .sn-opt.disabled{opacity:0.4;cursor:not-allowed}
        .sn-badge{align-self:flex-start;font-size:0.62rem;font-weight:700;letter-spacing:0.08em;padding:0.12rem 0.4rem;background:rgba(64,120,160,0.25);border:1px solid rgba(96,160,200,0.5);color:#8ac0e8;border-radius:3px}
        .sn-badge-red{background:rgba(192,64,48,0.18);border-color:rgba(192,64,48,0.55);color:#e87060}
        .sn-lbl{font-size:0.85rem;font-weight:600;color:#f0e8d8}
        .sn-flavor{font-size:0.68rem;color:#8a7a6a}
        .sn-fight{border-color:rgba(192,64,48,0.35)}
        .sn-cancel{border-color:rgba(255,255,255,0.1);min-height:36px}
      `;
      document.head.appendChild(s);
    }

    const close = () => removeEl(modal);
    modal.querySelector('.sn-overlay').addEventListener('click', close);
    modal.querySelectorAll('.sn-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        this.audio.playSfx('click');
        const idx = btn.dataset.idx;
        if (idx === 'cancel') { close(); return; }
        if (idx === 'fight') {
          close();
          this._startTravel(node);
          return;
        }
        const opt = opts[parseInt(idx)];
        const attrVal = Math.max(0, ...partyOnly.map(m => m?.attrs?.[opt.stat] || 0)) || 8;
        const roll = attrVal + Math.floor(Math.random() * 10) + 1;
        const pass = roll >= opt.dc;
        close();
        if (pass) {
          if (!gs.sneakedNodes) gs.sneakedNodes = new Set();
          gs.sneakedNodes.add(node.id);
          this._showFloatingToast(`${opt.stat} check passed (${roll} vs ${opt.dc}) — sneaked past!`);
        } else {
          this._showFloatingToast(`${opt.stat} check failed (${roll} vs ${opt.dc}) — they spot you!`);
        }
        this._startTravel(node);
      });
    });
  }

  _showFloatingToast(msg) {
    const t = createEl('div', 'map-toast');
    t.textContent = msg;
    t.style.cssText = 'position:absolute;top:12%;left:50%;transform:translateX(-50%);background:rgba(10,6,8,0.92);border:1px solid rgba(232,160,32,0.5);color:#f0e8d8;padding:0.55rem 1rem;border-radius:6px;font-size:0.78rem;z-index:650;pointer-events:none;font-family:Inter,sans-serif';
    this.manager.uiOverlay.appendChild(t);
    setTimeout(() => removeEl(t), 2400);
  }

  _crossZoneJump(link) {
    // Move party into the adjacent zone, placed on the connecting node.
    const gs = GameState.get();
    GameState.setZoneNode(gs.zoneId, gs.nodeId); // preserve departure position
    gs.zoneId = link.zone.id;
    gs.nodeId = link.node.id;
    GameState.visitNode(link.node.id);
    GameState.setZoneNode(link.zone.id, link.node.id);
    this._zone = link.zone;
    this._bgImg = null; // force reload of new zone background
    try {
      const act = link.zone.act || gs.act || 1;
      this.audio.playOverworldMusic(act, link.zone.id);
    } catch (_) {}
    // Rebuild DOM (tab bar etc.) and redraw
    removeEl(this._el);
    this._build();
  }

  /**
   * M347 — Render the Traveling… label as a fixed-position DOM element
   * centered on the viewport. The canvas is scrollable on iPhone portrait,
   * so the previous canvas-drawn label could scroll off-screen entirely.
   */
  _updateTravelLabel() {
    if (!this._el) return;
    let el = this._el.querySelector('#map-travel-label');
    if (!this._travel) {
      if (el) el.remove();
      return;
    }
    if (!el) {
      el = document.createElement('div');
      el.id = 'map-travel-label';
      el.style.cssText = `
        position: fixed; top: 92px; left: 50%; transform: translateX(-50%);
        z-index: 200; padding: 0.45rem 0.95rem;
        background: rgba(10,6,8,0.88); border: 1px solid rgba(232,160,32,0.55);
        border-radius: 6px; color: #e8a020; font: bold 13px 'Inter', sans-serif;
        letter-spacing: 0.05em; pointer-events: none;
        box-shadow: 0 4px 14px rgba(0,0,0,0.5);
      `;
      this._el.appendChild(el);
    }
    const dots = '.'.repeat(1 + Math.floor(this._t * 3) % 3);
    el.textContent = `Traveling${dots}`;
  }

  _startTravel(node) {
    const gs = GameState.get();
    const w = this._canvas.width, h = this._canvas.height;
    const current = this._zone.nodes.find(n => n.id === gs.nodeId);
    const from = current ? this._nodePos(current, w, h) : this._nodePos(node, w, h);
    const to = this._nodePos(node, w, h);
    this._travel = { from, to, elapsed: 0, duration: 1.2, node };
    this._hideNodeTooltip();
  }

  _onHover(e, canvas) {
    if (this._travel) { this._hovered = null; this._hideNodeTooltip(); return; }
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);

    // M311 (issue 11): fogged nodes must not respond to hover.
    const gs = GameState.get();
    const fogOn = !!gs.fogOfWar;
    const revealedSet = fogOn ? this._computeRevealed(this._zone, gs) : null;
    const isRevealed = (id) => !fogOn || revealedSet.has(id);

    let found = null;
    for (const node of this._zone.nodes) {
      if (!isRevealed(node.id)) continue; // fogged — no hover
      if (node.hidden && !isHiddenNodeUnlocked(node, gs)) continue; // invisible hidden boss
      const pos = this._nodePos(node, canvas.width, canvas.height);
      const dist = Math.hypot(mx - pos.x, my - pos.y);
      if (dist <= 20) { found = node.id; break; }
    }
    if (found !== this._hovered) {
      this._hovered = found;
      this._drawMap();
      if (found) {
        const node = this._zone.nodes.find(n => n.id === found);
        const info = NODE_ICONS[node.type] || {};
        this._showNodeTooltip(e, node, info);
      } else {
        this._hideNodeTooltip();
      }
    }
  }

  _showNodeTooltip(e, node, info) {
    const tt = this._el.querySelector('#map-node-tooltip');
    if (!tt) return;
    tt.innerHTML = `<div class="mntt-name">${this._displayedNodeName(node)}</div><div class="mntt-type" style="color:${info.color}">${info.label}</div>`;
    tt.style.display = 'block';
    // Show first so we can measure
    tt.style.left = '0px';
    tt.style.top = '0px';
    const rect = this._el.getBoundingClientRect();
    const containerW = rect.width;
    const ttW = tt.offsetWidth || 120;
    const ttH = tt.offsetHeight || 40;
    let left = e.clientX - rect.left + 12;
    let top  = e.clientY - rect.top - 40;
    // M359: clamp inside container so tooltip can't push out of bounds and
    // create a horizontal scrollbar (Border Roads > Warlord's Vanguard bug).
    if (left + ttW > containerW - 8) left = e.clientX - rect.left - ttW - 12;
    if (left < 8) left = 8;
    if (top < 8) top = 8;
    if (top + ttH > rect.height - 8) top = rect.height - ttH - 8;
    tt.style.left = `${left}px`;
    tt.style.top = `${top}px`;
  }

  _hideNodeTooltip() {
    const tt = this._el?.querySelector('#map-node-tooltip');
    if (tt) tt.style.display = 'none';
  }

  // M76: dialog nodes that aren't bound to a fixed DIALOG_EVENTS entry get a
  // random event assigned and persisted on first sight. Returns the resolved
  // event object (DIALOG_EVENTS shape).
  _resolveDialogEvent(node) {
    if (!node || node.type !== NODE_TYPES.DIALOG) return null;
    // M276: explicit dialogEventId override (used by prologue zone where node ids
    // like "start" collide with other zones).
    if (node.dialogEventId && DIALOG_EVENTS[node.dialogEventId]) return DIALOG_EVENTS[node.dialogEventId];
    if (DIALOG_EVENTS[node.id]) return DIALOG_EVENTS[node.id];
    const gs = GameState.get();
    if (!gs.assignedRandomEvents) gs.assignedRandomEvents = {};
    const key = `${this._zone?.id || 'zone'}:${node.id}`;
    let evtId = gs.assignedRandomEvents[key];
    let evt = evtId ? RANDOM_EVENTS.find(e => e.id === evtId) : null;
    if (!evt) {
      const partyLevel = gs.party?.[0]?.level || 1;
      // M280 — derive a per-node seed from the user's mapSeed (advanced opt)
      // so two players with the same seed see the same random events.
      let seedNum = null;
      const userSeed = (typeof gs.mapSeed === 'string' && gs.mapSeed.trim()) ? gs.mapSeed.trim() : '';
      if (userSeed) {
        let h = 0; const s = `${userSeed}|${key}`;
        for (let i = 0; i < s.length; i++) h = ((h * 31) + s.charCodeAt(i)) | 0;
        seedNum = h;
      }
      evt = getRandomEvent(partyLevel, this._zone?.id, gs.seenEvents || [], seedNum);
      if (evt && evt.id) gs.assignedRandomEvents[key] = evt.id;
    }
    return evt;
  }

  // M76: preferred display name for a node — for DIALOG nodes, default to the
  // resolved event's NPC so the map label matches what the player encounters.
  // M363 — but if node.name is explicitly set in mapData (and not a generic
  // bucket like "Encounter"), prefer it. This unmasks per-node renames like
  // forest_enter ("Forest Edge") vs act1_warden_reward ("Warden's Request")
  // that were previously collapsing to the same npcName ("Forest Warden").
  _displayedNodeName(node) {
    if (node?.type === NODE_TYPES.DIALOG) {
      const explicit = node.name;
      const looksGeneric = !explicit || /^(Encounter|Dialog)$/i.test(explicit);
      if (looksGeneric) {
        const evt = this._resolveDialogEvent(node);
        if (evt?.npcName) return evt.npcName;
      }
      return explicit || '';
    }
    return node?.name || '';
  }

  _navigateToNode(node) {
    debug.map('node clicked', { zone: this._zone?.id, nodeId: node.id, type: node.type, encounter: node.encounter });
    try {
      if (_isMapDebugOn()) {
        const zone = this._zone;
        const adjNodes = (node.exits || []).map(exitId => {
          const n = (zone?.nodes || []).find(x => x.id === exitId);
          const gs = GameState.get();
          const discovered = gs.visitedNodes?.has(exitId) || false;
          return `${exitId}(discovered:${discovered})`;
        });
        console.log(`[map] travel → ${node.id} ("${node.name || node.type}") at (${(node.x||0).toFixed(3)}, ${(node.y||0).toFixed(3)})`);
        console.log(`[map]   adjacent: [${adjNodes.join(', ')}]`);
      }
    } catch (_) {}

    // M302: Node overlay system — check for unconsumed overlay on this node.
    // If found, show the overlay FIRST; underlying node encounter triggers after.
    const overlay = this._getPendingOverlay(node.id);
    if (overlay) {
      this._showNodeOverlay(overlay, node, () => this._navigateToNodeCore(node));
      return;
    }

    this._navigateToNodeCore(node);
  }

  _navigateToNodeCore(node) {
    const alreadyVisited = GameState.get().visitedNodes?.has(node.id);
    GameState.visitNode(node.id);
    GameState.get().zoneId = this._zone.id;
    GameState.get().nodeId = node.id;
    GameState.setZoneNode(this._zone.id, node.id);

    switch (node.type) {
      case NODE_TYPES.TOWN: {
        // M322: clicking a town node from the world map. If we were pushed
        // ON TOP of an existing TownScreen (the normal case after the
        // player walked out), pop returns to it. But on the post-prologue
        // first-town visit the stack only contains MapScreen, so a bare
        // pop() unwinds to the title screen. Detect that and push a fresh
        // TownScreen instead.
        const stack = this.manager.stack || this.manager._stack || [];
        const hasTownBelow = Array.isArray(stack) && stack.some(s => s && s.constructor && s.constructor.name === 'TownScreen');
        if (hasTownBelow) {
          this.manager.pop();
        } else {
          import('./TownScreen.js').then(m => {
            this.manager.replace(new m.TownScreen(this.manager, this.audio, GameState.get(), false));
          }).catch(err => {
            console.error('[MapScreen] town entry failed, falling back to pop', err);
            this.manager.pop();
          });
        }
        break;
      }
      case NODE_TYPES.COMBAT:
      case NODE_TYPES.AMBUSH: {
        // M56: sneaked past — no combat this arrival; clear the one-shot flag.
        const _gsS = GameState.get();
        if (_gsS.sneakedNodes?.has(node.id)) {
          _gsS.sneakedNodes.delete(node.id);
          break;
        }
        let encKey = node.encounter;
        if (alreadyVisited) {
          // Random encounter from zone pool on revisit
          const pool = ZONE_ENCOUNTER_POOLS[this._zone.id] || [];
          const filtered = pool.filter(k => ENCOUNTERS[k]);
          if (filtered.length) encKey = filtered[Math.floor(Math.random() * filtered.length)];
        }
        // M279: big-fight overlay — at party avg level 5+, certain nodes
        // escalate to a 6-8 enemy AoE-bait encounter.
        try {
          const _gsBF = GameState.get();
          const _members = (_gsBF.party || []).filter(p => p && !(p.isCompanion || p.class === 'companion'));
          const _avgLvl = _members.length
            ? _members.reduce((s, m) => s + (m.level || 1), 0) / _members.length
            : 1;
          const _bigKey = resolveBigFightEncounter(node.id, _avgLvl);
          if (_bigKey && ENCOUNTERS[_bigKey]) encKey = _bigKey;
        } catch (_) { /* fall through to vanilla encounter */ }
        const enc = encKey && ENCOUNTERS[encKey]
          ? { ...ENCOUNTERS[encKey], name: alreadyVisited ? ENCOUNTERS[encKey].name : node.name }
          : { ...FALLBACK_ENCOUNTER, name: node.name };
        enc.zoneId = this._zone.id;
        this.manager.push(new CombatScreen(this.manager, this.audio, null, enc));
        break;
      }
      case NODE_TYPES.DIALOG: {
        const gs2 = GameState.get();
        if (!gs2.seenEvents) gs2.seenEvents = [];
        const event = this._resolveDialogEvent(node);
        // M359: dialog nodes are once-only by default. If we've already
        // resolved this event (it sat in seenEvents), the node becomes a
        // silent walk-past unless the event is explicitly tagged
        // `repeatable: true` in mapData. Quest-giver / shop-style events
        // should set repeatable; story beats like the Forest Warden intro
        // should not.
        if (event && gs2.seenEvents.includes(event.id) && !event.repeatable) {
          // No-op: just walk past. Mark visited (already done elsewhere) and
          // don't push the dialog. Could add a tiny "[completed]" toast in a
          // later milestone if the silent path is too quiet.
          break;
        }
        // Only mark seen when the player resolves an outcome that meaningfully
        // completes the encounter (has a reward or sets a flag). A bare
        // "Leave it undisturbed" outcome with no reward/flag should NOT
        // consume the encounter — the player may need to come back with the
        // required item (e.g. warden_charm at the Mossy Cairn).
        this.manager.push(new DialogScreen(this.manager, this.audio, event, (outcomeKey, outcome) => {
          if (event) {
            // M494 — recruitHero is deliberately EXCLUDED here. Marking the
            // event seen at outcome-selection time meant a player who opened
            // the recruit builder and then cancelled it lost the NPC forever
            // (the dialog node became a silent walk-past). The recruitHero
            // path now marks the event seen only when the recruit is
            // actually confirmed — see _handleRecruitHeroOutcome's onConfirm.
            const completing = !!(outcome && (outcome.setFlag || outcome.reward || outcome.startCombat));
            if (completing && !gs2.seenEvents.includes(event.id)) {
              gs2.seenEvents.push(event.id);
            }
          }
          if (outcome?.startCombat) {
            // M467 — startCombat may be a string (encounter key from
            // ENCOUNTERS), an inline encounter object ({ name, enemies }),
            // or a truthy fallback (legacy bandit ambush).
            let enc = null;
            const sc = outcome.startCombat;
            if (typeof sc === 'string' && ENCOUNTERS[sc]) {
              enc = { ...ENCOUNTERS[sc], zoneId: this._zone.id };
            } else if (sc && typeof sc === 'object' && Array.isArray(sc.enemies)) {
              enc = { ...sc, zoneId: this._zone.id };
            } else {
              enc = { name: 'Bandit Ambush', zoneId: this._zone.id, enemies: [
                { id: 'bandit', name: 'Bandit', count: 2, hp: 28, maxHp: 28, dmg: [6, 11], armor: 3, hit: 70, dodge: 10, xpValue: 20, gold: [4, 10] },
              ]};
            }
            this.manager.push(new CombatScreen(this.manager, this.audio, null, enc));
          }
          // ── recruitHero outcome ───────────────────────────────────────────
          // Spec: open HireBuilderScreen in recruit mode (pre-filled with NPC
          // data), then handle party-size + optional thenCombat on confirm.
          if (outcome?.recruitHero) {
            this._handleRecruitHeroOutcome(outcome.recruitHero, event);
          }
        }));
        break;
      }
      case NODE_TYPES.LORE:
        // M279: synthetic arrival "Trailhead" nodes (noEvent:true) are
        // free-walk waypoints that should NOT pop a lore modal.
        if (node.noEvent) break;
        this._showLoreModal(node);
        break;
      case NODE_TYPES.SHRINE: {
        // M406: if the shrine was already activated, treat re-entry as a
        // no-op so the player just walks through without a popup.
        // If skipped (visited but not used), the shrine remains available.
        const gs0 = GameState.get();
        if (!gs0.usedShrines) gs0.usedShrines = new Set();
        if (Array.isArray(gs0.usedShrines)) gs0.usedShrines = new Set(gs0.usedShrines);
        if (gs0.usedShrines.has(node.id)) break; // already used — silent pass-through
        // Pass alreadyVisited=false so the modal doesn't show stale "used" UI;
        // actual used-state is now in usedShrines, not visitedNodes.
        this._showShrineModal(node, false);
        break;
      }
      case NODE_TYPES.CHALLENGE: {
        const chalKey = node.encounter;
        const chalEnc = chalKey ? { ...ENCOUNTERS[chalKey], name: node.name } : null;
        if (chalEnc) { chalEnc.zoneId = this._zone.id; this.manager.push(new CombatScreen(this.manager, this.audio, null, chalEnc)); }
        break;
      }
      case NODE_TYPES.TREASURE:
        this._showTreasureModal(node);
        break;
      case NODE_TYPES.DUNGEON: {
        // M279: enter the dungeon's sequential runner. Cleared dungeons can't
        // be re-entered.
        const gs = GameState.get();
        // M338 — bug: arriving at a dungeon node updates gs.nodeId to the
        // dungeon's own id BEFORE the switch fires, so the anchor-fallback
        // node id we hand DungeonScreen for "give up / return" was the
        // dungeon entry itself. That meant give-up looped back into the
        // dungeon node and the user got stuck. Resolve the anchor (the
        // node whose exits include this dungeon) up front.
        const anchorNodeId = (() => {
          for (const n of (this._zone.nodes || [])) {
            if ((n.exits || []).includes(node.id)) return n.id;
          }
          return gs.nodeId;
        })();
        const cleared = Array.isArray(gs.completedDungeons) && gs.completedDungeons.includes(node.dungeonId);
        if (cleared) {
          this._showLoreModal({ ...node, name: 'Dungeon Cleared', text: 'You’ve already plundered this place. The way is sealed.' });
          break;
        }
        // M338 — extra defense: if dungeonId is missing the dungeon node was
        // misconfigured. Surface a visible message instead of failing silently.
        if (!node.dungeonId) {
          this._showLoreModal({ ...node, name: 'Dungeon Sealed', text: 'The entrance is barred (missing dungeonId — please report).' });
          break;
        }
        (async () => {
          try {
            const { DungeonScreen } = await import('./DungeonScreen.js');
            this.manager.push(new DungeonScreen(this.manager, this.audio, node.dungeonId, anchorNodeId, this._zone.id));
          } catch (e) {
            console.warn('Dungeon open failed', e);
            // M338 — surface to the player instead of silently sitting there.
            try { this._showLoreModal({ ...node, name: 'Dungeon Failed To Open', text: `Could not load DungeonScreen: ${e?.message || e}.` }); } catch (_) {}
          }
        })();
        break;
      }
      case NODE_TYPES.BOSS: {
        let bossEnc;
        if (node.hidden && node.encounterId) {
          // M304: hidden boss — look up in HIDDEN_BOSS_ENCOUNTERS
          const hbe = HIDDEN_BOSS_ENCOUNTERS[node.encounterId];
          bossEnc = hbe ? { ...hbe, name: node.name } : { ...ENCOUNTERS.border_boss, name: node.name };
        } else {
          const bossKey = node.encounter;
          bossEnc = bossKey ? { ...ENCOUNTERS[bossKey], name: node.name } : { ...ENCOUNTERS.border_boss, name: node.name };
        }
        // Attach onVictory callback to unlock next zone
        bossEnc._bossNodeId = node.id;
        bossEnc._zoneId = this._zone.id;
        this.manager.push(new CombatScreen(this.manager, this.audio, null, bossEnc));
        break;
      }
      case NODE_TYPES.SKILL_CHECK: {
        // M347 — same fix as Shrine (M346): pass alreadyVisited so the
        // first arrival doesn't render "You have already attempted this
        // challenge". The "already attempted" state is now driven by a
        // dedicated gs.skillCheckAttempted set, not visitedNodes — so
        // walking past without engaging doesn't lock you out.
        this._showSkillCheckModal(node, alreadyVisited);
        break;
      }
    }
    this._drawMap();
  }

  // ───────────── M302: Node overlay system ─────────────────────────────────

  /** Seed 1-2 overlays per zone on first visit. Weighted: merchant 50%, minigame 30%, bandit 20%. */
  // Stray-edge validation: warn when any node.exits references an id not
  // present in zone.nodes. Runs once per zone (idempotent guard via _validatedZones).
  _validateZoneGraph(zone) {
    if (!zone?.nodes?.length) return;
    if (!this._validatedZones) this._validatedZones = new Set();
    if (this._validatedZones.has(zone.id)) return;
    this._validatedZones.add(zone.id);
    const validIds = new Set(zone.nodes.map(n => n.id));
    for (const n of zone.nodes) {
      for (const ex of (n.exits || [])) {
        if (!validIds.has(ex)) {
          console.error(`[map] STRAY EDGE: ${zone.id}.${n.id} → ${ex} (target missing)`);
        }
      }
    }
  }

  // Dump the full zone graph to console (toggleable via window.__mapDebug).
  _dumpZoneGraph(zone) {
    const rows = (zone?.nodes || []).map(n => ({
      id: n.id,
      type: n.type,
      hidden: !!n.hidden,
      x: Number(n.x?.toFixed?.(3) ?? n.x),
      y: Number(n.y?.toFixed?.(3) ?? n.y),
      exits: (n.exits || []).join(','),
    }));
    console.log(`[map] zone graph: ${zone.id} (${rows.length} nodes)`);
    try { console.table(rows); } catch (_) { console.log(rows); }
  }

  _ensureZoneOverlays(zone) {
    const gs = GameState.get();
    if (!gs.nodeOverlays) gs.nodeOverlays = {};
    if (gs.nodeOverlays[zone.id]) return; // already seeded
    // Simple seeded RNG derived from zone id
    let seed = 0;
    for (let i = 0; i < zone.id.length; i++) seed = (seed * 31 + zone.id.charCodeAt(i)) | 0;
    const rng = () => { seed = (seed * 1664525 + 1013904223) | 0; return (seed >>> 0) / 4294967296; };

    const OVERLAY_TYPES = ['merchant', 'merchant', 'merchant', 'minigame', 'minigame', 'bandit'];
    const eligibleNodes = zone.nodes.filter(n => n.type !== 'town' && n.type !== 'boss' && !n.type?.includes('boss'));
    if (!eligibleNodes.length) { gs.nodeOverlays[zone.id] = []; return; }

    const count = 1 + (rng() < 0.45 ? 1 : 0); // 1 or 2 overlays
    const overlays = [];
    const usedNodeIds = new Set();
    for (let i = 0; i < count; i++) {
      const eligible = eligibleNodes.filter(n => !usedNodeIds.has(n.id));
      if (!eligible.length) break;
      const node = eligible[Math.floor(rng() * eligible.length)];
      const type = OVERLAY_TYPES[Math.floor(rng() * OVERLAY_TYPES.length)];
      usedNodeIds.add(node.id);
      overlays.push({ id: `ov_${zone.id}_${i}`, nodeId: node.id, type, consumed: false });
    }
    gs.nodeOverlays[zone.id] = overlays;
  }

  _getPendingOverlay(nodeId) {
    const gs = GameState.get();
    const zoneOverlays = (gs.nodeOverlays || {})[this._zone?.id] || [];
    return zoneOverlays.find(o => o.nodeId === nodeId && !o.consumed) || null;
  }

  _consumeOverlay(overlay) {
    const gs = GameState.get();
    const zoneOverlays = (gs.nodeOverlays || {})[this._zone?.id] || [];
    const o = zoneOverlays.find(x => x.id === overlay.id);
    if (o) o.consumed = true;
  }

  /** Show the overlay modal then call `onContinue` when dismissed or finished. */
  _showNodeOverlay(overlay, underlyingNode, onContinue) {
    this._consumeOverlay(overlay);
    switch (overlay.type) {
      case 'merchant': this._showMerchantOverlay(overlay, onContinue); break;
      case 'minigame': this._showMinigameOverlay(overlay, onContinue); break;
      case 'bandit':   this._showBanditOverlay(overlay, underlyingNode, onContinue); break;
      default: onContinue();
    }
  }

  _showMerchantOverlay(overlay, onContinue) {
    const gs = GameState.get();
    // Generate a small one-time stock from a fixed pool
    const STOCK = [
      { id: 'health_pot',  name: 'Health Potion',  price: 40, desc: 'Restore 60 HP to one ally.' },
      { id: 'mana_pot',    name: 'Mana Potion',     price: 35, desc: 'Restore 40 MP to one ally.' },
      { id: 'antidote',    name: 'Antidote',        price: 28, desc: 'Remove Poison from one ally.' },
      { id: 'smoke_vial',  name: 'Smoke Vial',      price: 55, desc: 'Auto-flee next combat (fails vs bosses).' },
      { id: 'lucky_charm', name: 'Lucky Charm',     price: 80, desc: '+15 gold reward from next fight.' },
    ];
    // Pick 3 random items from stock
    const shuffled = [...STOCK].sort(() => Math.random() - 0.5);
    const items = shuffled.slice(0, 3);
    const modal = createEl('div', 'map-modal');
    modal.innerHTML = `
      <div class="mm-overlay"></div>
      <div class="mm-box">
        <div class="mm-title" style="color:#e8a020">Travelling Merchant</div>
        <div class="mm-body" style="margin-bottom:0.8rem">A cloaked merchant appears from the treeline, goods bundled across his mule. "One time offer, friend — take it or leave it."</div>
        <div style="display:flex;flex-direction:column;gap:0.45rem;margin-bottom:0.8rem">
          ${items.map((it, idx) => `
            <div style="display:flex;align-items:center;gap:0.6rem;background:rgba(232,160,32,0.07);border:1px solid rgba(232,160,32,0.2);border-radius:5px;padding:0.4rem 0.6rem">
              <div style="flex:1">
                <div style="font-size:0.85rem;font-weight:600;color:#f0e8d8">${it.name}</div>
                <div style="font-size:0.68rem;color:#8a7a6a">${it.desc}</div>
              </div>
              <button type="button" class="mm-buy-btn" data-idx="${idx}" data-price="${it.price}"
                style="background:rgba(232,160,32,0.18);border:1px solid rgba(232,160,32,0.5);color:#e8a020;padding:0.3rem 0.6rem;border-radius:4px;font-family:inherit;font-size:0.75rem;cursor:pointer;min-height:36px;white-space:nowrap">
                ${it.price} gold
              </button>
            </div>
          `).join('')}
        </div>
        <div id="merch-gold" style="font-size:0.75rem;color:#e8a020;margin-bottom:0.5rem">Your gold: ${gs.gold}</div>
        <button type="button" class="mm-btn" id="merch-close">Leave &amp; Continue</button>
      </div>
    `;
    modal.querySelector('.mm-overlay')?.addEventListener('click', () => { removeEl(modal); onContinue(); });
    modal.querySelector('#merch-close')?.addEventListener('click', () => { this.audio.playSfx('click'); removeEl(modal); onContinue(); });
    modal.querySelectorAll('.mm-buy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const price = parseInt(btn.dataset.price);
        const item = items[parseInt(btn.dataset.idx)];
        if (!item || gs.gold < price) { this._showFloatingToast('Not enough gold!'); return; }
        gs.gold -= price;
        modal.querySelector('#merch-gold').textContent = `Your gold: ${gs.gold}`;
        btn.disabled = true; btn.textContent = 'Sold!'; btn.style.opacity = '0.5';
        this.audio.playSfx('gold');
        this._showFloatingToast(`Bought ${item.name}!`);
      });
    });
    this._el.appendChild(modal);
  }

  _showMinigameOverlay(overlay, onContinue) {
    // M359: 8-card / 4-pair memory match using class-style glyphs (was 4-card).
    // Each glyph is a tiny inline SVG sized to the card so they render crisply.
    // 12 flip budget (was 6 for 2 pairs) — same ratio (3 flips per pair).
    const GLYPHS = [
      { id: 'sword',  svg: '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 17.5 L4 7 L4 4 L7 4 L17.5 14.5"/><path d="M16 16 L20 20"/><path d="M18 14 L22 18"/></svg>' },
      { id: 'shield', svg: '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3 L20 6 V12 C20 17 16 20.5 12 22 C8 20.5 4 17 4 12 V6 Z"/><path d="M12 8 V16"/></svg>' },
      { id: 'flame',  svg: '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 22 C7 22 4 18 4 14 C4 10 7 8 8 4 C9 8 11 9 14 9 C13 11 15 12 16 11 C18 13 20 16 20 14 C20 18 17 22 12 22 Z"/></svg>' },
      { id: 'rune',   svg: '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3 V21"/><path d="M5 8 L19 16"/><path d="M5 16 L19 8"/></svg>' },
    ];
    const PAIRS = [...GLYPHS, ...GLYPHS]; // 8 cards, 4 pairs
    const cards = [...PAIRS].sort(() => Math.random() - 0.5);
    const FLIP_LIMIT = 12;
    let flipped = [], matched = new Set(), flips = 0, locked = false;
    const gs = GameState.get();

    const modal = createEl('div', 'map-modal');
    modal.innerHTML = `
      <div class="mm-overlay"></div>
      <div class="mm-box" style="max-width:380px">
        <div class="mm-title" style="color:#c080ff">Memory Trial</div>
        <div class="mm-body">A spirit whispers: "Match my four sigils for a reward."</div>
        <div id="mg-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.5rem;margin:0.8rem 0"></div>
        <div id="mg-status" style="font-size:0.78rem;color:#8a7a6a;text-align:center;min-height:1.2rem">Flips: 0 / ${FLIP_LIMIT} — Match the four sigils!</div>
        <button type="button" class="mm-btn" id="mg-close" style="display:none;margin-top:0.5rem">Continue</button>
      </div>
    `;
    const grid = modal.querySelector('#mg-grid');
    const status = modal.querySelector('#mg-status');
    const closeBtn = modal.querySelector('#mg-close');

    const cardEls = cards.map((g, i) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.dataset.val = g.id;
      el.dataset.idx = i;
      el.style.cssText = 'width:100%;aspect-ratio:1;background:#1a1218;border:1px solid rgba(192,128,255,0.4);border-radius:6px;color:#1a1218;cursor:pointer;transition:all 0.2s;min-height:44px;display:flex;align-items:center;justify-content:center';
      el.innerHTML = '';
      el.addEventListener('click', () => {
        if (locked || matched.has(i) || flipped.includes(i)) return;
        flipped.push(i);
        el.style.color = '#c080ff';
        el.innerHTML = g.svg;
        el.style.background = 'rgba(192,128,255,0.15)';
        if (flipped.length === 2) {
          flips++;
          locked = true;
          const [a, b] = flipped;
          if (cards[a].id === cards[b].id) {
            matched.add(a); matched.add(b);
            cardEls[a].style.background = 'rgba(64,200,96,0.25)';
            cardEls[b].style.background = 'rgba(64,200,96,0.25)';
            flipped = []; locked = false;
            if (matched.size === cards.length) {
              status.innerHTML = `<span style="color:#40c860">All matched! +50 gold!</span>`;
              gs.gold = (gs.gold || 0) + 50;
              closeBtn.style.display = '';
            }
          } else {
            setTimeout(() => {
              cardEls[a].innerHTML = ''; cardEls[a].style.background = '#1a1218';
              cardEls[b].innerHTML = ''; cardEls[b].style.background = '#1a1218';
              flipped = []; locked = false;
              status.textContent = `Flips: ${flips} / ${FLIP_LIMIT} — Keep trying!`;
              if (flips >= FLIP_LIMIT && matched.size < cards.length) {
                status.innerHTML = '<span style="color:#e07060">Out of flips — no reward this time.</span>';
                closeBtn.style.display = '';
              }
            }, 700);
          }
          status.textContent = `Flips: ${flips} / ${FLIP_LIMIT}`;
        }
      });
      grid.appendChild(el);
      return el;
    });

    modal.querySelector('.mm-overlay')?.addEventListener('click', () => { removeEl(modal); onContinue(); });
    closeBtn?.addEventListener('click', () => { this.audio.playSfx('click'); removeEl(modal); onContinue(); });
    this._el.appendChild(modal);
  }

  _showBanditOverlay(overlay, underlyingNode, onContinue) {
    // Forced combat with 2-3 bandits before the underlying node encounter.
    const gs = GameState.get();
    const count = 2 + (Math.random() < 0.33 ? 1 : 0);
    const enc = {
      name: 'Bandit Patrol',
      zoneId: this._zone.id,
      enemies: Array.from({ length: count }, () => ({
        id: 'bandit', name: 'Bandit', count: 1,
        hp: 35, maxHp: 35, dmg: [8, 14], armor: 5, hit: 70, dodge: 12,
        xpValue: 22, gold: [5, 12],
      })),
    };
    const modal = createEl('div', 'map-modal');
    modal.innerHTML = `
      <div class="mm-overlay"></div>
      <div class="mm-box">
        <div class="mm-title" style="color:#e05050">Bandit Patrol</div>
        <div class="mm-body">${count} armed bandits step from the shadows, blades drawn. There is no way around them.</div>
        <button type="button" class="mm-btn" id="bp-fight" style="border-color:rgba(224,80,80,0.6);color:#e07060">Engage (${count} Bandits)</button>
        <button type="button" class="mm-btn" id="bp-cancel" style="margin-top:0.4rem;background:transparent;border-color:rgba(240,232,216,0.2)">Retreat</button>
      </div>
    `;
    modal.querySelector('#bp-fight')?.addEventListener('click', () => {
      this.audio.playSfx('click');
      removeEl(modal);
      // After bandit combat resolves, continue to underlying node
      const screen = new CombatScreen(this.manager, this.audio, null, enc);
      const origOnExit = screen.onExit?.bind(screen);
      // Override manager.pop to chain underlying node after bandit fight
      const origPop = this.manager.pop.bind(this.manager);
      this.manager.push(screen);
      // The chain is implicit: when CombatScreen pops, MapScreen onResume fires,
      // which no longer has an overlay, and _navigateToNode calls onContinue.
      // We mark a special flag so onResume knows to re-trigger the node.
      gs._overlayPendingNodeId = underlyingNode.id;
    });
    modal.querySelector('#bp-cancel')?.addEventListener('click', () => {
      this.audio.playSfx('click'); removeEl(modal);
      // Re-unconsume so they can try to visit the node again and face it
      // (or accept defeat). For UX simplicity: consumed stays true; no combat.
    });
    modal.querySelector('.mm-overlay')?.addEventListener('click', () => removeEl(modal));
    this._el.appendChild(modal);
  }

  _showLoreModal(node) {
    // M298: unlock any lore compendium entries tied to this node
    try {
      import('../../game/lore.js').then(({ LORE_ENTRIES }) => {
        for (const entry of LORE_ENTRIES) {
          if (entry.unlockedBy?.type === 'lore_node' && entry.unlockedBy?.id === node.id) {
            GameState.unlockLore(entry.id);
          }
        }
      }).catch(() => {});
    } catch (_) {}

    const modal = createEl('div', 'map-modal');
    modal.innerHTML = `
      <div class="mm-overlay"></div>
      <div class="mm-box">
        <div class="mm-title">${node.name}</div>
        <div class="mm-body" style="color:#c0b090;font-size:0.88rem;line-height:1.6">
          ${this._getLoreText(node.id)}
        </div>
        <button type="button" class="mm-btn">Continue</button>
      </div>
    `;
    modal.querySelector('.mm-overlay').addEventListener('click', () => removeEl(modal));
    modal.querySelector('.mm-btn').addEventListener('click', () => { this.audio.playSfx('click'); removeEl(modal); });
    this._el.appendChild(modal);
  }

  _showTreasureModal(node) {
    const gs = GameState.get();
    gs.claimedTreasures = gs.claimedTreasures || [];
    const claimed = gs.claimedTreasures.includes(node.id);
    const goldAmt = 60 + Math.floor(Math.random() * 60);
    const modal = createEl('div', 'map-modal');
    modal.innerHTML = `
      <div class="mm-overlay"></div>
      <div class="mm-box">
        <div class="mm-title" style="color:#e8a020">${claimed ? 'Already Searched' : 'Treasure Found!'}</div>
        <div class="mm-body">${claimed ? 'The cache here has already been emptied. Nothing remains but scattered leaves.' : `You discover a hidden cache. Inside: <strong style="color:#e8a020">${goldAmt} gold</strong>.`}</div>
        ${!claimed ? '<button type="button" class="mm-btn">Claim Reward</button>' : ''}
        <button type="button" class="mm-btn" style="background:transparent;border-color:rgba(240,232,216,0.2);margin-top:0.5rem" id="tres-close">Continue</button>
      </div>
    `;
    modal.querySelector('.mm-overlay').addEventListener('click', () => removeEl(modal));
    modal.querySelector('#tres-close').addEventListener('click', () => { this.audio.playSfx('click'); removeEl(modal); });
    if (!claimed) modal.querySelector('.mm-btn').addEventListener('click', () => {
      this.audio.playSfx('victory');
      GameState.addGold(goldAmt);
      gs.claimedTreasures.push(node.id);
      removeEl(modal);
    });
    this._el.appendChild(modal);
  }

  _showShrineModal(node, _unused = false) {
    const gs = GameState.get();
    if (!gs.usedShrines) gs.usedShrines = new Set();
    if (Array.isArray(gs.usedShrines)) gs.usedShrines = new Set(gs.usedShrines);

    const type = node.shrineType || 'heal';

    // M406 — Random-buff pool. Replaces heal-HP shrines with a timed buff
    // that lasts the next 2 combats. Pick one randomly when the shrine is
    // activated; store it in gs.shrineBuffs so CombatScreen can consume it.
    const BUFF_POOL = [
      { id: 'xp_boost',      label: '+50% XP for next 2 combats',             desc: 'The shrine marks your deeds — the next two battles yield greater experience.',        apply: (g) => { _pushShrineBuff(g, { type:'xp_boost',      combatsLeft:2, mult:1.5 }); } },
      { id: 'barrier',       label: 'Start next combat with a barrier shield', desc: 'A shell of radiant force coalesces around your party.',                               apply: (g) => { _pushShrineBuff(g, { type:'barrier',       combatsLeft:1 }); } },
      { id: 'stun_round1',   label: 'All enemies stunned for round 1',         desc: 'The shrine\'s blessing freezes every enemy in place at the start of the next fight.',  apply: (g) => { _pushShrineBuff(g, { type:'stun_round1',   combatsLeft:1 }); } },
      { id: 'gold_boost',    label: '+25% gold from next 2 combats',           desc: 'Coins seem to find you — the next two battles drop more gold.',                       apply: (g) => { _pushShrineBuff(g, { type:'gold_boost',    combatsLeft:2, mult:1.25 }); } },
      { id: 'mp_regen',      label: '+1 MP regen per turn for next 2 combats', desc: 'A gentle pulse flows through your veins, sharpening magical recovery.',              apply: (g) => { _pushShrineBuff(g, { type:'mp_regen',      combatsLeft:2, amount:1 }); } },
      { id: 'crit_boost',    label: 'Double crit chance for next 2 combats',   desc: 'Your strikes are guided — the next two battles see twice the chance of a critical.',  apply: (g) => { _pushShrineBuff(g, { type:'crit_boost',    combatsLeft:2, mult:2 }); } },
    ];

    // M343 — known non-heal variants stay as-is.
    const SHRINE_TEXT = {
      empower:     { title: 'Cosmic Shrine',   body: 'Reality bends around this altar. Power radiates from its surface — ancient, vast, unknowable.', btn: 'Accept the Blessing', effect: 'Fully restores HP and MP for every alive member; +5 Fame.', action: () => { [...gs.party, ...gs.companions].forEach(m => { if (m.hp > 0) { m.hp = m.maxHp || 100; m.mp = m.maxMp || 80; } }); GameState.addFame(5); } },
      fullrestore:  { title: 'The Last Shrine', body: 'In the depths of the Void, this shrine stands as the final mercy before the end. It pulses with every color at once.', btn: 'Be Restored', effect: 'Fully restores HP and MP, and revives any fallen members.', action: () => { [...gs.party, ...gs.companions].forEach(m => { m.hp = m.maxHp || 100; m.mp = m.maxMp || 80; m.dead = false; }); } },
    };

    let s;
    if (type === 'heal') {
      // M406: pick a random buff from the pool (seeded by node.id so the
      // same shrine always offers the same buff — no reroll on re-visit).
      let seed = 0;
      for (let i = 0; i < node.id.length; i++) seed = (seed * 31 + node.id.charCodeAt(i)) | 0;
      const pick = BUFF_POOL[((seed >>> 0) % BUFF_POOL.length)];
      s = {
        title: 'Ancient Shrine',
        body: 'A weathered shrine pulses with latent power. Something stirs within.',
        btn: 'Accept the Blessing',
        effect: pick.label,
        action: () => pick.apply(gs),
      };
    } else {
      s = SHRINE_TEXT[type] || SHRINE_TEXT.empower;
    }

    const modal = createEl('div', 'map-modal');
    modal.innerHTML = `
      <div class="mm-overlay"></div>
      <div class="mm-box">
        <div class="mm-title" style="color:#80d0ff">&#10022; ${s.title}</div>
        <div class="mm-body">${s.body}</div>
        ${s.effect ? `<div style="margin:0.7rem 0;padding:0.5rem 0.7rem;background:rgba(80,200,232,0.08);border:1px solid rgba(80,200,232,0.3);border-radius:5px;font-size:0.78rem;color:#a0d8e8"><strong style="color:#80d0ff;letter-spacing:0.06em;text-transform:uppercase;font-size:0.66rem">Blessing:</strong> ${s.effect}</div>` : ''}
        <button type="button" class="mm-btn">${s.btn}</button>
        <button type="button" class="mm-btn" style="background:transparent;border-color:rgba(240,232,216,0.2);margin-top:0.5rem" id="shrine-close">Leave</button>
      </div>
    `;
    modal.querySelector('.mm-overlay')?.addEventListener('click', () => removeEl(modal));
    modal.querySelector('#shrine-close')?.addEventListener('click', () => removeEl(modal));
    modal.querySelector('.mm-btn:not(#shrine-close)')?.addEventListener('click', () => {
      this.audio.playSfx('shrine');
      s.action();
      gs.usedShrines.add(node.id);
      removeEl(modal);
    });
    this._el.appendChild(modal);
  }

  // M302: Skill-check modal. Shows flavor text, stat + DC, roll result, and reward/penalty.
  _showSkillCheckModal(node, _alreadyVisited = false) {
    const gs = GameState.get();
    const sc = node.skillCheck;
    if (!sc) { this._showLoreModal(node); return; }
    // M347 — "already attempted" is tracked via a dedicated set populated
    // ONLY when the player presses Attempt. visitedNodes alone marks the
    // node visited the moment the player walks onto it (which fires before
    // this modal builds), so the prior implementation incorrectly showed
    // "already attempted" on first arrival.
    if (!gs.skillChecksAttempted) gs.skillChecksAttempted = new Set();
    if (Array.isArray(gs.skillChecksAttempted)) {
      // Save migration: convert array (from JSON) to Set.
      gs.skillChecksAttempted = new Set(gs.skillChecksAttempted);
    }
    const already = gs.skillChecksAttempted.has(node.id);
    const party = (gs.party || []).filter(m => m && !(m.isCompanion || m.class === 'companion'));
    const maxStat = Math.max(0, ...party.map(m => m?.attrs?.[sc.stat] || 0));
    const bestMember = party.reduce((best, m) => ((m?.attrs?.[sc.stat] || 0) > (best?.attrs?.[sc.stat] || 0) ? m : best), party[0]);
    const dc = sc.dc || 14;

    const modal = createEl('div', 'map-modal sc-modal');
    modal.innerHTML = `
      <div class="mm-overlay"></div>
      <div class="mm-box">
        <div class="mm-title" style="color:#40c8e0">Skill Challenge</div>
        <div class="sc-name" style="font-family:'Cinzel',serif;font-size:0.9rem;color:#c0b090;margin-bottom:0.5rem">${node.name}</div>
        <div class="mm-body">${sc.flavor}</div>
        <div class="sc-stat-row" style="display:flex;gap:0.8rem;align-items:center;margin:0.8rem 0;padding:0.5rem;background:rgba(64,200,224,0.08);border:1px solid rgba(64,200,224,0.25);border-radius:6px">
          <span style="font-size:0.75rem;color:#8a9ab0;text-transform:uppercase;letter-spacing:0.1em">Stat</span>
          <span style="font-weight:700;color:#40c8e0">${sc.stat}</span>
          <span style="font-size:0.75rem;color:#8a9ab0">Best: <b style="color:#f0e8d8">${maxStat}</b> (${bestMember?.name || '?'})</span>
          <span style="flex:1;text-align:right;font-size:0.75rem;color:#8a9ab0">DC: <b style="color:#f0e8d8">${dc}</b></span>
        </div>
        ${already ? `<div style="font-size:0.75rem;color:#8a7a6a;margin-bottom:0.5rem">You have already attempted this challenge.</div>` : ''}
        <!-- M343 — preview rewards / consequences BEFORE the user attempts so
             they know what's at stake (the user reported clicking Attempt did
             nothing visible because the preview/result distinction wasn't
             clear). The "result" panel below replaces this once attempted. -->
        ${!already ? `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.4rem;font-size:0.72rem;margin-bottom:0.4rem">
          <div style="background:rgba(72,176,96,0.08);border:1px solid rgba(72,176,96,0.3);border-radius:4px;padding:0.4rem 0.55rem;color:#90d0a0">
            <div style="font-weight:700;letter-spacing:0.08em;color:#80d090;text-transform:uppercase;font-size:0.62rem;margin-bottom:0.2rem">Pass</div>
            ${sc.success?.text || ''}
          </div>
          <div style="background:rgba(192,64,48,0.08);border:1px solid rgba(192,64,48,0.3);border-radius:4px;padding:0.4rem 0.55rem;color:#e09080">
            <div style="font-weight:700;letter-spacing:0.08em;color:#e08080;text-transform:uppercase;font-size:0.62rem;margin-bottom:0.2rem">Fail</div>
            ${sc.failure?.text || ''}
          </div>
        </div>` : ''}
        <div id="sc-result" style="min-height:1.5rem"></div>
        <div style="display:flex;gap:0.5rem;margin-top:0.8rem">
          ${!already ? `<button type="button" class="mm-btn" id="sc-attempt" style="flex:1${maxStat >= dc ? ';background:rgba(72,176,96,0.18);border-color:rgba(72,176,96,0.55);color:#a0e0b0' : ''}">${maxStat >= dc ? 'Auto-Pass — Take the Challenge' : `Attempt (${sc.stat} + 1d20 vs DC ${dc})`}</button>` : ''}
          <button type="button" class="mm-btn" id="sc-close" style="flex:1;background:transparent;border-color:rgba(240,232,216,0.2)">${already ? 'Continue' : 'Skip'}</button>
        </div>
      </div>
    `;
    modal.querySelector('.mm-overlay')?.addEventListener('click', () => removeEl(modal));
    modal.querySelector('#sc-close')?.addEventListener('click', () => removeEl(modal));

    const attemptBtn = modal.querySelector('#sc-attempt');
    if (attemptBtn) {
      attemptBtn.addEventListener('click', () => {
        this.audio.playSfx('click');
        // M347 — record the attempt so revisits show "already attempted"
        // even though the node itself is just walked-onto.
        try { gs.skillChecksAttempted.add(node.id); } catch (_) {}
        const roll = Math.floor(Math.random() * 20) + 1;
        const total = maxStat + roll;
        const pass = total >= dc;
        const resultDiv = modal.querySelector('#sc-result');
        const branch = pass ? sc.success : sc.failure;

        // Apply outcomes
        if (pass) {
          if (branch.gold) { gs.gold = (gs.gold || 0) + branch.gold; }
          if (branch.xp) {
            for (const m of party) { m.xp = (m.xp || 0) + branch.xp; }
          }
          if (branch.loreFlag) { gs.storyFlags = gs.storyFlags || {}; gs.storyFlags[branch.loreFlag] = true; }
        } else {
          if (branch.gold) { gs.gold = Math.max(0, (gs.gold || 0) + branch.gold); } // negative gold = loss
          if (branch.hpLoss) {
            for (const m of [...(gs.party || []), ...(gs.companions || [])]) {
              if (m && m.hp > 0) m.hp = Math.max(1, m.hp - branch.hpLoss);
            }
          }
          if (branch.hpLossPct) {
            for (const m of [...(gs.party || []), ...(gs.companions || [])]) {
              if (m && m.hp > 0) m.hp = Math.max(1, Math.floor(m.hp * (1 - branch.hpLossPct)));
            }
          }
          if (branch.statusType) {
            gs._pendingStatusOnNextCombat = gs._pendingStatusOnNextCombat || [];
            gs._pendingStatusOnNextCombat.push({ type: branch.statusType, duration: branch.statusDur || 1 });
          }
        }

        const color = pass ? '#40c8e0' : '#e07060';
        const label = pass ? 'Success!' : 'Failed!';
        // M400+: surface concrete reward/penalty deltas alongside the flavor
        // text so the player knows exactly what they gained or lost.
        const deltas = [];
        if (branch.gold) deltas.push(`<span style="color:${branch.gold > 0 ? '#f0c060' : '#e07060'}">${branch.gold > 0 ? '+' : ''}${branch.gold} Gold</span>`);
        if (branch.xp)   deltas.push(`<span style="color:#a0e0b0">+${branch.xp} XP</span>`);
        if (branch.hpLoss)    deltas.push(`<span style="color:#e07060">-${branch.hpLoss} HP (party)</span>`);
        if (branch.hpLossPct) deltas.push(`<span style="color:#e07060">-${Math.round(branch.hpLossPct * 100)}% HP (party)</span>`);
        if (branch.statusType) deltas.push(`<span style="color:#c890ff">${branch.statusType} ${branch.statusDur || 1}r (next fight)</span>`);
        if (branch.loreFlag)   deltas.push(`<span style="color:#80c0ff">Lore unlocked</span>`);
        const deltaLine = deltas.length ? `<div style="font-size:0.78rem;margin-top:0.35rem;display:flex;flex-wrap:wrap;gap:0.5rem">${deltas.join('')}</div>` : '';
        resultDiv.innerHTML = `
          <div style="color:${color};font-weight:700;margin-bottom:0.3rem">${label} (${sc.stat} ${maxStat} + roll ${roll} = ${total} vs DC ${dc})</div>
          <div style="font-size:0.8rem;color:#c0b090">${branch.text}</div>
          ${deltaLine}
        `;
        if (attemptBtn) { attemptBtn.disabled = true; attemptBtn.style.opacity = '0.4'; }
        this.audio.playSfx(pass ? 'levelup' : 'miss');
      });
    }
    this._el.appendChild(modal);
  }

  _getLoreText(nodeId) {
    const lore = {
      crossroads_b: 'The village is quiet. Too quiet. Scorched thatch still smolders on the rooftops, but the fires are old — three days at least. Whoever — whatever — drove these people out left no bodies. Only silence, and the faint smell of something wrong in the air. Like copper and rot.',
      hidden_path: 'Half-buried in moss, the runestone pulses with a faint, sickly light. The runes are old — older than the kingdom itself. One phrase repeats, carved over and over in increasingly desperate strokes: "The veil does not hold." Mira the Seer would want to know about this.',
    };
    return lore[nodeId] || 'There is nothing more to see here. The road calls you forward.';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // recruitHero dialog outcome handler
  //
  // Spec:
  //  1. Compute avg party level (heroes only, min 1).
  //  2. Open HireBuilderScreen in recruit mode (pre-filled class/name/level).
  //  3. onConfirm: mark the dialog event seen, handle party-size, bench,
  //     thenCombat.
  //  4. onCancel: do NOT mark the event seen — the player keeps the NPC and
  //     can re-walk the node to fire the dialog again (M494: was a soft-lock).
  // ═══════════════════════════════════════════════════════════════════════════

  _handleRecruitHeroOutcome(rh, event) {
    const _rdbg = (...a) => { try { if (window.__recruitDebug) console.log('[recruit]', ...a); } catch {} };
    _rdbg('outcome → handler', { id: rh.id, name: rh.name, classId: rh.classId, classChoices: rh.classChoices, eventId: event?.id });
    // Step 1 — average party level (heroes only, companions excluded)
    const gs = GameState.get();
    const heroMembers = (gs.party || []).filter(p => p && !(p.isCompanion || p.class === 'companion'));
    const avgLevel = heroMembers.length
      ? Math.max(1, Math.round(heroMembers.reduce((s, m) => s + (m.level || 1), 0) / heroMembers.length))
      : 1;

    // Step 2 — open HireBuilderScreen in recruit mode
    // Dynamic import mirrors the pattern used elsewhere in MapScreen for
    // screens that aren't needed on every run.
    import('./HireBuilderScreen.js').then(({ HireBuilderScreen }) => {
      const screen = new HireBuilderScreen(this.manager, this.audio, {
        recruit: {
          id: rh.id,
          name: rh.name,
          classId: rh.classId,
          // M494 — optional list of class ids the player may pick from.
          // When present the builder opens on a themed class-choice step
          // showing ONLY these classes (classId stays the default/first).
          // When absent the builder skips straight to the build step.
          classChoices: Array.isArray(rh.classChoices) && rh.classChoices.length
            ? rh.classChoices
            : null,
          level: avgLevel,

          // Step 3 — onConfirm: mark event seen + party-size logic + thenCombat
          onConfirm: (hero) => {
            const gs3 = GameState.get();
            gs3.bench = gs3.bench || [];
            let recruitorOnBench = false;

            // Now that the recruit is committed, consume the dialog event so
            // the node won't re-fire. (Moved here from outcome-selection time
            // to fix the cancel soft-lock — M494.)
            if (event && !event.repeatable) {
              gs3.seenEvents = gs3.seenEvents || [];
              if (!gs3.seenEvents.includes(event.id)) gs3.seenEvents.push(event.id);
            }
            _rdbg('confirm → hero built', { id: hero.id, name: hero.name, class: hero.class, level: hero.level, partyLen: gs3.party.length });

            if (gs3.party.length < 4) {
              // Slot available — add directly
              gs3.party.push(hero);
              _rdbg('confirm → added to party', { partyLen: gs3.party.length, lastId: gs3.party[gs3.party.length - 1]?.id });
            } else {
              // Party is full — show choice modal
              // We push the hero after the player decides; for now queue it
              // and show the modal. The modal is appended to uiOverlay so it
              // appears above the map (HireBuilderScreen already popped itself).
              this._showRecruitFullPartyModal(hero, rh, (choice) => {
                if (choice === 'bench') {
                  // "Keep on call" — bench the recruit
                  const gs4 = GameState.get();
                  gs4.bench = gs4.bench || [];
                  gs4.bench.push(hero);
                  recruitorOnBench = true;
                  // thenCombat with the existing party (recruit on bench)
                  // Design decision: run the ambush with the current 4 — the
                  // recruit is "fighting their way in" off-panel. Skipping
                  // combat would feel like a free pass; running it with 4
                  // already-established heroes is sane and avoids empty-slot
                  // issues in CombatScreen.
                  if (rh.thenCombat) this._launchRecruitCombat(rh.thenCombat);
                } else {
                  // "Replace 4th hero" — move last party hero to bench
                  const gs4 = GameState.get();
                  gs4.bench = gs4.bench || [];
                  const replaced = gs4.party.splice(gs4.party.length - 1, 1, hero)[0];
                  if (replaced) gs4.bench.push(replaced);
                  if (rh.thenCombat) this._launchRecruitCombat(rh.thenCombat);
                }
              });
              return; // modal handles the rest
            }

            // Party had room; fire thenCombat normally
            if (rh.thenCombat && !recruitorOnBench) {
              _rdbg('confirm → thenCombat', rh.thenCombat);
              this._launchRecruitCombat(rh.thenCombat);
            }
          },

          onCancel: () => {
            // M494 — player closed the builder (✕) without recruiting.
            // The dialog event was deliberately NOT marked seen (see the
            // recruitHero exclusion in the DialogScreen callback above), so
            // the node stays live: walking onto it again re-fires the
            // dialog and the NPC can still be recruited. Nothing to undo —
            // no hero was added, no encounter consumed, no combat queued.
            _rdbg('cancel → recruit aborted; event NOT marked seen, node re-triggerable', { eventId: event?.id });
          },
        },
      });
      this.manager.push(screen);
    }).catch(err => {
      debug('recruitHero: failed to load HireBuilderScreen', err);
    });
  }

  // Resolve and push a CombatScreen for thenCombat (reuses the same resolution
  // logic as startCombat so ENCOUNTERS keys, inline objects, and fallbacks all work).
  _launchRecruitCombat(thenCombat) {
    let enc = null;
    if (typeof thenCombat === 'string' && ENCOUNTERS[thenCombat]) {
      enc = { ...ENCOUNTERS[thenCombat], zoneId: this._zone?.id };
    } else if (thenCombat && typeof thenCombat === 'object' && Array.isArray(thenCombat.enemies)) {
      enc = { ...thenCombat, zoneId: this._zone?.id };
    } else {
      enc = { name: 'Ambush', zoneId: this._zone?.id, enemies: [
        { id: 'bandit', name: 'Bandit', count: 2, hp: 28, maxHp: 28, dmg: [6, 11], armor: 3, hit: 70, dodge: 10, xpValue: 20, gold: [4, 10] },
      ]};
    }
    this.manager.push(new CombatScreen(this.manager, this.audio, null, enc));
  }

  // Full-party choice modal — shown when party is already at 4 members.
  // Choice A: "Keep on call" → recruit goes to gs.bench.
  // Choice B: "Replace my 4th hero" → last party slot is swapped.
  // callback(choice) receives 'bench' or 'replace'.
  _showRecruitFullPartyModal(hero, rh, callback) {
    const modal = createEl('div', 'map-modal');
    const gs = GameState.get();
    const lastHero = gs.party[gs.party.length - 1];
    modal.innerHTML = `
      <div class="mm-overlay"></div>
      <div class="mm-box">
        <div class="mm-title">Your party is full</div>
        <div class="mm-body" style="color:#c0b090;font-size:0.88rem;line-height:1.6;margin-bottom:1rem">
          <strong style="color:#f0e8d8">${hero.name}</strong> is ready to join, but your party has no room.
          What would you like to do?
        </div>
        <div style="display:flex;flex-direction:column;gap:0.6rem">
          <button type="button" class="mm-btn" id="recruit-bench-btn">
            Keep ${hero.name} on call
            <div style="font-size:0.75rem;font-weight:400;color:#a09080;margin-top:0.2rem">They wait in your reserves. Manage via the Party screen.</div>
          </button>
          <button type="button" class="mm-btn" id="recruit-replace-btn"
            style="background:rgba(192,64,48,0.18);border-color:rgba(192,64,48,0.5)">
            Replace ${lastHero ? lastHero.name : 'your 4th hero'} now
            <div style="font-size:0.75rem;font-weight:400;color:#a09080;margin-top:0.2rem">${lastHero ? lastHero.name : 'Your 4th hero'} moves to reserves; ${hero.name} takes the slot.</div>
          </button>
        </div>
      </div>
    `;
    const dismiss = (choice) => {
      removeEl(modal);
      callback(choice);
    };
    modal.querySelector('.mm-overlay').addEventListener('click', () => dismiss('bench'));
    modal.querySelector('#recruit-bench-btn').addEventListener('click', () => { this.audio.playSfx('click'); dismiss('bench'); });
    modal.querySelector('#recruit-replace-btn').addEventListener('click', () => { this.audio.playSfx('click'); dismiss('replace'); });
    // Append to uiOverlay so the modal sits above the map canvas
    this.manager.uiOverlay.appendChild(modal);
  }

  onPause() { if (this._el) this._el.style.display = 'none'; }
  onResume() {
    if (!this._el) return;
    // Check if zone changed (e.g. boss unlocked next zone, or a TPK routed
    // the party back to the nearest town in a different zone).
    const gs = GameState.get();
    const newZone = ALL_ZONES.find(z => z.id === gs.zoneId);
    if (newZone && newZone.id !== this._zone.id) {
      this._zone = newZone;
      removeEl(this._el);
      this._el = null;
      this._build();
      return;
    }
    // M65+ TPK fix: re-run stale-nodeId recovery on resume. Without this, a
    // combat defeat that nulled gs.nodeId leaves MapScreen with no party
    // token and no clickable nodes (the constructor recovery only runs once).
    if (!this._zone.nodes.find(n => n.id === gs.nodeId)) {
      const remembered = GameState.getZoneNode(this._zone.id);
      gs.nodeId = (remembered && this._zone.nodes.find(n => n.id === remembered))
        ? remembered
        : this._zone.nodes[0]?.id;
      if (gs.nodeId) GameState.setZoneNode(this._zone.id, gs.nodeId);
    }
    this._el.style.display = '';
    this._drawMap();
    // M302: bandit overlay chain — after bandit combat, trigger the underlying node.
    const pendingNodeId = gs._overlayPendingNodeId;
    if (pendingNodeId) {
      gs._overlayPendingNodeId = null;
      const pendingNode = this._zone?.nodes.find(n => n.id === pendingNodeId);
      if (pendingNode) {
        setTimeout(() => this._navigateToNodeCore(pendingNode), 300);
        return;
      }
    }
    // M293 — Refresh header badge counts (pending skill/attr/passive points)
    // without a full rebuild. The badge is baked into button text during _build();
    // after LevelUpScreen or SkillTreeScreen exits, auto-applied points may have
    // changed pending counts, so we patch the DOM in-place here.
    this._refreshHeaderBadges();
    // M276 B4: drain pending boss chest as soon as the map becomes the top
    // screen, regardless of whether the player came back via Continue,
    // portal, town visit, or any other path.
    this._maybeOpenBossChest();
  }

  // M293 — Update header badge counts in-place after level-up / skill spend.
  // Reads live GameState and patches the text nodes of the Inventory and Town
  // buttons without triggering a full _build() rebuild (which would discard all
  // event listeners and cause a visual flicker).
  _refreshHeaderBadges() {
    if (!this._el) return;
    const gs = GameState.get();
    const pending = [...(gs.party || []), ...(gs.companions || []), ...(gs.bench || [])]
      .filter(m => !(m.isCompanion || m.class === 'companion'))
      .reduce((s, m) => s + (m.pendingAttrPoints || 0) + (m.pendingSkillPoints || 0) + (m.pendingPassivePoints || 0), 0);

    const badgeHtml = pending > 0
      ? ` <span class="map-hdr-badge">${pending}</span>`
      : '';

    const invBtn = this._el.querySelector('#map-inv');
    const townBtn = this._el.querySelector('#map-town');
    if (invBtn) {
      // Remove any existing badge span, then re-add.
      invBtn.querySelectorAll('.map-hdr-badge').forEach(b => b.remove());
      invBtn.textContent = 'Party';
      if (pending > 0) {
        const b = document.createElement('span');
        b.className = 'map-hdr-badge';
        b.textContent = String(pending);
        invBtn.appendChild(b);
      }
    }
    if (townBtn) {
      townBtn.querySelectorAll('.map-hdr-badge').forEach(b => b.remove());
      // Determine label (Back to Town vs Town).
      const partyZone = (typeof ALL_ZONES !== 'undefined' ? ALL_ZONES : []).find(z => z.id === gs.zoneId);
      const currentNode = partyZone?.nodes?.find(n => n.id === gs.nodeId);
      const atStart = currentNode?.type === 'town';
      const baseLabel = atStart ? '← Back to Town' : 'Town';
      townBtn.textContent = baseLabel;

      // M322 — hide the Town button entirely until the player has actually
      // visited a town once. Prologue has no towns, so the button is
      // meaningless on first run.
      const visited = gs.visitedTowns || [];
      const everVisitedTown = Array.isArray(visited) ? visited.length > 0 : !!visited.size;
      // Fallback heuristic for older saves without visitedTowns: the Border
      // Roads / Emberglen unlock implies a town is reachable.
      const hasReachableTown = (gs.unlockedZones || []).some(z => z !== 'prologue');
      if (!everVisitedTown && !hasReachableTown) {
        townBtn.style.display = 'none';
      } else {
        townBtn.style.display = '';
      }

      // M322 — bubbles on Town show new-content (unlocks, quest completions),
      // NOT skill points. Skill points belong to the Party button only.
      const newUnlocks = gs._townNewBadge?.unlocks || 0;
      const questsReady = (gs.quests || []).filter(q => q && q.complete && !q.turnedIn).length;
      const townBadge = newUnlocks + questsReady;
      if (townBadge > 0) {
        const b = document.createElement('span');
        b.className = 'map-hdr-badge';
        b.textContent = String(townBadge);
        townBtn.appendChild(b);
      }
    }
  }

  // M-followup: post-combat "pick 1 of 3" boss chest was removed per design
  // feedback. Boss loot is now fully awarded via the victory modal. This
  // method is kept as a no-op (still called from onEnter/onResume) and also
  // cleans up legacy chest state so older saves don't carry it forward.
  _maybeOpenBossChest() {
    const gs = GameState.get();
    if (gs && (gs._bossChestItems || gs._bossChestNodeId || gs._bossChestPending)) {
      gs._bossChestItems = null;
      gs._bossChestNodeId = null;
      gs._bossChestPending = null;
    }
  }

  _showBossChestModal(items) {
    const modal = createEl('div', 'map-modal');
    modal.setAttribute('data-chest', 'boss');
    // Rarity border/text colors — no character-suggestion green, rarity only.
    const RAR_COLOR = { normal:'#aaa8a0', magic:'#55aaff', rare:'#88ccff', legendary:'#ffbb44' };
    const RAR_BG    = { normal:'rgba(160,156,148,0.10)', magic:'rgba(85,170,255,0.10)', rare:'rgba(136,204,255,0.10)', legendary:'rgba(255,187,68,0.12)' };

    // M322: detect upgrade target per item (best member it'd improve).
    // The card keeps its rarity color; a light-blue star sits to the LEFT of
    // the card with a tooltip naming the would-be wearer, and an "Auto Equip"
    // indicator hints that the hero will equip it on pick (whether or not
    // their per-character autoEquip flag is currently on — the chest pick is
    // explicit consent).
    const _gs = GameState.get();
    const _candidates = [..._gs.party, ..._gs.companions].filter(c => c && !(c.isCompanion && c.class === 'companion'));
    const findUpgradeTarget = (item) => {
      let best = null, bestDelta = 0;
      for (const ch of _candidates) {
        // Reuse InventoryScreen's tier logic inline — but simpler: any positive
        // score delta vs current equipped in any matching slot is "upgrade".
        try {
          const slots = [];
          if (item.type === 'weapon') slots.push('weapon');
          if (item.type === 'armor' && item.subtype) slots.push(item.subtype);
          if (item.type === 'accessory') {
            if (item.subtype === 'ring') { slots.push('ring1','ring2'); }
            else if (item.subtype) slots.push(item.subtype);
          }
          const eqp = ch.equipment || {};
          const itScore = computeItemScores(item, ch).total;
          for (const s of slots) {
            const cur = eqp[s];
            const curScore = cur ? computeItemScores(cur, ch).total : 0;
            const delta = itScore - curScore;
            if (!cur) {
              // Empty slot — treat as moderate upgrade.
              if (delta > bestDelta) { bestDelta = delta || 0.0001; best = ch; }
            } else if (delta > bestDelta) {
              bestDelta = delta; best = ch;
            }
          }
        } catch (_) {}
      }
      return best;
    };

    const itemsHtml = items.map((it, idx) => {
      const col = RAR_COLOR[it.rarity] || '#c0b090';
      const bg  = RAR_BG[it.rarity]   || 'rgba(255,255,255,0.06)';
      const rarLabel = (it.rarity || '').charAt(0).toUpperCase() + (it.rarity || '').slice(1);
      const typeLabel = it.subtype || it.type || '';
      // M335 — affix labels were rendering the affix flavor name ("Deadly: 8%")
      // which doesn't tell the player what the stat actually is. Map to a
      // human label first ("8% Crit Chance"), with a small subset that always
      // goes flavor-first ("Of Opening: 25% First-hit Crit").
      const STAT_HUMAN = {
        critChance: 'Crit Chance', critDamage: 'Crit Damage',
        spellPower: 'Spell Power', initiative: 'Initiative',
        manaRegen: 'Mana Regen', lifeSteal: 'Life Steal', manaSteal: 'Mana Steal',
        goldFind: 'Gold Find', xpFind: 'XP Find', tradePrices: 'Trade Prices',
        blockChance: 'Block Chance', blockPower: 'Block Power',
        magicResist: 'Magic Resist', dmgReduction: 'Damage Reduction',
        hp: 'Max HP', mp: 'Max MP', armor: 'Armor',
        STR: 'Strength', DEX: 'Dexterity', INT: 'Intelligence', CON: 'Constitution',
        attackPower: 'Attack Power', dodge: 'Dodge', hit: 'Hit',
      };
      const labelFor = (a) => {
        // Use the stat's human label if we know it.
        if (a.stat && STAT_HUMAN[a.stat]) return STAT_HUMAN[a.stat];
        // Stat with a 'cond_' prefix or unknown: fall back to descriptor or affix name.
        if (a.descriptor) {
          const d = String(a.descriptor).toLowerCase();
          return d.replace(/\b\w/g, c => c.toUpperCase());
        }
        return a.name || a.stat || '?';
      };
      const formatVal = (a) => {
        const v = a.value;
        if (typeof v !== 'number') return '';
        // Fractions in the 0..1 range mean a percentage (crit chance, etc.).
        if (v > 0 && v < 1) return `${(v * 100).toFixed(0)}%`;
        return `+${Math.round(v)}`;
      };
      const affixLines = (it.affixes || [])
        .filter(a => !a.baseIntrinsic && a.stat !== 'cond_legendaryEffect')
        .slice(0, 3)
        .map(a => `<div style="font-size:0.68rem;color:#c0b090;margin-top:1px">${formatVal(a)} ${labelFor(a)}</div>`)
        .join('');
      const target = findUpgradeTarget(it);
      const upgradeBadge = target ? `
        <div class="bcm-upgrade-flag" title="Upgrade for ${target.name}" style="display:flex;flex-direction:column;align-items:center;gap:0.2rem;flex-shrink:0;width:48px;padding-top:0.15rem">
          <span aria-label="Upgrade" title="Upgrade for ${target.name}" style="color:#88ccff;font-size:1.1rem;line-height:1">★</span>
          <span style="font-size:0.55rem;letter-spacing:0.04em;color:#88ccff;text-align:center;line-height:1.1">✓ Auto<br/>Equip</span>
        </div>` : `<div style="width:48px;flex-shrink:0"></div>`;
      return `
        <div class="boss-chest-row" data-pick-idx="${idx}" style="display:flex;align-items:stretch;gap:0.4rem">
          ${upgradeBadge}
          <button type="button" class="boss-chest-pick-btn" data-pick-idx="${idx}" data-upgrade-for="${target ? target.id : ''}"
            style="display:block;flex:1;text-align:left;padding:0.75rem 0.9rem;
                   background:${bg};border:2px solid ${col};border-radius:8px;
                   cursor:pointer;transition:filter 0.12s;font-family:inherit;">
            <div style="color:${col};font-weight:700;font-size:0.9rem">${it.name}</div>
            <div style="color:#8a7a6a;font-size:0.7rem;margin-top:2px">${typeLabel} &middot; ${rarLabel}${it.quality ? ' &middot; ' + it.quality : ''}</div>
            ${affixLines}
          </button>
        </div>`;
    }).join('');

    modal.innerHTML = `
      <div class="mm-overlay"></div>
      <div class="mm-box" style="max-width:420px">
        <div class="mm-title" style="color:#e8a020">Boss Loot Chest</div>
        <div class="mm-body" style="margin-bottom:0.75rem;color:#c0b090;font-size:0.85rem">
          A heavy iron chest sits where the boss fell. Choose one reward to keep.
        </div>
        <div style="display:flex;flex-direction:column;gap:0.5rem;margin-bottom:1rem;">
          ${itemsHtml}
        </div>
      </div>
    `;

    modal.querySelectorAll('.boss-chest-pick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.pickIdx, 10);
        const chosen = items[idx];
        if (!chosen) return;
        this.audio.playSfx('victory');
        const gs = GameState.get();
        GameState.addToInventory(chosen);
        // M322: if the chest item is an upgrade for a hero, equip it onto
        // them right away (chest pick is explicit consent — auto-equip flag
        // not required).
        const upgradeForId = btn.dataset.upgradeFor;
        if (upgradeForId) {
          try {
            const ch = [...gs.party, ...gs.companions].find(m => m && m.id === upgradeForId);
            if (ch) {
              const wasOn = ch.autoEquip;
              ch.autoEquip = true;
              gs.tryAutoEquip(chosen);
              ch.autoEquip = wasOn;
            }
          } catch (_) {}
        }
        try {
          import('../../game/stats.js').then(m => {
            m.recordDrop(chosen, { zoneId: gs.zoneId, source: 'chest' });
          });
        } catch (_) {}
        gs._bossChestItems = null;
        gs._bossChestNodeId = null;
        gs._bossChestPending = null;
        removeEl(modal);
        // M322: auto-save right after the chest is resolved so the pick
        // survives an accidental town-screen kick or page reload.
        try {
          import('../../engine/SaveManager.js').then(m => {
            const SM = m.SaveManager || m.default;
            if (SM && typeof SM.saveCurrentGame === 'function') {
              SM.saveCurrentGame();
            }
          });
        } catch (_) {}
      });
    });
    // Overlay click is intentionally non-dismissing — the chest is mandatory.
    this._el.appendChild(modal);
  }
  update(dt) {
    this._t += dt;
    if (this._travel) {
      this._travel.elapsed += dt;
      if (this._travel.elapsed >= this._travel.duration) {
        const node = this._travel.node;
        this._travel = null;
        this._navigateToNode(node);
        return;
      }
    }
    if (this._canvas) this._drawMap();
  }
  draw() {}
  onExit() { if (this._el) kbUnmount(this._el); removeEl(this._el); this._el = null; }
  destroy() {
    if (this._escHandler) {
      window.removeEventListener('keydown', this._escHandler);
      this._escHandler = null;
      this._escBound = false;
    }
    if (this._el) kbUnmount(this._el);
    removeEl(this._el);
    this._el = null;
  }
}

const MAP_STYLES = `
.map-screen {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  background: #08100a; font-family: 'Inter', sans-serif; color: #f0e8d8;
}
.map-header {
  display: flex; flex-direction: column; gap: 0;
  border-bottom: 1px solid rgba(232,160,32,0.15);
  background: rgba(0,0,0,0.3); flex-shrink: 0;
}
.map-header-row {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.5rem 1rem;
}
.map-zone-tabs {
  display: flex; gap: 0.35rem; overflow-x: auto; white-space: nowrap;
  -webkit-overflow-scrolling: touch; scrollbar-width: none;
  padding: 0.25rem 0.75rem 0.5rem; width: 100%; box-sizing: border-box;
}
.map-zone-tabs::-webkit-scrollbar { display: none; }
.mzt {
  padding: 0.4rem 0.75rem; border-radius: 6px; min-height: 44px; min-width: 44px;
  border: 1px solid rgba(64,168,96,0.25); background: rgba(64,168,96,0.06);
  color: #6ab87a; font-size: 0.72rem; cursor: pointer; font-family: 'Inter', sans-serif;
  transition: background 0.12s; flex-shrink: 0;
}
.mzt:hover { background: rgba(64,168,96,0.14); }
.mzt.active { background: rgba(64,168,96,0.18); border-color: rgba(64,168,96,0.5); color: #90d8a0; font-weight: 600; }
.mzt-new { border-color: rgba(232,160,32,0.5); color: #e8a020; animation: mzt-pulse 2s ease-in-out infinite; }
@keyframes mzt-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(232,160,32,0); } 50% { box-shadow: 0 0 8px 2px rgba(232,160,32,0.4); } }
.mzt-badge { font-size: 0.5rem; font-weight: 700; padding: 0.1rem 0.3rem; background: rgba(232,160,32,0.25); border-radius: 3px; color: #e8a020; vertical-align: middle; margin-left: 0.3em; }
.mzt-star { color: #f5d97a; font-size: 0.85em; margin-right: 0.1em; font-variant-emoji: text; }
/* M294 — zone dropdown (shown when 4+ zones unlocked) */
.mzt-dropdown {
  appearance: none; -webkit-appearance: none;
  background: rgba(16,10,20,0.9) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='7'%3E%3Cpath d='M0 0l5 7 5-7z' fill='%23e8c840'/%3E%3C/svg%3E") no-repeat right 0.6rem center / 10px 7px;
  border: 1px solid rgba(64,168,96,0.4);
  color: #90d8a0;
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.78rem;
  padding: 0.35rem 2rem 0.35rem 0.7rem;
  border-radius: 4px; cursor: pointer;
  min-height: 36px; flex-shrink: 0;
  max-width: 260px;
  outline-offset: 2px;
}
.mzt-dropdown:focus { outline: 2px solid rgba(232,200,64,0.7); border-color: rgba(232,200,64,0.6); }
.mzt-dropdown option { background: #120c1a; color: #d4c88a; }
.map-hdr-badge { background:#c04030; color:#fff; font-size:0.55rem; padding:0.1rem 0.3rem; border-radius:8px; margin-left:0.3rem; vertical-align: middle; display: inline-block; }
.map-back {
  background: none; border: none; color: #8a7a6a; font-size: 0.8rem;
  cursor: pointer; padding: 0.4rem 0.6rem; border-radius: 4px; min-height: 36px;
}
.map-back:hover { color: #f0e8d8; }
.map-back[disabled] { opacity: 0.4; cursor: not-allowed; }
.map-toolbtn {
  background: rgba(20,16,12,0.6); border: 1px solid rgba(232,160,32,0.3);
  color: #e8d090; font-size: 0.75rem; cursor: pointer;
  padding: 0.4rem 0.7rem; border-radius: 4px; min-height: 44px; min-width: 44px;
  font-weight: 600; letter-spacing: 0.04em;
}
.map-toolbtn:hover { background: rgba(232,160,32,0.15); color: #f8e0a0; }
.map-zone-name { font-family: 'Cinzel', serif; font-size: 1.1rem; font-weight: 700; color: #e8a020; flex: 1; }
.map-act-tag { font-size: 0.65rem; font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase; color: #40a860; }
/* M345-fix: allow horizontal scroll on narrow viewports (iPhone portrait)
   so the canvas internal min-width (760px in _setupCanvas) gives every
   node a ~40-55px tap-target gap from its neighbour. Desktop wraps fit
   the viewport without scrolling because clientWidth >= MIN_CANVAS_W. */
.map-canvas-wrap {
  flex: 1; position: relative;
  overflow-x: auto; overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  scroll-behavior: smooth;
}
#map-canvas { width: 100%; height: 100%; display: block; cursor: pointer; }
.map-node-tooltip {
  position: absolute; pointer-events: none; z-index: 10;
  background: rgba(10,6,8,0.92); border: 1px solid rgba(232,160,32,0.3);
  border-radius: 6px; padding: 0.4rem 0.75rem;
}
.mntt-name { font-size: 0.82rem; font-weight: 600; font-family: 'Cinzel', serif; }
.mntt-type { font-size: 0.68rem; margin-top: 0.1rem; }
.map-legend {
  display: flex; flex-wrap: wrap; gap: 0.75rem 1.5rem;
  padding: 0.5rem 1.5rem; border-top: 1px solid rgba(255,255,255,0.06);
  background: rgba(0,0,0,0.2); flex-shrink: 0;
}
.legend-item { display: flex; align-items: center; gap: 0.4rem; font-size: 0.68rem; color: #8a7a6a; }
.legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
/* M347 — position: fixed so the modal covers the viewport, not the
   scrollable .map-canvas-wrap (which is now wider than viewport on
   iPhone portrait). Previously the modal lived inside the scroll
   container and rendered partly off-screen, making boss-chest taps
   land on dead space. */
.map-modal {
  position: fixed; inset: 0; z-index: 1500;
  display: flex; align-items: center; justify-content: center;
}
.mm-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.75); }
.mm-box {
  position: relative; z-index: 1;
  background: #1a1218; border: 1px solid rgba(232,160,32,0.3);
  border-radius: 12px; padding: 2rem; max-width: 420px; width: 90%;
  max-height: 90vh; overflow-y: auto;
}
.mm-title { font-family: 'Cinzel', serif; font-size: 1.2rem; font-weight: 700; color: #f0e8d8; margin-bottom: 1rem; }
.mm-body { margin-bottom: 1.5rem; }
.mm-btn {
  padding: 0.7rem 1.5rem; background: rgba(232,160,32,0.15);
  border: 1px solid rgba(232,160,32,0.4); border-radius: 6px;
  color: #e8a020; font-family: 'Cinzel', serif; font-weight: 700;
  cursor: pointer; min-height: 44px;
}
.mm-btn:hover { background: rgba(232,160,32,0.28); }
.boss-chest-pick-btn:hover { filter: brightness(1.18); }
.map-portal-bar {
  display: flex; justify-content: center; padding: 0.4rem 1rem;
  background: rgba(232,180,40,0.06); border-top: 1px solid rgba(232,180,40,0.15);
  flex-shrink: 0;
}
.portal-bar-btn {
  padding: 0.5rem 1.2rem; border-radius: 6px; min-height: 40px;
  background: rgba(232,180,40,0.12); border: 1px solid rgba(232,180,40,0.4);
  color: #e8b428; font-family: 'Cinzel', serif; font-weight: 700; font-size: 0.8rem;
  cursor: pointer; transition: background 0.12s;
}
.portal-bar-btn:hover { background: rgba(232,180,40,0.25); }
.czb-back-popup {
  position: absolute; z-index: 30;
  background: rgba(10,6,8,0.95); border: 1px solid rgba(232,192,96,0.6);
  border-radius: 8px; padding: 0.55rem 0.9rem;
  display: flex; align-items: center; gap: 0.7rem;
  box-shadow: 0 2px 12px rgba(0,0,0,0.7);
  pointer-events: auto;
  font-family: Inter, sans-serif;
}
.czb-label { font-size: 0.8rem; color: #f0e8d8; flex: 1; line-height: 1.3; }
.czb-label strong { color: #f0d890; }
.czb-ok-btn {
  background: rgba(232,192,96,0.18); border: 1px solid rgba(232,192,96,0.55);
  color: #f0d890; font-family: 'Cinzel', serif; font-size: 0.75rem; font-weight: 700;
  padding: 0.35rem 0.85rem; border-radius: 5px; cursor: pointer;
  min-height: 36px; white-space: nowrap;
}
.czb-ok-btn:hover { background: rgba(232,192,96,0.32); }
`;
