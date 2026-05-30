---
title: "M302 Gameplay Batch — Companion Sync, Flee Mechanic & New Rogue Skills"
date: "2026-04-24"
category: "release"
summary: "M302 landed companion level-sync, a DEX-check flee mechanic, two new Rogue skills (Pilfer Magic and Hemorrhage), Warlock Soul Curse with curse-spread, skill-check map nodes, and a full node-overlay system for merchant, minigame, and bandit encounters."
---

## M302 Gameplay Batch

Milestone 302 shipped a focused gameplay expansion targeting party depth and map variety.

### Companion Level Sync

A new party setting lets the player choose whether companion XP tracks the lead hero or levels independently. Old saves default to independent — no data is lost on upgrade.

### DEX-Check Flee Mechanic

Fleeing combat is no longer a guaranteed escape. A DEX roll against the enemy's speed determines success. High-DEX parties (Ranger, Rogue) escape reliably; heavy warriors may take a parting blow.

### New Rogue Skills

- **Pilfer Magic** — Steals a buff from the target and applies it to the Rogue for 2 turns. Against non-buffed targets it deals bonus shadow damage instead.
- **Hemorrhage** — A bleed finisher: deals immediate damage scaled by existing bleed stacks on the target, then clears all bleed. High single-target ceiling at cost of bleed-stack setup.

### Warlock Soul Curse and Curse Spread

Soul Curse applies a curse that amplifies all damage the target receives. A new passive (Curse Spread) triggers on cursed-target death to carry the curse to the nearest adjacent enemy with 1 stack lost per transfer.

### Map Node Overlays

Three overlay types now appear on top of standard travel nodes: Merchant, Minigame, and Bandit. Each renders a distinct icon and opens a context panel on click rather than triggering standard travel logic.
