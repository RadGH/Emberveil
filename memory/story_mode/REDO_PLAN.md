# Story Mode Redo Plan

Date: 2026-05-30
Branch: staging

## Objective

Redo the Story Mode arc from the M500 design baseline with a higher quality bar than
the M501-M521 pass. The restored source currently contains the prior Story Mode
implementation, so this redo will use that code as forensic material and replace or
harden shallow parts instead of blindly deleting working Classic Mode systems.

## Delta From Prior Pass

1. QA gates happen before milestone claims. Every meaningful change gets unit tests,
   Story content validation, a production-like Vite build, and an iPhone 14 Pro
   Playwright smoke where applicable.
2. Storyteller simulation must exercise storyteller-aware routing. Byte-identical
   storyteller runs are considered a failure, not a documented gap.
3. Stub pools and placeholder behavior are not allowed. Any `_stub`, TODO, no-op
   effect, or defensive fallback must either become real content/behavior or be
   explicitly documented before release.
4. Content quality is part of the build. Generated dialog must be narratively
   reviewed before it is treated as shipped content.
5. Balance acceptance uses the original plan thresholds, including Iron Judge
   Act-3 Normal completion in the 30-70% band.

## Immediate Milestones

### R01 — Recovery And Baseline Verification

- Restore source, scripts, tests, data, prompts, and memory into the Emberveil repo.
- Exclude secrets, signed download URLs, local caches, generated test videos, and
  prior build output from git.
- Verify Story content manifest, quest graph, unit tests, and Vite build.
- Push the recovered source to `staging`.

### R02 — Stub And Contract Audit

- Search source/data/tools for stubs, TODOs, `console.warn` no-op handlers, `alert(`,
  field-name drift, and fallback-only story paths.
- Produce `memory/story_mode/REDO_AUDIT.md` with each finding mapped to fixed,
  intentionally defensive, or blocked.
- Fix immediate contract violations in the same milestone.

### R03 — Foundation Hardening

- Lock `pressureMeter`, `recentHistory`, and quest status constants behind helpers.
- Add tests preventing the M514/M519/M521 regressions from returning.
- Ensure all 22+ story effects mutate real state or fail validation.

### R04 — Director-Aware Sim And Balance

- Add/repair `directorAwarePolicy` so the campaign sim calls `stepDirector` and biases
  node choice by storyteller intent.
- Add tests proving the six storytellers produce observably different 100-node runs.
- Rebuild the balance matrix and tune Iron Judge into the required 30-70% Act-3 band.

### R05 — Content Quality Pass

- Re-read generated dialog pools, reject weak/off-tone nodes, and record the review.
- Remove placeholder pool files after real coverage is confirmed.
- Verify all named companions are recruitable and all 15 banter pairs have live entries.

## Release Discipline

Each redo milestone must commit locally before push. A milestone is not complete until
the final response or milestone report says what shipped, what was tested, and what is
not done, if anything.
