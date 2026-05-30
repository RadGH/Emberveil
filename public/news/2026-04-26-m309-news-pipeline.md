---
title: "M313 Dev Diary — News Pipeline, Asset Snapshots & Release Tooling"
date: "2026-04-26"
category: "dev-diary"
summary: "M313 wires up four infrastructure features: a public/news/ content pipeline with a Latest News widget, versioned asset snapshots per milestone, changelog category tags in release.sh, and backward-compatibility notes surfaced in the What's New splash."
---

## M313 Infrastructure Batch

This milestone is developer-facing but has player-visible output in the What's New splash.

### News Pipeline

`public/news/` now holds Markdown files with YAML frontmatter (`title`, `date`, `category`, `summary`). A prebuild script (`emit-news-index.cjs`) scans the directory and writes `public/news/index.json`. The asset gallery homepage shows the top 3 latest news cards; a full archive is at `/assets/news-archive.html`.

### Versioned Asset Snapshots

A new script (`snapshot-assets.cjs`) runs after each `release.sh` and freezes the current `public/assets/data/*.json` state into `public/assets/data/snapshots/M###/`. The Data Overrides tool (`data-overrides.html`) now reads the available snapshots and presents a working "Restore from snapshot M###" dropdown — replacing the placeholder that shipped with M299.

### release.sh Category Tags

The release script now writes `releases[N].categories` to `game_meta.json`. Set `RELEASE_CATEGORY` env var to a comma-separated list (`feature,balance,bugfix,qol,art,infrastructure`) or the script prompts interactively. `parse-changelog-categories.cjs` uses these explicit categories when present, falling back to keyword heuristics for older milestones.

### Backward-Compat Notes

`releases[N].breakingChanges` is a new array field in `game_meta.json`. Set it via `BREAKING_CHANGES="line1|line2"` at release time. The What's New splash renders a distinct "Migration notes:" section when this field is non-empty. Retroactive notes added for M302-M307 where field changes affected save files.
