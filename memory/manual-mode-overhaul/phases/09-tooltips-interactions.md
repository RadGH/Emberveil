# Phase 09 — Tooltips + Interaction Patterns

**Author:** accessibility-tester + ui-designer
**Date:** 2026-04-29
**Reads:** Phases 00–08, reference image
**Feeds:** Phases 10 (mobile), 11 (implementation)

---

## 1. Tooltip Taxonomy

There are four distinct tooltip kinds, each with its own trigger, dismiss behavior, and content layout. Each is a `<div class="ev-tooltip-card ev-panel">` variant with distinct CSS class and positioning rule.

### 1.1 `spell-tooltip` — Right-edge card describing the selected spell

**Trigger:** Hover on a spell icon (200ms delay on desktop, tap-and-hold 400ms on touch).

**Position rule:** Floats to the right of the HUD card row on desktop. On mobile, slides up as a partial bottom-sheet (~160px tall, does not cover the spell rail). A 8px minimum gap separates the tooltip right edge from the viewport right edge. On desktop, tooltip top edge aligns with the hovered icon's top edge (adjusted downward if it would overflow viewport).

**Dismiss rule:**
- Desktop: hover out, click outside tooltip, or ESC key closes it. Immediately re-opens on next icon hover (no 200ms delay on re-hover within the same session).
- Touch: tap outside the tooltip, or swipe down from the sheet header.

**Content layout:**
```
┌─────────────────────────────────┐
│  SEAL-BAR (gold gradient)       │  2px
├─────────────────────────────────┤
│ Fireball                        │ Spell name (Cinzel 14px bold)
│ Columns — 4 mana — 8s cooldown  │ Subtitle + stats (Crimson 11px italic)
├─────────────────────────────────┤
│ Deals 70% INT as Fire damage    │ Primary effect (Crimson 12px)
│ Enemies in a 3×3 grid hit       │ Secondary detail (Crimson 11px dim)
│                                 │
│ Predicted: 35–48 damage (vs     │ Expected damage range (on targeting)
│ target armor/resist)            │
│                                 │
│ ✦ Burning (30% / turn for 2T)   │ Status effects applied (gold glyph)
│ ✦ Vulnerable (−15% resistances) │
├─────────────────────────────────┤
│ [ CONFIRM ] or [ CANCEL ]       │ Action buttons (targeting only)
└─────────────────────────────────┘
```

**Styling:** Wraps `.ev-panel--tooltip` class which applies phase 07 `flourish` corner ornaments, a seal-bar `::after` at the top (2px gold gradient), and `--panel-inset-glow: inset 0 0 14px rgba(200,160,32,0.18)` (amber tint). Width: `240px` desktop, `90vw mobile capped at 340px`. No box-shadow beyond the inset glow.

**Content structure:**
```html
<aside class="ev-tooltip-card ev-panel ev-panel--tooltip"
       id="ev-tooltip-card"
       aria-live="polite"
       aria-atomic="true"
       hidden>
  <!-- Four corners per phase 07 -->
  <div class="ev-panel__body">
    <h3 class="ev-tooltip__spell-name">{spell.name}</h3>
    <p class="ev-tooltip__spell-meta">
      {spell.type} — {spell.mpCost} mana — {spell.cooldown}s cooldown
    </p>
    <p class="ev-tooltip__spell-desc">{spell.description}</p>
    
    <!-- Only shown when targeting an enemy -->
    <div class="ev-tooltip__predicted-damage" hidden>
      <strong>Predicted: <span id="ev-dmg-min">35</span>–<span id="ev-dmg-max">48</span> damage</strong>
    </div>
    
    <!-- Status effects -->
    <div class="ev-tooltip__statuses" hidden>
      {status glyph + name + duration, one per line}
    </div>
  </div>
</aside>
```

### 1.2 `enemy-tooltip` — Small floating chip over enemy sprite or tile

**Trigger:** Hover on enemy sprite or tile polygon (150ms delay). During targeting, mandatory — shows on hover with no delay.

**Position rule:** Floats above the enemy sprite, centered horizontally on the sprite, offset `12px` upward. If near viewport top, shifts to below sprite (12px down). Maximum width: `140px`. No rotation or complex transforms — stays axis-aligned.

**Dismiss rule:** Hover away, or ESC during targeting.

**Content layout:**
```
┌──────────────────────────────┐
│ Goblin Archer           │ Name (Cinzel 12px)
│ HP: 28 / 45    [████░ ] │ HP bar (inline, 80px)
│ STR 8 | DEX 12 | INT 6 │ Stats (Crimson 9px, monospace)
│ 🛡 Weakness: Fire (+25%) │ Status / vulnerabilities (gold glyph)
└──────────────────────────────┘
```

**Styling:** `.ev-tooltip-card.ev-tooltip-card--enemy`. Border: 1.5px `--gold-rim`, no corners (simple L-bracket at corners per phase 07). Background: slightly darker than main cards (`--ember-pit`). Padding: `6px 8px`. Font size: one size smaller than spell tooltip (Cinzel 11px name, Crimson 10px body). Fade-in animation: 120ms ease-out.

**Content structure:**
```html
<div class="ev-tooltip-card ev-tooltip-card--enemy"
     data-enemy-id="{enemyId}"
     hidden>
  <strong class="ev-tooltip__enemy-name">{enemy.name}</strong>
  <div class="ev-tooltip__enemy-hp">
    HP: <span class="ev-hp-value">{enemy.hp}</span> / {enemy.maxHp}
    <div class="ev-hp-bar-mini" style="width: {hpPct}%"></div>
  </div>
  <div class="ev-tooltip__enemy-stats">
    STR {enemy.str} | DEX {enemy.dex} | INT {enemy.int}
  </div>
  <div class="ev-tooltip__enemy-status" hidden>
    {status icons + names}
  </div>
</div>
```

### 1.3 `ally-tooltip` — Small status icon chip on ally card

**Trigger:** Hover on a status icon on an ally HUD card (200ms delay). Tap-and-hold on touch (400ms).

**Position rule:** Pops up above the hovered status icon, centered horizontally, offset `8px` upward. Width: `120px`. If icon is near viewport edge, tooltip shifts to keep it in bounds (prefer left alignment).

**Dismiss rule:** Hover away or tap outside.

**Content layout:**
```
┌─────────────────────────┐
│ Burning                 │ Status name
│ 30% / turn for 2 turns  │ Effect + duration
└─────────────────────────┘
```

**Styling:** `.ev-tooltip-card.ev-tooltip-card--status`. Minimal decoration: 1px border `--gold-dim`, no corners. Background: `--ember-stone`. Cinzel 11px name, Crimson 9px body. Fade: 100ms ease-out (faster than spell tooltip).

### 1.4 `ui-help-tooltip` — One-line hint on settings, buttons, toggles

**Trigger:** Hover on util buttons, mode toggle, or help icons (300ms delay — slower to avoid clutter). Tap-and-hold 500ms on touch.

**Position rule:** Appears above or below the hovered button, centered horizontally, offset `4px` from button edge. Single line, wraps only if content exceeds 80px. Maximum width: `140px`.

**Dismiss rule:** Hover away, click the button, or tap outside.

**Content layout:**
```
Manual mode required for Hardcore difficulty.
```

**Styling:** `.ev-ui-help-tooltip`. Inline tooltip, no panel frame. `--ember-stone` background, 1px `--gold-dim` border, border-radius 3px. Cinzel 10px italic. Padding: 4px 6px. Fade: 120ms ease-out.

---

## 2. Hover vs Tap Parity

The application must work equally well on pointer devices (mouse, trackpad) and touch devices. Parity is achieved by detecting input mode **once per session lifecycle** (on first interaction), not via user-agent sniffing.

### 2.1 Detection strategy: `pointerType` at first interaction

```js
let inputMode = 'unknown';  // will be 'pointer' or 'touch'

document.addEventListener('pointerdown', (e) => {
  if (inputMode === 'unknown') {
    inputMode = e.pointerType;  // 'mouse', 'touch', 'pen'
    initializeTooltipMode(inputMode);
  }
}, { once: true, capture: true });
```

Once detected, the mode persists for the session. No re-detection on subsequent interactions. This handles hybrid devices correctly — a user on an iPad with a mouse will use the mouse interaction model if they start with the mouse.

### 2.2 Pointer device (mouse/trackpad) behavior

| Event | Delay | Behavior |
|---|---|---|
| **Hover in** | 200ms debounce | Tooltip fades in (120ms ease-out). If user moves mouse within 200ms, debounce resets (no flicker on transit across icons). |
| **Hover out / click outside** | 0ms | Tooltip fades out (80ms ease-in) immediately. No delay. |
| **On same icon within 1s** | 0ms | Re-hover on the same icon within 1 second dismisses the 200ms delay — tooltip shows immediately. Encourages re-inspection. |

**Debounce implementation:**
```js
let hoverTimer = null;
const HOVER_DELAY_MS = 200;

element.addEventListener('pointerenter', (e) => {
  if (e.pointerType !== 'mouse') return;  // not using this mode
  clearTimeout(hoverTimer);
  hoverTimer = setTimeout(() => showTooltip(e.target), HOVER_DELAY_MS);
});

element.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  // Reset debounce on any movement (new icon or same icon moved)
  clearTimeout(hoverTimer);
  hoverTimer = setTimeout(() => showTooltip(e.target), HOVER_DELAY_MS);
});

element.addEventListener('pointerleave', (e) => {
  if (e.pointerType !== 'mouse') return;
  clearTimeout(hoverTimer);
  hideTooltip();
});
```

### 2.3 Touch device (mobile) behavior

| Event | Duration | Behavior |
|---|---|---|
| **Touch down (no move)** | 0–400ms | Timer starts. No visual feedback yet. |
| **User holds still** | 400ms reached | Tooltip fades in (150ms ease-out). Visual haptic feedback (via `navigator.vibration` on supported devices: 20ms pulse). Tooltip stays until dismissed. |
| **User moves > 12px** | Before 400ms | Timer cancelled. Treat as scroll or pan; ignore. |
| **Tap (< 100ms, < 3px drift)** | Immediate | Action fires (spell cast, target select). Tooltip not shown unless deliberately long-pressed. |
| **Tap outside tooltip** | 0ms | Tooltip dismisses. User can tap another element. |

**Touch detection and timer:**
```js
let touchStartTime = 0;
let touchStartX = 0, touchStartY = 0;
let touchTimer = null;
const TOUCH_HOLD_MS = 400;
const TOUCH_DRIFT_THRESHOLD = 12;  // px

element.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'touch') return;
  
  touchStartTime = Date.now();
  touchStartX = e.clientX;
  touchStartY = e.clientY;
  
  touchTimer = setTimeout(() => {
    if (touchTimer !== null) {  // not cancelled by pointermove
      showTooltip(e.target);
      triggerHaptic(20);  // 20ms vibration pulse
    }
  }, TOUCH_HOLD_MS);
});

element.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'touch') return;
  const drift = Math.hypot(e.clientX - touchStartX, e.clientY - touchStartY);
  if (drift > TOUCH_DRIFT_THRESHOLD) {
    clearTimeout(touchTimer);
    touchTimer = null;
  }
});

element.addEventListener('pointerup', (e) => {
  if (e.pointerType !== 'touch') return;
  
  const elapsed = Date.now() - touchStartTime;
  clearTimeout(touchTimer);
  
  if (elapsed < 100) {
    // Quick tap — fire action, hide tooltip
    hideTooltip();
    fireAction(e.target);
  } else if (elapsed >= TOUCH_HOLD_MS && touchTimer === null) {
    // User completed the hold — tooltip is already shown
  }
});
```

---

## 3. Spell Rail Interaction Matrix

Comprehensive table of all combinations of (mode × ally_state × input_type × spell_state). Each cell specifies the outcome: tooltip only, cast action, cancel, show modal, or disabled.

| Mode | Ally State | Input | Spell State | Outcome | Notes |
|---|---|---|---|---|---|
| Manual | Active (my turn) | Pointer hover | Ready, not CD | Tooltip shows spell details + predicted damage against hovered enemy (if targeting in progress) | 200ms delay, standard. |
| Manual | Active (my turn) | Pointer hover | On cooldown | Tooltip shows cooldown remaining (e.g. "Ready in 3 turns") | Icon dims, pointer-events still on for inspection. |
| Manual | Active (my turn) | Pointer hover | No mana | Tooltip shows mana cost, indicates deficit (e.g. "Requires 25 MP, have 18") | Icon pulses blue. Pointer-events on for inspection. |
| Manual | Active (my turn) | Pointer hover | Silenced (magic spell) | Tooltip shows spell but greyed out with "Silenced" suffix | Icon has red tint overlay. Pointer-events on. |
| Manual | Active (my turn) | Pointer click | Ready | Spell selection fires: enter targeting mode (for single-target) or show AOE confirm (for all-enemy). | Unless spell type is 'all', then cast immediately. |
| Manual | Active (my turn) | Pointer click | On cooldown OR no mana OR silenced | Icon animates brief red pulse (100ms). No action fires. Tooltip sticky for 2s. | Visual rejection feedback. |
| Manual | Active (my turn) | Touch tap (< 100ms) | Ready | Same as pointer click. | |
| Manual | Active (my turn) | Touch hold (400ms+) | Ready | Tooltip appears for the spell. No action until released or tapped again. | Allows inspection before committing. |
| Manual | Active (my turn) | Touch hold | On cooldown OR no mana | Tooltip shows state. Hold end dismisses tooltip. No action. | |
| Manual | Inactive (awaiting another hero) | Pointer hover | Any | Icon dims to 0.3 opacity. Tooltip suppressed (pointer-events: none on trigger). | User cannot interact. |
| Manual | Inactive (awaiting another hero) | Pointer click | Any | No-op. Ignored (pointer-events: none blocks the click). | |
| Manual | Dead | Pointer hover/click | Any | Card all disabled. No tooltips, no interaction. | Greyed out, 0.15 opacity. |
| Manual | Silenced (status applied during input window) | Pointer hover | Magic type | Tooltip still shows but with "Silenced" label on spell name. Icon red-tinted. | Real-time re-render on status application. |
| Manual | Silenced | Pointer click | Magic type | Brief red pulse. No action. Tooltip sticky. | Can still use physical skills, items, skip. |
| Manual | During targeting | Pointer hover (on enemy) | Single-target spell | Tooltip shows spell name + predicted damage **against this enemy** (not generic formula). Enemy name and armor/resist factored. | Damage prediction is live; updates per hover. |
| Manual | During targeting | Pointer click (on tile or enemy) | Single-target spell | Target selected. Spell resolves. Tooltip hidden. | |
| Manual | AOE confirm step | Pointer click | Confirm button | Cast spell at all enemies. Tooltip hidden. Transition to resolving. | |
| Manual | AOE confirm step | Pointer click | Cancel button | Return to AWAITING-INPUT. Tooltip hidden. Same hero, same turn. | |
| Manual | Resolving (damage animating) | Pointer hover | Any | Tooltip suppressed. Pointer-events: none on all rail icons. | No interaction during resolution. |
| Auto | Any hero | Pointer hover | Any | Tooltip shows (200ms delay). Purely informational — no action possible. | Auto mode is read-only. |
| Auto | Any hero | Pointer click | Any | Ignored. Pointer-events: none on all icons. | |

**Key invariants:**
- **Not my turn (inactive):** pointer-events: none on all icons. Tooltip never shows.
- **On cooldown / no mana:** pointer-events still ON for inspection (user can hover to see why it's disabled). Icon dims to 0.6 opacity.
- **Silenced:** pointer-events ON. Only magic spells blocked; physical attack, items, skip remain enabled.
- **During targeting:** only the selected spell is "active." All other icons become pointer-events: none until targeting ends.
- **Resolving:** all icons pointer-events: none, regardless of character state.

---

## 4. Targeting Flow

When the player selects a single-target spell or basic attack in manual mode, the game enters a targeting sub-state. This section specifies the step-by-step flow and UI contract.

### 4.1 Entry: `ev:targeting-start` event

Fired when a single-target spell or basic attack is clicked/tapped during AWAITING-INPUT.

```js
document.dispatchEvent(new CustomEvent('ev:targeting-start', {
  detail: {
    characterId: character.id,
    skillId: skill.id,  // 'basic_attack' or skill.id
    spell: spellData,   // { name, description, mpCost, damageType, ... }
  },
  bubbles: true,
}));
```

**Result:**
1. Game enters `MANUAL_TARGET_PICK_DESKTOP` / `MANUAL_TARGET_PICK_MOBILE` state.
2. All enemy tiles become tappable / hoverable. `.ev-battlefield` gets class `targeting-active`.
3. SVG tiles change fill color on hover: `--gold-dim` + drop-shadow glow.
4. Spell tooltip repositions: on desktop it shifts to show the **targeted enemy's stats** instead of the spell description. On mobile, tooltip pinned to top of screen.
5. A hint bar appears above the battlefield (or at top on mobile): **"Choose a target — ESC to cancel"** in Cinzel 12px, gold color, 40px tall, centered.
6. Player focus moves to the first valid target tile (keyboard: Tab cycles through enemies).

### 4.2 Hover / Focus on a tile

**Pointer hover (200ms debounce):**
```css
.ev-tile.tile-hovered {
  fill: var(--gold-dim);
  stroke: var(--gold-rim);
  filter: drop-shadow(0 0 6px var(--gold-glow));
}
```

**Keyboard focus (Tab / Arrow keys):**
```css
.ev-tile.tile-focused:focus {
  fill: var(--gold-dim);
  stroke: var(--gold-rim);
  stroke-width: 2px;
  filter: drop-shadow(0 0 10px var(--gold-glow));
}
```

**Tooltip update (live):**
When the hovered/focused tile contains an enemy:
```js
// Compute predicted damage against this enemy
const targetCombatant = enemyAt(tile.col, tile.row);
const predicted = computeDamage(
  caster,
  targetCombatant,
  spell,
  caster.equipment.weapon
);

updateTooltip({
  name: targetCombatant.name,
  hp: `${targetCombatant.hp} / ${targetCombatant.maxHp}`,
  predictedDamage: {
    min: predicted.min,
    max: predicted.max,
  },
  resistances: targetCombatant.resistances,
  vulnerabilities: targetCombatant.vulnerabilities,
});
```

The tooltip's damage line changes from the generic spell description to:
```
Predicted: 35–48 damage (vs Goblin Archer's 12 armor, −25% fire resistance)
```

### 4.3 Click / Tap on a tile

```js
element.addEventListener('click', (e) => {
  if (!document.querySelector('.ev-battlefield.targeting-active')) return;
  
  const tile = e.target.closest('.ev-tile');
  if (!tile) return;
  
  const col = parseInt(tile.dataset.col);
  const row = parseInt(tile.dataset.row);
  const targetCombatant = enemyAt(col, row);
  
  if (!targetCombatant) return;  // empty tile
  
  // Fire the target-select event
  document.dispatchEvent(new CustomEvent('ev:target-select', {
    detail: {
      characterId: caster.id,
      skillId: spell.id,
      targetCombatantId: targetCombatant.id,
      targetTileCol: col,
      targetTileRow: row,
    },
    bubbles: true,
  }));
  
  // Clear targeting state
  deactivateTargeting();
});
```

**Keyboard: Enter / Space to confirm:**
```js
document.addEventListener('keydown', (e) => {
  if (!targetingActive) return;
  if (e.key === 'Enter' || e.key === ' ') {
    const focusedTile = document.querySelector('.ev-tile:focus');
    if (focusedTile) {
      focusedTile.click();  // Trigger the click handler above
    }
  }
});
```

### 4.4 Cancel targeting: ESC / back-arrow

**Desktop:**
```js
document.addEventListener('keydown', (e) => {
  if (!targetingActive) return;
  if (e.key === 'Escape') {
    cancelTargeting();
  }
});

function cancelTargeting() {
  // Return to AWAITING-INPUT
  deactivateTargeting();
  setAwaitingInput(caster);  // _awaitingInput unchanged
  restoreFocusToPreviousSpell();  // Focus back to the spell icon
  hideTooltip();
}
```

**Mobile:**
A **44×44px back-arrow button** appears at the top-left of the battlefield (above the collapsed turn-strip). On tap:
```js
backButton.addEventListener('click', () => {
  cancelTargeting();
});
```

### 4.5 Exit targeting: spell resolves

After `ev:target-select` fires, `CombatScreen._dispatchManualAction` receives it and calls `_executeSkill(caster, spell, targetCombatant)`. During the RESOLVING state, the battlefield returns to normal (no tile hover effects, hint bar disappears). Tooltip is hidden.

---

## 5. Damage Prediction in Tooltip

When targeting a single-target spell, the tooltip displays a real-time damage prediction based on the current hovered/focused enemy's resistances and the caster's current stats. The prediction uses the **same formula** as the actual damage resolution so the player can make informed targeting decisions.

### 5.1 Formula contract

Source: `src/game/formulas.js` → `computeDamage(caster, target, spell, weapon)`.

**Signature:**
```js
/**
 * @param {Object} caster       The attacking combatant
 * @param {Object} target       The defending combatant
 * @param {Object} spell        Skill/spell data from SKILLS dict
 * @param {Object} weapon       The caster's equipped weapon (optional)
 * @returns {{ min: number, max: number, type: string }}
 *   Range accounts for crit chance, RNG variance, target armor/resistances.
 */
function computeDamage(caster, target, spell, weapon) { ... }
```

**Usage in tooltip:**
```js
const predicted = computeDamage(caster, target, selectedSpell, caster.equipment.weapon);

const predictionText = `Predicted: ${predicted.min}–${predicted.max} damage`;
if (target.resistances[spell.damageType] > 0) {
  predictionText += ` (vs ${target.resistances[spell.damageType]}% ${spell.damageType} resist)`;
}
if (target.vulnerabilities[spell.damageType] > 0) {
  predictionText += ` (+${target.vulnerabilities[spell.damageType]}% weakness)`;
}
```

### 5.2 Display format

The prediction line appears in the tooltip only when:
1. In manual mode AND
2. During AWAITING-INPUT (player's active turn) AND
3. Hovering an enemy during targeting (MANUAL_TARGET_PICK state) AND
4. The spell is single-target or the enemy is the only valid target

Format: monospace, Cinzel 11px, in section below the spell description, separated by a 4px gap. Use `--gold-glow` color to match active state. If the range is 0–0 (e.g., target is immune), display: **"Predicted: immune"** with reduced opacity (0.6).

### 5.3 Update frequency

The prediction updates **live on every hover/focus change** to a new tile. Do not throttle or debounce — the player expects immediate feedback when scanning enemies. At 60fps this is negligible cost.

---

## 6. Animation Budget

Every interaction involves CSS animations and frame-scheduled updates. This section specifies the animation timings and total motion budget to keep the experience snappy and avoid jank on mid-range devices.

### 6.1 Per-interaction timings

| Interaction | Animation | Duration | Easing | Notes |
|---|---|---|---|---|
| Tooltip fade-in | `opacity: 0 → 1` | 120ms | ease-out | No slide or scale. Simple fade. Applies to spell, enemy, status, and help tooltips. |
| Tooltip fade-out | `opacity: 1 → 0` | 80ms | ease-in | Faster exit. User expects snappy dismissal. |
| Card state change (inactive → active) | Glow rim ramp + scale pulse | 200ms | ease-in-out | Border color swaps, box-shadow intensifies. Scale stays at 1.0 (no physical move). |
| Spell icon ready-pulse | Opacity + glow | 1.4s | breath cycle | Continuous loop during awaiting-input. Opacity 0.85 ↔ 1.0, shadow 4px ↔ 10px. |
| Tile hover glow | `fill: stone → dim`, `drop-shadow: 0 → 6px` | 150ms | ease-out | Only active during targeting (targeting-active class). |
| Targeting hint bar slide-in | `opacity: 0 → 1`, `transform: translateY(-8px → 0)` | 200ms | ease-out | Appears at start of targeting. |
| Damage number popup | Float-up + fade | 600ms | Custom (cubic-bezier(0.1, 0.8, 0.8, 1)) | Starts at target position, moves up 60px, fades out over 600ms. Stacks vertically for multi-hit. |
| Round-end → round-start transition | Dim overlay + turn-strip chip pulse | 400ms | ease-in-out | Dim the battlefield briefly, pulse the active actor's turn-chip to draw attention. |
| Extra-attack badge fade | `opacity: 1 → 0`, `transform: translateY(0 → -8px)` | 600ms | ease-out | Fades and floats upward. Appears after x2/x3 attacks trigger. |
| Status icon apply | `scale: 0 → 1` + fade-in | 200ms | ease-out | When a new status appears on a character card. |

### 6.2 `prefers-reduced-motion` compliance

For users with motion sensitivity, all animations must be simplified or disabled. CSS media query: `@media (prefers-reduced-motion: reduce)`.

| Animation | Fallback |
|---|---|
| Tooltip fade-in (120ms) | `opacity: 0 → 1 instant` (0ms, use `transition: none`) |
| Spell icon ready-pulse (1.4s loop) | Static gold rim, no pulse. Icon stays at constant `opacity: 1`, `box-shadow: 0 0 8px rgba(200,160,32,0.55)` static. |
| Targeting glow on tile (150ms) | Tile border instantly changes color and thickness on hover. No transition. |
| Floating damage number (600ms) | Damage numbers appear inline in a combat log message at bottom-left of screen instead of floating. `opacity: 1` static, no movement. |
| Card glow rim pulse (1.4s) | Card border turns gold instantly, no animation. Stays gold until state changes. |
| Round-end transition (400ms) | Instant dim + no pulse. Battlefield stays slightly dimmed during the transition. |

**CSS pattern:**
```css
.spell-icon--ready {
  animation: ready-pulse 1.2s ease-in-out infinite alternate;
}

@media (prefers-reduced-motion: reduce) {
  .spell-icon--ready {
    animation: none;
    box-shadow: 0 0 8px 1px rgba(200, 160, 32, 0.55);
  }
}
```

### 6.3 Total motion budget

At 60fps, the maximum recommended on-screen animation duration per round (6–10 seconds of real-time gameplay) is **5 seconds of cumulative motion**.

**Breakdown for a typical manual-mode turn:**
- Awaiting input (ready-pulse loop): 1.4s ← idle loop, always running
- Player clicks spell: tooltip fade-in 120ms
- Player hovers enemy during targeting: tile glow 150ms
- Player clicks tile: damage float 600ms (up to 3 hits if multi-attack)
- Extra attack badge (if triggered): 600ms
- Total: ~1.4s (idle) + 0.12s + 0.15s + 0.6s + 0.6s = **3.0 seconds** ✓ (under 5s budget)

The idle ready-pulse does not count against the budget because it is not a critical interaction — it can be disabled without breaking functionality.

---

## 7. Keyboard Navigation

Full keyboard accessibility for manual mode. All interactive elements must be reachable via Tab, and all actions must have keyboard bindings.

### 7.1 Tab order: AWAITING-INPUT state

When a hero's turn begins and `_awaitingInput` is set, focus automatically moves to the first spell icon in that hero's spell rail (the basic attack button).

```
1. Basic Attack icon
2. Skill 1 icon
3. Skill 2 icon
4. ...
5. Use Item icon
6. [Skip Turn button] (if shown on desktop)
7. [Pause/Settings button in util-buttons]
```

Tab moves forward in order. Shift+Tab moves backward. Arrow Left/Right can cycle within the spell rail (alternative to Tab for faster icon switching).

### 7.2 Spell rail keyboard bindings

| Key | Action | State | Notes |
|---|---|---|---|
| **Tab** | Move focus to next icon in rail | AWAITING-INPUT | Wraps to first icon after last. |
| **Shift+Tab** | Move focus to previous icon in rail | AWAITING-INPUT | Wraps to last icon before first. |
| **Left Arrow** | Move focus to previous icon in rail | AWAITING-INPUT | Same as Shift+Tab. Useful for left-hand navigation. |
| **Right Arrow** | Move focus to next icon in rail | AWAITING-INPUT | Same as Tab. |
| **Enter** / **Space** | Execute focused spell | AWAITING-INPUT | If spell is valid (not CD, not silenced), fire action. If requires targeting, enter MANUAL_TARGET_PICK. If AOE, show confirm. |
| **1–9** | Quick-select spell slot (if bind available) | AWAITING-INPUT | `1` = basic attack, `2` = first skill, etc. (Optional accelerator, must not conflict with global game binds.) |
| **I** / **P** | Use Item (potion belt) | AWAITING-INPUT | Opens MANUAL_ITEM_OPEN sub-state. |
| **S** | Skip Turn | AWAITING-INPUT | Ends turn immediately. Same as clicking Skip button. |
| **Q** | Toggle pause (ESC alternative) | Any state | Opens COMBAT_PAUSED overlay. |
| **M** | Toggle mode (Auto / Manual) | Any state (non-Hardcore) | Opens Settings. Current mode is pre-selected. |

### 7.3 Targeting keyboard navigation

When in MANUAL_TARGET_PICK (targeting an enemy), focus moves to the tile grid.

| Key | Action | State | Notes |
|---|---|---|---|
| **Arrow Up** | Focus next row back (lower row index) | MANUAL_TARGET_PICK | Wraps to furthest row if at row 0. |
| **Arrow Down** | Focus next row forward (higher row index) | MANUAL_TARGET_PICK | Wraps to row 0 if at max. |
| **Arrow Left** | Focus previous column | MANUAL_TARGET_PICK | Wraps to right edge. |
| **Arrow Right** | Focus next column | MANUAL_TARGET_PICK | Wraps to left edge. |
| **Tab** | Cycle forward to next valid enemy tile | MANUAL_TARGET_PICK | Skips empty tiles. Useful for jumping between enemy clusters. |
| **Shift+Tab** | Cycle backward to previous valid enemy tile | MANUAL_TARGET_PICK | Same as above, reverse order. |
| **Enter** / **Space** | Select focused tile / fire spell | MANUAL_TARGET_PICK | Triggers `ev:target-select`. |
| **Escape** | Cancel targeting, return to AWAITING-INPUT | MANUAL_TARGET_PICK | Does not consume turn. Same character's turn resumes. |

### 7.4 Mobile on-screen keyboard accelerators

Mobile devices have no physical keyboard, but some users connect Bluetooth keyboards. For those without, on-screen touch buttons should replicate critical functions:

- **Skip Turn button** (always visible on mobile during AWAITING-INPUT, right side of the spell rail area)
- **[ESC / Back] button** (44×44px top-left, visible during targeting)
- **Pause button** (in util-buttons, always visible when not terminal)

Pressing physical Escape or Android back-gesture maps to the on-screen back button handler.

---

## 8. ARIA + Screen Reader Implementation

Every interactive element has a role, label, and live-region contract so screen-reader users can navigate combat without sighted assistance.

### 8.1 Spell rail buttons

```html
<button class="spell-icon spell-icon--ready"
        data-skill="{skillId}"
        data-slot="{slotIndex}"
        aria-label="Fireball — AOE spell — 25 MP — 8 second cooldown"
        title="Fireball">
  <svg><!-- icon --></svg>
</button>
```

**ARIA label pattern:** `{spell name} — {type label} — {MP cost} MP — {cooldown} second cooldown`

Types: "melee attack", "single-target spell", "AOE spell", "heal", "buff", "debuff", "item".

When spell is on cooldown: `aria-label="Fireball — AOE spell — Ready in 3 turns"` (cooldown count instead of time).

When silenced (magic spell): `aria-label="Fireball — silenced, cannot be used"` (appended suffix).

When not player's turn: `aria-label="Fireball — not your turn"` (passive state).

### 8.2 Spell tooltip

```html
<aside class="ev-tooltip-card"
       id="ev-tooltip-card"
       aria-live="polite"
       aria-atomic="true"
       role="region"
       aria-label="Spell details">
  <!-- Content: name, cost, description, damage, statuses -->
</aside>
```

**`aria-live="polite"`** ensures changes to the tooltip content (especially damage prediction during targeting) are announced to screen readers. The entire tooltip is marked `aria-atomic="true"` so the full content is read when updated, not just the changed portion.

**Announcement strategy:** When the player hovers a new enemy during targeting, the tooltip updates with predicted damage. The screen reader announces: **"Fireball, AOE spell, 25 mana, Predicted 45 to 62 damage versus Goblin Archer's 12 armor."**

### 8.3 Tile grid (targeting mode)

Each SVG `<polygon class="ev-tile">` is a semantic button when targeting is active:

```html
<polygon class="ev-tile"
         data-col="3"
         data-row="2"
         role="button"
         tabindex="0"
         aria-label="Goblin Warrior at tile column 3 row 2 — 28 of 45 HP">
</polygon>
```

The tile announces:
- **Enemy name** if occupied
- **Coordinates** for spatial reference (helpful for grid-based navigation)
- **HP** in the format "current / max" so player knows if target is nearly dead

When focused (keyboard navigation), the tile's `aria-label` is updated in real-time if an enemy is hovered:
```js
polygon.setAttribute('aria-label', 
  `Goblin Archer at tile (${col}, ${row}) — 32 of 45 HP`);
```

### 8.4 Status icons

Each status icon on an ally HUD card is an `<abbr>` tag with a full-text tooltip:

```html
<span class="ev-status-icon ev-status-icon--burning"
      title="Burning: 30% per turn for 2 turns"
      aria-label="Burning status, 30% damage per turn, 2 turns remaining">
  🔥
</span>
```

The `title` attribute provides hover text; the `aria-label` is the screen reader announcement. No emoji is used — the glyph is purely visual.

### 8.5 Card state and role

Each HUD card is a named region:

```html
<article class="ev-char-card"
         id="ev-card-{characterId}"
         data-state="active"
         role="region"
         aria-label="Fighter — 45 of 60 HP, 15 of 20 mana, awaiting action">
  ...
</article>
```

The `aria-label` updates when state changes:
- **inactive:** "Fighter — 45 of 60 HP — passive"
- **active:** "Fighter — 45 of 60 HP — awaiting your action"
- **dead:** "Fighter — defeated"
- **stunned:** "Fighter — stunned, unable to act"

### 8.6 Turn-order strip

The strip is a `<nav role="region">` with a live-region child for announcing the current actor:

```html
<nav class="ev-turn-strip" aria-label="Turn order">
  <span class="ev-round-label" id="ev-round-label">Round 1</span>
  <div class="ev-turn-strip__chips" role="list">
    <div class="ev-turn-chip" role="listitem"
         aria-current="turn" aria-label="Fighter — your turn">
    </div>
    <div class="ev-turn-chip" role="listitem"
         aria-label="Stormcaller — next">
    </div>
    ...
  </div>
</nav>
```

When the turn changes, the chip with `aria-current="turn"` moves. A live region announces: **"Round 2. Fighter's turn."**

---

## 9. Focus Management

Focus is the key to making manual combat keyboard-accessible. The browser must always know where the player's attention is.

### 9.1 Focus entry points

**When AWAITING-INPUT is set:**
- Focus moves from current location (e.g., game UI, previous turn's button) to the first spell icon of the active hero's rail.
- If the spell rail is off-screen on mobile (due to horizontal scroll), the card row scrolls to bring the active hero's card into view, then focus is set.
- If the player had previously focused a spell icon in a prior turn, memory of that slot is not retained — focus always lands on slot 0 (basic attack) for clarity.

**Code:**
```js
function setAwaitingInput(actor) {
  this._awaitingInput = actor;
  
  // Find the card for this actor
  const card = document.querySelector(`[data-char-id="${actor.id}"]`);
  
  // Scroll card into view if needed
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  
  // Focus the first spell icon in the rail
  const rail = card.querySelector('.ev-card__spell-rail');
  const firstIcon = rail.querySelector('.spell-icon');
  firstIcon.focus();
}
```

### 9.2 Focus during targeting

When targeting begins (MANUAL_TARGET_PICK), focus moves to the tile grid.

```js
function activateTargeting(spell) {
  document.querySelector('.ev-battlefield').classList.add('targeting-active');
  
  // Focus the first valid enemy tile
  const firstEnemyTile = document.querySelector('.ev-tile[data-enemy-id]');
  if (firstEnemyTile) {
    firstEnemyTile.focus();
  }
}
```

Keyboard navigation (arrows, Tab) cycles through enemy tiles. The focused tile has a visual ring (phase 04 `tile-focused` CSS) and an announced label.

### 9.3 Focus return after canceling targeting

When the player presses Escape to cancel targeting (MANUAL_TARGET_PICK → AWAITING-INPUT), focus returns to the spell icon that initiated targeting.

```js
function cancelTargeting(spell) {
  deactivateTargeting();
  
  // Find the spell icon that was focused before targeting
  const rail = document.querySelector('.ev-card__spell-rail');
  const spellIcon = rail.querySelector(`[data-skill="${spell.id}"]`);
  if (spellIcon) {
    spellIcon.focus();
  }
}
```

This allows the player to immediately retry the same spell or switch to a different action without visual disorientation.

### 9.4 Focus trap during targeting

While targeting is active, Tab and Shift+Tab **must not** leave the tile grid and focus the HUD card rail or other page elements. Use a focus trap:

```js
const tiles = document.querySelectorAll('.ev-tile[data-enemy-id]');
const lastTile = tiles[tiles.length - 1];
const firstTile = tiles[0];

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  if (!document.querySelector('.ev-battlefield.targeting-active')) return;
  
  if (e.shiftKey && document.activeElement === firstTile) {
    e.preventDefault();
    lastTile.focus();
  } else if (!e.shiftKey && document.activeElement === lastTile) {
    e.preventDefault();
    firstTile.focus();
  }
});
```

### 9.5 ESC to parent focus

When the player presses ESC or the back button to exit targeting, focus returns to the spell rail of the active hero. This creates a natural navigation hierarchy:
- ESC from targeting → spell rail
- ESC from AWAITING-INPUT (not targeting) → pause menu (game-level escape)

---

## 10. Touch-Target Audit

Every interactive element must meet a **44×44px minimum** touch target size for mobile accessibility.

| Element | Current size | Meets minimum? | Mobile fix if needed |
|---|---|---|---|
| Spell icon button | 32×32px | ❌ No | Increase padding to 44×44px on mobile (`@media (max-width: 600px)`) |
| Use Item icon | 32×32px | ❌ No | Same: 44×44px padding on mobile |
| Skip Turn button | 32×32px | ❌ No | Same: 44×44px padding on mobile |
| Enemy tile center | ~70px (depends on zoom) | ✓ Yes (varies) | Ensure tiles remain ≥44px at closest zoom level. Phase 04 grid math should satisfy this. |
| Turn-strip portrait chip | 40×40px | ⚠️ Marginal | Acceptable; add 4px padding for 48×48px touch zone. On mobile, expand chip to 44×44px minimum. |
| Pause button (util) | 36×36px | ⚠️ Marginal | Expand to 44×44px on mobile. |
| Settings button (util) | 36×36px | ⚠️ Marginal | Expand to 44×44px on mobile. |
| Back button (targeting, mobile) | 44×44px | ✓ Yes | Already sized correctly. No change. |
| Confirm button (AOE step) | Variable (full-width bar, 48px tall) | ✓ Yes | Full-width touch target. 48px height exceeds minimum. |
| Cancel button (AOE step) | Variable (full-width bar, 48px tall) | ✓ Yes | Same as above. |
| Mode toggle pill segments | ~100×32px | ✓ Yes | Each segment is 100px wide. Acceptable. |
| Hardcore lock tooltip | On hover (text) | ✓ Yes | Tooltip triggers on the toggle; not a separate touch target. |
| Status icon tooltip trigger | 14×14px glyph | ⚠️ Marginal | Glyph is small, but it's wrapped in a larger 24px × 24px touch zone (the padding around the glyph in the status row). Acceptable. |

**Recommendations for Phase 10 (mobile):**

1. **Spell rail on mobile:** Add horizontal padding to spell icons so that each button's touch zone is 44×44px. This may require increasing icon button size to 40×40px on mobile (from 32×32px on desktop), or adding padding via a wrapping `<div>`.

2. **Turn-strip chips:** On mobile, expand chip size from 40×40px to 44×44px to match minimum.

3. **Util buttons (Settings, Layout, Share):** Expand from 36×36px to 44×44px on mobile. The util-button row may need to compress or scroll on extremely narrow screens, but each button must be independently tappable.

4. **Back button (targeting):** Already 44×44px. Confirm it's positioned in the safe area (not hidden under notch or system UI on iOS).

---

## 11. Reduced-Motion Fallback

Users with vestibular disorders or motion sensitivity have set `prefers-reduced-motion: reduce` in their OS settings. All animations must gracefully degrade to static states or instant transitions.

**CSS media query:**
```css
@media (prefers-reduced-motion: reduce) {
  /* All animations disabled or simplified */
}
```

**Per-element fallbacks:**

| Animation | Fallback | Why |
|---|---|---|
| Tooltip fade-in (120ms) | Instant appear (no transition) | Prevents motion from tooltip pop-in. User can still see content immediately. |
| Spell icon ready-pulse (1.4s loop) | Static gold glow (no animation) | Icon stays visually distinct but doesn't move or blink. |
| Card rim glow pulse (1.4s loop) | Static gold border, no glow variation | Card is highlighted without continuous animation. |
| Tile hover glow (150ms) | Instant color change on hover, no transition | Tile still shows interactivity but without easing. |
| Damage number float (600ms) | Inline log message, no movement | Damage appears as text in a fixed log area instead of floating. Text is stable. |
| Extra-attack badge fade (600ms) | Static badge text, no animation | Badge appears and stays visible for 2s, then disappears instantly. |
| Status icon appear (200ms scale) | Instant appear | Status icon appears at full size immediately, no scale-up animation. |
| Round transition dim (400ms) | Instant dim, stays dimmed for 1s | Battlefield dims immediately, then returns to normal after 1s. No fade. |

**Example code:**
```css
/* Default: with motion */
.spell-icon--ready {
  animation: ready-pulse 1.2s ease-in-out infinite alternate;
}

/* Reduced motion: static state */
@media (prefers-reduced-motion: reduce) {
  .spell-icon--ready {
    animation: none;
    box-shadow: 0 0 8px 1px rgba(200, 160, 32, 0.55);  /* Static glow */
  }
}

/* Default: damage float */
.ev-damage-number {
  animation: float-damage 600ms cubic-bezier(0.1, 0.8, 0.8, 1) forwards;
}

/* Reduced motion: inline log instead */
@media (prefers-reduced-motion: reduce) {
  .ev-damage-number {
    animation: none;
    opacity: 1;
    transform: none;  /* No floating */
  }
}
```

---

## 12. Failure Modes + Graceful Degradation

Tooltips and interactive elements depend on async data loading and CSS parsing. Failures must never block player actions.

### 12.1 Spell data missing

**Scenario:** `SKILLS` dictionary fails to load or a spell ID references a non-existent skill.

**Fallback:**
- Spell icon still renders (the SVG glyph is inline, not async).
- Tooltip does not appear on hover (no data to show).
- On click, the spell fires normally (action dispatch uses the spell ID, not the tooltip data).
- No error is logged to the player; the skill simply has no visible description.

**Code:**
```js
function getSpellData(skillId) {
  const spell = SKILLS[skillId] || null;
  if (!spell) {
    console.warn(`Skill ${skillId} not found in SKILLS dict`);
    return null;
  }
  return spell;
}

element.addEventListener('click', (e) => {
  const skillId = e.target.dataset.skill;
  const spell = getSpellData(skillId);
  // spell may be null, but action still fires
  dispatchManualAction(actor, skillId);  // uses skillId, not spell.name
});
```

### 12.2 Damage prediction formula error

**Scenario:** `computeDamage(caster, target, spell)` throws an exception or returns invalid data.

**Fallback:**
- Tooltip shows spell description normally.
- Damage prediction line is omitted or shows a generic "Calculating..." message.
- Player can still select and cast the spell.

**Code:**
```js
function updateTooltipDamage(caster, target, spell) {
  try {
    const predicted = computeDamage(caster, target, spell, caster.equipment.weapon);
    if (!predicted || predicted.min < 0 || predicted.max < predicted.min) {
      throw new Error('Invalid damage prediction');
    }
    tooltipDamageElement.textContent = 
      `Predicted: ${predicted.min}–${predicted.max} damage`;
  } catch (e) {
    console.warn('Damage prediction failed:', e);
    tooltipDamageElement.textContent = '(calculating...)';
  }
}
```

### 12.3 CSS not loaded (SVG corners fail to render)

**Scenario:** `phase07-svg-borders.css` fails to load or the SVG symbol definitions are missing.

**Fallback:**
- Cards render without decorative corner lozenges.
- Cards still have a 1.5px gold border via `border: 1.5px solid var(--gold-rim)`.
- No visual regression to core functionality.

**Code:**
The SVG corners are optional decorative elements. If they fail to load, the CSS border alone is sufficient:

```css
.ev-panel {
  border: 1.5px solid var(--gold-rim);
  /* If .ev-corner SVG fails to render, the border is still visible */
}
```

### 12.4 Tooltip container overflow

**Scenario:** On a very small screen, the tooltip is larger than the available space and would overflow the viewport.

**Fallback:**
- Tooltip renders at a smaller font size (e.g., 10px instead of 12px on body text).
- Tooltip width is capped at `90vw - 16px` (leaving 8px margin on left and right).
- If tooltip is still too tall, the content scrolls vertically within the tooltip container.

**Code:**
```css
.ev-tooltip-card {
  max-width: calc(90vw - 16px);
  max-height: 80vh;
  overflow-y: auto;
  font-size: clamp(10px, 2vw, 13px);  /* Responsive font scaling */
}
```

---

## Handoff to Phase 10 (Mobile)

Phase 10 (mobile fit) must respect and build upon these interaction contracts:

1. **Touch-target sizing:** All spell icons, utility buttons, and touch-interactive regions must be ≥44×44px on mobile (393×852px viewport).

2. **Tooltip placement:** On mobile portrait, the spell tooltip renders as a **partial bottom-sheet** (slides up from bottom, ~160px tall initially, scrollable if content overflows). It does NOT occlude the spell rail or card buttons.

3. **Collapsed turn-strip:** The turn-order strip must be hideable on mobile to save vertical space. When hidden, a **44px header bar** shows "Round N" on the left and the active actor's chip on the right. A chevron/expand button toggles the full strip visibility.

4. **Enemy tooltip positioning:** On mobile, enemy tooltips should still appear above the sprite (12px offset), but if space is constrained at the top of the battlefield, they shift to below the sprite.

5. **Targeting UI on mobile:** The back-arrow cancel button must be **44×44px** and positioned clearly (top-left of the battlefield, above the collapsed turn-strip header).

6. **Focus management on mobile:** When a card is off-screen on mobile due to horizontal scrolling, and that card's turn arrives, the card must scroll into view before focus is set to the spell rail.

7. **Keyboard on mobile:** Bluetooth keyboard support is important. The same Tab/Arrow key navigation must work on a physical keyboard as on desktop, with an alternative: on-screen buttons for Skip and Cancel if no keyboard is present.

---

# Summary — Key Animation Tokens

For easy reference during Phase 10 and Phase 11 implementation:

```css
/* Tooltip fade-in (all types) */
--tooltip-fade-in-duration: 120ms;
--tooltip-fade-in-easing: ease-out;

/* Tooltip fade-out */
--tooltip-fade-out-duration: 80ms;
--tooltip-fade-out-easing: ease-in;

/* Card glow rim pulse (active state) */
--card-rim-pulse-duration: 1.4s;
--card-rim-pulse-easing: ease-in-out;

/* Spell icon ready pulse (manual mode) */
--icon-ready-pulse-duration: 1.2s;
--icon-ready-pulse-easing: ease-in-out;

/* Tile hover glow during targeting */
--tile-hover-glow-duration: 150ms;
--tile-hover-glow-easing: ease-out;

/* Damage number float */
--damage-float-duration: 600ms;
--damage-float-easing: cubic-bezier(0.1, 0.8, 0.8, 1);
--damage-float-distance: 60px;

/* Extra attack badge fade */
--badge-fade-duration: 600ms;
--badge-fade-easing: ease-out;

/* Hover delays (input type specific) */
--hover-delay-pointer: 200ms;
--hover-delay-touch: 400ms;

/* Touch interaction thresholds */
--touch-drift-threshold: 12px;
--touch-tap-duration-max: 100ms;
```

