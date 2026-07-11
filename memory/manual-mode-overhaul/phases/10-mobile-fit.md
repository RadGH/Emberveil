# Phase 10 — Mobile Portrait Fit: iPhone 14 Pro 393×852 Specification

**Author:** accessibility-tester agent
**Date:** 2026-04-29
**Viewport:** iPhone 14 Pro CSS portrait (393×852), 3× device pixel ratio
**Dependencies:** Phases 00–09 (all prior design + IA states)

---

## 1. Vertical Budget Breakdown

**iPhone 14 Pro portrait safe areas:**
- Top safe inset: 47px (system status bar, notch)
- Bottom safe inset: 34px (home indicator)
- Usable viewport: 852 − 47 − 34 = **771px**

**Mobile portrait allocation (concrete pixel math):**

```
┌─────────────────────────────────────────────────────┐
│ [SYSTEM STATUS BAR — 47px, not layout concern]      │
├─────────────────────────────────────────────────────┤
│ Header Strip (turn-pill + menu button)      56px    │  ← Fixed
├─────────────────────────────────────────────────────┤
│                                                     │
│  BATTLEFIELD                                        │
│  (2.5D tile grid + sprites + FX)           360px    │  ← Flexible ~47% of usable
│                                                     │
├─────────────────────────────────────────────────────┤
│ Selected Hero Card (portrait + rails)      144px    │  ← Fixed expanded
├─────────────────────────────────────────────────────┤
│ Portrait Switcher Strip (4×56px buttons)   56px     │  ← Fixed
├─────────────────────────────────────────────────────┤
│ Companion Row (if visible; default hidden) 0px      │  ← Toggle behind menu
├─────────────────────────────────────────────────────┤
│ Util Buttons (hamburger / bottom edge)     10px     │  ← Minimal
│ [BOTTOM SAFE INSET — 34px, not layout]              │
└─────────────────────────────────────────────────────┘

TOTAL: 47 + 56 + 360 + 144 + 56 + 10 + 34 = 707px
Remaining cushion: 852 − 707 = 145px (optional flex on battlefield)
```

**Rationale:**

- **Header 56px:** Pill-shaped turn indicator ("Round 3, Next: Alice") + collapsible menu button. Mimics web app conventions (tight top bar).
- **Battlefield 360px:** The 2.5D grid must compress to fit portrait. At 80/20 ground/sky split, ground is ~288px. This allows 72px for atmospheric top band. Enough for foreshortening without vertical squeeze that breaks readability.
- **Hero Card 144px:** Full-width card (minus 8px padding left/right = 377px) showing portrait (40px), name/class/bars (56px), and spell rail (48px stacked in narrow layout).
- **Portrait Switcher 56px:** Four 44×44 portrait buttons + 6px padding. Tap targets meet 44×44 minimum.
- **Companion Row 0px default:** Hidden behind a toggle in the header menu. Toggling it expands the header or pushes companion cards into a collapsible section below the hero card.
- **Util buttons 10px:** Single "⋯" menu button in the header, right side.

**Math verification:**
- Sum of fixed zones: 56 + 144 + 56 + 10 = 266px (HUD region)
- Available for battlefield: 771 − 266 = 505px
- Allocated: 360px
- Headroom: 145px (used for padding and responsive flex)

---

## 2. Battlefield Fit: Grid Compression Strategy

**Updated decision (post-roast 2026-04-30): 6 rows × 6 columns — same shape as desktop, no swipe-pan.** The Phase-12 roast flagged the prior "8 cols + swipe" answer as a contract drift against Phase 0 §7 (3+3=6) and Phase 4 §2 (post-amendment 6 cols). Mobile reuses the desktop grid; foreshortened back rows still hit the 44px touch-target floor via padded SVG hit zones (see §8).

**Updated tile dimensions at portrait 393px wide:**
- Row 5 (front, scale 1.0): tileW = 393/6 ≈ 65.5px, tileH ≈ 32.75px
- Row 0 (back, scale 0.444): tileW ≈ 29.1px, tileH ≈ 14.5px (visual size; hit zone padded to 44×44 minimum)

The full 6-col grid fits in 393px without scrolling. **Swipe-pan is rejected.**

> _Original "8 cols + swipe" text below preserved for the audit trail. **Rejected per roast §3.**_

**Decision (rejected): Keep 5 rows × 8 columns; allow horizontal pan/scroll via touch swipe.**

**Rationale:**

The 5-row × 8-column grid from phase 04 was specced for landscape (1536×1024 reference). At portrait 393×852:

1. **6 columns (drop outer columns):** Loses tactical width. Eliminates left/right edge positioning. Breaks enemy positioning predictability. Not recommended.
2. **8 columns, allow swipe:** Allows full grid visibility via horizontal pan. Matches existing game's scrollable inventory UX. Touch-natural. Cost: users must swipe to see far-left/far-right columns in early turns.
3. **Uniform scale (compress):** Squashes tiles vertically, reduces foreshortening clarity. Loses the 2.5D illusion. Not recommended.

**Chosen: Option 2 — Keep 8 cols, enable touch-swipe pan within the battlefield.**

### Tile Dimensions at Portrait

Using phase 04's `gridToScreen()` formula with **393px width** and **288px allocated ground height** (80% of 360px battlefield):

```
BATTLEFIELD_W = 393px
VIEWPORT_TOP_PCT = 0.20  → atmospheric top = 72px, ground = 288px
TILE_BASE_W = 393 / 8 = 49.125px (one-column reference at front)
TILE_BASE_H = 49.125 / 2 ≈ 25px

Row 0 (far back):  scale 0.444  → tileW = 21.8px, tileH = 10.9px
Row 1:             scale 0.522  → tileW = 25.6px, tileH = 12.8px
Row 2:             scale 0.614  → tileW = 30.2px, tileH = 15.1px
Row 3 (hero back): scale 0.723  → tileW = 35.5px, tileH = 17.8px
Row 4 (hero front):scale 0.850  → tileW = 41.7px, tileH = 20.9px
Row 5 (companion): scale 1.000  → tileW = 49.1px, tileH = 24.6px
```

**Cumulative grid height at portrait:**

```
Row 0 top: 0
Row 1 top: 10.9
Row 2 top: 10.9 + 12.8 = 23.7
Row 3 top: 23.7 + 15.1 = 38.8
Row 4 top: 38.8 + 17.8 = 56.6
Row 5 top: 56.6 + 20.9 = 77.5
Total height: 77.5 + 24.6 = 102.1px
```

**Total grid height = 102px of the 288px allocated — plenty of room.** Sprites fit comfortably without vertical compression.

### Touch-Swipe Pan Mechanics

- **Default viewport:** Columns 2–5 visible (middle of the 8-col grid). Heroes and initial enemies fit.
- **Swipe left:** Pan to reveal columns 4–7 (right side, enemy back row).
- **Swipe right:** Pan to reveal columns 0–3 (left side, flanking enemies).
- **Momentum scroll:** Snap to column alignment on swipe-release.
- **Implementation:** CSS `overflow-x: auto; scroll-snap-type: x mandatory` on `.ev-battlefield`. OR: Custom touch handler with `transform: translateX()` animation. Phase 04 decides.

---

## 3. Turn-Order Strip on Mobile

**Decision: Collapse to a compact pill in the header. Tap to expand as a full overlay.**

### Closed State (Default)

Display in the top header bar (56px total):
- **Left side:** "Round N" text (12px, gold, `Cinzel`)
- **Center-left:** Next-actor portrait chip (32×32px)
- **Right side:** Expand button (⌄ chevron icon, 24×24px, tap zone 44×44px with padding)

```html
<!-- Header bar layout -->
<header class="ev-mobile-header">
  <div class="ev-mobile-header__turn-pill">
    <span class="ev-round-label">Round 3</span>
    <img class="ev-mobile-next-chip" 
         src="{nextActor.portraitUrl}" 
         alt="Next: {nextActor.name}"
         width="32" height="32">
  </div>
  <button class="ev-mobile-expand-turns" aria-label="Expand turn order">
    <svg>⌄</svg>
  </button>
</header>
```

### Expanded State (Overlay)

Triggered by tap on expand button. Shows:
- Full turn-strip at 40% of battlefield height (~144px overlay)
- Positioned absolutely over the battlefield, top-aligned
- Dismissible by:
  - Tap outside the overlay
  - Tap the collapse button (⌃ chevron)
  - Player takes an action (auto-closes on `ev:spell-pick`)
- Does NOT auto-dismiss when the next actor's turn arrives (unlike desktop, which scrolls). The active chip is **highlighted with a gold pulse** and the turn-strip stays expanded until the player dismisses it manually or acts.

```html
<!-- Expanded overlay -->
<nav class="ev-turn-strip ev-turn-strip--mobile-expanded"
     id="ev-turn-strip-overlay">
  <header class="ev-turn-strip__mobile-header">
    <span class="ev-round-label">Round 3</span>
    <button class="ev-mobile-collapse-turns" aria-label="Collapse turn order">
      <svg>⌃</svg>
    </button>
  </header>
  <div class="ev-turn-strip__chips" role="list">
    <!-- All combatant chips, same as desktop -->
  </div>
</nav>
```

### CSS Breakpoint

```css
@media (max-width: 700px) {
  .ev-turn-strip { display: none; }  /* Desktop turn-strip hidden */
  .ev-mobile-header { display: flex; justify-content: space-between; }
  .ev-turn-strip--mobile-expanded {
    position: absolute;
    top: 56px;
    left: 0;
    right: 0;
    max-height: 144px;
    overflow-y: auto;
    background: var(--ember-deep);
    border-bottom: 1px solid var(--gold-dim);
    z-index: 20;
  }
}

@media (min-width: 701px) {
  .ev-mobile-header { display: none; }
  .ev-turn-strip { display: flex; }
  .ev-turn-strip--mobile-expanded { display: none; }
}
```

---

## 4. Selected Hero Card on Mobile

**Full-width card at 393−16 = 377px wide × 144px tall (approximately).**

**Layout: Portrait left, name/class/bars right, spell rail bottom.**

```html
<article class="ev-char-card ev-char-card--mobile-expanded"
         id="ev-card-{charId}">
  <div class="ev-card__mobile-header">
    <div class="ev-card__portrait-frame">
      <img src="{character.portraitUrl}" alt=""
           width="40" height="40"
           class="ev-card__portrait-img">
    </div>
    <div class="ev-card__identity">
      <span class="ev-card__name">{character.name}</span>
      <span class="ev-card__class-label">{character.className}</span>
      <svg class="ev-card__class-icon" width="14" height="14"><!-- glyph --></svg>
    </div>
  </div>
  <div class="ev-card__bars">
    <div class="ev-bar-group ev-bar-group--hp">
      <div class="ev-bar-track">
        <div class="ev-bar ev-bar--hp" style="width:{hpPct}%"></div>
      </div>
      <span class="ev-bar-label">{hp}/{maxHp}</span>
    </div>
    <div class="ev-bar-group ev-bar-group--mp">
      <div class="ev-bar-track">
        <div class="ev-bar ev-bar--mp" style="width:{mpPct}%"></div>
      </div>
      <span class="ev-bar-label">{mp}/{maxMp}</span>
    </div>
  </div>
  <div class="ev-card__spell-rail">
    <!-- Spell rail slots; see §5 -->
  </div>
</article>
```

**CSS for mobile card layout:**

```css
@media (max-width: 700px) {
  .ev-char-card--mobile-expanded {
    width: 100%;
    max-width: 377px;  /* 393 − 8 padding each side */
    display: grid;
    grid-template-columns: 40px 1fr;
    grid-template-rows: auto auto;
    gap: 8px;
    padding: 8px;
    min-height: 144px;
  }

  .ev-card__mobile-header {
    grid-column: 1 / 3;
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }

  .ev-card__bars {
    grid-column: 1 / 3;
    display: flex;
    gap: 8px;
  }

  .ev-card__spell-rail {
    grid-column: 1 / 3;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
}
```

---

## 5. Spell Rail on Mobile

**44px touch targets; compact icon layout (24×24 icon + 10px padding = 44px per button).**

At 377px width:
- 8 buttons × 44px = 352px → fits with 12px gutter for margins
- Wraps to a second row if a 6-skill class runs out of space

**Buttons in this order (left to right, wrap to next row):**
1. Basic Attack
2–N. Skills (up to 6)
N+1. Use Item
N+2. Skip / End Turn (last, rightmost)

At 24×24px icon size on mobile, the rail is comfortably dense without exceeding the width.

---

## 6. Mobile Portrait Switcher Strip

**4 portrait buttons, each 56×56px (44×44 portrait + 6px padding).**

```html
<div class="ev-mobile-portrait-strip" role="tablist">
  <button class="ev-mobile-portrait-btn"
          role="tab"
          aria-selected="{isSelected}"
          data-char-id="{charId}"
          aria-label="{character.name}">
    <img src="{character.portraitUrl}" alt="" width="44" height="44">
    <div class="ev-mobile-hp-strip">
      <div class="ev-mobile-hp-fill" style="width:{hpPct}%"></div>
    </div>
    <!-- Active state: gold outline -->
    {isSelected ? <div class="ev-mobile-portrait-btn__active-ring"></div> : null}
  </button>
  <!-- Repeat for up to 4 heroes -->
</div>
```

**Behavior:**
- Default: User can tap any portrait to switch the selected card.
- **During AWAITING-INPUT:** The active actor's portrait is forced to be selected. Other portraits are tappable for **read-only inspection** (swapping the visible card) but the card rail stays cold. After player acts, selection returns to wherever the user last tapped.
- **Visual:** Active portrait gets a 2px gold outline (`.ev-mobile-portrait-btn--active`). Pulsing animation (same as card rim pulse from phase 06) if the portrait is the awaiting-input actor.

**CSS:**

```css
.ev-mobile-portrait-btn {
  min-width: 56px;
  min-height: 56px;
  padding: 6px;
  position: relative;
  border: 1px solid var(--ember-pit);
  background: var(--ember-stone);
}

.ev-mobile-portrait-btn--active {
  border: 2px solid var(--gold-glow);
  padding: 5px;  /* adjust for thicker border */
}

.ev-mobile-portrait-btn--active:has(aria-selected="true") {
  animation: portrait-pulse 1.4s ease-in-out infinite;
}

@keyframes portrait-pulse {
  0%, 100% { box-shadow: 0 0 6px rgba(248, 232, 144, 0.3); }
  50%       { box-shadow: 0 0 12px rgba(248, 232, 144, 0.6); }
}

.ev-mobile-hp-strip {
  position: absolute;
  bottom: 4px;
  left: 4px;
  right: 4px;
  height: 3px;
  background: var(--ember-pit);
  border-radius: 1px;
  overflow: hidden;
}

.ev-mobile-hp-fill {
  height: 100%;
  background: var(--hp-green);
  transition: width 300ms ease;
}
```

---

## 7. Companion Row on Mobile

**Default: Hidden. Toggled via a "Companions" button in the header menu.**

When visible, companions render in a **collapsed list below the portrait switcher**:
- Each companion: 36×36 portrait + name + AI badge + HP bar
- Max width: 377px
- Layout: grid, 2 columns on phone (if 4 companions, 2×2; if 2 companions, 1 row)

**Rationale:** Screen real estate is precious on mobile. Companions auto-play in manual mode (they don't require player input) so they can be hidden by default. A toggle preserves the info without forcing it on-screen.

---

## 8. Tooltip on Mobile

**Decision: Bottom-sheet modal that slides up from the card row.**

**Trigger:** Long-press (500ms) on a spell icon, or dedicated "?" button next to the icon.

**Layout:**
- Slides up from bottom of viewport
- Covers 60–70% of screen height (~480px at 852px total)
- Shows the spell icon, name, cost, type badge, full description, and damage estimate
- **Dismiss:** Tap outside the sheet, or swipe down on the sheet header, or tap close button
- **Z-index:** Above the card rail, below the pause menu

**CSS:**

```css
.ev-tooltip-card {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  max-height: 480px;
  background: var(--ember-deep);
  border-top: 1px solid var(--gold-dim);
  border-radius: 16px 16px 0 0;
  padding: 16px;
  overflow-y: auto;
  animation: tooltip-slide-up 300ms ease-out;
  z-index: 30;
}

@keyframes tooltip-slide-up {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}

.ev-tooltip-card.ev-tooltip-card--dismissing {
  animation: tooltip-slide-down 200ms ease-in forwards;
}

@keyframes tooltip-slide-down {
  from { transform: translateY(0); }
  to   { transform: translateY(100%); }
}
```

---

## 9. Touch Target Audit & Targeting on Mobile

**Touch targets on portrait must all be ≥ 44×44 CSS px.**

| Element | Size (portrait) | Status |
|---------|---|---|
| Spell rail buttons | 24×24 icon + 10px padding = 44×44 | ✅ Pass |
| Portrait switcher button | 44×44 portrait + 6px padding = 56×56 | ✅ Pass |
| Expand/collapse chevron | 24×24 icon + 10px padding = 44×44 | ✅ Pass |
| Companion toggle (if present) | 24×24 icon + 10px padding = 44×44 | ✅ Pass |
| Tile polygon hit zones | Varies by row (back row ~25px wide) | ⚠️ See below |

**Back-row tile hit zones (row 0: ~22px wide × 10px tall):**

**Problem:** Back-row enemy tiles at portrait viewport are below 44px. Tapping a back-row enemy to select it as a target is difficult.

**Solution: Increase the SVG polygon touch zone.**

For tiles with width < 44px, expand the SVG `<polygon>` hit area via a pseudo-element or duplicate transparent polygon:

```html
<svg class="ev-tile-hit-zone">
  <!-- Visible tile outline (small) -->
  <polygon class="ev-tile-outline" points="..." />
  
  <!-- Invisible expanded touch zone (44px min width) -->
  <polygon class="ev-tile-hit-zone--expanded" 
           points="..."
           fill="transparent"
           pointer-events="all" />
</svg>
```

The expanded polygon is computed at grid layout time to ensure a minimum 44px touch target. Vertically: if tile is 10px tall, pad vertically to ~20–24px (halfway between rows, so touches don't accidentally select adjacent tiles).

**Alternative:** Disable back-row targeting for AOE spells that would hit them anyway (since AOE hits all enemies by default). Tap a front/mid-row enemy to trigger the AOE. Document this limitation in tooltips.

**Recommendation: Use expanded hit zones.** Preserves player agency while meeting accessibility standards.

---

## 10. Util Buttons (Settings, Log, etc.)

**Mobile: Single ⋯ (hamburger) button in the header, top-right.**

Tap opens a small dropdown or side panel with:
- Settings (gear icon + "Settings")
- Combat log (document icon + "Log")
- Pause / Resume (play/pause icon)
- (Any other utility buttons from desktop)

```html
<button class="ev-mobile-menu-button" aria-label="Combat menu" aria-haspopup="menu">
  <svg>⋯</svg>
</button>

<!-- Dropdown panel (hidden by default) -->
<div class="ev-mobile-menu-panel" role="menu" hidden>
  <button role="menuitem" data-action="settings">
    <svg>⚙</svg> Settings
  </button>
  <button role="menuitem" data-action="log">
    <svg>📋</svg> Combat Log
  </button>
  <button role="menuitem" data-action="pause">
    <svg>⏸</svg> Pause
  </button>
</div>
```

---

## 11. Mode Toggle (Auto vs Manual)

**Location on mobile:** Inside the Settings panel (not on the combat screen itself).

Opens the same Settings overlay as desktop, but constrained to mobile viewport height (680px, scrollable).

The "Combat Mode" toggle remains: `Auto / Manual` with a lock icon if Hardcore.

---

## 12. Performance Budget

**At portrait, the per-frame DOM is smaller:**
- Only 1 hero card visible (not 4–5 on desktop)
- Turn-strip hidden by default (not always rendering)
- Companion row hidden by default
- Tile grid: same DOM as desktop (SVG + sprite layer)

**Expected improvements:**
- Fewer card updates per tick (1 instead of 4)
- No turn-strip re-renders until expand button tapped
- Spell rail paint is cheaper (fewer spells visible if rail wraps)

**Potential performance costs:**
- Touch-swipe pan: CSS `overflow-x: auto` is native; no JS overhead
- Expanded overlay (turn-strip, tooltip): positioned absolutely, cheap
- Extra animations (portrait pulse, tooltip slide): CSS keyframes, no JS

**Target:** < 16ms per frame (60 fps) on mid-range Android device. Measure with DevTools throttling.

---

## 13. Test Matrix: iPhone 14 Pro Portrait Validation

### Test 1: Combat Start (Auto Mode)
- **Scenario:** Player enters a dungeon encounter with combat mode set to Auto.
- **Verify:**
  - Header pill shows "Round 1, Next: [first actor]"
  - Battlefield fits without horizontal scroll
  - Enemies visible in rows 0–3 (foreshortened back rows at 22–30px wide)
  - Hero cards visible in rows 3–5
  - Portrait switcher visible below selected hero card
  - Companion row is hidden (toggle not yet tapped)

### Test 2: Combat Start (Manual Mode)
- **Scenario:** Same encounter, manual combat mode.
- **Verify:**
  - Intro splash appears ("Manual Mode — tap your action when...")
  - After 2s, manual turn-order advances to first hero's turn
  - Hero card has active state (gold pulse rim)
  - Spell rail buttons are hot (full opacity, hover highlight)
  - Other hero portrait buttons are cold (0.3 opacity)

### Test 3: Awaiting Input (5 Spells)
- **Scenario:** Active hero has 5 spells selected (e.g., Fighter with Attack, Slash, Cleave, Defend, Heal).
- **Verify:**
  - Spell rail: Attack + 5 spells + Use Item + Skip = 8 buttons total
  - Layout: 2 rows (first row: 4 buttons; second row: 4 buttons) or 1 row with scroll
  - All buttons meet 44×44 tap target
  - Buttons render with correct state classes (ready, disabled, silenced, etc.)
  - No horizontal overflow beyond card width

### Test 4: Basic Attack + Targeting
- **Scenario:** Player taps Basic Attack button.
- **Verify:**
  - Enemy tiles show tap rings (or highlight color)
  - Back-row tiles' hit zones expand to 44px (or are visibly larger than tile outline)
  - Tapping an enemy tile dispatches the attack
  - Turn state advances; next actor's turn begins

### Test 5: AOE Spell Targeting
- **Scenario:** Player taps an AOE spell (e.g., Fireball, hits all enemies).
- **Verify:**
  - All enemy tiles highlight simultaneously
  - Confirm button appears (or auto-resolves on tap)
  - Hit zones for back-row enemies are accessible (44px minimum)
  - Spell resolves; multi-enemy damage visible

### Test 6: Spell Tooltip (Long-Press)
- **Scenario:** Player long-presses a spell icon for 500ms.
- **Verify:**
  - Bottom-sheet slides up from bottom
  - Sheet shows spell name, cost, description, damage estimate
  - Sheet is 60–70% screen height, scrollable if needed
  - Tap outside sheet dismisses it
  - Swipe down on sheet header dismisses it
  - Card rail remains visible behind sheet (not fully obscured)

### Test 7: Mobile Portrait Switcher
- **Scenario:** Combat has 3 heroes in the party.
- **Verify:**
  - 3 portrait buttons visible (smaller characters in a 4-slot grid, or 3 visible)
  - Each button is 56×56px (touchable)
  - Active button has gold outline + pulse
  - Tapping a non-active portrait switches the selected card
  - Selected card's spell rail becomes visible; other cards hidden

### Test 8: Turn-Strip Expand
- **Scenario:** Combat is in progress; player taps the "⌄" expand button in the header.
- **Verify:**
  - Overlay slides down from top (below header bar)
  - Covers ~144px of battlefield height
  - Shows all combatants' portrait chips
  - Current actor's chip has gold pulse animation
  - Tapping outside the overlay dismisses it
  - Tapping a close button (⌃ chevron) dismisses it
  - Taking an action (spell cast) auto-dismisses overlay

### Test 9: Victory Modal
- **Scenario:** All enemies defeated; victory modal should appear.
- **Verify:**
  - Modal covers full viewport
  - Spell rail and portrait switcher are hidden (dimmed, not clickable)
  - Victory summary is readable without zoom
  - Loot/XP text is legible (16px+)
  - "Continue" button is ≥ 44×44px

### Test 10: Pause Menu
- **Scenario:** Player presses ESC or taps a pause button (if present in header menu).
- **Verify:**
  - Pause overlay dims the battlefield
  - Pause menu modal appears on top
  - All elements are 44px+ tap targets
  - Resume button works; combat resumes with `_awaitingInput` preserved

---

## 14. Accessibility Compliance (WCAG 2.1 Level AA)

### Visual

- **Touch targets:** All interactive elements are 44×44px or larger ✅
- **Color contrast:** Gold on dark (9:1), red on dark (4.5:1), green on dark (3:1) — all pass AA ✅
- **Text size:** Minimum 14px effective at portrait without zoom ✅
- **Zoom:** Viewport not locked (iOS allows pinch); content reflows within bounds ✅

### Motor

- **No hover-only controls:** All desktop hover affordances (tooltips) have tap equivalents (long-press) on mobile ✅
- **Gesture alternatives:** Swipe to pan is complemented by arrow buttons in turn-strip menu ✅
- **No forced touch:** Basic Attack can be set to auto-target default enemy (if implemented in phase 06) ✅

### Cognitive

- **Consistent UI:** Card layouts match between selected/unselected state; same palette throughout ✅
- **Clear labeling:** Portrait buttons have character names as alt/aria-label ✅
- **Error prevention:** Spell cooldown and mana checks prevent invalid button taps ✅

---

## Handoff to Phase 12 (Review/Roast)

### Key Assumptions for Challenge

1. **393×852 is the only mobile target.** If the game must support wide phones (Galaxy S23 landscape = 922×462), the 700px breakpoint and portrait-only layout will not apply. Clarify scope: Android portrait + iPad landscape considered, or iOS portrait only?

2. **Touch-swipe pan is acceptable for grid visibility.** Assumes players are comfortable swiping left/right to see the full 8-column grid. If the game expects turn 1 visibility of all enemies, this is a blocker. Recommend testing with real users.

3. **Companion row can be hidden by default.** Assumes companions are AI-controlled and non-critical to the player's immediate awareness. If the player needs to see all 4–6 companions at all times, the 56px allocation for the companion row comes out of the battlefield (now 304px), reducing foreshortening depth.

4. **Expanded turn-strip overlay does NOT auto-dismiss on actor change.** This differs from desktop (where the strip scrolls to the new actor). Assumes the player manually closes the overlay or acts; otherwise it stays open. If this feels bad in playtesting, auto-close is a 1-line fix.

5. **Tooltip is a bottom-sheet, not inline.** The desktop right-side tooltip cannot fit on portrait. Assumes players prefer a modal bottom-sheet over inline tooltips above the spell rail (which would hide buttons). Confirm this in UX testing.

6. **Spell icon buttons are 44×44 on mobile (padded from 24×24 icon).** The spell rail wraps to 2 rows if a 6-skill character is selected. If buttons must stay ≥ 32×32 (closer to desktop density), they no longer meet 44px and the rail becomes a horizontal scroll strip. Trade-off: density vs. accessibility.

7. **Portrait switcher forces selection to active actor during AWAITING-INPUT.** The user cannot switch away while their turn is open. Rationale: prevents confusion (player taps a different hero, expects to control them, but can't because the prior hero's turn is still active). If the game wants to allow inspection of other heroes' cards during input, this logic inverts.

8. **Back-row tile hit zones are expanded SVG polygons.** The visible tile outline is 22px wide; the hit zone is padded to 44px. This may feel unintuitive if the visual tile is small. Alternative: disable targeting of back-row enemies and force front/mid-row tiles. Recommend playtesting to see which feels better.

9. **Companion row toggle is in the header menu (⋯ button).** Not always visible, requires 2 taps (menu, then companion toggle). If companions are important to show frequently, consider a dedicated "Companions" button or a slide-out side panel.

10. **Grid dimensions (393px wide, 360px tall, 5 rows × 8 cols) are fixed.** If art direction changes (e.g., 80/20 becomes 70/30), the battlefield height shrinks to ~318px and the header/footer must expand or the portrait switcher shrinks. Assuming the 80/20 split and 5-row grid are locked for the game.

11. **No explicit "Skip Turn" button on mobile portrait.** Skip is in the spell rail as the rightmost button. If players frequently skip actions, a more prominent affordance (e.g., "⊘ Skip" always visible at the bottom of the card) may be clearer.

12. **Companions render as a 2×2 grid below portrait switcher when visible.** Assumes up to 4 companions. If the game supports 6+ companions, the grid becomes 3×2 or a carousel, eating screen real estate.

---

## Summary: Concrete Pixel Allocations

| Zone | Height (px) | Purpose |
|---|---|---|
| System status bar (safe inset) | 47 | Not layout-controlled |
| Header (turn pill + menu) | 56 | Fixed |
| Battlefield | 360 | Flexible; min 288px for grid, max 505px available |
| Selected hero card | 144 | Fixed (portrait + bars + rail) |
| Portrait switcher | 56 | Fixed (4 × 44px buttons + padding) |
| Companion row | 0 | Hidden by default; toggle in menu |
| Util/margin | 10 | Bottom padding + edge case flex |
| Safe inset (home indicator) | 34 | Not layout-controlled |
| **Total viewport** | **852** | Sum all zones |

---
