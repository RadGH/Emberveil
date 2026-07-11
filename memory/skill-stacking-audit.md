# Skill Stacking Audit

Shows effective damageMult at max level with all talents purchased, under the CURRENT additive `_mergeInto` behavior in `skills.js:2149`.

`overrun` = effective / intended. >2.0 means the skill scales at least 2× more than the tooltip suggests.

## Damage skills

| Skill | Class | Type | Base | Intended (tooltip) | Effective (max level) | Overrun | Contribs |
|-------|-------|------|-----:|-------------------:|----------------------:|--------:|----------|
| Bone Spike | necromancer | magic | 0.9 | 1.1 | 3.30 🚨 | 3.00× | base=0.9, L5:Sharpened Spike=1.3, L10:Bone Volley=1.1 |
| Song of Ruin | bard | magic | 1.47 | 2 | 5.37 🚨 | 2.69× | base=1.47, talent:sr_power=0.4, L17:Requiem=1.5, L20:Dirge of Annihilation=2 |
| Flourish | swashbuckler | melee | 1 | 1.5 | 3.70 🚨 | 2.47× | base=1, L10:Dazzling Flourish=1.2, L15:Blinding Flourish=1.5 |
| Wild Bolt | sorcerer | magic | 1.6 | 2.8 | 6.90 🚨 | 2.46× | base=1.6, talent:wb_big=0.4, L5:Greater Wild Bolt=2.1, L10:Chaos Lance=2.8 |
| Multi-Shot | ranger | ranged | 0.8 | 1.3 | 3.20 🚨 | 2.46× | base=0.8, L10:Rapid Volley=1.1, L15:Arrow Storm=1.3 |
| Spirit Bolt | shaman | magic | 1.5 | 2.6 | 6.40 🚨 | 2.46× | base=1.5, talent:sb_power=0.3, L5:Wrathful Spirit=2, L10:Ancestor’s Fury=2.6 |
| Big Score | scavenger | ranged | 2.5 | 4.2 | 10.30 🚨 | 2.45× | base=2.5, talent:jp_gold=0.4, L17:Loaded Dice=3.2, L20:Windfall=4.2 |
| Shield Bash | knight | melee | 1.1 | 2 | 4.90 🚨 | 2.45× | base=1.1, talent:ksb_pow=0.3, L5:Crushing Bash=1.5, L10:Bulwark Strike=2 |
| Whirlwind | warrior | melee | 0.9 | 1.5 | 3.60 🚨 | 2.40× | base=0.9, L14:Cyclone Strike=1.2, L18:Endless Vortex=1.5 |
| Silver Bolt | witch_hunter | ranged | 1.4 | 2.3 | 5.50 🚨 | 2.39× | base=1.4, L5:Consecrated Bolt=1.8, L10:Inquisitor’s Bolt=2.3 |
| Precise Strike | fighter | melee | 1.6 | 2.6 | 6.20 🚨 | 2.38× | base=1.6, L5:Surgical Cut=2, L10:Killing Blow=2.6 |
| Glaive Toss | demon_hunter | ranged | 0.79 | 1.41 | 3.34 🚨 | 2.37× | base=0.79, L10:Serrated Glaive=1.14, L15:Twin Glaives=1.41 |
| Palm Strike | monk | melee | 1.3 | 2.2 | 5.20 🚨 | 2.36× | base=1.3, L5:Iron Palm=1.7, L10:Thunder Palm=2.2 |
| Arcane Surge | mage | magic | 4 | 7 | 16.50 🚨 | 2.36× | base=4, L17:Void Surge=5.5, L20:Reality Shatter=7 |
| Bone Spear | necromancer | magic | 1.6 | 2.8 | 6.60 🚨 | 2.36× | base=1.6, L10:Greater Bone Spear=2.2, L15:Calcified Lance=2.8 |
| Shadow Strike | shadow_dancer | melee | 1.5 | 2.6 | 6.10 🚨 | 2.35× | base=1.5, L5:Umbral Strike=2, L10:Night’s Edge=2.6 |
| Rune Hammer | runesmith | melee | 1.4 | 2.4 | 5.60 🚨 | 2.33× | base=1.4, L5:Thunder Rune=1.8, L10:Sovereign Rune=2.4 |
| Fireball | mage | magic | 1.4 | 2.5 | 5.80 🚨 | 2.32× | base=1.4, L10:Greater Fireball=1.9, L15:Conflagration=2.5 |
| Blizzard | mage | magic | 0.7 | 1.3 | 3.00 🚨 | 2.31× | base=0.7, L14:Arctic Tempest=1, L18:Eternal Winter=1.3 |
| Cleave | warrior | melee | 1.1 | 2 | 4.60 🚨 | 2.30× | base=1.1, L5:Whirling Cleave=1.5, L10:Executioner’s Arc=2 |
| Holy Strike | paladin | melee | 1.1 | 2 | 4.60 🚨 | 2.30× | base=1.1, L5:Radiant Strike=1.5, L10:Divine Judgment=2 |
| Makeshift Bomb | scavenger | ranged | 1 | 2.2 | 5.05 🚨 | 2.30× | base=1, talent:mb_boom=0.35, L14:Improved Explosive=1.5, L18:Doomsday Device=2.2 |
| Sunder Armor | fighter | melee | 0.9 | 1.7 | 3.90 🚨 | 2.29× | base=0.9, L18:Crushing Blow=1.3, L23:Armor Breaker=1.7 |
| Life Drain | necromancer | magic | 1.2 | 2.2 | 5.00 🚨 | 2.27× | base=1.2, L14:Void Drain=1.6, L18:Soul Harvest=2.2 |
| Backstab | rogue | melee | 1.69 | 3.2 | 7.25 🚨 | 2.27× | base=1.69, L5:Vital Strike=2.36, L10:Assassinate=3.2 |
| Consecration | paladin | zone | 0.6 | 1.2 | 2.70 🚨 | 2.25× | base=0.6, L17:Holy Sanctum=0.9, L20:Divine Dominion=1.2 |
| Magic Missile | mage | magic | 0.5 | 1 | 2.25 🚨 | 2.25× | base=0.5, L5:Force Missiles=0.75, L10:Arcane Fusillade=1 |
| Slow Time | chronomancer | magic | 0.4 | 0.4 | 0.90 🚨 | 2.25× | base=0.4, talent:st_power=0.5 |
| Aimed Shot | ranger | ranged | 1.5 | 3 | 6.70 🚨 | 2.23× | base=1.5, L5:Headshot=2.2, L10:Kill Shot=3 |
| Shadow Step | rogue | melee | 1.27 | 2.53 | 5.65 🚨 | 2.23× | base=1.27, L14:Shadowstrike=1.85, L18:Phase Walk=2.53 |
| Hellfire | warlock | magic | 1.3 | 2.6 | 5.80 🚨 | 2.23× | base=1.3, L10:Infernal Hellfire=1.9, L15:Demonfire=2.6 |
| Pyroclasm | pyromancer | magic | 0.83 | 1.65 | 3.68 🚨 | 2.23× | base=0.83, L14:Volcanic Chain=1.2, L18:Cataclysm=1.65 |
| Dragon Claw | dragon_knight | melee | 1.1 | 2.2 | 4.90 🚨 | 2.23× | base=1.1, L5:Rending Claw=1.6, L10:Dragon's Fury=2.2 |
| Lucky Strike | scavenger | melee | 0.9 | 1.8 | 4.00 🚨 | 2.22× | base=0.9, L5:Expert Scrounge=1.3, L10:Treasure Hunter=1.8 |
| Breath Weapon | dragon_knight | magic | 1.3 | 2.7 | 5.90 🚨 | 2.19× | base=1.3, L10:Devastating Breath=1.9, L15:Cataclysmic Breath=2.7 |
| Meteor | pyromancer | magic | 2.3 | 5 | 10.80 🚨 | 2.16× | base=2.3, L17:Extinction Event=3.5, L20:World Ender=5 |
| Ignite | pyromancer | zone | 0.55 | 1.19 | 2.57 🚨 | 2.16× | base=0.55, L10:Blazing Ground=0.83, L15:Scorched Earth=1.19 |
| Flame Lance | pyromancer | magic | 0.92 | 2.02 | 4.32 🚨 | 2.14× | base=0.92, L5:Searing Lance=1.38, L10:Infernal Beam=2.02 |
| Demon Bolt | demon_hunter | ranged | 0.88 | 1.94 | 4.14 🚨 | 2.13× | base=0.88, L5:Fel Bolt=1.32, L10:Void Bolt=1.94 |
| Void Rift | warlock | zone | 0.7 | 1.6 | 3.40 🚨 | 2.13× | base=0.7, L17:Dimensional Rift=1.1, L20:Tear in Reality=1.6 |
| Thrown Junk | scavenger | ranged | 0.7 | 1.6 | 3.40 🚨 | 2.13× | base=0.7, L10:Barrage of Debris=1.1, L15:Junk Avalanche=1.6 |
| Smite | cleric | magic | 2.2 | 5.07 | 10.65 🚨 | 2.10× | base=2.2, L10:Holy Bolt=3.38, L15:Wrath of the Divine=5.07 |
| Rain of Arrows | ranger | ranged | 0.5 | 1.2 | 2.50 🚨 | 2.08× | base=0.5, L17:Tempest of Arrows=0.8, L20:Eternal Barrage=1.2 |
| Dance of Blades | shadow_dancer | melee | 0.8 | 0.9 | 1.70 ⚠️ | 1.89× | base=0.8, L20:Endless Waltz=0.9 |
| Tempest | stormcaller | magic | 2.2 | 3 | 5.60 ⚠️ | 1.87× | base=2.2, talent:tp_power=0.4, L20:Eye of the Storm=3 |
| Flurry | monk | melee | 0.6 | 0.7 | 1.30 ⚠️ | 1.86× | base=0.6, L10:Torrent=0.7 |
| Nature's Wrath | druid | magic | 2 | 2.8 | 5.10 ⚠️ | 1.82× | base=2, talent:nw_power=0.3, L20:World-Tree Judgment=2.8 |
| Static Field | stormcaller | magic | 0.5 | 1 | 1.80 ⚠️ | 1.80× | base=0.5, talent:sf_power=0.3, L10:Magnetic Pulse=1 |
| Assassinate | shadow_dancer | melee | 2.2 | 2.8 | 5.00 ⚠️ | 1.79× | base=2.2, L15:Death Kiss=2.8 |
| Purge Strike | witch_hunter | melee | 1.7 | 2.2 | 3.90 ⚠️ | 1.77× | base=1.7, L15:Hallowed Strike=2.2 |
| Shadow Step | monk | melee | 2 | 2.6 | 4.60 ⚠️ | 1.77× | base=2, L20:Void Step=2.6 |
| Holy Strike | knight | melee | 1.8 | 2.4 | 4.20 ⚠️ | 1.75× | base=1.8, L15:Divine Strike=2.4 |
| Spirit Chain | shaman | magic | 1.2 | 1.6 | 2.80 ⚠️ | 1.75× | base=1.2, L15:Storm of Spirits=1.6 |
| Forge Flame | runesmith | magic | 1.3 | 1.8 | 3.10 ⚠️ | 1.72× | base=1.3, L20:Sovereign Flame=1.8 |
| Mana Burn | sorcerer | magic | 1.2 | 1.7 | 2.90 ⚠️ | 1.71× | base=1.2, L15:Soul Burn=1.7 |
| Thunder Ring | stormcaller | magic | 1.8 | 2.6 | 4.40 ⚠️ | 1.69× | base=1.8, L20:Cataclysm=2.6 |
| Chain Lightning | stormcaller | magic | 1.3 | 2 | 3.30 ⚠️ | 1.65× | base=1.3, L10:Storm Surge=2 |
| Feint | tactician | magic | 1.2 | 1.2 | 1.50 | 1.25× | base=1.2, talent:ft_power=0.3 |
| Fate Weave | oracle | magic | 2.51 | 2.51 | 2.91 | 1.16× | base=2.51, talent:fw_power=0.4 |
| Corruption | warlock | magic | 0.6 | 0.6 | 0.60 | 1.00× | base=0.6 |
| Vengeance | demon_hunter | melee | 0.88 | 0.88 | 0.88 | 1.00× | base=0.88 |
| Entangle | druid | magic | 0.8 | 0.8 | 0.80 | 1.00× | base=0.8 |
| Inquisitor’s Mark | witch_hunter | magic | 0.3 | 0.3 | 0.30 | 1.00× | base=0.3 |

## Heal skills (healMult stacking)

| Skill | Class | Effective healMult | Contribs |
|-------|-------|-------------------:|----------|
| Lay on Hands | paladin | 9.00 | base=2, L10=3, L15=4 |
| Consecration | paladin | 2.40 | base=0.4, L17=0.6, L20=0.8 |
| Heal | cleric | 12.50 | base=2.5, L5=4, L10=6 |
| Rejuvenation | druid | 1.20 | base=1.2 |
| Rewind | chronomancer | 9.50 | base=3, L15=5 |
| Inner Focus | monk | 6.50 | base=2.5, L15=4 |
| Healing Totem | shaman | 3.30 | base=1, L10=1.8 |
| Dispel Curse | witch_hunter | 1.50 | base=0.5 |

## Summary
- 63 damage skills audited.
- 43 with overrun ≥ 2× (🚨 scaling outliers).
- 14 with overrun 1.5–2× (⚠️ borderline).

## Top 10 worst outliers

- **Bone Spike** (necromancer): tooltip says 1.1× → actually 3.30× (3.0× overrun) — contribs: base=0.9, L5:Sharpened Spike=1.3, L10:Bone Volley=1.1
- **Song of Ruin** (bard): tooltip says 2× → actually 5.37× (2.7× overrun) — contribs: base=1.47, talent:sr_power=0.4, L17:Requiem=1.5, L20:Dirge of Annihilation=2
- **Flourish** (swashbuckler): tooltip says 1.5× → actually 3.70× (2.5× overrun) — contribs: base=1, L10:Dazzling Flourish=1.2, L15:Blinding Flourish=1.5
- **Wild Bolt** (sorcerer): tooltip says 2.8× → actually 6.90× (2.5× overrun) — contribs: base=1.6, talent:wb_big=0.4, L5:Greater Wild Bolt=2.1, L10:Chaos Lance=2.8
- **Multi-Shot** (ranger): tooltip says 1.3× → actually 3.20× (2.5× overrun) — contribs: base=0.8, L10:Rapid Volley=1.1, L15:Arrow Storm=1.3
- **Spirit Bolt** (shaman): tooltip says 2.6× → actually 6.40× (2.5× overrun) — contribs: base=1.5, talent:sb_power=0.3, L5:Wrathful Spirit=2, L10:Ancestor’s Fury=2.6
- **Big Score** (scavenger): tooltip says 4.2× → actually 10.30× (2.5× overrun) — contribs: base=2.5, talent:jp_gold=0.4, L17:Loaded Dice=3.2, L20:Windfall=4.2
- **Shield Bash** (knight): tooltip says 2× → actually 4.90× (2.5× overrun) — contribs: base=1.1, talent:ksb_pow=0.3, L5:Crushing Bash=1.5, L10:Bulwark Strike=2
- **Whirlwind** (warrior): tooltip says 1.5× → actually 3.60× (2.4× overrun) — contribs: base=0.9, L14:Cyclone Strike=1.2, L18:Endless Vortex=1.5
- **Silver Bolt** (witch_hunter): tooltip says 2.3× → actually 5.50× (2.4× overrun) — contribs: base=1.4, L5:Consecrated Bolt=1.8, L10:Inquisitor’s Bolt=2.3
