/**
 * storyMapRendererShared.js — Pure canvas rendering helpers for the story map.
 *
 * Shared between StoryMapScreen.js (in-game) and future tool pages
 * (story-inspector.html, quest-graph.html). No imports from game engine —
 * pure canvas + geometry only.
 *
 * Node geometry per §13.3:
 *   Visual: 32 px diameter
 *   Hit:    48 px diameter (8 px transparent halo)
 *   Min center-to-center: 56 px horizontal / 48 px vertical
 *
 * Coordinate system:
 *   nodeXYFromLane() maps (lane, col, regionWidth, regionHeight) -> { x, y }
 *   in CSS pixels. The caller applies canvas translation + DPR scaling.
 *
 * ─── Biome Background API (M518c) ────────────────────────────────────────────
 * Export: drawBiomeBackground(ctx, biome, w, h, t, onReady?)
 *
 *   ctx    — CanvasRenderingContext2D
 *   biome  — one entry from data/story/canonical-biomes.json (must have palette[];
 *            optionally backgroundImage, backgroundOpacity, backgroundDarken)
 *   w, h   — canvas logical width/height in CSS px (before DPR scaling)
 *   t      — animation clock in seconds (parallax + perf gate)
 *   onReady — optional callback invoked when image first finishes loading
 *             (caller can call requestAnimationFrame / scheduleRender here)
 *
 * Call site (StoryMapScreen.js, or any tool page map renderer):
 *   import { drawBiomeBackground } from '../story/storyMapRendererShared.js';
 *   // before drawing nodes/edges each frame:
 *   drawBiomeBackground(ctx, currentBiome, canvasW, canvasH, t, () => this._scheduleRender());
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ---------------------------------------------------------------------------
// Biome background helper (M518c) — exported for StoryMapScreen + tool pages
// ---------------------------------------------------------------------------

/**
 * Module-scope image cache keyed by biome.id.
 * Each entry: { img: HTMLImageElement, state: 'loading'|'ready'|'error' }
 * Plain object (not WeakMap) because biome objects are JSON-parsed per frame.
 */
const _bgCache = Object.create(null);

/**
 * Dark overlay color applied over the background image to keep nodes legible.
 * Matches the existing dark-parchment blend target used in _blendColor().
 */
const _DARKEN_COLOR = '#0c0e14';

/**
 * drawBiomeBackground — render biome background + darken overlay on ctx.
 *
 * Lazy-loads biome.backgroundImage (path relative to the game root, e.g.
 * "images/map_bg/act-1-border-roads-v1.png"). Falls back to a palette-based
 * gradient on first paint while the image is in-flight, then schedules a
 * re-render via the onReady callback once loaded. Subsequent frames use the
 * cached HTMLImageElement — no repeated fetches.
 *
 * Parallax: the image is shifted ±4 px horizontally at sin(t * 0.3) cadence
 * to give the background faint life. Omitted gracefully if t is not finite.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} biome         — canonical biome object (palette[], backgroundImage?,
 *                                  backgroundOpacity?, backgroundDarken?)
 * @param {number} w             — canvas logical width (CSS px)
 * @param {number} h             — canvas logical height (CSS px)
 * @param {number} [t=0]         — animation clock in seconds
 * @param {function} [onReady]   — called when image first loads; use to trigger re-render
 */
export function drawBiomeBackground(ctx, biome, w, h, t = 0, onReady = null) {
  if (!biome) return;

  const opacity = biome.backgroundOpacity ?? 0.55;
  const darken  = biome.backgroundDarken  ?? 0.35;
  const imgPath = biome.backgroundImage;

  // Always draw palette gradient as the base layer (covers the case where
  // the image hasn't loaded yet, or no image is configured).
  _drawPaletteGradient(ctx, biome.palette || [], w, h);

  if (!imgPath) {
    _drawDarkenOverlay(ctx, darken, w, h);
    return;
  }

  const cached = _bgCache[biome.id];

  if (!cached) {
    // First request — start loading in the background.
    const entry = { img: new Image(), state: 'loading' };
    _bgCache[biome.id] = entry;

    entry.img.addEventListener('load', () => {
      entry.state = 'ready';
      if (typeof onReady === 'function') onReady();
    });
    entry.img.addEventListener('error', () => {
      entry.state = 'error';
    });

    // Resolve path relative to the Vite-served game root.
    // __APP_BASE__ is injected by Vite at build time and equals
    // '/' in dev and '/game13/' on GitHub Pages. Fallback to '/' in contexts
    // that don't have import.meta (e.g. plain <script> tool pages).
    let base = '/';
    try { base = __APP_BASE__ ?? '/'; } catch (_) { /* tool page */ }
    entry.img.src = base.replace(/\/$/, '') + '/' + imgPath;

    // Palette gradient already drawn — add darken and return for this frame.
    _drawDarkenOverlay(ctx, darken, w, h);
    return;
  }

  if (cached.state !== 'ready') {
    // Still loading or errored — fall back to palette gradient + darken.
    _drawDarkenOverlay(ctx, darken, w, h);
    return;
  }

  // Image is ready — draw it with a subtle parallax shift.
  const parallaxX = Number.isFinite(t) ? Math.sin(t * 0.3) * 4 : 0;

  ctx.save();
  ctx.globalAlpha = opacity;
  // Draw 8 px wider so the ±4 px shift never exposes a canvas edge.
  ctx.drawImage(cached.img, parallaxX - 4, 0, w + 8, h);
  ctx.restore();

  _drawDarkenOverlay(ctx, darken, w, h);
}

/** Draw a vertical gradient from the biome's palette colours. */
function _drawPaletteGradient(ctx, palette, w, h) {
  const stops = palette.length >= 2 ? palette : ['#1a1010', '#0c0e14'];
  const grad  = ctx.createLinearGradient(0, 0, 0, h);
  stops.forEach((c, i) => grad.addColorStop(i / (stops.length - 1), c));
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** Semi-transparent dark overlay to keep nodes legible over the image. */
function _drawDarkenOverlay(ctx, darken, w, h) {
  if (darken <= 0) return;
  ctx.save();
  ctx.globalAlpha = darken;
  ctx.fillStyle = _DARKEN_COLOR;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
export const NODE_VISUAL_R = 16;   // 32 px diameter
export const NODE_HIT_R    = 24;   // 48 px diameter
export const NODE_MIN_H_SPACING = 56; // px between centers (horizontal)
export const NODE_MIN_V_SPACING = 48; // px between centers (vertical)
export const LANES = 3;

// Node-type visual configs: color + thematic glyph (Unicode, no emoji).
// Glyphs: combat=crossed swords, elite=skull, boss=crown, dialog=speech-bubble,
//         shrine=star/ankh, lore=scroll, merchant=coin, rest=moon, event=spiral,
//         waypoint=diamond, trailhead=flag, town=house.
const NODE_TYPE_CONFIG = {
  combat:    { color: '#c04030', label: 'Combat',    glyph: '⚔' },
  elite:     { color: '#c86020', label: 'Elite',     glyph: '☠' },
  boss:      { color: '#8020b0', label: 'Boss',      glyph: '♛' },
  dialog:    { color: '#4080c0', label: 'Dialog',    glyph: '❁' },
  shrine:    { color: '#80e0c8', label: 'Shrine',    glyph: '✶' },
  lore:      { color: '#6a9040', label: 'Lore',      glyph: '℘' },
  merchant:  { color: '#e0a020', label: 'Merchant',  glyph: '◎' },
  rest:      { color: '#40a860', label: 'Rest',      glyph: '☽' },
  event:     { color: '#9040c0', label: 'Event',     glyph: '✵' },
  waypoint:  { color: '#4080c0', label: 'Waypoint',  glyph: '✦' },
  trailhead: { color: '#708050', label: 'Trailhead', glyph: '⚑' }, // ⚑  flag
  town:      { color: '#c09030', label: 'Town',      glyph: '⌂' }, // ⌂  house
};

const DEFAULT_CONFIG = { color: '#806060', label: 'Unknown', glyph: null };

// Waypoint state ring colors.
const WAYPOINT_RING_COLOR = {
  unexplored: 'rgba(64,128,192,0.5)',
  discovered: '#4080c0',
  activated:  '#40c860',
  corrupted:  '#c04030',
  disabled:   '#404040',
};

// Edge colors — parchment-ink palette per §13.3.
const EDGE_COLOR_OPEN   = 'rgba(200,170,100,0.65)'; // aged-gold ink
const EDGE_COLOR_HIDDEN = 'rgba(120,80,180,0.35)';
const EDGE_COLOR_BLOCKED= 'rgba(200,60,60,0.3)';
const EDGE_COLOR_STITCH = 'rgba(232,192,96,0.65)'; // cross-region gold

// ---------------------------------------------------------------------------
// Coordinate mapping
// ---------------------------------------------------------------------------

// Stagger offset for even columns (fix #4 — FTL-style diagonal grid)
const STAGGER_OFFSET_PX = 24;

/**
 * Map a node's (lane, col) to canvas pixel coordinates within a sub-region.
 * Staggered: even columns are shifted up by STAGGER_OFFSET_PX, creating a
 * diagonal FTL-style layout where cross-lane edges feel natural.
 *
 * @param {{ lane: number, col: number }} node
 * @param {number} regionWidth  - canvas width allocated to this sub-region (px)
 * @param {number} regionHeight - canvas height (px)
 * @returns {{ x: number, y: number }}
 */
export function nodeXYFromLane(node, regionWidth, regionHeight) {
  const { lane, col } = node;
  // Y: 3 lanes at 22%, 50%, 78% of height, with column stagger.
  const laneY = [0.22, 0.50, 0.78];
  const stagger = (col % 2 === 0) ? -STAGGER_OFFSET_PX : STAGGER_OFFSET_PX;
  const y = laneY[lane] * regionHeight + stagger;

  // X: columns spaced with padding.
  const xPad = NODE_MIN_H_SPACING;
  const x = xPad + col * NODE_MIN_H_SPACING;

  return { x: Math.round(x), y: Math.round(y) };
}

// ---------------------------------------------------------------------------
// Node drawing
// ---------------------------------------------------------------------------

/**
 * Draw a single node circle on `ctx`.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x            - center x
 * @param {number} y            - center y
 * @param {string} type         - nodeType (combat/dialog/shrine/...)
 * @param {object} stateInfo    - { state, visibility, waypointState, overlay, selected, hovered }
 * @param {object} [opts]       - { scale: 1 } for DPR
 */
export function drawNode(ctx, x, y, type, stateInfo = {}, opts = {}) {
  const cfg = NODE_TYPE_CONFIG[type] || DEFAULT_CONFIG;
  const r = NODE_VISUAL_R;
  const { selected, hovered, waypointState, visibility, overlay, state } = stateInfo;

  // Hidden nodes not drawn at all (§13.3: no draw on undiscovered-hidden).
  if (visibility === 'hidden') return;

  const isRevealed = visibility === 'revealed';
  const isVisited  = state === 'visited' || state === 'cleared';
  // Visited: half-opacity so route history reads softer.
  const alpha = isRevealed ? 0.5 : isVisited ? 0.55 : 1.0;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Golden glow for selected — more prominent per Bug 3 request.
  if (selected) {
    ctx.shadowBlur = 22;
    ctx.shadowColor = '#f0c040';
  } else if (hovered) {
    ctx.shadowBlur = 10;
    ctx.shadowColor = cfg.color;
  }

  // Node fill.
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = overlay === 'corrupted' ? '#8a2020'
                : overlay === 'cleansed'  ? '#40a860'
                : isVisited ? _blendColor(cfg.color, 0.6)
                : cfg.color;
  ctx.fill();

  // Node border.
  ctx.lineWidth = selected ? 3.5 : 1.5;
  ctx.strokeStyle = selected ? '#f0c040' : isVisited ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.4)';
  ctx.stroke();

  // Selected: extra golden ring halo.
  if (selected) {
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(x, y, r + 5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(240,192,64,0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Waypoint ring (outside the node circle).
  if (waypointState) {
    const ringColor = WAYPOINT_RING_COLOR[waypointState] || WAYPOINT_RING_COLOR.unexplored;
    ctx.beginPath();
    ctx.arc(x, y, r + 4, 0, Math.PI * 2);
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Glyph in center — always draw even if node has no built-in glyph.
  const glyph = cfg.glyph || _typeInitial(type);
  if (glyph) {
    ctx.fillStyle = isVisited ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.92)';
    ctx.font = `bold ${Math.round(r * 0.85)}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(glyph, x, y);
  }

  ctx.restore();
}

/** Desaturate/darken a hex color by factor (0-1). */
function _blendColor(hex, factor) {
  // Simple: blend toward dark parchment (#2a2010).
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const tr = 42, tg = 32, tb = 16; // target dark parchment
  const nr = Math.round(r * factor + tr * (1 - factor));
  const ng = Math.round(g * factor + tg * (1 - factor));
  const nb = Math.round(b * factor + tb * (1 - factor));
  return `rgb(${nr},${ng},${nb})`;
}

/** Fallback initial letter for types with no dedicated glyph. */
function _typeInitial(type) {
  const initials = {
    combat: '⚔', elite: '☠', boss: '♛', dialog: '❁', shrine: '✶',
    lore: '℘', merchant: '◎', rest: '☽', event: '✵', waypoint: '✦',
    trailhead: '⚑', town: '⌂',
  };
  return initials[type] || null;
}

// ---------------------------------------------------------------------------
// Edge drawing
// ---------------------------------------------------------------------------

/**
 * Draw a single edge between two points as a curved Bezier road path.
 *
 * Fixes #4 + #11: edges are gentle S-curves (bezierCurveTo with a
 * perpendicular control-point offset) rather than straight lines, giving
 * the appearance of winding roads between map nodes.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @param {'open'|'hidden'|'blocked'|'stitch'} kind
 * @param {number} [t=0]   - animation time (seconds) for dash offset
 */
export function drawEdge(ctx, x1, y1, x2, y2, kind, t = 0) {
  ctx.save();

  let color, lineWidth, dash, dashOffset;

  if (kind === 'open') {
    color = EDGE_COLOR_OPEN;
    lineWidth = 2.5;
    dash = [];
    dashOffset = 0;
    // Faint shimmer on idle open edges (fix #11).
    const shimmer = 0.55 + 0.10 * Math.sin(t * 1.8 + x1 * 0.01);
    ctx.globalAlpha = shimmer;
  } else if (kind === 'hidden') {
    const pulse = 0.28 + 0.12 * Math.sin(t * 3.5);
    color = `rgba(120,80,180,${pulse.toFixed(2)})`;
    lineWidth = 1.5;
    dash = [5, 6];
    dashOffset = -(t * 18) % 11;
  } else if (kind === 'blocked') {
    color = EDGE_COLOR_BLOCKED;
    lineWidth = 2;
    dash = [4, 4];
    dashOffset = 0;
  } else if (kind === 'stitch') {
    color = EDGE_COLOR_STITCH;
    lineWidth = 2.5;
    dash = [10, 5];
    dashOffset = -(t * 25) % 15;
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#e8c060';
  } else {
    color = EDGE_COLOR_OPEN;
    lineWidth = 1.5;
    dash = [];
    dashOffset = 0;
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.setLineDash(dash);
  ctx.lineDashOffset = dashOffset;

  // Curved Bezier path — control points pulled perpendicularly to the
  // midpoint to create a gentle S-curve / winding road feel (fix #11).
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  // Perpendicular unit vector.
  const px = -dy / len;
  const py =  dx / len;
  // Curve amount: ~12 px for typical node spacing; less for short edges.
  const curvature = Math.min(12, len * 0.18);

  // Two control points for an S-curve: one offset +, the other -.
  const cp1x = x1 * 0.6 + mx * 0.4 + px * curvature;
  const cp1y = y1 * 0.6 + my * 0.4 + py * curvature;
  const cp2x = mx * 0.4 + x2 * 0.6 - px * curvature;
  const cp2y = my * 0.4 + y2 * 0.6 - py * curvature;

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Hit-test helper
// ---------------------------------------------------------------------------

/**
 * Returns true if (px, py) is within the 48px hit radius of a node at (nx, ny).
 */
export function hitTestNode(px, py, nx, ny) {
  const dx = px - nx;
  const dy = py - ny;
  return (dx * dx + dy * dy) <= NODE_HIT_R * NODE_HIT_R;
}
