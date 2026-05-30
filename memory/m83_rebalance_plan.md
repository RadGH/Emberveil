# M83+ Rebalance & Formulas Plan

Captured from conversation 2026-04-14. Source of truth for the next several milestones. Update as decisions land. **NO SILENT SHELVING** — every item below either ships or gets explicitly deferred with confirmation.

---

## Driving problems

1. Tap weapons + spell power + cleric mass-res made early game trivial.
2. Most item affixes are orphaned — rolled but never read (confirmed: only `of_mana_regen` is wired in `CombatScreen.js:1295`).
3. Gold find affix does nothing (user tested 2000% → ~80 gold).
4. "Hit chance" affix exists but is never summed; hit IS a real mechanic (`actor.hit - target.dodge` in `CombatScreen._attack`, ~L1052).
5. No single source of truth for combat/economy formulas → drift between docs, code, and player understanding.

---

## Decisions locked in

### Difficulty levers (user picked #3 + #4 from the original menu)
- **Cleric Resurrect rework**:
  - Single target, **12-round per-combat cooldown** (resets each fight).
  - Revives at **25% HP** (also bump revive scrolls/potions to 25%).
  - **Damage immunity until the revived character's next action.** Reviving acts "just before their turn" so they aren't picked off.
  - Talents adjust: (a) higher heal %, (b) immunity that extends one full round after revive.
- **Enemy affix archetypes** to punish passive heal loops: caster (mana burn), executioner (heal-reduction / burst), etc. Designed *after* the formula refactor so the math is honest.

### Affix audit
- Survey page deployed: https://radgh.github.io/RSG-Demos/game13/assets/affix-survey.html
- User will fill it out and paste the generated prompt back. **Do not implement affix changes until that comes back.**
- Survey TODO additions (user request):
  1. Match the Asset Gallery color palette (consistent styling across every tool page).
  2. Add a **weighted drop-rate tool**: enter any weight, show % chance among all affixes, and a percentile / rarity color so you can gauge how rare each affix is relative to the rest.
  3. Move the survey (and the existing rebalance survey) into a new **"Tools"** dropdown in the shared nav header. Fix nav header styling drift while we're in there.
- Add **additional survey tools** for: armor formulas, dodge chance, magic find, encounter management (incl. custom-encounter builder via JSON + prompt — JSON because the user is "lazy" and wants both).

### Armor
- User wants **flat reduction, StarCraft-style** (not %-based mitigation).
- Add **armor penetration** as a flat reduction to the target's armor.
- Floor damage at 1 (probably) so super-tanky foes still take chip damage. Confirm in next round.

### Skill checks
- **Discard D&D-style rolls.** Replace with **skill gates**: dialog options like `[24 STR] Break the chains`, disabled if no party hero meets the threshold.
- Companions **not** counted toward gates. Heroes only.
- Gates need to scale with the expected player level for the zone they appear in (see Enemy Scaling).

### Stats UX (player page, hero creation, skill menus, anywhere stats appear)
- After formulas refactor, every stat display reads from `formulas.js`.
- Add a **`[x] BASE` toggle** to show base values without gear/passives.
- Color rules:
  - Equal to base → plain text.
  - Higher than base → blue.
  - Lower than base → red.
  - Special-case "double negative" stats (e.g. `-3 health drain` is actually good) — handle by tagging stats with `betterWhen: 'higher' | 'lower'`. If the stat improves, color blue regardless of sign.
- **Hover/click navigation**: hovering a stat (STR, DEX, etc.) opens a tooltip; click/tap jumps to that stat's Codex page, which lists every formula that references it. Tooltips must work on **both desktop hover and mobile tap** (likely a long-press or first-tap-shows-second-tap-follows pattern).

### Combat log improvements
- Hover (or tap on mobile) any stat/ability mention in the log to see the formula that produced the number.
- Tap-to-toggle for mobile, with optional "more details" expansion.

### Gold find / trade prices
- `goldFind` applies to **(a) combat gold + (b) chest loot** only.
- Add a **separate `tradePrices` stat** for shop buy-low / sell-high and quest reward modifiers. Distinct affix. Quests are "trade", not "find."
- XP find: yes, sibling stat to gold find. Pending: confirm whether XP find applies to quest XP too.

### Enemy scaling
- Treat current `mapData.js` numbers as **unintentional** — do a full rebalance.
- Need to **simulate expected player level per act** by walking the map graph: shortest path, full XP per node, see what level a min-runner ends each act at.
- Then back out enemy HP / dmg / hit / dodge curves so combat TTK stays in a target band (e.g. 3–6 rounds for trash, 8–15 for elites, 20+ for bosses).
- Once STR/DEX/INT actually flow into the right damage types (post affix wiring), gear + blacksmith upgrades will be powerful — bake that headroom into enemy curves.

### Codex / Wiki (in-game) + Combat Simulator
- New `src/game/formulas.js` as **single source of truth**: pure functions for hit, damage, healing, armor mitigation, gold reward, xp reward, skill gate threshold, enemy scaling per act, status tick math.
- All combat/reward sites refactored to call `formulas.js` (no behavior change in that step).
- **Vitest snapshot tests** on every formula so silent drift triggers a failure.
- **In-game Codex** screen, top-level from title (per user choice). Sections: Combat math, Healing/spell power, Armor & penetration, Skill gates, Rewards (gold/xp/trade), Enemy scaling per act, Status effects.
- Each Codex entry shows the formula text + plugged-in values from the live party.
- **Per-skill / per-item formula tooltips** wherever it makes sense.
- **Combat Simulator / Calculator** lives in a debug menu, *not* hidden — gated behind a "Debug Mode" toggle in Settings. When debug mode is on, a "Combat Simulator" menu option appears. It loads the live party + equipment, lets you swap gear / enemies / acts, and shows TTK both ways, DPS, sustain/sec, gold/xp per minute. Reads `formulas.js` directly so parity is automatic.

---

## Implementation order (proposed, awaiting confirmation)

1. **Refactor → `src/game/formulas.js`** with snapshot tests. No behavior change. Lays the foundation for everything else.
2. **Affix survey results** (when user returns): wire orphaned affixes through `getEquipmentAffixBonuses(member)` called from `_memberToCombatant`, `computeMaxHp`, `computeMaxMp`, etc. Add Vitest per affix.
3. **Cleric res rework** (12-round CD, 25% HP, immunity-until-action, single target). Update revive scrolls/potions too.
4. **Armor → flat reduction + penetration.** Update enemy data accordingly.
5. **Stats UX pass**: BASE toggle, color rules, hover-tooltips → Codex links, mobile tap support.
6. **Combat Simulator** (debug menu).
7. **In-game Codex/Wiki** screen.
8. **Enemy scaling rebalance** using simulator outputs to set act-by-act HP/dmg curves.
9. **Skill gate system** (dialog gating + level-aware thresholds).
10. **Gold find / trade prices / xp find** wiring + tests.
11. **Combat log hover/tap formula tooltips.**
12. **Tools dropdown in nav header**, move both surveys into it, restyle to match Asset Gallery.
13. **Additional survey/tool pages**: armor, dodge, magic find, encounter manager (with JSON + prompt input for custom encounters).

---

## Round-2 decisions (2026-04-14, after first question batch)

- **Damage floor**: option **(b)** `max(0, dmg - armor)`. Combat log shows "deflected" for fully-mitigated phys, "resisted" for fully-mitigated magic. Floor at 0, not 1.
- **Magic resist + magic penetration**: add as flat values (parallel to armor + armor pen). Add a hidden **% pen** version too — not rolled on common items, reserved for **unique/legendary affixes only**. Code path must be designed so flat-vs-% can be swapped or A/B compared later (likely an exponential curve experiment).
- **Damage types**: **physical / magic / true**. Three resist channels: armor (phys), magic resist (magic), true (unblockable). STR drives phys damage, INT drives magic, true is rare/special.
- **Shields — Block system**:
  - Two new affixes, **shields only**, **100% roll chance**:
    - **Block Chance** (10–75%)
    - **Block Power** (e.g. 30 flat damage absorbed)
  - Order in damage pipeline: **dodge → block → armor/resist → HP**.
  - Talents on Paladin and Cleric can boost block chance.
- **Affix survey additions** (round 2):
  - Per-affix **minimum rarity** field (not quality level). e.g. magic+, rare+, legendary+.
  - **Variant generator**: quickly clone an affix under a new name with different values (e.g. Sturdy → Tough → Brutish, all `+STR` at different rarity tiers).
  - Custom affix entries beyond the variant flow.
- **Enemy scaling input format**: **(a) role + tier curve** writing back to `mapData.js`. PLUS add an **Enemy Survey tool** (parallel to affix survey) covering stats, flavor, type, and ideally a sprite preview. Stretch: allow appearance edits in the tool.
- **XP find**: applies everywhere (combat, chests, quests). Symmetric with gold find on the "everyone loves it" principle.
- **Combat Simulator scope**: go straight to **v2**. Must support:
  - Party vs full encounter (multi-enemy, turn order, AI choices).
  - Load existing encounters from the encounter table by name (e.g. "Bandit Attack" pulls 3 NPCs).
  - Show enemy levels — **enemies should have levels**, and **all characters should expose their level** in the sim.
  - Act selector + any other knob that changes combat math (NG+, difficulty modifiers, etc.).
- **Tooltip UX**: corner-X close button always. **Hold ALT (desktop) to make tooltip sticky**, PoE-style, so you can hover links inside it. Mobile: first tap shows tooltip with X, second tap on same target navigates.
- **Shared assets**: yes, build out `shared/` directory more — `_tool-styles.css`, shared JS for tool surveys, etc. Per-game copies remain disposable, regenerated on every release.
- **Encounter builder + universal "Override Settings" debug menu**:
  - Big follow-up milestone of its own.
  - Every tool/survey gets **import/export JSON** support and a **"Prompt Mode" toggle** that adds a free-text area for prompt details (numbers go to game, text goes to clipboard for Claude).
  - Normalize via a shared `tools-survey.js` module that handles save/load/import/export/prompt-mode for any tool that opts in.
  - In-game **"Override Settings"** debug menu accepts pasted JSON for characters/enemies/stats/encounters and applies them to a running game.
- **Affix gating**: complex/powerful affixes (multi-stat, % pen, conditional triggers) reserved for **rare / legendary / unique** rarity tiers. Common/magic items only roll simple flat affixes.
- **Implementation order**: confirmed — formulas refactor first, even though it delays visible affix fixes by one step.
- **Next release deliverable**: ship as **"Simulation Overhaul"** milestone with a signature **animated report** (Chart.js graphs, flip cards, hover effects, IntersectionObserver reveals — same DNA as `tap-weapons.html` and `rebalance-survey.html`).

## Round-3 decisions (2026-04-14, after Q1-7)

- **Enemy levels**: computed from role+tier curve (b), **with a manual override field per enemy**. Honest default, escape hatch for handcrafted bosses.
- **Sim level slider**: yes. Add a **"Calculate attributes" checkbox** that temporarily replaces hero attrs with values derived from their level (enemies always do this — no toggle needed for them). Uncheck to restore the player's actual attribute spend.
- **Combat log mitigation strings**: extend "blocked X" pattern to all mitigation: **"deflected X"** for armor, **"resisted X"** for magic resist, **"blocked X"** for shields. Each is hoverable with a tooltip explaining the underlying stat (e.g. hover "deflected" → "Armor reduced incoming physical damage by X. Armor pen reduces this.").
- **Animated report hero charts**: ship **all three** — waterfall (per-act dmg budget), heatmap (party-vs-act TTK), and DPS-vs-EHP scatter. Goal: report should be impressive enough that readers want to play the game.
- **Override Settings debug menu**: **runtime only**. Adds a "Save as Preset" button that exports the entire current settings/state blob as JSON (downloadable). Presets can be re-imported on a fresh run.
- **Tests gate release**: confirmed. `release.sh game13` must run `npm test` and abort on failure.
- **Milestone cadence**: ship in multiple parts. No fixed count. Discipline: every announced item lands in some milestone — if it slips, it must be explicitly deferred in writing, never silently shelved.

## Round-4 additions (2026-04-14)

- **Create Hero starter classes**: trim to **5 visible by default**: Warrior, Ranger, Rogue, Fighter, Mage. **NOTE/QUESTION**: Warrior and Fighter overlap in most game lexicons. Confirm whether you want both or one was a typo (maybe Fighter → Cleric or Knight?). Default if no answer: keep both as listed.
- **Hero unlock system**: each non-starter class gated behind one of:
  - achievement (e.g. "Defeat Bahamoth" unlocks Dragon Knight)
  - hero level (e.g. any hero reaching 15 unlocks Chronomancer)
  - act completion (e.g. clear Act 3 unlocks Necromancer)
  - difficulty / NG+ tier (e.g. NG+1 unlocks Pyromancer)
  - Locked classes show in the picker as greyed-out tiles with the unlock requirement listed.
  - Unlocks are persistent across saves (stored in a top-level localStorage key, not per-save), so re-rolling a character carries unlocks forward.
- **Skill audit (Chronomancer + others)**: user suspects Chronomancer skills may be orphaned the same way affixes were. Audit every skill in `src/game/skills.js` against its consumer in CombatScreen `_executeSkill` to find skills that define effects never read by combat. Treat any unread effect key as a bug. Generate a report similar to the affix audit. Likely candidates beyond Chronomancer: Tactician (Rally Action / Reposition), Oracle (Foresight / Prophecy), Druid (Wild Shape).

## Round-5 decisions (2026-04-14, after m93/m94 status check)

- **Enemy rebalance: POSTPONED.** Do not start the role+tier curve work or touch enemy HP/dmg until all skills are wired and verified working. Reason: rebalancing twice (once on broken skills, again after they're fixed) is wasted work. Enemy Survey can still be filled out, but no rebalance pass until skills are at ~95% green.
- **Create Hero starter classes**: Warrior and Fighter are **different classes** in the user's design. Warrior is a starter; Fighter unlocks later. The other 4 starters are flexible — pick 5 generic damage-flavored classes, **NO HEALERS** (no Cleric, no Druid as starter — they make the 1st experience too slow). **Confirmed starter set: Warrior, Mage, Ranger, Rogue, Necromancer.** Necromancer fits the dark fantasy tone. All 14+ other classes gated by achievement / level / act / NG+ tier (TBD per class when the unlock screen is built).
- **m95 priority**: user has no preference. Default holds — chase the **6 type branches** first (`zone, trap, counter, utility, debuff, passive`) because they unlock the most orphaned skills per unit of effort. Heavy per-skill systems (Jackpot/Flair/Fate Weave/Corruption tick) follow in m96.
- **m92 gameplay testing**: user will test Chronomancer, Tactician, Bard now that talent merge is live. No action needed from us — capture any feedback as new bugs in the next round.

## Round-6 decisions (2026-04-14) — Pixel Engine "Re-redesign" milestone

The old OpenAI roster (M79) looked good but was inconsistent: characters wore different gear when attacking, weapons changed mid-animation, the cat used a SWORD. Re-redesign uses **Pixel Engine (PixelLab MCP)** to generate consistent animations from each character's existing portrait as the reference. New milestone: **"Re-redesign"** with its own animated report (same DNA as Simulation Overhaul / Tap Weapons / M79 Redesign).

### Pipeline (per character)

1. **Source portrait**: use the existing portrait from `public/images/portraits/<id>.png`. If missing (Tactician, Chronomancer flagged in game-info), generate a fresh one via OpenAI gpt-image-1 in the same pixel-art style first, save under portraits/, then continue.
2. **Downscale to 256px** — bilinear unless something better preserves crispness (try `pixelated` / nearest-neighbor for the existing PixelLab inputs since they're already low-res-friendly). Document choice in the report.
3. **Send to PixelLab** (MCP `mcp__pixellab__create_character`) with the portrait as reference. Ask for these 5 variants per character:
   - **front-facing idle**
   - **east-facing idle**
   - **east-facing physical/weapon attack** — ⚠ ANIMALS DO NOT USE WEAPONS. Wolves bite, cats claw, dragons breathe. Filter the prompt by character type so the generator never gives a paw a sword.
   - **east-facing spell attack**
   - **east-facing unconscious / death** (lying on the ground)
   - **(also)** **new portrait** — let PixelLab regenerate the portrait at higher fidelity in its own style for consistency with the animation set.
4. **Background removal**: PixelLab outputs do NOT have transparent backgrounds. Use a **green-screen background prompt** (force solid bright green `#00ff00`) and post-process via PixelLab's background eraser tool to chroma-key the green out. Document the prompt template.
5. **Compress** with the existing image optimizer (the one release.sh already runs on dist/) — apply to the source PNGs in public/images/ before the build picks them up.

### Scope estimate

- Heroes: 14 classes × 5 variants = 70 + 14 portraits = **84 images**
- Hireable mercs / unique merc heroes: ~10 × 5 = **50 images**
- Companions: ~15 × 5 = **75 images** (+ new pets below = +40)
- Enemies (incl. minibosses): ~31 × 5 = **155 images**
- Bosses: ~11 × 5 = **55 images**
- **Total ≈ 419 images, but the user's estimate is ~340, so trim variant count for low-priority characters (single-portrait-only for some background NPCs).**
- Cost: ~12 credits/image × 340 = **~4080 credits**. **User-approved budget: up to 10,000 credits.** Stay under.

### Game integration (DEFERRED past m95 — graphics generation can start now, wiring later)

- Combat start/end → front-facing stance.
- Mid-combat → east-facing stances (flipped horizontally for enemies on the right).
- Portrait used during character-turn callouts and dialog (encounter dialogs, enemy speech, level-up).
- Tavern UI revamp to feature the new portraits prominently.

### New companions tied to class passives (DEFERRED until after m95 — skill rewiring lands first)

These are NOT in the tavern town pool. They're **summoned/unlocked** via passive skill investment:

- **Necromancer**: Skeletal Warrior, Bone Golem
- **Druid**: Wolf, Bear (multiple sizes)
- **Warlock**: Imp, Demon
- **Ranger**: Hound (war-trained)
- **Pyromancer**: Fire Elemental
- **Stormcaller**: Lightning Elemental
- **Mage**: Familiar — *magic domestic cat with a top hat that casts spells*
- **Pet scaling**: passive points unlock + scale. Two Necromancers can each have their own pets. Pet stats inherit from summoner skill ranks. Future: % pet damage / pet HP affixes on gear.
- **Pets generate the same 5-variant set** as other characters; ~9 new pets × 5 = +45 images. Roll into the same Pixel Engine batch.

### Re-redesign report

Build `public/news/re-redesign.html` (animated, IntersectionObserver reveals, flip cards, Chart.js comparison if relevant) showing before/after pairs, the consistent-animation goal, the green-screen+eraser pipeline, the cat-with-a-sword bug as a featured "what we fixed" callout. Same DNA as `m79-redesign.html` and `simulation-overhaul.html`.


## Conversation history reference
Full prompt history auto-logged to `memory/prompt_history.md` by the UserPromptSubmit hook. This file is the **decision log** — prompt_history is the raw transcript.
