# Phase 03 — IA States: Screen States & Transitions

**Author:** ui-designer agent
**Date:** 2026-04-29
**Reads:** phases/00-design-spec.md, phases/02-manual-mode-design.md
**Feeds:** Phase 06 (card/rail spec), Phase 09 (tooltips), Phase 10 (mobile fit)

---

## 1. State Inventory

Every visible screen state across all four `{combatMode: auto|manual} × {viewport: desktop|mobile}` quadrants. States are **mode-scoped** (applies to auto, manual, or both) and **viewport-scoped** (desktop, mobile, or both). Where a state gets a mobile variant the variant id uses the `_M` suffix.

| # | State ID | Mode | Viewport | Purpose (one sentence) | Entry trigger |
|---|---|---|---|---|---|
| 1 | `INTRO_SPLASH` | both | both | Full-screen combat-start banner with mode label toast. | CombatScreen mounts; player transitions from dungeon/overworld. |
| 2 | `AUTO_IDLE` | auto | both | Auto-battle resolving; no player input; turn-strip animates through actors. | `manualCombat === false`; combat loop running. |
| 3 | `AUTO_RESOLVING` | auto | both | Damage FX and floats playing; action dispatched by AI. | AI dispatch fires for any actor in auto mode. |
| 4 | `MANUAL_IDLE` | manual | both | Enemy or companion turn resolving; player's heroes are all cold. | `_awaitingInput === null` in manual mode between player turns. |
| 5 | `MANUAL_AWAIT_INPUT_DESKTOP` | manual | desktop | Active hero's card rail is hot; player must choose an action. | `_pauseForPlayerInput(actor)` called; `_awaitingInput` set to a non-companion hero. |
| 6 | `MANUAL_AWAIT_INPUT_MOBILE` | manual | mobile | Same semantic as above; turn-strip hidden under collapsed menu; only active card's rail shown. | Same trigger as #5, on mobile viewport. |
| 7 | `MANUAL_TARGET_PICK_DESKTOP` | manual | desktop | Player tapped a single-target spell or Basic Attack; enemy sprites show tap rings. | Spell/attack button tapped while `_awaitingInput` is set; spell requires a target. |
| 8 | `MANUAL_TARGET_PICK_MOBILE` | manual | mobile | Same as #7; tap rings sized to 44px min touch target; tooltip pinned to top of screen. | Same trigger on mobile viewport. |
| 9 | `MANUAL_AOE_CONFIRM` | manual | both | Player tapped an AOE spell; all enemies highlighted; confirm affordance shown. | AOE spell button tapped; `spell.targetType === 'all'`. |
| 10 | `MANUAL_ITEM_OPEN` | manual | both | Free-action item belt expanded; player selecting a consumable; turn not consumed. | "Use Item" button tapped; `_awaitingInput` unchanged. |
| 11 | `MANUAL_RESOLVING` | manual | both | Action dispatched; damage animating; extra attacks draining; all rails cold. | `_dispatchManualAction()` called; `_awaitingInput` cleared to `null`. |
| 12 | `MANUAL_RESOLVING_EXTRA` | manual | both | Sub-state of RESOLVING: extra attack drain visible; "x2 attack" badge on active card. | `_drainExtraAttacks` while loop enters at least one iteration. |
| 13 | `MANUAL_STATUS_LOCK` | manual | both | Active hero is Stunned/Confused; no card rail buttons shown; status badge prominent. | Actor dispatched but stun/confusion check fires before AWAITING-INPUT. |
| 14 | `COMBAT_PAUSED` | both | both | ESC/pause overlay dims combat; pause menu modal on top; `_awaitingInput` preserved. | Player presses ESC or taps pause button. |
| 15 | `COMBAT_FLEE_ATTEMPT` | both | both | Flee action in animation; DEX roll result pending. | Player selects Flee in manual mode; only shows briefly in auto on flee event. |
| 16 | `COMBAT_VICTORY` | both | both | Victory modal covers battlefield; loot/XP summary shown; HUD hidden. | `_checkCombatEnd()` detects all enemies dead. |
| 17 | `COMBAT_DEFEAT` | both | both | Defeat modal covers battlefield; retry/quit options shown; HUD hidden. | `_checkCombatEnd()` detects all allies dead. |
| 18 | `SETTINGS_OVERLAY` | both | both | Full-screen Settings sheet over combat; mode toggle visible (or locked for Hardcore). | Player taps gear util-button or opens Settings from pause menu. |
| 19 | `TURN_STRIP_EXPANDED_M` | both | mobile | Turn-order strip expanded from collapsed state; overlays upper battlefield on mobile. | Player taps the "N turns" chevron button in the mobile header bar. |
| 20 | `TOOLTIP_VISIBLE_DESKTOP` | both | desktop | Spell tooltip card floats right of HUD rail. | Player hovers a spell icon or holds tap (mobile fallback excluded here). |
| 21 | `TOOLTIP_VISIBLE_MOBILE` | both | mobile | Spell tooltip slides up as a bottom-sheet partial; does not cover action buttons. | Player long-presses a spell icon. |
| 22 | `WAIT_REINSERT` | manual | both | Player selected Wait; actor chip moves to end of turn-strip with animation. | Wait button tapped (if Wait is confirmed in scope; see §8). |
| 23 | `ERROR_SPELL_LOAD` | both | both | Spell list failed to load; rail shows error placeholder; Basic Attack still available. | `_loadSkills()` rejects or returns empty. |
| 24 | `ERROR_SAVE_CORRUPT` | both | both | Save corruption detected mid-combat; overlay warns player; safe-exit offered. | Save-load integrity check fails. |
| 25 | `ERROR_NETWORK_SYNC` | both | both | Cloud-save sync failed silently; non-blocking toast; local data preserved. | Cloud sync PUT/POST returns non-2xx. |

**Total: 25 states.** All 25 appear in the per-state UI surface table (§5) and in at least one transition diagram (§2, §3, or §4).

---

## 2. Auto Desktop Flow

Auto mode is a tight loop. The player has no action input; states are driven entirely by the combat engine and overlay triggers.

```
                    ┌──────────────────────────────────────────────┐
                    │                                              │
             ┌──────▼──────┐      AI dispatch      ┌─────────────┐│
 mount  ───► │ INTRO_SPLASH├─────────────────────► │ AUTO_IDLE   ││
             └─────────────┘  (2s toast, then fades)└──────┬──────┘│
                                                           │ actor turn fires
                                                           ▼
                                                  ┌────────────────┐
                                                  │ AUTO_RESOLVING │
                                                  └───────┬────────┘
                                                          │ FX done, check end
                                    ┌─────────────────────┤
                                    │              ┌──────┴──────────┐
                              more turns           │ COMBAT_VICTORY  │
                                    │              └─────────────────┘
                             back to AUTO_IDLE     ┌─────────────────┐
                                                   │ COMBAT_DEFEAT   │
                                                   └─────────────────┘

Overlay interrupts (any state → overlay → return to prior state):
  AUTO_IDLE or AUTO_RESOLVING ──► COMBAT_PAUSED ──► resume prior state
  AUTO_IDLE or AUTO_RESOLVING ──► SETTINGS_OVERLAY ──► resume prior state
  AUTO_RESOLVING ──────────────► COMBAT_FLEE_ATTEMPT ──► AUTO_IDLE (fail) or exit (success)
  any ─────────────────────────► ERROR_SAVE_CORRUPT / ERROR_NETWORK_SYNC
```

---

## 3. Manual Desktop Flow

Manual mode is the complex path. The core branch is AWAITING-INPUT and its sub-states.

```
             ┌─────────────────┐
  mount ───► │  INTRO_SPLASH   │──(2s)──► MANUAL_IDLE
             └─────────────────┘
                                              │
                                 ┌────────────┤
                        enemy/companion turn  │ hero turn → _pauseForPlayerInput()
                                 │            ▼
                          MANUAL_IDLE  MANUAL_AWAIT_INPUT_DESKTOP
                                 │            │
                                 │      ┌─────┴──────────────────────────────────────┐
                                 │      │ player chooses action:                      │
                                 │      │                                             │
                                 │      ├─► Basic Attack / single-target spell        │
                                 │      │     └─► MANUAL_TARGET_PICK_DESKTOP          │
                                 │      │            └─► (tap enemy) ─────────────────┤
                                 │      │                                             │
                                 │      ├─► AOE spell                                 │
                                 │      │     └─► MANUAL_AOE_CONFIRM                  │
                                 │      │            ├─► Confirm ────────────────────►│
                                 │      │            └─► Cancel ──► MANUAL_AWAIT_INPUT│
                                 │      │                                             │
                                 │      ├─► Use Item (free action)                    │
                                 │      │     └─► MANUAL_ITEM_OPEN                    │
                                 │      │            ├─► item selected ──► re-arms ──►│
                                 │      │            └─► belt empty / cancel ────────►│
                                 │      │                                             │
                                 │      ├─► Skip / End Turn ─────────────────────────►│
                                 │      │                                             │
                                 │      ├─► Wait ──► WAIT_REINSERT ──► MANUAL_IDLE   │
                                 │      │                                             │
                                 │      └─► Flee ──► COMBAT_FLEE_ATTEMPT             │
                                 │                        ├─► fail ──► MANUAL_IDLE   │
                                 │                        └─► success ──► exit        │
                                 │                                             │
                                 │      ◄──────────────────────────────────────┘
                                 │      action dispatched → MANUAL_RESOLVING
                                 │                  │
                                 │      ┌───────────┴────────────┐
                                 │      │ extra attacks?          │
                                 │      │  yes → MANUAL_RESOLVING_EXTRA
                                 │      │  no  → check end        │
                                 │      └───────────┬────────────┘
                                 │                  │
                                 │         ┌────────┴──────────┐
                                 │         │                   │
                                 │    more turns          COMBAT_VICTORY
                                 └────────◄│                   │
                                      MANUAL_IDLE         COMBAT_DEFEAT
                                           │
Special interrupts (any state):
  MANUAL_AWAIT_INPUT_DESKTOP ──► COMBAT_PAUSED  (ESC; _awaitingInput preserved)
  MANUAL_AWAIT_INPUT_DESKTOP ──► SETTINGS_OVERLAY (gear button)
  MANUAL_AWAIT_INPUT_DESKTOP ──► MANUAL_STATUS_LOCK (DoT applies Silence mid-window)
  any ─────────────────────────► ERROR_SAVE_CORRUPT / ERROR_NETWORK_SYNC / ERROR_SPELL_LOAD
```

**MANUAL_STATUS_LOCK note:** When a status effect (Silence, Stun, Confusion) applies to the waiting hero during the input window, the rail transitions to MANUAL_STATUS_LOCK. The status badge replaces action buttons. The player cannot act; the engine auto-resolves the turn (Skip path) and returns to MANUAL_IDLE.

---

## 4. Mobile Collapse Rules

Mobile viewport is **393×852 CSS px portrait** (iPhone 14 Pro). The following rules define mobile as a **delta** from the desktop state list.

### 4a. States that map 1:1 (no structural change)

`INTRO_SPLASH`, `AUTO_RESOLVING`, `MANUAL_RESOLVING`, `MANUAL_RESOLVING_EXTRA`, `MANUAL_STATUS_LOCK`, `COMBAT_PAUSED`, `COMBAT_FLEE_ATTEMPT`, `COMBAT_VICTORY`, `COMBAT_DEFEAT`, `SETTINGS_OVERLAY`, `WAIT_REINSERT`, `ERROR_SPELL_LOAD`, `ERROR_SAVE_CORRUPT`, `ERROR_NETWORK_SYNC`

These states are visually identical or near-identical. Layout adapts via responsive CSS; no structural DOM change.

### 4b. States that get merged (desktop split → mobile unified)

| Desktop states | Mobile merged state | Rule |
|---|---|---|
| `MANUAL_AWAIT_INPUT_DESKTOP` | `MANUAL_AWAIT_INPUT_MOBILE` | Turn-strip collapsed to a single "Round N / Next: [chip]" header bar. Only the active character's spell rail is shown; other cards are scrolled to viewport edge or hidden behind a "party" toggle. |
| `MANUAL_TARGET_PICK_DESKTOP` | `MANUAL_TARGET_PICK_MOBILE` | Same tap-ring model but touch targets padded to 44×44px minimum. Tooltip pinned to top edge (not floating beside target). Cancel target affordance is a fixed back-arrow button at top-left (44×44px). |
| `TOOLTIP_VISIBLE_DESKTOP` | `TOOLTIP_VISIBLE_MOBILE` | Tooltip renders as a partial bottom-sheet (slides up ~160px, does not cover spell rail). Long-press shows it; tap-away dismisses. |

### 4c. Mobile-only state

`TURN_STRIP_EXPANDED_M` — only exists on mobile. The collapsed turn-strip header has a chevron/expand button. Tapping it slides the full turn-order strip down from the top, overlaying the top ~25% of the battlefield. Tapping anywhere outside or tapping the chevron again collapses it. This state is an **overlay** on top of whatever combat state is active (`AUTO_IDLE`, `MANUAL_AWAIT_INPUT_MOBILE`, etc.); it does not replace it.

### 4d. Mobile-specific layout rules for MANUAL_AWAIT_INPUT_MOBILE

1. **Turn-strip:** collapsed to a single-line header bar (`height: 44px`) showing "Round N" on the left and the next-up portrait chip on the right. Full strip accessible via `TURN_STRIP_EXPANDED_M`.
2. **Card row:** only the currently-awaiting hero's card is shown full-width in the HUD. Other party cards are accessible via a horizontal scroll or a "party" mini-button in the header. The non-active cards are **rendered but off-screen** (not unmounted) to preserve state.
3. **Spell rail:** only the active hero's rail is visible. Spell icons are sized at minimum 44×44px. The rail is a single horizontal row; if more than 5 spells, it scrolls with snap-to-icon.
4. **Target picker:** on mobile, after tapping a targeting spell, enemy sprites gain tap rings. A fixed "Cancel" button appears at top-left (44×44px). Tooltip on tap (not hover) appears at top of screen below the header bar.
5. **AOE confirm:** the confirm button appears as a full-width bar above the spell rail (`height: 48px`, label "Cast [Spell Name] — All Enemies", gold `--fire-core` background). Cancel via the same button or a back-arrow.

---

## 5. Per-State UI Surface Inventory

Legend: Y = visible/active, N = hidden, P = present but cold/inactive, * = see note, — = not applicable.

| State ID | Turn-strip | Card row | Active-char rail | Target picker | Tooltip | Action sub-menu | Pause-eligible | Back/ESC allowed |
|---|---|---|---|---|---|---|---|---|
| `INTRO_SPLASH` | N | N | N | N | N | N | N | N |
| `AUTO_IDLE` | Y | Y (passive) | P (auto mode) | N | Y on hover | N | Y | N* |
| `AUTO_RESOLVING` | Y | Y | P | N | N | N | Y | N* |
| `MANUAL_IDLE` | Y | Y (all cold) | P (all cold) | N | Y on hover | N | Y | N* |
| `MANUAL_AWAIT_INPUT_DESKTOP` | Y | Y | Y (active hero hot) | N | Y on hover | Y (skip/wait/flee) | Y | N* |
| `MANUAL_AWAIT_INPUT_MOBILE` | collapsed | Y (active card only) | Y (active hero hot) | N | on long-press | Y (skip/wait/flee) | Y | N* |
| `MANUAL_TARGET_PICK_DESKTOP` | Y | Y | P (targeting mode) | Y | Y (targeted unit) | N | N | Y (cancel target) |
| `MANUAL_TARGET_PICK_MOBILE` | collapsed | Y (active only) | P | Y (44px rings) | top-pinned | N | N | Y (44px back btn) |
| `MANUAL_AOE_CONFIRM` | Y | Y | P | Y (all enemies highlighted) | N | Y (confirm/cancel) | N | Y (cancel = back) |
| `MANUAL_ITEM_OPEN` | Y | Y | P (item panel open) | N | Y (item tooltip) | N | N | Y (closes belt) |
| `MANUAL_RESOLVING` | Y | Y (all cold) | P (cold) | N | N | N | N | N |
| `MANUAL_RESOLVING_EXTRA` | Y | Y (badge visible) | P (cold + badge) | N | N | N | N | N |
| `MANUAL_STATUS_LOCK` | Y | Y (status badge) | N (no buttons) | N | Y (status tooltip) | N | Y | N* |
| `COMBAT_PAUSED` | Y (dimmed) | Y (dimmed) | P (dimmed) | N | N | N | — | Y (closes pause) |
| `COMBAT_FLEE_ATTEMPT` | Y | Y (all cold) | P | N | N | N | N | N |
| `COMBAT_VICTORY` | N | N | N | N | N | N | N | N |
| `COMBAT_DEFEAT` | N | N | N | N | N | N | N | N |
| `SETTINGS_OVERLAY` | N (behind) | N (behind) | N | N | N | N | — | Y (closes settings) |
| `TURN_STRIP_EXPANDED_M` | Y (full, overlay) | Y (behind) | P | N | N | N | Y | Y (collapses strip) |
| `TOOLTIP_VISIBLE_DESKTOP` | Y | Y | Y/P (context) | N | Y | — | Y | — |
| `TOOLTIP_VISIBLE_MOBILE` | collapsed | Y | Y/P (context) | N | Y (bottom sheet) | — | Y | Y (dismisses sheet) |
| `WAIT_REINSERT` | Y (chip animates) | Y | P | N | N | N | N | N |
| `ERROR_SPELL_LOAD` | Y | Y | Y (Basic Attack only) | N | N | N | Y | N |
| `ERROR_SAVE_CORRUPT` | Y (dimmed) | Y (dimmed) | N | N | N | N | — | N (modal blocks) |
| `ERROR_NETWORK_SYNC` | Y | Y | Y/P (context) | N | N (toast instead) | — | Y | — |

*Back/ESC during active combat navigates away — blocked by combat `onExit` guard; not allowed until combat ends or flees.

---

## 6. Cross-State Contracts

Rules every state must obey. Implementation agents treat these as invariants.

1. **Tooltip placement.** On desktop, a tooltip never overlaps the active character's card. If the hovered icon belongs to the active character (whose card is at the left end of the HUD rail), the tooltip shifts right or floats above the rail. Minimum 8px gap between tooltip edge and card edge.

2. **Turn-strip persistence.** The turn-strip is never removed from the DOM during an active combat round. It may be visually hidden (collapsed on mobile, dimmed during pause), but it is always mounted. Unmounting it mid-round causes chip-order state loss.

3. **Spell rail icons stay mounted.** Icons on the spell rail are never unmounted due to combat state. Cold icons use `pointer-events: none` and a reduced-opacity treatment (`opacity: 0.35`, `filter: saturate(0.2)`). Removing them from DOM causes layout reflow that is visible as flicker.

4. **Target picker cancellation.** `MANUAL_TARGET_PICK_DESKTOP` and `MANUAL_TARGET_PICK_MOBILE` can always be canceled by ESC (desktop) or the back-arrow button (mobile, 44×44px, top-left). Canceling returns to `MANUAL_AWAIT_INPUT_DESKTOP` / `MANUAL_AWAIT_INPUT_MOBILE` with `_awaitingInput` unchanged.

5. **AOE confirm cancellation.** `MANUAL_AOE_CONFIRM` can always be canceled, returning to `MANUAL_AWAIT_INPUT_*`. Cancel does not consume the turn or touch `_awaitingInput`.

6. **RESOLVING blocks back-navigation.** While in `MANUAL_RESOLVING` or `MANUAL_RESOLVING_EXTRA`, the back gesture and ESC are suppressed. The combat loop must complete the animation cycle before the UI becomes interruptible.

7. **Pause preserves `_awaitingInput`.** Entering `COMBAT_PAUSED` from `MANUAL_AWAIT_INPUT_*` does not clear `_awaitingInput`. On pause resume, the card rail re-activates to the same state with the same actor.

8. **Status effects re-evaluate at render time.** The spell rail hot/cold state is derived live from `_awaitingInput`, `actor.mp`, `spell.isOnCooldown`, `actor.hasSilence`. It is not cached. A DoT applying Silence during the input window triggers a re-render of the rail within the same animation frame.

9. **HUD hidden on terminal states.** `COMBAT_VICTORY` and `COMBAT_DEFEAT` always hide the HUD card row and turn-strip. These states are terminal; no HUD interaction is possible.

10. **Util buttons present in all non-terminal non-overlay states.** The three utility buttons (settings gear, layout toggle, and an additional button TBD by phase 06 §11) are always visible when the battlefield is interactive. They are hidden only during `INTRO_SPLASH`, `COMBAT_VICTORY`, `COMBAT_DEFEAT`.

---

## 7. AUTO_TO_MANUAL Mid-Combat Toggle

**Rule:** A mode change via Settings applies at the **start of the next round**, not immediately.

**Definition of "round":** A round ends when `_turnIdx` wraps back to 0 (all combatants have had at least one turn). The mode change flag `pendingModeChange: 'manual' | 'auto' | null` is held separately from `combatMode`. At round wrap, if `pendingModeChange` is set, `combatMode` is updated and the flag cleared.

**UI hint to the player:**
- A non-blocking toast appears at the top of the battlefield when the Setting is saved: `"Manual Mode will activate at the start of the next round."`
- The toast uses the same 2-second auto-dismiss pattern as the combat-start banner (§1 of Phase 02).
- The Settings gear util-button gains a small animated dot badge (8px, `--fire-bloom` color) until the mode change takes effect, then the badge disappears.

**Edge cases:**
- If combat ends before the next round, the pending change is applied to `gameState.combatMode` (persisted) but has no in-combat effect.
- If the player toggles back and forth within the same pause/Settings visit, only the final saved value is held as `pendingModeChange`.

---

## 8. Hardcore Lock

**Visual treatment in Settings:**

The mode toggle control (defined in §10) is rendered with:
- `opacity: 0.45` on the entire control group.
- A lock icon (Font Awesome `fa-lock`, 14px, `--gold-dim` color) placed inline to the right of the toggle label.
- `pointer-events: none` on the toggle pill.
- `cursor: not-allowed` on the wrapping label.

**One-line tooltip (on hover / long-press):**

> "Manual mode is required for Hardcore difficulty and cannot be changed."

The tooltip uses the standard tooltip card treatment (phase 09) but with a `--hp-low` left-border accent to distinguish it from informational spell tooltips.

**DOM state:** The toggle `<input>` element carries `disabled` and `aria-disabled="true"`. Screen readers announce "Combat Mode, Manual, locked (Hardcore)."

---

## 9. Failure and Recovery States

Matching the pragmatic kill-switch pattern confirmed in M383 (`LOGIN_UI_DISABLED`). No error state blocks the player from extracting their session safely.

### `ERROR_SPELL_LOAD`

**Trigger:** `_loadSkills()` rejects or the skill array for the actor is empty/undefined.

**Screen behavior:**
- The spell rail slots show a single generic "Attack" button (maps to Basic Attack).
- A dismissable amber banner appears above the HUD rail: `"Skill data unavailable — basic actions only."`
- Skip and Flee remain available.
- `_awaitingInput` behavior is unchanged; the player can still act.
- No retry button (retrying skill load mid-combat is undefined behavior). The error persists until combat ends; the banner auto-hides after 5 seconds but the rail remains limited.

### `ERROR_SAVE_CORRUPT`

**Trigger:** Integrity check on `gameState` detects structural corruption (e.g. `party` is missing, HP values are NaN, `_turnOrder` is empty when combatants exist).

**Screen behavior:**
- Combat is frozen (`_awaitingInput` cleared; `_turnTimer` accumulation halted).
- A centered modal with `--ember-deep` background and `--gold-rim` border:
  - Title: "Save Data Error"
  - Body: "A problem was detected with your save file. You can return to the main menu to attempt a reload, or continue from the last checkpoint."
  - Buttons: "Return to Menu" (primary) | "Continue Anyway" (secondary, proceeds with current in-memory state — combat resumes but save will not persist the outcome).
- No automatic data deletion. The corrupt save file is not touched.

### `ERROR_NETWORK_SYNC`

**Trigger:** Cloud-save sync HTTP call returns a non-2xx response or times out after 5 seconds.

**Screen behavior:**
- A non-blocking toast at the bottom of the battlefield (above HUD rail): `"Progress saved locally. Cloud sync unavailable."`
- Uses `--arc-blue` left-border accent.
- Auto-dismisses after 4 seconds.
- Combat continues without interruption. `_awaitingInput` is not affected.
- No retry spinner. The next sync attempt will occur at the normal save interval.

---

## 10. Mode-Toggle UI Shape

### Control type: Toggle pill with text labels

A horizontal pill toggle, not radio buttons. Rationale: the two states (Auto / Manual) are mutually exclusive and persistent; a pill conveys "mode" more naturally than radio buttons, which read as a form field.

```
Label: "Combat Mode"

  ┌────────────────────────────────────────────┐
  │  ┌──────────┐  ┌──────────┐               │
  │  │   AUTO   │  │  MANUAL  │               │
  │  └──────────┘  └──────────┘               │
  └────────────────────────────────────────────┘

Active segment: filled --ember-slate bg + --gold-rim border + --gold-glow text
Inactive segment: --ember-deep bg + --ember-pit border + --gold-dim text
Pill wrapper: --ember-pit border, border-radius: 4px
Gap between segments: 2px
Segment size: ~100×32px each
```

**Tokens used:** `--ember-deep`, `--ember-slate`, `--ember-pit`, `--gold-rim`, `--gold-glow`, `--gold-dim` — all from phase 00 palette.

**Hardcore locked state** (inline SVG annotation):

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="48" viewBox="0 0 240 48">
  <!-- Pill wrapper -->
  <rect x="2" y="8" width="220" height="32" rx="4"
        fill="#1a1128" stroke="#1a1128" stroke-width="1" opacity="0.45"/>
  <!-- AUTO segment (inactive, locked) -->
  <rect x="4" y="10" width="100" height="28" rx="3"
        fill="#0d0820" stroke="#1a1128" stroke-width="1" opacity="0.45"/>
  <text x="54" y="28" text-anchor="middle" font-size="11"
        fill="#7a6010" font-family="Cinzel" letter-spacing="0.1em"
        opacity="0.45">AUTO</text>
  <!-- MANUAL segment (active, locked) -->
  <rect x="108" y="10" width="100" height="28" rx="3"
        fill="#3d3250" stroke="#c8a020" stroke-width="1" opacity="0.45"/>
  <text x="158" y="28" text-anchor="middle" font-size="11"
        fill="#f8e890" font-family="Cinzel" letter-spacing="0.1em"
        opacity="0.45">MANUAL</text>
  <!-- Lock icon (rightmost) -->
  <text x="232" y="30" text-anchor="middle" font-size="14"
        fill="#7a6010" font-family="FontAwesome">&#xf023;</text>
</svg>
```

**Accessibility:** The toggle is a `<div role="radiogroup">` containing two `<button role="radio">` elements. The locked Hardcore version uses `<button disabled aria-disabled="true">`. The group label is `<legend>` or `aria-labelledby`. Screen reader output: "Combat Mode, group. Auto, radio button, not selected. Manual, radio button, selected, locked."

---

## 11. Open Questions for Downstream Phases

### For Phase 6 (Card / Rail Spec)

1. **Single-target spell flow:** When the player taps a single-target spell button in `MANUAL_AWAIT_INPUT_DESKTOP`, does the game immediately enter `MANUAL_TARGET_PICK_DESKTOP` (pick-your-target), or does it default-target the highest-threat enemy and require one confirmation tap? The answer determines whether `MANUAL_TARGET_PICK_*` is a required mid-step or an optional "override default" path.

2. **Card count vs screen width:** The HUD card row must fit 3–5 heroes + optional companion. At 393px mobile, even a single card may need to show a compressed form. Does Phase 06 define two card sizes (full / compact) or does the card always compress to a minimum width and rely on horizontal scroll?

3. **Item belt rendering in MANUAL_ITEM_OPEN:** The item belt is a free-action sub-panel. Phase 06 must decide whether it slides up above the HUD rail (pushing battlefield up), overlays the HUD rail (occluding HP bars), or opens as a separate sheet. The choice affects whether `MANUAL_ITEM_OPEN` needs a distinct DOM layer.

4. **Util button identity:** Phase 00 §9 question 10 identifies three util buttons (settings, layout, unknown third). Phase 03 defines that all three must be present in non-terminal non-overlay states. Phase 06 must assign the third button (candidate: "combat log" or "party stats"). The assignment affects tooltip definitions in Phase 09.

### For Phase 9 (Tooltips / Interactions)

1. **Tooltip delay on desktop:** Should spell icon tooltips appear on a `200ms` hover delay (standard, avoids flicker on mouse transit) or immediately? Immediate is better for fast-paced manual input, but hover-transit flicker on the HUD rail is a known UX smell. Phase 09 must confirm the delay value.

2. **Tooltip for status-locked actor:** In `MANUAL_STATUS_LOCK`, the status badge should be tappable/hoverable to show the full status effect description (duration, effect, source). Phase 09 must define whether the status tooltip uses the standard spell tooltip card or a distinct "status" tooltip variant.

3. **Tooltip z-index contract with AOE confirm bar:** In `MANUAL_AOE_CONFIRM`, the confirm bar appears above the HUD rail. If the player hovers a spell icon during the confirm step (which should be inert), does the tooltip still fire? Phase 09 must define whether tooltips are globally suppressed in non-input sub-states.

4. **Mobile long-press threshold:** Phase 10 will define the touch model, but Phase 09 must provide the long-press duration (300ms is the de-facto standard; 500ms avoids accidental triggers but feels slow for fast-paced combat). This value affects the `TOOLTIP_VISIBLE_MOBILE` entry timing.

### For Phase 10 (Mobile Fit)

1. **TURN_STRIP_EXPANDED_M overlay depth:** The expanded turn-strip overlays the top ~25% of the battlefield. If a combat FX animation (lightning arc, fireball) is running in that zone when the strip expands, the FX and the strip will visually conflict. Phase 10 must define the z-index layering and whether the strip expansion pauses FX or runs over them.

2. **Active-card isolation in MANUAL_AWAIT_INPUT_MOBILE:** Only the active hero's card is shown full-width in the mobile HUD. How does the player see HP/status for the other party members? Options: (a) a compact "party health bar" strip above the HUD card, (b) tapping a "party" icon opens a mini-overlay, (c) the off-screen cards are accessible by swiping the HUD horizontally. Phase 10 must choose one pattern.

3. **MANUAL_AOE_CONFIRM on 393px:** The AOE confirm bar is spec'd as a full-width bar above the spell rail. On mobile, "above the spell rail" could eat 48px from the battlefield zone, dropping it from ~72% to ~66% of screen height. Phase 10 must verify this is acceptable on the iPhone 14 Pro or propose an alternative (e.g. the confirm bar slides over the spell rail rather than pushing it down).

4. **COMBAT_FLEE_ATTEMPT animation on mobile:** The flee animation (brief visual effect before DEX roll result) needs to complete within 600ms to not feel laggy on a slow device. Phase 10 should confirm whether the animation is purely CSS (safe) or involves JS-scheduled frame loops that might drop on low-end iOS.

---

## Handoff to Phases 6, 9, 10

### Phase 6 (Card / Rail Spec) carries:

- The distinction between **hot** and **cold** rail state is driven by a single field: `_awaitingInput`. Hot = `_awaitingInput.id === card.actorId`. Cold = everything else. Phase 06 must wire to this field, not to any per-card boolean.
- `MANUAL_ITEM_OPEN` is a **free-action sub-state** — `_awaitingInput` is NOT cleared during item use. The card rail must re-arm after item selection.
- `MANUAL_RESOLVING_EXTRA` requires a visible badge on the active card: "x2 attack" or "x3 attack", fades after 600ms. This is a Phase 06 responsibility.
- The third util button identity must be resolved by Phase 06. All three must be present in the non-terminal non-overlay states defined in §5.
- Target picker (entering `MANUAL_TARGET_PICK_*`) is triggered from within the card rail interaction flow. Phase 06 owns the entry mechanism. Phase 03 guarantees the return path: cancel always returns to `MANUAL_AWAIT_INPUT_*` with `_awaitingInput` intact.
- `MANUAL_STATUS_LOCK` means the card rail shows a status badge only — no action buttons. The badge must be interactive (hoverable/tappable) to trigger a status tooltip (Phase 09 owns tooltip shape).

### Phase 9 (Tooltips / Interactions) carries:

- On desktop: tooltip card floats **right of the HUD rail** (phase 00 §3 layout zone: `tooltip-card` at 73% left). It must never overlap the active character's card (cross-state contract §6 rule 1).
- On mobile: tooltip is a **partial bottom-sheet**, ~160px tall, sliding up. It does not cover the spell rail (cross-state contract rule implied by §4d).
- In `MANUAL_TARGET_PICK_*`, the tooltip shows the **targeted enemy's stats** (or the last-hovered enemy's stats), not the spell description. Phase 09 must define a tooltip variant for unit stats vs spell description.
- Tooltips are suppressed in `MANUAL_RESOLVING`, `MANUAL_RESOLVING_EXTRA`, `COMBAT_FLEE_ATTEMPT`. Phase 09 owns the suppression logic (pointer-events off on tooltip trigger zone, or state-flag gate).
- The Hardcore lock tooltip (§8) uses a `--hp-low` left-border accent variant, distinct from the standard spell tooltip. Phase 09 must fold this variant into the tooltip system.

### Phase 10 (Mobile Fit) carries:

- `TURN_STRIP_EXPANDED_M` is a **mobile-only overlay state** that stacks on top of the current combat state. It does not replace it. The underlying state's `_awaitingInput` is not affected by strip expand/collapse.
- In `MANUAL_AWAIT_INPUT_MOBILE`, non-active party cards are **rendered off-screen** (not unmounted). Phase 10 must decide how the player accesses them (scroll, party icon, compact strip — open question §11/Phase10 Q2).
- The collapsed turn-strip header bar on mobile is `height: 44px`. This is a hard constraint that Phase 10 must absorb into the battlefield zone calculation. The battlefield shrinks from ~72% to ~72% minus 44px (approximately 67.8% at 852px height).
- `MANUAL_TARGET_PICK_MOBILE` requires a dedicated **44×44px back-arrow button at top-left** of the battlefield that is always clear of the collapsed turn-strip header. Phase 10 must reserve this hit zone in the battlefield layout.
- The AOE confirm bar on mobile (`height: 48px` above the spell rail) combined with the collapsed turn-strip (`44px`) and the spell rail itself means the battlefield may be as short as ~60% of viewport height during `MANUAL_AOE_CONFIRM`. Phase 10 must validate this against the iPhone 14 Pro 852px screen and decide if the confirm affordance needs a different placement.
