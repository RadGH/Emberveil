# Emberveil

A dark-fantasy party RPG — hire heroes, explore a branching world map, fight turn-based battles, unlock tap weapons, and chase the dragon through six acts.

**▶ Play: https://emberveil.radgh.com/**

Also mirrored on GitHub Pages: https://radgh.github.io/RSG-Demos/game13/

---

## About

Emberveil is built as a mobile-first web game (portrait, iPhone 14 Pro target) that also runs on desktop browsers. No install, no login — open the URL and play.

**Features**
- 19 playable hero classes with talent trees and passive skills
- 10 recruitable companions with distinct sprites and stats
- 6-act campaign across themed zones (ember plains, thornwood, ashen peaks, the void, etc.)
- Turn-based party combat with skills, buffs, shields, and revives
- Tap weapons & utilities — 10 + 10 real-time abilities layered over combat
- Towns with merchants, blacksmith (reroll affixes), cleric, tavern (hire), forge, guild hall, and a purple black market in later acts
- Deterministic per-town merchant rolls, fame rewards, dragon-kin recruits
- Save/load, NG+, achievements, codex, quest log

---

## This repository

This repo holds the **built, deployable artifact** of Emberveil — it is not the source code. It is a pre-compiled `dist/` bundle pushed from the source repo on every milestone release.

- `index.html` — entry point
- `assets/` — hashed JS/CSS bundles (Vite output)
- `images/` — backgrounds, sprites, UI art
- `music/` — Ogg Vorbis music tracks (~64kbps)
- `sfx/` — Ogg Vorbis sound effects
- `game-info/` — in-game info pages

All images are optimized (JPEG/PNG minified) and all audio is transcoded to Ogg Vorbis before push.

---

## Deployment

Hosted on a Cloudways server with automatic git pull on webhook trigger.

**Flow:**
1. Source repo (`game13/`) builds a release via `release.sh game13`
2. A post-release step force-pushes the optimized `dist/` to this repo's `main` branch
3. Cloudways receives the webhook and pulls `main` into the document root at `emberveil.radgh.com`
4. Nginx serves static files with SPA fallback (`try_files $uri $uri/ /index.html;`)

**Force-push is intentional** — this repo tracks the *current* build, not history. Each push replaces the previous state entirely. Release history lives in the source repo's milestone tags.

---

## Tech stack

- **Build:** Vite (vanilla JS, no framework)
- **Rendering:** HTML5 Canvas 2D + DOM overlays
- **Audio:** Web Audio API with Ogg Vorbis file playback + synth fallback
- **State:** Singleton `GameState` with localStorage save/load and migration
- **RNG:** mulberry32 seeded per-town for deterministic merchant stock

---

## License

© 2026 RadGH. All rights reserved. Code and assets are provided for play only — no redistribution.
