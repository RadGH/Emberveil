# CLAUDE.md

> ## ⚠️ Release layout changed 2026-04-26
>
> `game13_releases/milestone_N/` folders are gone. The current build lives
> only at `game13_releases/dist/`. The milestone number is now read from
> `game13_releases/game_meta.json` (largest key in `releases`). `release.sh`
> still works the same way — only the output path moved. See
> [`/home/radgh/claude/RELEASE_PROCESS.md`](../RELEASE_PROCESS.md) for full
> details.

> ## 📚 Canonical Docs
>
> Policy + reference markdown lives in `public/docs/` and is served at `/assets/docs.html`. Keep these docs current whenever you change the underlying system — if you touch asset pipeline, update `asset-types.md` / `image-policy.md`; if you touch mod schemas/DSL, update `schema-reference.md` / `mod-authoring.md`. Docs-out-of-sync is a bug.
>
> - `public/docs/no-silent-shelving.md` — the delivery rule (also summarized below)
> - `public/docs/image-policy.md` — 7-pose canonical spec, "no walk animations" rule
> - `public/docs/asset-types.md` — storage + indexes
> - `public/docs/prompt-templates.md` — SpriteCook prompt templates
> - `public/docs/schema-reference.md` — mod v1 schemas + DSL ops
> - `public/docs/mod-authoring.md` — how to write a pack
>
> ## 🛠️ New-tool flag rule
>
> Libraries ≤25KB gzipped are auto-approved (still prefer lean). Anything larger: name it + size + reason in the response and wait for approval. Log accepted adds in `wishlist.html` Technical Debt Registry with their tradeoff.
>
> ## ⚠️ NO SILENT SHELVING — read this first
>
> When the user sends a list of requests (bug fixes, features, suggestions), the default contract is:
>
> 1. **Every item must be implemented in the same response cycle.** Scope is the user's call, not yours.
> 2. **If you cannot implement an item, call it out BEFORE you start work** — name the item(s) and why, and wait for confirmation. If the user doesn't confirm a deferral, implement it.
> 3. **Never silently shelve an item into a "deferred" note in the changelog.** If it's not done, say so explicitly in the response.
> 4. **No milestone is "shipped" until every item from the user's last message is either implemented or explicitly deferred with confirmation.** Do not run `release.sh` before this.
> 5. **At the end of a multi-item request, audit your own work** against the original list — ✅ done with file:line, or ⚠️ deferred with reason.
>
> **Why this exists:** In M46–M53, multiple requested items (Attack/Spell damage in Character Stats, Hire Custom per-level pricing, black market, 8+8 editor budget, passive trees, parallax backgrounds, branching dialog, travel animations, etc.) were silently shelved into "deferred" changelog notes. Do not repeat.

---

> ## 📋 SESSION START — read the wishlist FIRST (M292+)
>
> The active workplan lives in `public/assets/wishlist.html` under the
> **"Approved Brainstorm — Milestone Plan (M293–M309)"** section
> (`#approved-brainstorm`). 93 items grouped by target milestone, with 19
> manual user additions inlined as `<strong>Manual #N:</strong>` notes.
>
> At the start of every session:
>
> 1. Open `public/assets/wishlist.html#approved-brainstorm`.
> 2. Find the next milestone whose items are still `status-todo`.
> 3. Flip those items to `status-wip` when work starts.
> 4. Flip to `status-done — m###` when shipped (use the actual landed
>    milestone number; if M293 slips to M295, the tags follow).
> 5. The brainstorm.html "Approved" section mirrors this list as read-only
>    reference. Source of truth is wishlist.html.
> 6. NO SILENT SHELVING. If an item slips, surface it in the response and
>    update its tag — do not let it disappear.
>
> All future approved batches use the same milestone-grouped pattern. Do
> not revert to flat lists.
>
> ---

> ## ⚡ RESUME HERE — M64 shipped (2026-04-13)
>
> M64 landed 19 items. All shipped unless flagged:
>
> 1. Skill rework talent cadence 3/8/13/18/23/28.
> 2. Ring auto-slot on equip.
> 3. Portal-only "Return to town" button (gated to portal nodes).
> 4. Blue portal icon on the town portal node.
> 5. Removed cloud drift on the world map.
> 6. Travel indicator only shown on current zone.
> 7. 10 new companion encounters (dire_wolf, forest_owl, ember_drake, shadow_cat, crystal_golem, spirit_wisp, bone_hound, ice_sprite, swamp_frog, void_moth).
> 8. ~60 SFX + 3 music tracks generated via ElevenLabs (public/sfx, public/music).
> 9. 10 map backgrounds (public/images/map_bg).
> 10. Menu background + 3 cloud parallax layers (public/images/menu_bg), wired into TitleScreen during the finalization pass.
> 11. Purple Black Market unlocked in Acts 4–5.
> 12. Forge added as a town service.
> 13. Town tab bar routing fix (large Merchant/Tavern buttons now wired).
> 14. Trophies → Achievements rename.
> 15. Weapon variety + starting equipment pool.
> 16. Starting equipment surfaced on Create Hero.
> 17. Split Disable Backgrounds / Disable Sprites toggles in settings.
> 18. demo-assets "Play Game" button routes to /game13/.
> 19. Level-up summary dialog per character.
>
> Follow-up candidates (known open issues, NOT silently shelved — decide next cycle):
> - Hover-preview tooltips on the Forge upgrade list.
> (Companion walk/attack animation entry removed in M236 — companions are now generated per-game by the seeded tavern roll and no longer map 1:1 to a fixed sprite set.)
>
> Prior batches (M46–M55, M56–M63) are shipped. NO SILENT SHELVING still applies.

---

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## Project

**game13** — game13 — [description TBD]

See `game.md` for the full game design document.

## Platform & Target Device

- **Primary target:** iPhone 14 Pro (393×852 CSS px, 3× DPR)
- **Orientation:** Portrait only — lock orientation, do not support landscape
- **Responsive:** Adapts to screen size within portrait constraints (tablet, desktop in portrait window)
- **No install required:** Runs in mobile Safari and desktop browsers as a standard web app

## Tech Stack

- **Framework:** [To be determined during design phase — see game.md]
- **Build:** Vite
- **Language:** JavaScript (no TypeScript)
- **Port (dev):** 5213
- **Lint:** ESLint

## Commands

```bash
npm run dev       # Vite dev server on port 5213
npm run build     # Production bundle → dist/
npm run lint      # ESLint
npm test          # Vitest (if tests exist)
```

## Architecture

[Filled in after design phase. See game.md for planned structure.]

## Development Workflow

Implement in milestone order defined in `game.md`. Do not skip milestones.

## Releases

After completing each milestone:

1. **Set `RELEASE_SUMMARY` first**, then run the release script:
   ```bash
   RELEASE_SUMMARY="M### — 2-4 sentence summary of what shipped" \
     bash /home/radgh/claude/release.sh game13
   ```
   The `releases[N].summary` field drives the per-milestone entries on the
   RSG-Demos main page. If this is empty, the release shows up as
   "no summary recorded" — **always** set it. release.sh prints a loud
   warning if it's missing.
2. After the script finishes, **update game_meta.json** (the hook will remind you):
   - Confirm `releases[N].summary` is populated (REQUIRED — main-page changelog)
   - Read `memory/future_milestones.md` → update the `milestones` field (mark COMPLETE, update future plans)
   - Prepend a longer-form entry to the `changelog` field
3. Mark milestone COMPLETE in `memory/future_milestones.md`
4. **Generate a milestone report** — append a new entry to `public/assets/assets.json` under the `"reports"` array (see Milestone Reports section below)
5. Deploy to GitHub Pages: `bash /home/radgh/claude/deploy_pages.sh`

Releases are served at `http://localhost:5247/game13/` (latest milestone only) via the shared release server.

**Wishlist sync.** After updating `public/assets/wishlist.html`, normalize checkbox state with the local copy of the workspace helper:

```bash
node game13/scripts/sync-wishlist-checkboxes.cjs game13/public/assets/wishlist.html
```

## Agents & Workflow

When starting a new feature or milestone, follow the multi-agent workflow:

1. **Prompt Expansion** — Expand the user's short description into a detailed implementation spec
2. **Brainstorm Report** — Generate `brainstorm-report.html` covering design options, risks, UX considerations
3. **Project Manager Agent** — Dispatches parallel Developer and Design agents for each component
4. **QA Agent** — Runs `voltagent-qa-sec:accessibility-tester` and cross-browser/navigation checks after each milestone
   - Tests must pass on iPhone 14 Pro viewport (393×852) in Safari
   - Also tests in Chrome desktop and Firefox

## Asset Gallery (`/assets/`)

All generated images — regardless of source (OpenAI API, PixelLab, SVG-pure, or any future image generator) — **must be cataloged in `public/assets/assets.json`** and are viewable at `/assets/` in any running server or release.

The gallery page (`public/assets/index.html`) is pre-built and requires no code changes. It loads `assets.json` automatically and shows an empty-state when no assets exist yet.

### Adding an asset

Every time you generate or add an image to the project, append an entry to `public/assets/assets.json`:

```json
{
  "id": "bg_forest_01",
  "name": "Forest Background",
  "category": "background",
  "source": "openai",
  "file": "../images/bg_forest.png",
  "prompt": "Dense mystical forest at dusk, pixel art style, 16-bit palette, dark greens and purples",
  "notes": "Used as level 2 backdrop"
}
```

**Field reference:**

| Field | Required | Values |
|-------|----------|--------|
| `id` | yes | Unique snake_case identifier |
| `name` | yes | Human-readable label shown in gallery |
| `category` | yes | `background`, `portrait`, `icon`, `ui`, `sprite`, `other` |
| `source` | yes | `openai`, `pixellab`, `svg`, `manual`, `other` |
| `file` | yes | Path relative to `assets/` (e.g. `../images/foo.png`) |
| `prompt` | if applicable | The exact prompt used to generate the image |
| `notes` | optional | Any extra context (variant, usage location, etc.) |

### Rules

- **Add the entry at the same time you add the image file** — do not batch catalog updates.
- SVG assets generated purely in code should set `"source": "svg"` and leave `prompt` empty or describe the shape/intent.
- The gallery is intentionally always present, even before any assets exist, so the `/assets/` URL is always valid.

## Milestone Reports (`/assets/` → Reports section)

At every **major milestone** (and at any significant mid-milestone checkpoint), generate a **highly detailed report** and append it to the `"reports"` array in `public/assets/assets.json`. The report is rendered in the Reports section at the bottom of the Asset Gallery page.

### Report schema

```json
{
  "milestone": "Milestone 1 — Core Gameplay",
  "date": "2025-01-15",
  "summary": "One-sentence description of what this milestone delivered.",
  "changes": [
    "Added player movement with velocity-based physics",
    "Implemented tile-based collision detection",
    "Wired up score counter with localStorage persistence"
  ],
  "bugs": [
    "Double-jump occasionally triggers on fast tap — root cause unknown, tracked",
    "Score flickers on first render frame"
  ],
  "suggestions": [
    "Consider coyote-time for jump forgiveness near ledge edges",
    "Sound feedback on coin collect would improve feel"
  ],
  "recommendations": [
    "Refactor collision loop before adding enemy AI — current O(n²) will not scale",
    "Add a game-state machine before Milestone 2 to avoid spaghetti mode flags"
  ],
  "ideas": [
    "Procedural level generation for endless mode",
    "Daily challenge seed shared via URL hash"
  ],
  "notes": "Any other observations, context, or things worth remembering about this milestone."
}
```

**Field reference:**

| Field | Required | Description |
|-------|----------|-------------|
| `milestone` | yes | Milestone name and number |
| `date` | yes | ISO date the report was written (YYYY-MM-DD) |
| `summary` | yes | Single sentence — what was delivered |
| `changes` | yes | Bullet list of everything implemented or changed |
| `bugs` | yes | All known bugs at time of report, even minor ones |
| `suggestions` | yes | UX/feel improvements worth considering |
| `recommendations` | yes | Technical / architectural recommendations for upcoming work |
| `ideas` | optional | Future feature ideas sparked during this milestone |
| `notes` | optional | Anything else worth preserving |

### Report quality bar

- **Be exhaustive.** A thin report is worse than no report. Every bug you noticed, every edge case you deferred, every design decision you made — write it down.
- **Be specific.** "Improved performance" is not useful. "Reduced main loop from 4 ms to 1.2 ms by culling off-screen sprites" is.
- **Write for your future self.** The next agent picking up this project should be able to read the report and understand exactly where things stand.

## Memory

- `memory/future_milestones.md` — milestone plan and completion status
- `memory/MEMORY.md` — index of all memory files
- Additional memory files added as the project grows

## API Keys

All API keys live in `/home/radgh/claude/assets/references/` which is **excluded
by `.gitignore`**. Never read or commit anything from a different keys path.
See `public/docs/api-keys.md`.

## No Emoji - Use Font Awesome or Glyphs

Avoid using colored emoji like 🚩. Flag with single colors (on Windows 11 Chrome as a comparison) are better accepted ⯁. If possible, use the CSS property `font-variant-emoji: text;` for game content and web pages.

Make use of the Font Awesome 6.7.2 Free and Pro versions when available. User prefers to use SVG assets in game, but web fonts are also available.
/home/radgh/claude/assets/fontawesome-pro-6.7.2-web/svgs
/home/radgh/claude/assets/fontawesome-free-6.7.2-web/svgs
/home/radgh/claude/assets/fontawesome-pro-6.7.2-web/webfonts
/home/radgh/claude/assets/fontawesome-free-6.7.2-web/webfonts

## QA Checklist (per milestone)

- [ ] Portrait lock active — no landscape layout breaks
- [ ] Touch targets ≥ 44×44 CSS px
- [ ] No horizontal scroll on iPhone 14 Pro
- [ ] Text readable without zoom (≥ 14px effective)
- [ ] Core navigation works in Safari Mobile, Chrome, Firefox
- [ ] Performance: no janky animations on mid-range device
- [ ] Accessibility: semantic HTML, ARIA labels on interactive elements

---

## SETUP INSTRUCTIONS (remove this section after setup)

When creating a new game from this template:

1. Replace `game13` throughout with the new game directory name (e.g. `game11`)
2. Replace `5213` with a unique dev port (e.g. `5220` — check other games to avoid conflicts)
3. Create `game13_releases/` directory alongside `game13/`
4. Create `game13_releases/game_meta.json` with `{ "name": "game13", "description": "", "changelog": "", "milestones": "", "releases": {} }`
5. Add `game13` entries to `/home/radgh/claude/release.sh` (GAME_SRC, GAME_RELEASES, GAME_DISPLAY arrays + usage echo)
6. Add `game13` to `/home/radgh/claude/game2_releases/serve.js`:
   - Add `const game13_DIR = path.join(__dirname, '..', 'game13_releases');`
   - Add `game13: game13_DIR` to GAME_META_DIRS
   - Add `getGameKEYMilestones()` function
   - Add cards + tab + panel to `buildIndexPage()`
   - Add route handler for `/game13/milestone_N/`
7. Restart server: `bash /home/radgh/claude/restart_server.sh`

## Version Control

This workspace is a single git repo at `/home/radgh/claude/`. All games live on `main`. Treat `git` as the safety net — every milestone release should be committed before deploying.

The user does NOT manage git directly. Claude is responsible for committing meaningful changes when:
- A milestone is released (commit after `release.sh` succeeds, before `deploy_pages.sh`)
- A subagent finishes a substantial change
- The user explicitly asks

**NEVER commit anything from `/assets/references/`** — that directory contains API keys and is excluded by `.gitignore`. Double-check `git status` before every `git add .` or `git add -A`.

Commit message format: short imperative subject, optional body. Do not mention Claude in the message author or co-author lines unless the user explicitly asks.
