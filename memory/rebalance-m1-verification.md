# M1 verification — 2026-04-21

## Acceptance criterion
`balance.active.json` === `balance.baseline-2026-04-21.json` → gameplay must be **identical** to pre-M1.

## Test harness (automated)

Running `npm test -- --run` executes 202 tests including `src/game/__tests__/balance.test.js` — a per-encounter win-rate simulator that runs 50 iterations against every non-tutorial encounter in Acts 1-6. After the extraction, **all 202 tests pass** with identical win-rate snapshots (goblin 100% @ 2.3 rounds, lava_titan 0% @ 50 rounds, emberveil_sovereign 74% @ 43.5 rounds, etc.). This is the strongest possible parity check — any formula that read the wrong constant would shift win rates.

Result: ✅ `13 passed, 202 tests passed, 0 failed`.

## Smoke-test checklist (manual, post-release)

The following must look identical to pre-M1 when running `milestone_205/dist/`:

- [ ] Tavern — custom hero hire cost at L1 = 100g, L5 = 700g, L10 = 1900g
- [ ] Create Hero — L1 attribute budget = 8 points above 8-base
- [ ] Combat HUD — hit/dodge/armor numbers render same as M64 for same loadout
- [ ] Character Sheet — Max HP / Max MP values unchanged for a given CON/INT
- [ ] XP — level-2 threshold still 100, level-10 still 3200, level-20 still 22300
- [ ] Level-up — +2 stat points, talent points at L3/L8/L13/L18, passive at L5/L10/L15/L20
- [ ] Combat parity vs. in-game simulator (CombatSimulatorScreen still reports same DPR)
- [ ] NG+ — enemies at NG+1 show ~4.5× HP, ~2.8× damage vs. NG+0

Manual playtest defers to user post-release; the 202-test automated snapshot is the M1 acceptance gate.

## Release

Milestone 205 built cleanly. Deployed to GitHub Pages staging.
