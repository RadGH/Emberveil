# Emberveil — Manual Mode + UI Overhaul Planning

**Status:** Planning only. No code changes. Once approved, future agents will
read these files to understand scope and produce the implementation plan.

**Scope (one paragraph).** Add a *manual* combat mode where the player
takes one action per character per round, alongside the existing auto-battler.
Hardcore difficulty will lock to manual. Ship a graphical overhaul matching
[`/home/radgh/claude/assets/references/emberveil/images/emberveil-design-openai-chatgpt.png`](../../../../assets/references/emberveil/images/emberveil-design-openai-chatgpt.png)
— stone-tile 2.5D playfield (80% ground / 20% top), stylized SVG borders +
corner ornaments, per-character spell rail with click-to-cast, top-of-screen
turn-order strip, redesigned background-art prompt direction. UI remains
DOM/HTML (not canvas). Keep existing combat formulas; consolidate
multi-attack weapons into a single turn so a future "bonus turn" slot can
slot in.

## How to proceed

1. **Read in order.** Start at phase 00 and walk forward. Each phase is
   self-contained but assumes earlier phases as context.
2. **Don't implement yet.** This tree is locked to design + spec. The
   review pass at phase 12 will surface gaps before code lands.
3. **When approved**, the implementation milestones (M387 → ?) will pull
   from this tree and update the wishlist with concrete tickets.
4. **Open the slideshow** at `/plan/slides/` once phase 11 finishes for the
   executive summary. Or read the markdown tree below for the full detail.

## Directory

| File | Purpose | Lead agent |
|---|---|---|
| [`README.md`](README.md) | This file — entry point and how-to | — |
| [`phases/00-design-spec.md`](phases/00-design-spec.md) | Reference image deconstruction; palette, grid, anchors, component inventory | ui-designer |
| [`phases/01-current-state.md`](phases/01-current-state.md) | Audit of shipped CombatScreen vs proposed design — conflicts, reuses, debt | game-developer + Explore |
| [`phases/02-manual-mode-design.md`](phases/02-manual-mode-design.md) | Game-loop spec for manual mode (turn order, action budget, AI fallback) | game-developer |
| [`phases/03-ia-states.md`](phases/03-ia-states.md) | Information architecture — auto vs manual, mobile vs desktop, screen states | ui-designer |
| [`phases/04-grid-camera.md`](phases/04-grid-camera.md) | 2.5D grid math, perspective squares, centering / row-flex rules | frontend-developer |
| [`phases/05-bg-prompt-spec.md`](phases/05-bg-prompt-spec.md) | Background-art prompt direction (80/20 ground/top), per-act regen plan | api-documenter |
| [`phases/06-card-rail-spec.md`](phases/06-card-rail-spec.md) | Bottom-HUD character cards + per-character spell rail (DOM, states) | frontend-developer |
| [`phases/07-svg-borders.md`](phases/07-svg-borders.md) | Stylized SVG border + corner-ornament token system | ui-designer |
| [`phases/08-spell-icons.md`](phases/08-spell-icons.md) | Placeholder spell-icon SVG language (attack/heal/aoe glyph rules) | ui-designer |
| [`phases/09-tooltips-interactions.md`](phases/09-tooltips-interactions.md) | Tooltip patterns, hover/tap, keyboard order, animations | accessibility-tester + ui-designer |
| [`phases/10-mobile-fit.md`](phases/10-mobile-fit.md) | iPhone 14 Pro portrait fit; turn-order under menu; touch targets | accessibility-tester |
| [`phases/11-slides.md`](phases/11-slides.md) | Slideshow generator notes (also produces `/plan/slides/`) | frontend-developer |
| [`phases/12-review-roast.md`](phases/12-review-roast.md) | Senior-reviewer roast pass — gaps, contradictions, missed paths | code-reviewer + qa-expert |
| [`assets/`](assets/) | Sample SVG borders, placeholder icons, mockup images | various |

## User-confirmed answers driving this plan

1. **Planning only.** No code lands until approval.
2. Agent count flexes for thoroughness, not speed. Second opinions encouraged.
3. **Slideshow at the end.**
4. **Prescriptive UI** matching the reference image; uses existing art.
   Plan replacement images in advance so they're not forgotten. Generate
   border samples in this report. UI is HTML/CSS, not canvas.
5. War Dog / companions stay in their own row. Battle grid must support
   flexible row control + future positional movement.
6. Turn order added. Mobile may collapse it under a menu — UX agent decides.
7. Card row scrolls when screen too small; prefer 1 row on desktop.
8. Match existing combat system. Consolidate multi-attack weapons into one
   turn so a future "bonus turn" slot can slot in.
9. No movement yet. Plan for it.
10. Companions auto-play in manual mode.
11. Items are free actions.
12. Generate test backgrounds; produce a perspective-squares mockup with
    existing artwork as proof of concept.
13. Per-act background regen rollout; archive originals.
14. Refactor for the cleanest possible system; OK to rip out old code.
15. This tree is **separate from the wishlist** until approved.
16. Served via the existing release server (`port 5247`); never deployed
    to GitHub.
17. Roast tone: senior reviewer, candid.

## Live preview

This tree renders as a navigable site at `/plan/` on the release server.
Once phases finish, the slideshow lives at `/plan/slides/`.

## Roast-pass amendments (2026-04-30)

After the Phase 12 senior-reviewer roast, these contradictions were resolved
in-place across the affected phase docs. Each amendment is dated and cites the
roast section that surfaced it:

| # | Where | Resolution |
|---|---|---|
| 1 | Phase 0 §7 (rows + cols) | **6 rows × 6 cols** is canonical. Original "approximately 5 rows / 8 cols" was a first-glance estimate. |
| 2 | Phase 4 §2 + §4 (col allocation) | 6 cols total; HERO_COL_RANGE.count=3, ENEMY_COL_RANGE.count=3. |
| 3 | Phase 10 §2 (mobile grid) | **6 cols on mobile**, no swipe-pan. The earlier "8 cols + swipe" answer is rejected and preserved as audit text. |
| 4 | Phase 4 §12 (canvas seam) | Canvas is **NOT eliminated** — `.ev-fx-layer` keeps a canvas overlay for spell FX + floating damage numbers. Sprite + tile + HUD migrate fully to DOM/SVG. |
| 5 | Phase 2 §3 (`update(dt)` insert) | The `if (this._awaitingInput) return;` guard goes immediately before the `_turnTimer +=` line at `:2438`. Do NOT reset `_turnTimer` in the guard; reset only inside `_dispatchManualAction`. |
| 6 | Phase 2 §10 (persistence audit) | Closed: `gs.manualCombat` already exists at `gameState.js:141`. Reuse the existing field; do not add a new `combatMode`. |
| 7 | Phase 2 §1 (hardcore toggle) | Toggle is **shown but visibly locked** with lock icon + tooltip — NOT hidden. Reconciles with Phase 3 §8/§10. |
| 8 | BG variant count | Original Phase 5 specced 6 BGs; user requested 3 variants per act = 18. **All 18 generated 2026-04-30**, indexed at `assets/backgrounds/index.md`. |

**Still-open** (deferred to implementation milestone M387, not blocking design):
- `_drainExtraAttacks` paint-timing model (synchronous loop won't render mid-state changes)
- Three util-buttons / mobile hamburger drift (Phase 03 vs Phase 10 — Phase 10 wins)
- Encounter→variant mapping (which BG variant each encounter pulls)

See `phases/12-review-roast.md` for the full senior-reviewer roast.
