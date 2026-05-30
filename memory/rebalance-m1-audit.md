# Rebalance M1 Audit — 2026-04-21

## Executive summary

game13's combat logic is **already cleanly separated** from UI (see `src/game/simulator.js` — seeded, DOM-free, importable in Node). Combat formulas live in `src/game/formulas.js` with metadata. The simulator uses `mulberry32(seed)` for reproducibility. Tap system uses raw `Math.random` (acceptable — it's cooldown-gated and not in the damage loop).

**Terminology check (confirmed):** the code uses "tap weapon" and "tap utility" exactly as the user's prompt describes. No renaming needed.

**Armor formula:** live code uses legacy `applyArmorMitigation` → `max(ceil(rawDmg * 0.15), rawDmg - armor)` (minimum 15% of raw damage gets through, then flat subtraction). The newer `applyArmorReduction` (pure flat subtraction) exists but is NOT called from combat. Baseline config must preserve the legacy formula exactly.

**Saves are safe:** characters store base attrs + level; HP/MP/damage/armor are recomputed via `computeMaxHp`, `deriveDamageRange`, etc. on load. Balance changes auto-apply.

## 1. Combat logic location

- `src/game/formulas.js` — single source of truth for combat math. Pure functions with metadata, seeded-aware via injected `rand`.
- `src/game/simulator.js` — deterministic headless combat runner. `runSimulation({heroes, encounter, act, seed, maxRounds, vanillaOnly})`. Node-ready.
- `src/ui/screens/CombatScreen.js` — live render, calls the same formulas.
- `src/ui/screens/CombatSimulatorScreen.js` — in-game simulator UI (not to be touched in M1).

**M2 readiness:** simulator already separates combat from UI. M2 needs only a run-loop wrapper (tavern → navigate → combat → loot → level → repeat) plus 3 policy objects.

## 2. Randomness

- Formulas accept injected `rand`. `rollToHit`, `rollBlock`, `rollInt` all thread RNG.
- `tapWeapons.js:328` uses raw `Math.random` (non-combat utility resolution — acceptable to leave).
- `mulberry32(seed)` helper exists in `simulator.js` and `loot.js` (`makeRng`).

## 3. Balance constants inventory

### Hire costs (`src/ui/screens/HireBuilderScreen.js`)
- `BASE_COST = 100` (line 27)
- `SCALING = 0.10` (line 28)
- Formula: `cost = BASE_COST * level * (1 + SCALING * (level - 1))`

### Companion hire prices (`src/ui/screens/TownScreen.js:165-182` and per-Act tables)
- Aela (ranger L1): 80; Borin (warrior L1): 90; Lysa (cleric L2): 120; Rekk (rogue L1): 70; War Dog L1: 50
- Kaldrek DK L6: 600; Syra DK L7: 750; Vorin DK L8: 900; Maelis DK L9: 1100
- Dragon hatchlings: 500–850
- (Full list in TownScreen per act — large table)

### Stat derivations (`src/game/formulas.js:47-157`)
- `maxHp = 50 + CON * 10 + passive.maxHp` (line 50)
- `maxMp = 30 + INT * 8 + passive.maxMp` (line 57)
- `hitRating = min(95, 70 + DEX * 1.2)` (line 129)
- `heroDodge = min(40, 5 + DEX * 0.8)` (line 142)
- `companionDodge = min(15, 3 + DEX * 0.35)` (line 141)
- `initiative = DEX + level` (line 152)
- `spellPower = INT * 0.025` (line 436)
- `manaRegenTick = max(1, round(INT * 0.3)) + affix.manaRegen` (line 522)
- `dotTick = max(3, floor(INT * 0.15))` (line 494, when no power specified)

### Damage derivation (`src/game/formulas.js:105-122`)
- Primary stat by weapon category: heavy→STR, light→DEX, magic→INT
- `minDmg = max(1, round(primary * 0.4 + equipBonus))`
- `maxDmg = max(3, round(primary * 1.0 + equipBonus * 1.5))`
- Magic weapons add `floor(INT * 0.25)` spell bonus

### Crit (`src/game/formulas.js:562-584`)
- Base chance: 5%
- Max chance: 75%
- Base crit multiplier: 1.5x (plus affix `critDamage`)

### Armor (LIVE = LEGACY, `src/game/formulas.js`)
- Live: `applyArmorMitigation(raw, armor) = max(ceil(raw * 0.15), raw - armor)` — 15% damage floor
- Canonical (unused): `applyArmorReduction(raw, armor) = max(0, raw - armor)`
- **AMBIGUITY**: M84 refactor added canonical but didn't rewire callers. Baseline preserves legacy (what plays today).

### NG+ scaling (`src/game/formulas.js:376-404`)
- hpMul = `pow(4.5, ng) * (isBoss ? 1.35 : 1)`
- dmgMul = `pow(2.8, ng) * (isBoss ? 1.2 : 1)`
- armorMul = `1 + ng * 0.55`
- hitBonus = `ng * 5`; dodgeBonus = `ng * 3`
- xpBonus = `round(xp * (0.8 * ng + (isBoss ? 1 : 0)))`

### Level-up cadence (`src/game/xp.js`)
- `STAT_POINTS_PER_LEVEL = 2`
- Talent points at levels `[3, 8, 13, 18, 23, 28]`
- Passive points every 5 levels: `[5, 10, 15, 20, 25, 30]`
- XP_TABLE: cumulative, 20 entries (L1=0 through L20=22300)
- Max level: 20

### Economy (`src/game/formulas.js:323-365`)
- Gold reward: `rand_int(enemy.gold[0], enemy.gold[1]) * (1 + sum(goldFind affixes))`
- XP reward: `enemy.xp * (1 + sum(xpFind affixes))`

### Loot quality / rarity (`src/game/items.js:9-10`)
- `QUALITY_MULT = { low: 0.7, medium: 1.0, high: 1.2, elite: 1.4, exotic: 1.6 }`
- `RARITY_AFFIX_COUNT = { normal: 0, magic: [2,2], rare: [3,3], legendary: [5,6] }`

### Affix ranges (per-act, `src/game/items.js:146+`)
- See items.js tables. Key ranges: str/dex/int/con +1..+4; dmg +1..+3; armor +1..+3; spellPower 0.05..0.15; lifeSteal/manaSteal 3..12 (%); critChance 0.02..0.10; critDamage 0.10..0.35; goldFind 0.05..0.20.
- Shield affixes: blockChance 0.05..0.15; blockPower 10..50; shieldMagicResist 5..15.

### Shield bases (`src/game/items.js:101-128`)
- buckler(light): a=3, d=2, bc=0.20, bp=8
- shield(heavy): a=5, d=5, bc=0.20, bp=10 (legacy)
- kite(medium): a=7, d=3, bc=0.30, bp=18
- tower(heavy): a=12, d=4, bc=0.40, bp=32
- aegis(heavy): a=18, d=6, bc=0.50, bp=55

### Tap weapons/utilities (`src/game/tapWeapons.js:223-268`)
- See audit §3 tables. Ranges [power_min..power_max], cooldowns 0..10, targeting single/aoe/chain/line.
- Key: Blade [8..14] CD 0 (baseline); Bow [25..40] CD 2; Fireball [30..45] CD 3; Heal [50,50] CD 4; Phoenix Feather revive@30%HP CD 10.

### Enemy stats (`src/maps/mapData.js`)
- Per-enemy: hp, dmg [min,max], armor, hit, dodge, xp, gold [min,max]
- Act 1 sample: goblin hp=8 dmg=[2,5] armor=0 xp=15 gold=[2,6]
- Large table — extract wholesale, not individually.

### Skills (`src/game/skills.js`)
- 21 classes × ~4 skills. Each has `damageMult`, `mpCost`, `cooldown`, target, effect.
- Ranges: dmgMult 0.5..4.0; mpCost 0..35; cd 0..12 rounds.

### Passives (`src/game/passives.js`)
- Passive tree per class. Bonuses add to `passive.*` fields (maxHp, maxMp, critBonus, etc.).

## 4. UI armor display surfaces (catalog for M3 DR% display)

| File | Line | Context |
|------|------|---------|
| `src/ui/screens/InventoryScreen.js` | 97 | Core stat row — `+{armor} arm` |
| `src/ui/screens/InventoryScreen.js` | 121 | Item comparison card — `🛡 +{armor}` |
| `src/ui/screens/InventoryScreen.js` | 161 | Character sheet armor calc |
| `src/ui/screens/InventoryScreen.js` | 256 | Character sheet detail panel — Armor stat |
| `src/ui/screens/TownScreen.js` | 604 | Shop item tooltip — `+{armor} armor` |
| `src/ui/screens/TownScreen.js` | 671 | Loot modal item — `+{armor} armor` |
| `src/ui/screens/TownScreen.js` | 699 | Character detail modal — `+{armor} armor` |
| `src/ui/screens/CombatScreen.js` | many | Combat HUD combatant stats |
| `src/ui/screens/FormulaCodexScreen.js` | 410-424 | Formula Codex armor section |
| `src/ui/screens/CombatSimulatorScreen.js` | 536 | Sim result — `ARM {armor}` |
| `src/ui/screens/CombatSimulatorScreen.js` | 700 | Enemy editor input |
| `src/game/items.js` | 430 | Item tooltip builder — `Armor: +{armor}` |

## 5. Save data

- `src/game/gameState.js` — character saves embed `attrs`, `level`, `xp`, `hp`/`mp`/`maxHp`/`maxMp`, `equipment`, `passiveRanks`, `pendingAttrPoints`, `pendingSkillPoints`.
- On load, `maxHp`/`maxMp` are recomputed via `computeMaxHp`/`computeMaxMp`. Armor/damage/hit/dodge are NOT stored — always derived.
- **Balance changes auto-apply on load.** Saves are safe.
- Equipment items carry their own rolled affixes; old items keep old affixes until replaced. Expected behavior.

## 6. Mod system

- `src/mods/registry.js` — pack registry. Kinds: `skills, classes, items, events, appearances, characters, loot`.
- No `balance` kind yet. Adding one is trivial but not needed for M1 — we'll load balance config directly, separate from the pack registry.
- No existing gameplay-balance JSON files in `public/data/` (only art-direction state).

## 7. Extraction strategy (M1 architecture)

**Pragmatic split** — given the breadth (80+ constants, 10+ files), I will extract:

**Tier 1 — in M1 (typed loader, full rewire):**
- Hire costs (BASE_COST, SCALING)
- Stat derivation constants (HP/MP base + multiplier, hit/dodge base + mult, crit base/max/mult, spellPower coeff, manaRegen coeff, dotTick coeff, initiative)
- Damage derivation coeffs (min/max/equip multipliers, spell bonus coeff)
- Armor formula **selector** (`"legacy"` vs `"flat"` vs future `"curve-dr"`) + params — baseline = `"legacy"`
- NG+ multipliers (hpMul base, dmgMul base, boss adders, armorMul, hitBonus, dodgeBonus, xpBonus)
- XP table + cadence (stat points per level, talent-point levels, passive-point levels)
- Loot quality multipliers + rarity affix counts
- **Global tuning knobs (new in M1, baseline = 1.0):** `enemyHpMult`, `enemyDmgMult`, `enemyArmorMult`, `enemyXpMult`, `enemyGoldMult`, `dropRateMult`, `shopPriceMult` — applied by formulas.js at read time. These let M4 tune without rewriting enemy tables.

**Tier 2 — snapshot only, wired opportunistically:**
- Affix ranges (extract to JSON wholesale; items.js reads per-act tables from config)
- Shield base stats (small table, extract)
- Tap weapon/utility power + cooldown ranges (extract to JSON)

**Tier 3 — NOT extracted in M1 (captured in baseline snapshot only, as reference):**
- Full enemy table (`mapData.js`) — tuned via Tier 1 global multipliers in M4
- Skill definitions (`skills.js`) — class-level tuning is out of scope for M4 target; keep in code

Rationale: The user's target (solo impossible past Act 3, 3+ needed for final boss) is reachable by tuning global multipliers + a few levers (hire costs, crit, armor formula, tap power). Extracting every skill or every enemy line-by-line would burn the overnight budget without moving the balance needle further.

## 8. Open items / blockers (none)

- Armor ambiguity: baseline = legacy. Resolved by flagging both in config and setting `"activeFormula": "legacy"`.
- Mod registry not extended for balance: out of scope — we load `balance.active.json` directly.
- No existing balance-derived save state to migrate: safe.

## 9. M2 prerequisites (from audit)

- `src/game/simulator.js` works headlessly — good.
- `src/game/formulas.js` uses only pure JS + `crypto.randomUUID` (polyfill needed for Node <19).
- Loot uses `makeRng(seed)` in `src/mods/loot.js` — compatible.
- No DOM/browser imports in combat graph. ✅

Ready to proceed to extraction.
