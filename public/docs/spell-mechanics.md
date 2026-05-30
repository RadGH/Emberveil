# Spell Mechanic Catalog (v1)

Emberveil's combat engine supports ~24 mechanically distinct skill archetypes. Each one is expressible as a combination of DSL ops (see `effect-dsl.json`) — custom mod skills should pick one of these archetypes as a starting point rather than inventing new engine support.

## Damage archetypes

| # | Archetype | DSL sketch | Example vanilla skill |
|--:|-----------|------------|------------------------|
| 1 | Direct single-target | `damage target mult=1.4 stat=int` | Firebolt |
| 2 | AoE row/column | `damage target=allEnemies mult=0.8 stat=int` | Fireball |
| 3 | Damage over time | `applyStatus burn duration=3 tickMult=0.3` | Ember Decay |
| 4 | Execute (%hp gate) | `damage requireHpBelow=0.25 mult=4.0` | Coup de Grace |
| 5 | Multi-hit (2-3 rolls) | `damage repeat=3 mult=0.5` | Cleave |
| 6 | Bounce / chain | `damage chain=3 falloff=0.7` | Chain Lightning |
| 7 | On-crit rider | `onCrit { applyStatus bleed duration=2 }` | Precision Strike |
| 8 | On-kill rider | `onKill { buff self dmgBuff=0.2 duration=1 }` | Bloodlust |

## Support archetypes

| # | Archetype | DSL sketch | Example |
|--:|-----------|------------|---------|
|  9 | Direct heal | `heal target=self mult=1.5 stat=wis` | Mend |
| 10 | Overheal→barrier | `heal mult=2.0 overheal=barrier duration=3` | Aegis |
| 11 | Regen tick | `applyStatus regen amount=8 duration=4` | Renewal |
| 12 | Self-buff damage | `buff self dmgBuff=0.3 duration=3` | Bloodrage |
| 13 | Self-buff crit | `buff self critBonus=0.25 duration=2` | Focus |
| 14 | Cleanse | `consumeStatus types=[burn,poison,bleed] target=ally` | Purify |
| 15 | Resource swap | `resourceSwap hp→mp ratio=0.5` | Soul Burn |

## Control archetypes

| # | Archetype | DSL sketch | Example |
|--:|-----------|------------|---------|
| 16 | Stun | `applyStatus stun duration=1` | Shield Bash |
| 17 | Root / silence | `applyStatus root duration=2` | Entangle |
| 18 | Taunt | `applyStatus taunt duration=2 target=self` | Provoke |
| 19 | Turn-order shift | `modifyTurnOrder target shift=+1` | Delay |
| 20 | Interrupt (consume) | `consumeStatus types=[channeling]` | Counterspell |

## Meta archetypes

| # | Archetype | DSL sketch | Example |
|--:|-----------|------------|---------|
| 21 | Flag-gated combo | `requireFlag marked → damage mult=2.5` | Execute Mark |
| 22 | Two-step ritual | `ritual steps=2 payoff={damage mult=3}` | Summoning |
| 23 | Echo (repeat prev cast) | `echo count=1 power=0.5` | Arcane Echo |
| 24 | On-hit rider (passive) | `onHit { setFlag marked duration=3 }` | Hunter's Mark |

## How to use this catalog

When authoring a mod skill:

1. Pick the archetype that best matches the intended feel.
2. Copy the DSL sketch into your skill's `effects` array.
3. Tune numbers (mult, duration, stat scaling).
4. Validate with `/assets/custom-content.html` → Validate only.

If your concept doesn't map to any archetype, that's a signal the engine doesn't yet support it — file it on the wishlist rather than trying to hardcode around the DSL.

## See also

- `public/schemas/v1/skill.json` — full skill schema
- `public/schemas/v1/effect-dsl.json` — every DSL op with argument shapes
- `public/docs/mod-authoring.md` — end-to-end pack authoring guide
