# Phase 14 — Combat Content Expansion Plan
**M385 design doc — plan only, no code shipped**
**Date:** 2026-04-29

---

## 1. Named-Character Tier Table

Three tiers of named characters exist above the base Champion (blue) tier that was introduced in M303. The Champion tier is renamed **Blue** here for clarity. New tiers are **Yellow (Rare)** and **Gold (Legendary)**.

| Tier | Color | HP Mult | Dmg Mult | Armor Bump | Affix Budget | Extra Spells | Challenge-Node Frequency | Drop Guarantee |
|------|-------|---------|----------|------------|--------------|--------------|--------------------------|----------------|
| Blue | `#6090ff` | ×1.5 base (existing) | ×1.3 base (existing) | +4 | 1–2 from `MODIFIER_POOL` | 0 (existing `spellList` only) | 60% of named slots | Always magic+ item |
| Yellow | `#e8c020` | ×2.2 | ×1.6 | +10 | 2–3 affixes | +1 spell from tier's biome pool (see §4) | 30% of named slots | Always rare+ item; 15% unique chance |
| Gold | `#f0a000` | ×3.5 | ×2.0 | +18 | 3–4 affixes | +2 spells from tier's biome pool; always includes one AoE/debuff | 10% of named slots | Always unique drop |

**HP Mult stacks on top of base enemy HP** — it does not stack with the existing generic champion multiplier. Named characters are a separate code path from generic champions.

**Affix budget:** affixes are drawn from `MODIFIER_POOL` (`CHAMPION_MODIFIERS` keys: `regen`, `aura_damage`, `fast`, `extra_strong`, `tough`, `cursed_aura`, `shielded`, `lifesteal`, `thorns`, `inferno`). Yellow gets priority access to the "dangerous" set (`aura_damage`, `lifesteal`, `cursed_aura`, `shielded`). Gold always rolls from the full pool with no restrictions and always gets at least one "dangerous" affix.

**Per-act curve for challenge-node tier distribution:**

| Act | Blue % | Yellow % | Gold % |
|-----|--------|----------|--------|
| 1 | 100 | 0 | 0 |
| 2 | 80 | 20 | 0 |
| 3 | 60 | 35 | 5 |
| 4 | 40 | 45 | 15 |
| 5 | 20 | 55 | 25 |
| 6 | 10 | 50 | 40 |

---

## 2. Extra Spells Per Tier — Biome Spell Pools

Yellow and Gold named characters pull from their act's biome spell pool when rolling extra spells. All IDs are existing `ENEMY_SPELLS` entries from `enemySpells.js`.

| Act | Biome | Blue spells (existing, no change) | Yellow extra pool | Gold extra pool |
|-----|-------|-----------------------------------|-------------------|-----------------|
| 1 (Border Roads / Thornwood) | Forest/Road | `imp_fireball`, `acolyte_curse` | `imp_fireball`, `acolyte_curse`, `frost_lance` | `acolyte_curse`, `mage_arcane_blast`, `druid_thorns` |
| 2 (Ashen Wastes) | Fire/Ash | `imp_fireball`, `titan_magma_wave` | `imp_fireball`, `titan_magma_wave`, `acolyte_curse` | `titan_magma_wave`, `sovereign_voidstorm`, `harpy_screech` |
| 3 (Shattered Hell) | Hell/Void | `acolyte_curse`, `lich_drain_life` | `lich_drain_life`, `sovereign_voidstorm`, `acolyte_curse` | `sovereign_voidstorm`, `lich_soul_shatter`, `lich_drain_life` |
| 4 (Cosmic Rift) | Void/Cosmic | `sovereign_voidstorm`, `wraith_chill` | `sovereign_voidstorm`, `wraith_chill`, `lich_drain_life` | `sovereign_voidstorm`, `lich_soul_shatter`, `mage_arcane_blast` |
| 5 (Primordial Abyss) | Abyssal | `lich_soul_shatter`, `sovereign_voidstorm` | `lich_soul_shatter`, `lich_drain_life`, `serpent_venom` | `lich_soul_shatter`, `sovereign_voidstorm`, `titan_magma_wave` |
| 6 (Dragon Reach) | Dragon/Fire | `titan_magma_wave`, `harpy_screech` | `titan_magma_wave`, `harpy_screech`, `frost_lance` | `titan_magma_wave`, `sovereign_voidstorm`, `lich_soul_shatter` |

**Spell chance:** Blue uses enemy's base `spellChance`. Yellow: `spellChance + 0.10`. Gold: `spellChance + 0.20`, minimum 0.45.

---

## 3. Named-Character Roster Expansion

12–18 new named characters. Naming convention: `<Title> <Name>`, displayed in their tier color in the combat HUD. Each has a guaranteed drop on death.

**Act 1 — Border Roads / Thornwood Forest (biome: forest, road)**

| Name | Tier | Base Enemy Template | Signature Ability | Drop Guarantee |
|------|------|--------------------|--------------------|----------------|
| Thorn-Handed Murg | Blue | `goblin_warrior` | `acolyte_curse` on round 1 | magic+ weapon |
| The Pale Widow | Yellow | `corrupted_wolf` | `druid_thorns` + `fast` affix | rare+ ring or amulet |
| Ragefang, Warchief | Yellow | `goblin_warlord` | `aura_damage` affix + `imp_fireball` | rare+ armor |

**Act 2 — Ashen Wastes (biome: fire, ash)**

| Name | Tier | Base Enemy Template | Signature Ability | Drop Guarantee |
|------|------|--------------------|--------------------|----------------|
| Ashen Sybil Krae | Blue | `veil_cultist` | `acolyte_curse` every round | magic+ wand or ring |
| The Obsidian Sentinel | Yellow | `ash_brute` | `titan_magma_wave` + `tough` affix | rare+ heavy armor |
| Emberknight Vareth | Yellow | `veil_templar` | `titan_magma_wave` + `extra_strong` affix | rare+ weapon |
| Cindermaw, the Eternal | Gold | `cinder_hound` (inflated) | `titan_magma_wave` + `sovereign_voidstorm`; `lifesteal` + `shielded` affixes | **Unique: Cindermaw's Brand** (see §5 dungeon uniques) |

**Act 3 — Shattered Hell (biome: hell, void crystal)**

| Name | Tier | Base Enemy Template | Signature Ability | Drop Guarantee |
|------|------|--------------------|--------------------|----------------|
| Fleshwright Gorvak | Blue | `hell_knight` | `acolyte_curse` + `thorns` affix | magic+ heavy armor |
| Soulrender Nyx | Yellow | `void_shade` | `lich_drain_life` + `cursed_aura` affix | rare+ ring or staff |
| The Hollow Throne | Yellow | `arch_demon` (renamed) | `sovereign_voidstorm` + `regen` + `shielded` affixes | rare+ amulet |
| Dread-Scribe Omen | Gold | `lich_knight` (renamed) | `lich_soul_shatter` + `sovereign_voidstorm`; `lifesteal` + `aura_damage` affixes | **Unique: Tome of the Broken Seal** (see §5) |

**Act 4 — Cosmic Rift (biome: void, cosmic)**

| Name | Tier | Base Enemy Template | Signature Ability | Drop Guarantee |
|------|------|--------------------|--------------------|----------------|
| Star-Eater Vull | Yellow | `star_horror` | `wraith_chill` + `fast` affix | rare+ weapon |
| The Collapsing Eye | Gold | `cosmic_titan` (inflated) | `sovereign_voidstorm` + `lich_soul_shatter`; `aura_damage` + `cursed_aura` affixes | **Unique: Lens of the Collapsing Eye** (see §5) |

**Act 5 — Primordial Abyss (biome: deep, abyssal)**

| Name | Tier | Base Enemy Template | Signature Ability | Drop Guarantee |
|------|------|--------------------|--------------------|----------------|
| Worm-Mother Sreth | Yellow | `genesis_worm` (inflated) | `serpent_venom` + `regen` + `tough` affixes | rare+ amulet or ring |
| The Unmade Scholar | Gold | `abyssal_knight` (inflated) | `lich_soul_shatter` + `sovereign_voidstorm`; `lifesteal` + `shielded` affixes | **Unique: The Unmade Codex** (see §5) |

**Act 6 — Dragon's Reach (biome: dragon, fire)**

| Name | Tier | Base Enemy Template | Signature Ability | Drop Guarantee |
|------|------|--------------------|--------------------|----------------|
| Ashscale Patriarch | Yellow | `wyrm_warrior` (inflated) | `titan_magma_wave` + `extra_strong` + `regen` affixes | rare+ weapon |
| Frostcoil Matriarch | Yellow | `frost_wyrm` (inflated) | `frost_lance` + `shielded` + `fast` affixes | rare+ armor |
| Bahamorth's Herald | Gold | `ancient_dragon` (inflated) | `sovereign_voidstorm` + `titan_magma_wave`; `aura_damage` + `lifesteal` affixes | **Unique: Herald's Scale Mantle** (see §5) |

**Note on "inflated" templates:** These reuse the existing ENEMIES definitions with stats multiplied by the tier table values (×2.2 HP / ×1.6 dmg for Yellow, ×3.5 HP / ×2.0 dmg for Gold) at spawn time, the same mechanism used for existing champions. No new enemy stat blocks need to be hand-authored.

---

## 4. Challenge-Node Redesign

**Current behavior (mapData.js):** Challenge nodes fire a hard encounter drawn from their `encounter` field and reward a treasure chest via the standard loot roll. No named character is guaranteed.

**Proposed replacement behavior:**

1. **Always spawn at least one named character** at the front of the encounter. The named character's tier is drawn from the per-act curve in §1.
2. **50% chance**: add a pack of 2–3 minions drawn from the zone's `ZONE_ENCOUNTER_POOLS` entry. The minions use the encounter's base stats (no champion bump — they're pack fodder, not champions).
3. **Defeat reward:**
   - Gold: 1.5× the zone's standard combat gold.
   - Item: always magic+ (not just a chest roll); rare roll of 20%.
   - If a named Yellow or Gold was in the fight: 15% / 40% chance respectively to also drop a unique item from a small per-act unique pool (separate from dungeon uniques — these are "minor uniques", non-legendary-effect items but with unusually high base stats).
4. **Named characters in challenge nodes** are drawn from the roster in §3 first; if no roster entry exists yet for that act/tier (because some acts have fewer named characters defined), fall back to a dynamically named champion (use existing `rollChampionModifiers()` path with a generated title prefix like "the Relentless", "the Undying", etc.).

**Challenge-node data shape change (mapData.js):** The `encounter` field on challenge nodes no longer fires directly. Instead, a new optional `namedPool` array (list of named-character IDs) is added. If `namedPool` is absent, the system draws from the act's default named pool. The `encounter` field is used only if no named character is resolved (i.e., the named pool is empty), so existing nodes degrade gracefully.

---

## 5. Combat Node Count Per Act (2–3× Target)

**Counting methodology:** "combat node" = any node with `type: 'combat'`, `type: 'ambush'`, or `type: 'challenge'`. Boss and dungeon nodes are counted separately. Prologue is excluded per spec.

### Current Counts (from mapData.js zones)

| Act | Zone | Combat | Ambush | Challenge | Total combat-type |
|-----|------|--------|--------|-----------|-------------------|
| 1 | border_roads | 2 | 0 | 0 | 2 |
| 1 | thornwood | 1 | 0 | 1 | 2 |
| **Act 1 total** | | | | | **4** |
| 2 | dust_roads | 2 | 2 | 1 | 5 |
| 2 | ember_plateau | 2 | 2 | 1 | 5 |
| **Act 2 total** | | | | | **10** |
| 3 | hell_breach | 2 | 1 | 1 | 4 |
| 3 | shattered_core | 2 | 2 | 1 | 5 |
| **Act 3 total** | | | | | **9** |
| 4 | cosmic_rift | 2 | 2 | 2 | 6 |
| 4 | eternal_void | 2 | 2 | 2 | 6 |
| **Act 4 total** | | | | | **12** |
| 5 | abyssal_depths | 2 | 2 | 1 | 5 |
| 5 | primordial_nexus | 2 | 2 | 1 | 5 |
| **Act 5 total** | | | | | **10** |
| 6 | dragons_reach | 2 | 1 | 1 | 4 |
| 6 | dragon_throne | 2 | 1 | 1 | 4 |
| **Act 6 total** | | | | | **8** |

**Grand total today: 53 combat-type nodes across Acts 1–6.**

### Proposed Counts (2–3× target, cleaner paths)

The current graph has some diamond-shaped merges where ambush nodes on the bottom rail branch back into the main path. The proposal is to convert free-floating ambush nodes into named challenge nodes with directional flow (no back-merges), and add 1–2 extra combat nodes per zone as forward-linear beats between existing landmarks.

**Design principle for new nodes:** Insert new nodes along existing exits before existing landmarks. Prefer placing them on the "main rail" (upper 40–60% y range) so the path reads left-to-right cleanly. Reserve the bottom rail (y > 0.75) for challenge + optional treasure chains.

| Act | Zone | Proposed Total Combat-Type | Net New | Notes |
|-----|------|---------------------------|---------|-------|
| 1 | border_roads | 5 | +3 | Add 2 combat + 1 challenge; remove back-merging shrine-bypass |
| 1 | thornwood | 5 | +3 | Add 2 combat + 1 challenge on main rail |
| **Act 1** | | **10** | **+6** | |
| 2 | dust_roads | 8 | +3 | Add 2 combat + 1 challenge; convert 1 ambush to challenge |
| 2 | ember_plateau | 8 | +3 | Add 2 combat + 1 challenge on main rail |
| **Act 2** | | **16** | **+6** | |
| 3 | hell_breach | 8 | +4 | Add 3 combat + 1 challenge; cut one dialog→combat conversion |
| 3 | shattered_core | 8 | +3 | Add 2 combat + 1 challenge |
| **Act 3** | | **16** | **+7** | |
| 4 | cosmic_rift | 9 | +3 | Add 2 combat + 1 challenge |
| 4 | eternal_void | 9 | +3 | Add 2 combat + 1 challenge |
| **Act 4** | | **18** | **+6** | |
| 5 | abyssal_depths | 9 | +4 | Add 3 combat + 1 challenge |
| 5 | primordial_nexus | 9 | +4 | Add 3 combat + 1 challenge |
| **Act 5** | | **18** | **+8** | |
| 6 | dragons_reach | 8 | +4 | Add 3 combat + 1 challenge |
| 6 | dragon_throne | 8 | +4 | Add 3 combat + 1 challenge |
| **Act 6** | | **16** | **+8** | |

**Grand total proposed: 94 combat-type nodes — a 1.77× increase.** This sits at the low end of the 2–3× target for acts 2–6 but a 2.5× for act 1 which was historically thin. Acts 4–6 (the power fantasy acts) hit near 2× while keeping path readability.

If the target must be strictly 2× for all acts, the remaining delta can be achieved by converting a portion of the existing `dialog` and `lore` nodes to light-combat nodes (encounters using 1 enemy instead of 3–4), which costs less graph restructuring work.

### Specific Insertion Points Per Zone

**border_roads:**
- Between `road_ambush` and `crossroads_a`: new node `road_patrol` (combat, `goblin_patrol`)
- Between `crossroads_a` and `ruined_watch`: new node `watchtower_approach` (combat, `corrupted_outpost`)
- New bottom-rail node `road_challenge` off `crossroads_b` → exits to `ruined_watch` (challenge, named Blue named character from Act 1 roster)

**thornwood:**
- Between `forest_enter` and `spider_hollow`: new node `web_tunnel` (combat, `spider_nest`)
- Between `goblin_camp` and `seer_hut`: new node `goblin_archers` (combat, `goblin_patrol`)
- Off `goblin_camp` bottom exit: new node `warlord_camp` (challenge, Yellow named if act progression allows, else Blue), exits to `thornwood_boss`

**dust_roads:**
- Between `ash_gate` and `dust_patrol`: new node `road_ambush_2` (combat, `ash_patrol`)
- Between `obsidian_fort` and `veil_camp`: new node `cult_outpost` (combat, `veil_cult_camp`)
- Convert `salt_tunnels` challenge to named challenge; add new `ashen_field` combat node between `salt_wastes` and `salt_tunnels`

**ember_plateau:**
- Between `plateau_enter` and `lava_fields`: new node `lava_approach` (combat, `ash_patrol`)
- Between `veil_stronghold` and `rift_access`: new node `stronghold_break` (combat, `veil_cult_camp`)
- New bottom-rail challenge off `magma_vault` → `ember_hoard`: convert `magma_vault` to named challenge

**hell_breach:**
- Between `breach_gate` and `demon_patrol`: new node `hellgate_skirmish` (combat, `demon_patrol`)
- Between `inferno_keep` and `void_altar`: new node `keep_courtyard` (combat, `hell_garrison`)
- Between `demon_patrol` and `inferno_keep`: new node `brimstone_corridor` (combat, `hell_garrison`)
- Convert `ashen_hollow` to named challenge

**shattered_core:**
- Between `core_enter` and `rift_demons`: new node `rift_vanguard` (combat, `rift_assault`)
- Between `shard_fortress` and `the_wound`: new node `soul_furnace` (combat, `hell_garrison`)
- Convert `rift_cache` to named challenge

Acts 4–6 follow the same insert-before-landmark pattern; specific node IDs to be finalized in M386.

---

## 6. Dungeon Overhaul Spec

**Current shape (all 6 dungeons):** 6 stages — 3 combat, 1 lore, 1 shrine, 1 boss. Single chest reward (`medium_chest` or `heavy_chest`). No unique drop. Boss is a renamed existing enemy with no tier flag.

**Proposed shape:** 8–10 stages — 4–5 combat, 1–2 lore, 1 shrine, 1 mid-boss (Yellow tier named), 1 rare boss at the end (Yellow minimum, Gold in acts 4–6). A unique item drops from the rare boss. One dungeon per act; prologue has none (unchanged).

---

### Act 1 — Goblin Warrens (thornwood)
**Biome:** Forest / Border Roads  
**Lore:** A goblin clan has been carving deeper into ancient earthworks predating the Emberveil. Something older was already living there.  
**Floor count:** 8 stages

| Stage | Type | Name | Encounter / Text |
|-------|------|------|------------------|
| 1 | combat | Sentry Pen | `goblin_patrol` |
| 2 | lore | The Carved Wall | "Carvings cover the stone — too precise for goblins. Something else made this place." |
| 3 | combat | Spider Brood | `spider_nest` |
| 4 | combat | Goblin Warband | `goblin_camp` |
| 5 | shrine | Dripping Stalactite | Restore HP/MP |
| 6 | combat | Warlord's Honor Guard | `corrupted_outpost` |
| 7 | mid-boss | Ragefang, Warchief (Yellow) | `goblin_warlord` + Yellow tier mods; `aura_damage` + `extra_strong`; `imp_fireball` |
| 8 | rare-boss | The Warren Hetman | `goblin_warlord` base, named "The Warren Hetman", stat block ×1.6 HP / ×1.4 dmg vs base warlord; `shielded` + `regen`; spells: `acolyte_curse`, `imp_fireball` |

**Unique drop — Hetman's Warband Ring:**
- Slot: ring
- Base: ring (existing base from `ARMOR_BASES` / accessories)
- Legendary effect ID: `rally_on_kill` (existing in `legendaryEffects.js`)
- Flavor: "The chieftain's ring remembers every goblin who died under it. Now they fight for you."

**Reward:** gold 300, xp 240 (up from 220/180).

---

### Act 2 — Ash Catacombs (dust_roads)
**Biome:** Ashen Wastes  
**Lore:** A king who conquered the Ashen Wastes before the Emberveil fractured it. His tomb was sealed from the inside.  
**Floor count:** 9 stages

| Stage | Type | Name | Encounter / Text |
|-------|------|------|------------------|
| 1 | combat | Sealed Door | `ash_patrol` |
| 2 | lore | The Bone Reliefs | "The carvings show a king distributing fire to his people. All of them are burning." |
| 3 | combat | Vault Wardens | `obsidian_garrison` |
| 4 | combat | Cult Outpost | `veil_cult_camp` |
| 5 | shrine | Scrying Pool | Restore HP/MP |
| 6 | lore | The Smouldering Throne | "An empty throne radiates heat. The king never left. He just changed." |
| 7 | combat | The King's Retinue | `obsidian_garrison` (inflated ×1.3) |
| 8 | mid-boss | Emberknight Vareth (Yellow) | `veil_templar` base; `extra_strong` + `tough`; `titan_magma_wave` |
| 9 | rare-boss | The Smouldering King | `lava_titan` base ×1.5 HP / ×1.3 dmg; `regen` + `lifesteal`; spells: `titan_magma_wave`, `acolyte_curse` |

**Unique drop — Crown of Smouldering Rule:**
- Slot: helm (heavy)
- Base: heavy helm
- Legendary effect ID: `burn_extend` (existing)
- Flavor: "He burned his kingdom to keep it warm. You can burn someone else's."

**Reward:** gold 480, xp 380 (up from 360/280).

---

### Act 3 — Rift Oubliette (hell_breach)
**Biome:** Shattered Hell  
**Lore:** A prison built by demons for demons. Whatever they were afraid of enough to cage is now free — but the prison still hungers.  
**Floor count:** 9 stages

| Stage | Type | Name | Encounter / Text |
|-------|------|------|------------------|
| 1 | combat | Outer Cells | `demon_patrol` |
| 2 | lore | The Warped Bars | "The iron is melted from the inside. Whatever escaped was hotter than hellfire." |
| 3 | combat | Pit Gallery | `rift_assault` |
| 4 | combat | Hell Garrison Remnant | `hell_garrison` |
| 5 | shrine | Blood-Iron Sigil | Restore HP/MP |
| 6 | combat | The Throne Anteroom | `hell_garrison` (inflated ×1.3) |
| 7 | lore | The Warden's Log | "Last entry: 'It learned our names. We stopped writing them down.'" |
| 8 | mid-boss | Fleshwright Gorvak (Blue — acts as mid-boss) | `hell_knight` base; `thorns` + `regen`; `acolyte_curse` |
| 9 | rare-boss | The Pit Tyrant | `archfiend_malgrath` encounter base ×1.4 HP; `shielded` + `cursed_aura`; spells: `sovereign_voidstorm`, `lich_drain_life`, `acolyte_curse` |

**Unique drop — Chains of the Oubliette:**
- Slot: amulet
- Base: amulet
- Legendary effect: **NEW: `chains_slow`** — On hit, 20% chance to apply a 1-round Slow (enemy acts last in turn order for 1 round). Implemented as `applyStatus(target, 'slow', 1, 0)`.
- Flavor: "The chains remember what it meant to hold something that should not have existed."

**Reward:** gold 680, xp 540 (up from 540/420).

---

### Act 4 — The Star Well (cosmic_rift)
**Biome:** Cosmic Rift  
**Lore:** A gravity well so old it predates the Veil. Stars fall into it and do not come out. Something at the bottom has been collecting them.  
**Floor count:** 10 stages

| Stage | Type | Name | Encounter / Text |
|-------|------|------|------------------|
| 1 | combat | Wandering Wraiths | `void_horde` |
| 2 | lore | The Inward Light | "Light pulls inward here. Even your shadow points toward the well." |
| 3 | combat | Star Horror Pack | `cosmic_assault` |
| 4 | combat | Falling Stars | `void_horde` |
| 5 | shrine | Column of Starlight | Restore HP/MP |
| 6 | combat | Inner Ring Guard | `cosmic_assault` (inflated ×1.2) |
| 7 | lore | The Collection | "Billions of years of stars, collected and catalogued. You are the first visitor who was not also a star." |
| 8 | combat | Star Warden Vanguard | `void_horde` |
| 9 | mid-boss | Star-Eater Vull (Yellow) | `star_horror` base ×2.2 HP; `fast` + `aura_damage`; `wraith_chill` |
| 10 | rare-boss | The Star Well Warden | `cosmic_titan` base ×1.8 HP / ×1.5 dmg, Gold tier; `shielded` + `cursed_aura` + `lifesteal`; spells: `sovereign_voidstorm`, `lich_soul_shatter`, `wraith_chill` |

**Unique drop — Lens of the Collapsing Eye:**
- Slot: ring
- Base: ring
- Legendary effect: **NEW: `gravity_on_crit`** — Critical hits pull gravity around the target: apply Slow (1 round) + deal 10 bonus arcane damage to all enemies.
- Flavor: "Forged from a star that fell inward and never stopped falling."

**Reward:** gold 1000, xp 820 (up from 760/620).

---

### Act 5 — Abyssal Spiracle (abyssal_depths)
**Biome:** Primordial Abyss  
**Lore:** A breathing hole in the floor of reality. The abyss breathes out; something breathes back in.  
**Floor count:** 10 stages

| Stage | Type | Name | Encounter / Text |
|-------|------|------|------------------|
| 1 | combat | Drowned Approach | `primordial_patrol` |
| 2 | lore | The Wrongness | "The pressure here is wrong. It pushes back when you breathe out." |
| 3 | combat | Salt-Crusted Hall | `abyssal_garrison` |
| 4 | combat | Worm Brood | `genesis_nest` |
| 5 | shrine | Bioluminescent Coral | Restore HP/MP |
| 6 | combat | Abyssal Garrison Elite | `abyssal_garrison` (inflated ×1.3) |
| 7 | lore | The Breathing | "You can hear it now — a slow, geological breath. Whatever breathes here is bigger than the dungeon." |
| 8 | combat | Genesis Nest (Deep) | `genesis_nest` (inflated ×1.2) |
| 9 | mid-boss | Worm-Mother Sreth (Yellow) | `genesis_worm` inflated ×2.2 HP; `regen` + `tough`; `serpent_venom` |
| 10 | rare-boss | The Spiracle Warden | `abyssal_garrison` base ×2.0 HP / ×1.8 dmg, Gold tier; `lifesteal` + `shielded` + `aura_damage`; spells: `lich_soul_shatter`, `sovereign_voidstorm` |

**Unique drop — The Unmade Codex:**
- Slot: off-hand (wand / tome)
- Base: wand
- Legendary effect: `echo_cast` (existing)
- Flavor: "Written in a language that untranslates itself as you read. The power survives anyway."

**Reward:** gold 1200, xp 1020 (up from 980/820).

---

### Act 6 — Dragon Atrium (dragons_reach)
**Biome:** Dragon's Reach  
**Lore:** The trophy hall of an ancient dragon who collected the skulls of its own species. The skulls still remember dying.  
**Floor count:** 10 stages

| Stage | Type | Name | Encounter / Text |
|-------|------|------|------------------|
| 1 | combat | Wyrm Sentries | `dragon_patrol` |
| 2 | lore | Trophies of Trophies | "A dragon-skull the size of a wagon hangs above. Trophies of trophies." |
| 3 | combat | Atrium Guard | `wyrm_citadel` |
| 4 | combat | Storm Roost | `storm_dragon_nest` |
| 5 | shrine | Dragon-Scale Brazier | Restore HP/MP |
| 6 | combat | Deep Atrium | `wyrm_citadel` (inflated ×1.2) |
| 7 | lore | The Living Skull | "One skull opens an eye. It has been asleep for six thousand years. You woke it up." |
| 8 | combat | Frost Wyrm Guard | `frost_wyrm_pack` |
| 9 | mid-boss | Ashscale Patriarch (Yellow) | `wyrm_warrior` inflated ×2.2 HP; `extra_strong` + `regen`; `titan_magma_wave` |
| 10 | rare-boss | The Atrium Wyrm | `ancient_dragon` base ×1.5 HP / ×1.3 dmg, Gold tier; `lifesteal` + `aura_damage` + `shielded`; spells: `titan_magma_wave`, `sovereign_voidstorm`, `lich_soul_shatter` |

**Unique drop — Herald's Scale Mantle:**
- Slot: chest (heavy)
- Base: heavy chest
- Legendary effect: `dragon_fury_breath` (existing)
- Flavor: "The scales of the Atrium Wyrm remember the taste of burning things."

**Reward:** gold 1500, xp 1300 (up from 1200/1100).

---

## 7. New Legendary Effect IDs (Required for Dungeon Uniques)

Two new `legendaryEffects.js` entries are needed (flagged as new — not yet in the file):

**`chains_slow`** (Act 3 unique: Chains of the Oubliette)
- Hook: `onHit`
- Behavior: 20% chance to call `ctx.applyStatus(ctx.target, 'slow', 1, 0)` where `slow` means the target acts last this round (CombatScreen must support a 'slow' status or handle via initiative penalty).
- Dependency: `slow` status type may need to be added to CombatScreen's status tick. Alternatively implement as a `stun`-lite that only delays (not skips) the target turn.

**`gravity_on_crit`** (Act 4 unique: Lens of the Collapsing Eye)
- Hook: `onCrit`
- Behavior: Apply `slow` to target (1 round) AND deal 10 arcane damage to all enemies via `ctx.applyDmg`.
- Dependency: same `slow` status as above.

If `slow` is too complex to implement in M386, both uniques can fall back to `wraith_chill` (existing — applies Chill status, reduces initiative) as a placeholder. Note this in M386 task as a known substitution.

---

## 8. XP Curve Recalibration Note

With roughly 41 new combat nodes across acts 1–6, total combat exposure per run increases by approximately 40–55%. The XP values on individual encounters are **not proposed for change here** — the balance impact will be assessed empirically in M386. However, the implementation milestone should add a per-act XP soft cap (similar to the existing M342 per-encounter cap) that prevents a player clearing every new optional combat from reaching the final boss 2–3 levels above intended. Suggested cap: party average level may not exceed `actTargetLevel + 2` regardless of total XP earned from optional content. This is a balance parameter, not a hard gate.

---

## 9. Risk and Dependency Notes

**mapData.js shape changes:**
- New combat/challenge nodes require new `exits` wiring on adjacent nodes. This is the highest-risk change in the entire plan — a single broken exit chain silently orphans a path. The implementation milestone must run a graph-connectivity audit (walk all exits, verify no dangling node IDs) before release.
- Challenge-node behavior change is backwards-compatible if `namedPool` is optional: nodes without it fall through to the existing `encounter` field.
- `BIG_FIGHT_NODE_OVERRIDES` may need new entries for the new node IDs where big-fight upgrades make sense (acts 4–6 in particular).

**New named-character system:**
- Requires a new `NAMED_CHARACTERS` data structure (separate from `ENCOUNTERS`) and a resolution function `resolveNamedCharacter(namedId, act)` called from the challenge-node combat resolver.
- The HUD name color for Yellow / Gold tiers needs CSS class additions (`champion-yellow`, `champion-gold`) parallel to the existing `champion-blue` styling.

**Dungeon overhaul:**
- `DungeonScreen.js` already supports any number of stages; adding stages 7–10 is data-only for existing stage types. The `mid-boss` stage type is new — it renders identically to `boss` but does not end the dungeon; instead it advances `_stageIdx` and the rare boss is the terminal stage.
- The unique drop on dungeon completion is a new field on the `DUNGEONS` reward object: `uniqueDrop: { effectId, slot, base }`. `DungeonScreen._showVictory()` needs to call `generateUniqueFromDungeonDef()` if this field is present.

**Per-zone rollback strategy:**
- Each act's new nodes should be added as a discrete batch per zone. If playtest feedback on a specific act is bad (too many fights, pacing off), individual zones can revert to their previous node list independently. The git commit strategy for M386 should batch per zone, not across all 12 zones in a single commit.

---

## Open Questions for Implementation (M386+)

1. **`slow` status implementation** — Does CombatScreen already handle a 'slow' status, or does M386 need to add a round-order penalty? If adding, decide: delay by 1 in turn order, or cut initiative in half for 1 round?

2. **Named-character data structure** — Should `NAMED_CHARACTERS` live in `mapData.js`, `championModifiers.js`, or a new `namedCharacters.js` file? Given the size of mapData.js (already 91k tokens), a separate file is strongly preferred.

3. **Challenge-node resolution order** — When a challenge node has both a `namedPool` and an `encounter` field, which wins? Proposed: `namedPool` always wins; `encounter` is fallback. Confirm this is the intended override semantics.

4. **Mid-boss stage type in DungeonScreen** — The `mid-boss` label should show differently from the terminal `boss` stage (e.g., "Elite Encounter" not "Final Boss"). Confirm the exact HUD label and pip color.

5. **Unique drop generation for dungeon uniques** — Should `generateUniqueFromDungeonDef()` use the standard `generateItem()` path with a forced legendary effect overlay, or a dedicated unique-item definition block (like `ITEM_SETS` but for uniques)?

6. **XP soft cap per act** — Confirm the formula: `actTargetLevel + 2` as the cap, or is `+3` more permissive? Needs a pass through the current XP curve numbers in `gameState.js` / `balance-loader.js` before committing.

7. **Yellow / Gold name-color styling** — Should named characters in the encounter intro use the tier color only on the name, or also color the entire intro text block border? Consistency check against how blue champions are displayed in the combat HUD.

8. **Challenge-node Gold character in Acts 1–2** — The tier curve puts 0% Gold in Act 1 and 0% in Act 2. Confirm this is correct (Gold should first appear in Act 3 at 5%).

9. **Dungeon "minor unique" pool for challenge-node Yellow/Gold drops** — §4 mentions a per-act minor unique pool separate from dungeon uniques. This pool needs to be designed in M386 (6 acts × 2–3 items each = ~12–18 minor uniques minimum). Defer to M386 scoping unless the user wants to expand the design doc to cover it now.

10. **Encounter→background variant wiring** — The background index (`backgrounds/index.md`) notes this mapping is not yet wired. M386 should confirm whether the new dungeon combat stages use act-biome backgrounds (likely v3 "most dramatic" variant per the spec) or need dedicated dungeon backgrounds.
