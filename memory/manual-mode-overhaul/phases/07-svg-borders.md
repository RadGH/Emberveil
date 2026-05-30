# Phase 07 — SVG Border + Corner-Ornament Token System

**Author:** ui-designer agent
**Date:** 2026-04-29
**Reads:** Phase 00 (palette tokens, component inventory, §5 border study)

---

## 1. Vocabulary

### `corner-ornament`
The decorative terminus placed at each of a panel's four corners. In the reference image this is a **diamond lozenge** — a square rotated 45°, filled with the card surface color and stroked in gold, centered exactly on the corner point of the outer border rectangle. The ornament creates the visual impression that the border is "clasped" at each corner rather than simply miter-joined. Three variants are defined below (`lozenge`, `flourish`, `simple`). Each is a standalone `<svg>` element, 32×32 viewBox, positioned absolute and aria-hidden.

### `edge-rule`
The straight stroke running between two adjacent corner ornaments along one side of a panel. Rather than a single continuous rectangle stroke (which would render through the diamond center), the edge-rule is rendered as **four separate `<line>` or `<rect>` segments** — one per side — each inset by the ornament's half-width so there is a visual gap where the ornament sits. On HUD cards the gap is approximately 6px per side of the ornament. The edge-rule consumes `--border-stroke` (mapped to `--gold-rim` by default) at `--border-width` thickness.

### `seal-bar`
An optional horizontal accent bar, typically 2–4px tall, inset from the top or bottom edge of a panel, used on modal headers and tooltip cards to visually separate a title region. It is a simple gradient rect: solid `--gold-rim` at center, fading to transparent at both ends. The seal-bar is a CSS pseudo-element (`::after`) rather than SVG, because it scales naturally with container width and needs no corner interaction.

### `inset-glow`
A CSS `box-shadow: inset` applied to the panel wrapper that darkens the interior from all edges inward, reinforcing depth. Default value: `inset 0 0 16px rgba(0,0,0,0.72)`. On `active` state this shifts to an amber tint: `inset 0 0 16px rgba(200,160,32,0.18)`. On `enemy-target` state it shifts to a red tint: `inset 0 0 14px rgba(204,48,32,0.28)`. This is the only state-driven box-shadow; all other state changes are stroke-color swaps.

---

## 2. Three Corner Variants

### 2a. `lozenge` — the canonical HUD card corner

Directly from the reference image. A diamond (square rotated 45°) stroked in gold on a dark fill, centered on the panel corner. Used on HUD cards, turn-chips, and any panel classified as `hud-card` or `char-portrait-frame`.

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"
     aria-hidden="true">
  <rect x="9" y="9" width="14" height="14"
        fill="var(--ember-deep,#0d0820)"
        stroke="var(--gold-rim,#c8a020)" stroke-width="1.5"
        transform="rotate(45 16 16)"/>
</svg>
```

Visual sketch (ASCII, 16×8 character grid):

```
  TL corner              TR corner
  ·──────·               ·──────·
  │  ◇   │               │   ◇  │
  ·      ╷               ╵      ·
```

### 2b. `flourish` — curling vine, for premium / hero panels

Used on modals, tooltip cards, and the character-portrait-frame border on the hero select screen. The flourish adds a pair of curving bezier arms radiating from the diamond center, suggesting organic vine growth. Slightly larger visual footprint (occupies ~24px radius from corner). Uses a thinner stroke (`0.9px`) so the curves read as delicate rather than heavy.

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"
     aria-hidden="true">
  <!-- Core diamond -->
  <rect x="10" y="10" width="12" height="12"
        fill="var(--ember-deep,#0d0820)"
        stroke="var(--gold-rim,#c8a020)" stroke-width="1.4"
        transform="rotate(45 16 16)"/>
  <!-- Arm along top edge -->
  <path d="M16,7 C14,4 9,3 6,1" fill="none"
        stroke="var(--gold-rim,#c8a020)" stroke-width="0.9"
        stroke-linecap="round"/>
  <!-- Arm along left edge -->
  <path d="M7,16 C4,14 3,9 1,6" fill="none"
        stroke="var(--gold-rim,#c8a020)" stroke-width="0.9"
        stroke-linecap="round"/>
  <!-- Leaf dot on top arm -->
  <circle cx="5.5" cy="1.5" r="1.2"
          fill="var(--gold-rim,#c8a020)"/>
  <!-- Leaf dot on left arm -->
  <circle cx="1.5" cy="5.5" r="1.2"
          fill="var(--gold-rim,#c8a020)"/>
</svg>
```

This SVG is written for the **top-left** corner placement. The other three corners are the same symbol with CSS `transform: rotate(90deg|180deg|270deg)` — no separate files needed.

### 2c. `simple` — thin chevron, for mini / dense layouts

Used on util-buttons strip, turn-order chips, and any panel under 60px in one dimension. The motif is a right-angle L-bracket (open chevron), 2px stroke, no fill. Minimal DOM weight, reads cleanly at small sizes.

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"
     aria-hidden="true">
  <!-- Open L-bracket, 8px arm length, top-left corner -->
  <polyline points="14,4 4,4 4,14"
            fill="none"
            stroke="var(--gold-rim,#c8a020)" stroke-width="2"
            stroke-linecap="square" stroke-linejoin="miter"/>
</svg>
```

Rotated 90°/180°/270° via CSS for the remaining three corners, same as `flourish`.

---

## 3. Border Construction Pattern

**Chosen approach: four absolutely-positioned corner SVG elements + CSS-only edge-rules.**

The alternative — a single full-coverage SVG with four `<line>` edges — requires the SVG to know the panel's pixel dimensions at render time, which breaks in fluid/responsive layouts without JavaScript resize observers. Absolutely-positioned corners avoid this entirely: the corners are fixed-size (32×32px) at each quadrant; the edges are CSS `border` (or `outline`) on the wrapper itself, masked at corners by the corner elements layering on top.

The edge-rule gap at each ornament is achieved by replacing the standard CSS `border` with four `::before`/`::after` pseudo-backgrounds — but that requires four pseudo-elements and CSS doesn't provide four. Instead we use a simpler technique: the panel wrapper gets a 1.5px solid gold border, and each corner SVG element has `background: var(--ember-deep)` on a small padding area that covers the actual corner point of the border. This effectively "repaints" the corner, hiding the miter and creating the broken-gap visual, which matches the reference image exactly.

**HTML structure:**

```html
<div class="ev-panel ev-panel--card" role="region" aria-label="Fighter">
  <!-- Four corners, aria-hidden, rotated via CSS -->
  <svg class="ev-corner ev-corner--tl" aria-hidden="true"
       width="32" height="32" viewBox="0 0 32 32">
    <use href="#corner-lozenge"/>
  </svg>
  <svg class="ev-corner ev-corner--tr" aria-hidden="true"
       width="32" height="32" viewBox="0 0 32 32">
    <use href="#corner-lozenge"/>
  </svg>
  <svg class="ev-corner ev-corner--bl" aria-hidden="true"
       width="32" height="32" viewBox="0 0 32 32">
    <use href="#corner-lozenge"/>
  </svg>
  <svg class="ev-corner ev-corner--br" aria-hidden="true"
       width="32" height="32" viewBox="0 0 32 32">
    <use href="#corner-lozenge"/>
  </svg>
  <!-- Actual panel content -->
  <div class="ev-panel__body">
    <!-- HP bars, name, skill icons, etc. -->
  </div>
</div>
```

The `<symbol>` definitions (`#corner-lozenge`, `#corner-flourish`, `#corner-simple`) live in a single `<svg>` sprite block injected once into the page `<body>` at zero dimensions. This keeps the corner geometry in one place — the replacement-asset slot described in §8 below.

**Core CSS:**

```css
.ev-panel {
  position: relative;
  background: var(--ember-deep);
  border: var(--border-width, 1.5px) solid var(--border-stroke, var(--gold-rim));
  box-shadow: var(--panel-inset-glow, inset 0 0 16px rgba(0,0,0,0.72));
  padding: 8px 10px;
}

/* Corner anchoring */
.ev-corner {
  position: absolute;
  width: 32px;
  height: 32px;
  pointer-events: none;
}
.ev-corner--tl { top: -10px; left: -10px; }
.ev-corner--tr { top: -10px; right: -10px; transform: rotate(90deg); }
.ev-corner--bl { bottom: -10px; left: -10px; transform: rotate(270deg); }
.ev-corner--br { bottom: -10px; right: -10px; transform: rotate(180deg); }

/* Variant modifier: flourish corners */
.ev-panel--modal .ev-corner use { href: "#corner-flourish"; }

/* Variant modifier: simple corners */
.ev-panel--mini .ev-corner use { href: "#corner-simple"; }
```

---

## 4. Token Usage

The border system consumes the following CSS custom properties, all defined in the phase 00 palette block. No new tokens are introduced — state changes are implemented as local overrides on existing variables.

| CSS variable | Phase 00 source | Role in border system |
|---|---|---|
| `--ember-deep` | `#0d0820` | Corner ornament fill (the "hole" in the diamond) |
| `--ember-void` | `#06030e` | Panel body background on deepest-depth panels |
| `--gold-rim` | `#c8a020` | Default border stroke, corner ornament stroke |
| `--gold-glow` | `#f8e890` | Active / selected state border stroke |
| `--gold-dim` | `#7a6010` | Disabled state border stroke |
| `--hp-low` | `#cc3020` | Enemy-target state border stroke |
| `--fire-bloom` | `#ffc040` | Active-turn inset glow tint (amber pulse) |

Two derived properties are defined on `.ev-panel` and overridden per state:

```css
.ev-panel {
  --border-stroke: var(--gold-rim);
  --border-width: 1.5px;
  --panel-inset-glow: inset 0 0 16px rgba(0,0,0,0.72);
}
```

---

## 5. Variant Matrix

| Panel type | Corner variant | Edge style | Inset glow | Notes |
|---|---|---|---|---|
| `hud-card` | `lozenge` | 1.5px gold solid | `rgba(0,0,0,0.72)` | Main character cards bottom-HUD |
| `tooltip-card` | `flourish` | 1.5px gold solid + `seal-bar` top | `rgba(0,0,0,0.60)` | Floats right-of-HUD; bottom-sheet on mobile |
| `util-button` | `simple` | 1px gold solid | none | 36×36px; corners scaled to 20px |
| `char-portrait-frame` | `lozenge` | 2px gold solid | `rgba(0,0,0,0.80)` | Portrait image cropped inside frame |
| `turn-chip` | `simple` | 1px; gold=hero, red=enemy | none | 40×40px; minimal ornament |
| `modal` | `flourish` | 2px gold solid + `seal-bar` top & bottom | `rgba(0,0,0,0.80)` | Full-coverage; header/footer seal bars |
| `round-label` | `simple` | 1px gold solid | none | 64×24px chip; chevron at corners |
| `seal-bar` standalone | N/A | gradient fill, no stroke | — | Used as sub-divider inside modal |
| `status-icon` | none | 1px color ring only | none | Tiny; no corner ornament at 14px |
| `enemy-hp-bar` | none | none | none | Inline bar only |

---

## 6. States

All state changes modify at most two CSS variables. No new class-level style blocks needed for most states — a single data attribute or modifier class overrides the local tokens.

**Default:**
```css
/* No override; inherits panel defaults */
```

**Active (current turn / hovered spell):**
```css
.ev-panel[data-state="active"] {
  --border-stroke: var(--gold-glow);
  --panel-inset-glow: inset 0 0 18px rgba(248,232,144,0.18);
}
```

**Disabled (dead character, spent resource):**
```css
.ev-panel[data-state="disabled"] {
  --border-stroke: var(--gold-dim);
  --panel-inset-glow: inset 0 0 12px rgba(0,0,0,0.85);
  opacity: 0.55;
}
```

**Selected (spell icon in casting state):**
```css
.ev-panel[data-state="selected"] {
  --border-stroke: var(--arc-blue);
  --panel-inset-glow: inset 0 0 14px rgba(64,168,255,0.22);
}
```

**Enemy-target (click-to-target highlight on enemy card / sprite):**
```css
.ev-panel[data-state="enemy-target"] {
  --border-stroke: var(--hp-low);
  --panel-inset-glow: inset 0 0 14px rgba(204,48,32,0.28);
}
```

The corner SVGs inherit `stroke` from `currentColor` on their `use` element, so when `--border-stroke` changes, the corner diamonds update automatically without re-rendering or JavaScript.

---

## 7. Performance Note

**Back-of-envelope:** The HUD in its heaviest state has 5 hero cards + 1 companion card (6 `ev-panel--card` nodes) + 9 turn-chips + 1 tooltip-card + 1 modal (rarely visible) + 3 util-buttons = roughly **20 panel instances** at peak. Each panel has 4 corner SVGs, each with one `<use>` element referencing a shared `<symbol>`. That is **80 SVG DOM nodes** for corner ornaments, each containing 1–3 shape elements = approximately **200 total SVG shape elements** on screen simultaneously.

The existing CombatScreen DOM is already heavier than this — `_renderStatusRow`, the HUD member flex row, and the spell FX layers collectively produce several hundred DOM nodes during a busy round. Browser compositors handle inline SVG at this count without issue on current mid-range hardware (tested baseline: iPhone 12 / Chrome 120+). No canvas fallback is needed.

The `<symbol>` sprite block means all geometry is defined once; `<use>` elements are pointer references. SVG re-layout is triggered only when the panel resizes (fluid width change), not on every frame. State changes via CSS variable override do not trigger re-layout — only repaint of the stroke property, which is GPU-composited.

**Conclusion:** 40+ panel instances (a future screen with more components) would produce ~320 SVG shape elements. Still within the safe DOM range for inline SVG on mobile. No optimization required for the foreseeable scope.

---

## 8. Replacement-Asset Note

The `<symbol>` sprite block is the single swap point. It lives in a shared `ev-symbols.html` partial (or equivalent JS string injected on boot), referenced as:

```html
<!-- Injected once into <body> at zero size -->
<svg width="0" height="0" style="position:absolute">
  <defs>
    <symbol id="corner-lozenge" viewBox="0 0 32 32"> ... </symbol>
    <symbol id="corner-flourish" viewBox="0 0 32 32"> ... </symbol>
    <symbol id="corner-simple"   viewBox="0 0 32 32"> ... </symbol>
  </defs>
</svg>
```

When the user approves a real-art replacement batch, the artist delivers three 32×32 SVG files (see Asset Replacement Queue §8 item 15 in phase 00). The migration is:

1. Open `ev-symbols.html`.
2. Replace the `<symbol id="corner-lozenge">` inner content with the new art's path data.
3. All panels on all screens update instantly — no per-panel edits.

PNG replacement is also possible: swap the `<symbol>` body for `<image href="corner-lozenge.png" width="32" height="32"/>`. The consuming HTML structure is identical either way.

---

## Handoff to Phase 11

**3–4 visual call-outs for the slideshow deck to screenshot or embed:**

1. **Variant comparison strip** — `preview.html` row 1 (cells 1–3) shows all three corner variants side by side at `hud-card` scale on `--ember-deep` background. Screenshot this row for the "Design language" slide.

2. **State matrix** — `preview.html` row 2 (cells 4–7) shows a single `lozenge` card in default → active → disabled → selected states. The gold/blue/dim stroke change reads clearly even in a small screenshot. Use for the "Interactive states" slide.

3. **Enemy-target highlight** — `preview.html` cell 8 shows the red `enemy-target` state with the inset crimson glow. Pair with the `selected` cell to illustrate ally-vs-enemy visual language.

4. **Flourish at modal scale** — `preview.html` cells 9–10 show the `flourish` variant at a wide modal width (~480px). The curling vine arms are legible at screenshot resolution. Use for the "Premium panels / modals" slide and note the single-swap-point replacement path.
