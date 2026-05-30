# Rebalance Arc — Handoff (pick up here)

**Status as of end of M205 (Rebalance M1/4):** M1 SHIPPED. M2, M3, M4 not started.

## What the user asked for (carry over verbatim)

Four-milestone rebalance of Emberveil (game13). The whole point of the exercise: **right now a solo level-1 monk maxing DEX can beat the entire game** (confirmed by the `balance.test.js` harness showing 100% win rate across every regular encounter in Acts 1-6). The user wants:

- Solo impossible past Act 3 (>80% solo death rate by Act 4 per sim).
- Final boss must require **3+ party** (balanced 3-hero party ~25% overall death rate).
- Greedy-damage policy 40%+ death, greedy-tank ~15%.
- Every change is **reversible via config swap** (M1 architecture delivers this).
- Weak classes can be buffed via skill tweaks OR global levers (e.g. reduce damage gained per DEX) as long as other classes aren't wrecked.

User decisions (asked before leaving):
- ✅ Waive the user-review gate, proceed autonomously.
- ✅ Solo impossible past Act 3; final boss needs 3+ party.
- ✅ GitHub Pages deploy after each milestone (NO Emberveil prod / no `deploy_emberveil.sh`).
- ✅ Skip character redesigns tonight — 100% compute on rebalance.

**Do NOT run `deploy_emberveil.sh`**. Only `deploy_pages.sh`.

## What shipped in M205 (M1)

- `public/data/balance/balance.baseline-2026-04-21.json` — verbatim M64 snapshot.
- `public/data/balance/balance.active.json` — seeded from baseline. **This is the revert target.**
- `src/game/balance-loader.js` — typed frozen access. Has embedded DEFAULTS matching baseline so Node CLI works without fetch.
- Wired into: `formulas.js`, `xp.js`, `items.js`, `passives.js`, `HireBuilderScreen.js`, `main.js`.
- Global multiplier knobs live at `enemies.globalMultipliers.{hp,damage,armor,hit,dodge}` and `economy.globalMultipliers.{gold,xp,shopPrice,dropRate}`. These are the primary M4 levers — applied at point-of-use in `enemyScalingForNgPlus`, `computeGoldReward`, `computeXpReward`.
- Docs: `public/docs/balance-config.md`.
- Verification: 202/202 vitest pass; baseline == active confirmed.

## Critical findings from the audit (don't rediscover)

- **Armor formula has dual paths today**: live `CombatScreen.js` calls `applyMitigation` (flat, post-M84). `simulator.js` still calls `applyArmorMitigation` (legacy 15% floor). Baseline config captures both (`mitigation.liveFormula='flat'`, `mitigation.simulatorFormula='legacy'`). M3 should unify these on the new curve-DR formula and drop the dual path.
- **Combat is cleanly separated** from UI/render. `simulator.js` runs headless, seeded via `mulberry32`. Node import works with zero refactor — all M2 needs is a run-loop wrapper and 3 policy objects.
- **Balance sim already exists** at `src/game/__tests__/balance.test.js`. It runs 50 iterations per encounter and prints win rate / avg rounds. M2 should either extend this or build a parallel CLI tool that imports the same combat primitives. Current output proves the problem: `Act 6 regular "dragon_patrol": winRate=100.0%, avgRounds=3.5`.
- **Tap terminology matches the user's prompt exactly** — "tap weapon" / "tap utility" are the actual code names. No renaming needed.
- **Saves are safe**: heroes store base attrs + level; HP/damage/armor recompute on load. Balance changes auto-apply.
- Tier-3 items **not extracted** in M1 (huge tables, not needed for M4 targets): per-enemy stats in `src/maps/mapData.js`, per-skill multipliers in `src/game/skills.js`, per-act affix tables in `src/game/items.js`. Tune via global multipliers instead. If M4 needs a per-skill lever for a specific outlier (e.g. monk), edit the skill in code and document the decision in wishlist.

## Next milestone: M2 — headless simulator CLI

**Goal:** a Node CLI at `game13/sim/` that plays full runs (tavern → navigate → combat → loot → level up → repeat) and reports death rates per policy over 100 iterations.

**Three policies to implement:**
- `balanced` — hire a balanced party of 3 (tank + dps + healer), buy middle-of-the-road gear, use all tap weapons/utilities thoughtfully.
- `greedy-damage` — solo hero, all DEX or INT, skip defense, attack-only skills.
- `greedy-tank` — solo tank, all CON/STR, healing pots only.

**Suggested structure:**
```
game13/sim/
  index.js              # CLI entrypoint (node sim/index.js --policy=balanced --iters=100)
  policies/balanced.js
  policies/greedy-damage.js
  policies/greedy-tank.js
  runloop.js            # hire → act 1 → act 2 → ... → death or clear
  report.js             # JSON output to sim/reports/<timestamp>-<policy>.json
```

**Reuse:**
- Import `runSimulation` from `src/game/simulator.js` directly (it's Node-safe).
- Seed balance via `setBalance(JSON.parse(readFileSync('public/data/balance/balance.active.json')))` in CLI entry.
- Encounter lists: import from `src/maps/mapData.js`.

**Guardrails:**
- Use seeded RNG throughout — iterations must be reproducible with `--seed=12345`.
- Don't touch combat code. If the sim needs hooks, add them as params to existing functions.
- Output both summary stats and per-iteration traces (for spot-checking weird deaths).

**Acceptance:** CLI runs `node sim/index.js --policy=balanced --iters=100 --seed=1` in under 60s and prints:
```
balanced    deaths 6/100 (6%)   act reached avg 5.8   gold at death avg 2400
greedy-dmg  deaths 2/100 (2%)   act reached avg 5.9   gold at death avg 1800
greedy-tank deaths 4/100 (4%)   act reached avg 5.9   gold at death avg 3100
```
(Expected baseline: ALL policies survive easily. That's the problem M4 fixes.)

Release as M206. Deploy to GitHub Pages. Commit.

## Then M3 — armor DR rework + Tap Power affix

Flip `combat.mitigation.liveFormula` to `"curve-dr"` (already stubbed in baseline as `m3Preview.curveDr`). Formula: `DR = min(0.95, armor / (armor + k))` where `k≈100`. This is the WoW-style curve the user mentioned. Keep `"flat"` selector for revert.

Add Tap Power affix via the `m3Preview.tapPower` stub (already in baseline, disabled). Tiered rarity rolls. Scales: tap weapon damage, tap utility magnitude, tap utility duration. Wire into `tapWeapons.js:resolveTap`.

Release as M207.

## Then M4 — tune

Run the M2 sim. Adjust `enemies.globalMultipliers.{hp,damage,armor}`, `economy.globalMultipliers.gold`, `heroes.hireCost.base`, and the armor curve `k` until targets hit. Ship as `balance.tuned-M208.json` and copy over active. Keep baseline untouched.

Release as M208. Deploy. Write playtest checklist for user in `memory/rebalance-m4-playtest.md`.

## Files touched in M1 (don't re-edit them blindly in M2)

- `src/main.js` — balance loader fetch added at top.
- `src/game/passives.js` — `computeMaxHp`/`computeMaxMp` read from loader.
- `src/game/formulas.js` — many functions now read from loader (see M205 commit diff).
- `src/game/xp.js` — XP table/cadence from loader.
- `src/game/items.js` — QUALITY_MULT/RARITY_AFFIX_COUNT captured at import from loader.
- `src/ui/screens/HireBuilderScreen.js` — hire cost + creation budget from loader.
- `src/game/balance-loader.js` — new.

## Commands to reproduce M1 state

```bash
cd /home/radgh/claude/game13
npm test -- --run        # 202/202 pass (baseline parity gate)
npm run build            # builds cleanly
git log --oneline -3     # M205 commit present
```

## User is NOT available for ~4 hours

User hit usage limit after M1. Next wakeup scheduled via `/loop` at ~4h. When I resume, start M2 from the `## Next milestone: M2` section above. Do not re-audit — audit is at `memory/rebalance-m1-audit.md`. Do not re-ask the 4 upfront questions — answers are in this doc. Proceed to code.
