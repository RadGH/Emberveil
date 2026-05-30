
# Emberveil — Game Design Document

---

## Overview

| Field | Value |
|---|---|
| Title | Emberveil |
| Genre | High Fantasy Party RPG |
| Platform | Browser (Desktop + Mobile) |
| Engine | Vite + Vanilla JavaScript |
| Rendering | HTML5 Canvas (game world) + HTML/CSS (UI) |
| Target Device | iPhone 14 Pro (393×852), responsive portrait-first |
| Input | Keyboard, Mouse, Touch, Gamepad |
| Art | PixelLab (characters/sprites), OpenAI API (backgrounds) |
| Audio | Web Audio API (music + SFX) |
| Save System | localStorage (multiple slots) |
| Max Party Size | 8 (4 heroes + 4 companions/pets) |
| Max Level | 20 |
| Acts | 4 + New Game+ |
| Difficulty | Normal → Hard → Nightmare (New Game+) |

---

## Story Overview

A spreading darkness called the Emberveil Corruption tears the membrane between worlds, bleeding chaos into reality. Ancient seals crack, monsters pour from the gaps, and entire kingdoms crumble. A lone wanderer steps forward — not yet a hero — to trace the corruption to its source across four increasingly alien and terrifying realms.

### Act 1 — The Goblin Frontier

**Theme:** Medieval frontier kingdoms. Rolling fields, dark forests, ruined watchtowers, besieged villages.

The corruption first manifests as unusually organized goblin warbands raiding the border kingdoms. Something is driving them — coordinating them — with intelligence they should not possess. The hero investigates a string of village raids, discovers the goblins are being commanded by a Warlord touched by Emberveil energy, and must rally allies to stop the advance before it reaches the capital.

**Boss:** Grax the Veil-Touched — a goblin warlord mutated by corruption energy, commanding a horde of frenzied goblins and corrupted beasts.

**Story beats:** First companions found. First artifact of the Veil discovered. The Seer NPC reveals the corruption comes from beyond this world.

### Act 2 — The Ashen Wastes

**Theme:** Volcanic badlands, ash storms, ancient dwarven ruins buried under lava flows, fire cults.

The trail of corruption leads into the Ashen Wastes where volcanic activity has intensified unnaturally. A fire cult called the Cinderborn worships the corruption as a god. Dwarven ruins hold clues to a portal that was opened centuries ago — the same portal the darkness first used to enter this world. The hero must destroy the Cinderborn's ritual and seal the old wound.

**Boss:** Embermaw the Undying — an ancient fire elemental fused with Veil energy, reborn endlessly in the magma until the ritual seal is broken.

**Story beats:** The portal's origin is revealed. A demon hunter companion joins, warning that the Hell side of the portal is already mobilizing.

### Act 3 — The Shattered Hell

**Theme:** Infernal landscape, demon lords, corrupted souls, rivers of brimstone, obsidian citadels.

Crossing through the ancient portal, the party enters a Hell already fractured by the Emberveil Corruption — demon lords war against each other and against the encroaching void. The corruption is not from Hell; it passes through Hell on its way from somewhere deeper. The party must forge unlikely alliances with lesser demon lords, navigate treacherous political betrayals, and ultimately reach the Void Gate at the heart of the Shattered Hell.

**Boss:** Malachar the Splinter Lord — a demon lord who has partially merged with Void energy, becoming something neither demon nor void creature.

**Story beats:** The true source is revealed to exist beyond all known planes. A dragon whelpling companion is found in a demon lord's menagerie. The party learns the corruption is being willed by a cosmic entity.

### Act 4 — The Cosmic Void

**Theme:** Absolute darkness, crystalline void-space, shattered planets, impossible geometries, the death of reality.

Beyond the Void Gate lies the space between worlds — a cosmic graveyard where the entity known as the Unraveler has been dismantling existence plane by plane. The party must traverse the void, gather the remnants of shattered world-seals, and confront the Unraveler before the last veil tears completely.

**Boss:** The Unraveler — a multi-phase cosmic horror that reshapes the battlefield each phase, summons void-echoes of previously defeated bosses, and must be defeated at its core while managing constant environmental hazards.

**Story beats:** Resolution differs based on dialog choices made throughout all four acts. Multiple endings: seal the void (heroic), merge with the void (dark), scatter the corruption (ambiguous). New Game+ unlocks after any ending.

---

## Core Loop

```
Zone Entry
   └─> Map Node Selection (linear map, 3–8 nodes, branching paths)
         └─> Node Event
               ├─> Dialog Encounter (NPC, skill check: stealth/persuasion/lore)
               ├─> Combat Encounter (turn-based, auto-play AI)
               ├─> Town Visit (merchant, blacksmith, enchanter, tavern, cleric)
               └─> Boss Node (scripted fight + cutscene dialog)
   └─> Act Boss Defeated
         └─> Story Cutscene → Next Zone / Next Act
               └─> [After Act 4] New Game+ (difficulty escalates)
```

- Players select the next node on the map; branching paths reconverge at the act boss.
- Fast travel is available to any previously visited node.
- Town nodes can be revisited freely.
- Encounters have memory — defeated enemies do not respawn, but random events can refresh.

---

## Classes

Each class has 4 skills, unlocking at levels 1, 5, 10, and 15. Each skill has 2–3 upgrade talents selectable as the character levels further. Maximum 4 active abilities per character at any time.

---

### Warrior

**Theme:** Frontline melee tank. High armor, crowd control, protection of allies.

| Level | Skill | Description |
|---|---|---|
| 1 | Shield Bash | Strike with shield, dealing STR-based damage and applying Stun (1 round) to 1 target. Talent upgrades: wider hit arc (1–2 adjacent), extended stun duration. |
| 5 | Battle Cry | Rally the party, granting +20% damage to all heroes for 3 rounds. Talent upgrades: also grants temporary HP, also reduces enemy damage. |
| 10 | Whirlwind | Spin attack hitting all adjacent enemies (up to 3). Talent upgrades: adds Bleed, hits an additional row. |
| 15 | Unbreakable | Enter a defensive stance for 2 rounds: take 50% reduced damage and reflect 10% back. Talent upgrades: reflect increases to 25%, duration extends to 3 rounds. |

---

### Paladin

**Theme:** Holy warrior blending healing and melee. The backbone of sustained fights.

| Level | Skill | Description |
|---|---|---|
| 1 | Holy Strike | A blessed melee blow dealing STR + INT damage. Undead and demons take double damage. Talent upgrades: adds Burn to undead, small AoE splash. |
| 5 | Lay on Hands | Instantly restore HP to one ally equal to 2× INT. Talent upgrades: remove one status effect, can target self as free action. |
| 10 | Divine Shield | Surround one ally with a holy barrier absorbing damage equal to 3× CON for 2 rounds. Talent upgrades: reflect absorbed damage, extend to 2 targets. |
| 15 | Consecration | Sanctify the ground, dealing sustained holy damage to all enemies for 3 rounds and healing the party each round. Talent upgrades: slow enemies, increase heal amount. |

---

### Ranger

**Theme:** Ranged precision striker. High DEX, single-target damage, trap utility.

| Level | Skill | Description |
|---|---|---|
| 1 | Aimed Shot | A focused ranged attack dealing 150% DEX damage to one target. Talent upgrades: ignores armor, chance to Bleed. |
| 5 | Multi-Shot | Fire arrows at up to 3 separate targets simultaneously, each at 80% DEX damage. Talent upgrades: fourth target, applies Bleed to all. |
| 10 | Smoke Trap | Plant a trap that triggers on enemy approach, Blinding (miss chance +50%) all enemies in a group for 2 rounds. Talent upgrades: also Slows, 2 traps placed. |
| 15 | Rain of Arrows | Volley of arrows descending on all enemies over 3 rounds. Each round deals DEX-based damage to every enemy. Talent upgrades: adds Bleed stacking, increases rounds to 4. |

---

### Rogue

**Theme:** Burst assassin and debuffer. Thrives on Bleed, positioning, and surprise attacks.

| Level | Skill | Description |
|---|---|---|
| 1 | Backstab | Attack from shadow dealing 200% DEX damage. Bonus damage if target is Stunned or Bleeding. Talent upgrades: guaranteed crit on Stunned targets, applies Bleed. |
| 5 | Poison Blade | Coat weapon in toxin; next 3 attacks apply Poison (DEX-based DoT over 5 rounds). Talent upgrades: stronger poison, applies to all party members' next attack. |
| 10 | Shadow Step | Teleport behind target enemy, immediately attacking for 150% DEX and reducing their hit chance by 30% for 2 rounds. Talent upgrades: leaves decoy, affects adjacent enemies too. |
| 15 | Death Mark | Mark a target; they take 50% increased damage from all sources for 3 rounds. Talent upgrades: spreads on death, also causes Fear (skip turn). |

---

### Cleric

**Theme:** Primary healer and undead bane. INT-based restoration and holy offense.

| Level | Skill | Description |
|---|---|---|
| 1 | Heal | Restore HP to one ally equal to 2.5× INT. Talent upgrades: group heal (50% value), removes Bleed/Poison. |
| 5 | Smite | Channel divine energy in a bolt dealing INT-based holy damage. Double damage vs undead/demons. Talent upgrades: adds Stun chance, chain to nearby enemy. |
| 10 | Sanctuary | Create a blessed zone around one ally; they regenerate HP each round for 3 rounds and cannot be targeted by enemies while the zone holds. Talent upgrades: extend to 2 allies, add damage shield. |
| 15 | Mass Resurrection | In the moment after a party wipe, the Cleric has a 40% chance to auto-cast this, reviving all fallen allies with 30% HP. Talent upgrades: increase revival HP %, trigger chance to 60%. |

---

### Bard

**Theme:** Support maestro. Buffs, debuffs, and morale mechanics.

| Level | Skill | Description |
|---|---|---|
| 1 | Inspiring Tune | Play an uplifting melody granting all party members +15% to hit and +1 turn order priority for 3 rounds. Talent upgrades: also increases damage, lasts 4 rounds. |
| 5 | Discordant Wail | A dissonant blast confusing one enemy group, reducing their damage by 30% and causing erratic targeting for 2 rounds. Talent upgrades: Stun chance, affects all enemies. |
| 10 | Ballad of Valor | Sing a tale of legendary battle, granting one hero double actions (takes two turns in a single round) for 1 round. Talent upgrades: extend to 2 rounds, can target companion. |
| 15 | Song of Ruin | A devastating performance that deals INT-based sonic damage to all enemies and removes all active enemy buffs. Talent upgrades: applies Stun, heals party equal to damage dealt. |

---

### Mage

**Theme:** Highest burst AoE damage. Glass cannon requiring positioning and mana management.

| Level | Skill | Description |
|---|---|---|
| 1 | Magic Missile | Launch 3 arcane bolts, each hitting a random enemy for INT damage. Talent upgrades: 5 bolts, chance to Stun target. |
| 5 | Fireball | Explosive projectile hitting one enemy group for heavy INT-based fire damage with Burn DoT. Talent upgrades: larger blast radius (two adjacent groups), Burn damage increases. |
| 10 | Blizzard | Summon an ice storm blanketing all enemies for 3 rounds, dealing cold damage each round and applying Slow. Talent upgrades: chance to Freeze (Stun), damage increases per round. |
| 15 | Arcane Surge | Channel raw magic into one catastrophic bolt dealing 400% INT damage to a single target, with overflow damage hitting adjacent enemies. Talent upgrades: reduce cooldown, ignore magic resistance. |

---

### Necromancer

**Theme:** Army builder. Raises fallen enemies as skeletal servants, drains life.

| Level | Skill | Description |
|---|---|---|
| 1 | Bone Spike | Fire a bone projectile dealing INT damage and applying Bleed. Talent upgrades: pierces through enemy row, extra spike on crit. |
| 5 | Raise Dead | Reanimate one fallen enemy corpse as a skeleton ally (counts as a companion slot if one is free). Talent upgrades: raised skeleton has bonus HP, can raise two corpses. |
| 10 | Life Drain | Siphon life from one target, dealing INT damage and healing the Necromancer for 50% of damage dealt. Talent upgrades: chain to second target, also drains a status buff. |
| 15 | Death Coil | Unleash a wave of necrotic energy hitting all enemies for INT damage and applying both Poison and Bleed. Talent upgrades: also lowers enemy CON saves, heal party on kills. |

---

### Warlock

**Theme:** Chaos dealer. Curses, corruption, demonic pacts for power at a cost.

| Level | Skill | Description |
|---|---|---|
| 1 | Corruption | Infect a target with Void energy; they take INT-based damage per round for 4 rounds and spread Corruption on death. Talent upgrades: faster spread, double damage if target dies under Corruption. |
| 5 | Hellfire | Call down hellfire on an enemy group dealing INT fire/void hybrid damage and applying Burn. Bypasses fire resistance. Talent upgrades: also applies Poison, hits two groups. |
| 10 | Soul Pact | Sacrifice 20% of the Warlock's own HP to empower all active Corruption/Curse effects, doubling their remaining duration and damage. Talent upgrades: reduce HP cost, also applies to ally DoTs. |
| 15 | Void Rift | Tear open a void rift beneath enemies for 3 rounds; each round all enemies take INT void damage and have a 20% chance to be Stunned. Talent upgrades: rift lasts 4 rounds, stun chance increases. |

---

### Demon Hunter

**Theme:** Specialist killer. High single-target damage vs demons and corrupted enemies.

| Level | Skill | Description |
|---|---|---|
| 1 | Demon Bolt | Fire a blessed bolt dealing DEX + INT damage, with bonus 50% damage vs demons and corrupted creatures. Talent upgrades: pierces one target, applies Bleed. |
| 5 | Glaive Toss | Throw a spinning glaive hitting all enemies in a row for DEX damage and applying Bleed to each. Talent upgrades: return throw (second pass), increased Bleed stacks. |
| 10 | Fel Sight | Activate spectral vision; immune to Blind/Confuse for 3 rounds, and hit/dodge increased by 25%. Talent upgrades: also reveals hidden enemies, party gains partial benefit. |
| 15 | Vengeance | For each dead party member or companion in this combat, gain a stacking 15% damage bonus. Activate to unleash all stacks in one devastating strike. Talent upgrades: stacks also boost defense, minimum 1 stack even with no deaths. |

---

### Scavenger

**Theme:** Resource specialist. Looting mechanics, improvised weapons, survival utility.

| Level | Skill | Description |
|---|---|---|
| 1 | Scrounge | Search the battlefield mid-combat; 60% chance to find a consumable item (bandage, potion shard, throwable). Talent upgrades: 80% chance, can find rare components. |
| 5 | Thrown Junk | Hurl debris at an enemy group for DEX damage, with a 30% chance to Stun the target. Talent upgrades: higher stun chance, hits two groups. |
| 10 | Makeshift Bomb | Craft and throw an improvised explosive dealing DEX + CON hybrid damage to a group with Burn. Talent upgrades: larger blast, can be prepared outside combat. |
| 15 | Jackpot | After each kill in combat, 20% chance to immediately loot a Magic or higher rarity item from that enemy. Talent upgrades: 30% chance, can trigger on non-kill hits. |

---

### Swashbuckler

**Theme:** Flashy duelist. High DEX, parry counters, charisma-driven debuffs.

| Level | Skill | Description |
|---|---|---|
| 1 | Riposte | Enter a parry stance; if the next enemy attack is a melee hit, automatically counter for 200% DEX damage. Talent upgrades: counter has Bleed, parry can trigger on ranged. |
| 5 | Flourish | A rapid series of three light strikes each dealing DEX damage; builds Flair stacks used to power Grandeur. Talent upgrades: four strikes, each hit applies -5% armor. |
| 10 | Taunt | Challenge one enemy, forcing them to target only the Swashbuckler for 2 rounds; Swashbuckler gains +30% dodge vs that target. Talent upgrades: affects entire enemy group, dodge bonus increases. |
| 15 | Grandeur | Consume all Flair stacks to deal DEX × stacks damage to one target in a legendary strike. Each stack also applies a random debuff (Stun, Bleed, Blind, Slow). Talent upgrades: minimum 3 stacks consumed, one debuff guaranteed to be Stun. |

---

### Dragon Knight

**Theme:** Draconic warrior. Breath weapons, scales for defense, bond with dragon companion.

| Level | Skill | Description |
|---|---|---|
| 1 | Dragon Claw | A savage strike dealing STR + DEX melee damage that ignores 20% of target armor. Talent upgrades: hits two adjacent enemies, applies Bleed. |
| 5 | Breath Weapon | Unleash a cone of fire/ice/lightning (chosen at class selection) hitting all enemies in a group for STR + INT damage with element-specific status (Burn/Freeze/Stun). Talent upgrades: wider cone (two groups), secondary status effect. |
| 10 | Dragon Scales | Channel draconic heritage; gain heavy damage reduction (30%) and immunity to the chosen element for 3 rounds. Talent upgrades: also boost ally resistance, retaliate on melee hits. |
| 15 | Draconic Fury | Unleash full draconic power for 2 rounds: all attacks become AoE hitting one group, damage increases by 50%, and the Dragon Knight cannot be Stunned or Poisoned. Talent upgrades: extend to 3 rounds, also buffs bonded dragon companion. |

---

### Pyromancer

**Theme:** Fire specialist. DoT stacking, mana burn, environmental fire hazard creation.

| Level | Skill | Description |
|---|---|---|
| 1 | Flame Lance | Hurl a bolt of fire dealing INT damage and applying Burn (3 rounds, INT-scaled DoT). Talent upgrades: Burn lasts 5 rounds, has chance to spread Burn to adjacent enemy. |
| 5 | Ignite | Set the ground ablaze under one enemy group; the fire persists for 3 rounds, dealing INT damage and stacking Burn each round. Talent upgrades: fire spreads to adjacent group, increased stack rate. |
| 10 | Pyroclasm | Create a chain fire explosion; the first target hit causes a secondary explosion on the nearest enemy, creating up to 3 chain blasts total. Each deals INT fire damage plus Burn. Talent upgrades: chain length to 4, each chain explosion is larger than previous. |
| 15 | Meteor | Call down a devastating meteor strike on all enemies. Deals massive INT fire damage, applies maximum Burn stacks, and creates Ignite zones under all enemy groups simultaneously. Talent upgrades: meteor splits into two on impact, enemy fire resistance reduced by 50% for 3 rounds after hit. |

---

## Attribute System

| Attribute | Primary Effects | Secondary Effects |
|---|---|---|
| STR (Strength) | Melee attack damage scaling | Physical armor value, carry capacity (equipment weight) |
| DEX (Dexterity) | Hit chance, dodge chance, ranged/finesse attack damage | Initiative bonus (turn order), trap detection |
| INT (Intelligence) | Spell power scaling, mana pool size | Magic resistance, lore skill checks |
| CON (Constitution) | Maximum HP | Endurance (resist Stun/Poison duration), Bleed resistance |

**Base values at character creation:** 8 in each attribute. Character builder allows distributing 10 bonus points freely among the four attributes.

**Level-up bonus:** Each level grants 2 attribute points to distribute freely.

**Attribute scaling formulas (approximate):**
- Melee Damage: Base weapon damage + (STR × 1.5)
- Spell Damage: Base spell value × (1 + INT × 0.08)
- HP: 50 + (CON × 10)
- Mana: 30 + (INT × 8)
- Hit Chance: 70% base + (DEX × 1.2%)
- Dodge Chance: 5% base + (DEX × 0.8%)

---

## Combat System

### Turn Order

Each round, all combatants (heroes, companions, enemies) roll for turn order: DEX + 1d10. Ties broken by unit type (heroes before companions before enemies). Turn order resets each round.

### Combat Flow

1. Round starts — turn order rolled for all units.
2. Each unit acts in order: AI auto-selects optimal action (attack, skill, retreat, use item).
3. Player can toggle auto-play off for manual control of hero actions.
4. Turn resolves at 0.5 seconds per action (animations queue).
5. After all units act, next round begins.
6. Combat ends when all enemies or all party members are dead/fled.

### Hit Resolution

- Hit Roll: Attacker hit chance vs Defender dodge chance. 1d100 compared against (attacker hit% − defender dodge%). 
- Critical Hit: If roll exceeds threshold by 20+, critical hit for 150% damage.
- Miss: Result displayed; no damage.
- Resist (magic): Defender's CON save vs spell's INT power. 1d100 vs resistance value.

### Enemy Scale

- Maximum 12 enemies simultaneously in combat.
- Enemies organized into visual packs/groups (2–4 per group typically).
- Individual tracking: each enemy has its own HP, status effects, resistances.
- Groups matter for AoE targeting.

### AoE Mechanics

| AoE Type | Targets Hit |
|---|---|
| Melee AoE (Whirlwind, etc.) | 1–3 adjacent enemies in immediate front row |
| Cone (Breath Weapon, etc.) | All enemies in one selected group |
| Fireball / Group Blast | All enemies in one selected group |
| Blizzard / Zone AoE | All enemies on the field |
| Row Pierce (Glaive Toss) | All enemies in a single row |

### Status Effects

| Status | Effect | Duration | Resist Stat |
|---|---|---|---|
| Poison | INT/DEX-based damage per round | 3–5 rounds | CON |
| Burn | Fire damage per round, stacks | 2–4 rounds | CON |
| Bleed | Physical damage per round, stacks | 3–5 rounds | CON |
| Stun | Skip next turn | 1 round | CON |
| Slow | Turn order penalty (−5 initiative) | 2–3 rounds | DEX |
| Blind | Hit chance −50% | 2 rounds | DEX |
| Fear | 50% chance to skip turn, cannot use skills | 2 rounds | CON |
| Freeze | Cannot act, takes bonus damage | 1 round | CON |

### Boss Mechanics

- **Phase transitions:** Bosses transition phases at HP thresholds (typically 66% and 33% HP). Phase changes trigger dialog, visual transformation, and new ability unlocks.
- **Reinforcement summons:** On phase change or after a round timer, boss may summon additional enemy groups.
- **Unique mechanics per boss:** Grax has a Rage phase that doubles attack speed; Embermaw is immune to fire damage; Malachar splits into copies; the Unraveler reshapes the battlefield layout each phase.
- **Boss resistances:** Bosses have explicit resistance profiles and immunities listed per encounter.

### Character Stances (Visual States — 5 PixelLab images each)

1. Ready Stance — idle/waiting
2. Attack Stance — melee or ranged attack animation
3. Spell Stance — casting/channeling
4. Dialog Stance — conversational portrait pose
5. Death Stance — fallen/death animation

---

## Equipment System

### Weapon Types

| Weapon | Damage Type | Stat Scaling | Notes |
|---|---|---|---|
| Dagger | Piercing | DEX | Can dual-wield (off-hand) |
| Sword | Slashing | STR/DEX hybrid | Versatile |
| Wand | Arcane | INT | Off-hand eligible |
| Scepter | Holy/Arcane | INT | Off-hand eligible |
| Staff | Elemental | INT × 1.5 | Two-hand, high INT scaling |
| Hammer | Bludgeoning | STR | High stun chance |
| 2H Sword | Slashing | STR × 1.5 | Two-hand, no off-hand |
| 2H Axe | Slashing/Bludgeoning | STR × 1.5 + Bleed | Two-hand, no off-hand |
| Bow | Piercing | DEX × 1.3 | Ranged, two-hand |
| Crossbow | Piercing | DEX + STR hybrid | Ranged, slower but harder hit |
| Javelin | Piercing | STR + DEX hybrid | Ranged/melee hybrid, throwable |

### Armor Tiers

| Tier | Classes | Armor Value | Dodge Penalty |
|---|---|---|---|
| Cloth | Mage, Necromancer, Warlock, Bard | Low | None |
| Light | Rogue, Ranger, Scavenger, Demon Hunter | Medium-Low | Minimal |
| Medium | Swashbuckler, Paladin, Cleric, Dragon Knight | Medium | Moderate |
| Heavy | Warrior, Dragon Knight | High | Significant |

### Equipment Slots

- Weapon (main hand)
- Off-hand (shield, secondary weapon, or off-hand casting implement)
- Head
- Chest
- Legs
- Hands
- Feet
- Ring × 2
- Necklace

**Total: 10 slots per character**

### Rarity System

| Rarity | Color | Affix Count | Notes |
|---|---|---|---|
| Normal | White | 0 | Base stats only |
| Magic | Blue | 1–2 | One prefix + one suffix |
| Rare | Yellow | 3–4 | Multiple prefixes/suffixes |
| Legendary | Orange | 4–6 + unique affix | Unique named items, special effects |

### Quality System

| Quality | Stat Multiplier | Notes |
|---|---|---|
| Low | 0.7× | Degraded, common drops early |
| Medium | 1.0× | Standard baseline |
| High | 1.2× | Better drop zones, upgradeable |
| Elite | 1.4× | Rare drops, boss loot |
| Exotic | 1.6× | Near-unique, very rare |

### Item Generation

Items are procedurally generated from base type + rarity + quality + affix pool drawn from the zone's affix table. Higher acts unlock higher-tier affixes. Legendary items are hand-authored with fixed stats and unique flavor text.

---

## Map and Zone Structure

### Zone Anatomy

Each zone consists of a **zone map** containing multiple **maps** (individual areas/levels). Each map has 3–8 event nodes on a visual layout with branching paths that reconverge at the exit or boss node.

### Node Types

| Node Type | Description |
|---|---|
| Combat | Enemy encounter (scales to act/zone) |
| Dialog | NPC conversation, skill check, story event |
| Town | Full town services available |
| Treasure | Item reward, no combat |
| Ambush | Surprise combat with enemy initiative bonus |
| Boss | Act or zone boss fight |
| Lore | Environmental storytelling, no interaction required |

### Act Structure

**Act 1 — The Goblin Frontier**
- Zone 1: The Border Roads (tutorial combat, first NPC hires)
- Zone 2: Thornwood Forest (forest encounters, hidden rogue companion)
- Zone 3: Ruined Keep (dungeon, first challenging combat gauntlet)
- Zone 4: Goblin Warcamp (Boss zone — Grax the Veil-Touched)

**Act 2 — The Ashen Wastes**
- Zone 1: The Scorched Plains (volcanic terrain, fire enemies)
- Zone 2: Cinderborn Sanctum (cult encounters, religious dialog skill checks)
- Zone 3: Dwarven Deep Ruins (puzzle-adjacent encounter nodes, lore heavy)
- Zone 4: Lava Forge Throne (Boss zone — Embermaw the Undying)

**Act 3 — The Shattered Hell**
- Zone 1: The Breach (portal transition, demon ambushes)
- Zone 2: Brimstone Flats (large-scale demon combat, demon lord side quests)
- Zone 3: Obsidian Citadel (political intrigue dialog, stealth skill checks)
- Zone 4: The Void Gate Antechamber (Boss zone — Malachar the Splinter Lord)

**Act 4 — The Cosmic Void**
- Zone 1: Edge of Existence (void traversal, reality-bending encounters)
- Zone 2: The Shattered Worlds (remnants of destroyed planes, fallen hero echoes)
- Zone 3: The Unraveler's Domain (multi-stage approach with major encounters)
- Zone 4: The Core (Boss zone — The Unraveler, multi-phase final battle)

### Fast Travel

Once a node is visited, it appears permanently on the zone map and can be fast-traveled to at any time. Fast travel is blocked during an active encounter.

---

## Economy

**Currency:** Gold only. No secondary currencies.

### Gold Sources

- Combat drops (enemy kill loot)
- Dialog/side quest rewards
- Selling items to merchant
- Treasure node rewards
- Boss completion bonuses

### Gold Sinks

- Hiring heroes at tavern
- Reviving fallen party members (Cleric)
- Blacksmith upgrades
- Enchanting
- Purchasing equipment from merchant

---

## Town Services

Every town node provides access to the following services, available via a tabbed UI panel:

### Merchant

- Sells equipment scaled to current act (Normal and Magic rarity, occasional Rare).
- Buy and sell items.
- Stock refreshes between acts.
- Sell value: 30% of item base value.

### Blacksmith

- **Rarity Upgrade:** Pay gold to upgrade item rarity one tier (Normal → Magic → Rare). Cannot upgrade to Legendary.
- **Quality Upgrade:** Pay gold to improve quality one tier (Low → Medium → High → Elite → Exotic).
- Cost scales with item level and current quality/rarity tier.
- All transactions are gold-only; no materials required.

### Enchanter

- **Add Affix:** Pay gold to add one random affix from the current act's affix pool to a Magic or Rare item (if it has open affix slots).
- **Reroll Affix:** Pay gold to reroll one existing affix on an item.
- **Identify:** Items dropped at Magic+ quality arrive unidentified. Pay gold to reveal stats, or identify via party Lore skill.
- All transactions gold-only.

### Tavern

- Hire additional heroes from a roster of available classes (2–4 available, refreshes each act).
- Hire cost scales with act and class rarity.
- Hired heroes start at a level slightly below the party's current average.
- Some legendary companions are unlocked via side quests, not the tavern.

### Cleric (Temple)

- **Revive:** Bring dead party members back to life. Gold cost scales with character level. Revived at 50% HP.
- **Heal All:** Restore the full party to maximum HP for a moderate gold cost (useful pre-boss).
- **Cure All:** Remove all status effects from the party.

---

## Character Builder

Available at new game start and when hiring new heroes from the tavern.

**Steps:**
1. **Name Entry** — Text input, max 20 characters.
2. **Portrait Selection** — Choose from PixelLab-generated portraits filtered by class theme. 6–8 options per class.
3. **Class Selection** — Select one of 14 classes. Class description and starting skill shown.
4. **Attribute Distribution** — Start with 8 in each attribute. Distribute 10 bonus points freely. Preview HP, mana, and damage estimates in real time.
5. **Confirmation** — Review card shown; confirm or go back.

---

## Save System

- **Storage:** Browser localStorage.
- **Save Slots:** 3 save slots, independently named and managed.
- **Auto-save:** Triggers on node completion, town visit, and act transition.
- **Manual Save:** Available from the pause menu at any time outside of active combat.
- **Save Data Includes:** Full party state (attributes, equipment, skills, levels), map progress (visited nodes, completed encounters), inventory, gold, story flags, dialog choice history (for ending calculation), and current act/zone/map position.
- **New Game+:** Stored as a modifier on the save slot. NG+ carries over character levels and equipment but resets map progress and scales enemy stats.

---

## Technical Architecture

### Folder Structure

```
emberveil/
├── index.html
├── vite.config.js
├── package.json
├── public/
│   ├── assets/
│   │   ├── portraits/          # PixelLab character art
│   │   ├── backgrounds/        # OpenAI-generated zone art
│   │   ├── ui/                 # UI sprites, icons, frames
│   │   └── audio/              # SFX and music files
├── src/
│   ├── main.js                 # Entry point, app init
│   ├── engine/
│   │   ├── canvas.js           # Canvas setup, render loop
│   │   ├── input.js            # Keyboard/mouse/touch/gamepad
│   │   ├── audio.js            # Web Audio API wrapper
│   │   └── save.js             # localStorage read/write
│   ├── game/
│   │   ├── state.js            # Global game state object
│   │   ├── party.js            # Party management, formation
│   │   ├── character.js        # Character data model, leveling
│   │   ├── combat.js           # Turn engine, hit resolution, AI
│   │   ├── skills.js           # Skill definitions, activation
│   │   ├── items.js            # Item generation, affixes
│   │   ├── economy.js          # Gold tracking, transactions
│   │   └── encounter.js        # Encounter wrapper, skill checks
│   ├── maps/
│   │   ├── mapEngine.js        # Node graph, travel logic
│   │   ├── act1/               # Act 1 zone/map definitions
│   │   ├── act2/               # Act 2 zone/map definitions
│   │   ├── act3/               # Act 3 zone/map definitions
│   │   └── act4/               # Act 4 zone/map definitions
│   ├── ui/
│   │   ├── screens/
│   │   │   ├── titleScreen.js
│   │   │   ├── characterBuilder.js
│   │   │   ├── mapScreen.js
│   │   │   ├── combatScreen.js
│   │   │   ├── townScreen.js
│   │   │   └── inventoryScreen.js
│   │   ├── components/
│   │   │   ├── dialogBox.js    # Portrait + text + choices
│   │   │   ├── healthBar.js
│   │   │   ├── skillBar.js
│   │   │   ├── partyPanel.js
│   │   │   └── tooltip.js
│   │   └── uiManager.js        # Screen switching, modal stack
│   ├── content/
│   │   ├── classes.js          # All 14 class definitions
│   │   ├── skills.js           # Skill data, talent trees
│   │   ├── enemies.js          # Enemy data, stat tables
│   │   ├── items/
│   │   │   ├── weapons.js
│   │   │   ├── armor.js
│   │   │   └── affixes.js
│   │   ├── dialog/             # Story dialog scripts per zone
│   │   └── companions.js       # Companion/pet definitions
│   └── utils/
│       ├── rng.js              # Seeded RNG utility
│       ├── math.js             # Damage formulas, stat math
│       └── logger.js           # Debug logging
```

### Key Technical Notes

- **Canvas rendering:** The game world (combat field, map nodes) renders to a Canvas element. UI overlays are HTML/CSS positioned absolutely over the canvas for accessibility and responsive layout.
- **State management:** A single global `state.js` object is the source of truth. All systems read from and write to this object; UI components subscribe to state slices.
- **Asset pipeline:** PixelLab character art generated offline and bundled. OpenAI background generation can occur at runtime (with API key) or use pre-generated images.
- **Input abstraction:** `input.js` normalizes keyboard, mouse/touch, and gamepad into a unified action event stream.
- **Responsive layout:** Portrait-first (393×852 baseline). Landscape layout swaps combat field and party panel for wider screens. CSS custom properties drive layout breakpoints.

---

## Visual Design

- **Art style:** Pixel art throughout. Characters use PixelLab generation with consistent palette per zone theme.
- **Zone palettes:**
  - Act 1: Earthy greens, browns, grays.
  - Act 2: Reds, oranges, blacks, ash whites.
  - Act 3: Deep reds, purples, bone whites, brimstone yellows.
  - Act 4: Black, deep blues, void purples, crystalline whites.
- **UI style:** Dark fantasy panel frames, parchment-tinted text areas, gold accent borders.
- **Combat field:** Side-view. Hero party on left (4 + 4 companion slots). Enemy groups on right. Groups visually clustered, with spacing indicating group separation.
- **Dialog system:** Portrait left (speaking character), NPC portrait right, scrolling text center, choice buttons below.
- **Backgrounds:** Full-scene AI-generated art (OpenAI) per zone, used as backdrop for combat and map screens.

---

## Audio Design

- **Music:** Procedural layering via Web Audio API. Each zone has a base ambient track and combat layer that fades in/out on encounter start/end.
- **SFX:** Individual sounds for weapon strikes (typed by weapon category), spell casts (typed by element), UI interactions, status effect triggers, level up.
- **Boss music:** Unique theme per boss, transitions between phases with additional intensity layers.
- **Volume controls:** Master, Music, SFX independently adjustable from settings menu.

---

## Accessibility

- **Font sizing:** All game text uses scalable rem units; system font size respected.
- **Contrast:** UI elements meet WCAG AA contrast ratios. Color-blind safe palette used for status effects (unique icons supplement color coding).
- **Screen reader support:** Critical UI actions have ARIA labels on HTML overlay buttons.
- **Input flexibility:** Every action performable via touch, mouse, keyboard, or gamepad. No time-critical manual inputs required (auto-combat default).
- **Reduce motion:** Setting to reduce or eliminate non-essential animations.
- **Pause anywhere:** Game pauses fully at any time outside of auto-combat resolution.
- **Auto-combat default:** Minimizes required reaction time; manual mode is opt-in.

---
