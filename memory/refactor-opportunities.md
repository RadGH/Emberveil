# Emberveil — Refactor Opportunities (compiled 2026-05-18)

Honest punch-list of things built fast that deserve a proper pass. Ordered
by value/risk. Each: problem → why it matters → suggested fix → risk.

## Tier 1 — Correctness / architecture (highest value)

1. **No ESLint enforcement.** `npm run lint` only prints a v9 flat-config
   migration notice and exits 0 — it's not actually linting. Many bugs this
   session (synthetic-id sprite fallthrough, vestigial `death` variant,
   `ev.stopPropagation` undefined) would've been caught. Fix: migrate to
   eslint.config.js (flat), wire into release.sh as a real gate. Risk: low,
   high payoff.

2. **`mapData.js` is a 3400-line god-file.** ✅ DONE (2026-05-18). Split into
   `nodeTypes.js` (19) + `zoneTables.js` (37) + `dungeons.js` (174) +
   `zones.js` (367) + `dialogEvents.js` (1913); `mapData.js` (960) is now a
   pure facade that re-exports the identical 32-export surface and still
   orchestrates the in-place zone-build pipeline in the original order.
   Behaviour byte-identical — frozen-snapshot gate
   `scripts/verify-mapdata-exports-parity.mjs` → 0 diffs. No new import
   cycle (dialogEvents only pulls gameState + recurringNpcEvents).

3. **CombatScreen.js god-file.** ⏳ PARTIAL (2026-05-18, M499). 4 safe seams
   extracted to `src/ui/screens/combat/`: combatTooltips (136),
   combatEnemyAI (239), combatMeterUI (272), combatEndUI (130).
   CombatScreen 8581→7955. All gates green per seam.
   **Deliberately deferred (each its own future engagement, NOT shelved):**
   (3a) `_victory`/`_showVictoryModal`/`_showBossDeathCinematic`/`_defeat`
   (~400 lines, mutate GameState + loot/XP — regression gate can't catch a
   wrong boss-unlock string or lost xp stack);
   (3b) `draw`/`_drawUnit*`/`_drawBackground`/`_drawWeather` (canvas loop
   entangled with 12+ live mutable arrays — aliasing risk > lines saved);
   (3c) `_executeSkill`/`_applyDamage`/`_basicAttack` (~500 lines, the
   precision routines check-regression exists to protect; needs the
   simulator run against old+new paths simultaneously);
   (3d) `_build`/`_renderHud`/`_openPauseMenu` (large DOM, not a safety
   concern — a future UI-only pass).
   Each of 3a–3d should be its own gated engagement with a bespoke
   before/after equivalence harness, not bundled.

4. **Save schema has no version/migration system.** Saves embed hero/companion
   objects; the 4 pre-existing `hire_*` orphans are unmigrated legacy ids that
   every save-load-test run warns about. Add `saveVersion` + a migration
   chain so old saves get normalized on load instead of carrying orphans
   forever. Risk: medium; do behind the existing save-load-test gate.

5. **Sprite resolution still has 3 fallback layers.** `getSpritePath` →
   manifest → legacy convention → onerror chain in markup. Post-M496 the
   manifest is canonical so the legacy convention fallback is now dead weight
   and masks missing art instead of failing loud. Make a missing sprite a
   visible placeholder + a build-time assertion, not a silent 404.

## Tier 2 — Consistency / dedupe

6. **Two deploy paths, recurring DNS/408 flakiness.** deploy_pages.sh +
   deploy_emberveil.sh duplicate clone/rsync/push logic. Extract a shared
   `lib/git-deploy.sh` (SSH, retry, postBuffer, fail-fast) both call. The
   parallel-deploy DNS race we hit twice would go away with a serialized
   shared helper.

7. **Inline `style=""` for static values persists in older screens.** The
   repo rule is "no static inline styles" but pre-M450 screens
   (StatsScreen, some dialog/townscreen markup) still violate it. A lint
   rule (see #1) + a sweep. Low risk.

8. **Page chrome partially duplicated.** `shared/nav-header.js` +
   `shared/footer.js` are shared, but several catalog/data HTML pages still
   carry their own near-copies of bg-filter / lightbox / grid CSS despite the
   M470 `_shared/` extraction. Finish routing ALL of them through
   `_shared/sprite-grid.*` + `_shared/lightbox.*`.

9. **`emit-game-data.cjs` mixes paradigms.** Post-M496 it's pass-through for
   the migrated domains but still regex-scrapes the *non-migrated* ones
   (dungeons, status-effects already JSON now but achievements, items-craft).
   Either finish migrating those or clearly section the file. Decide and
   finish — half-migrated is the worst state.

## Tier 3 — Polish / tech debt

10. **No CI.** Everything is local release.sh. The 10 verification gates +
    308 tests should run on push (GitHub Actions on the mirror). Catches
    regressions before a manual deploy.
11. **Bundle is 1.8MB / one chunk.** The chunk-size warning is ignored every
    release. Code-split the route screens (dynamic import already used
    sporadically) — real mobile-load win.
12. **`window.__*` debug flags are ad hoc** (`__combatDebug`, `__statsDebug`,
    `__recruitDebug`, `__USE_CANONICAL_DATA`). Centralize into one
    `debug.js` registry with a single in-game toggle panel.
13. **Image pipeline has 3 generators** (openai_v2, spritecook, legacy
    sprites) + per-bucket conventions. Document the canonical decision tree
    (already partly in SITE_OVERVIEW) and delete the dead `sprites/` legacy
    bucket once nothing references it.
14. **Regression thresholds are a snapshot, not asserted intent.**
    check-regression compares to a frozen snapshot; nobody re-baselines
    deliberately. Add a `--rebaseline` flow + a note in the report when a
    balance change is intentional vs drift.
15. **Dead code from reverts.** M448/M449, M466, the 2x Dragon King attempt,
    `_pre_*` backup dirs — periodic prune pass; they confuse the next
    refactor.

## Suggested order
Do #1 (lint gate) first — it's cheap and makes every later refactor safer.
Then #6 (shared deploy lib) and #10 (CI) for release safety. Then the big
file splits #2/#3 behind the now-solid gate suite. Save schema #4 needs its
own careful staged pass. Everything else is opportunistic.
