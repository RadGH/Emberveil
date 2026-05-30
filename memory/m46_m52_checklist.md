# M46–M52 Master Checklist

This is the source of truth for verification. Every item is taken directly
from the user's 2026-04-11 feedback batch. Do **not** remove items; check
them off only after verifying the implementation in code AND in a running
build. The verification pass at the end of M52 walks this entire file.

Format: `- [ ]` pending, `- [x]` verified. Add a `(file:line)` reference once
verified.

---

## New Classes (M48)
- [ ] Stormcaller — Lightning mage; chain damage + area denial
- [ ] Druid — Shapeshifting healer; HoTs + nature magic
- [ ] Oracle — Predictive healer; pre-shield against incoming damage
- [ ] Tactician — Manipulates turn order, grants extra actions, repositions allies
- [ ] Chronomancer — Haste/slow/rewind/time-stop
- [ ] Each new class: 4 active skills, ≥2 upgrades each, talent tree entries
- [ ] Each new class: PixelLab sprites 68×68, all 4 directions, in `public/images/sprites/`
- [ ] Each new class: SPRITE_MAP updated in `CombatScreen.js`
- [ ] Each new class: catalog every generated image in `public/demo-assets/assets.json`
- [ ] Each new class: at least 1 portrait

## Combat Improvements (M46 + M50)
- [ ] Animated attack/hit sprites — bob forward on attack, recoil on hit
- [ ] Boss intro cinematic — name flash + dramatic pause before round 1 (M50)
- [ ] Larger, distinct boss sprites with larger combat representation (M46/M50)
- [ ] Critical hit system — natural 20 DEX → 2× damage with visual flourish
- [ ] Party formation by list order — earlier in list = attacked first; companions before characters; no new UI
- [ ] Target priority AI — healers target lowest HP ally; tanks auto-taunt; smarter enemy targeting
- [ ] Enemy AI uses skill rotations, casts heals on allies, reacts to player actions
- [ ] Mana regeneration per turn based on INT
- [ ] Item affix: `+X mana regen / turn` available in affix pool
- [ ] Character Stats panel includes **Attack** (range) — STR or ½ DEX, applies to auto-attacks + physical spells
- [ ] Character Stats panel includes **Spell** — INT-based spell power on magic spells
- [ ] More combat encounters with larger groups of weaker enemies (motivates AoE)

## Party / Hire / Inventory UX (M47)
- [ ] Class symbols + primary role on Hire-a-Mercenary screen
- [ ] Class symbols + primary role on Hire Custom screen
- [ ] Class symbols + primary role on Character Editor (initial creation)
- [ ] "Build Mercenary" renamed to **"Hire Custom"**
- [ ] Hire Custom button disabled when player has < 100g
- [ ] Hire Custom: pay per **level**, not per attribute point
- [ ] Hire Custom: cap level at player's highest-level character
- [ ] Level-N premade tavern merc costs less than level-N custom merc
- [ ] Custom merc options available in towns beyond starter
- [ ] Tavern mercs disappear from list once hired (no two "Borin")
- [ ] Party tab: drop active/inactive distinction
- [ ] Party window companions visible on desktop (2-column layout)
- [ ] Necromancer auto-grants Skeleton companion (no summon-skill required)
- [ ] Necromancer skills updated (Bone Spear etc., no redundant raise)

## Map & Travel (M49)
- [ ] Node-by-node travel — no teleporting to distant nodes
- [ ] Animated travel transition — party arrow/sprite walks between nodes
- [ ] Halfway-point random encounter chance with skill-check avoidance
- [ ] Single-use treasure nodes — show "already searched" after first use
- [ ] Combat encounter nodes still trigger random encounters on revisit
- [ ] Act 2: +1 node
- [ ] Act 3: +1 node, +1 path
- [ ] Act 4: +2 nodes
- [ ] Act 5: +2 nodes, +2 paths
- [ ] Zone transition cutscenes
- [ ] Random ambushes while traveling

## Town & Economy
- [x] **Black market** vendor with rare+ items, quality scales with act/difficulty (M48 — COMPLETE: TownScreen.js getBlackMarketStock + _blackMarketHTML, gated at party level 3, 6-10 items/visit biased rare/epic, 1.5-2x prices, refreshes on rest, dark #2a0a14 / #c04040 theme)
- [ ] Forge unlocks in Act 3 or 4 (whichever comes after Blacksmith) (M47)
- [ ] **Daily** option removed from towns (M47)
- [ ] Town right-column scroll bug on desktop fixed (M47)

## Dialog & Story (M51)
- [ ] Branching dialog trees — choices lead to different paths, not just outcomes
- [ ] Companion interjections during dialog (e.g. Borin on combat-related choices)
- [ ] Side quests can spawn from random encounters
- [ ] More depth + dialog options on existing encounters
- [ ] Act-specific side quests with unique thematic rewards
- [ ] Act completion summary screen (enemies/gold/quests/time)
- [ ] Act difficulty indicators on world map

## Quality of Life (M52)
- [ ] Item comparison tooltip — stat delta vs equipped
- [ ] Combat replay / log export
- [ ] **View Combat Log** button on after-action dialog (below Continue)
- [ ] Passive skill trees per class

## Bug Fixes & System Upgrades (M46 unless noted)
- [ ] Combat character rendering blank (canvas draw race)
- [ ] Shrine `empower` effect type implemented
- [ ] ChallengeScreen `onResume` false-advances wave count
- [ ] ForgeScreen salvage list excludes equipped items
- [ ] PartyScreen swap auto-saves after rearranging
- [ ] Item set bonus shown to player (tooltip + Character panel)
- [ ] NG+ attribute points spendable outside combat level-up
- [ ] Enchanter rebuilds item display name after adding affix
- [ ] Title screen stars use truly-random per-session positions
- [ ] Save format migration for `seenEvents`, `portals`, etc.
- [ ] Combat SFX two-note loop stops on combat end (no leak into town)
- [ ] iPhone pinch-zoom in combat no longer pixelates / breaks layout
- [ ] Combat camera repositions so all characters stay visible at any viewport
- [ ] Party-death TPK returns party to town at full HP

## Visual & Audio Polish (M50)
- [ ] Character entrance animations at combat start
- [x] Animated parallax combat backgrounds (clouds, embers) — 3-layer parallax in CombatScreen._drawParallaxLayers + MapScreen._drawParallaxSky (deferred M51 follow-up COMPLETE)
- [ ] Environment background art on encounter screens
- [ ] Environment background art on combat screens
- [ ] Combat layout: 0–25% foreground, 26–50% ground row, 51–100% sky/bg
- [ ] All character y-rows fit within the ground band

## Class & Skill System (M47/M52)
- [ ] Skill points reduced to 1 per **3 levels**
- [ ] Every skill (including Heal) has ≥ 2 upgrades
- [ ] Heal upgrade option: 50% splash to adjacent ally
- [ ] Heal upgrade option: barrier at 25% heal value
- [ ] Passive skill trees implemented (M52)

## ESC Menu (M47)
- [ ] ESC menu accessible everywhere except title and combat
- [ ] Menu items: Resume, Save/Load, Options, Party, Codex
- [ ] Party / Codex / Save buttons removed from town
- [ ] Combat retains its own pause menu (unchanged)

## Survey Site & Demo-Assets (M52)
- [ ] Survey site rewritten — all old questions replaced unless still unaddressed
- [ ] Survey adds suggestions for multiple existing systems
- [ ] Survey proposes several brand-new systems for Emberveil
- [ ] Survey site linked from `public/demo-assets/`
- [ ] Milestone reports linked from `public/demo-assets/` as clickable HTML files (see game8 layout)
- [ ] Reports for M46–M52 added to `assets.json` `reports` array

## Graphics Generation (ongoing through M46–M53)
- [ ] All new classes have sprites generated **before** their milestone is closed
- [ ] All new enemy types have sprites
- [ ] Environment art for every zone (queued early for M53)
- [ ] Boss sprite variants (queued early for M53)
- [ ] Portrait packs for new classes (queued early for M53)
- [ ] Class-symbol icons for the 5 new classes
- [ ] Black market vendor portrait + shop background
- [ ] Every generated image cataloged in `public/demo-assets/assets.json`

---

## Additional feedback batch — 2026-04-11 (round 2)

Slot each into the noted milestone. Verify in the M52 pass alongside everything else.

### Character stats consistency (M47)
- [ ] Melee + Spell stats already exist on original character editor — surface the same stats on Inventory **Character Stats** panel and on the Hire Custom (tavern) editor. All three screens must be consistent.

### Combat HUD cleanup (M46)
- [ ] Remove the label above enemy NPC names during combat
- [ ] Hide enemy HP bar when they die (currently turns red, centered behind sprite)
- [ ] Move HP bars slightly higher so they don't cover character graphics
- [ ] Player sprites must NOT render larger than enemy sprites — fix scaling so most combat sprites are larger overall and consistent (#13)
- [ ] Player characters must actually play attack and cast animations during combat — wire the animations that already have art (#15)
- [ ] Add missing sprites — at least one "void ___" enemy is missing art (#16)
- [ ] Remove the lightning-bolt icon from the speed indicator button in combat (#17)
- [ ] iPhone portrait, 4 characters: HP bar bottom strip must render as **2×2**, not row-of-3 + row-of-1 (#10)

### Town menu trim (M47)
- [ ] Remove the **Pending Upgrades** tab from town entirely
- [ ] Keep the number bubble on the **Skills** tab
- [ ] Remove the number bubble on the **View Map** button
- [ ] Move **Trophies** out of the town menu and into the new ESC menu (alongside Resume / Save-Load / Options / Party / Codex)

### Quests (M51)
- [ ] Add a way to **turn in completed quests** and receive rewards (if not already implemented)
- [ ] Quest button shows a number bubble = count of **completed (turn-in-able)** quests

### Companion art gap (M46 / queue M53)
- [ ] **War Dog companion still has no graphics** — generate sprites and wire them up

### Warrior skill rework (M47)
- [ ] Replace Warrior **Shield Bash** with **Cleave** — hits up to 3 adjacent targets
- [ ] Cleave gets its own upgrade feats (≥ 2, per the every-skill-2-upgrades rule)

### Skill checks (M46)
- [ ] Skill-check dialog gates (e.g. "12 INT") must use the **highest party-member stat**, not the speaker
- [ ] **Companions are excluded** from skill-check stat pooling
- [ ] Disabled choices must visibly disable when no eligible character qualifies (currently a fighter with 8 INT can pick a 12 INT option)

### Loot quality (M46)
- [ ] All rings and amulets get a **base affix even at white quality** (otherwise white rings are useless)
- [ ] Magic ring/amulet → 2 affixes (base + 1 magic), Rare → 3, etc. — scale upward consistently

### Level-up flow (M47)
- [ ] **Bug**: leveling 3 characters in one combat sometimes only opens the level-up panel for 2 — queue all level-up panels reliably
- [ ] **Do not require spending attribute points immediately** — let unspent points persist
- [ ] Add an **attribute spend UI inside the Skills menu** so unspent attributes can be assigned later
- [ ] Same applies to skill points (already deferable, verify)

### Character creation balance (M47)
- [ ] New character editor: fixed budget — all attributes start at **8**, player spends exactly **8** additional points
- [ ] Hire Custom (tavern) editor: same fixed-budget model
- [ ] Unspent attribute points carry forward and can be spent later via the Skills menu

### Blacksmith UX (M47)
- [ ] After clicking an upgrade in the Blacksmith UI, the page must **not** scroll to top — preserve scroll position

### Misc polish (M46)
- [ ] Remove the ⭐ star emoji from the post-encounter level-up dialog (#17)

---

## Verification log

After M52, fill in this section. For each section above, write:

- Date verified
- File:line where the change lives
- Verification method (code-read / dev-server click-through / iPhone viewport test)
- Pass / Fail

If any item fails, reopen the relevant milestone before declaring the batch
complete. Do not advance to M53 with unverified items.
