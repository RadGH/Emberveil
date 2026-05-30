---
name: M392 handoff — 2.5D tiles visible behind sprites
date: 2026-05-01
---

# Where we left off

User out of tokens, asked to stop and resume in 2 hours. Single open task:
**"Make 2.5D tiles visible behind sprites"** — partially shipped, deploy
pending.

## What's done

- `src/ui/ev-battlefield.css` (~line 36–44): base `.ev-tile` fill changed
  from `rgba(46,36,56,0)` / `rgba(26,17,40,0)` to `rgba(46,36,56,0.18)` /
  `rgba(26,17,40,0.40)`. The 2.5D grid now reads as a subtle overlay
  behind canvas sprites at all times. Occupied / targeting / active
  states ramp up from this baseline (existing rules unchanged).

## Release status — DONE

The background `release.sh game13` (job `b2ny92f7p`) finished
**successfully** with exit 0 after I wrote this file. Output:

```
Released:  game13_releases/dist/  (milestone_392)
Files:     7101 (+16 -16 ~138)
Date:      2026-05-01
```

Regression saves were generated at
`assets/references/emberveil/saves/regression/M392/act{1..5}_seed{43..47}.json`.
**Do NOT re-run release.sh** — M392 is shipped in `dist/`. Just
commit + deploy + wishlist + report.

## Next agent — pick up here

1. Skip the release check — M392 already shipped (see above).
2. **Visually verify** in the running dev server
   (port 5213) or against the built dist that the tile grid is now
   visible at low intensity in combat behind sprites. Take a Playwright
   screenshot if useful (`e2e/new-ui-smoke.spec.js` exists).
3. **Commit** the staged changes (avoid `assets/references/`):
   - The diff at handoff includes `src/ui/ev-battlefield.css` plus a
     bunch of pre-existing `M` files (autoBuild.js, gameState.js,
     stats.js, main.js, EvBattlefield.js, CombatScreen.js,
     InventoryScreen.js, SettingsScreen.js, SkillTreeScreen.js, plus
     test artifacts and asset JSON files). Many of those were modified
     in earlier work that may or may not be part of M392 — diff each
     one before committing.
   - Untracked: `e2e/capture-maps.spec.mjs`, `e2e/new-ui-smoke.spec.js`,
     `e2e/screenshots/new-ui-combat.png`, several phase notes under
     `memory/manual-mode-overhaul/phases/13-15`, and
     `src/game/__tests__/stats_persistence.test.js`. These look like
     genuine in-flight work — include if related.
4. **Deploy to GitHub Pages**: `bash /home/radgh/claude/deploy_pages.sh`
   (the user explicitly asked for this on the next pass).
5. **Update wishlist**: `public/assets/wishlist.html#approved-brainstorm`
   — flip the "2.5D tiles visible" item to `status-done — m392`. Then:
   `node game13/scripts/sync-wishlist-checkboxes.cjs game13/public/assets/wishlist.html`
6. Add a milestone report entry to `public/assets/assets.json` under
   `reports` (see game13/CLAUDE.md "Milestone Reports" section for
   schema). One-liner is fine given how small the change is.

## Watchouts

- Do NOT add `/home/radgh/claude/assets/references/` to the commit.
- Do NOT force-push or rewrite published history.
- The user is running low on tokens — be terse, don't thrash.
- The CSS change is the entire fix for the open task. Resist the urge
  to also touch JS unless verification reveals a real bug.

## Context refs

- M391 commit `440727779` — UI overhaul polish: canvas-driven sprites,
  occupied-only tiles. (We're undoing the "occupied-only" half.)
- `src/ui/EvBattlefield.js:336` — `_spriteLayerEl.style.display = 'none'`
  confirms sprites are canvas-driven; SVG sprite layer is dormant.
- Per `feedback_no_deferral` memory: ship the work, don't propose splits.
