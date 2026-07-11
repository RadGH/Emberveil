# Emberveil — M46–M53 Plan (RESUME HERE)

This file is the authoritative roadmap for the next batch of work. Created
2026-04-11 from a large user feedback batch. Implement milestones in order.
Do **not** skip items, do **not** start a milestone before the previous one
ships, and after M52 run the verification pass at the bottom of this file
against `m46_m52_checklist.md` before declaring the batch complete.

The user explicitly authorized full scope; do not re-prompt for permission to
proceed. Generate as much PixelLab / OpenAI art as needed.

**A second feedback round was added on 2026-04-11.** Those items live at the
bottom of `m46_m52_checklist.md` under "Additional feedback batch — round 2"
and are tagged with their target milestone. They are part of the same
verification pass — do not skip them. Highlights:

- Combat HUD cleanup (enemy labels, HP bar position, dead-enemy bar hidden, 2×2 HP strip on iPhone with 4 chars, sprite scaling fix so players are not larger than enemies, missing void-enemy sprite, war-dog sprite gap, attack/cast animations actually playing, lightning-bolt icon removed, star emoji removed from level-up dialog)
- Skill-check dialogs must use **highest party stat**, exclude companions, and visibly disable
- Warrior **Shield Bash → Cleave** (3 adjacent targets, ≥2 upgrades)
- White rings/amulets get a base affix; magic = 2 affixes; rare = 3, etc.
- Level-up queue bug: 3 level-ups sometimes only opens 2 panels — queue reliably and **defer attribute spend** (assignable later via Skills menu)
- Character editor + Hire Custom editor: fixed budget (start 8, spend 8)
- Town menu trim: remove Pending Upgrades tab, keep Skills bubble, remove View Map bubble, move Trophies to ESC menu
- Quests: turn-in flow + completed-quest count bubble
- Blacksmith UI must not scroll-to-top after clicking an upgrade
- Inventory Character Stats panel + Hire Custom must show Melee + Spell consistently with the original character editor

---

## Milestone overview

| # | Theme | Why this order |
|---|------|----------------|
| M46 | Combat foundation + critical bugs | Several listed bugs (blank sprites, iPhone zoom, looping SFX, party-death softlock) block testing everything else. Crit/formation/mana-regen/AI improvements give the combat substrate the later milestones depend on. |
| M47 | Party / Town / Inventory UX | ESC menu, party 2-column, town scroll fix, Character Stats, hire-screen rework, skill-point pacing, necro auto-skeleton. Pure UX/system polish that unblocks playtesting. |
| M48 | Five new classes (Stormcaller, Druid, Oracle, Tactician, Chronomancer) | Touches classes/skills/talents/portraits + 20 PixelLab sprite jobs. Must come after M46 because new classes depend on the new combat features (formation, crit, mana regen). |
| M49 | Map & travel rework | Node-by-node walking, mid-path encounters, single-use treasure nodes, expanded act node graphs (act2 +1, act3 +1+path, act4 +2, act5 +2paths+2nodes), zone transition cutscenes, ambushes. |
| M50 | Combat polish & environment art | Boss intro cinematic, larger boss sprites, entrance animations, animated parallax backgrounds, environment backgrounds for encounter+combat screens (25% foreground / 25% ground / 50% sky-bg), more swarm encounters that justify AoE. |
| M51 | Story / dialog / quests / black market | Branching trees, companion interjections, side quests from encounters, deeper encounter dialog, act-specific side quests, act completion summary screen, act difficulty indicators, black market vendor (rare+ items, quality scales with act/difficulty). |
| M52 | QoL, systems, survey site, **VERIFICATION** | Item comparison tooltip, combat-log export, View Combat Log button on after-action dialog, passive skill trees, item set bonus display, NG+ attribute spend fix, title star RNG, save migration, survey rewrite, demo-assets reports linked as HTML pages. **Then run the M46–M52 verification pass.** |
| M53 | Graphics expansion (placeholder slot) | Reserved for additional PixelLab/OpenAI artwork generation that benefits from extra time during M46–M52 dev. Things like alternate boss sprites, environment art per zone, additional enemy variants, portrait packs for the 5 new classes. Queue art jobs early in M46 so they complete in time for M53. |

---

## M46 — Combat foundation & critical bug fixes

### Combat features
- [ ] Critical hit system: natural 20 on DEX-based hit roll → 2× damage with visual flourish (screen-shake + crit text). Applies to attacks and physical spells.
- [ ] Animated attack/hit sprites: bob forward on attack, recoil on hit. Reuse existing tween code if any; otherwise add a small animator in `CombatScreen.js`.
- [ ] Party formation by list order: characters earlier in the party list are attacked first; **companions always come before characters** in the targeting order. No new UI — sorting happens in target selection.
- [ ] Target priority AI: healers target lowest-HP ally; tanks auto-taunt (force enemy targeting onto themselves while alive); enemies pick smarter targets (lowest HP, then highest threat).
- [ ] Enemy AI skills + heals: enemies use skill rotations, can cast heals on injured allies, react to player actions (e.g. interrupt heavy casters).
- [ ] Mana regeneration per turn: base regen scales with INT; item affix `+X mana regen / turn` available in affix pool.
- [ ] Larger boss sprites: bosses use a distinct larger sprite size in combat (≥ 1.5× normal enemy). Boss flag on enemy data drives this.

### Bug fixes (all listed in user feedback — verify each is reproduced & fixed)
- [ ] Combat character rendering blank — canvas draw race; ensure sprite atlas is loaded before draw, fall back to colored silhouette.
- [ ] Shrine `empower` effect type silently does nothing — implement the buff.
- [ ] ChallengeScreen `onResume` false-advances wave count — guard against double-advance.
- [ ] ForgeScreen salvage list shows equipped items — filter equipped before render.
- [ ] PartyScreen swap not auto-saved — call `SaveManager.save()` after swap.
- [ ] Item set bonus never displayed — surface in inventory tooltip + Character panel.
- [ ] NG+ attribute points only spendable via combat level-up — allow spending from LevelUpScreen / Character panel anytime.
- [ ] Enchanter doesn't rebuild item display name after adding affix — call name builder post-affix.
- [ ] Title screen stars use deterministic scatter — seed with `Date.now()` per session.
- [ ] Save format migration missing for new fields (`seenEvents`, `portals`, etc.) — add migrator in `SaveManager.js` keyed on save schema version.
- [ ] Combat SFX loops after combat ends and continues into town (two-note loop) — stop the loop in `CombatScreen.exit()` and on victory/defeat.
- [ ] iPhone pinch-zoom in combat pixelates and breaks layout — add `<meta name="viewport" content="..., maximum-scale=1, user-scalable=no">` and reposition combat camera so all characters stay visible regardless of viewport.
- [ ] Party dies → softlock. On TPK, return party to town **at full HP**.

---

## M47 — Party / Town / Inventory UX

- [ ] **ESC main menu** available everywhere except title and combat (combat has its own menu). Items: Resume, Save/Load, Options, Party, Codex. Remove Party/Codex/Save buttons from town once this menu exists.
- [ ] Town right column goes off-screen on desktop and is unscrollable — fix layout (compact services, allow scroll, or move to ESC menu).
- [ ] Party window — companions invisible on desktop. Add a second column next to Active Party for Companions.
- [ ] Party tab: drop active/inactive distinction; presence in Active Party / Companion sections is enough.
- [ ] Character Stats panel (in Inventory) — add **Attack** (range, from STR or ½ DEX, used by auto-attacks and physical spells) and **Spell** (spell power from INT, applied to magic-based spells).
- [ ] Class symbols + primary role on:
  - [ ] Hire-a-Mercenary (tavern) screen
  - [ ] Hire Custom (formerly "Build Mercenary") screen
  - [ ] Initial Character Editor (if missing)
- [ ] Rename "Build Mercenary" → **"Hire Custom"**. Disable when player has < 100g.
- [ ] Hire Custom rework: pay **per level** instead of per attribute point. Cap level at the player's highest-level character. A level-N premade tavern merc must cost less than a level-N custom merc.
- [ ] Add custom-merc options to other towns (not just starter).
- [ ] Tavern mercs disappear from the tavern list after being hired (no two "Borin").
- [ ] Necromancer auto-companion: every necromancer in the party automatically grants a Skeleton companion that occupies a companion slot. Remove "summon skeleton" skill; replace with another offensive ability (Bone Spear, etc.) if not already present.
- [ ] Skill points: 1 point per **3 levels** (currently too generous).
- [ ] Every skill — including Heal — has at least **2 upgrades**. Heal example upgrades: "Splash 50% to adjacent ally", "Adds barrier at 25% heal value".
- [ ] Forge unlocks in Act 3 or 4 (whichever comes after the Blacksmith).
- [ ] Remove **Daily** option from towns.

---

## M48 — Five new classes

For each of: **Stormcaller, Druid, Oracle, Tactician, Chronomancer**

- [ ] Class definition in `classes.js` (stats, primary role, starting equipment, portrait set).
- [ ] 4 active skills + tiered upgrades in `skills.js` (each skill ≥ 2 upgrades).
- [ ] Talent tree entries in SkillTreeScreen.
- [ ] Class symbol + role label visible on hire screens & character builder.
- [ ] PixelLab character sprites at 68×68 for all 4 directions (south/east/west/north). Save to `public/images/sprites/{class}_{dir}.png`. Add SPRITE_MAP entries in `CombatScreen.js`. Catalog each in `public/demo-assets/assets.json`.
- [ ] At least 1 portrait per class (OpenAI), cataloged in `assets.json`.

Class kits:
- **Stormcaller** — Lightning mage. Chain lightning (jumps to N targets, INT scaling), area denial (storm field that damages enemies entering / standing in row), single-target stun bolt, AoE thunderclap.
- **Druid** — Shapeshifting healer. HoTs (Regrowth, Wild Bloom), nature single-target heal, shapeshift to bear (tank stance) / wolf (DPS) for X turns, entangle (root status).
- **Oracle** — Predictive healer. Pre-shield (apply absorb shield before incoming hit lands; needs an "expected damage" peek hook in combat AI), foresight buff (next attack on target auto-dodges), mass barrier, prophetic strike (marks enemy; party crits next attack on it).
- **Tactician** — Turn-order manipulator. Grant extra action to ally, swap two units' positions in initiative order, reposition ally in formation, rally (party gains +damage for X turns).
- **Chronomancer** — Time mage. Haste ally (extra action this round), slow enemy (skip next turn), rewind damage (heal target for damage they took last round), time stop (skip an enemy turn entirely).

---

## M49 — Map & travel

- [ ] Node-by-node travel: cannot teleport across the graph; must walk along edges between adjacent nodes.
- [ ] Animated party-arrow (or simple sprite) traverses the edge between source and destination node.
- [ ] Mid-edge encounter chance (~25–35%): trigger a random encounter halfway. Player can attempt a skill check (DEX/INT/CHA depending on encounter) to bypass; combat path grants bonus XP & loot.
- [ ] Single-use treasure nodes: after first visit, show "This site has already been searched." Combat encounters still re-trigger random encounters when revisited.
- [ ] Act node-graph expansion:
  - Act 2 → +1 node
  - Act 3 → +1 node, +1 path
  - Act 4 → +2 nodes
  - Act 5 → +2 nodes, +2 paths
- [ ] Zone transition cutscenes: brief atmospheric scene when entering a new zone (background art + 1–2 lines of flavor).
- [ ] Random ambush node-modifier while traveling.
- [ ] Add more combat encounters featuring **larger groups of weaker enemies** to motivate AoE skills.

---

## M50 — Combat polish & environment art

- [ ] Boss intro cinematic: name flash + dramatic pause + camera focus before round 1 of any boss combat.
- [ ] Larger boss combat representation (driven by `isBoss` flag).
- [ ] Character entrance animations: party slides/fades into formation at combat start.
- [x] Animated parallax combat backgrounds: drifting clouds, embers, fog. (COMPLETE — 3-layer parallax in CombatScreen._drawParallaxLayers and MapScreen._drawParallaxSky)
- [ ] Environment background art on encounter screens **and** combat screens. Layout rules:
  - Bottom 0–25% = foreground (props, near terrain)
  - 26–50% = ground row (where all characters stand, separate y-rows for back/front)
  - 51–100% = background + sky
- [ ] Generate one environment art set per zone via OpenAI/PixelLab; catalog in `assets.json`.
- [ ] More swarm encounters across acts (motivates AoE — see M49 swarm task).
- [ ] Add more depth and dialog options to existing encounters (carry-over; finish in M51 if needed).

---

## M51 — Story, dialog, quests, black market

- [ ] Branching dialog trees — choices lead to different dialog paths, not just outcomes.
- [ ] Companion interjections — companions chime in on relevant choices (Borin on combat, Seer on lore, etc.).
- [ ] Side quests from encounters — random encounters can spawn optional side quest chains.
- [ ] Add more depth and dialog options to existing encounters.
- [ ] Act-specific side quests with thematic rewards unique to each act.
- [ ] Act completion summary screen: enemies defeated, gold earned, quests completed, time taken.
- [ ] Act difficulty indicator on world map: recommended level + difficulty rating per act.
- [ ] **Black market** vendor (hidden, unlocked by exploration / dialog). All items Rare or above; quality scales with act and difficulty.

---

## M52 — QoL, systems, survey site, VERIFICATION

- [ ] **Item comparison tooltip** — on hover/tap, show stat delta vs currently equipped item.
- [ ] **Combat log export / replay** — ability to export combat log as text and replay.
- [ ] **View Combat Log** button on the after-action dialog (below Continue). Opens combat log; Back returns to after-action.
- [ ] Passive skill trees per class — separate tree for stat bonuses + role enhancements.
- [ ] Item set bonus display in tooltips and Character panel (carry from M46 if not done).
- [ ] NG+ attribute spend fix (carry from M46 if not done).
- [ ] Title screen star RNG (carry from M46 if not done).
- [ ] Save format migration (carry from M46 if not done).
- [ ] **Survey site rewrite**: replace all questions with new ones unless they were never addressed. Add suggestions for multiple existing systems and propose several brand-new systems that fit Emberveil. Live at `public/survey/` (or wherever existing survey lives).
- [ ] **Demo-assets reports**: in `public/demo-assets/`, list survey + milestone reports as **clickable HTML links** (open the actual HTML files), not text accordions. Reference `/home/radgh/claude/game8/demo-assets/` for the layout pattern.
- [ ] Generate fresh milestone reports for M46–M52 in `public/demo-assets/assets.json` `reports` array.

### VERIFICATION PASS (run after all M52 items above are done)
1. Open `memory/m46_m52_checklist.md`. Walk every checkbox.
2. For each item, confirm in code (grep, read, run) that it's actually implemented — do not check off based on intent.
3. For UX items, run the dev server and click through the relevant screen.
4. For combat items, start a combat encounter and observe.
5. Test on iPhone 14 Pro viewport (393×852) in addition to desktop.
6. Any item that fails verification → reopen, fix, re-verify. Do **not** mark M52 complete with unchecked items.
7. Once 100% verified, write a `verification_m46_m52.md` report in `memory/` listing every item, the file/line where it's implemented, and the verification method used.
8. Only then run `bash /home/radgh/claude/release.sh game13` for M52 and proceed to M53.

---

## M53 — Graphics expansion (queue early!)

Reserved for batch art generation. **Start queueing PixelLab/OpenAI jobs as early as M46** so the art is ready by the time M53 begins.

Art to queue:
- [ ] Environment backgrounds for every zone in every act (used by M50).
- [ ] Larger boss sprite variants for every act boss.
- [ ] Portrait packs (≥ 6 each) for the 5 new M48 classes.
- [ ] Additional enemy variants for swarm encounters (M49/M50).
- [ ] New companion sprites if any are added during M51.
- [ ] Black market vendor portrait + shop background.
- [ ] Class-symbol icons for the 5 new classes (used in hire screens, M47).

All art must be cataloged in `public/demo-assets/assets.json` as it's generated.

---

## Working rules for the next session

1. Read this file and `m46_m52_checklist.md` before doing anything else.
2. Use TaskCreate to mirror the M46 checklist into in-session tasks; mark them in_progress / completed as you work.
3. After each milestone: run `bash /home/radgh/claude/release.sh game13`, update `game_meta.json` (changelog + milestones), generate a milestone report in `assets.json`, deploy via `bash /home/radgh/claude/deploy_pages.sh`.
4. Do not start a later milestone with unchecked items in the current one.
5. The verification pass at the end of M52 is mandatory and gates M53.
