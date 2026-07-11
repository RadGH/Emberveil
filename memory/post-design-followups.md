# Post-design follow-up checklist (separate from the design migration)

User flagged these on 2026-04-29 while the design migration was in flight.
They are independent work — handle after the design migration is complete OR
between design milestones if a natural pause appears. Per the
no-silent-shelving rule, every item below MUST be addressed; flag a real
blocker if any item turns out to be impossible.

## Items

- [ ] **Combat-end modal duplicate** — `.cbt-end-modal` appears twice after combat ends. Likely double-mount or missing teardown in `CombatScreen._showEndModal` or wherever it lives. Check that the modal is removed before being added on the next end event.

- [ ] **Legendary fire-damage attribution** — User has a legendary item that deals fire damage to remaining enemies after a kill. Currently the Combat Report attributes that damage as "Attack". It should be a separate row labeled with the item's name (or at minimum "Fire Damage"). Trace the legendary effect emission path → recordKill / damage-meter aggregator → make the source typed.

- [ ] **MAJOR REBALANCE — make Act 3 hard** — Save evidence at
  `/home/radgh/claude/assets/references/emberveil/saves/emberveil-save-knightly-2026-04-28-3.json`.
  Single character on auto-pilot soloed Ember Sovereign: player dealt 1104 dmg,
  enemies dealt 29/24/24. Shield Bash 308 dmg + 27 heal. 4x too easy.
  - Enemy HP +300% across the board.
  - Boss HP +600%.
  - Enemy damage ×2.
  - Run Monte Carlo simulations with a single auto-piloted Knight in Act 3 — survival % should be very low or zero. That's fine for the test.
  - Ensure simulator uses level-scaled hero, real attribute/skill/passive/equip allocation (not the simplified party from balance-snapshot.cjs).
  - **Do NOT push to live emberveil.radgh.com** — github pages only.
  - Compare pre/post in chart.js report; ship to `/assets/balance-report.html`.

- [ ] **Travel back to <region> popup OK button** — does nothing on click. Find the modal handler in MapScreen / FastTravelScreen, ensure the OK callback actually fires the travel.

- [x] **Combat-end modal duplicate** — fixed M368 (added `_endModalShown` guard + DOM cleanup before mount).
- [x] **Travel-back popup OK button** — fixed M368 (innerHTML was reset every render frame, killing the click handler mid-event).
- [x] **Legendary fire damage attribution** — fixed M369 (Dragon Breath, Arcane Bounce, Mana Shockwave, Echo Cast all pass sourceName + element to applyDmg now).
- [x] **MAJOR REBALANCE — make Act 3 hard** — shipped M370 (github pages only, NOT live emberveil.radgh.com). All enemies HP×4 dmg×2, bosses HP×7 dmg×2. Solo Knight Act 3: 0% survival.
- [ ] **Console TypeError at Qh** — STILL OPEN. `Uncaught (in promise) TypeError: Cannot read properties of undefined (reading 'd3065294-431d-4683-a094-26ace91f7742') at Qh (play-CFcfh_xo.js:1041:14798)`. The double-victory-sfx that preceded it was fixed by M368, so this may have been a downstream artifact of the duplicate modal. **Next step:** retry post-M368 and confirm whether the TypeError still reproduces. If it does, repro context needed (which save / encounter / which legendary effect was triggering).

## Rules of engagement

- These items DO NOT block the design migration. Resume design work after each one or batch.
- Iterate over multiple milestones (per the iterate-over-milestones memory rule).
- Do NOT skip or shelve any item. Flag specifically if blocked.
