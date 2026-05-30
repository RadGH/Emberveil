# Spells & Skills — Functional Taxonomy

> **Audited:** 2026-04-16 against `src/game/skills.js`.

Rather than listing all 82 base spells, this doc groups them by **mechanic**. Two spells that differ only by element (frost bolt vs fire bolt) go in the same bucket — that's the whole point. When brainstorming new spells, avoid buckets that are already "full" and look at the [gaps at the bottom](#gaps--opportunities).

## Buckets that already exist

| Bucket | Representative spells | Mechanic |
|---|---|---|
| Single-target nuke | magic_missile, fireball (single variant), bone_spike, smite, backstab | `damageMult × stat` |
| Cleave / adjacent AoE | cleave, whirlwind, glaive_toss | AoE with falloff |
| Group AoE nuke | fireball, pyroclasm, meteor, rain_of_arrows, blizzard, natures_wrath | `aoe: 'group'` or `'all'` |
| Chain / bounce | chain_lightning, thunder_ring | `aoe: 'chain3'` |
| Pierce line | multi_shot, pierce_row variants | `aoe: 'pierce_row'` |
| DoT apply | corruption, poison_blade, ignite, soul_pact | `statusOnHit: [{ type: dot }]` |
| Stun / CC | discordant_wail, shadow_step (stun variant), thunder_ring | `status: stun` |
| Bleed stack | backstab, rend-style (talent) | bleed DoT |
| Self-heal / lifedrain | life_drain, death_coil, lay_on_hands | heal on hit |
| Team heal | heal, rejuvenation, mass_resurrection | heal ally |
| Barrier / shield | sanctuary, dragon_scales, unbreakable | absorb on ally |
| Buff damage | battle_cry, inspiring_tune, ballad_of_valor | `dmgBuff` on allies |
| Extra action / haste | haste (chrono), masterstroke, draconic_fury | `extraAction` grant |
| Summon | bone_spike summons skeletons, wild_shape | temp ally |
| Mark → execute | death_mark, foresight + prophecy | flag + trigger |
| Counter / riposte | riposte, vengeance | react on hit |
| Stack → release | swashbuckler flair, vengeance counter | resource that builds |
| Time manipulation | slow_time, rewind, time_stop | turn-order edit |
| Corpse consume | necromancer talents | spend dead ally for effect |

## Redundancies (candidates to consolidate)

- **Fire/Frost/Lightning single bolts** — `fireball(single), demon_bolt, flame_lance` are all "INT-scaled single-target nuke with small status chance." Would collapse to one spell + element tag in a mod schema.
- **Pyroclasm vs Fireball(group)** — nearly identical once both are "group AoE that may burn."
- **Rain_of_arrows vs Blizzard vs Natures_wrath** — all `aoe:'all'` physical/magic dmg with no secondary hook.

## Gaps — Opportunities (brainstorm pool)

Mechanics the engine can already support but **no spell uses**:

1. **Reflect as active** (not passive buff): next hit on ally returns `200%` to attacker.
2. **Damage-on-dodge** trigger: buff that deals burst when dodge fires.
3. **Lifesteal reversal**: debuff that makes target *heal* the team when it attacks.
4. **Cooldown reset on kill**: e.g. execute low-HP target refunds skill CD.
5. **Conditional crit**: "crit vs marked / bleeding / stunned / full-HP / below-25% targets."
6. **Resource swap**: convert current HP into MP (or vice versa).
7. **Delayed payload**: plant a seed on turn N, detonates turn N+2 with all dmg dealt to target meanwhile.
8. **Chain-link buffs**: every ally buffed gets `+10%` per other buffed ally (rewards stacking).
9. **Turn-order hijack**: move target to last in order next round.
10. **Dispel + steal**: remove buff from enemy, apply it to self.
11. **Aura (persistent AoE field)**: while caster lives, enemies in group take `N`/turn.
12. **Soulbind**: damage dealt to ally is split with caster (tank pattern).
13. **Echo**: next skill cast repeats at 50% power.
14. **Pact / cost spells**: `-20% max HP` this combat for `+50% dmg`.
15. **Momentum**: dmg scales with number of unique targets hit this round.
16. **Ward-break**: ignore all barriers on hit; bonus dmg if a barrier broke.
17. **Displace**: swap positions with an ally (tank swap pattern).
18. **Counter-stance**: skip own turn, deal 150% back to anyone who hits you this round.
19. **Targeted silence**: block target's next `mpCost > 0` skill.
20. **Bleed detonate**: consume target's bleed stacks for burst = `stacks × power × 3`.
21. **Mark-and-chain**: mark a target; any ally hit on mark echoes to it.
22. **Soul tether** (2-unit): when either dies, the other revives at 25%.
23. **Inverse heal**: damage taken this turn heals the lowest-HP ally.
24. **Second wind trigger**: revive self to 1 HP the first time you'd die this combat.
25. **Scaling ramp** (channel): each round you don't move, +25% next hit up to cap.
26. **Conditional multi**: skill hits `+1` target for each status on the primary target.
27. **Armor shred stacking**: each hit reduces armor by `N`, permanent within combat.
28. **Magic-resist shred stacking**: same but magicResist.
29. **Healing-flip**: convert heals into damage for the target (anti-heal).
30. **Sacrifice an ally**: consume companion → full HP/MP restore to caster; companion marked for rest of run.
31. **Bounty**: buff on enemy; killing it gives whole team `gold/XP` bonus.
32. **Threat magnet** (taunt that scales): takes reduced dmg per enemy currently targeting you.
33. **Burst-at-threshold**: when you drop below 50%, auto-cast a stored spell.
34. **Stolen turn**: force enemy to attack its own side next turn.
35. **Ritual (multi-round cast)**: occupies 2–3 turns, then massive effect; interrupt cancels.
36. **Overload**: deal self-damage = MP cost, but damage scales off `currentMp` instead of stat.
37. **Parity**: set target's HP% = caster's HP% (works both ways).
38. **Dash-strike**: move to back row, hit support target (bypass tank).
39. **Empowered on-crit**: crits apply a stacking +5% dmg buff for rest of combat.
40. **Resource drain**: steal `N` MP from target; if it reaches 0, stun next turn.
41. **Phase**: untargetable one round; cannot act either.
42. **Inherited status**: copy all statuses from lowest-HP ally to nearest enemy.
43. **Delay heal** (regrowth): `50%` heal now, remaining `50%` over 4 rounds.
44. **Guard link**: all dmg to target X is redirected to caster for 1 round.
45. **Overheal → barrier**: any healing beyond max HP converts to barrier.
46. **Counter-magic screen**: next magic dmg is 80% reduced and refunded as MP.
47. **Punish buff**: enemy loses 10% HP each time it gains a buff while active.
48. **Prophecy / precommit**: declare an effect; it triggers in 2 rounds automatically.
49. **Momentum-burn**: consume all your own buffs; deal `sum(buff power) × 3` dmg.
50. **Scrying attack**: see enemy's next intended move; your next hit vs them +100% dmg.

Every one of these fits inside the existing status/buff dual model. The [proposed schema](./proposed-schema.md#effect-dsl) shows a small effect-DSL that encodes all 50 without new code paths per spell.
