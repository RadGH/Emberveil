/**
 * combatLayout — M435
 * ============================================================================
 * Pure positioning logic for combat. Extracted from CombatScreen.js so the
 * column model is testable in isolation and the screen file can be reduced.
 *
 * Spec (locked from user, 2026-05-07):
 *   • Left → right: heroes column · companions column · gap · 1..N enemy columns.
 *   • Each unit stack is a TRUE vertical column with explicit row stagger.
 *   • If no companions: hero column shifts to the center of the ally zone
 *     (no empty left strip). If only one enemy group: enemy column sits
 *     centered in the enemy zone (no empty right strip).
 *   • Combat Debug placement.x/y/w/h are interpreted as percentage margins
 *     on left/top/right/bottom of the grid rect — proportional, so +30%
 *     left margin shifts every column right by 30% of viewport.
 *   • Sprites scale down (never up beyond 1) so adjacent columns don't
 *     overlap. Same layout on mobile, tighter.
 *
 * Inputs: viewport size, ground line, combat-debug knobs, party / companions /
 *         enemy groups (lightweight: only `length` and `isBoss` per element).
 * Outputs: an array of placement assignments — one entry per unit, with
 *          `x`, `y`, `_drawScale`. The caller is responsible for assigning
 *          these onto the actual unit objects (kept side-effect free here).
 *
 * The function returns BOTH the per-unit positions and the grid rect so
 * callers (canvas tile renderer, status overlay, future debug overlays)
 * can render diagnostics in the same coordinate space.
 * ============================================================================
 */

// Conservative sprite footprint at scale=1. baseSize 56-62 × the 1.6×
// drawImage factor in CombatScreen._drawUnitInner ≈ 90-100px wide. We use
// the larger value so collision-avoidance is conservative.
export const SPRITE_W_AT_1 = 100;
export const SPRITE_H_AT_1 = 110;

// Visual breathing room kept between the closest pair of column anchors.
const COL_GAP_PX = 12;
// Ally → enemy gap as a fraction of grid width (legacy fallback baseline).
const ZONE_GAP_PCT = 0.06;

// Faction-aware column spacing (added 2026-05-12).
//
// Why this exists: when columns are evenly distributed across the battlefield
// (e.g. heroes | companions | enemies in three even slots) the hero/companion
// pair looks visually disconnected from each other and the enemy column looks
// isolated. Heroes + companions are allies — they should cluster tightly and
// face off across a clear "battle line" against the enemy cluster. So we use
// a SMALL within-cluster gap (`COL_GAP_TIGHT`) between adjacent columns of
// the same faction, and a LARGER between-cluster gap (`COL_GAP_BATTLE_LINE`)
// separating the rightmost ally column from the leftmost enemy column. The
// battle-line gap is also scaled to remaining grid width so it adapts on
// narrow mobile viewports.
const COL_GAP_TIGHT = 20;          // px between same-faction columns (centers, plus sprite width)
const COL_GAP_BATTLE_LINE = 96;    // px between ally cluster and enemy cluster (centers, plus sprite width)

/**
 * @typedef Unit
 * @property {string} id
 * @property {boolean} [isBoss]
 *
 * @typedef LayoutOpts
 * @property {number} w           viewport width in canvas px
 * @property {number} h           viewport height in canvas px
 * @property {number} groundY     y-coordinate of the ground line
 * @property {{x:number,y:number,w:number,h:number}} placementPct
 *                                left/top/right/bottom margins in percent (0-40)
 * @property {number} [characterScale=1]
 * @property {number} [companionScale=1]
 * @property {number} [enemyScale=1]
 * @property {number} [bossScale=1]
 * @property {boolean} [isMobile=false]   portrait-mobile signal (≤700px)
 * @property {Unit[]} heroes
 * @property {Unit[]} companions
 * @property {Unit[][]} enemyGroups
 *
 * @typedef PlaceResult
 * @property {string} id
 * @property {number} x
 * @property {number} y
 * @property {number} _drawScale
 * @property {'hero'|'companion'|'enemy'} role
 *
 * @typedef LayoutResult
 * @property {{gx0:number,gx1:number,gridTop:number,gridBottom:number,gridW:number,gridH:number}} rect
 * @property {number} scale
 * @property {PlaceResult[]} placements
 */

function clampPct(v) { return Math.max(0, Math.min(40, +v || 0)) / 100; }

/**
 * Even-spaced column centers inside [zoneX0, zoneX1].
 */
function colCenters(zoneX0, zoneX1, n) {
  if (n <= 0) return [];
  const slotW = (zoneX1 - zoneX0) / n;
  return Array.from({ length: n }, (_, i) => zoneX0 + slotW * (i + 0.5));
}

/**
 * Compute combat-screen positions for every unit.
 * @param {LayoutOpts} opts
 * @returns {LayoutResult}
 */
export function computeCombatLayout(opts) {
  const {
    w, h, groundY,
    placementPct = { x:0, y:0, w:0, h:0 },
    characterScale = 1, companionScale = 1, enemyScale = 1, bossScale = 1,
    isMobile = false,
    heroes = [], companions = [], enemyGroups = [],
  } = opts;

  const padPctX0 = clampPct(placementPct.x);
  const padPctY0 = clampPct(placementPct.y);
  const padPctX1 = clampPct(placementPct.w);
  const padPctY1 = clampPct(placementPct.h);

  const gx0 = w * padPctX0;
  const gx1 = w - w * padPctX1;
  // Sky band default: keep back-row sprites away from the BG horizon.
  const skyDefault = isMobile ? 0.18 : 0.14;
  const gridTop    = h * (skyDefault + padPctY0);
  const gridBottom = groundY - h * padPctY1;
  const gridW = Math.max(80, gx1 - gx0);
  const gridH = Math.max(80, gridBottom - gridTop);

  const groups = (enemyGroups || []).filter(g => g && g.length);
  const hasHeroes = heroes.length > 0;
  const hasCompanions = companions.length > 0;
  const enemyColCount = Math.max(1, groups.length);
  const allyColCount = (hasHeroes ? 1 : 0) + (hasCompanions ? 1 : 0);

  // Faction-aware column placement (M-2026-05-12). We compute column centers
  // by stepping from left to right using `tightStep` between same-faction
  // columns and `battleStep` across the ally→enemy battle line. The whole
  // cluster is then centered inside the grid rect so the battlefield looks
  // balanced regardless of column counts (1+1+1, 2+1+2, 0+1+3, etc).
  // If the natural step doesn't fit, we scale both gaps down proportionally
  // so columns still anchor inside the grid; the existing scale-fitter
  // (vScale/hScale below) then shrinks sprites to match.
  let tightStep = SPRITE_W_AT_1 + COL_GAP_TIGHT;
  let battleStep = SPRITE_W_AT_1 + COL_GAP_BATTLE_LINE;
  // Battle line only matters if BOTH sides have at least one column.
  const battleLines = (allyColCount > 0 && enemyColCount >= 1) ? 1 : 0;
  const tightLinks = Math.max(0, allyColCount - 1) + Math.max(0, enemyColCount - 1);
  // M479b — center-to-center span between first and last column. Add one
  // full SPRITE_W_AT_1 so the leftmost half-sprite + rightmost half-sprite
  // also stay inside gridW. Without this, 1 hero + 4 enemies on a 393px
  // viewport pushed the leftmost archer + rightmost enemy off-screen.
  let centerSpan = tightLinks * tightStep + battleLines * battleStep;
  const trueWidth = centerSpan + SPRITE_W_AT_1;
  if (trueWidth > gridW && trueWidth > 0) {
    const k = gridW / trueWidth;
    tightStep *= k;
    battleStep *= k;
    centerSpan = tightLinks * tightStep + battleLines * battleStep;
  }
  const leftMargin = gx0 + Math.max(0, (gridW - centerSpan) / 2);

  /** @type {number[]} */
  const allyXs = [];
  /** @type {number[]} */
  const enemyXs = [];
  let cursor = leftMargin;
  if (allyColCount > 0) {
    allyXs.push(cursor);
    for (let i = 1; i < allyColCount; i++) {
      cursor += tightStep;
      allyXs.push(cursor);
    }
    // Cross the battle line into enemy territory.
    if (enemyColCount > 0) cursor += battleStep;
  }
  for (let i = 0; i < enemyColCount; i++) {
    if (i === 0 && allyColCount === 0) {
      enemyXs.push(cursor);
    } else if (i === 0) {
      enemyXs.push(cursor);
    } else {
      cursor += tightStep;
      enemyXs.push(cursor);
    }
  }

  // Map ally columns to hero / companion baseX. If there are no companions the
  // hero column is the sole ally column (already centered in the cluster). If
  // there are no heroes (theoretical) the companion column takes the ally slot.
  let heroBaseX = null, compBaseX = null;
  if (hasHeroes && hasCompanions) {
    heroBaseX = allyXs[0];
    compBaseX = allyXs[1];
  } else if (hasHeroes) {
    heroBaseX = allyXs[0];
  } else if (hasCompanions) {
    compBaseX = allyXs[0];
  }

  const allColXs = [...allyXs, ...enemyXs].sort((a, b) => a - b);
  let minColDist = Infinity;
  for (let i = 1; i < allColXs.length; i++) {
    minColDist = Math.min(minColDist, allColXs[i] - allColXs[i - 1]);
  }
  if (!Number.isFinite(minColDist)) minColDist = gridW;

  const tallestCol = Math.max(
    heroes.length,
    hasCompanions ? companions.length : 0,
    ...groups.map(g => g.length || 0),
    1,
  );
  const targetRowSpacing = (gridH * 0.92) / tallestCol;

  const vScale = Math.max(0.45, Math.min(1, targetRowSpacing / SPRITE_H_AT_1 * 1.05));
  const hScale = Math.max(0.45, Math.min(1, (minColDist - COL_GAP_PX) / SPRITE_W_AT_1));
  const scale  = Math.min(vScale, hScale, 1);

  /** @type {PlaceResult[]} */
  const placements = [];

  function placeColumn(units, baseX, role, drawScaleFor) {
    const n = units.length;
    if (!n) return;
    const minPitch = Math.max(54, SPRITE_H_AT_1 * scale * 0.55);
    const pitch = (n <= 1)
      ? 0
      : Math.max(minPitch, Math.min(targetRowSpacing, gridH * 0.95 / n));
    // M480 — for small columns (1-2 units), lift the column toward the
    // vertical center so the battlefield doesn't look bottom-stuck. For
    // 3+ units, fill the grid normally (bottom-anchored — preserves the
    // legacy "back rows visible" behavior). Anchor the column's center at
    // ~60% of the grid (top 40% is sky, bottom 40% is foreground).
    const totalH = pitch * (n - 1);
    let stackBottom;
    if (n <= 2) {
      // 60% target Y for the cluster's center
      const centerY = gridTop + gridH * 0.60;
      stackBottom = centerY + totalH / 2;
      // Don't push below the floor — clamp.
      stackBottom = Math.min(stackBottom, gridBottom - 8);
    } else {
      stackBottom = gridBottom - 8;
    }
    const staggerX = Math.max(0, Math.min(10, (minColDist - SPRITE_W_AT_1 * scale) * 0.18));
    const compress = (totalH > gridH * 0.95 && n > 1)
      ? (gridH * 0.95) / (n - 1)
      : pitch;
    units.forEach((u, i) => {
      const xJitter = (n > 1) ? ((i % 2 === 0) ? -staggerX : staggerX) * 0.5 : 0;
      placements.push({
        id: u.id,
        x: baseX + xJitter,
        y: stackBottom - i * compress,
        _drawScale: drawScaleFor(u, i),
        role,
      });
    });
  }

  placeColumn(heroes, heroBaseX, 'hero', () => scale * characterScale);
  if (hasCompanions) {
    placeColumn(companions, compBaseX, 'companion', () => scale * companionScale);
  }
  groups.forEach((group, gi) => {
    placeColumn(group, enemyXs[gi], 'enemy', (e) => scale * (e.isBoss ? bossScale : enemyScale));
  });

  return {
    rect: { gx0, gx1, gridTop, gridBottom, gridW, gridH },
    scale,
    placements,
  };
}
