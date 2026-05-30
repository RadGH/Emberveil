# Phase 06 — Bottom-HUD Character Cards + Spell Rail Spec

**Author:** frontend-developer agent
**Date:** 2026-04-29
**Depends on:** Phase 00 (palette tokens), Phase 01 (`.hm` replacement target), Phase 02 (state machine, `_awaitingInput`, `_dispatchManualAction`), Phase 04 (grid position data, `ev:target-select`, `activateTargeting`/`deactivateTargeting`), Phase 07 (`.ev-panel` border system), Phase 08 (spell icon SVGs + state classes)

---

## 1. DOM Tree — Bottom HUD Region

The entire bottom HUD is a single `<section id="ev-hud">` anchored to the viewport bottom. It replaces `#cbt-hud` and its `.hud-members` / `.hud-right` children entirely. The canvas scene and all overlay panels live above it in the stacking order.

```
<section id="ev-hud" aria-label="Combat HUD">
  │
  ├─ <div class="ev-hud__card-row" id="ev-card-row" role="list">
  │    │  ← Scrollable horizontal strip of hero cards. One child per hero.
  │    │    Desktop: all visible simultaneously (overflow-x auto, snap).
  │    │    Mobile (<700px): only selected hero's card is fully expanded.
  │    │
  │    ├─ <article class="ev-panel ev-panel--card ev-char-card" 
  │    │            id="ev-card-{characterId}"
  │    │            data-char-id="{characterId}"
  │    │            data-state="inactive"      ← see §4 for state values
  │    │            role="listitem"
  │    │            aria-label="{character.name}">
  │    │    │
  │    │    ├─ <!-- ev-panel SVG corners (phase 07 lozenge variant) -->
  │    │    ├─ <svg class="ev-corner ev-corner--tl" aria-hidden="true" ...>
  │    │    ├─ <svg class="ev-corner ev-corner--tr" aria-hidden="true" ...>
  │    │    ├─ <svg class="ev-corner ev-corner--bl" aria-hidden="true" ...>
  │    │    ├─ <svg class="ev-corner ev-corner--br" aria-hidden="true" ...>
  │    │    │
  │    │    └─ <div class="ev-panel__body">
  │    │         │
  │    │         ├─ <header class="ev-card__header">
  │    │         │    ├─ <div class="ev-card__portrait-frame ev-panel ev-panel--char-portrait-frame">
  │    │         │    │    ├─ <!-- four lozenge corners at portrait frame scale -->
  │    │         │    │    └─ <img class="ev-card__portrait-img"
  │    │         │    │             src="{character.portraitUrl}"
  │    │         │    │             alt="{character.name} portrait"
  │    │         │    │             width="48" height="48">
  │    │         │    │         ← Separate <img> from battlefield sprite. Same source
  │    │         │    │           URL, rendered at 48×48 (desktop) / 40×40 (mobile).
  │    │         │    │           Dead state: filter: grayscale(1) opacity(0.4)
  │    │         │    └─ </div>
  │    │         │    │
  │    │         │    ├─ <div class="ev-card__identity">
  │    │         │    │    ├─ <span class="ev-card__name">{character.name}</span>
  │    │         │    │    ├─ <span class="ev-card__class-label">{character.className}</span>
  │    │         │    │    └─ <svg class="ev-card__class-icon" aria-hidden="true"
  │    │         │    │             width="14" height="14">
  │    │         │    │             <!-- class glyph from existing svgIcon system -->
  │    │         │    │        </svg>
  │    │         │    └─ </div>
  │    │         │
  │    │         └─ </header>
  │    │         │
  │    │         ├─ <div class="ev-card__bars" aria-label="Health and mana">
  │    │         │    ├─ <div class="ev-bar-group ev-bar-group--hp">
  │    │         │    │    ├─ <div class="ev-bar-track" role="progressbar"
  │    │         │    │    │        aria-valuenow="{character.hp}"
  │    │         │    │    │        aria-valuemax="{character.maxHp}"
  │    │         │    │    │        aria-label="HP">
  │    │         │    │    │    ├─ <div class="ev-bar ev-bar--hp"
  │    │         │    │    │    │        style="width:{hpPct}%">
  │    │         │    │    │    └─ <div class="ev-bar ev-bar--shield"
  │    │         │    │    │             style="width:{shieldPct}%">   ← barrier/block
  │    │         │    │    └─ </div>
  │    │         │    │    └─ <span class="ev-bar-label ev-bar-label--hp"
  │    │         │    │              aria-hidden="true">
  │    │         │    │         {character.hp}/{character.maxHp}
  │    │         │    │        </span>
  │    │         │    └─ </div>
  │    │         │    │
  │    │         │    └─ <div class="ev-bar-group ev-bar-group--mp">
  │    │         │         ├─ <div class="ev-bar-track ev-bar-track--mp"
  │    │         │         │        role="progressbar"
  │    │         │         │        aria-valuenow="{character.mp}"
  │    │         │         │        aria-valuemax="{character.maxMp}"
  │    │         │         │        aria-label="MP">
  │    │         │         │    └─ <div class="ev-bar ev-bar--mp"
  │    │         │         │             style="width:{mpPct}%">
  │    │         │         └─ </div>
  │    │         │         └─ <span class="ev-bar-label ev-bar-label--mp"
  │    │         │                    aria-hidden="true">
  │    │         │              {character.mp}/{character.maxMp}
  │    │         │             </span>
  │    │         │    └─ </div>
  │    │         │
  │    │         ├─ <div class="ev-card__statuses" aria-label="Status effects">
  │    │         │    <!-- Migrated from _renderStatusRow(); same STATUS_META glyph system -->
  │    │         │    <!-- <span class="ev-status-icon ev-status-icon--{key}"
  │    │         │              title="{name} ({duration})" data-duration="{n}">
  │    │         │           {glyph}
  │    │         │         </span> (one per active status) -->
  │    │         └─ </div>
  │    │         │
  │    │         └─ <div class="ev-card__spell-rail"
  │    │                   id="ev-rail-{characterId}"
  │    │                   role="toolbar"
  │    │                   aria-label="{character.name} actions">
  │    │              <!-- Spell rail — see §3 for slot schema -->
  │    │              <!-- Slot 0: Basic Attack -->
  │    │              <!-- Slots 1–N: Skills -->
  │    │              <!-- Slot N+1: Use Item (free action) -->
  │    │         </div>
  │    │
  │    └─ </article>   ← repeat ev-char-card for each hero
  │
  ├─ <div class="ev-companion-row" id="ev-companion-row" role="list"
  │         aria-label="Companions">
  │    <!-- Companion cards — smaller, no spell rail. See §8. -->
  └─ </div>
  │
  └─ <aside class="ev-tooltip-card ev-panel ev-panel--tooltip"
              id="ev-tooltip-card"
              aria-live="polite"
              aria-atomic="true"
              hidden>
       <!-- Populated on hover/tap of a spell icon. See §9 handoff. -->
       <!-- flourish corners per phase 07 variant matrix -->
     </aside>

</section>

<!-- Turn-order strip lives ABOVE the battlefield, below nothing -->
<nav class="ev-turn-strip" id="ev-turn-strip"
     aria-label="Turn order">
  <span class="ev-round-label" id="ev-round-label">Round 1</span>
  <div class="ev-turn-strip__chips" role="list">
    <!-- ev-turn-chip × N — see §9 -->
  </div>
</nav>
```

**Key wiring notes:**

- `id="ev-hud"` replaces `id="cbt-hud"`. The surrounding `.combat-screen` wrapper is unchanged.
- `#ev-turn-strip` is a sibling of `.ev-battlefield`, not inside `#ev-hud`, because it anchors to the top of the screen (phase 00 §3 zone layout). It is injected into `manager.uiOverlay` at the same level as `.ev-battlefield`.
- The `<aside id="ev-tooltip-card">` is inside `#ev-hud` but positioned absolutely to the right of the card row on desktop and as a bottom-sheet on mobile (phase 10 handles that breakpoint logic).
- SVG symbol defs block (`<svg width="0" height="0">...`) is injected into `<body>` once on combat load, before `#ev-hud` is mounted.

---

## 2. Per-Card Schema

The rendering function signature:

```js
/**
 * Render one hero HUD card to an HTML string.
 * @param {object} character  A combatant object from CombatScreen._allies
 * @param {object} options
 * @param {boolean} options.isActive      true when _awaitingInput.id === character.id
 * @param {boolean} options.isSelected    true on mobile when this is the displayed card
 * @returns {string} HTML string for one ev-char-card article
 */
function renderCharCard(character, options = {}) { ... }
```

| Visible element | Data binding | DOM selector |
|---|---|---|
| Portrait image | `character.portraitUrl` (same URL as battlefield sprite) | `.ev-card__portrait-img` |
| Character name | `character.name` | `.ev-card__name` |
| Class label | `character.className` | `.ev-card__class-label` |
| Class glyph SVG | `character.classSvgIcon` (existing `svgIcon` field) | `.ev-card__class-icon svg` |
| HP bar fill width | `(character.hp / character.maxHp) * 100` → `style.width` | `.ev-bar--hp` |
| HP barrier/shield fill | `(character.barrierHp / character.maxHp) * 100` → `style.width` | `.ev-bar--shield` |
| HP label text | `character.hp + '/' + character.maxHp` | `.ev-bar-label--hp` |
| MP bar fill width | `(character.mp / character.maxMp) * 100` → `style.width` | `.ev-bar--mp` |
| MP label text | `character.mp + '/' + character.maxMp` | `.ev-bar-label--mp` |
| Status icons | `character.statusEffects[]` via `STATUS_META` | `.ev-status-icon` (one per status) |
| Card state attribute | See §4 state table | `[data-state]` on `.ev-char-card` |
| Spell rail | `character.skills[]` + weapon slot | `#ev-rail-{characterId}` |
| Stun glyph overlay | `character.statusEffects.includes('stun')` | `.ev-card__stun-overlay` |

**Portrait source:** The portrait `<img>` in the card header uses `character.portraitUrl` — the same URL as the battlefield sprite. On the battlefield, the sprite renders at `~96px wide × 144px tall` (phase 04 §6). In the card portrait it renders at `48×48` CSS px, cropped via `object-fit: cover; object-position: top center` so the face/shoulders fill the frame. No separate portrait crop image is required.

```js
// Example src resolution (same as today's sprite loader):
const portraitUrl = character.spriteUrl   // e.g. public/images/sprites/fighter_idle.png
                 ?? character.portraitUrl  // fallback if separate portrait exists
                 ?? 'public/images/sprites/fallback_portrait.svg';
```

**HP low-HP transition:** When `character.hp / character.maxHp < 0.3`, add class `ev-bar--hp-low` to `.ev-bar--hp`. This swaps fill from `--hp-green` to `--hp-low` (red) via a CSS transition:

```css
.ev-bar--hp { background: var(--hp-green); transition: width 300ms ease, background 400ms ease; }
.ev-bar--hp.ev-bar--hp-low { background: var(--hp-low); }
```

---

## 3. Spell Rail Schema

Each character's spell rail is rendered inside `#ev-rail-{characterId}`. The rail is a flat `<div role="toolbar">` containing `<button>` elements — one per slot. Slots render left to right in this fixed order:

| Slot index | ID | Contents | Data source |
|---|---|---|---|
| 0 | `basic_attack` | Basic Attack icon (weapon-type-dependent) | `character.equipment.weapon.damageType` ?? `'physical'` |
| 1 to N | `skill_{skillId}` | Per-character chosen skills, in the order of `character.skills[]` | `character.skills[]` matched against `SKILLS` dict |
| N+1 | `use_item` | Use Item shortcut (free action, potion belt) | `gameState.potionBelt` item count |
| (optional) | `skip_turn` | End Turn / Skip button | Always present as fallback |

**Slot 0 — Basic Attack:**

```js
const damageType = character.equipment?.weapon?.damageType ?? 'physical';
// Maps to one of 7 weapon SVGs from phase 08 §5:
// 'physical' | 'magic' | 'fire' | 'ice' | 'lightning' | 'holy' | 'shadow'
const attackSvg = BASIC_ATTACK_SVGS[damageType];
```

```html
<button class="spell-icon spell-icon--{state}"
        data-skill="basic_attack"
        data-slot="0"
        aria-label="Basic Attack ({weaponName})"
        title="{weaponName}">
  {attackSvg}
</button>
```

**Slots 1–N — Skills:**

`character.skills` is the array of player-chosen skill IDs stored in `gameState.party[i].skills`. Cross-referenced against `SKILLS` dict for `name`, `mpCost`, `cooldown`, `type`, `aoe`, `remainingCooldown`.

```html
<button class="spell-icon spell-icon--{state}"
        data-skill="{skill.id}"
        data-slot="{index}"
        data-cd="{skill.remainingCooldown > 0 ? skill.remainingCooldown : ''}"
        style="{cooldownStyle}"
        aria-label="{skill.name} — {mpCost} MP{cooldownText}"
        title="{skill.name}">
  {compositeIconSvg}   <!-- central glyph + peripheral AOE pattern per phase 08 §2–3 -->
</button>
```

**Slot count per class:** Variable, up to 6 active skills. No fixed slot count — the rail renders exactly `character.skills.length` skill buttons plus slot 0 (attack) and slot N+1 (item). Maximum expected: 8 buttons total. On desktop at 32px each with 4px gap, that is `8×32 + 7×4 = 284px` — fits within any card wider than 290px. On mobile (24px icons), `8×24 + 7×4 = 220px` — fits the compressed card layout. No scroll or wrap needed within the rail.

**Slot N+1 — Use Item:**

```html
<button class="spell-icon spell-icon--{itemState} ev-spell-icon--item"
        data-skill="use_item"
        data-slot="item"
        aria-label="Use Item ({itemCount} remaining)"
        title="Use Item (free action)">
  <!-- Flask/potion SVG per phase 00 §8 item 13 -->
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M13 6h6M12 10l-4 8c-1 2-1 4 0 6a6 6 0 0 0 10 2c2-2 2-5 0-8l-4-8"/>
    <path d="M11 18c2-1 5 1 7-1"/>
  </svg>
  <span class="ev-item-count" aria-hidden="true">{itemCount}</span>
</button>
```

`itemState` is `not-my-turn` when `_awaitingInput?.id !== character.id`. It is `disabled` when `itemCount === 0`. It is `enabled` (not `ready`) because item use is a free action — it does not consume the turn, so the icon does not show the amber pulse.

**Skip Turn button** (always rightmost, desktop only — mobile gets a dedicated "End Turn" affordance per phase 10):

```html
<button class="ev-skip-btn"
        data-skill="skip_turn"
        aria-label="End Turn">
  <!-- Hourglass SVG placeholder -->
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M10 6h12M10 26h12M12 8v5l4 3-4 3v5M20 8v5l-4 3 4 3v5"/>
  </svg>
</button>
```

---

## 4. Card States

The card's visual state is driven by a single `data-state` attribute on `.ev-char-card`. The rendering update function reads from `_awaitingInput`, `character.hp`, and `character.statusEffects` to decide the state. Only one state is active at a time.

| State value | Trigger condition | Visual treatment |
|---|---|---|
| `dead` | `character.hp <= 0` | Portrait: `filter: grayscale(1) opacity(0.4)`. Card: `opacity: 0.45`. Border stroke: `--gold-dim`. All spell icons: `pointer-events: none; opacity: 0.15`. `.ev-card__stun-overlay` hidden. |
| `inactive` | `_awaitingInput === null` or `_awaitingInput.id !== character.id`, and `character.hp > 0` | Default card style. All spell icon buttons: `.spell-icon--not-my-turn` (opacity 0.3, grayscale, no pointer-events). |
| `active` | `_awaitingInput?.id === character.id` | Border: `--border-stroke: var(--gold-glow)`. Inset glow: amber tint (phase 07 active state). Eligible spell icons: `.spell-icon--ready` (amber pulse). Card gets `ev-char-card--active` class for the CSS rim animation. |
| `resolving` | Action dispatched; `_awaitingInput` is null but this card's actor is mid-RESOLVING | Border: same gold as active but static (no pulse). All icons: `.spell-icon--disabled` (fade, no pointer-events). Extra-attack badge visible if drain is running. |
| `silenced` | `character.statusEffects.includes('silence')` AND card is active | All `type === 'magic'` spell icons get `.spell-icon--silenced` overlay (red tint via CSS `mix-blend-mode: multiply` on a pseudo-element). Basic attack and item slot remain hot. |
| `stunned` | `character.statusEffects.includes('stun')` | `.ev-card__stun-overlay` shown (fullwidth translucent overlay with a stun glyph — a star-burst SVG, `position: absolute; inset: 0`). All icon buttons: `pointer-events: none`. The card stays on screen; the stun overlay communicates auto-skip. |

**CSS for `active` rim glow:**

```css
.ev-char-card[data-state="active"] {
  --border-stroke: var(--gold-glow);
  --panel-inset-glow: inset 0 0 18px rgba(248, 232, 144, 0.18);
  animation: card-rim-pulse 1.4s ease-in-out infinite;
}

@keyframes card-rim-pulse {
  0%, 100% { box-shadow: inset 0 0 14px rgba(248,232,144,0.12), 0 0 8px rgba(200,160,32,0.3); }
  50%       { box-shadow: inset 0 0 22px rgba(248,232,144,0.25), 0 0 16px rgba(200,160,32,0.55); }
}
```

**CSS for `resolving` (gold static, no pulse):**

```css
.ev-char-card[data-state="resolving"] {
  --border-stroke: var(--gold-glow);
  --panel-inset-glow: inset 0 0 14px rgba(248,232,144,0.10);
}
```

**Extra-attack badge:**

```html
<!-- Injected into ev-panel__body when _drainExtraAttacks is running -->
<div class="ev-extra-attack-badge" aria-live="polite">x2 Attack</div>
```

```css
.ev-extra-attack-badge {
  position: absolute;
  bottom: 4px;
  left: 50%;
  transform: translateX(-50%);
  font-family: 'Cinzel', serif;
  font-size: 10px;
  color: var(--fire-bloom);
  animation: badge-fade 600ms forwards;
}
@keyframes badge-fade {
  0%   { opacity: 1; transform: translateX(-50%) translateY(0); }
  100% { opacity: 0; transform: translateX(-50%) translateY(-8px); }
}
```

**Silenced overlay** (on individual magic spell icon buttons, not the whole card):

```css
.spell-icon--silenced {
  position: relative;
}
.spell-icon--silenced::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(204, 48, 32, 0.35);
  border-radius: 4px;
  pointer-events: none;
}
```

---

## 5. Click Contract

When the player clicks a spell icon in manual mode during their character's turn:

```
1. Browser fires click event on <button class="spell-icon" data-skill="{skillId}">
2. ev-card-rail click handler reads:
     - data-skill (the skill ID, or 'basic_attack', or 'use_item', or 'skip_turn')
     - data-char-id from nearest .ev-char-card ancestor
3. Guard check (fail-fast):
     - _awaitingInput === null → ignore (should not be reachable; pointer-events are off)
     - _awaitingInput.id !== cardCharId → ignore
     - skill is on cooldown → ignore
     - actor.mp < skill.mpCost → ignore (icon was --no-mana, pointer-events still on for feedback)
     - actor.hasSilence && skill.type === 'magic' → ignore
4. For skills requiring target selection:
     - dispatch CustomEvent 'ev:targeting-start' (see §6)
     - return without dispatching the action yet
5. For no-target skills (AOE 'all', heals targeting self, buffs):
     - dispatch CustomEvent 'ev:spell-pick' immediately
6. For 'use_item':
     - call item free-action path; do NOT dispatch 'ev:spell-pick'
     - do NOT clear _awaitingInput
     - re-render the item slot count
7. For 'skip_turn':
     - dispatch 'ev:spell-pick' with skillId: 'skip_turn'
```

**`ev:spell-pick` payload:**

```js
document.dispatchEvent(new CustomEvent('ev:spell-pick', {
  detail: {
    characterId: character.id,        // matches _awaitingInput.id
    skillId: skillId,                 // 'basic_attack' | skill.id | 'skip_turn'
    weaponDamageType: damageType,     // populated when skillId === 'basic_attack'
  },
  bubbles: true,
}));
```

**Who listens:** `CombatScreen._dispatchManualAction` listens on `document` for `ev:spell-pick`. It validates `characterId === this._awaitingInput.id`, then routes to `_basicAttack`, `_executeSkill`, or the skip path. After routing it clears `_awaitingInput` and advances the turn loop. Phase 02 §3 defines this transition.

---

## 6. AOE Confirm Flow

The flow branches on `skill.aoe` from the SKILLS dict:

```
Player clicks spell icon (slot 1–N)
  │
  ├─ skill.aoe === 'single' AND skill.type === 'magic' (offensive, needs target)
  │    → dispatch 'ev:targeting-start'
  │    → phase 04 activateTargeting(actor.id, skill.id, validEnemyTiles)
  │    → player clicks a tile
  │    → phase 04 dispatches 'ev:target-select' with { sourceCombatantId, targetCombatantId, skillId }
  │    → card-rail handler receives 'ev:target-select'
  │    → dispatch 'ev:spell-pick' with { characterId, skillId, targetCombatantId }
  │    → phase 04 deactivateTargeting()
  │
  ├─ skill.aoe === 'single' AND skill targets self or ally (heal, buff)
  │    → auto-aim: no target picker
  │    → dispatch 'ev:spell-pick' immediately with targetCombatantId = best ally target
  │      (use existing pickBestTarget logic from _aiTargeting.js, restricted to allies)
  │
  ├─ skill.aoe === 'all' (hits all enemies or all allies)
  │    → no target selection needed
  │    → dispatch 'ev:spell-pick' immediately; targetCombatantId = null
  │
  ├─ skill.aoe === 'row' | 'adjacent' | 'chain' | 'pierce_row'
  │    → enter targeting mode: show valid starting tiles
  │    → player selects a tile; AOE propagation is computed server-side in _executeSkill
  │    → dispatch 'ev:spell-pick' with { characterId, skillId, targetCombatantId }
  │    → deactivateTargeting()
  │
  └─ skill.aoe === 'random3'
       → no target selection (targets are randomly resolved in _executeSkill)
       → dispatch 'ev:spell-pick' immediately; targetCombatantId = null
```

**`ev:targeting-start` payload:**

```js
document.dispatchEvent(new CustomEvent('ev:targeting-start', {
  detail: {
    sourceCombatantId: character.id,
    skillId: skillId,
    aoeShape: skill.aoe,                    // 'single' | 'row' | 'adjacent' | etc.
    validTiles: computeValidTargetTiles(),  // Array<{col, row}> — enemy tiles for offensive,
                                            //                      ally tiles for heal/buff
  },
  bubbles: true,
}));
```

Phase 04's `activateTargeting()` listens for this event OR is called directly. Phase 06 may call it directly (preferred — avoids event bus ambiguity):

```js
activateTargeting(character.id, skillId, validTiles);
```

**Cancel targeting:** Player presses Escape or taps outside the grid → `deactivateTargeting()` is called by the grid handler → `_awaitingInput` remains set → card rail remains hot → player can choose a different action.

---

## 7. Mobile Collapse (Breakpoint: 700px)

### Desktop (viewport width >= 700px)

- All hero cards are visible simultaneously in `.ev-hud__card-row`.
- All spell rails are visible but only the active actor's rail has hot buttons.
- Card row is `display: flex; flex-direction: row; overflow-x: auto; scroll-snap-type: x mandatory`.
- Each card snap-aligns: `scroll-snap-align: start`.
- Card width: minimum `160px`, grows via `flex: 1 1 160px` up to `220px`.

### Mobile (viewport width < 700px)

The card row compresses to a single visible card plus a strip of mini-portrait selectors:

```html
<div class="ev-hud__card-row ev-hud__card-row--mobile">
  <!-- Only the selected card is expanded (all others display:none) -->
  <article class="ev-char-card ev-char-card--mobile-selected" ...>
    <!-- Full card with spell rail -->
  </article>

  <!-- Mini-portrait strip replaces all other cards -->
  <div class="ev-mobile-portrait-strip" role="tablist" aria-label="Switch character">
    <button class="ev-mobile-portrait-btn"
            role="tab"
            aria-selected="{isSelected}"
            data-char-id="{characterId}"
            aria-label="{character.name}">
      <img src="{character.portraitUrl}" alt="" width="36" height="36"
           class="ev-mobile-portrait-thumb">
      <!-- Small HP indicator strip -->
      <div class="ev-mobile-hp-strip">
        <div class="ev-mobile-hp-fill" style="width:{hpPct}%"></div>
      </div>
    </button>
    <!-- Repeat for each hero (max 4) -->
  </div>
</div>
```

**Mobile state rules:**

- The "selected" character on mobile normally follows the user's last tap on the portrait strip.
- When `_awaitingInput` is set in manual mode, the selected character is **forced** to the active actor. The portrait strip button for the active actor gets `aria-selected="true"` and a gold outline. Other strip buttons remain tappable for inspection (they show their card read-only) but switching away from the active actor is disallowed while `_awaitingInput !== null`.
- Touch targets on portrait strip buttons: minimum `44×44px` (portrait is 36px; remaining 8px is padding).

**CSS breakpoint:**

```css
@media (max-width: 700px) {
  .ev-hud__card-row { flex-direction: column; }
  .ev-char-card:not(.ev-char-card--mobile-selected) { display: none; }
  .ev-mobile-portrait-strip { display: flex; }
  .ev-mobile-portrait-btn { min-width: 44px; min-height: 44px; }
}

@media (min-width: 701px) {
  .ev-mobile-portrait-strip { display: none; }
}
```

---

## 8. Companion Row

Companions render in a separate `<div class="ev-companion-row">` that is a sibling to `.ev-hud__card-row`, positioned below it inside `#ev-hud`.

**Companion card structure (abbreviated — no spell rail):**

```html
<article class="ev-companion-card ev-panel ev-panel--companion"
         id="ev-companion-{id}"
         data-char-id="{id}"
         data-state="inactive"
         role="listitem"
         aria-label="{companion.name} (Auto)">
  <!-- lozenge corners from phase 07 -->
  <div class="ev-panel__body">
    <div class="ev-companion-card__header">
      <img class="ev-companion-card__portrait"
           src="{companion.portraitUrl}" alt="{companion.name} portrait"
           width="36" height="36">
      <div class="ev-companion-card__identity">
        <span class="ev-companion-card__name">{companion.name}</span>
        <!-- AI badge — always shown; companions never go manual -->
        <span class="ev-companion-card__ai-badge" aria-label="AI controlled">AI</span>
      </div>
    </div>
    <div class="ev-bar-track" role="progressbar"
         aria-valuenow="{companion.hp}" aria-valuemax="{companion.maxHp}"
         aria-label="{companion.name} HP">
      <div class="ev-bar ev-bar--hp" style="width:{hpPct}%"></div>
    </div>
    <div class="ev-card__statuses"><!-- status icons --></div>
    <!-- NO spell rail. Companions auto-play in manual mode per README. -->
  </div>
</article>
```

Companion cards are smaller than hero cards: `~130px wide × 64px tall` (desktop). On mobile they compress further or hide behind a companion strip (phase 10 decision). Dead companions: `data-state="dead"`, same grayscale treatment as hero cards.

---

## 9. Turn-Order Strip

The turn-order strip sits at the top of the screen inside `manager.uiOverlay`, above `.ev-battlefield`. It is a `<nav>` with horizontal flex layout.

### DOM

```html
<nav class="ev-turn-strip ev-panel ev-panel--mini" id="ev-turn-strip"
     aria-label="Turn order">
  <!-- simple corners from phase 07 variant matrix -->
  <span class="ev-round-label" id="ev-round-label">Round 1</span>
  <div class="ev-turn-strip__chips" role="list" aria-label="Initiative order">
    <!-- One ev-turn-chip per combatant in _turnOrder -->
    <div class="ev-turn-chip"
         id="ev-chip-{combatantId}"
         data-side="{hero|enemy|companion}"
         data-state="{active|inactive|dead}"
         role="listitem"
         aria-label="{name}, {hp}/{maxHp} HP">
      <!-- simple corners at chip scale -->
      <img class="ev-turn-chip__portrait"
           src="{combatant.portraitUrl}"
           alt=""
           width="32" height="32">
      <div class="ev-turn-chip__hp-bar">
        <div class="ev-turn-chip__hp-fill" style="width:{hpPct}%"></div>
      </div>
      <!-- Class glyph (14px) — hero side only -->
      <svg class="ev-turn-chip__class-glyph" aria-hidden="true" width="10" height="10">
        <!-- class svgIcon at 10×10 -->
      </svg>
    </div>
    <!-- repeat per combatant -->
  </div>
</nav>
```

### Per-Chip Schema

| Element | Data binding | DOM selector |
|---|---|---|
| Portrait thumbnail | `combatant.portraitUrl` (40×40, `object-fit: cover`) | `.ev-turn-chip__portrait` |
| HP fill bar | `combatant.hp / combatant.maxHp * 100` → `style.width` | `.ev-turn-chip__hp-fill` |
| Border color | `data-side="hero"` → `--gold-rim`; `data-side="enemy"` → `--hp-low` | CSS via `[data-side]` selector |
| Active pulse | `data-state="active"` → keyframe animation | CSS via `[data-state="active"]` |
| Dead state | `data-state="dead"` → `filter: grayscale(1) opacity(0.4)` | CSS via `[data-state="dead"]` |
| Class glyph | Only on hero/companion chips; `combatant.classSvgIcon` | `.ev-turn-chip__class-glyph` |

**Active chip pulse:**

```css
.ev-turn-chip[data-state="active"] {
  --border-stroke: var(--gold-glow);
  animation: chip-active-pulse 1.1s ease-in-out infinite;
}
@keyframes chip-active-pulse {
  0%, 100% { box-shadow: 0 0 4px 1px rgba(248,232,144,0.4); }
  50%       { box-shadow: 0 0 10px 3px rgba(248,232,144,0.75); }
}
```

**Hero vs enemy border:**

```css
.ev-turn-chip[data-side="hero"]      { --border-stroke: var(--gold-rim); }
.ev-turn-chip[data-side="companion"] { --border-stroke: var(--gold-dim); }
.ev-turn-chip[data-side="enemy"]     { --border-stroke: var(--hp-low); }
```

**Chips are not clickable** in v1. `pointer-events: none` on the chip strip. Turn-chip tappability (for stat inspection) is a phase 09 / phase 10 decision.

**Mobile:** Turn-strip collapses on mobile under a menu toggle. Phase 10 specifies the exact affordance. The DOM strip exists on mobile but is hidden by default; a floating "Round N" badge with an expand button is the mobile entry point.

---

## 10. Rendering Strategy

**Decision: Incremental dirty-check, mirroring the existing `_renderHud` pattern from phase 01.**

Full re-render per round is tempting (5–10 cards, trivially fast), but introduces two problems: losing CSS transition state on bars (a full re-render kills the width-transition mid-animation) and resetting `data-state` attributes mid-combat-resolution (causing flicker during multi-attack drain). The dirty-check pattern already proven by `.hm` HP bars extends cleanly.

**Update contract:**

```js
/**
 * Called from CombatScreen whenever character state may have changed.
 * Candidates: after _applyDamage, after status effect tick, after _pauseForPlayerInput sets _awaitingInput.
 * Safe to call multiple times per tick — the dirty-check prevents excess DOM writes.
 */
function updateCardRail(characterId) {
  const card = document.getElementById(`ev-card-${characterId}`);
  if (!card) return;
  const char = getCharacterById(characterId);  // live reference from _allies

  // HP bar: only write style.width if value changed
  const hpPct = Math.max(0, (char.hp / char.maxHp) * 100);
  const hpBar = card.querySelector('.ev-bar--hp');
  if (hpBar && parseFloat(hpBar.style.width) !== hpPct) {
    hpBar.style.width = `${hpPct}%`;
    hpBar.classList.toggle('ev-bar--hp-low', hpPct < 30);
  }

  // MP bar
  const mpPct = Math.max(0, (char.mp / char.maxMp) * 100);
  const mpBar = card.querySelector('.ev-bar--mp');
  if (mpBar && parseFloat(mpBar.style.width) !== mpPct) {
    mpBar.style.width = `${mpPct}%`;
  }

  // Card state
  const newState = resolveCardState(char);  // see §4
  if (card.dataset.state !== newState) {
    card.dataset.state = newState;
  }

  // Spell rail icon states (only when state changes)
  updateSpellRailStates(characterId, char);

  // Status icons: full replace only when status array changes (compare length + keys)
  updateStatusIcons(card, char.statusEffects);
}
```

**Full re-render** happens only at combat start and when a character's skill set changes (level-up during combat is impossible, so this is effectively never mid-fight).

**Turn-strip** updates after each `_buildTurnOrder()` call (once per round boundary). The strip is rebuilt from scratch each round — cheap, and avoids ordering bugs from incremental position shuffles.

---

## 11. Sprite and Portrait Integration

The card portrait is a **separate `<img>`** from the battlefield sprite. They share the same source URL.

```
Battlefield sprite:
  Element: <img id="ev-sprite-{id}" class="ev-sprite">
  Source:  character.spriteUrl  (e.g. /images/sprites/fighter_idle.png)
  Size:    ~96px × 144px at row 4, scaled by grid depth (phase 04 §6)
  Position: absolute, computed by spriteAnchor() in recomputeLayout()
  Crop:    None — full sprite body shown

Card portrait:
  Element: <img class="ev-card__portrait-img">
  Source:  character.portraitUrl ?? character.spriteUrl  (same file)
  Size:    48px × 48px (desktop), 40px × 40px (mobile)
  CSS:     object-fit: cover; object-position: top center;
           border-radius: 2px;
  Purpose: Shows face/upper-body crop; does NOT move or animate with the battlefield sprite
```

If `character.portraitUrl` is a dedicated head-crop (separate file), use it. If not, `object-position: top center` on the sprite file gives a reasonable face-region crop for most character sprites that follow the "head near top" convention used by SpriteCook.

Turn-chip portrait: same source, 32×32, `object-fit: cover; object-position: top center`.

---

## 12. CSS Class Taxonomy

All new classes use the `ev-` prefix. The existing `.hm` family is deleted when `_renderHud` is replaced.

### Layout / Container

| Class | Element | Role |
|---|---|---|
| `ev-hud` | `#ev-hud` section | Root HUD container; anchored viewport-bottom |
| `ev-hud__card-row` | div | Horizontal flex strip of hero cards |
| `ev-companion-row` | div | Separate row for companion cards |
| `ev-turn-strip` | nav | Top-of-screen turn order strip |
| `ev-turn-strip__chips` | div | Horizontal flex of chips |
| `ev-round-label` | span | "Round N" text chip |
| `ev-tooltip-card` | aside | Floating spell tooltip (right of card row) |
| `ev-mobile-portrait-strip` | div | Mobile-only: horizontal strip of avatar buttons |
| `ev-mobile-portrait-btn` | button | Single portrait in mobile strip |
| `ev-mobile-portrait-thumb` | img | Portrait image in mobile strip button |
| `ev-mobile-hp-strip` | div | Thin HP indicator under mobile portrait |
| `ev-mobile-hp-fill` | div | Fill bar inside `ev-mobile-hp-strip` |

### Card

| Class | Element | Role |
|---|---|---|
| `ev-char-card` | article | One hero HUD card; carries `data-state` |
| `ev-char-card--active` | modifier | Added when `data-state="active"` for animation |
| `ev-char-card--mobile-selected` | modifier | Mobile: the currently expanded card |
| `ev-companion-card` | article | Companion-specific card variant |
| `ev-card__header` | header | Portrait + identity row |
| `ev-card__portrait-frame` | div | `.ev-panel` sub-panel wrapping portrait img |
| `ev-card__portrait-img` | img | 48×48 cropped portrait |
| `ev-card__identity` | div | Name + class label + class glyph |
| `ev-card__name` | span | Character name text |
| `ev-card__class-label` | span | Class name text |
| `ev-card__class-icon` | svg | 14×14 class glyph |
| `ev-card__bars` | div | HP + MP bar group container |
| `ev-card__statuses` | div | Status icon row |
| `ev-card__spell-rail` | div | Spell icon button row |
| `ev-card__stun-overlay` | div | Fullwidth stun-state overlay |
| `ev-card__ai-badge` | span | Companion "AI" badge |
| `ev-companion-card__header` | div | Companion portrait + identity |
| `ev-companion-card__portrait` | img | 36×36 companion portrait |
| `ev-companion-card__name` | span | Companion name |
| `ev-companion-card__ai-badge` | span | "AI" label |
| `ev-extra-attack-badge` | div | "x2 Attack" drain indicator |

### Bars

| Class | Element | Role |
|---|---|---|
| `ev-bar-group` | div | Wraps one bar + label |
| `ev-bar-group--hp` | modifier | HP bar group |
| `ev-bar-group--mp` | modifier | MP bar group |
| `ev-bar-track` | div | Background track for a bar |
| `ev-bar-track--mp` | modifier | Thinner MP track (4px vs 8px) |
| `ev-bar` | div | Filled portion inside a track |
| `ev-bar--hp` | modifier | Green HP fill |
| `ev-bar--hp-low` | modifier | Red HP fill (< 30%) |
| `ev-bar--shield` | modifier | Blue barrier/block fill |
| `ev-bar--mp` | modifier | Blue MP fill |
| `ev-bar-label` | span | Numeric `N/N` readout |
| `ev-bar-label--hp` | modifier | HP label |
| `ev-bar-label--mp` | modifier | MP label |

### Spell Icons (from phase 08)

| Class | Element | Role |
|---|---|---|
| `spell-icon` | button | Base spell icon wrapper |
| `spell-icon--enabled` | modifier | Your turn, can cast |
| `spell-icon--not-my-turn` | modifier | Globally cold (other actor's turn) |
| `spell-icon--disabled` | modifier | Unavailable (dead, resolving) |
| `spell-icon--on-cooldown` | modifier | Skill on cooldown; carries `--cd-pct` |
| `spell-icon--no-mana` | modifier | Insufficient MP; blue pulse |
| `spell-icon--ready` | modifier | Active turn, castable; amber pulse |
| `spell-icon--silenced` | modifier | Magic spell under silence effect |
| `ev-spell-icon--item` | modifier | Use Item slot variant |
| `ev-skip-btn` | button | End Turn / Skip action |

### Turn Strip / Chips

| Class | Element | Role |
|---|---|---|
| `ev-turn-chip` | div | Single combatant chip in the strip |
| `ev-turn-chip__portrait` | img | 32×32 portrait in chip |
| `ev-turn-chip__hp-bar` | div | Thin HP track in chip |
| `ev-turn-chip__hp-fill` | div | HP fill inside chip track |
| `ev-turn-chip__class-glyph` | svg | 10×10 class icon in chip |

### Status Icons (migrated from `_renderStatusRow`)

| Class | Element | Role |
|---|---|---|
| `ev-status-icon` | span | One status effect indicator |
| `ev-status-icon--{key}` | modifier | Per-status color + glyph (burn, poison, stun, etc.) |

---

## Handoff to Phases 9 (Tooltips) and 10 (Mobile)

### Load-bearing facts for Phase 9 (Tooltips)

1. **Tooltip hook:** `<aside id="ev-tooltip-card" hidden>` is already in the DOM, positioned absolute right of `.ev-hud__card-row`. Phase 09 populates it by reading `data-skill` from the hovered/tapped `.spell-icon` button and looking up the SKILLS dict.

2. **Trigger events:** Phase 09 should listen for `mouseenter` / `focus` on `.spell-icon` (desktop) and `touchstart` (mobile). The existing button receives these events; no wrapper div is needed.

3. **Tooltip data available at hover time:** `data-skill="{skillId}"` on the button. Full skill record from `SKILLS[skillId]`: `name`, `description`, `mpCost`, `cooldown`, `type`, `aoe`, `damageType`. The current actor's `spellPower` / `attackPower` for estimated damage display is available from `_awaitingInput` (or any character by ID).

4. **Tooltip card variant:** `ev-panel--tooltip` with `flourish` corners per phase 07 variant matrix. It has a `seal-bar` top divider separating the skill name from the description body.

5. **Right-edge layout on desktop:** The tooltip card occupies the space to the right of `.ev-hud__card-row` (approximately the `~22%` right gutter defined in phase 00 §3). It is `position: absolute; right: 0; bottom: 0` within `#ev-hud`. Phase 09 may animate it as a slide-in from the right (`transform: translateX(100%)` → `translateX(0)`).

6. **Icon size in tooltip:** 24×24 inline SVG showing the spell's icon (same source as the button, same `currentColor`). Color in the tooltip context is `--gold-rim` (unaffected by the card state classes).

### Load-bearing facts for Phase 10 (Mobile)

1. **Breakpoint:** `700px`. Below this, `.ev-char-card` goes to single-visible mode and `.ev-mobile-portrait-strip` appears. Phase 10 owns the portrait-strip interaction and any swipe gestures.

2. **Forced selection during `_awaitingInput`:** When `_awaitingInput !== null`, the active actor is programmatically selected. Phase 10 must expose a `selectMobileCard(characterId)` function that the card-rail update path can call when `_awaitingInput` changes.

3. **Turn-strip mobile collapse:** `#ev-turn-strip` is hidden on mobile; a compact "Round N / Next: X" badge floats in the top-right of `.ev-battlefield`. Phase 10 defines the expand/collapse affordance.

4. **Tooltip on mobile:** `#ev-tooltip-card` becomes a bottom-sheet on mobile (slides up from below the card row). Phase 10 defines the sheet height, dismiss gesture, and z-index layering.

5. **Touch target audit:** All `.spell-icon` buttons are `32×32px` on desktop and `24×24px` on mobile. They do not meet the 44×44px minimum at 24px. Phase 10 must either increase padding (`padding: 10px` on mobile = 44px total) or group the rail into a scrollable strip with larger hit areas.

6. **Companion row on mobile:** Phase 10 decides whether the companion row is always visible, collapsed behind a toggle, or hidden on mobile. Recommend hiding behind a toggle given screen budget constraints.

7. **`.ev-char-card--mobile-selected` class:** Phase 10 applies and removes this class via `selectMobileCard(characterId)`. The card-rail phase does not own the mobile selection UX loop.
