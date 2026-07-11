# Phase 12 — Senior Reviewer Roast

**Author:** code-reviewer agent
**Date:** 2026-04-29
**Reads:** every file in `phases/00..10`, `assets/backgrounds/index.md`, the reference image, and spot-checks against `src/ui/screens/CombatScreen.js`.
**Tone:** the user explicitly asked for candid. No padding.

---

## 1. Executive verdict

The plan is **implementable**, but it is not implementation-ready as written. The game-loop core (phase 02) and the audit (phase 01) are excellent — those two could be handed to a developer today and produce working code. Everything downstream of phase 03 has the opposite problem: it is **over-specified prose with unspecified contracts at the seams**. Phases 04, 06, 09, and 10 each redesign the same entities (combatant, spell rail state, tooltip kinds, mobile breakpoint) without a single shared types file, and their named values disagree (6 cols vs 8 cols, 700px breakpoint vs 768px desktop floor in phase 04, three util buttons vs one hamburger). Phase 11 (slides) isn't written yet, so this roast is technically reviewing an 11/12 tree. The biggest single risk is that phases 04 and 10 booked **mutually exclusive** grid decisions and nobody flagged it (§3 below). Fix the contradictions, lock the contracts, and M387 can start. Don't fix them and the implementation milestone will spend half its budget arguing with the spec.

---

## 2. Architectural roast

The plan repeatedly hand-waves how three or four phases compose at a single touchpoint. The worst offenders:

**A. The combatant object is redefined in every phase, never canonicalized.**

- Phase 01 §2 says `_memberToCombatant()` already builds it and "minor changes only (add `isPlayerControlled` flag)."
- Phase 02 §6 adds `isPlayerControlled` as a derived const, not a stored field.
- Phase 04 §10 adds `gridPos`, `gridPosTarget`, `gridPosLerp`, `pendingTurns` (which actually originated in phase 02 §5b — also re-described here).
- Phase 06 §2 invents `character.classSvgIcon`, `character.skillCooldowns`, and reads `character.equipment.weapon.damageType` as if they exist on the combatant snapshot. They do **not** — `_memberToCombatant` (`CombatScreen.js:386–541` per phase 01) doesn't carry equipment refs forward; it folds equipment into stat aggregates and discards the slot graph.
- Phase 06 §11 then casually says portraits and battlefield sprites "share the same source URL" but no phase actually defines `character.portraitUrl` vs `character.spriteUrl` precedence. Phase 01 §2 lists the sprite cache as reusable but says nothing about portrait URLs.

**Owner for the fix:** phase 01 should publish a single `combatant.d.ts`-equivalent table and every other phase must reference fields by that name. Don't ship M387 without it.

**B. `_awaitingInput` vs `_turnTimer` vs `_executeTurn` — does the freeze actually compose with the existing `update(dt)`?**

I spot-checked this. `update(dt)` at `CombatScreen.js:2369` is more crowded than phase 01 represented:

- Lines 2380–2429 advance particles, floating numbers, tap-effects, and flash timers. **None of those are gated by phase state.**
- The phase gate is at 2435–2441: `if (this._phase !== 'PLAYING') return; if (this._speedMult === 0) return; this._turnTimer += dt; if (...) return; this._turnTimer = 0; this._executeTurn();`

Phase 02 §3 proposes to insert `if (this._awaitingInput) return;` "before incrementing `_turnTimer`." That works for the turn loop but it **also stops particles, flashes, and floating damage numbers** unless the guard goes inline at 2438 specifically. The phase doesn't say which. If the guard is too high, the resolving-state damage numbers freeze mid-flight while the player thinks. Place the guard at line 2438 only.

Also: phase 02 §9 says "TURN_SPEED is irrelevant to the player's action cadence." But `this._turnTimer` is not reset before entering AWAITING-INPUT — only after dispatch (`RESOLVING → IDLE`). If the player thinks for 30s and then taps, `_turnTimer` is still 0 from the last reset. Fine. But if the dispatch happens to fire mid-tick (which is possible — the player tap is a synchronous JS event, the next `update(dt)` runs after rAF), then `_turnTimer` could already be partially accumulated when the player input lands. Phase 02 doesn't specify whether `_turnTimer` is reset on `_awaitingInput` clear. **It must be**, otherwise the next AI actor turn fires too early.

**C. Phase 04's grid layer is `<svg>` + `<img>` DOM but the existing scene is canvas.**

Phase 01 §6 documents that the battlefield is drawn on `manager.canvas` via `draw(ctx)`. Phase 04 §1 says "Canvas is eliminated from the battlefield entirely." Phase 04 §11 places the SVG/sprite/FX layers inside `.ev-battlefield`. **Phase 04 never specifies what happens to the canvas.** Is `manager.canvas` deleted? Hidden? Repurposed for spellFx particles only? Phase 01 §3c says `draw(ctx)`'s "background, particles, sprites, floating numbers" stay. Phase 04 says they don't. This is a direct contradiction.

The realistic answer is "spellFx and particle systems stay on the canvas, sprites move to DOM" — but neither phase says so, and the spellFx integration claim in phase 04's "FX layer" handwave (`.ev-fx-layer`) is doing all the work. Spell FX today are canvas-rendered (`spellFx.js`); rebuilding them in CSS is a nontrivial port that phase 04 implicitly assumes.

**Owner for the fix:** phase 04 must explicitly state which layers stay canvas-rendered, which migrate to DOM, and what `draw(ctx)` becomes after the cut. Without it, M387 will hit a fork in week one.

**D. Targeting flow is owned by both phase 04 and phase 06 — and they pass events in a circle.**

- Phase 04 §12 dispatches `ev:target-select` from the grid.
- Phase 06 §6 dispatches `ev:targeting-start` from the rail to the grid, then expects `ev:target-select` back, then dispatches `ev:spell-pick`.
- Phase 06 §6 says "Phase 04's `activateTargeting()` listens for this event OR is called directly. Phase 06 may call it directly (preferred — avoids event bus ambiguity)" — i.e., the architect couldn't decide between events and direct calls and wrote both into the spec. Pick one.

This is the single most likely place the implementation will accidentally enter an inconsistent state during AOE confirm or cancel.

---

## 3. Contract drift

Real contradictions, not nitpicks:

1. **Grid columns: 6 vs 8.** Phase 04 §2 was tightened from 8 → 6 columns after the Act-1 BG review (the comment is in the source — "was 8 — tightened post Act-1 BG review"). Phase 04 §4 still defines `HERO_COL_RANGE = { start: 0, count: 4 }; ENEMY_COL_RANGE = { start: 4, count: 4 }` — that's 8 columns. The §2 number was edited; §4 wasn't. Pick one and propagate. **Owner: phase 04.**

2. **Grid columns again: phase 10 §2 defaulted to 8.** Phase 10 says "Decision: Keep 5 rows × 8 columns" and explicitly rejects "6 columns (drop outer columns)" as "Not recommended." But phase 04 already adopted 6 columns. Phase 10 is overriding phase 04 without acknowledging it. **Owner: phase 10 must re-do its battlefield math against 6×6, not 5×8.** All the tile dimensions in phase 10 §2 are wrong as a consequence.

3. **Rows: 5 or 6?** Phase 00 §7 says "approximately 5 rows visible." Phase 04 §2 uses `ROWS = 6`. Phase 10 §2 says "5 rows × 8 columns." Phase 04 is the math-of-record; phase 10 and phase 00 say 5. Three documents, three different numbers. **Owner: phase 04 is correct; update 00 and 10.**

4. **Mobile breakpoint: 700px vs 768px.** Phase 06 §7 says `@media (max-width: 700px)` is the mobile threshold. Phase 04 §8 says `>=768px wide` is the desktop bracket. Between 700 and 767 nothing is defined. **Owner: phase 06 (it's quoted by phase 10 §3).**

5. **Util buttons.** Phase 00 §4 enumerates three util buttons (settings, layout, share). Phase 03 §6 rule 10 says "all three must be present in non-terminal non-overlay states." Phase 06 §11 punts on the third button identity. Phase 10 §10 collapses the entire util set into a single hamburger menu. So on mobile there is one button, on desktop there are three, and one of the three is unspecified. Phase 03 should NOT be specifying "three util buttons present in all states" if mobile drops them to one — that's a state-machine lie.

6. **`combatMode` vs `manualCombat`.** Phase 02 §10 admits it doesn't know whether `gs.manualCombat` is persisted or runtime, and tells the implementer to "audit." This is design-time information. Spot-check: `gs.manualCombat` is checked at `CombatScreen.js:2585` — the audit would take 10 minutes. Don't ship a phase doc with "audit later" in §10. **Owner: phase 02 should resolve this before approval.**

7. **Skip vs Wait.** Phase 02 §8 raises Wait as "to confirm or cut." Phase 03 §1 ships Wait as state #22 (`WAIT_REINSERT`). Phase 06 §3 doesn't list a Wait button on the spell rail — only Skip. Phase 10 §11 says "No explicit Skip Turn button on mobile portrait." So Wait exists in the IA layer but has no button surface in either desktop or mobile. **Owner: phase 06 must wire Wait or phase 03 must drop the state.**

8. **Three poses, seven poses, sprite vs portrait.** Phase 06 §11 says portraits are `object-fit: cover; object-position: top center` of the sprite file. CLAUDE.md and the SpriteCook pipeline say there are 7 canonical poses per character. Which pose URL ends up in `character.portraitUrl`? "Idle"? Phase 06 doesn't say. The `top center` crop on a full-body sprite produces a head, which is fine, but only if the pose chosen has the head where you expect. **Owner: phase 06 §11 should specify "idle pose, top-center crop."**

9. **Spell-icon damage-type taxonomy.** Phase 08 §2 invents `damageType` as a sub-field on skills with values `'fire' | 'lightning' | 'holy' | 'shadow' | 'arcane' | 'physical'`, then admits "the skills data does not carry a damageType sub-field on every skill — damage sub-type is implied by the skill name." The doc proposes "either add a `damageType` field to skill schema… or read it from a lookup map." So the spell-icon system requires a schema change to `skills.js` that no other phase mentions. **Owner: phase 08, or move it to phase 01's "will-need-refactor" list.**

10. **Background generation status.** Phase 05 §5 says "Endpoint: OpenAI gpt-image-2; Fall back to gpt-image-1.5." `assets/backgrounds/index.md` records that the backgrounds were actually generated on `gpt-image-1.5`. Not a blocker, but the spec and the receipts disagree, and both should match. **Owner: phase 05 should be updated to reflect what was actually used.**

---

## 4. Missing in scope — trace against the user's 17 confirmed answers

The README §"User-confirmed answers" lists 17 items. Tracing each:

| # | Answer | Owned by |
|---|---|---|
| 1 | Planning only | README — fine |
| 2 | Agent count flexes for thoroughness | not actionable |
| 3 | Slideshow at end | **phase 11 — not written yet** |
| 4 | Prescriptive UI matching reference | phases 00, 06, 07 — fine |
| 5 | Companions in their own row, flexible row control | phase 04 §5 — fine |
| 6 | Turn order added; mobile may collapse | phase 06 §9, phase 10 §3 — fine |
| 7 | Card row scrolls when small | phase 06 §7 — fine |
| 8 | Match existing combat formulas; consolidate multi-attack | phase 02 §5 — fine |
| 9 | No movement yet, plan for it | phase 04 §10 — fine |
| 10 | Companions auto-play in manual | phase 02 §6 — fine |
| 11 | Items are free actions | phase 02 §2, phase 06 §5 — fine |
| 12 | Generate test BGs + perspective mockup | phase 05 + `assets/backgrounds/grid-mockup.html` — fine |
| 13 | Per-act regen rollout, archive originals | phase 05 §6 — fine |
| 14 | Refactor for cleanest possible system | phase 01 §3 — fine |
| 15 | Tree separate from wishlist until approved | README — fine |
| 16 | Served via release server (5247), no GH | needs verification — slides path `/plan/slides/` is not yet routed in `release_server/serve.js` (no phase explicitly OWNS this) |
| 17 | Roast tone | this document |

**Real misses:**

- **Item #16 — release server routing for `/plan/`.** No phase claims ownership. The README says "this tree renders as a navigable site at `/plan/`," but nothing in phases 00–10 specifies how. **Owner: should be phase 11.**
- **Item #3 — phase 11 (slides) is not in the tree.** The user explicitly asked for a slideshow at the end. The roast pass (this document) is being written before the slideshow exists. That's an out-of-order delivery and the slideshow agent will be working from this roast, which is wrong way around.
- **Hardcore lock follow-through.** Phase 02 §1 says hardcore locks combatMode to manual and the toggle is hidden. Phase 03 §8 spec'd a visual "locked but visible" treatment. Two different decisions for the same thing — does the toggle render or not? **Owner: phase 03 is wrong; phase 02 is right (per user's "Hardcore locks to manual," not "Hardcore shows a lock icon next to the toggle").**
- **Combat replay regression test.** Phase 01 §8 mentions "M394 review + QA pass: combat replay regression against old formulas." Nothing in phases 02 or 04 actually identifies the test fixture, regression dataset, or pass criteria. **Owner: should be phase 12 or a new phase 13 (test plan).**

---

## 5. Implementation traps — concrete bites for M387+

1. **`_executeTurn` extra-attack splice (`CombatScreen.js:2549, 2559`).** Phase 02 §5 proposes guarding both splice-backs with `if (!this._isManualHero(actor)) { ... splice ... }` and replacing them with `_drainExtraAttacks()` for manual heroes. Two issues:
   - The guard introduces an asymmetry between auto and manual. Auto heroes will still re-enter `_heroAI` (which itself might re-trigger `gs.manualCombat` if the player toggles mid-combat — see phase 03 §7's `pendingModeChange`). Concrete bug: player toggles to manual mid-round, an extra-action splice fires for a hero who already acted under auto, that hero now hits the manual gate and demands a prompt. Phase 02 §5 doesn't address this.
   - `_drainExtraAttacks` calls `_basicAttack` directly to skip the `_heroAI` re-entry. But phase 02 didn't audit that `_heroAI` does more than pick an action — it also runs `combatDebug.push('ai_decision', ...)` (`CombatScreen.js:2592`). Skipping `_heroAI` means M377 telemetry stops recording extra-attack actions. Acceptable, but document it.

2. **The companion gate at `:2585` — phase 02 says it's "correct as-is."** It is, but phase 02 §6 also notes the `partyMember` lookup fragility at `:2575`. The proposed fix (introduce `isPlayerControlled` const) is sound but phase 02 doesn't grep for other call sites that depend on the same lookup. There are at least two: `_heroAI` itself uses `partyMember` at lines beyond the gate (for skill cooldown lookups, MP deduction), and `_openManualActionPanel(actor, partyMember, ...)` is called with partyMember as an arg. The replacement `_pauseForPlayerInput(actor)` drops the partyMember arg per phase 02 §3 — which is fine, but the eventual handler will need it again to read `partyMember.skills`. Phase 06 §3 reads from `character.skills` and assumes that's populated on the combatant, not on the partyMember. **Spot-check this in `_memberToCombatant`** — if `skills` doesn't survive the snapshot, phase 06's spell rail has nothing to render.

3. **`_speedMult = 0` coupling.** Phase 01 §7 flagged this: today's manual panel restores `_speedMult` to `prevSpeed` on dismiss. Phase 02 §3 just freezes `_turnTimer` instead. But phase 02 doesn't touch `_speedMult` — meaning if the player had `_speedMult = 4` (4× speed) before manual mode, they'll keep it. Companions and enemies will resolve at 4× speed between player turns. Phase 02 §9 hand-waves this as "intentional — the wait is the player's own decision time, not AI wait time" but the user's expectation is unclear. **Recommend: in manual mode, clamp `_speedMult` to 1.0 unless the player explicitly chose otherwise.**

4. **Resize observer chain in phase 04 §9.** The `ResizeObserver` on `.ev-battlefield` recomputes layout, and phase 04 §11 says `.ev-sprite-layer` has `pointer-events: none` so clicks fall through to SVG. But during animations (CSS attack-lunge transforms per phase 04 §11), the sprite may be temporarily transformed off its tile. If the player taps during the animation, the click falls through to the SVG polygon under the sprite's *current* tile, not the *visual* sprite location. Probably fine because targeting is mostly disabled during RESOLVING, but worth a regression test on the AOE confirm step where the rail is hot but sprites may be settling.

5. **`_drainExtraAttacks` with `_pulseExtraAttack` CSS — phase 02 §5.** Phase 02 says `_pulseExtraAttack(actor)` is a 100ms scale bounce. In a `while` loop with `actor.extraAction = 3`, this fires 3 CSS class toggles in synchronous JS. The browser will only paint the final state. Either the loop must `await` between iterations (introducing async into a "synchronous" `_executeTurn`) or the bounces must be staggered via animation timing (use 3 sequential keyframes, not 3 class toggles). Phase 02 doesn't say. **Owner: phase 02 §5 needs to specify the timing model.** This is the kind of thing that ships looking janky.

6. **`updateCardRail()` reads `parseFloat(hpBar.style.width)` to dirty-check (phase 06 §10).** This is fragile — `style.width` returns "0%" if unset, and `parseFloat` of "0%" is 0 which compares equal to `0` even though the bar was never set. Use a numeric data attribute or compare against a JS-tracked previous value. Trivial fix, but it's the kind of detail that produces "the bar never updates the first time" bugs in QA.

7. **Phase 06 §3 fixed slot order assumes `character.skills.length` is fixed for the fight.** Phase 06 §10 says "level-up during combat is impossible." That's true today, but phase 02 §11 edge case 11 (companion dies) and phase 03 §1 state #23 (`ERROR_SPELL_LOAD`) imply skills can disappear mid-fight (silence, error). The rail should never unmount slots — phase 06 §10 says the same — but the dirty-check pattern in §10 only tracks per-character `skills` count change. If silence is a render-time class on existing slots (phase 06 §4), this is fine. Just confirm the rail never re-renders the `<button>` elements.

---

## 6. Mobile assumptions to challenge — top 5 of phase 10's 12

Phase 10 §"Handoff" listed 12 assumptions. Picking the load-bearing ones:

**Assumption 1: 393×852 is the only mobile target.** Wrong-sized constraint. The user's CLAUDE.md says iPhone 14 Pro is the *primary* target — not the only one. Galaxy A-series is 360×800 (smaller in both axes), and the 393px math in phase 10 will overflow at 360px. The 8-column grid with `TILE_BASE_W = 49.125px` becomes `TILE_BASE_W = 45px` at 360px — still fits, but the spell rail's "8 buttons × 44px = 352px" math (phase 10 §5) **overflows at 360px** (only 344 usable after padding). Spell rail wrap is asserted but the overflow case isn't actually tested. **Recommend phase 10 design for 360×640 as the floor, not 393×852.**

**Assumption 2: Touch-swipe pan is acceptable for grid visibility.** This is wrong by the user's own previous direction. The user requested "battle grid must support flexible row control" (README answer #5). Forcing the player to swipe to see the right half of the grid means they cannot see who they're targeting at full grid AOE. AOE confirm shows "all enemies highlighted" but the player can only see 4 of them. Either: (a) shrink the grid so all 6 columns fit (forces phase 10 to redo §2), or (b) swipe is only for inspection, never for targeting. **Recommend (a) — go to 6 cols, fit at 393px, drop the swipe.**

**Assumption 4: Expanded turn-strip overlay does NOT auto-dismiss on actor change.** This will feel terrible. Players will forget the strip is open, cast a spell, and the strip is still on top of the battlefield occluding the spell FX. **Auto-dismiss on next `_executeTurn()`. One line fix; do it.**

**Assumption 6: Spell icon buttons are 44×44 on mobile (padded from 24×24 icon).** Combined with §5 "8 buttons × 44 = 352px" — at 360px viewport with 8px side padding (377px – 16 = 361 internal) this is one pixel over budget. Wrap-to-second-row is the documented escape, but phase 10 says "fits with 12px gutter" assuming 393px. **Real answer: cap spell rail at 6 buttons mobile (Basic + 4 skills + Item) and surface skip/flee in the top menu.** Or just fix the math.

**Assumption 8: Back-row tile hit zones are expanded SVG polygons.** Phase 10 §9 proposes a duplicate transparent polygon layered over the visible tile. This breaks phase 04's accessibility claim that polygons get `aria-label="Target: Goblin Archer"` — now there are two polygons, both pointer-events on, and the screen-reader hits both. Either: (a) only the expanded polygon is interactive and labeled, the visible one is decorative; or (b) drop the duplicate-polygon model and pad the visible polygon at compute time. **Recommend (b) — single polygon, runtime padding.** Phase 04 owns the math, phase 10 owns the trigger.

---

## 7. BG / asset risk

The user's request was "3 variants per act = 18 total" backgrounds, per the prompt brief. Phase 05 §3 specs **6 backgrounds** (one per act), and `assets/backgrounds/index.md` ships exactly 6 PNGs. The 3-variant request is **silently shelved**. This is a NO-SILENT-SHELVING violation. The plan should either (a) do all 18 and document it, or (b) explicitly note "deferring 12 of the 18 variant images, decided one-per-act for v1, user confirms?" Neither is done. **Owner: phase 05 must surface this.**

Even at 6: maintainability cost is underestimated. `assets/backgrounds/index.md` has Act 4 marked "ship + runtime tint via `filter: brightness(0.55) saturate(1.1)`" and Act 5 marked "re-roll recommended (~$0.04)." The runtime-tint workaround is fine for v1 but introduces a per-act CSS rule that future BGs must remember to remove. The catalog entry rule (phase 05 §6) doesn't mention recording the per-act `filter` override. If 18 variants ship later, the variant→encounter mapping becomes a real schema and phase 05's "filename pattern `act-N-biome.jpg`" doesn't have room for it. **Add a `variant: "default" | "alt1" | "alt2"` field to the catalog entry now**, even if only one variant ships; it's free.

Archive flow risk: phase 05 §6 uses `mkdir -p _archived-$(date +%Y-%m-%d)` then `mv *.jpg`. If the script runs twice in the same day and the first run already moved the originals into `_archived-2026-04-30/`, the second run's `find ... -maxdepth 1 -name '*.jpg' -exec mv {} _archived-2026-04-30/` will silently no-op (no files to move) — fine — **but** if the first run moved files and the second run regenerated new files, the new files get moved into the archive on the third run and the directory ends up empty. Not a hypothetical; this is a classic shell-flow trap. Use a numbered archive (`_archived-N`) or an explicit migration log. **Owner: phase 05 §6.**

---

## 8. Spec-to-shipping ratio

Total phase doc word count: ~13,000 lines of markdown across 11 files. (Spot count: 5,866 lines for phases 02–06, the load-bearing five.) Conservative estimate: 30–40k words.

By M390 (the loop-pause player-input model lands), realistic spec staleness:

| Doc | Stale-by-M390? | Why | Lock or edit? |
|---|---|---|---|
| Phase 00 | Mostly stable | Reference image deconstruction | **Lock** — historical reference |
| Phase 01 | Stable | Audit of pre-overhaul code | **Lock after first read** — used as starting point only |
| Phase 02 | Will drift | Loop changes will surface real bugs | **Edit** — keep as living doc until M390 ships |
| Phase 03 | Will drift hard | 25 states × 2 viewports × 2 modes = many never-implemented permutations | **Edit then lock at M390**; archive states that didn't ship |
| Phase 04 | Will drift | Grid math will adjust during M387 | **Edit** until M387 ships, then lock |
| Phase 05 | Done | BGs already generated | **Lock** |
| Phase 06 | Will drift | Card rail composition will reveal contract gaps | **Edit** until M389 ships |
| Phase 07 | Mostly stable | Pure visual tokens | **Lock** |
| Phase 08 | Stable | Icon set is decoupled | **Lock** after the schema change in §2 lands |
| Phase 09 | Will drift | Tooltips are always the last thing finalized | **Edit** until M392 |
| Phase 10 | Will drift hard | Mobile fit is currently broken (see §3 above) | **Edit until correct, then lock** |
| Phase 11 | Doesn't exist | n/a | **Write it** |

Recommendation: **lock 00, 01, 05, 07, 08 immediately**. Treat the rest as living until their corresponding milestone ships. After each milestone, write a short "what shipped vs what was specced" delta and append it to the relevant phase doc — don't rewrite the original. That preserves the design history without producing the situation phase 02 §10 created (a parenthetical "audit later" that nobody audited).

---

## 9. Top 5 action items before M387 starts

Ranked by impact:

1. **Resolve the 6-vs-8-cols / 5-vs-6-rows contradiction across phases 00, 04, 10.** Owner: phase 04. Effort: 30 min. Without this, phase 10's mobile math is wrong and the implementer gets two different specs in one hour.

2. **Publish a single canonical combatant type definition** (markdown table fine, TypeScript-style ideal). Owner: phase 01. Effort: 1 hour. Phases 02, 04, 06 all reference fields that may or may not exist on the combatant snapshot — pin them down before code touches them.

3. **Pick events vs direct calls for the targeting flow** (phase 04 ↔ phase 06). Owner: phase 06. Effort: 30 min. Currently both options are written into the spec; the implementer will pick wrong half the time. Decision: **direct calls** (`activateTargeting(...)` / `deactivateTargeting()`) — events are only for grid → rail (`ev:target-select`).

4. **Spike `_drainExtraAttacks` with the actual `CombatScreen.js:2549/2559` splice paths** to confirm the manual-mode guard works without breaking auto-mode haste. Owner: game-developer. Effort: 1 hour, throwaway code. This is the highest-risk piece of game-loop code in the entire overhaul; verify it composes before M390 starts.

5. **Resolve `gs.manualCombat` persistence question** (phase 02 §10 open). Owner: phase 02. Effort: 10 min — grep the codebase. Without this, the save schema migration in phase 02 §10 either is or isn't needed and the doc says "find out later."

(Sixth, free: write phase 11 before the slides agent is dispatched.)

---

## 10. Things you'd NOT change

The roast doesn't get to skip the fair-witness section.

1. **Phase 01's audit is excellent.** It cites file:line on every claim, identifies real refactor surface area without being prescriptive, and the "Reusable Subsystems" table (§2) is the right shape for a downstream developer to plan against. The `_heroAI` companion gate analysis at `:2585` and the parry-recursion-guard note at `:3949` are the kinds of things audits usually miss.

2. **Phase 02 §5b's `pendingTurns` extension hook for future bonus-turn.** This is exactly the right way to land a feature now (consolidate multi-attack to one turn) without painting over the "bonus turn" socket later. It's a 1-field addition that costs nothing today and saves a refactor in M395+.

3. **Phase 04's decision to drop canvas for sprites and use SVG polygons for hit zones.** Phase 04 §1 justifies it well: target hit zones cannot be sprite bounding boxes on a 2.5D grid; SVG polygons are the only clean answer. Plus the accessibility win (native `role="button"`, `tabindex`, keyboard nav) is real and free.

4. **Phase 05's archive-first regen strategy.** Even if §6's bash flow has the dated-folder bug noted in §7, the principle (move originals, generate fresh, document in `assets.json`) is right. The 80/20 rule is also a smart constraint that other game projects could borrow.

5. **The decision to keep formulas.js untouched.** Phase 01 §2 and phase 02 throughout commit to "all combat math stays exactly as-is." This is the single biggest risk-reducer in the overhaul. If formulas had been redesigned alongside the UI, regression risk would be 5× higher and combat-replay parity would be impossible to verify.

---

## What the slideshow should NOT skip

The phase 11 agent will be tempted to focus on the pretty parts (reference image, palette, mockup) and gloss over the load-bearing pieces. Make sure the slides include:

1. **The actual `_executeTurn` change** — code-level diff or pseudo-diff showing the `_pauseForPlayerInput` insertion at `:2585` and the `_drainExtraAttacks` replacement at `:2549/2559`. Without this slide, every developer audience asks "but what does the loop change look like" and the deck has no answer.

2. **The 6×6 grid math result table** (phase 04 §2 first table — "Key numbers at 1280px wide"). Numbers persuade where prose doesn't. Update the table to 6 cols/6 rows after action item §9.1 is done.

3. **The 17-item user-confirmed-answers checklist with phase ownership** (the table I built in §4). This is the "did we cover the brief" slide; it's also the only check on silent shelving.

4. **The companion gate fix at `:2585`.** This is the single load-bearing line of code that the overhaul depends on. One slide, four lines of JS, with the `isPlayerControlled` rename. Anyone reading the deck must understand this point.

5. **The 18-vs-6 BG variant deferral.** Surface it. The user asked for 18; the plan delivers 6. Either confirm the deferral on a slide or fix the plan.

6. **Hardcore lock decision.** One sentence: "Hardcore = manual combat, locked. Toggle is hidden in settings, not shown-locked." Resolves the phase 02/03 contradiction in front of the user.

7. **What stays canvas, what becomes DOM/SVG.** Diagram. Phase 04 §1 versus phase 01 §6 disagree on this and the slide should make the final call visible.

8. **The 5 action items from §9 of this doc, as a "before M387 starts" checklist.** These are the unblockers; if the slide deck ships without them, the implementation milestone starts blocked.

---

End of roast. Plan is salvageable — fix the seven contradictions in §3, lock the five docs in §8, run the five action items in §9, write phase 11, and M387 can start cleanly.
