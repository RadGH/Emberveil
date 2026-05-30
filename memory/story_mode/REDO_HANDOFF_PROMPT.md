# Emberveil Story Mode — Redo From M500 (Handoff Prompt)

> **PASTE EVERYTHING BELOW THIS LINE INTO A NEW AGENT.**
> Do not paste this header.

---

# Mission

You are taking over the **Emberveil "Story Mode"** project at game13. The previous attempt
(M501→M521) shipped a working skeleton but the user judges it **unfinished and shallow**:
silent shelving of content, late-discovered BLOCKER bugs in the e2e flow, stub pools
patched after-the-fact, sim that doesn't actually exercise storyteller differences, and
a release pace that ran ahead of QA. Your job is to **redo the entire arc from M500**,
finish it properly, and prove it works end-to-end.

The original ChatGPT design doc, the prior plan, and the prior session's learnings are
all already in the repo (paths below). You will read them, plan independently, then
execute with a higher quality bar than the prior agent.

The user is the sole player. Treat their `CLAUDE.md` rule against "silent shelving" as
the highest contract: **every promised system must work in the live build, with tests,
or be explicitly flagged BEFORE you start, not after you ship.**

---

# Repo layout (you are here)

- Working directory: `/home/radgh/claude/game13/`
- Workspace root: `/home/radgh/claude/` (multiple sibling games + shared scripts)
- Live game URL after deploy: `https://radgh.github.io/RSG-Demos/game13/`
- Local dev: `npm run dev` (Vite on `5213`)

Game13 is the **Emberveil** project: vanilla JS, Vite, HTML5 Canvas, no TS, no React.
Mobile-first portrait (iPhone 14 Pro 393×852). One git repo for the whole workspace
on branch `main`.

---

# Hard rules (read CLAUDE.md, then re-read)

1. **No silent shelving.** Every item in a user request batch must be implemented OR
   explicitly flagged for deferral **before** you start work, with the user's confirmation.
   Quoting `/home/radgh/claude/CLAUDE.md`: "If it's not done, it must be in the response
   text as a visible, explicit 'not done — here's why.'" Read that file in full before
   acting.
2. **No stubs, no placeholders, no TODOs that aren't surfaced to the user.** The previous
   pass left ~15 stubs that QA had to discover. Don't repeat that.
3. **No inline `style="..."`** for static values. CSS classes only. JS-computed values
   (`el.style.left = px + 'px'`) are fine.
4. **Per-milestone release discipline.** After `release.sh game13`, you MUST set
   `RELEASE_SUMMARY` env var; update `game13_releases/game_meta.json` with
   `releases[N].summary`, `changelog`, `promptHistory`; mark milestone complete in
   `memory/future_milestones.md`; append a milestone report to
   `public/assets/assets.json` `reports[]`; THEN `deploy_pages.sh`.
5. **Git commits use email `2008464+RadGH@users.noreply.github.com`.** Never
   `claude-code@anthropic.com` (it's hijacked).
6. **Never commit `assets/references/` or anything under it** — it contains API keys
   and is `.gitignored`. Double-check `git status` before any `git add`.
7. **Mobile QA on iPhone 14 Pro Safari is the acceptance bar** — 60 FPS, 44×44 hit
   targets, no horizontal scroll, ≥14 px text, portrait lock.
8. **The current `dist/` layout is flat** — read `/home/radgh/claude/RELEASE_PROCESS.md`
   before touching any release script. There are no per-milestone subfolders.

---

# Where to start: the M500 baseline

`M500` was a major Emberveil release **before** Story Mode existed. The commit hash for
that baseline is `594940819` (Emberveil M500: game_meta milestone summary). Everything
M501 forward in `git log` is the work to redo or supersede.

You do NOT need to revert the working tree. Instead:

1. **Read `git log --oneline 594940819..HEAD`** to see what the prior agent shipped.
2. **Read the prior planning + handoff docs** (already in the repo — do not regenerate
   from scratch unless you find them wrong):
   - `memory/story_mode/HANDOFF.md` — what the prior agent claims they shipped
   - `memory/story_mode/CHECKLIST.md` — 17-phase build map
   - `memory/story_mode/1-roast.md` — the original code-review of the M500 codebase
   - `memory/story_mode/2-brainstorm.md` — design alternatives considered
   - `memory/story_mode/3-refined-plan.md` — the **1889-line binding spec**
     (predicate DSL, save schema, director math, encounter builder, mobile UX, etc.)
   - `memory/story_mode/STUB_AUDIT.md` — stubs the prior agent left
   - `memory/story_mode/QA_REPORT_M514.md` — mid-build QA findings
   - `memory/story_mode/M518D_FINDINGS.md` — late-discovered BLOCKER bugs (3 days
     after the prior agent claimed "shipped")
3. **Read the original ChatGPT plan attachment** the user supplied:
   `/home/radgh/.claude/uploads/68d92982-56b9-49d3-b214-bcce5ee319fc/b5843e84-emberveil_story_mode_claude_plan.md`
   — 2200 lines, the source of truth for design intent.

The `3-refined-plan.md` is excellent and you should largely trust it. Where the prior
agent shipped against it shallowly, that's where your redo needs depth.

---

# What the prior agent did (M501→M521) — and where it fell short

## Shipped scope

`M-S01..M-S30` ran from M502 to M512. The 30-milestone build hit, in order:
mode split + save slots → ledger + RNG checkpoint → predicate DSL → effect runner →
map graph + 6 validators → StoryMapScreen → map mutations → campaign sim → byte parity →
worker-pool CLI → quest engine → dialog conductor → companion system → Director engine →
6 storyteller mechanics → encounter builder → enemy instance + boss variants →
skill-check resolver → hand-authored content seeds → LLM dialog gen (283 nodes) →
40 sprites (20 NPCs + 20 enemies via OpenAI 9-pose) → Act 1/2/3 wiring → mobile UX
polish → 5 authoring tool pages → balance matrix in CI → telemetry + 12 achievements +
audio → final release.

Then M513-M521 was the "we shipped and now we're finding bugs" tail:
- **M513**: story map JS `alert()` left in production, fog-of-war edges wrong, biome
  theming missing.
- **M514**: 9 mid-game bugs — quest status `'completed'` vs `'complete'` mismatch,
  pressure field name mismatch (`pressure` vs `pressureMeter`) in **three** places,
  `recentHistory.slice(-5)` called on an object not an array, companion tab read
  `c.benched` (undefined), Journal screen showing empty data, etc. Plus stub closures:
  ambush pool +6, omen pool +6, banter 5 → 15 pairs.
- **M515**: stub closures for reward_item effect, lock validator, banter coverage.
- **M518**: another 13-fix UX batch — staggered grid, trailhead node, fog-of-war
  tab locks, drawer geometry, Bezier roads, biome backgrounds, plus 6 storyteller
  portraits via OpenAI portrait-gen.
- **M519**: BLOCKER fix — `recentHistory` was a flat array in `StoryMapScreen` but
  an object in `storyLedger`; **navigating to any node threw a JS error and broke
  the game**. Plus fog-of-war BFS was wrong (all 5 tabs unlocked instantly). Plus
  storyteller portraits existed but were never rendered in the carousel cards.
- **M521**: BLOCKER fix — combat didn't start on Travel because
  `buildEncounterForNode` returned `null` when no story template was queued. Patched
  with a `mapData.ENCOUNTERS` random fallback.

**The recurring failure pattern:**

- The build raced ahead of e2e play-through. Bugs that would have been caught by a
  single 5-minute manual playthrough on the deployed build were caught days later.
- Sim runs were green but the sim **doesn't actually exercise storyteller-aware node
  selection** — all storytellers produce byte-identical runs. So "tests pass" was
  not the same as "storytellers feel different."
- The Iron Judge balance band check (per `3-refined-plan.md §10.8`) was **30–70%**
  for Act-3 Normal. The shipped matrix had Iron Judge at 96%. That was logged as a
  follow-up and not fixed.
- LLM dialog quality was never narratively reviewed. 283 nodes are validator-clean
  but no one read them.
- 40 sprites are sitting in the image-review pending batch `m357` waiting for the
  user's eyes.
- Banter, omen, ambush pools were stubs that QA had to discover and the agent had
  to scramble to fill.
- The user explicitly says: **"shallow."**

---

# Your build plan

You may improve on the 30-milestone breakdown — but only if your replacement is
demonstrably better, smaller, or fixes a known gap. **Do not abandon `3-refined-plan.md`
without writing a delta doc** that names which sections you're superseding and why.
The user expects to recognize the systems described in the original plan.

## Phase 0 — Bootstrapping (before any code)

1. Read this file. Read `CLAUDE.md`. Read `3-refined-plan.md`. Read
   `HANDOFF.md` + `STUB_AUDIT.md` + `M518D_FINDINGS.md`. Read the ChatGPT plan.
2. **Confirm the API keys are present** (paths below). If any key is missing,
   STOP and tell the user.
3. **Run a full Classic Mode regression** on the M500 baseline before you change
   anything: `npm run dev`, open the game, load a Classic save, play through a
   combat. This proves the floor.
4. Tell the user what your delta-vs-prior-plan is going to be (1-page max),
   including how you'll avoid the "shallow" failure mode. Wait for go.

## Phase 1 — Foundation (mode split, save, predicate, effects)

Stick close to `3-refined-plan.md §1-5`. The predicate DSL, effect runner, and
ledger are well-specified; reproduce them with the same op names and field
names so saves from the prior agent are at least readable for forensics.

**Where to be deeper than prior:**
- Effects: every effect type must have a real implementation, not a `console.warn`
  no-op. `reward_item` actually adds to inventory. `world_mutation` actually mutates
  the map. `add_toll` actually shows up at the next checkpoint.
- The CI validator (`build-story-content-manifest.cjs`) must enforce **every** ref:
  flags, factions, quests, items, classes, biomes, skills, NPCs, dialog `next:`
  resolution, and `reveal_path` lockIds must all resolve to a real downstream
  satisfier. The prior agent had `validateHiddenPathSatisfiability` weak; harden it.

## Phase 2 — Map + StoryMapScreen + Mutations

- Map generation must be **deterministic** for seed (per `§6.1`).
- Validators must actually run on every generated map and the salt-bump retry
  loop must work. The prior agent shipped this and it mostly works.
- **StoryMapScreen must be playable on iPhone 14 Pro from the moment it lands.**
  No `alert()` calls. No JS errors on travel (the M519 BLOCKER must not recur).
- Sub-region pagination, drawer geometry, pressure chip, fog-of-war must all be
  correct first time. The 3-fix tail in M513/M518/M519 is the failure mode you're
  avoiding.

## Phase 3 — Quest engine + Dialog conductor + Companions

- Run a full `quest-graph.html` walk for every quest line — no orphan phases,
  no unreachable outcomes.
- Dialog conductor must support cross-pool `next:` (`pool:arrival#node_id`) and
  the legacy adapter for shared NPCs.
- Companion system: all 6 named companions must be **actually recruitable**
  somewhere in the campaign. Tessaly/Bram/Yasha intros must exist in Act 2.
- Banter pools must be populated for **all 15 pairs** before M-S13 ships, not
  stub'd and patched later.

## Phase 4 — Storyteller Director + Encounter Builder + Skill Check

- All 6 storyteller mechanics must be **observable in a 100-node sim run**.
  Chronicler bonus fires, Ash Prophet omens fire on cadence, Warbringer escalation
  ramps with win streak, Trickster every-6th random fires, Pilgrim discovery 3x
  works, Iron Judge no-fallback-ambush works.
- **Director-aware sim policy is required**, not deferred. The prior agent ran
  the sim with a non-director policy and called it "fidelity gap." That's the
  shallowness the user wants gone. Write a `directorAwarePolicy` in
  `sim/story/policies/` that calls `stepDirector` and biases node selection.
- Encounter builder: `buildEncounterForNode` must NEVER return `null` for a Travel
  node. The M521 BLOCKER (combat didn't start) must not recur. The fallback to
  `mapData.ENCOUNTERS` is fine; just make sure every code path has a defined
  encounter at the moment of combat start.
- Skill check: 18-skill affinity table covers all 10 classes. Run all 18 × 10
  through unit tests.

## Phase 5 — Content (the deep pass)

This is where the prior agent was thinnest. Budget for this phase generously.

### Hand-authored seeds (target counts from `§11.5`)

- Dialog nodes: **162 seeds** across 8 pool files. Every seed must be playable
  with all 22 effect types reachable somewhere in the corpus.
- Encounter templates: **60 templates** across `encounter-templates/`. Cover
  every biome in every act.
- Side-quest templates: **20**.
- Primary quest lines: **3** (one per act), each with at least 4 phases and
  3 outcome branches.
- Secondary quest lines: **6**.
- Personal companion quests: **6** (one per named companion).
- Named NPCs: **20** (registry entries + sprite ids).
- Faction definitions: **8**.
- Lore fragments: **50 hand-authored**.
- Storyteller profiles: **6**.
- Banter entries: **15 pair files, 5+ entries each = 80+ exchanges minimum.**

### LLM-generated content

- `scripts/generate-story-dialogue.cjs` already exists; reuse the OpenAI Batch API
  flow. Target ~400 nodes across the 7 pool categories.
- After generation: **you must run a narrative review pass yourself** before
  shipping. The prior agent generated 283 and asked the user to review them via
  `/assets/story-dialog-review.html`. Don't do that — read them, reject the bad
  ones, flag the borderline ones, ship only the validated ones. The user can
  fine-tune after.
- Lore primer at `data/story/lore-primer.md` (3000–5000 tokens) drives the
  generator. Review and tighten it before any batch.

### Sprites

- 20 NPCs + 20 enemies/bosses + 6 storyteller portraits via the existing
  `scripts/openai-spritesheet-gen.py` (9-pose 3×3 grid) and
  `scripts/openai-portrait-gen.py` workflows.
- Every generated sprite must be **enrolled in the open image-review-v2 batch**
  (mandatory per workspace policy M462). The generator scripts do this
  automatically — confirm by curling the page after generation.
- Wire the portraits into `StoryNewGameScreen` cards **at the time you generate
  them**, not as a M518b afterthought.

## Phase 6 — Acts 1/2/3 wiring

Per `§15` M-S22, M-S23, M-S24. The exit criteria from the original plan are:
- Act 1 playable start-to-end in ≤45 min, hidden paths reveal correctly, 1
  companion recruitable.
- Act 2 playable, world corruption mechanic active, 3 more companions intro'd.
- Act 3 playable, final boss has ≥2 reachable variants based on choices.
- Full 3-act run completable in ≤3 hours.

**These are acceptance criteria, not aspirations.** The prior agent shipped
without the full playthrough being possible end-to-end. Don't.

## Phase 7 — Mobile UX polish

- iPhone 14 Pro Safari at 393×852, portrait only.
- Drawer peek 128 pt, expanded 360 pt.
- Pressure chip collapsed by default, taps to expand.
- Sub-region pagination via swipe past the edge + rubber-band.
- Bezier-curved roads. Staggered diagonal grid.
- Biome backgrounds at the correct opacity behind the map.
- Fog-of-war: regions locked behind padlocks until prior region has a
  `visited`/`cleared` node.
- 60 FPS sustained.
- All touch targets ≥44×44.

## Phase 8 — Authoring tools (5 HTML pages)

- `/assets/story-inspector.html` — save loader + map render + ledger dump +
  director step + flag editor.
- `/assets/quest-graph.html` — DAG render of each quest line, mobile-friendly.
- `/assets/storyteller-balance.html` — 6×4 matrix from
  `public/assets/data/story/balance/M*.json`.
- `/assets/story-dialog-review.html` — paginated dialog review, approve/reject/
  needs-edit/regen actions, state in `dialogue-review-state.json`.
- `/assets/story-campaign-sim.html` — form + WebWorker that runs `runCampaign`
  client-side and streams the log.

All use `_header.js`/`_footer.js`. No inline CSS for static values.

## Phase 9 — Balance, tests, sim matrix

- **2400-run matrix** (100 seeds × 6 storytellers × 4 difficulties) via
  `scripts/build-storyteller-balance.cjs` + worker pool.
- Threshold checks in CI (`check-storyteller-balance.mjs`) per `§10.8`:
  - Act-1 completion, Relaxed: ≥98%
  - Act-1 completion, Normal: ≥90%
  - Act-3 completion, Normal: ≥60%
  - **Iron Judge Act-3: 30–70%** (this was 96% in the prior ship — DO NOT
    ship until it lands in band)
  - `uniqueNodeTypes` per run: ≥6 mean
  - `maxSameTypeStreak`: ≤4 mean
  - No throws across 2400 runs
- 750+ unit tests minimum (prior agent shipped 736). Director, predicate,
  effects, ledger, map gen, map mutations, encounter builder, enemy instance,
  boss variants, skill check, dialog conductor, quest engine, companions —
  every module gets tests.
- Playwright e2e: full happy-path act-1 playthrough on iPhone 14 Pro viewport
  must pass before release.

## Phase 10 — Telemetry, achievements, audio, release

- `data/story/achievements-story.json` — 12 entries, all wired and triggerable.
- `data/story/audio-mapping.json` — biome → music, per-storyteller filter
  chains (the prior agent deferred filter chains; do them).
- Story SFX (5+) + biome music (9+) via ElevenLabs if missing.
- Release per the workflow in `CLAUDE.md` § Releases. Update `game_meta.json`,
  `future_milestones.md`, milestone report in `assets.json` reports[].

## Phase 11 — Final QA before user delivery

Before you tell the user "shipped":

1. **Manually play through Act 1** on the deployed build at
   `https://radgh.github.io/RSG-Demos/game13/` using Chrome devtools
   iPhone 14 Pro emulation. New Game → Story Mode → each of the 6 storytellers
   should be selectable and produce a visibly different first node sequence.
2. **Manually play through Act 2 and Act 3** to confirm completability.
3. Tour every tool page on the deployed site — no JS errors, all data loads.
4. Run the 2400-run sim matrix and confirm all thresholds pass.
5. Audit your work against the original ChatGPT plan AND `3-refined-plan.md`.
   For each section, link a file:line in your shipped code, or flag it as
   "skipped — here's why" with user confirmation.
6. Only then write the final HANDOFF.md and tell the user.

---

# Build / dev / release process

## Local dev

```bash
cd /home/radgh/claude/game13
npm install            # if dependencies missing
npm run dev            # Vite on localhost:5213
npm test               # vitest (~736 tests at M521)
npm run build          # vite build → game13_releases/dist/ (after release.sh)
npm run lint           # eslint
```

`npm run dev` will also serve all the tool pages at
`http://localhost:5213/assets/<page>.html`.

## Release a milestone

Run from `/home/radgh/claude/`:

```bash
RELEASE_SUMMARY="M### — 2-4 sentence summary of what shipped" \
  bash release.sh game13
```

`release.sh`:
1. Auto-runs `optimize_audio.sh game13` (compresses public/music + public/sfx).
2. Auto-runs `optimize_images.sh game13` if present.
3. Runs `npm run prebuild` (emits release-summary + game-data).
4. Runs `npm run build` (Vite).
5. Rsyncs `game13/dist/` → `game13_releases/dist/` (flat layout — no
   `milestone_N/` subfolder, see `RELEASE_PROCESS.md`).
6. Updates `game13_releases/game_meta.json` with the next release entry.
7. Bumps milestone number = max key in `meta.releases`.

After `release.sh`, you MUST:
- Confirm `releases[N].summary` got populated (`RELEASE_SUMMARY` env var).
- Update `meta.changelog` (newest first).
- Update `meta.promptHistory` if this milestone reflects a new user request.
- Update `memory/future_milestones.md` (mark COMPLETE).
- Append a milestone report to `public/assets/assets.json` under
  `reports[]` per `CLAUDE.md` § "Milestone Reports".

## Deploy to GitHub Pages (staging)

```bash
bash /home/radgh/claude/deploy_pages.sh
```

This script:
1. Pulls `RadGH/RSG-Demos` GitHub Pages repo to `~/rsg_demos_work/`.
2. Copies the latest milestone (just `game13_releases/dist/`) to the right
   sub-path.
3. Rewrites `VITE_BASE` for the `/RSG-Demos/game13/` sub-path.
4. Regenerates `index.html` via `generate_pages_index.js`.
5. Commits and pushes to `main` — Pages auto-serves.

Live URL: `https://radgh.github.io/RSG-Demos/game13/`

**Don't deploy to `emberveil.radgh.com` (prod) unless the user explicitly says
"live" / "prod" / "emberveil.radgh.com".** Default deploy target is RSG-Demos
staging.

## Git

- Single workspace repo at `/home/radgh/claude/`, branch `main`.
- Author: `Claude Code <2008464+RadGH@users.noreply.github.com>`
  — never `claude-code@anthropic.com`.
- Stage specific paths, NEVER `git add -A`/`.` blindly — `assets/references/`
  contains API keys and must never be staged (it's `.gitignored` but
  double-check).
- Commit after each successful `release.sh`, before `deploy_pages.sh`.
- Commit messages: short imperative subject. No Co-Authored-By unless asked.

## Where artifacts go

- Build artifact: `game13_releases/dist/` (flat — one only).
- Milestone history: `game13_releases/game_meta.json` (`releases[N].*`).
- Sprites: `game13/public/images/openai_v2/<id>_<pose>.png`.
- Raw OpenAI sheets: `game13/public/assets/openai_v2/raw/<id>/<date>_raw.png`.
- Generated dialog: `game13/data/story/_generated/`.
- Approved dialog: `game13/data/story/dialogue-pools/`.
- Rejected dialog: `game13/data/story/_rejected/`.
- Story content manifest output: `game13/public/assets/data/story/content-manifest.json`.
- Storyteller balance output: `game13/public/assets/data/story/balance/M###.json`.
- Image review pending batches: `game13/public/assets/data/image_review_batches/m###.json`.

---

# API keys you (or the user) need to generate

All keys live in `/home/radgh/claude/assets/references/` (gitignored). The
scripts read them from these exact paths — do not move them, do not invent
env-var alternatives.

## Required for full Story Mode build

| File | Service | What it does | Where used |
|---|---|---|---|
| `openai-api-key.txt` | OpenAI Platform (`https://platform.openai.com/api-keys`) | Dialog gen (gpt-4o-mini), sprite gen (image edits API), portrait gen | `scripts/generate-story-dialogue.cjs`, `scripts/openai-spritesheet-gen.py`, `scripts/openai-portrait-gen.py` |
| `elevenlabs-api-key.txt` | ElevenLabs (`https://elevenlabs.io/app/settings/api-keys`) | SFX + music track generation | `scripts/generate-*-elevenlabs*` (if you go that route) |
| `github-access-token.txt` | GitHub PAT (`https://github.com/settings/tokens`) — needs `repo` scope on `RadGH/RSG-Demos` (and `RadGH/Emberveil` if deploying to prod) | Push to staging + prod repos | `deploy_pages.sh`, `deploy_emberveil.sh` |

## Optional / pipeline-specific

| File | Service | What it does |
|---|---|---|
| `sprite-cook-api-key.txt` | SpriteCook (`https://spritecook.com/`) | Older sprite pipeline; new Story Mode work uses `openai-spritesheet-gen.py` so this is **not strictly required**, but the workspace MCP server `mcp__plugin_spritecook_*` will fail without it. |
| `pixellab-api-key.txt` | PixelLab (legacy) | Even older sprite pipeline; only used by historical regen scripts. Not needed for Story Mode. |
| `pixel-engine-api-key.txt` | Custom internal | Not needed for Story Mode. |
| `anthropic-api-key.txt` | Anthropic | Some internal QA scripts. Not strictly required for Story Mode. |

## Minimum viable set for the redo

- `openai-api-key.txt` — **required** for dialog + sprite generation.
- `github-access-token.txt` — **required** for `deploy_pages.sh`.
- `elevenlabs-api-key.txt` — required only if you need to regenerate audio
  (the existing tracks under `public/sfx/` and `public/music/` are reusable).

Generate fresh keys with billing alerts set — sprite gen can run a few dollars
per batch, dialog gen for ~400 nodes is ~$10 in gpt-4o-mini credits.

## How to verify keys are wired

```bash
head -c 8 /home/radgh/claude/assets/references/openai-api-key.txt
# should print: sk-proj- (or sk-) — no quotes, no newlines
```

If a script throws `ENOENT` reading a key path, the file is missing. If it
throws `401` from the API, the key is wrong or revoked.

---

# Concrete first message you should send the user

After you've read the docs, send a short check-in that includes:

1. Your delta-vs-prior-plan in 5 bullets. Don't restate the whole 30-milestone
   sequence — just where you diverge and why.
2. Confirm all required keys are present (or list what's missing).
3. The Classic Mode regression smoke-test result.
4. A clear "yes/no go" question for the user, e.g.:
   "Ready to start Phase 1 (foundation + predicate + effects). I'll release as
   M-R01 after that lands. Confirm?"

**Do not start coding before the user confirms direction.** The prior agent's
failure was running ahead — don't repeat it.

---

# Specific traps from the prior pass — DO NOT repeat

1. **Field-name drift.** The prior agent had `gs.story.pressure` in 3 places and
   `gs.story.pressureMeter` in `storyLedger.js`. Pick one, lint it, never let
   drift in.
2. **`recentHistory` array-vs-object confusion.** Define it as an object once in
   `storyLedger.js` and treat as opaque elsewhere — provide
   `recordTick(gs, outcome)` helper and never let callers `.push()` or `.slice()`
   directly.
3. **Quest status string `'complete'` vs `'completed'`.** Export a constant.
4. **`buildEncounterForNode` returning null on Travel.** Make it impossible — a
   Travel node either has a queued template or falls back to a per-biome random
   pool that's guaranteed populated.
5. **Storyteller-aware sim policy.** Don't ship the "fidelity gap" excuse. The
   sim must show all 6 storytellers producing different runs.
6. **Iron Judge balance band.** Don't ship if Act-3 Normal completion is outside
   30–70%. Tune budget multipliers.
7. **Stub pools** (banter, omen, ambush, reward). Author them at the time you
   build the system that consumes them, not as a M515 patch cycle.
8. **`alert()` in production.** Remove all `alert(`, `console.error(` shouts,
   and unconditional `console.log` before deploy.
9. **LLM dialog gen without narrative review.** Read the generated text before
   shipping. Reject the obviously bad ones. The validator can't catch tone.
10. **Sprite portraits generated but never rendered.** Wire to the UI in the
    same commit as generation.
11. **Released without manual playthrough.** The bug "navigating to any node
    threw an error" was unmissable in a 2-minute play test. Play the game
    before claiming the release works.

---

# Reference: where everything currently lives

(Snapshot of the prior agent's ship — read it for the design, don't
assume the code is correct.)

```
src/story/
  storyMode.js          storyLedger.js         storyPredicate.js
  storyEffects.js       storyQuestEngine.js    storyDialogConductor.js
  storyMapGen.js        storyMapGraph.js       storyMapValidator.js
  storyMapMutations.js  storyMapRendererShared.js
  storyDirector.js      storyStorytellers.js
  storyEncounterBuilder.js storyEnemyInstance.js storyBossVariants.js
  storyCompanions.js    storySkillCheck.js     storyContent.js
  storyTelemetry.js
  __tests__/

src/ui/screens/
  StoryNewGameScreen.js          StoryCharBuilderScreen.js
  StoryOpeningCinematicScreen.js StoryMapScreen.js
  StoryDialogScreen.js           StoryJournalScreen.js
  StorySettingsScreen.js

sim/story/
  runCampaign.js  buildSyntheticGs.js  cli.js
  policies/{greedy,explorer,combatHeavy,storyFirst,random,deterministic}.js
  __tests__/{byteParity,determinism,varietyMetrics,runCampaignBasic}.test.js

data/story/
  canonical-{flags,factions,biomes,skills,stats}.json
  storytellers/{chronicler,ash_prophet,warbringer,trickster,pilgrim,iron_judge}.json
  difficulty-presets.json
  npcs.json  enemies-story.json
  quest-lines/    dialogue-pools/   banter-pools/
  encounter-templates/  boss-variants/  safety-net-acts/
  side-quest-templates.json  factions.json  faction-control-map.json
  skill-affinities.json  audio-mapping.json  achievements-story.json
  world-mutations.json   lore-fragments.json  lore-primer.md
  _generated/  _rejected/

scripts/
  build-story-content-manifest.cjs   build-story-quest-graph.cjs
  build-storyteller-balance.cjs      check-storyteller-balance.mjs
  generate-story-dialogue.cjs        approve-story-dialogue.cjs
  generate-story-npc-sprites.cjs     generate-story-enemy-sprites.cjs
  generate-storyteller-portraits.cjs verify-story-sprites-enrolled.mjs
  openai-spritesheet-gen.py          openai-portrait-gen.py

public/assets/
  story-inspector.html        quest-graph.html
  storyteller-balance.html    story-dialog-review.html
  story-campaign-sim.html
```

You may delete and rebuild any of these — but if you do, write a migration
note (`memory/story_mode/REDO_MIGRATION.md`) so the user can see what changed.

---

# Final word

The previous agent was earnest but moved too fast and shipped before
end-to-end QA. The user explicitly chose to redo this because they want
**dialed in, well-tested, fully operational, no stubs, no placeholders.**

If you find yourself thinking "this is good enough for now, I'll fix it
next milestone," **stop and finish it now.** That mindset is what produced
the prior result.

Read everything before you code. Plan in `memory/story_mode/REDO_PLAN.md`
before you implement. Play the game on a phone-emulator before you call any
milestone shipped. Tell the user what you can't do BEFORE you start, not after.

Good luck.
