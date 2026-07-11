# Phase 08 — Spell Icons: Placeholder Visual Language

**Author:** ui-designer agent
**Date:** 2026-04-29
**Depends on:** Phase 00 (palette tokens), Phase 06 (card-rail spec), `src/game/skills.js` (type + aoe schema), `src/game/classes.js` (svgIcon style reference)

---

## 1. Visual Language Summary

Every spell icon at 32×32 (24×24 on mobile) communicates three facts simultaneously without requiring text. The **central glyph** encodes category and damage type: a sword silhouette for physical melee, a flame tongue for fire magic, a water droplet for heal, a forked bolt for lightning, an ankh for holy, a spiral for arcane, and so on — one shape that names the school at a glance. A **peripheral pattern** around that glyph encodes area-of-effect shape: nothing extra for single-target, a horizontal triple-dot rule for row hits, a ring of six equidistant dots for full-party or all-enemy hits, three connected nodes for chain propagation, and a short outward arc for adjacent-only splash — so even in a crowded spell rail a player can distinguish "this hits one" from "this hits the whole enemy line" without reading the tooltip. **State** is the third layer, handled entirely in CSS without touching the SVG source: the enabled icon renders at full `currentColor` opacity; disabled-not-my-turn drops to 0.3 opacity and desaturates via `filter: grayscale(1)`; cooldown adds a clock-pie clip overlay using a conic-gradient pseudo-element; insufficient mana pulses blue-tinted; and ready-to-cast (manual mode highlight) adds a soft amber glow ring. This three-layer grammar is consistent with the existing class `svgIcon` conventions — 36×36 viewBox style, 1.5px stroke, `fill="none"` or minimal flat fill, `stroke="currentColor"` — so a future theming token change propagates automatically across all icons.

---

## 2. Glyph Dictionary

Mapping of `type` + `damageStat` combinations to the central glyph. Rows ordered by frequency in `skills.js`. All SVGs use `viewBox="0 0 32 32"`, `stroke="currentColor"`, `stroke-width="1.5"`, `fill="none"` unless noted.

| type | damageStat | Glyph name | Inline SVG |
|---|---|---|---|
| `melee` | `str` | **Sword** | `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 24L24 8M20 6l4-2-2 4M10 26c-1 1-3 1-3-1s0-2 2-2"/></svg>` |
| `melee` | `str_int` | **Radiant Sword** (holy cross superimposed) | `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 23L23 9M19 7l4-2-2 4"/><path d="M16 10v4M14 12h4"/></svg>` |
| `melee` | `dex` | **Dagger** (thin stiletto) | `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 22L22 10M21 9l3-1-1 3"/><path d="M10 22l-2 2"/></svg>` |
| `magic` | `int` | **Arcane Orb** (circle with inner spark) | `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="16" cy="16" r="7"/><path d="M16 12v4l3 3"/></svg>` |
| `magic` | `int` (fire) | **Flame Tongue** | `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16 26c-4-2-6-6-4-10 1 2 3 2 3 0 0-4 4-8 4-8s4 6 4 9c0 4-3 7-7 9z"/></svg>` |
| `magic` | `int` (lightning) | **Forked Bolt** | `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 6l-6 10h5l-5 10M18 16l4 6"/></svg>` |
| `magic` | `int` (holy) | **Ankh** | `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="16" cy="10" r="4"/><path d="M16 14v12M11 19h10"/></svg>` |
| `magic` | `int` (shadow / void) | **Void Eye** (circle with inward spines) | `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="16" cy="16" r="6"/><path d="M16 6v4M16 22v4M6 16h4M22 16h4M9 9l3 3M20 20l3 3M9 23l3-3M20 12l3-3"/></svg>` |
| `magic` | `int` (arcane debuff) | **Spiral** | `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16 16m-2 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0M16 14a5 5 0 1 1-5 5M16 9a9 9 0 0 1 7 14"/></svg>` |
| `heal` | `int` | **Droplet Cross** (teardrop with embedded cross) | `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16 8c-4 5-6 9-6 12a6 6 0 0 0 12 0c0-3-2-7-6-12z"/><path d="M13 18h6M16 15v6"/></svg>` |
| `buff` | — | **Shield with upward arrow** | `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16 5L7 9v7c0 6 4 10 9 11 5-1 9-5 9-11V9L16 5z"/><path d="M16 13v6M13 16l3-3 3 3"/></svg>` |
| `debuff` | — | **Skull outline** | `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 20v3h12v-3"/><ellipse cx="16" cy="14" rx="7" ry="7"/><circle cx="13" cy="14" r="1.5" fill="currentColor"/><circle cx="19" cy="14" r="1.5" fill="currentColor"/></svg>` |
| `revive` | — | **Ankh with upward spark** | `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="16" cy="10" r="4"/><path d="M16 14v10M12 20h8M16 6l-2-3M16 6l2-3"/></svg>` |
| `ranged` | `dex` | **Arrow** | `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 24L24 8M20 7l5-1-1 5M8 24l-2 2"/></svg>` |

**Notes on "fire / lightning / holy" subdivision:** The skills data does not carry a `damageType` sub-field on every skill — damage sub-type is implied by the skill name and description. Phase 11 (implementation) should either add a `damageType` field to skill schema (`'fire' | 'lightning' | 'holy' | 'shadow' | 'arcane' | 'physical'`) or read it from a lookup map keyed by skill ID. The glyph dictionary above is keyed by `type` + an optional tag that maps to that lookup; the icon selection layer resolves at render time.

---

## 3. AoE Peripheral Patterns

These patterns live at the outer edge of the 32×32 viewBox, outside the central glyph's 18×18 safe zone. At 24×24 scaled size, the dots are 1.5px radius circles — just visible without cluttering. At 32×32 they are 2px radius.

| `aoe` value | Pattern name | Visual treatment | Inline SVG (peripheral only, composited over central glyph) |
|---|---|---|---|
| `single` | **No peripheral** | Nothing added. Clean center glyph only. | _(omit)_ |
| `adjacent` | **Short Arc** | A 90° arc on the right side of the icon at radius 13px from center. One dot at arc midpoint. | `<path d="M25 12a9 9 0 0 1 0 8" stroke="currentColor" stroke-width="1" fill="none"/><circle cx="26" cy="16" r="1.5" fill="currentColor"/>` |
| `adjacent2` | **Double Arc** | Same arc, two dots spaced apart on it. | `<path d="M25 11a10 10 0 0 1 0 10" stroke="currentColor" stroke-width="1" fill="none"/><circle cx="27" cy="13" r="1.5" fill="currentColor"/><circle cx="27" cy="19" r="1.5" fill="currentColor"/>` |
| `row` | **Horizontal Triple-Dot Rule** | Three equidistant dots across the bottom edge (y=29), center-aligned. | `<circle cx="11" cy="29" r="1.5" fill="currentColor"/><circle cx="16" cy="29" r="1.5" fill="currentColor"/><circle cx="21" cy="29" r="1.5" fill="currentColor"/>` |
| `all` | **Ring of Six Dots** | Six dots on a radius-13 circle, evenly at 60° increments, outer edge of icon. | `<circle cx="16" cy="3" r="1.5" fill="currentColor"/><circle cx="27" cy="9.5" r="1.5" fill="currentColor"/><circle cx="27" cy="22.5" r="1.5" fill="currentColor"/><circle cx="16" cy="29" r="1.5" fill="currentColor"/><circle cx="5" cy="22.5" r="1.5" fill="currentColor"/><circle cx="5" cy="9.5" r="1.5" fill="currentColor"/>` |
| `chain` | **Three Connected Nodes** | Three small circles at bottom-right cluster, connected by thin lines: primary → secondary → tertiary. | `<circle cx="22" cy="24" r="2" stroke="currentColor" stroke-width="1" fill="none"/><circle cx="27" cy="20" r="1.5" stroke="currentColor" stroke-width="1" fill="none"/><circle cx="29" cy="25" r="1.5" stroke="currentColor" stroke-width="1" fill="none"/><line x1="22" y1="24" x2="27" y2="20" stroke="currentColor" stroke-width="1"/><line x1="27" y1="20" x2="29" y2="25" stroke="currentColor" stroke-width="1"/>` |
| `random3` | **Three Scattered Dots** | Three dots at irregular positions near top-right — communicates "random target selection." | `<circle cx="25" cy="6" r="1.5" fill="currentColor"/><circle cx="29" cy="11" r="1.5" fill="currentColor"/><circle cx="22" cy="10" r="1.5" fill="currentColor"/>` |
| `pierce_row` | **Dotted Arrow** | Horizontal triple-dot rule (same as `row`) plus a rightward arrowhead at the trailing edge — communicates penetration through a line. | `<circle cx="10" cy="29" r="1.5" fill="currentColor"/><circle cx="15" cy="29" r="1.5" fill="currentColor"/><circle cx="20" cy="29" r="1.5" fill="currentColor"/><path d="M22 27l4 2-4 2" stroke="currentColor" stroke-width="1" fill="none"/>` |

---

## 4. State Overlays

All state is applied via CSS on the `.spell-icon` wrapper `<button>` element. The SVG itself is state-agnostic — no JS class toggling needed on the SVG interior.

```css
/* ── Base ── */
.spell-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  position: relative;
  cursor: pointer;
  color: var(--gold-rim);           /* default: gold stroke via currentColor */
  border-radius: 4px;
  background: var(--ember-deep);
  border: 1px solid var(--gold-dim);
  transition: filter 0.15s, opacity 0.15s;
}

/* ── ENABLED (default, your turn) ── */
.spell-icon--enabled {
  opacity: 1;
  filter: none;
  color: var(--gold-rim);
}

/* ── DISABLED — not my turn (or passive) ── */
.spell-icon--disabled,
.spell-icon--not-my-turn {
  opacity: 0.3;
  filter: grayscale(1);
  pointer-events: none;
}

/* ── ON COOLDOWN — clock-pie overlay via conic-gradient pseudo ── */
.spell-icon--on-cooldown {
  opacity: 0.6;
}
.spell-icon--on-cooldown::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 4px;
  /* sweepAngle drives from JS: calc(var(--cd-pct, 0.5) * 360deg) */
  background: conic-gradient(
    from -90deg,
    rgba(6, 3, 14, 0.75) calc(var(--cd-pct, 0.5) * 360deg),
    transparent 0deg
  );
  pointer-events: none;
}
/* Cooldown number badge */
.spell-icon--on-cooldown[data-cd]::before {
  content: attr(data-cd);
  position: absolute;
  bottom: 1px;
  right: 3px;
  font-size: 8px;
  font-family: 'Cinzel', serif;
  color: var(--gold-glow);
  line-height: 1;
}

/* ── NOT ENOUGH MANA — blue pulse ── */
.spell-icon--no-mana {
  animation: mana-warn 1s ease-in-out infinite alternate;
  color: var(--arc-blue);
  border-color: var(--arc-blue);
}
@keyframes mana-warn {
  from { opacity: 0.45; }
  to   { opacity: 0.85; }
}

/* ── READY TO CAST (manual mode — player's active turn, awaiting input) ── */
.spell-icon--ready {
  color: var(--gold-glow);
  border-color: var(--gold-rim);
  box-shadow:
    0 0 6px 1px rgba(200, 160, 32, 0.55),
    inset 0 0 4px rgba(248, 232, 144, 0.15);
  animation: ready-pulse 1.2s ease-in-out infinite alternate;
}
@keyframes ready-pulse {
  from { box-shadow: 0 0 4px 1px rgba(200, 160, 32, 0.4), inset 0 0 3px rgba(248,232,144,0.1); }
  to   { box-shadow: 0 0 10px 3px rgba(200, 160, 32, 0.7), inset 0 0 6px rgba(248,232,144,0.25); }
}

/* ── Mobile scaling ── */
@media (max-width: 480px) {
  .spell-icon {
    width: 24px;
    height: 24px;
  }
  /* Stroke 1.5px holds fine at 24px; no override needed. */
  /* Clock-pie badge font-size drops to 7px */
  .spell-icon--on-cooldown[data-cd]::before {
    font-size: 7px;
  }
}
```

**`--cd-pct` usage:** set via inline style or JS: `el.style.setProperty('--cd-pct', remaining / total)`. A value of 0 = full dark overlay (just cast), 1 = no overlay (off cooldown).

---

## 5. Basic-Attack Icons by Weapon Damage Type

The leftmost slot in every character's spell rail is the basic attack — it should reflect the equipped weapon rather than the class. Seven weapon damage types are defined below. Each SVG is self-contained at 32×32 with no peripheral pattern (basic attacks always target `single`).

| Weapon type | Glyph name | Inline SVG |
|---|---|---|
| `physical` (sword) | **Crossed Swords** | `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg"><path d="M8 24L24 8M20 7l3-1-1 3"/><path d="M24 24L8 8M12 7l-3-1 1 3"/></svg>` |
| `magic` (orb) | **Arcane Orb** | `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="8"/><circle cx="16" cy="16" r="3"/><path d="M16 8V6M16 26v-2M8 16H6M26 16h-2"/></svg>` |
| `fire` (flame-claw) | **Flame with Claw tips** | `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg"><path d="M16 27c-5-2-7-7-5-12 1 3 3 3 3 1 0-5 4-9 4-9s1 3 0 6c3-1 4-4 4-4s3 6 1 11c-1 3-4 5-7 7z"/><path d="M12 27l-2 3M20 27l2 3"/></svg>` |
| `ice` (frost-claw) | **Snowflake with Claw** | `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg"><path d="M16 6v20M7 11l18 10M7 21L25 11"/><path d="M13 8l3-2 3 2M13 24l3 2 3-2M7 13l-2 3 2 3M25 13l2 3-2 3"/></svg>` |
| `lightning` (forked-bolt) | **Forked Lightning** | `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg"><path d="M20 5l-7 11h6l-7 11M19 16l5 7"/></svg>` |
| `holy` (radiant-cross) | **Radiant Cross** | `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg"><path d="M16 7v18M9 14h14"/><circle cx="16" cy="16" r="3"/><path d="M12 12l-3-3M20 12l3-3M12 20l-3 3M20 20l3 3"/></svg>` |
| `shadow` (void-claw) | **Void Claw** | `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg"><path d="M10 26c2-5 1-10 6-14M16 12c2 4 4 8 6 14M16 12c-2-2-2-5 0-7"/><path d="M11 27l-3 2M21 27l3 2M16 12l1-5"/></svg>` |

At runtime, the basic-attack slot reads `character.equippedWeapon.damageType` (or falls back to `'physical'` if undefined) and renders the corresponding SVG. The slot ID is always `basic_attack__<weaponDamageType>` so CSS `.spell-icon--melee` applies regardless of which weapon art is shown.

---

## 6. Sizing

| Context | Icon size | Stroke | Notes |
|---|---|---|---|
| Desktop HUD card | 32×32 px | 1.5px | Default. Matches class `svgIcon` conventions. |
| Mobile portrait (≤480px) | 24×24 px | 1.5px | Stroke does not need override — 1.5px is legible at 24×24. Clock-pie badge font drops to 7px (see §4). |
| Turn-order chip (phase 09 tooltip) | 20×20 px | 1.2px | Reduce via `stroke-width="1.2"` attribute override or CSS `svg { stroke-width: 1.2; }` scoped to `.turn-chip`. |
| Tooltip card inline thumbnail | 24×24 px | 1.5px | Same as mobile; no override needed. |

The 1.5px stroke holds across all target sizes in this table. The only exception is the turn-chip at 20px, where the peripheral pattern dots may need to be removed or reduced to 1px radius to avoid collision with the glyph edge. Phase 09 (tooltips) should confirm.

---

## 7. Asset Replacement Queue

These 8 placeholder SVGs ship with the manual-mode overhaul. Real-art replacements should be commissioned as a single OpenAI `gpt-image-2` batch once the game ships to staging, using the prompts below. Each replacement is a 64×64 PNG with transparent background, then downscaled or sprite-sheeted.

| # | Placeholder file | Real-art prompt (gpt-image-2, 64×64, transparent bg) |
|---|---|---|
| 1 | `spell-attack-melee.svg` | Two crossed swords, fantasy game icon, pixel-art style, amber gold outline, dark transparent background, 64×64 |
| 2 | `spell-attack-magic.svg` | Glowing arcane orb with inner energy spiral, fantasy game icon, blue-white outline, transparent background, 64×64 |
| 3 | `spell-fireball.svg` | Flame burst icon, stylized fire tongue with ember sparks, orange-red, game UI icon, transparent background, 64×64 |
| 4 | `spell-cleave.svg` | Broad sword sweep arc leaving a glowing trail, game UI icon, gold outline on dark, 64×64 |
| 5 | `spell-chain-lightning.svg` | Forked lightning bolt connecting three energy nodes, blue-white electric, game icon, transparent background, 64×64 |
| 6 | `spell-heal.svg` | Glowing water droplet with embedded cross of light, healing icon, green-white, game UI, transparent background, 64×64 |
| 7 | `spell-mass-heal.svg` | Six radiating light beams forming a burst halo, healing all icon, white-gold, game UI, transparent background, 64×64 |
| 8 | `spell-holy-strike.svg` | Sword with radiant cross hilt, divine light emanating, holy fantasy icon, gold-white, transparent background, 64×64 |

After real art lands, replace `<img src="spell-xxx.svg">` references with `<img src="spell-xxx.png">` (or update the sprite sheet). The CSS class system in §4 requires no changes.

---

## 8. Naming Convention and DOM

**File path pattern (placeholder SVGs):**
```
public/images/spell-icons/<id>.svg
```
Example: `public/images/spell-icons/spell-fireball.svg`

**CSS class on wrapper:**
```html
<button class="spell-icon spell-icon--enabled" data-skill="fireball">
  <svg ...>...</svg>
</button>
```

The modifier class encodes state: `--enabled`, `--disabled`, `--not-my-turn`, `--on-cooldown`, `--no-mana`, `--ready`. Only one state class is active at a time.

**Why inline SVG over `<use href>`:**

The `<use href="#symbol-id">` pattern requires a shared `<svg>` defs block in the document — fine for a large sprite sheet, but it adds a preload dependency and makes per-icon `currentColor` inheritance brittle across shadow-DOM boundaries. Since the spell rail renders at most 6–8 icons per card and the SVGs are all under 400 bytes, **inline `<svg>` inside each `<button>` is the correct choice**: zero extra network requests, `currentColor` propagates directly from the button's CSS `color`, and individual icons can be swapped without touching the symbol registry.

**For the real-art replacement phase**, the SVG inline approach still works — the `<svg>` simply wraps an `<image>` element pointing to the PNG, or the entire SVG is replaced by an `<img>` tag. Either path requires no structural change to the button or state CSS.

**Recommended render function:**
```js
function renderSpellIcon(skill, state) {
  const svgSrc = getSkillSvg(skill.id);  // returns inline SVG string
  return `<button
    class="spell-icon spell-icon--${state}"
    data-skill="${skill.id}"
    data-cd="${skill.remainingCooldown || ''}"
    style="${state === 'on-cooldown' ? `--cd-pct:${skill.remainingCooldown / skill.cooldown}` : ''}"
    aria-label="${skill.name}"
    title="${skill.name}"
  >${svgSrc}</button>`;
}
```

---

## Handoff to Phase 11

Phase 11 (slideshow generator) should pull these four hooks from this document:

1. **Slide: Glyph Dictionary** — render the full §2 table as an interactive slide. Show each glyph at 64×64 (2× scaled) against `--ember-deep` background with the `type` + `damageStat` label beneath. A good placement is immediately after the "what is a spell rail?" intro slide, as it grounds all subsequent icon discussion.

2. **Slide: AoE Peripheral Patterns** — show the 8 patterns side-by-side at 64×64 with the AoE label. Animate the chain-node pattern with a brief SVG `stroke-dashoffset` draw-on to illustrate propagation.

3. **Slide: State Matrix** — a 5-column grid showing one icon (recommend `spell-fireball`) in all 5 states (`enabled`, `disabled`, `on-cooldown`, `no-mana`, `ready`), with the CSS rule that drives each state annotated in a callout below the icon.

4. **Slide: Basic-Attack Rail** — the 7 weapon-type basic-attack icons arranged horizontally with weapon labels, followed by a mockup showing the leftmost slot of a Fighter card swapping through physical → fire → holy as the weapon changes. This slide pairs cleanly with Phase 06's card-rail spec to demonstrate the dynamic slot behavior.
