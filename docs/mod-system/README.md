# Mod System & Schema Guide

> **Status:** Living document. Generated from a full codebase audit on **2026-04-16** (M64-era code). If you change the combat loop, stat keys, spell schema, or event format, **update the matching file in this folder** — these notes are what future sessions read instead of re-auditing 100k+ lines.
>
> **Who this is for:** humans reading on GitHub who want to understand how Emberveil's combat, data, and event systems fit together, and anyone (human or LLM) about to design mods, import custom characters, or extend the simulator.

## Table of Contents

1. [**Combat Cycle**](./combat-cycle.md) — turn order, damage pipeline, mitigation, crits, AoE falloff, status ticks.
2. [**Data Schemas (as-built)**](./data-schemas.md) — every stat/affix/skill/item key name in the current code, with the **inconsistencies called out** (`STR` vs `str`, etc.).
3. [**Spells & Skills Catalog**](./spells-and-skills.md) — the 82 base spells grouped by mechanic (not element) so it's obvious which are functionally redundant.
4. [**Events & Cross-Event Memory**](./events.md) — current random-event format and a proposed "flag ledger" that lets rescue-NPC-A later remember and repay you.
5. [**Proposed Unified Mod Schema**](./proposed-schema.md) — a single consistent JSON format for classes/spells/items/events that eliminates the `str`/`strength` typo class of bugs.

## Quick Mental Model

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│  Content    │ ──▶ │  Combat     │ ──▶ │  World /     │
│  (JS objs)  │     │  Simulator  │     │  Event state │
│  classes    │     │  turn loop  │     │  map nodes   │
│  skills     │     │  formulas   │     │  random evts │
│  items      │     │  statuses   │     │  companions  │
│  enemies    │     │             │     │              │
└─────────────┘     └─────────────┘     └──────────────┘
   src/game/*        src/game/sim        src/maps/*
                     CombatScreen.js
```

All "content" is currently **hardcoded JS objects** (not JSON), scattered across ~10 files. That's the first thing a mod system has to fix.

## The One Bug Class We Want to Kill

Across the codebase, the strength stat is spelled **four different ways** depending on context:

| Context | Key | Example |
|---|---|---|
| Base attributes on a unit | `STR` (UPPERCASE) | `member.attrs.STR` |
| Skill damage scaling | `'str'` (lowercase string) | `{ damageStat: 'str' }` |
| Equipment affix | `'str'` (lowercase) | `{ stat: 'str', value: 2 }` |
| Passive bonus output | `STR` (UPPERCASE) | `getPassiveBonuses() → { STR: 1 }` |

Any mod author — or future refactor — will hit this. The [proposed schema](./proposed-schema.md) picks one spelling and validates it at load time so typos fail loudly instead of silently returning `undefined` and dealing 0 damage.

## How these docs stay fresh

- The HTML quiz-report at `public/assets/mod-system-report.html` links here and vice versa.
- `release.sh` does **not** auto-regenerate these files — they are hand-maintained.
- When you ship a milestone that touches combat/data, add a dated note to the top of the relevant file: `> **Updated 2026-MM-DD (M##):** …what changed…`
- The file-level "Updated" lines are what tells a future reader (or LLM) whether the doc still matches the code.
