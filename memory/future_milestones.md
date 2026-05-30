
# Emberveil — Development Milestones

50 milestones organized by development phase. Each milestone represents a shippable increment of functionality.

---

**M518 COMPLETE (2026-05-21)** — Story Mode UX overhaul: 13-fix batch — char-creation flow (StoryCharBuilderScreen + newGameSetup), per-storyteller cinematic (6 storytellers), staggered diagonal grid, curved Bezier roads, trailhead node, waypoint fast-travel + death-respawn, guaranteed towns in act-1, fog-of-war tab locks, storyteller chip real expand/collapse, taller drawer (128pt), desktop layout (≥700px), background image wiring. 19 new tests (765 total).

---

## Story Mode Milestones (M-S series) — shipped as game build M5xx

**M-S19 COMPLETE (2026-05-20, build M504)** — Content layer: 162 dialog nodes (12 pool files), 60 encounter templates (14 biome files), 20 side-quest templates, 50 lore fragments, 9 factions, 20 NPCs, 28 new canonical flags, 3 new canonical factions, lore primer for M-S20.

**M-S20 COMPLETE (2026-05-20, build M507)** — LLM dialog generation pipeline (generate-story-dialogue.cjs + approve-story-dialogue.cjs). 283 nodes generated via gpt-4o-mini across 7 pools, all merged into live dialogue-pools and validator-clean. Pool breakdown: arrival:36, ambush:32, shrine:33, merchant:52, lore:46, faction:48, side-quest:36. Total dialog nodes: 162 hand-authored + 283 generated = 445.

**M-S21 COMPLETE (2026-05-20, build M507)** — 40 OpenAI 9-pose sprite sheets: 20 story NPCs (captain_maer through marek_greel_story) and 20 story enemies/bosses (ash_cultist through emberveil_sovereign_story). All 9 poses generated per character, all enrolled in image-review batch m357. enemies-story.json registry created. Verifier: verify-story-sprites-enrolled.mjs (PASS).

**M-S22 through M-S24 COMPLETE (2026-05-20)** — Predicate DSL, effect runner, quest engine, Director engine, companion system, storyteller modulation, map mutations, biome music wiring, banter scheduler — full story runtime.

**M-S25 COMPLETE (2026-05-20)** — Mobile UX: StoryJournalScreen (5 tabs), StorySettingsScreen (banter/autosave/notification toggles), StoryNewGameScreen carousel polish + custom seed + party preview, StoryMapScreen action bar wiring + pressure chip expand/collapse.

**M-S26 COMPLETE (2026-05-20)** — Music integration: StoryMapScreen._playBiomeMusic() wired to actOverworld tracks on onEnter(); pressure chip keyboard accessible; toast fallback for story events.

**M-S27 COMPLETE (2026-05-20)** — 5 authoring tool pages: story-inspector.html, quest-graph.html, storyteller-balance.html, story-dialog-review.html, story-campaign-sim.html. build-story-quest-graph.cjs emits 35-quest DAG JSON.

**M-S28 COMPLETE (2026-05-20)** — Balance CI gate: check-storyteller-balance.mjs, build-storyteller-balance.cjs (worker threads). buildSyntheticGs bumped to level-10 party (840 HP). immortalParty option in runCampaign. BFS dead-end fallback. storyFirst policy prefers forward edges. actsCompleted credits boss-visits. CI gate: 83% act-1 Normal average, all 6 storytellers PASS (advisory 1-seed mode).

**M-S29 COMPLETE (2026-05-20)** — Telemetry + achievements + audio mapping. 12 story achievements in achievements.js + data/story/achievements-story.json. data/story/audio-mapping.json (biome/act → track). src/story/storyTelemetry.js (8 structured event helpers). checkAchievements() wired into storyMode.afterNodeResolved + transitionToAct.

**M-S30 COMPLETE (2026-05-20)** — Final release prep: SITE_OVERVIEW §10 Story Mode, future_milestones.md, milestone report in assets.json, npm build verified, release.sh + deploy_pages.sh.

**STORY MODE SERIES COMPLETE — M-S01 through M-S30 all shipped.**

---

## Phase 1: Foundation (M1–M5)

### M1 — Project Scaffolding
[ ] Initialize Vite project with vanilla JS. Set up folder structure (`engine/`, `game/`, `ui/`, `content/`, `maps/`, `utils/`). Configure dev server. Create `index.html` with canvas element and UI overlay div. Verify hot reload. Add base CSS reset and portrait-first layout at 393×852 baseline. Commit initial repo to GitHub.

### M2 — Title Screen and Main Menu
[ ] Build the title screen rendered on canvas with the Emberveil logo, animated background (panning dark texture), and HTML/CSS menu buttons: New Game, Load Game, Settings. Implement screen manager (`uiManager.js`) to handle screen transitions. Wire Settings modal with master/music/SFX volume sliders and reduce-motion toggle. Implement basic input handler (`input.js`) supporting mouse click and touch tap.

### M3 — Character Builder
[ ] Implement the full character builder flow: name text input, class selection grid (all 14 classes listed with descriptions), portrait picker (placeholder images, 6 per class), and attribute distribution (8 base + 10 free points with live preview of HP/mana/damage estimates). Wire class selection to lock portrait options by theme. Validate before confirming. On confirm, generate hero object and transition to first town screen.

### M4 — First Town (Starter Village)
[ ] Build the town screen UI with tabbed service panels: Merchant (static item list), Tavern (2 hirable heroes), Cleric (revive/heal options greyed out until needed), Blacksmith (upgrade UI, non-functional), Enchanter (non-functional). Implement gold display. Wire Tavern hiring: select hero, pay gold, hero added to party panel. Build the party panel component showing up to 8 slots with portrait, name, class, HP/mana bars.

### M5 — Basic Combat (Prototype)
[ ] Implement combat screen with side-view canvas layout: hero party left (4 slots visible), enemy group right (1 group, 3 enemies). Turn order system (DEX + 1d10). Auto-play combat loop at 0.5s per turn. Basic attack action only (no skills yet). Hit roll (hit% vs dodge%). HP tracking. Death handling (unit removed from field on 0 HP). Victory/defeat detection. Transition back to map on victory. All 5 visual stances for placeholder sprites.

---

## Phase 2: Core Systems (M6–M10)

### M6 — Equipment System
[ ] Build the item data model: type, rarity, quality, stat values, affix slots. Implement `items.js` with base item tables for all weapon types and armor tiers. Build `affixes.js` with Act 1 affix pool. Implement procedural item generation function (base + rarity + quality + affixes). Add inventory screen (grid view, item tooltip on hover/tap showing all stats). Wire equip/unequip to character stat recalculation. Implement sell-to-merchant flow.

### M7 — Skill System and Talent Trees
Talent content COMPLETE — all 49 previously-empty skill talent arrays populated with 2 themed upgrade talents each in `src/game/skills.js` (backstab, poison_blade, shadow_step, death_mark, smite, sanctuary, mass_resurrection, inspiring_tune, discordant_wail, ballad_of_valor, song_of_ruin, corruption, hellfire, soul_pact, void_rift, demon_bolt, glaive_toss, fel_sight, vengeance, scrounge, thrown_junk, makeshift_bomb, jackpot, riposte, flourish, taunt, grandeur, dragon_claw, breath_weapon, dragon_scales, draconic_fury, chain_lightning, static_field, thunder_ring, tempest, entangle, wild_shape, natures_wrath, prophecy, fate_weave, ascendance, rally_action, feint, reposition, masterstroke, haste, slow_time, rewind, time_stop).
[ ] Implement `skills.js` with full definitions for all 14 classes × 4 skills. Build skill activation engine: apply damage formulas, status effects, AoE resolution. Build talent tree UI (per-class tree showing 4 skills with upgrade nodes branching off each). Wire auto-unlock at levels 1/5/10/15. Implement skill slot management (max 4 active per character). Wire skills into combat: AI selects skill based on simple priority rules. Animate skill use (spell stance trigger).

### M8 — Save and Load System
[ ] Implement `save.js` with full serialization of game state: party, inventory, gold, map progress, story flags, dialog history. Build 3-slot save UI on title screen and pause menu. Implement auto-save triggers (node completion, town entry, act transition). Implement manual save from pause menu. Build load screen showing slot previews (character names, act, playtime). Wire New Game+ flag into save slot data.

### M9 — Map Travel System
[ ] Build the map screen (`mapScreen.js`) with visual node graph rendering on canvas. Implement node types: Combat, Dialog, Town, Treasure, Ambush, Boss, Lore — each with distinct icon. Implement path traversal: selectable adjacent nodes only. Track visited nodes (persistent, renders differently). Implement fast travel to any visited non-active node. Build zone map and act map navigation (zoom out to see multiple zones in act). Wire node selection to encounter launcher.

### M10 — Encounter System
[ ] Build `encounter.js` as the wrapper routing node events to the correct screen. Implement Dialog encounter type: portrait-left/NPC-right layout, scrolling text reveal, dialog choice buttons, skill check system (player stat vs DC roll, pass/fail branches). Implement Treasure encounter: item award screen with rarity fanfare. Implement Ambush modifier on combat encounters (enemy goes first, no player priority round). Wire all node types through the encounter router.

---

## Phase 3: Act 1 Content (M11–M15)

### M11 — Act 1 Zone Maps
[ ] Author all four Act 1 zones in map data: Border Roads, Thornwood Forest, Ruined Keep, Goblin Warcamp. Place 3–8 nodes per map with authored node types and branching paths. Write enemy group compositions per node (goblin variants, corrupted beasts). Set up zone progression gating (must clear map to unlock next). Implement zone map screen showing all maps in the act with completion state. Add Act 1 zone background art (placeholder or OpenAI-generated).

### M12 — Act 1 Enemies
[ ] Author all Act 1 enemy types: Goblin Scout, Goblin Warrior, Goblin Shaman, Goblin Warlord (mini-boss variant), Corrupted Wolf, Corrupted Bear, Veil-Touched Cultist. Define stat blocks (HP, damage, armor, resistances), attack patterns, and skill sets for each. Implement enemy AI priority rules (target lowest HP, use skills when HP thresholds hit, etc.). Wire enemy loot tables to Act 1 affix pool items.

### M13 — Act 1 Story and Dialog
[ ] Write and implement all authored dialog for Act 1: opening cutscene, key NPC conversations (The Seer introduction, village elder, goblin prisoner interrogation), dialog encounter nodes with skill checks (persuasion to avoid combat, stealth to bypass patrol, lore to identify Veil artifact). Set story flags based on player choices. Implement the opening cinematic (scrolling text over background art). Add companion unlock dialog (first companion found in Thornwood).

### M14 — Act 1 Side Quests
[ ] Design and implement 3 Act 1 side quests: (1) Missing Scouts — find and rescue captive villagers, reward: Magic equipment and gold. (2) The Corrupted Spring — cleanse a Veil-tainted water source, reward: unlocks the Rogue companion. (3) Goblin Defector — escort a goblin seeking asylum to the capital, reward: unique lore item and gold bonus. Wire side quest flags into dialog system. Add side quest log UI panel to map screen.

### M15 — Act 1 Boss: Grax the Veil-Touched
[ ] Author and implement the Grax boss fight. Phase 1 (100–66% HP): standard warlord attacks, summons Goblin Warrior pack on round 3. Phase 2 (66–33% HP): Grax enters Rage, doubled attack speed, summons Corrupted Beast pack. Phase 3 (33–0% HP): Veil energy bursts, AoE corruption blast every 2 rounds, final summon wave. Implement phase transition dialog. Author victory/defeat cutscenes. Wire Act 1 completion: story cutscene, Act 2 unlock, auto-save.

---

## Phase 4: Act 2 Content (M16–M20)

### M16 — Act 2 Zone Maps
[ ] Author all four Act 2 zones: Scorched Plains, Cinderborn Sanctum, Dwarven Deep Ruins, Lava Forge Throne. Increase node count (up to 8 per map). Introduce new node type: Environmental Hazard (volcanic vents, lava flows — deal damage if wrong path taken). Add Act 2 background art. Implement act transition cutscene from Act 1 → Act 2 (party crosses into the Ashen Wastes, The Seer's warning dialog).

### M17 — Act 2 Enemies
[ ] Author all Act 2 enemy types: Cinderborn Acolyte, Cinderborn High Priest, Magma Elemental, Lava Golem, Ashen Revenant, Fire Drake, Dwarven Construct (corrupted), Embermaw Spawn (boss minion). Define stat blocks emphasizing fire damage and fire resistance values. Implement Burn stack mechanic fully (stacks to 5, damage scales with stacks). Wire Act 2 loot tables with fire-affixed items and dwarven-themed equipment.

### M18 — Act 2 Story and Dialog
[ ] Write and implement Act 2 dialog: Cinderborn cult propaganda encounters (persuasion check to convert them or fight), Dwarven ruins lore nodes (INT check to decipher inscriptions revealing portal history), Demon Hunter companion introduction scene (she appears warning the party at the Sanctum entrance). Implement the portal discovery cutscene (the party finds the ancient portal in the Dwarven Ruins). Write Demon Hunter hire dialog and unlock her in tavern roster.

### M19 — Act 2 Side Quests
[ ] Design and implement 3 Act 2 side quests: (1) The Eternal Flame — extinguish a sacred Cinderborn fire, reward: fire resistance enchanted gear. (2) Dwarven Legacy — recover 3 Dwarven rune stones from the deep ruins, reward: unlocks the Dwarven Construct as a companion. (3) The Ash Walker — help a lone survivor cross the Scorched Plains, reward: unique Legendary item (The Ashen Cloak). Wire all quest flags and rewards.

### M20 — Act 2 Boss: Embermaw the Undying
[ ] Author and implement Embermaw. Implement immunity to fire damage (all fire skills display "Immune"). Phase 1: Magma Slam AoE, Lava Flow ground hazard (ongoing Burn to front row). Phase 2 (66%): Embermaw submerges into lava, emerges at 50% HP, summons Magma Elementals, gains Burn reflection (fire attacks bounce back). Phase 3 (33%): Full eruption — Burn applied to all party each round, rapid attacks. Victory unlocks portal dialog and Act 3 access.

---

## Phase 5: Companions System (M21–M25)

### M21 — Companion Data Model
[ ] Build the full companion/pet system in `companions.js`. Define all companion types: War Dog, Dire Wolf (summon), Skeleton Warrior (Necromancer raise), Skeleton Archer, Dragon Whelpling, Dwarven Construct, Corrupted Wolf (tamed), Demon Imp. Each has stat block, 2 passive abilities, 1 active ability, visual sprites (3 stances: idle, attack, death), and unlock conditions. Integrate companions into the party panel (slots 5–8) with full stat display.

### M22 — Companion AI and Combat Behavior
[ ] Implement companion-specific AI logic in the combat engine. Companions auto-act on their turn: War Dogs charge highest-threat enemy, Wolves flank for Bleed, Skeletons form front-row meat shield, Dragon Whelpling targets spell casters, Imps cast debuffs. Companions cannot use player-directed skills but can be prioritized (player sets companion stance: Aggressive/Defensive/Support). Wire companion death to companion slot clearing (no permanent death — they are revivable at the Cleric).

### M23 — Pet and Summon Mechanics
[ ] Differentiate persistent companions (War Dog, Dragon Whelpling — follow party everywhere) from combat summons (Skeleton Warrior/Archer — summoned in combat via Necromancer skill, despawn after combat). Implement summon-slot system (summons occupy companion slots 5–8, limited by class skill). Implement Necromancer Raise Dead as a live companion spawner during combat. Build the companion management screen (manage all 8 party slots, dismiss companions, view companion stats).

### M24 — Dragon Whelpling Companion Arc
[ ] Implement the Dragon Whelpling as a special companion with a growth arc. Found in Act 3 (demon lord's menagerie side quest). Starts as Whelpling (low stats, AoE breath deals minor damage). At party level 15 grows to Young Drake (improved stats, breath hits two groups). Has unique interaction dialog at camp rest nodes. Implement bond mechanic: Dragon Knight class receives bonus stats when Dragon Whelpling is in party. Author unlock quest dialog.

### M25 — Camp Rest Node
[ ] Add a new node type: Camp Rest. Available on maps between combat-heavy zones. Allows: passive HP/mana regeneration (wait 1 round = 10% restore), companion dialog (lore and character moments), party management (reorganize formation, swap equipment). Implement 2 lines of unique dialog per companion triggered at camp in their unlock zone. Add camp background art (fire, night sky transitioning by act). Wire camp to auto-save.

---

## Phase 6: Act 3 Content (M26–M30)

### M26 — Portal Transition and Act 3 Zone Maps
[ ] Implement the portal crossing sequence (animated transition, reality-distortion visual effect on canvas, dialog from Demon Hunter). Author all four Act 3 zones: The Breach, Brimstone Flats, Obsidian Citadel, Void Gate Antechamber. Introduce Demon Lord Faction node type (choose alliance or fight — affects later dialog options). Add Act 3 background art (hellscape palette: deep reds, purples, brimstone). Scale enemy levels to party average for Act 3.

### M27 — Act 3 Enemies
[ ] Author all Act 3 enemy types: Lesser Demon, Demon Knight, Succubus (charm mechanic: one party member skips turn), Hellhound, Void-Touched Demon, Soul Wraith, Demon Lord's Champion (elite enemy), Malachar's Fragment (boss minion). Implement Charm status effect (target attacks their own party). Define demon-specific resistances (fire immunity common, holy vulnerability). Wire Act 3 loot tables with demon-themed and void-infused items.

### M28 — Act 3 Political System
[ ] Implement the demon lord faction system. Three demon lords each control a zone: Zareth (Brimstone Flats), Vexara (Obsidian Citadel), and Krul (neutral). Dialog encounters offer: fight the faction (harder combat, more loot), ally with them (easier passage, quest available, affects Act 3 boss). Track faction standing flags. Implement the Obsidian Citadel stealth encounter (DEX check to sneak past guards versus full combat gauntlet). Wire choices to Malachar boss dialog variants.

### M29 — Act 3 Side Quests and Dragon Whelpling Unlock
[ ] Design and implement 3 Act 3 side quests: (1) The Menagerie — infiltrate demon lord Zareth's trophy collection to free the Dragon Whelpling (stealth + combat encounter, unlocks Dragon Whelpling companion). (2) Lost Souls — recover 5 bound soul gems from wraith packs, reward: Necromancer companion summon upgrade. (3) The Splintered Pact — recover a broken demonic contract, used to gain leverage in Malachar boss pre-fight dialog, reducing his Phase 1 HP. Wire all flags.

### M30 — Act 3 Boss: Malachar the Splinter Lord
[ ] Author and implement Malachar. Pre-fight dialog varies by faction alliances chosen. Phase 1: Malachar fights solo with void beam (INT-based AoE, whole party). Phase 2 (66%): Splits into 3 Fragment copies — only the real one takes full damage (DEX check or Demon Hunter's Fel Sight identifies the real one). Phase 3 (33%): Fragments rejoin as empowered Malachar with void immunity and continuous Corruption application. Victory: Void Gate opens, Act 4 unlock, major story cutscene.

---

## Phase 7: Advanced Combat (M31–M35)

### M31 — Boss Phase System Generalization
[ ] Refactor the boss combat engine into a generalized phase system. Each boss definition declares phase thresholds, phase transition events (dialog trigger, stat change, new move set, visual transformation), and reinforcement spawn tables. Implement phase transition animation (canvas flash, boss sprite swap, camera shake effect). Retrofit existing bosses (Grax, Embermaw, Malachar) to use the generalized system. Verify all phase behaviors remain correct.

### M32 — AoE Targeting and Group Mechanics
[ ] Fully implement the AoE targeting system on the combat canvas. Render enemy groups as visually distinct clusters with spacing. Implement targeting cursor that highlights affected groups for player-directed skills. Build AoE resolution: group-hit skills damage all enemies in the group individually; row-hit skills damage all enemies in a row; field-wide skills damage every enemy. Add AoE preview tooltip showing expected targets before confirming a skill. Verify Blizzard, Fireball, and Meteor mechanics.

### M33 — Status Effect Depth
[ ] Expand status effect system to full spec. Implement all 8 statuses (Poison, Burn, Bleed, Stun, Slow, Blind, Fear, Freeze) with correct resist rolls, duration tracking, and visual indicators on unit health bars. Implement Burn and Bleed stacking (up to 5 stacks, damage scales). Implement status immunity (boss immunities, Dragon Scales immunity, Fel Sight immunity). Add status removal (Cleric's Heal upgrade, Cure All at temple). Display active statuses as icon strip below each unit.

### M34 — Manual Combat Mode
[ ] Implement full manual combat override. Toggle button in combat UI switches from auto-play to manual mode. In manual mode, on a hero's turn, the player sees action buttons: Basic Attack, Skill 1–4, Wait, Use Item. Targeting cursor activates for skill selection. Confirm button executes. Timer bar gives 15 seconds for decision; auto-defaults to Basic Attack on timeout. Implement manual mode memory (stays manual until toggled off). Gamepad navigation of manual combat menus.

### M35 — Combat Replay and Damage Log
[ ] Implement the combat log panel (toggleable side panel in combat UI). Every action is logged as a text line: "[Warrior] hits [Goblin Scout] for 47 damage (Bleed applied)." Color-coded by action type (attack, skill, status, heal, miss). Log is scrollable. Add floating damage numbers on the canvas over units (pop-up on hit, distinct colors: white for physical, yellow for fire, blue for ice, green for heal, red for critical). Implement end-of-combat summary screen (total damage dealt, statuses applied, gold earned, items dropped).

---

## Phase 8: Economy Depth (M36–M40)

### M36 — Item Generation Full Implementation
[ ] Complete the procedural item generation system for all acts. Build out affix pools for Acts 2, 3, and 4 (fire affixes, demonic affixes, void affixes). Implement item level scaling (item stats scale to the act/zone the item drops in). Implement item identification system (Magic+ items drop as Unidentified; shown as "??? Sword" until identified by Enchanter or Lore skill check). Build the identification flow and reveal animation. Add Legendary item table (10 hand-authored Legendaries spread across all acts).

### M37 — Blacksmith Upgrades
[ ] Fully implement the Blacksmith upgrade service. Build quality upgrade UI: show item current quality, next quality tier, gold cost (scales: Medium→High: 200g, High→Elite: 500g, Elite→Exotic: 1200g), confirm button. Build rarity upgrade UI: Normal→Magic: 150g, Magic→Rare: 400g. Implement stat recalculation on quality/rarity change. Add upgrade preview showing stat changes before committing. Add smithing animation (sparks on canvas overlay). Prevent upgrading Legendary items (they are already max).

### M38 — Enchanting System
[ ] Fully implement the Enchanter service. Build affix-add UI: show item's open affix slots, display 3 random affix options from current act pool, select one, pay gold (150–600g scaling by act). Build affix-reroll UI: show existing affixes, select one to reroll, display 3 new options, pay gold (200–800g). Implement the enchanting animation (mystical glow on canvas). Add affix conflict prevention (no duplicate affix types on one item). Cap: Magic items max 2 affixes, Rare max 4.

### M39 — Economy Balancing Pass
[ ] Audit and balance the full economy. Review gold income per act (combat drops, quest rewards, treasure nodes) against gold sinks (hiring, reviving, upgrading, enchanting). Adjust enemy gold drop tables. Implement diminishing returns on selling repeated item types (flood prevention). Add a gold summary stat to the end-of-act screen. Implement merchant stock scaling (Act 2 merchant sells Rare items; Act 3 sells occasional Legendaries). Add the Scavenger class's Jackpot skill to the live loot system.

### M40 — Legendary Items and Set Items
[ ] Author all 10 Legendary items with unique named affixes and flavor text. Implement 2 item sets (3-piece each): The Goblin Slayer set (Act 1 rewards) and the Voidborn set (Act 4 rewards). Implement set bonus detection: equipping 2/3 pieces grants a partial bonus; all 3 grants the full set bonus (unique passive effect, e.g., "Goblin kills grant a stack of Fury" or "Void damage ignores resistance"). Build set bonus display in inventory tooltip. Add set item visual border (animated shimmer on item icon).

---

## Phase 9: Act 4 and New Game+ (M41–M45)

### M41 — Act 4 Zone Maps and Environment
[ ] Author all four Act 4 zones: Edge of Existence, Shattered Worlds, Unraveler's Domain, The Core. Implement the Void Zone environmental mechanic: each round in void zones, all party members take minor void damage (reduced by INT resistance). Introduce the Reality Fracture node type (random encounter replacing a normal node — spawns an echo of a previously defeated enemy group at full strength for bonus loot). Add Act 4 background art (cosmic void palette). Author the Act 3→4 transition cutscene.

### M42 — Act 4 Enemies and Void Mechanics
[ ] Author all Act 4 enemy types: Void Wisp, Void Stalker, Shattered World Echo (copies of Act 1/2/3 enemy types with void affixes), Void Titan, Unraveler's Tendril (boss-adjacent add), Null Knight (heavy void warrior), Aspect of Unraveling (elite void caster). Implement void damage type (bypasses physical armor, reduced by INT). Implement Void Corruption status (builds over time in void zones, reduces max HP when fully stacked). Wire Act 4 loot tables with void-affixed and Voidborn set pieces.

### M43 — Act 4 Boss: The Unraveler
[ ] Author and implement The Unraveler as a 4-phase final boss. Phase 1: Void Rays (AoE, all party), summons Void Wisps each round. Phase 2 (75%): Battlefield restructures (enemy formation resets, Wisps replaced by Stalkers), Unraveler gains partial void immunity. Phase 3 (50%): Summons void-echoes of Grax, Embermaw, Malachar (each at 30% their original HP) — must be defeated to proceed. Phase 4 (25%): Full unraveling — maximum hazards, void damage to all units each round, frantic final burn. Victory triggers ending cutscene.

### M44 — Multiple Endings
[ ] Implement the three endings based on story flag accumulation from all four acts. Track: times player chose mercy vs violence, alliances made in Act 3, Veil artifact decisions in Acts 1–2. Ending 1 (Heroic Seal — requires 4+ merciful choices): The veil is restored, the party sacrifices the artifacts to close the breach. Ending 2 (Dark Merger — requires 3+ demonic alliances): The party absorbs void power, becoming guardians of the veil at great personal cost. Ending 3 (Scattering — neutral): The corruption is dispersed, not destroyed — sets up New Game+.

### M45 — New Game Plus
[ ] Implement New Game+ mode. On any ending, prompt to start NG+. NG+ carries over: all hero levels, equipment, companions, gold, learned skills and talents. Resets: all map progress, story flags, dialog choices. Escalates: enemy HP +40%, enemy damage +25%, all bosses gain one new mechanic phase, loot quality floor raised to High. Implement NG+ visual indicator (gold border on UI, "+" suffix on difficulty display). Implement Nightmare tier (NG++ and beyond): further scaling, enemies gain additional status immunities, bosses gain Void Corruption aura.

---

## Phase 10: Polish, Audio, and Deployment (M46–M50)

### M46 — Audio Implementation
[ ] Implement the full Web Audio API sound system in `audio.js`. Layer zone ambient tracks with combat music that fades in/out dynamically. Add all SFX: weapon hit sounds by type (slash, bludgeon, pierce, arcane, fire, ice, void), spell cast sounds by element, UI button sounds, level-up fanfare, item pick-up chime, status effect triggers, boss phase transition stingers. Compose or source royalty-free base tracks. Implement volume controls and mute toggle. Add audio on/off persistence in save data.

### M47 — Cinematics and Cutscenes
[ ] Build a cutscene engine: full-screen background art with timed text panels, portrait dialog sequences, and optional canvas overlay animations. Implement cutscenes for: game opening, each act transition (4), each boss defeat (4), New Game+ start, and all three endings. Add a Replay Cutscenes option in the settings menu. Implement skip button (tap/click/any key) that jumps to cutscene end with confirm prompt. Add letterbox effect (black bars) during cinematic sequences.

### M48 — Gamepad and Accessibility Polish
[ ] Implement full gamepad support via the Gamepad API. Map buttons: D-pad navigates menus and map nodes, A confirms, B cancels, shoulder buttons cycle party members in inventory, start opens pause menu. Implement focus ring rendering for keyboard navigation (visible highlight on all interactive elements). Add colorblind mode (status effects use distinct shapes in addition to colors). Implement font size toggle (Normal/Large) affecting all game text. Audit all interactive elements for minimum 44×44px tap target size on mobile.

### M49 — Performance and QA Pass
[ ] Profile render loop and optimize canvas draw calls (dirty-rect rendering for static UI, batch sprite draws). Audit localStorage save size and implement save compression if approaching 5MB limit. Full play-through QA across all 4 acts: verify all story flags fire correctly, all side quests complete, all companions unlock, all boss phases trigger, all endings reachable. Fix edge cases in combat (simultaneous death, summon-on-full-party, etc.). Cross-device test on iOS Safari (iPhone 14 Pro), Chrome desktop, Firefox.

### M50 — GitHub Pages Deployment
[ ] Configure Vite for static production build targeting GitHub Pages base path. Set up GitHub Actions CI workflow: on push to main, run `vite build`, copy `dist/` to `gh-pages` branch, deploy. Verify all asset paths are relative (no absolute paths that break in subdirectory deploy). Add production error boundary (catch unhandled errors, display friendly message, offer save-export to clipboard). Write `README.md` with game description, controls, credits, and link to live game. Tag v1.0.0 release on GitHub.

---

*Total Milestones: 50 | Estimated Phases: 10 | Current Status: All pending [ ]*

---

## Deferred feature followups

- M48 Black Market vendor — COMPLETE (2026-04-12). New shadowy "Black Market" service tab in every town (gated: party leader level >= 3). Generates 6-10 restricted items per visit biased toward rare/legendary rarities and high/elite/exotic quality, reflavored as Cursed / Forbidden / Shadow / Assassin's items, priced at ~1.85x normal merchant value. Stock rotates whenever the party rests at the cleric. Dark #2a0a14 / #c04040 theme. See `src/ui/screens/TownScreen.js` `getBlackMarketStock`, `_blackMarketHTML`, `_blackMarketPrice`, `_wireServiceEvents` bm-buy handler, and `TOWN_STYLES` `.blackmarket-layout` block.
- M52 travel animations — COMPLETE (2026-04-12). Animated player marker now eases along the path from current node to destination over 1.2s (easeInOutQuad) with a "Traveling..." label and input lockout; see `src/ui/screens/MapScreen.js` `_startTravel`, `update`, `_drawMap`.
- M50 passive skill trees — COMPLETE (2026-04-12). Each class now has a 5-node passive tree (3 ranks per node) with themed bonuses: +maxHP, +maxMP, flat +STR/DEX/INT/CON, crit chance %, HP/MP regen per turn. Characters earn 1 passive point every 2 levels (see `src/game/xp.js` `checkLevelUp` passive grant block). Spent in a new "Passive" tab inside `src/ui/screens/SkillTreeScreen.js` (`_renderPassivePanel`, `data-passive` handler). Data/effects live in `src/game/passives.js` — `PASSIVE_TREES`, `getPassiveBonuses`, `getEffectiveAttrs`, `computeMaxHp/Mp`, `recalcPassiveStats`. Combat applies crit % and regen via `_memberToCombatant` in `src/ui/screens/CombatScreen.js`. LevelUp screen shows "+N Passive Points" banner (`LevelUpScreen.js` `lu-bonus-grants`). SaveManager migrates existing saves with `passiveRanks:{}` and `pendingPassivePoints:0`.
- M52 branching dialog — COMPLETE (2026-04-12). DialogScreen now supports a node graph (`event.nodes` + `start`) alongside legacy linear dialogs. Choices can carry `next`, `reward` (gold/xp/item), `setFlag`, and `requires` (stat min, gold min, or story flag). Helpers `_currentNode`/`_activeLines`/`_activeChoices`/`_activeOutcomes`/`_applyReward`/`_gotoNode` in `src/ui/screens/DialogScreen.js`. Converted `forest_enter`, `seer_hut`, and `ash_gate` in `src/maps/mapData.js` to 3-way branching with distinct XP/gold/item/flag outcomes. Linear dialogs still work unchanged.
---

## M292+ Approved Brainstorm Plan (added 2026-04-26)

The active workplan is now in `public/assets/wishlist.html` under the
`#approved-brainstorm` section. 93 items (74 brainstorm-approved + 19 manual
additions) grouped by target milestone M293–M309. See that section for the
full breakdown — duplicating it here would drift.

Quick index:
- M292 — COMPLETE — brainstorm/wishlist plumbing + CLAUDE.md docs.
- M293 — Small UI batch 1 (notification bubble fix incl post-combat skill-points clear, scroll-pos memory, status duration tooltips, party role icons via SVG/FA, quick-equip toast, combat preview tooltip).
- M294 — UI batch 2 (unified Party tabbed panel — deprecate old CharacterScreen, rename map Inventory→Party, zone-fast-travel dropdown, boss-intro splash with name wrap, dual-comparison desktop-only).
- M295 — Polish (enchanter preview, potion belt, achievement toasts, patch-notes shortcut, boss-prelude lines, plain-language status).
- M296 — Accessibility (colorblind palettes, font-size scaling, tap-target audit, reduce-motion in settings menu, combat-log captions).
- M297 — Keyboard navigation across menus (combat optional).
- M298 — Changelog flow + lore + roadmap + monument (changelog categorization, What's New splash, M### badges, roadmap page, Claude-authored lore compendium, hardcore monument with disabled-slot save support).
- M299 — Devtool catalogs + live-data override system + tools landing.
- M300 — Devtool batch 2 (skill sim, affix matrix, spell side-by-side, asset-pipeline trace, image-review-manifest cleanup, char-redesign archive, rebalance diff).
- M301 — Headless simulator + regression infra (configurable per-act thresholds, per-milestone save snapshots, merchant+guild+black-market loot audit, combat-log replayer export-only, automated end-to-end playthrough).
- M302 — COMPLETE 2026-04-26 — Gameplay batch 1 (companion level-sync + party avg in save UI, flee, steal-buff, bleed burst, curse, skill-check node, traveling merchant + minigame node-overlay system that prevents node-skip, DoT stacking modes per-spell).
- M303 — Enemy spells (reusable element FX + boss wind-ups + stealable buffs) + blue-name champion modifiers.
- M304 — Multi-phase bosses, boss-themed loot, hidden bosses, +8 dialogue branches per act.
- M305 — 24 sets (12 low + 8 mid + 4 endgame) + ~24 uniques + 40 affixes.
- M306 — Infinite scaling dungeon (separate from in-game dungeons).
- M307 — Crafting (easy white-recipe unlock, lore-node gated higher tiers, craftable uniques) + boss-defeat cinematic dialog.
- M308 — Number rounding audit (floor int stats, ≤2 decimals on floats) + fame-locked unlocks. COMPLETE 2026-04-27 (shipped as M311).
- M309 — public/news/ + Latest News widget + versioned asset archive + release.sh category prompts + backward-compat notes.
- M321 (labeled M315) — COMPLETE 2026-04-27 — Deep balance analysis + rebalance pass. Act 5 was trivial — party one-shotting everything, 0 retaliation. Fixed two simulator bugs (act-as-ng+ scaling bug, class ID casing bug). Raised global damage multiplier 1.0→1.3. Buffed all enemies Acts 1-5 (HP +30-100%, DMG +30-60%). Capped Backstab Assassinate (3.20→2.50 damageMult). Reduced Reality Shard stun 20%→10%. Post-rebalance sim: Act 5 regular 94-97% win rate, Architect boss 87% win for level-appropriate party. Analysis doc at public/docs/balance-analysis-M315.md.
