---
title: "Infinite Depths — Endless Dungeon Mode Ships in M306"
date: "2026-04-25"
category: "release"
summary: "M306 introduced Infinite Run mode — a procedurally scaled endless dungeon that ramps difficulty every 5 floors, awards exclusive affixes, and persists a personal best score across sessions."
---

## Infinite Depths: Endless Dungeon Mode

Milestone 306 shipped the Infinite Run system, a fully self-contained endless-dungeon mode accessible from the main town hub once Act 2 is cleared.

### How It Works

An Infinite Run begins at dungeon floor 1 and never ends on its own — the party pushes deeper until a full wipe. Every 5 floors the enemy power multiplier steps up by 12%. Enemies beyond floor 30 gain a random modifier (Shielded, Frenzied, or Cursed) chosen at spawn.

### Exclusive Rewards

Floors that are multiples of 10 drop an Infinite-Depth-exclusive affix that cannot appear in the standard campaign. These affixes lean toward multiplicative scaling — designed for parties already near the campaign stat ceiling.

### Score and Leaderboard

A personal best (deepest floor reached this session) is stored under `infiniteRun.bestFloor` in the save file. Null on saves predating M306 — migrated lazily on first Infinite Run access. A future milestone will surface a cross-save hall-of-fame; for now the best is displayed in the town hub UI.

### Balance Notes

The mode is intentionally tuned harder than Act 6. Solo heroes can reach floor 8–12 before the difficulty wall hits; a fully optimized 8-member party can push floor 40+ on current balance numbers.
