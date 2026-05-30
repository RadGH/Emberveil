import { GameState } from '../../game/gameState.js';
import { createEl, injectStyles, removeEl } from '../../utils/dom.js';
import { currentMap, visitNode } from '../../story/storyMapMutations.js';
import { nodeTypeLabel, pointFor, regionViewModel, roadPath } from '../../story/storyMapRendererShared.js';
import { getOpenOutgoing } from '../../story/storyMapGraph.js';
import { recordTick } from '../../story/storyLedger.js';

export class StoryMapScreen {
  constructor(manager, audio) {
    this.manager = manager;
    this.audio = audio;
    this._el = null;
    this._regionIndex = 0;
    this._selectedNodeId = null;
    this._drawerExpanded = false;
    this._touchStart = null;
  }

  onEnter() {
    injectStyles('story-map-styles', STORY_MAP_STYLES);
    this._el = createEl('div', 'story-map-screen');
    this.manager.uiOverlay.appendChild(this._el);
    this._render();
  }

  _render() {
    const gs = GameState.get();
    const { graph, mapSave } = currentMap(gs);
    this._el.className = `story-map-screen${this._drawerExpanded ? ' drawer-expanded' : ''}`;
    this._regionIndex = Math.max(0, Math.min(this._regionIndex, graph.subRegions.length - 1));
    const view = regionViewModel(graph, mapSave, this._regionIndex);
    const currentNode = graph.nodes[gs.story.currentNodeId] || graph.nodes[graph.entryNodeId];
    const selected = this._selectedNodeId ? graph.nodes[this._selectedNodeId] : currentNode;
    const selectedSave = mapSave.nodes[selected.id];
    const reachable = new Set(getOpenOutgoing(graph, mapSave, gs.story.currentNodeId).map(edge => edge.to));
    reachable.add(gs.story.currentNodeId);
    const regionNodeSet = new Set(view.region.nodeIds);
    const crossEdges = mapSave.edges.filter(edge => regionNodeSet.has(edge.from) && !regionNodeSet.has(edge.to) && edge.kind === 'open');
    const regionLocked = view.nodes.every(node => mapSave.nodes[node.id]?.visibility !== 'visible');

    this._el.innerHTML = `
      <header class="sms-topbar">
        <button type="button" class="sms-back" id="sms-back">Title</button>
        <div class="sms-heading">
          <div class="sms-kicker">Act ${gs.story.act} · ${gs.story.storytellerId}</div>
          <div class="sms-title">${view.region.name}</div>
        </div>
        <button type="button" class="sms-pressure" id="sms-pressure" aria-expanded="false">Pressure ${gs.story.pressureMeter || 0}</button>
      </header>
      <main class="sms-map-wrap" id="sms-map-wrap">
        <div class="sms-biome sms-biome-${view.region.biome}"></div>
        <svg class="sms-roads" viewBox="0 0 360 480" aria-hidden="true">
          ${view.edges.map(edge => this._roadSvg(graph, edge)).join('')}
          ${crossEdges.length ? '<path class="sms-road sms-road-cross" d="M 314 238 C 344 238, 344 238, 374 238"></path>' : ''}
        </svg>
        ${crossEdges.length ? '<button type="button" class="sms-cross-arrow" id="sms-cross-arrow" aria-label="Next sub-region">Next Region</button>' : ''}
        ${regionLocked ? '<div class="sms-region-lock">Locked until a prior region node is visited</div>' : ''}
        ${view.nodes.map(node => this._nodeButton(node, mapSave.nodes[node.id], reachable.has(node.id), currentNode.id === node.id)).join('')}
      </main>
      <nav class="sms-pager" aria-label="Sub-region pagination">
        <button type="button" class="sms-page" id="sms-prev" ${this._regionIndex === 0 ? 'disabled' : ''}>Prev</button>
        <div class="sms-page-count">${this._regionIndex + 1} / ${graph.subRegions.length}</div>
        <button type="button" class="sms-page" id="sms-next" ${this._regionIndex === graph.subRegions.length - 1 ? 'disabled' : ''}>Next</button>
      </nav>
      ${this._drawer(selected, selectedSave, reachable.has(selected.id), currentNode.id === selected.id)}
    `;

    this._bind(graph);
  }

  _roadSvg(graph, edge) {
    const from = graph.nodes[edge.from];
    const to = graph.nodes[edge.to];
    if (!from || !to) return '';
    return `<path class="sms-road sms-road-${edge.kind}" d="${roadPath(from, to)}"></path>`;
  }

  _nodeButton(node, save, reachable, current) {
    const p = pointFor(node);
    const locked = save.visibility !== 'visible';
    const classes = [
      'sms-node',
      `sms-node-${node.type}`,
      save.state,
      locked ? 'fogged' : '',
      reachable ? 'reachable' : '',
      current ? 'current' : '',
      save.overlay ? `overlay-${save.overlay}` : '',
    ].filter(Boolean).join(' ');
    return `
      <button type="button" class="${classes}" data-node-id="${node.id}" ${locked ? 'disabled' : ''}
        style="left:calc(50% - 180px + ${p.x}px);top:calc(50% - 240px + ${p.y}px)" aria-label="${nodeTypeLabel(node.type)} ${node.id}">
        <span>${iconFor(node.type)}</span>
      </button>
    `;
  }

  _drawer(node, save, reachable, current) {
    const canTravel = reachable && !current && save.visibility === 'visible';
    const waypoint = save.waypointState ? `<span class="sms-chip">Waypoint: ${save.waypointState}</span>` : '';
    return `
      <aside class="sms-drawer${this._drawerExpanded ? ' expanded' : ''}">
        <button type="button" class="sms-drawer-grip" id="sms-drawer-toggle" aria-expanded="${this._drawerExpanded}"></button>
        <div class="sms-drawer-row">
          <div>
            <div class="sms-node-type">${nodeTypeLabel(node.type)}</div>
            <div class="sms-node-id">${node.id}</div>
          </div>
          <span class="sms-chip">${save.state}</span>
        </div>
        <div class="sms-chip-row">
          <span class="sms-chip">${node.biome}</span>
          ${waypoint}
        </div>
        <p class="sms-node-copy">Not done yet: node-specific dialog, encounters, rewards, and quest outcomes land in later redo milestones. This node can still be visited now to exercise map state, fog, saves, and pagination.</p>
        <button type="button" class="sms-travel" id="sms-travel" ${canTravel ? '' : 'disabled'}>${current ? 'Current Node' : 'Travel'}</button>
      </aside>
    `;
  }

  _bind(graph) {
    this._el.querySelector('#sms-back').addEventListener('click', () => {
      this.audio.playSfx('click');
      this.manager.pop();
    });
    this._el.querySelector('#sms-prev').addEventListener('click', () => this._page(-1, graph));
    this._el.querySelector('#sms-next').addEventListener('click', () => this._page(1, graph));
    this._el.querySelector('#sms-cross-arrow')?.addEventListener('click', () => this._page(1, graph));
    this._el.querySelector('#sms-drawer-toggle').addEventListener('click', () => {
      this._drawerExpanded = !this._drawerExpanded;
      this._render();
    });
    this._el.querySelector('#sms-pressure').addEventListener('click', e => {
      e.currentTarget.classList.toggle('expanded');
      e.currentTarget.setAttribute('aria-expanded', e.currentTarget.classList.contains('expanded') ? 'true' : 'false');
    });
    this._el.querySelectorAll('[data-node-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.audio.playSfx('click');
        this._selectedNodeId = btn.dataset.nodeId;
        this._drawerExpanded = true;
        this._render();
      });
    });
    this._el.querySelector('#sms-travel').addEventListener('click', () => {
      const gs = GameState.get();
      const nodeId = this._selectedNodeId;
      if (!nodeId || !visitNode(gs, nodeId)) return;
      recordTick(gs, { nodeId, nodeType: graph.nodes[nodeId]?.type, outcomeId: 'visited' });
      this.audio.playSfx('click');
      this._regionIndex = graph.nodes[nodeId]?.regionIndex || this._regionIndex;
      this._render();
    });
    const wrap = this._el.querySelector('#sms-map-wrap');
    wrap.addEventListener('touchstart', e => { this._touchStart = e.touches[0].clientX; }, { passive: true });
    wrap.addEventListener('touchend', e => {
      if (this._touchStart == null) return;
      const dx = e.changedTouches[0].clientX - this._touchStart;
      this._touchStart = null;
      if (Math.abs(dx) > 60) this._page(dx < 0 ? 1 : -1, graph);
    }, { passive: true });
  }

  _page(delta, graph) {
    const next = Math.max(0, Math.min(graph.subRegions.length - 1, this._regionIndex + delta));
    if (next === this._regionIndex) return;
    this.audio.playSfx('click');
    this._regionIndex = next;
    this._selectedNodeId = graph.subRegions[next].nodeIds[0];
    this._render();
  }

  update() {}
  draw() {}
  onExit() { removeEl(this._el); this._el = null; }
  destroy() { this.onExit(); }
}

function iconFor(type) {
  const icons = { combat: 'X', dialog: '?', shrine: '+', lore: 'L', merchant: '$', rest: 'R', event: '!', boss: 'B' };
  return icons[type] || '!';
}

const STORY_MAP_STYLES = `
.story-map-screen { position: absolute; inset: 0; overflow: hidden; background: #070409; color: #f0e8d8; font-family: Inter, sans-serif; }
.sms-topbar { position: absolute; top: 0; left: 0; right: 0; z-index: 5; min-height: 72px; display: grid; grid-template-columns: 64px 1fr 104px; gap: 0.5rem; align-items: center; padding: calc(0.6rem + env(safe-area-inset-top, 0px)) 0.75rem 0.55rem; background: rgba(8,5,10,0.92); border-bottom: 1px solid rgba(232,160,32,0.18); }
.sms-back, .sms-pressure, .sms-page, .sms-travel { min-height: 44px; border-radius: 6px; border: 1px solid rgba(232,160,32,0.28); background: rgba(232,160,32,0.12); color: #f0c060; font-weight: 700; cursor: pointer; }
.sms-back { color: #c8b89c; background: rgba(0,0,0,0.18); }
.sms-heading { min-width: 0; text-align: center; }
.sms-kicker { color: #9c8c78; font-size: 0.64rem; text-transform: uppercase; letter-spacing: 0.08em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sms-title { color: #f0c060; font-family: Cinzel, serif; font-weight: 700; font-size: 1rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sms-pressure { font-size: 0.7rem; overflow: hidden; }
.sms-pressure.expanded::after { content: " · Calm/Tense bands arrive with Director tuning"; display: block; color: #c8b89c; font-size: 0.58rem; font-weight: 400; }
.sms-map-wrap { position: absolute; top: 72px; left: 0; right: 0; bottom: 156px; overflow: hidden; touch-action: pan-y; }
.sms-biome { position: absolute; inset: 0; opacity: 0.28; background-size: cover; background-position: center; }
.sms-biome-emberwood, .sms-biome-fen, .sms-biome-gloomridge { background: #163222; }
.sms-biome-stoneward, .sms-biome-old_road { background: #34302b; }
.sms-biome-veilscar, .sms-biome-riftgate { background: #301d38; }
.sms-biome-ash_plains, .sms-biome-ember_hollow { background: #3a251f; }
.sms-biome-library_ruins, .sms-biome-architects_verge { background: #26313a; }
.sms-roads { position: absolute; left: 50%; top: 50%; width: 360px; height: 480px; transform: translate(-50%, -50%); overflow: visible; }
.sms-road { fill: none; stroke: rgba(232,160,32,0.42); stroke-width: 3; stroke-linecap: round; }
.sms-road-hidden { stroke: rgba(140,110,90,0.25); stroke-dasharray: 7 8; }
.sms-road-locked { stroke: rgba(192,64,48,0.38); stroke-dasharray: 4 8; }
.sms-road-cross { stroke: rgba(96,192,160,0.6); stroke-dasharray: 9 7; }
.sms-cross-arrow { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); min-height: 44px; border: 1px solid rgba(96,192,160,0.5); border-radius: 999px; background: rgba(8,36,34,0.9); color: #9ee5cf; font-size: 0.7rem; font-weight: 800; cursor: pointer; }
.sms-region-lock { position: absolute; left: 50%; top: 50%; width: min(290px, calc(100% - 2rem)); transform: translate(-50%, -50%); border: 1px solid rgba(232,160,32,0.25); border-radius: 8px; background: rgba(8,5,10,0.86); color: #c8b89c; padding: 0.9rem; text-align: center; font-size: 0.78rem; z-index: 2; }
.sms-node { position: absolute; width: 48px; height: 48px; margin: -24px 0 0 -24px; border-radius: 50%; border: 2px solid rgba(232,160,32,0.42); background: #1a1218; color: #f0e8d8; cursor: pointer; font-weight: 800; box-shadow: 0 6px 16px rgba(0,0,0,0.35); }
.sms-node span { pointer-events: none; }
.sms-node.reachable { border-color: #e8a020; }
.sms-node.current { outline: 3px solid rgba(96,192,160,0.8); }
.sms-node.visited, .sms-node.cleared { background: #253427; }
.sms-node-boss { background: #3b1518; color: #ffb09a; }
.sms-node-shrine, .sms-node-rest { background: #182d30; }
.sms-node-lore, .sms-node-dialog { background: #201d35; }
.sms-node.fogged { background: #101014; border-color: rgba(120,110,110,0.25); color: #595050; }
.sms-pager { position: absolute; left: 0; right: 0; bottom: 128px; z-index: 4; display: grid; grid-template-columns: 92px 1fr 92px; gap: 0.6rem; align-items: center; padding: 0.55rem 0.75rem; background: rgba(8,5,10,0.76); transition: bottom 0.2s ease; }
.story-map-screen.drawer-expanded .sms-pager { bottom: 360px; }
.sms-page:disabled, .sms-travel:disabled { opacity: 0.4; cursor: default; }
.sms-page-count { color: #c8b89c; text-align: center; font-size: 0.78rem; }
.sms-drawer { position: absolute; left: 0; right: 0; bottom: 0; z-index: 6; height: 128px; max-height: 360px; overflow: hidden; background: rgba(12,8,13,0.98); border-top: 1px solid rgba(232,160,32,0.22); padding: 0.45rem 0.85rem calc(0.85rem + env(safe-area-inset-bottom, 0px)); transform: translateY(0); transition: height 0.2s ease; }
.sms-drawer.expanded { height: 360px; overflow-y: auto; }
.sms-drawer-grip { display: block; width: 56px; height: 18px; min-height: 18px; border: 0; border-radius: 999px; background: rgba(232,160,32,0.32); margin: 0 auto 0.35rem; cursor: pointer; }
.sms-drawer-row { display: flex; justify-content: space-between; gap: 0.75rem; align-items: flex-start; }
.sms-node-type { font-family: Cinzel, serif; color: #f0c060; font-weight: 700; }
.sms-node-id { color: #9c8c78; font-size: 0.65rem; overflow-wrap: anywhere; }
.sms-chip-row { display: flex; gap: 0.35rem; flex-wrap: wrap; margin-top: 0.45rem; }
.sms-chip { border: 1px solid rgba(232,160,32,0.18); border-radius: 999px; color: #c8b89c; padding: 0.2rem 0.45rem; font-size: 0.65rem; }
.sms-node-copy { color: #b8a890; font-size: 0.73rem; line-height: 1.45; margin: 0.65rem 0; }
.sms-travel { width: 100%; }
@media (min-width: 560px) { .sms-map-wrap { left: 50%; width: 520px; transform: translateX(-50%); } .sms-topbar, .sms-pager, .sms-drawer { left: 50%; width: 520px; transform: translateX(-50%); } }
`;
