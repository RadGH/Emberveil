# Story Mode Redo Plan

Date: 2026-05-30
Branch: staging

## Objective

Redo Story Mode from a clean pre-Story baseline. The prior M501-M521 implementation
is not the implementation base for the redo because it contains the shallow systems,
late blocker fixes, and QA gaps called out in the handoff prompt.

## Baseline Decision

- Requested baseline commit `594940819` is not present in this local Emberveil repo
  or the nearby Codex/Claude checkouts I inspected.
- Commit `40730a2` is the clean staging baseline currently available in this repo.
  Its tree has no Story Mode source, data, sim, tools, or route imports after the
  local source restore cleanup. The remote staging commit can keep the recovered
  reference commit as a parent purely to reuse uploaded git objects; the shipped tree
  must remain the clean baseline.
- The mistakenly recovered old Story Mode implementation has been preserved only on
  branch `recovered-story-mode-reference` for forensic comparisons.
- The live redo work must be built forward from this clean baseline, using
  `memory/story_mode/*` and `/home/radgh/codex/emberveil/references/*.md` as design
  references, not as code to copy wholesale.

## Delta From Prior Pass

1. No milestone ships without an end-to-end smoke that exercises the feature in the
   UI or simulator path that will actually be used by players.
2. Storyteller simulation must route through Director decisions. Byte-identical
   storyteller runs are a failing test, not a documented limitation.
3. Every effect, pool, validator, and fallback must be real when its consuming system
   lands. Stub pools and no-op effects are blocked work, not acceptable placeholders.
4. Generated prose and generated art require review before they become shipped game
   assets. Validator-clean is not the same as narrative-ready.
5. Release notes must explicitly name anything not done. No silent shelving.

## Immediate Milestones

### R00 — Clean Baseline Reset

- Restore the Classic Mode source and project tooling onto `staging`.
- Remove prior Story Mode implementation artifacts from buildable source paths.
- Preserve prompts, planning memory, findings, and handoff material in git.
- Verify tests and build from the clean baseline.
- Push `staging` so deployment no longer points at the flawed recovered Story Mode
  source commit.

### R01 — Foundation

- Implement mode split, Story save envelope, ledger, predicate DSL, and effect runner.
- Tests cover migration, field names, deterministic RNG checkpointing, and every
  initial effect type.
- No Story UI is exposed until the save/ledger/predicate/effect contract is stable.

### R02 — Map And Screen

- Implement deterministic map generation, validators, mutations, and playable mobile
  StoryMapScreen together.
- Travel must never throw, fog-of-war must lock correctly, and Travel combat must have
  a defined encounter path before this milestone can ship.

### R03 — Quests, Dialog, Companions

- Implement quest engine, dialog conductor, companion recruitment/approval, and all
  15 banter pairs with real entries before the systems are called complete.

### R04 — Director, Encounters, Skill Checks

- Implement all six storyteller mechanics plus a director-aware sim policy.
- `buildEncounterForNode` is non-null by construction for Travel nodes.
- Skill affinity tests cover all 18 skills across all 10 classes.

### R05+ — Content, Acts, Tools, Balance, Release

- Build content to the plan counts, review generated dialog/art, wire Acts 1-3,
  add the authoring tools, run the 2400-run balance matrix, and complete deployed
  mobile QA before claiming Story Mode is shipped.

## Release Discipline

Each redo milestone gets a focused commit. Any release/deploy milestone must include
the release summary metadata, changelog/prompt-history updates, future milestone
marking, asset report entry, and staging push required by the repo process.
