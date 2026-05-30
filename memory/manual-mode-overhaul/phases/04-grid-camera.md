# Phase 04 — 2.5D Grid + Camera / Layout Math

**Author:** frontend-developer agent
**Date:** 2026-04-29
**Dependencies:** Phase 00 (palette tokens, grid read §7), Phase 01 (`_computeGridLayout` recommendation, `draw(ctx)` heroBaseX section)

---

## 1. Recommendation Summary

**Decision: HTML/SVG tile grid with `<img>` sprite elements positioned via CSS `transform: translate() scale()`.**

The battlefield becomes three stacked DOM layers inside `.ev-battlefield`: an `<svg>` element draws all tile polygons and hover/selection hit zones; a `.ev-sprite-layer` div holds absolutely-positioned `<img>` elements (one per combatant) pinned to grid coordinates; and a `.ev-fx-layer` div holds damage numbers and status icons. Canvas is eliminated from the battlefield entirely.

**Justification:**

1. **Phase 01's `_computeGridLayout` sketch maps directly.** The audit recommends giving each combatant a `gridCell: {row, col}` property and computing `{x, y, drawScale}` from a grid-layout function — not from the existing `heroBaseX = gx0 + gridW * 0.14` percentage math. CSS `transform: translate(x, y) scale(s)` is the exact mechanism that turns those three values into a positioned sprite, and it works with zero canvas involvement.

2. **Target-selection hit zones are SVG polygons, not sprite bounding boxes.** On a 2.5D grid sprites overlap heavily in the Y axis. An SVG `<polygon>` per tile gives each tile a clean, non-overlapping, pointer-events area. Canvas pixel-testing cannot achieve this without custom hit-map painting. Accessibility also benefits: SVG polygons accept `aria-label`, `role="button"`, `tabindex`, and keyboard events natively.

3. **Sprite positions only need to update on layout events, not at 60 fps.** The reference image's sprites are standing still between animations. The existing `draw(ctx)` path repaints every combatant every frame even when nothing moves. Decoupling to CSS `transform` means a single `recomputeLayout()` call on resize or round-start is sufficient; the browser compositor handles the repaint with no JS involvement at steady state.

---

## 2. Coordinate System

### Definitions

```
BATTLEFIELD_W   = container width in CSS px  (dynamic; read from ResizeObserver)
BATTLEFIELD_H   = container height in CSS px
VIEWPORT_TOP_PCT = 0.20   // top 20% is sky/atmosphere band
GRID_TOP        = BATTLEFIELD_H * VIEWPORT_TOP_PCT   // first tile top edge

COLS = 6          // logical columns, indexed 0–5 (was 8 — tightened post Act-1
                  // BG review: side architectural framing in generated bgs ate
                  // ~12-15% on each lateral edge, clipping outer cols. Dropping
                  // to 6 keeps every column on usable ground.)
ROWS = 6          // logical rows, indexed 0 (back) – 5 (companion row in front)

TILE_BASE_W = BATTLEFIELD_W / COLS             // width of a front-row tile
TILE_BASE_H = TILE_BASE_W / 2                  // 2:1 aspect (foreshortening)

VANISH_X = BATTLEFIELD_W * 0.5    // vanishing point: horizontal center
VANISH_Y = BATTLEFIELD_H * 0.15   // 15% from battlefield top = ~23% from screen top

DEPTH_SCALE_PER_ROW = 0.85        // each row toward back is 85% the size of the row in front
```

### Formula: `(col, row)` → `(cx, cy, scale)`

`cx` and `cy` are the **center** of the tile at screen coordinates. `scale` drives sprite sizing relative to row depth.

```js
/**
 * @param {number} col   0 = leftmost, COLS-1 = rightmost
 * @param {number} row   0 = back (enemies far), ROWS-1 = companion front
 * @param {object} layout  { bw, bh, gridTop, vanishX, vanishY }
 * @returns {{ cx, cy, scale, tileW, tileH }}
 */
function gridToScreen(col, row, layout) {
  const { bw, bh, gridTop, vanishX, vanishY } = layout;

  // Row 0 is deepest (smallest). Row ROWS-1 is closest (largest).
  // scale[r] = DEPTH_SCALE_PER_ROW ^ (ROWS - 1 - r)
  const ROWS = 6;
  const DEPTH_SCALE = 0.85;
  const scale = Math.pow(DEPTH_SCALE, ROWS - 1 - row);   // row 5 → 1.0, row 0 → 0.85^5 ≈ 0.444

  // Tile dimensions at this row's depth
  const baseTileW = bw / 6;  // 6 columns reference at front row (was 8 — see COLS comment)
  const tileW = baseTileW * scale;
  const tileH = tileW / 2;   // 2:1 aspect

  // Y position: rows stack from gridTop, compressed toward vanishing point.
  // Total grid height = sum of tileH for all rows.
  // Row r's top edge = gridTop + sum(tileH[0..r-1]).
  // Compute cumulative Y offset for this row.
  let yOffset = 0;
  for (let r = 0; r < row; r++) {
    const rScale = Math.pow(DEPTH_SCALE, ROWS - 1 - r);
    yOffset += (baseTileW / 2) * rScale;   // tileH at row r
  }
  const cy = gridTop + yOffset + tileH * 0.5;

  // X position: converge toward vanishX as row decreases.
  // The full grid at this row spans (tileW * COLS) centered on vanishX.
  const gridSpanW = tileW * 6;
  const leftEdge = vanishX - gridSpanW * 0.5;
  const cx = leftEdge + tileW * (col + 0.5);

  return { cx, cy, scale, tileW, tileH };
}
```

**Key numbers at 1280px wide battlefield (80% ground = 614px tall), 6-col grid:**

| Row | scale | tileW (px) | tileH (px) | cy (px from grid top) |
|-----|-------|-----------|-----------|----------------------|
| 0 (far enemies) | 0.444 | 94.7 | 47.4 | 23.7 |
| 1 | 0.522 | 111.3 | 55.7 | 79.5 |
| 2 | 0.614 | 130.9 | 65.5 | 142.8 |
| 3 (hero back) | 0.723 | 154.1 | 77.0 | 217.4 |
| 4 (hero front) | 0.850 | 181.3 | 90.7 | 305.7 |
| 5 (companions) | 1.000 | 213.3 | 106.7 | 411.5 |

Grid bottom edge ≈ 388px from grid top. With `gridTop` = 154px (20% of 770px battlefield), the grid's bottom is at ~542px — well within the 80% ground zone.

---

## 3. Tile Geometry

**Decision: SVG `<polygon>` per tile, parameterized by the four corners of the rhombus.**

CSS `transform: matrix3d()` / `rotateX()` applies to rectangular elements and is difficult to clip non-rectangularly. SVG polygons draw the exact rhombus shape without clipping hacks, accept per-tile `fill`/`stroke`, and support pointer-events precisely on the visible area. The polygon count is `ROWS × COLS = 48`, negligible for SVG rendering.

### Four-corner computation

For a tile at `(col, row)` with center `(cx, cy)`, half-width `hw = tileW/2`, half-height `hh = tileH/2`:

```
Top    (cx,       cy - hh)
Right  (cx + hw,  cy      )
Bottom (cx,       cy + hh )
Left   (cx - hw,  cy      )
```

### Snippet: render one tile

```html
<polygon
  class="ev-tile"
  data-col="3"
  data-row="4"
  points="cx,cy-hh  cx+hw,cy  cx,cy+hh  cx-hw,cy"
  fill="#2e2438"
  stroke="#1a1128"
  stroke-width="1"
/>
```

```css
.ev-tile {
  fill: var(--ember-stone);
  stroke: var(--ember-pit);
  stroke-width: 1px;
  cursor: default;
  transition: fill 120ms ease;
}

/* Hover — shown only when targeting is active */
.ev-battlefield.targeting-active .ev-tile:hover,
.ev-tile.tile-hovered {
  fill: var(--gold-dim);
  stroke: var(--gold-rim);
  filter: drop-shadow(0 0 6px var(--gold-glow));
}

/* Selected / target-locked */
.ev-tile.tile-selected {
  fill: #3d3250;
  stroke: var(--gold-rim);
  stroke-width: 2px;
  filter: drop-shadow(0 0 10px var(--gold-glow));
}

/* Active actor's tile — subtle pulse */
.ev-tile.tile-active-actor {
  animation: tile-pulse 1.2s ease-in-out infinite;
}

@keyframes tile-pulse {
  0%, 100% { fill: var(--ember-stone); }
  50%       { fill: var(--ember-slate); }
}
```

The SVG element is declared with `pointer-events: none` on the `.ev-sprite-layer` and `.ev-fx-layer` so all clicks fall through to the SVG polygons.

---

## 4. Centering Rules

### The problem

When only 2 of 4 hero slots are filled, the two sprites cluster at the left side of the hero zone because the current code hard-codes `heroBaseX = gx0 + gridW * 0.14`. This is the user's complaint — partial parties look off-center.

### Rule: every group is independently centered on its row allocation

Each group (heroes, companions, enemies) occupies a horizontal sub-range of columns. The LEFTMOST PIECE of the group is assigned a starting column so the entire group is centered in its column range.

```js
// Column allocations (logical split of 6 columns):
//   Cols 0–2: hero/companion side
//   Cols 3–5: enemy side

const HERO_COL_RANGE    = { start: 0, count: 3 };   // cols 0–2
const ENEMY_COL_RANGE   = { start: 3, count: 3 };   // cols 3–5
// Companions share HERO_COL_RANGE but on row 5.

/**
 * @param {number} pieceCount  Number of pieces in the group (1–4)
 * @param {object} colRange    { start, count }
 * @returns {number}           Column of the leftmost piece (0-indexed)
 */
function centerStartCol(pieceCount, colRange) {
  // Total pieces must fit inside colRange.count (max 3 per row at 6-col grid).
  // Parties of 4-6 heroes wrap across multiple rows (rows 3-4) per phase 00 §7.
  const clampedCount = Math.min(pieceCount, colRange.count);
  // Offset = how many columns to shift right from the range start
  //   so the group is centered within colRange.
  const offset = Math.floor((colRange.count - clampedCount) / 2);
  return colRange.start + offset;
}
```

### `computeAnchors(partyShape, enemyShape) → {heroAnchor, companionAnchor, enemyAnchor}`

An anchor is `{ col, row }` for the LEFTMOST piece in the group. Pieces then fill `col, col+1, col+2, ...` from the anchor.

```js
/**
 * @param {{ heroes: number, companions: number }} partyShape
 *   heroes: 1–4 | companions: 0–3
 * @param {{ front: number, back: number }} enemyShape
 *   front: enemies in rows 1–2 (front enemy rows) | back: enemies in row 0
 * @returns {{
 *   heroAnchor:      { col, row },
 *   companionAnchor: { col, row },
 *   enemyFrontAnchor:{ col, row },
 *   enemyBackAnchor: { col, row },
 * }}
 */
function computeAnchors(partyShape, enemyShape) {
  const HERO_COL_RANGE      = { start: 0, count: 4 };
  const ENEMY_COL_RANGE     = { start: 4, count: 4 };

  const heroStartCol      = centerStartCol(partyShape.heroes,      HERO_COL_RANGE);
  const companionStartCol = centerStartCol(partyShape.companions,  HERO_COL_RANGE);
  const enemyFrontCount   = Math.min(enemyShape.front, 4);
  const enemyBackCount    = Math.min(enemyShape.back,  4);
  const enemyFrontStartCol = centerStartCol(enemyFrontCount,       ENEMY_COL_RANGE);
  const enemyBackStartCol  = centerStartCol(enemyBackCount,        ENEMY_COL_RANGE);

  return {
    heroAnchor:       { col: heroStartCol,       row: 4 },  // hero front row
    companionAnchor:  { col: companionStartCol,  row: 5 },  // companion row
    enemyFrontAnchor: { col: enemyFrontStartCol, row: 2 },  // enemy front
    enemyBackAnchor:  { col: enemyBackStartCol,  row: 0 },  // enemy back
  };
}
```

### Worked examples

| Party shape | Heroes | Companions | Enemy | heroStartCol | companionStartCol | enemyFrontStartCol |
|---|---|---|---|---|---|---|
| Full party | 4 | 3 | 4 | 0 | 0 | 4 |
| 2 heroes | 2 | 0 | 4 | 1 | 2 (no-op, 0 companions) | 4 |
| 1 hero solo | 1 | 0 | 2 | 1 (cols 1 only, centered in 0–3) | n/a | 5 (centered in 4–7) |
| 4 heroes + 3 companions | 4 | 3 | 5 | 0 | 0 | 4 |

A solo hero now occupies col 1 of the hero zone (visual center of cols 0–3), not col 0 (left edge). A 2-hero party occupies cols 1–2. This is the fix for user complaint #1.

For enemies > 4, overflow into a second row: the first 4 fill the front row, the remainder fill the back row using the same `centerStartCol` logic.

---

## 5. Row Assignments

```
Row 0  — Enemy back / ranged enemies    (deepest, smallest tiles)
Row 1  — Enemy mid                      (second row back)
Row 2  — Enemy front                    (nearest enemy row)
Row 3  — Hero back (mages, archers)     (rearmost hero row)
Row 4  — Hero front (fighters)          (forward hero row)
Row 5  — Companion row                  (furthest forward — War Dog, animal companions)
```

**Justification against the reference image:** In the image the War Dog sits noticeably in front of and below the three standing heroes, which confirms row 5 must be in front of (lower Y value = closer = higher row index) the hero rows. The three heroes occupy two rows (a taller Fighter in front, Stormcaller and Paladin behind), matching rows 3–4. The four goblins cluster in rows 0–2 on the enemy side.

**Companion row is a distinct DOM row** — it is a separate logical row in `gridToScreen()`, not a sub-position within the hero rows. This satisfies the README requirement ("companions stay on a distinct row in front of the hero line") and the Phase 00 open question (§9 item 2): a distinct grid row, not a positional overlay.

**Hero assignment by class:** By default heroes with melee weapons or no range preference land on row 4 (front). Ranged / mage classes land on row 3 (back). Phase 02 can override this by setting `gridPos.row` during `_memberToCombatant`. No change to row assignment is required for Phase 04.

---

## 6. Sprite Anchoring

Each sprite image `<img>` is anchored at the **foot of the sprite**, which must align to the **mid-rear edge of its tile** (the back-center point of the rhombus, which is the top vertex at `(cx, cy - hh)`). This makes sprites appear to "stand on" the tile surface in a way that reads naturally with the foreshortened perspective.

```js
/**
 * Given a tile's center (cx, cy) and dimensions, compute where
 * the sprite <img> top-left corner should be placed.
 *
 * @param {number} cx          Tile center X in CSS px
 * @param {number} cy          Tile center Y in CSS px
 * @param {number} tileH       Tile height in CSS px
 * @param {number} spriteW     Sprite image display width in CSS px
 * @param {number} spriteH     Sprite image display height in CSS px
 * @returns {{ left, top }}    CSS px for position: absolute; left/top
 */
function spriteAnchor(cx, cy, tileH, spriteW, spriteH) {
  // Foot of the sprite touches the mid-rear edge of the tile.
  // Mid-rear edge Y = cy - tileH/2  (top vertex of the rhombus)
  const footY = cy - tileH / 2;
  // Sprite hangs upward from footY.
  const top  = footY - spriteH;
  // Sprite is horizontally centered on cx.
  const left = cx - spriteW / 2;
  return { left, top };
}
```

**Sprite display size** scales with `scale` from `gridToScreen()`. Base display size at row 5 (scale = 1.0):
- Hero sprites: 96px wide × 144px tall
- Enemy sprites: 80px wide × 120px tall
- Companion sprites: 72px wide × 96px tall

At row 4 (scale = 0.85): hero = 81.6px × 122.4px. At row 0 (scale = 0.444): enemy = 35.5px × 53.3px.

**Taller sprites on the same tile** (e.g. a boss occupying 2 columns) extend upward from the same footY — no additional Y correction needed. The sprite simply protrudes higher, which reads naturally because the camera is above.

**Active-turn glow ring** is a `box-shadow` on the `<img>` element — `box-shadow: 0 0 0 3px var(--gold-glow), 0 0 14px 6px rgba(248, 232, 144, 0.4)`. It follows the sprite, not the tile, so it correctly silhouettes the character shape.

---

## 7. Click-to-Target Hit Boxes

**Target selection uses the SVG tile `<polygon>` elements as the exclusive hit zone — not the sprite `<img>` bounding box.**

**Why:**

1. **Sprite overlap.** At 2.5D depth, sprites in row 4 overlap the tile area of row 5 sprites visually. If the sprite bounding box were the hit target, clicking the upper half of a companion's torso would target the hero standing behind it. The tile polygon precisely delimits which grid cell was intended.

2. **Consistent touch target size.** A tile polygon at front row is 160×80px — well above the 44×44px minimum touch target. A sprite image of a small enemy at row 0 may render at only 35×53px, failing the touch-target requirement. Using the tile fixes this.

3. **Accessibility.** SVG `<polygon>` elements accept `role="button"`, `tabindex="0"`, `aria-label="Target: Goblin Archer"`, and `onkeydown` (Enter/Space to select). This makes the entire targeting system keyboard-navigable and screen-reader-compatible without a separate invisible overlay.

**Implementation:**

When targeting is active, the `svg.ev-grid` receives class `targeting-active`. All tile polygons become `pointer-events: painted` (the SVG default). The `.ev-sprite-layer` receives `pointer-events: none` so clicks fall through to the SVG. Each polygon carries `data-col` and `data-row` attributes; the click handler resolves which combatant occupies `{col, row}` from a runtime lookup map.

When targeting is inactive, tiles are `pointer-events: none` entirely.

---

## 8. Camera / Viewport Rules

### Desktop (>= 768px wide)

The full battlefield is always visible with no panning or scrolling. The `.ev-battlefield` element is a fixed-size block determined by the CSS layout (72% of screen height after turn-strip and HUD, as defined in Phase 00 §3). The `BATTLEFIELD_W` and `BATTLEFIELD_H` values in the grid math are read from `getBoundingClientRect()` of `.ev-battlefield` on each `recomputeLayout()` call.

No camera translation. No zoom. Sprites that would overflow the battlefield top (e.g. very tall boss sprites at row 0) are clipped by `overflow: hidden` on `.ev-battlefield`.

### Mobile portrait (393px wide, 852px tall — iPhone 14 Pro)

The battlefield occupies a TALLER proportional slice than on desktop because the HUD card rail may collapse or scroll. The 80% ground / 20% sky split is preserved — `VIEWPORT_TOP_PCT` stays `0.20` and `GRID_TOP` is computed from the actual `BATTLEFIELD_H` at runtime.

**Vertical squeeze:** With fewer horizontal pixels, `TILE_BASE_W = BATTLEFIELD_W / 8 = 49px` at 393px. Front-row tile width is 49px, height 24.5px. Sprites at scale 1.0 would be 96px wide — wider than the tile. Sprite display width is therefore clamped: `spriteDisplayW = Math.min(baseW * scale, tileW * 0.95)`. Height scales proportionally from width (preserving aspect ratio), so sprites auto-shrink to fit.

**Result at 393px width:** Hero sprites on row 4 → ~46.5px × 69.7px. Companion sprites → ~46.6px × 62.2px. Enemy sprites at row 0 → ~22px × 33px. These are small but legible; they match the reference image's depth compression at the back.

---

## 9. Resize Behavior

```js
let _layoutDebounceTimer = null;

function scheduleRecomputeLayout() {
  clearTimeout(_layoutDebounceTimer);
  _layoutDebounceTimer = setTimeout(recomputeLayout, 50);
}

function recomputeLayout() {
  const rect = document.querySelector('.ev-battlefield').getBoundingClientRect();
  const layout = buildLayout(rect.width, rect.height);

  // 1. Recompute all tile polygon points and update SVG <polygon> elements.
  updateTilePolygons(layout);

  // 2. Recompute all sprite positions and update <img> style.left / style.top.
  updateSpritePositions(layout);

  // 3. Recompute FX-layer positions (damage numbers, status icons) if any are active.
  updateFxPositions(layout);
}

// Wire to ResizeObserver (not window.resize — fires less reliably on mobile)
const ro = new ResizeObserver(scheduleRecomputeLayout);
ro.observe(document.querySelector('.ev-battlefield'));

// Also call on round-start and actor-add/remove events.
```

**Crucially, sprite `<img>` elements do NOT receive `style.left` / `style.top` updates inside `update(dt)`.** The 60fps update loop drives canvas particles and floating number animations only. Static sprite positions are set exclusively in `recomputeLayout()`. This eliminates ~200 DOM style writes per second from the current canvas-redraw loop.

### Canvas seam clarification (post Phase-12 roast, 2026-04-30)

Phase 12 flagged ambiguity around what survives the migration. The crisp rule:

| Concern | Old (canvas) | New (DOM/SVG) | Path |
|---|---|---|---|
| Sprite positions / scaling | `draw(ctx)` blits | `<img>` + `transform` | **DOM** |
| Tile grid + hit zones | painted bg image | `<svg><polygon>` | **DOM/SVG** |
| HP/MP bars in HUD | DOM already | DOM | **DOM** |
| **Spell FX (`spellFx.js`)** | canvas particles | **canvas — KEEP** | _A reduced canvas overlay survives, sized to the `.ev-fx-layer` rect, used ONLY for spell particle systems and floating damage numbers._ |
| Floating damage numbers | canvas | **canvas — KEEP** | Same canvas overlay as spell FX. |
| Status icon overlays | canvas | DOM `<img>` | **DOM** |
| Background image | canvas blit | `<img>` `object-fit: cover` | **DOM** |

The `update(dt)` loop continues to drive the FX-only canvas overlay (see Phase-1 audit for the existing `spellFx.js` integration). Sprite/tile/HP rendering migrates fully to DOM/SVG. The "canvas is eliminated" claim earlier in this doc was overstated — corrected here. The FX overlay sits in `.ev-fx-layer` with `pointer-events: none`.

---

## 10. Future Positional Movement Hooks

The following data shapes and helpers are baked in now so positional movement can land without a refactor:

### Combatant data shape extension

```js
// Added to each combatant object in _memberToCombatant():
{
  gridPos: { col: 1, row: 4 },       // current logical grid position
  gridPosTarget: null,                // null when not moving; {col, row} while animating
  gridPosLerp: 0.0,                  // 0.0 = at gridPos, 1.0 = at gridPosTarget
}
```

### Tile occupancy map

```js
// Maintained at all times in CombatScreen:
// _tileOccupancy: Map<string, combatantId>
// key: `${col},${row}`
// value: combatant.id (or null if empty)

function setOccupancy(combatant, col, row) {
  const oldKey = `${combatant.gridPos.col},${combatant.gridPos.row}`;
  const newKey = `${col},${row}`;
  _tileOccupancy.delete(oldKey);
  _tileOccupancy.set(newKey, combatant.id);
  combatant.gridPos = { col, row };
}

function getOccupant(col, row) {
  return _tileOccupancy.get(`${col},${row}`) ?? null;
}
```

### Animation lerp helper

```js
/**
 * Called from update(dt) ONLY when gridPosTarget !== null.
 * Updates gridPosLerp; when lerp reaches 1.0, commits and fires callback.
 *
 * @param {object} combatant
 * @param {number} dt          Seconds since last frame
 * @param {number} speed       Grid cells per second (default 2.0)
 * @param {function} onComplete
 */
function tickGridMove(combatant, dt, speed = 2.0, onComplete) {
  if (!combatant.gridPosTarget) return;
  combatant.gridPosLerp = Math.min(1.0, combatant.gridPosLerp + dt * speed);

  const from = gridToScreen(combatant.gridPos.col,       combatant.gridPos.row,       _layout);
  const to   = gridToScreen(combatant.gridPosTarget.col, combatant.gridPosTarget.row, _layout);
  const cx   = from.cx + (to.cx - from.cx) * combatant.gridPosLerp;
  const cy   = from.cy + (to.cy - from.cy) * combatant.gridPosLerp;
  const sc   = from.scale + (to.scale - from.scale) * combatant.gridPosLerp;

  // Apply to sprite element directly (not through recomputeLayout)
  const el = document.querySelector(`#ev-sprite-${combatant.id}`);
  if (el) {
    const anchor = spriteAnchor(cx, cy, to.tileH * combatant.gridPosLerp + from.tileH * (1 - combatant.gridPosLerp), el.naturalWidth * sc * BASE_SCALE, el.naturalHeight * sc * BASE_SCALE);
    el.style.left      = `${anchor.left}px`;
    el.style.top       = `${anchor.top}px`;
    el.style.transform = `scale(${sc})`;
    el.style.transformOrigin = 'bottom center';
  }

  if (combatant.gridPosLerp >= 1.0) {
    setOccupancy(combatant, combatant.gridPosTarget.col, combatant.gridPosTarget.row);
    combatant.gridPosTarget = null;
    combatant.gridPosLerp   = 0.0;
    onComplete?.();
  }
}
```

This lerp helper is the only code path that writes sprite positions at 60fps — and only when a combatant is mid-movement. At steady state (no movement) it is never called.

---

## 11. DOM Structure

```
.ev-battlefield                    position: relative; overflow: hidden; width: 100%; height: 72vh
  svg.ev-grid                      position: absolute; inset: 0; width: 100%; height: 100%; z-index: 1
    <polygon class="ev-tile" …>    One per (col, row); hit zones + tile rendering
  .ev-sprite-layer                 position: absolute; inset: 0; z-index: 2; pointer-events: none
    <img id="ev-sprite-{id}" …>    One per living combatant; positioned via style.left/top + transform
  .ev-fx-layer                     position: absolute; inset: 0; z-index: 3; pointer-events: none
    .ev-dmg-number                 Floating damage numbers; animated via CSS keyframes
    .ev-status-icon                Status buff/debuff icons above sprites
```

**Layer roles:**
- `svg.ev-grid` — all tile geometry, hover highlights, targeting hit zones. The only layer with `pointer-events` active during targeting.
- `.ev-sprite-layer` — static portrait images during combat, animated via CSS `transform` transitions for attack lunges and hit-flash. Never receives pointer events (click falls through to SVG).
- `.ev-fx-layer` — ephemeral effects spawned and auto-removed by existing `spellFx.js` + floating number system. No interaction needed; transparent to pointer events.

---

## 12. Per-Render Cost Back-of-Envelope

### Current model (canvas redraw, every frame at 60fps)

Each `draw(ctx)` call:
- `ctx.drawImage` per sprite: ~6 heroes/companions + up to 8 enemies = **14 drawImage calls** minimum
- Tile grid: absent today, but adding 48 filled rhombuses to canvas = ~48 `ctx.fill()` calls
- Floating numbers: ~5 on average = 5 `ctx.fillText()` calls
- Background + parallax: 1–3 layer blits

**Estimated canvas ops per frame:** ~70. At 60fps: 4,200 canvas operations/second. Each DOM repaint is triggered by `ctx.clearRect()` on the full canvas, invalidating the entire bitmap.

### New model (DOM/SVG, layout-event driven)

**Steady state (no movement, no FX):**
- Zero sprite style writes
- Zero SVG polygon mutations
- CSS compositor handles hover/active states via GPU-accelerated `filter` and `transform` transitions — no JS involved
- FX layer: CSS `@keyframes` animations for damage numbers require zero JS after spawn

**Layout event cost (resize, round-start, actor-add/remove):**
- `recomputeLayout()`: 48 SVG polygon `points` attribute writes + up to 14 `img` style writes
- Runs at most once per round boundary (≈ every 3–8 seconds in normal combat)
- Debounced to 50ms on resize — never triggered during normal gameplay

**Movement animation (future only, not in current scope):**
- `tickGridMove()` per moving combatant: 3 style writes per frame
- At most 4 simultaneous movers (one per hero) = 12 style writes/frame — far below the 70 canvas ops/frame baseline

**Conclusion:** The new model reduces per-frame JS work from ~70 canvas operations to 0 at steady state. Even with a conservative overhead estimate of 2ms per `recomputeLayout()` call and one call per second (aggressive resize scenario), the budget is 2ms/1000ms = 0.2% CPU. The current canvas path consumes its allotment every single frame.

---

## Handoff to Phase 6

Phase 6 (card + rail spec) will need the following data shapes and event contracts from this phase:

### Combatant grid position format

```js
// On every combatant object exposed to Phase 6:
{
  id:      "hero-0",            // stable identifier; used as DOM id suffix
  gridPos: { col: 1, row: 4 }, // current tile (read-only from card rail's perspective)
  isHero:       true,
  isCompanion:  false,
  isPlayerControlled: true,     // true = manual spell rail active; false = auto-play
}
```

### Target-selection event payload

When the player clicks a tile (or the card rail resolves a spell target automatically), the system dispatches:

```js
// CustomEvent on document, type: 'ev:target-select'
{
  detail: {
    sourceCombatantId: "hero-0",   // actor whose turn it is
    targetCombatantId: "enemy-3",  // combatant occupying the clicked tile
    targetCol: 6,
    targetRow: 1,
    skillId: "fireball",           // null if basic attack
    eventSource: "tile-click",     // "tile-click" | "card-rail-auto" | "keyboard"
  }
}
```

The card rail (Phase 6) listens for `ev:target-select` to confirm the selection and trigger `_executeSkill` / `_basicAttack`. The grid (Phase 4) dispatches it.

### Targeting mode activation

Phase 6 must call:

```js
// Activate targeting — illuminates valid tiles for a given skill's AOE pattern
activateTargeting(sourceCombatantId, skillId, validTiles);
// validTiles: Array<{ col, row }> — which tiles glow as selectable

// Deactivate — clears hover states, restores default pointer-events
deactivateTargeting();
```

`activateTargeting` adds `targeting-active` to `.ev-battlefield` and adds `tile-targetable` class to each valid tile's polygon. `deactivateTargeting` removes them. Phase 6 calls `deactivateTargeting()` after the player confirms a target or cancels.

### Layout constants needed by Phase 6

```js
// Exported from the grid module as _layout (read-only snapshot):
{
  bw:        1280,    // battlefield width px
  bh:         770,    // battlefield height px
  gridTop:    154,    // px from battlefield top to row 0
  vanishX:    640,    // px — horizontal center
  vanishY:    115.5,  // px — vanishing point Y from battlefield top
  tileMetrics: [      // one entry per row index 0–5
    { row: 0, scale: 0.444, tileW: 71.1, tileH: 35.5 },
    { row: 1, scale: 0.522, tileW: 83.5, tileH: 41.7 },
    { row: 2, scale: 0.614, tileW: 98.3, tileH: 49.1 },
    { row: 3, scale: 0.723, tileW: 115.6, tileH: 57.8 },
    { row: 4, scale: 0.850, tileW: 136.0, tileH: 68.0 },
    { row: 5, scale: 1.000, tileW: 160.0, tileH: 80.0 },
  ]
}
```

Phase 6 uses `tileMetrics` to size card portrait thumbnails and turn-strip chips at the appropriate depth scale, creating a visual correspondence between the tile a character stands on and their card representation.
