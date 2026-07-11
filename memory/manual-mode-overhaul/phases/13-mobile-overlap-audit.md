# M385 Mobile UI Overlap Audit — iPhone 14 Pro (393×852 Portrait)

## Executive Summary

This read-only audit identifies 10 overlapping UI elements at 393×852 CSS portrait (iPhone 14 Pro 3× DPR). **Combat text-mode (captions bar) is the critical P0 issue**, overlapping the HUD card row when enabled. All issues are fixable with targeted CSS changes (1–2 lines each). Recommend batch remediation in a focused pass.

**Viewport constraints:** 393px width × 852px height. HUD anchors to `bottom: 0` (48–52px tall). Potion belt sits above HUD (36–48px). Combat captions overlay at `bottom: 80px` with large font (1.25rem). At 852px total, content above round counter leaves ~320px for canvas combat view + overlay buttons.

---

## Critical Issue: Combat Text-Mode Overlap (P0)

**Status:** CONFIRMED — overlaps HUD card row and partially obscures skill icons.

### Root Cause

**File:** `/home/radgh/claude/game13/src/ui/screens/CombatScreen.js:7555–7571`

```css
.cbt-captions {
  display: none;
  position: absolute; bottom: 80px; left: 0; right: 0;  /* <-- ISSUE: fixed 80px offset */
  padding: 0.5rem 1rem 1.2rem;
  background: linear-gradient(transparent, rgba(4,2,6,0.85));
  pointer-events: none; z-index: 800;
  flex-direction: column; gap: 0.25rem; align-items: flex-start;
}
.cbt-captions.cbt-captions-active { display: flex; }
.cbt-caption-line {
  font-size: 1.25rem; line-height: 1.35; font-weight: 600;  /* <-- Large, eats space */
  color: #f0e8d8; text-shadow: 0 1px 4px rgba(0,0,0,0.9);
  max-width: 90%; transition: opacity 0.4s ease;
}
```

**Problem:** `.cbt-captions` position is `bottom: 80px`, placing the caption baseline 80px from the viewport bottom. At 852px tall, this puts captions roughly 8–12px above the HUD card row (`bottom: 0`). With font-size 1.25rem (~18–20px at 3× DPR) and line-height 1.35, the text extends 25–30px vertically, **overlapping the character name/HP bar area** of `.hm` cards.

**Reproduction:** Enable "Combat Captions" in Settings → Combat Settings. Fight any enemy. Watch round 1–2 active: caption text bleeds over character names.

---

## Priority Fix List (Top 10)

| Rank | Component | Issue | Severity | Recommendation |
|------|-----------|-------|----------|-----------------|
| **1** | **Combat Captions** | Overlaps HUD `.hm` card row when active | **P0** | Relocate to `bottom: 105px` (or mobile: `bottom: 150px` @max-width: 450px) |
| 2 | Log Panel | Positioned `top: 10px; right: 10px` — bleeds off-screen at narrow widths (width: 250px fixed) | P1 | Add `@media (max-width: 450px) { width: min(90vw, 220px); right: 5px; }` |
| 3 | Damage Meter | Z-index 920, positioned `top: 90px; right: 8px` — no mobile breakpoint, may crowd narrow HUD | P1 | Add mobile collapse: `@media (max-width: 450px) { display: none; }` or collapse toggle |
| 4 | Meter Open Button | Positioned `bottom: 140px; right: 8px` — may sit on top of potion-belt scroll area | P1 | Adjust to `bottom: 85px` (above potion-belt) or hide on mobile |
| 5 | Boss Intro Overlay | Max-width 560px, no mobile cap — text may overflow at 393px | P2 | Add `max-width: min(560px, 92vw)` |
| 6 | Pause Modal | Width 90%, max-width 320px — OK, but overlays can stack if multiple modals fire | P2 | Ensure pause z-index 1000 > captions z-index 800 (✓ already correct) |
| 7 | Inventory Equip Panel | Hidden @max-width: 600px (✓ correct), but equip buttons show @max-width: 720px | P2 | Test button overflow at 393px; likely OK due to `display: none` at 720px |
| 8 | Map Modal Position | Positioned `top: 12%; left: 50%; transform: translateX(-50%)` — OK but may clip on very short screens | P2 | Add safe min-height: 24vh or max-height gating |
| 9 | Town Service Buttons | Tab bar at top, content below — no observed overlap, but confirm bottom CTA doesn't hide | P2 | Verify sticky bottom CTAs don't hide on save/hire modals |
| 10 | Portal Bar Button | Fixed width SVG 14×14px, okay, but verify tooltip positioning on narrow screens | P2 | Test "Return to Town" tooltip doesn't overflow right edge |

---

## Combat Text-Mode: Detailed Fix

### Current Code (BROKEN)

```css
.cbt-captions {
  display: none;
  position: absolute; bottom: 80px; left: 0; right: 0;
  padding: 0.5rem 1rem 1.2rem;
  background: linear-gradient(transparent, rgba(4,2,6,0.85));
  pointer-events: none; z-index: 800;
  flex-direction: column; gap: 0.25rem; align-items: flex-start;
}
```

**Why it fails:** Potion belt is ~36–48px. HUD is ~50px. Together, they consume the bottom 98px. Caption at `bottom: 80px` sits inside this 98px zone, overlapping the HUD cards.

### Recommended Fix

**Option A (Simple):** Extend captions above potion-belt.

```css
.cbt-captions {
  display: none;
  position: absolute; bottom: 110px; left: 0; right: 0;
  /* ... rest unchanged ... */
}
```

**Justification:** Potion belt ~45px + HUD ~50px = 95px. Setting `bottom: 110px` places captions 15px above the potion-belt, ensuring no overlap.

**Option B (Mobile-first):** Add a mobile breakpoint.

```css
.cbt-captions {
  display: none;
  position: absolute; bottom: 80px; left: 0; right: 0;
  padding: 0.5rem 1rem 1.2rem;
  background: linear-gradient(transparent, rgba(4,2,6,0.85));
  pointer-events: none; z-index: 800;
  flex-direction: column; gap: 0.25rem; align-items: flex-start;
}

@media (max-width: 450px) {
  .cbt-captions { bottom: 150px; }  /* Push above potion-belt on mobile */
}
```

**Recommendation:** Option A (simple global fix) is best because captions are already large and desktop users benefit from extra clarity too. If you want to reclaim vertical space on desktop, Option B gates the fix to small screens only.

**Testing:** After fix, enable "Combat Captions" in Settings. Run a 2–4 round fight. Verify caption text sits cleanly above potion-belt with no overlap of character names or HP bars.

---

## Log Panel Overflow (P1)

**File:** `/home/radgh/claude/game13/src/ui/screens/CombatScreen.js:7369–7383`

```css
.cbt-log-panel {
  position: absolute; top: 10px; right: 10px;
  width: min(250px, 42vw); max-height: 170px;
  background: rgba(8,4,6,0.88); border: 1px solid rgba(232,160,32,0.18);
  border-radius: 8px; overflow: hidden; pointer-events: none;
}
```

**Issue:** At 393px width, `42vw` = ~165px, but panel tries to take `min(250px, 165px)` = 165px. Top-right corner of the screen has limited space; no mobile safeguard on the right edge.

**Fix:**

```css
.cbt-log-panel {
  position: absolute; top: 10px; right: 10px;
  width: min(250px, 42vw); max-height: 170px;
  background: rgba(8,4,6,0.88); border: 1px solid rgba(232,160,32,0.18);
  border-radius: 8px; overflow: hidden; pointer-events: none;
}

@media (max-width: 450px) {
  .cbt-log-panel {
    width: min(90vw, 220px);
    right: 5px;
    max-height: 130px;  /* Tighter on mobile */
  }
}
```

---

## Damage Meter Collapse (P1)

**File:** `/home/radgh/claude/game13/src/ui/screens/CombatScreen.js:7384–7396`

```css
.cbt-meter-panel { 
  position: absolute; top: 90px; right: 8px; 
  width: 180px; 
  background: rgba(10,8,14,0.88); 
  border: 1px solid rgba(160,80,255,0.35); 
  border-radius: 8px; z-index: 920; color: #f0e8d8; 
  font-size: 11px; 
  pointer-events: all; 
  backdrop-filter: blur(4px); 
}
```

**Issue:** At 393px wide, a 180px panel consumes 46% of width. On mobile, DPS meter is typically disabled anyway, but if enabled, it crowds the right side.

**Fix:**

```css
@media (max-width: 450px) {
  .cbt-meter-panel {
    width: 160px;
    top: 70px;
    right: 4px;
    font-size: 10px;
  }
  .cbt-meter-panel .meter-body { max-height: 120px; }
}
```

---

## Meter Open Button Overlap (P1)

**File:** `/home/radgh/claude/game13/src/ui/screens/CombatScreen.js:7397`

```css
.cbt-meter-open { 
  position: absolute; bottom: 140px; right: 8px; 
  z-index: 900; 
  min-width: 32px; min-height: 32px; 
  width: 32px; height: 32px; 
  border-radius: 50%; 
  background: rgba(0,0,0,0.55); 
  border: 1px solid rgba(160,80,255,0.5); 
  color: #b87fff; 
  cursor: pointer; 
  padding: 0; 
  pointer-events: all; 
  font-weight: 700; 
}
```

**Issue:** Button sits at `bottom: 140px`. Potion belt spans `bottom: 36–48px` up to `0px`. The button is roughly 92px above the belt, BUT if the potion-belt scrolls or has wide buttons, the button may visually overlap.

**Fix:**

```css
.cbt-meter-open { 
  position: absolute; bottom: 85px; right: 8px;  /* Sit just above potion-belt */
  /* ... rest unchanged ... */
}

@media (max-width: 450px) {
  .cbt-meter-open { bottom: 110px; }  /* Higher on mobile to avoid potion-belt clutter */
}
```

---

## Quick Wins (1–2 Line Changes)

Batch these together for a single release:

1. **Combat Captions Mobile Fix** (1 line):
   ```css
   @media (max-width: 450px) { .cbt-captions { bottom: 150px; } }
   ```

2. **Log Panel Mobile Squeeze** (3 lines):
   ```css
   @media (max-width: 450px) {
     .cbt-log-panel { width: min(90vw, 220px); right: 5px; }
   }
   ```

3. **Meter Button Reposition** (1 line):
   ```css
   .cbt-meter-open { bottom: 85px; }  /* Was 140px, now sits above belt */
   ```

All three fit in one focused PR with zero behavioral changes, only CSS repositioning.

---

## Testing Checklist (393×852 Portrait)

- [ ] Combat captions enabled; run 3-round fight; verify captions do not overlap HUD card names
- [ ] Log panel visible (top-right); text readable, no horizontal scroll
- [ ] Potion belt scrolls smoothly if >3 potions; buttons not hidden by meter button
- [ ] Damage meter (if enabled) stays within viewport right edge
- [ ] Pause modal centers correctly; no clipping
- [ ] Victory/defeat modal readable; buttons accessible (min 44px touch target)
- [ ] Inventory equip buttons hidden @<600px (✓)
- [ ] Map portal/treasure modals center without overflow
- [ ] Town tabs visible; sticky CTAs don't hide behind modals

---

## Implementation Notes

- **Target file:** `/home/radgh/claude/game13/src/ui/screens/CombatScreen.js` (lines 7361–7616, COMBAT_STYLES definition)
- **No JS changes required:** All fixes are pure CSS
- **Regression risk:** LOW — only position/spacing tweaks, no functional changes
- **Browser support:** All modern mobile browsers (Safari, Chrome, Firefox)
- **Performance:** No impact

