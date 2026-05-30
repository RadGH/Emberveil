# Milestone jargon glossary

This file decodes the cryptic milestone tags and feature codes that show up in
the changelog. Each entry maps the short label to "what it actually means" so a
new reader (or the user, several months later) doesn't have to dig through
five different code paths to figure out what shipped.

Keep entries terse and concrete: the audience is someone scanning the
changelog who hit a label they don't recognize.

## Top 10 worst offenders

### Slot-mult (passives)
**Where:** M412.
**What it means:** The bug where `mult = r * slotCount[node.id]` in
`getPassiveBonuses` silently doubled the effect of any duplicated tree slot.
Pyromancer's "Igniting" and stormcaller's "Stormcharged" were each listed
twice in their tree, so a single purchased rank produced 2× the value of every
other class's per-rank bonus. Fix: de-dupe by id and replace the second slot
with a new themed passive so the tree count stays at 5.

### Meter
**Where:** M261, M267, M273, M414.
**What it means:** The in-combat DPS / heal / mit tracker. Lives at
`src/ui/screens/_meterTracker.js`. Three add helpers (`meterAddDamage`,
`meterAddHeal`, `meterAddMit`, `meterAddDodge`) feed a per-actor entry. The
"meter" is not the post-combat report — that's the **Combat Report**, which
reads from the same data store at the end of the fight.

### Ev / EV / ev-overlay
**Where:** M389+.
**What it means:** The "Emberveil" bottom-card-rail HUD. `EvCardRail`,
`EvBattlefield`, `EvTurnStrip`. Gated behind `gs.uiOverhaul`. When mounted,
hides the legacy `.hud-members` row by adding `.cbt-hud--ev-overlay` to the
HUD container.

### Manual mode / manual combat
**Where:** M402+.
**What it means:** The setting where the player picks a skill for each hero
each round instead of auto-AI. Stored as `gs.manualCombat`. When enabled, a
spell rail appears in each hero card; when disabled, the rail is hidden and
the AI auto-resolves the round.

### Hardcore / RIP / fallen hero
**Where:** M298+.
**What it means:** Permadeath mode. When a hardcore party wipes, the save is
locked into a "RIP" / "fallen" state — viewable from the title-screen
monument and from the Load Game screen, but not loadable for a new run. The
record stores final stats for comparison.

### Companion level sync
**Where:** M302.
**What it means:** Setting that scales companion combatants to the
party-average hero level for a single fight. The source `m.level` is never
mutated; only a shadow `_effectiveLevel` is stamped on the combatant for
HP/dmg/initiative recompute.

### Auto-equip / auto-build / auto-spend
**Where:** M227+.
**What it means:** Per-character toggles that let the game spend pending
points (skill / passive / attribute) automatically, or auto-equip strict
upgrades from the inventory. Not the same as "Auto" combat — the on-character
flag is `char.autoEquip` / `char.autoBuild.{auto_active, auto_passive,
auto_attrs}`.

### Tap weapon / tap utility
**Where:** M72+.
**What it means:** The single-target overworld-button items the player taps
in combat for an instant effect. Different from inventory items — they're
unlocked from boss kills (`BOSS_TAP_DROPS` in `maps/mapData.js`) and cycle
through `MINI_BOSS_TAPS` for non-act bosses.

### Fame
**Where:** M305+.
**What it means:** Cross-zone reputation currency. Used to gate class
unlocks and items at the Black Market vendor. Multiplied per-zone by
`ZONE_FAME_MULT` (mapData.js).

### Veil / veilspawn / veil_warden
**Where:** Worldbuilding.
**What it means:** The setting's recurring antagonist faction — corruption
leaking through "the Veil" between worlds. Many enemy ids carry `veil_*` or
`*_veil_touched`. The Veilspawn Herald is the prologue mini-boss (flagged
for re-tier — its art is too strong for a tutorial encounter).

## Adding a new entry

When you ship a milestone that introduces a confusing label, drop a 3-5 line
entry here. The bar: someone reading the changelog 6 months from now should
be able to find the label and learn what it means in under 30 seconds. If a
label is documented elsewhere (e.g. `image-policy.md` for sprite poses),
link instead of copying.
