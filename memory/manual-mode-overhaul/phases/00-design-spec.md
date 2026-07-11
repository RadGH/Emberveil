# Phase 00 — Design Spec: Reference Image Deconstruction

**Author:** ui-designer agent
**Date:** 2026-04-29
**Source image:** `assets/references/emberveil/images/emberveil-design-openai-chatgpt.png` (1536×1024)

---

## 1. Image Overview

The reference image shows a fully-lit fantasy turn-based combat screen rendered at widescreen (approximately 16:9). The battlefield occupies roughly 85% of the visible area as a dark stone-tile dungeon floor rendered in 2.5D isometric perspective, converging toward an upper-center vanishing point. Three hero characters occupy the left-center tiles — a Fighter, a blue-robed Stormcaller, and an armored Paladin — with a War Dog companion in the lower-left foreground. Four goblin-type enemies stand on the right side. Active spell effects (lightning arc, fire projectile) are mid-flight. The bottom 18% of the screen is a dark horizontal HUD bar holding five character portrait cards, each with HP/MP bars, a name, class icon, and a row of small spell/skill icons. Top-center hosts a turn-order strip of nine portrait thumbnails with a "Round 1" label in the top-left corner. Right of the HUD cards a floating tooltip card displays a spell description ("Fireball — Columns — Deals 70% INT as Fire damage"). Three utility buttons (gear, layout, share) sit in the bottom-right corner. The overall palette is deep shadow blues, warm candlelit ambers, and fire oranges against near-black vignette edges.

---

## 2. Palette Tokens

Extracted from the reference image. Hex values are representative — exact match will require eyedropper on the source PNG.

```css
:root {
  /* ── Core darks ── */
  --ember-void:      #06030e;   /* near-black background / outer vignette */
  --ember-deep:      #0d0820;   /* card background, main UI surface */
  --ember-pit:       #1a1128;   /* tile shadow / stone grout lines */

  /* ── Stone & ground ── */
  --ember-stone:     #2e2438;   /* mid-value dungeon tile face */
  --ember-slate:     #3d3250;   /* lit tile surface highlight */

  /* ── Gold / UI rim ── */
  --gold-rim:        #c8a020;   /* card border gold stroke */
  --gold-glow:       #f8e890;   /* brightest gold text / active highlights */
  --gold-dim:        #7a6010;   /* inactive / low-contrast gold */

  /* ── Fire / action ── */
  --fire-core:       #ff7020;   /* projectile center, crit text */
  --fire-bloom:      #ffc040;   /* fire aura / spell FX halo */

  /* ── Arcane / lightning ── */
  --arc-blue:        #40a8ff;   /* lightning / mana bar fill */
  --arc-pale:        #a0d8ff;   /* lightning fringe / highlight spark */

  /* ── HP / status ── */
  --hp-green:        #30cc60;   /* HP bar fill */
  --hp-low:          #cc3020;   /* low-HP / enemy HP bar */
  --shield-blue:     #4080e0;   /* shield/block overlay bar */
}
```

---

## 3. Layout Zones

Portrait viewport target: 393×852 (iPhone 14 Pro). Reference image is landscape 1536×1024 — zones are described as proportions so they translate.

```
┌────────────────────────────────────────────────────────┐
│  TURN-STRIP                                            │  ~8% height
│  [portrait][portrait][portrait]…[portrait]  Round N   │
├────────────────────────────────────────────────────────┤
│                                                        │
│                                                        │
│            BATTLEFIELD                                 │  ~72% height
│       (2.5D tile grid + sprites + FX)                  │
│                                                        │
│                                                        │
├──────────────────────────────────┬─────────────────────┤
│                                  │  TOOLTIP-CARD       │  ~20% height
│  HUD-CARD-ROW                    │  (spell description)│
│  [card][card][card][card][card]  ├────────────────────┤
│  name · class · HP/MP · skills   │  UTIL-BUTTONS (3)  │
└──────────────────────────────────┴─────────────────────┘
```

| Zone | CSS top | CSS height | CSS left | CSS width | Notes |
|---|---|---|---|---|---|
| `turn-strip` | 0% | ~8% | 0% | 100% | Scrollable row of portrait chips; Round label far-left |
| `battlefield` | 8% | ~72% | 0% | 100% | Full-bleed; sprites, tile grid, FX layers |
| `hud-card-row` | 80% | ~20% | 0% | ~73% | Horizontal card strip; scrolls on small screens |
| `tooltip-card` | 80% | ~14% | ~73% | ~22% | Slide-in on hover/tap a skill icon |
| `util-buttons` | ~94% | ~6% | ~85% | ~15% | 3 icon buttons (settings, layout, share) |

On **mobile portrait** (393px wide) the tooltip-card collapses to a bottom-sheet and util-buttons move inside the turn-strip right side. The hud-card-row scrolls horizontally. See phase 10 for the mobile-fit pass.

---

## 4. Component Inventory

| # | Name | Role | Approx size | Contents | Needs new asset? |
|---|---|---|---|---|---|
| 1 | **Round label** | Shows current round number | ~64×24px chip | "Round N" text, gold border | No — text only |
| 2 | **Turn-order portrait chip** | Represents one combatant's position in the queue | ~40×40px | Portrait thumbnail, thin border (gold=hero, red=enemy), dead-state dim | Yes — portrait crops from existing class sprites |
| 3 | **Battlefield background** | Dungeon environment art | 100% × ~80% | Parallax BG image, atmospheric vignette | Yes — per-act regen (see §8) |
| 4 | **Tile grid overlay** | 2.5D perspective stone tiles | Full battlefield | CSS/SVG rhombus grid, no interaction yet | No — generated CSS/SVG |
| 5 | **Hero sprite** | Character standing on tile | ~96–128px tall | PNG sprite (existing art), scale-corrected per row depth | No — uses existing sprites |
| 6 | **Enemy sprite** | Enemy standing on tile | ~80–120px tall | PNG sprite (existing enemy art) | No — uses existing sprites |
| 7 | **Companion sprite** | War Dog / companion row | ~80px tall | PNG sprite, own row below heroes | No — uses existing sprites |
| 8 | **Spell FX layer** | Mid-fight particle / projectile | Varies | CSS/canvas animation overlay (existing `spellFx.js`) | No — reuse existing |
| 9 | **HUD character card** | Bottom bar unit card | ~110×96px | Portrait thumb, name, class badge, HP bar, MP bar, 4–6 skill icon buttons | Partial — skill icons (§8) |
| 10 | **HP bar** | Health track | ~90×8px | Filled rect, color-shifts at low HP | No — CSS |
| 11 | **MP bar** | Mana track | ~90×6px | Thinner, blue fill | No — CSS |
| 12 | **Skill icon button** | Tap-to-cast in manual mode | ~28×28px | Icon glyph (SVG placeholder), cooldown overlay, active ring | Yes — placeholder SVGs now; real art later |
| 13 | **Tooltip card** | Spell/skill description | ~200×110px | Skill name, subtitle tag ("Columns"), 2-line description, damage type badge | No — CSS/text |
| 14 | **Util button** | Settings / layout / share | ~36×36px each | SVG icon, rounded rect | No — Font Awesome SVGs |
| 15 | **Turn-order strip rail** | Horizontal chip container | 100% × 52px | All combatant chips + Round label | No — CSS flex |
| 16 | **Card border ornament** | Decorative frame on HUD cards | Per card | Corner SVG diamond motifs, gold stroke | No — inline SVG token |
| 17 | **Status icon row** | Buff/debuff indicators on card | ~14×14px each | Letter glyph, colored circle, superscript duration | No — existing `_renderStatusRow` |
| 18 | **Active-turn highlight** | Glowing ring on current actor | ~sprite-width | CSS box-shadow / keyframe pulse, gold color | No — CSS |
| 19 | **Dead-state overlay** | Desaturated + X on dead unit | Sprite bounds | CSS filter: grayscale + opacity | No — CSS |

---

## 5. Border / Corner-Ornament Study

The HUD cards in the reference image use a **layered SVG border treatment**:

- A rectangular gold stroke (~1.5px, `--gold-rim`) forms the outer rectangle.
- At each corner, a **diamond lozenge** (rotated 45° square, ~8×8px) sits centered on the corner point, filled `--ember-deep` with the same gold stroke. This creates the visual of the border "pinned" at four corners.
- Between the corner diamonds, the edge stroke is broken by a short inset gap (~4px) on each side of the diamond, giving the impression the diamond clasps the border.
- An inner inset shadow (`box-shadow: inset 0 0 12px rgba(0,0,0,0.7)`) darkens the card interior from the edges inward.
- No rounding on the main rectangle — all corners are sharp 90°, with the lozenge overlay providing the decorative terminus.

**Inline SVG example (corner motif, reusable token, ≤30 lines):**

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80">
  <!-- Card border rectangle -->
  <rect x="8" y="8" width="104" height="64"
        fill="none" stroke="#c8a020" stroke-width="1.5"/>
  <!-- Top-left corner diamond -->
  <rect x="4" y="4" width="8" height="8" rx="0"
        fill="#0d0820" stroke="#c8a020" stroke-width="1.5"
        transform="rotate(45 8 8)"/>
  <!-- Top-right corner diamond -->
  <rect x="108" y="4" width="8" height="8" rx="0"
        fill="#0d0820" stroke="#c8a020" stroke-width="1.5"
        transform="rotate(45 112 8)"/>
  <!-- Bottom-left corner diamond -->
  <rect x="4" y="68" width="8" height="8" rx="0"
        fill="#0d0820" stroke="#c8a020" stroke-width="1.5"
        transform="rotate(45 8 72)"/>
  <!-- Bottom-right corner diamond -->
  <rect x="108" y="68" width="8" height="8" rx="0"
        fill="#0d0820" stroke="#c8a020" stroke-width="1.5"
        transform="rotate(45 112 72)"/>
</svg>
```

Phase 07 (svg-borders) will tokenize this into a reusable CSS component and define the gap-break on the stroke segments. The above is a static geometry reference only.

---

## 6. Typography Pairings

The reference image does not embed legible font metadata, but the visual rhythm maps cleanly to the project's existing typefaces:

| Usage | Reference cue | Project font | Size range | Weight | Treatment |
|---|---|---|---|---|---|
| Round label ("Round 1") | Compact serif caps, high tracking | `Cinzel` | 11–13px | 600 | `letter-spacing: 0.2em; text-transform: uppercase` |
| Character name on HUD card | Slightly larger, readable serif | `Cinzel` | 12–14px | 700 | Normal case, tight tracking |
| HP/MP value numerals | Tabular, utilitarian | `Crimson Text` or system monospace | 10–11px | 400 | `font-variant-numeric: tabular-nums` |
| Spell name in tooltip | Prominent display serif | `Cinzel` | 14–16px | 700 | Normal case |
| Spell subtitle tag ("Columns") | Small-caps label | `Cinzel` | 9–10px | 400 | `letter-spacing: 0.15em; opacity: 0.7` |
| Spell description body | Readable italic serif | `Crimson Text` | 12–13px | 400 | `font-style: italic` |
| Damage type badge | Tight caps | `Cinzel` | 9px | 600 | Colored per damage type |
| Class badge on card | Single-word label | `Cinzel` | 9px | 400 | `text-transform: uppercase; opacity: 0.6` |

Both fonts (`Cinzel`, `Crimson Text`) are confirmed loaded in the existing project. No new font imports needed.

---

## 7. 2.5D Grid Read

**Perspective analysis from the reference image:**

- **Vanishing point:** upper-center of the battlefield, approximately at 50% horizontal and 15% from the top of the battlefield zone (i.e., ~23% from the top of the full screen).
- **Grid depth:** **6 rows** front-to-back (rows 0–5; row 0 = back enemies, row 5 = front companion line). _Reconciled 2026-04-30 per Phase-12 roast §3 — original "approximately 5 rows" undercounted the companion row._
- **Grid width:** **6 columns** left-to-right (cols 0–5; cols 0–2 hero side, cols 3–5 enemy side). _Reconciled 2026-04-30 per Phase-12 roast — original "approximately 8 columns" was a first-glance estimate; the user-approved Phase 4 amendment (post Act-1 BG review) ships 6 cols and the post-roast Phase 10 update aligns mobile to the same 6 cols._
- **Tile shape:** rhombus/parallelogram. Each tile is wider than it is tall (~2:1 width-to-height ratio on screen). The front-face is the primary visible surface; no vertical face shown (pure top-down foreshortening, not true isometric).
- **Hero zone:** left ~3 columns × 2 rows (rows 3–4 from front). Three hero sprites occupy one tile each; War Dog is row 4 col 1 (lower-left foreground, companion row is in front of the main hero line).
- **Enemy zone:** right ~3 columns × 3 rows (rows 2–4 from front). Four enemies fill a loose cluster.
- **Tile scale:** front-row tiles appear largest; each row back reduces tile screen-height by approximately 15%, consistent with a simple linear perspective approximation (not true mathematical projection).
- **Ground/sky split:** approximately 80% ground tiles, 20% upper atmospheric band (vaulted ceiling / cave darkness). This matches the README spec ("80% ground / 20% top").
- **Implementation note for phase 04:** A CSS transform-based perspective grid using `rotateX` on a flat tile grid element is the likely approach. Each "row" is a flex row of rhombus tiles, with `transform-origin: top center` driving the convergence. The companion row should be a distinct DOM row below the hero row, so it can be independently positioned and later support movement.

---

## 8. Asset Replacement Queue

These are "make real later" slots. SVG placeholders ship first; real art replaces them when the user approves a generation batch.

| # | Filename slot | Approx dimensions | Prompt description (SpriteCook / OpenAI) |
|---|---|---|---|
| 1 | `public/images/combat_bg/dungeon_stone_act1.png` | 1536×1024 | Dark fantasy dungeon interior, stone-tile floor in 2.5D isometric perspective, candlelit amber torches at edges, deep shadow vignette, 80% floor / 20% vaulted cave ceiling, cinematic lighting, no characters |
| 2 | `public/images/combat_bg/dungeon_stone_act2.png` | 1536×1024 | Overgrown ruins dungeon, mossy stone tiles in 2.5D perspective, green bioluminescent fungi, damp walls, deep shadow, 80% floor / 20% collapsed ceiling opening to night sky |
| 3 | `public/images/combat_bg/dungeon_stone_act3.png` | 1536×1024 | Volcanic dungeon, cracked obsidian tiles in 2.5D perspective, lava glow from crevices, ember particles floating, 80% floor / 20% sulfurous smoke ceiling |
| 4 | `public/images/combat_bg/dungeon_stone_act4.png` | 1536×1024 | Cursed crypt, bone-inlaid stone floor in 2.5D perspective, purple necrotic energy wisps, 80% floor / 20% fractured ceiling with void glimpse |
| 5 | `public/images/combat_bg/dungeon_stone_act5.png` | 1536×1024 | Hellfire breach, scorched tile floor in 2.5D perspective, rivers of fire at edges, billowing red smoke ceiling, 80/20 split |
| 6 | `public/images/skill_icons/attack_melee.svg` | 32×32 | SVG placeholder: crossed swords glyph, gold stroke on dark fill |
| 7 | `public/images/skill_icons/attack_ranged.svg` | 32×32 | SVG placeholder: arrow glyph, amber stroke |
| 8 | `public/images/skill_icons/spell_fire.svg` | 32×32 | SVG placeholder: flame glyph, orange-red stroke |
| 9 | `public/images/skill_icons/spell_lightning.svg` | 32×32 | SVG placeholder: lightning bolt glyph, blue-white stroke |
| 10 | `public/images/skill_icons/spell_heal.svg` | 32×32 | SVG placeholder: cross / radiant burst glyph, green stroke |
| 11 | `public/images/skill_icons/spell_aoe.svg` | 32×32 | SVG placeholder: concentric ring glyph, purple stroke |
| 12 | `public/images/skill_icons/defend.svg` | 32×32 | SVG placeholder: shield glyph, silver-blue stroke |
| 13 | `public/images/skill_icons/item_use.svg` | 32×32 | SVG placeholder: flask/potion glyph, amber stroke |
| 14 | `public/images/portraits/turn_chip_fallback.svg` | 40×40 | SVG placeholder: silhouette bust in circle, used when portrait PNG unavailable in turn strip |
| 15 | `public/images/ui/card_border_corner.svg` | 24×24 | Final vector art: diamond corner ornament with gold stroke, transparent fill, matches card border system from phase 07 |

Combat backgrounds (items 1–5) are OpenAI `gpt-image-2` jobs. Skill icons (items 6–13) are inline SVG authored in phase 08. Portrait chip fallback (item 14) and card corner (item 15) are phase 07 deliverables.

---

## 9. Open Questions for Downstream Phases

1. **Turn-strip mobile collapse (phase 10):** Does the turn-order strip run above the battlefield on mobile portrait (eating ~52px of the already-constrained 852px), or does it collapse to a "Next up: X" single-chip indicator with an expand toggle? The reference image is landscape so this is unresolved.

2. **Companion row DOM placement (phase 04):** The War Dog sits in front of the hero row. Is the companion row a separate grid row beneath heroes, or is it a separate positional layer overlaid on the grid? Phase 04 must lock this before the grid math is specced.

3. **Scroll behavior of hud-card-row (phase 06):** The reference shows 5 cards fitting comfortably in landscape. At 393px width with 5 characters + companion, cards at ~72px each would be ~430px — overflow. Does the row scroll with snap-to-card, or does it compress cards to fit? User preference: "Card row scrolls when screen too small; prefer 1 row on desktop."

4. **Tooltip card placement on mobile (phase 09):** On desktop, the tooltip floats right of the HUD rail. On mobile portrait there is no right-side gutter. Bottom sheet slide-up seems correct but needs confirmation from the UX agent.

5. **Turn-chip portrait source (phase 01 / phase 06):** The turn-order chips need square portrait crops. Existing hero sprites are full-body. Determine if portrait images (used on HUD cards today) can double as chip source, or if head-crop sub-images need to be generated.

6. **Tile grid interactivity gating (phase 02):** No positional movement in scope now, but the tile grid must support future positional selection. Phase 02 (manual mode design) should declare whether tile click/tap events are wired but ignored in v1, or completely absent.

7. **Skill rail slot count per class (phase 06):** The reference shows approximately 5–6 icons per card. Classes have variable skill counts. Phase 06 must decide: fixed N slots with empty-state for classes with fewer skills, or variable width cards?

8. **Active-turn highlight on the battlefield (phase 04):** The reference shows a subtle glow ring beneath the active character's sprite. Is this a CSS drop-shadow on the sprite element, a separate tile-layer pseudo-element, or a canvas effect? Phase 04 resolves.

9. **Enemy HP bar display (phase 01 audit):** Thin red bars are visible above enemy sprites. These are presumably already in the CombatScreen. Phase 01 should confirm they exist in DOM form (not canvas) so they survive the grid refactor.

10. **Util buttons content (phase 03):** The reference shows three bottom-right buttons. Two appear to be settings and layout; the third is unclear. Phase 03 (IA/screen states) should define what these do in manual vs auto mode.

---

## Handoff to Phase 1

**5 facts the current-state auditor must carry forward:**

1. **Palette anchor:** `--ember-deep: #0d0820` is the card/surface base; `--gold-rim: #c8a020` is the universal border stroke. All new component CSS should reference these tokens — do not hardcode equivalent hex values.

2. **HUD structure today:** `CombatScreen.js` renders `#cbt-hud` with `.hud-members` (a flat flex row of `.hm` mini-cards) and `.hud-right` (round counter + speed/pause controls). There is no spell rail, no turn-order strip, and no tooltip card. These are net-new DOM regions.

3. **Turn order exists in data, not DOM:** `this._turnOrder` is computed at `CombatScreen.js:661` but is never visualized as a top-strip. Phase 01 must confirm the data shape (array of combatant objects with id, side, hp, portrait ref) to inform the turn-strip render spec.

4. **2.5D grid is entirely absent:** The battlefield is currently a full-bleed background image (parallax) with absolutely-positioned sprite elements. No tile grid exists. Phase 04 is a greenfield build; phase 01 should only note the current sprite positioning approach so phase 04 can plan the migration.

5. **Skill icons are phase 08 placeholders first:** The asset replacement queue (§8, items 6–13) defines SVG placeholders for all skill icon slots. Phase 08 authors these SVGs. Phase 06 (card-rail spec) must design the icon button assuming a 32×32 SVG source — do not assume PNG or canvas-drawn icons.
