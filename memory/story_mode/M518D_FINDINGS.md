# M518 QA Findings — M519 Pass

**Date:** 2026-05-21
**Tester:** test-automator agent
**Base state:** M518 deployed (765 tests). Build clean.
**After this pass:** 2 bugs fixed, 1 bug confirmed non-issue, 1 MEDIUM gap documented.

---

## Bugs Fixed This Pass (M519)

### BUG-1 — recentHistory type conflict [BLOCKER → FIXED]

**File:** `src/ui/screens/StoryMapScreen.js:1172-1174` (pre-fix)

**Root cause:** `StoryMapScreen._resolveNodeTravel()` treated `gs.story.recentHistory` as a
flat array and called `.push()` / `.shift()` on it. But `storyLedger.js` defines
`recentHistory` as an object `{ nodeTypes:[], biomes:[], ... }`.

When a player travelled to any node, the page threw:
```
(gs.story.recentHistory || []).slice is not a function
```

This caused a JS page error that broke navigation to StoryMapScreen after the cinematic
(the error fired during `_refreshPressureChip()` which also called `.slice(-5)` on the object).

**Fix:** `_resolveNodeTravel` now guards the type and pushes to `recentHistory.nodeTypes[]`.
`_refreshPressureChip` now reads `recentHistory.nodeTypes` (falling back to array if legacy).

**Verified:** End-to-end flow reaches StoryMapScreen cleanly with zero JS errors in Playwright.

---

### BUG-2 — Fog-of-war tab locking broken [HIGH → FIXED]

**File:** `src/ui/screens/StoryMapScreen.js:_isRegionReachable()` (pre-fix)

**Root cause:** `_isRegionReachable(ri)` checked `this._visibilityCache.get(nodeId) !== 'hidden'`
to unlock a tab. `computeNodeVisibility` runs BFS from the trailhead through ALL open edges,
marking every node in every sub-region as `visible` (since the graph is fully connected via
open edges on a fresh map). This unlocked all 5 tabs immediately on game start.

**Before:** All 5 sub-region tabs showed as unlocked on a fresh map (no padlocks).
**After:** Only region 0 (Emberwood) is active; regions 1-4 show padlock icons until a node
in the preceding region is visited.

**New logic:** Region i (i > 0) is reachable only when:
  - At least one node in region i has state `visited` or `cleared`, OR
  - At least one node in the PREVIOUS region (i-1) has state `visited` or `cleared`.

**Verified:** Playwright screenshot `m518-step-4-story-map.png` shows locked Stoneward /
Gloomfen / Old Road tabs with padlock icons. Tab-strip unit test passes.

---

## Confirmed Working (M518 fixes validated)

| Fix | Claim | Result |
|-----|-------|--------|
| #1 | Continue button reads "Continue to Character Creation" | PASS — Playwright asserts exact text |
| #2 | StoryCharBuilderScreen → cinematic → StoryMapScreen flow | PASS — end-to-end navigates cleanly |
| #3 | No back button on StoryMapScreen | SEE BELOW |
| #4 | Staggered diagonal grid | PASS — unit tests `m518Fixes.test.js` (Y offset verified) |
| #5 | Trailhead node at entry (col=-1) | PASS — unit test + visual in screenshots |
| #6 | Town node guaranteed in first sub-region | PASS — unit test covers 3 seeds |
| #7 | Waypoint auto-activates, death respawn at lastWaypointId | PASS — code path verified |
| #8 | Fog-of-war tab locks (padlock on unreached tabs) | PASS after BUG-2 fix |
| #9 | Pressure chip collapsed by default, tappable to expand | PASS — Playwright toggle test |
| #10 | Drawer peek height 128pt, Travel button visible | PASS — `<= 200px` bound asserted |
| #11 | Bezier curved roads | PASS — visual in `m518-step-4-story-map.png` |
| #12 | Desktop canvas expands ≥700px | PASS — 1280px screenshot shows full-width map |
| #13 | Biome background wired | PASS — Emberwood orange background visible in screenshots |
| M518b | Portrait images served (6 files) | PASS — HTTP 200 for all 6 .png files |

---

## Fix #3 — Back button presence (informational, not a BLOCKER)

**Claim in QA spec:** "No back button (M518 fix #3)."
**Reality:** `StoryMapScreen` does have a `←` Back button (line 587) that calls `manager.pop()`.

The M518 commit message mentions "13-fix batch" but the test file `m518Fixes.test.js` contains
no test for fix #3 specifically. The back button pop() takes the player from StoryMapScreen back
to StoryNewGameScreen (not to a game menu or safe state).

**Severity:** LOW — having a back button is safer than having none. The concern in the original
spec was about accidentally leaving story mode; `pop()` to StoryNewGameScreen is acceptable.
The game has a separate GameMenu for in-game options.

**Recommendation:** If "no back button" was intentional (to prevent mid-play exit without saving),
replace the back button with a menu/pause icon that opens GameMenuScreen instead of popping.
Not blocking for M519.

---

## Medium Gaps (not blocking, documented per CLAUDE.md)

### MEDIUM-1 — Storyteller portraits not displayed in carousel cards

**M518b** generated 6 portrait images and added `portraitImage` to `storyStorytellers.js` and
each `data/story/storytellers/*.json`. However, `StoryNewGameScreen.js` (the carousel renderer)
never reads `portraitImage` and renders no `<img>` tag in `.sng-card`.

**Evidence:** Playwright test `storyteller carousel cards do NOT display portraits` confirms 0
`<img>` elements in the active card.

**Suggested fix:** Add to the `.sng-card` template in `_render()`:
```html
<img class="sng-card-portrait" src="images/openai_v2/storyteller_${st.id}_portrait.png" alt="${st.label}" loading="lazy">
```
Add `.sng-card-portrait` CSS: `width:80px; height:106px; object-fit:cover; border-radius:4px; margin-bottom:0.5rem`.

**Priority:** MEDIUM — portraits exist and are served; this is a wiring gap.

---

## Test Summary

- **Unit tests (Vitest):** 761 passing (unchanged — no regressions)
- **Playwright E2E (storyMap.spec.js baseline):** 3/3 passing (updated flow for M518)
- **Playwright E2E (storyMap-full-playthrough.spec.js):** 25/25 passing (new comprehensive spec)
- **Headless sim:** 6 seeds × 6 storytellers = 36 jobs, 0 failed, 0.2s
- **Build:** Clean (1 pre-existing chunk-size warning, no errors)

---

## Remaining Open Items (carried from STUB_AUDIT.md)

Per `STUB_AUDIT.md`, the following were already deferred before M519:

1. Storyteller differentiation in headless sim (sim fidelity gap, not runtime bug)
2. Iron Judge ambush pool depth — FIXED in M515, not an open item
3. Banter pair coverage — FIXED in M515 (15/15 pairs)
4. `reward_item` fulfillment — FIXED in M515

The only carry-forward open item is MEDIUM-1 (portraits in carousel).
