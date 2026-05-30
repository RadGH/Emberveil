# M444 — Key-form-drift audit

Run via `/tmp/_audit2.mjs` — checks every registry-keyed string reference
in source against its registry. Run again any time data shape changes.

## Total findings: 57 → 4 outstanding (53 fixed, 4 known/intentional)

### ✅ Fixed at the source (8 unique typos, 18 individual occurrences)

| Bad form | Correct form | Found in | Occurrences | Impact |
|---|---|---|---|---|
| `'2h_sword'` | `'sword2h'` | classes.js, buildPresets.js | 9 | Silent null in `_buildLootItem` → prologue Silas gift dropped only XP. **(M443 already shipped a defensive alias map; M444 normalises the source.)** |
| `'2h_axe'` | `'axe2h'` | classes.js, buildPresets.js | 5 | Same as above. |
| `'mace'` | `'iron_mace'` | classes.js (priest), buildPresets.js (druid/wildshape, shaman/spiritcaller, priest/dusk_vigil, cleric/seraph) | 4 | `generateItem('mace', …)` returned null; the `buildLoot:'weapon'` reward path skipped silently for these classes. |
| warrior `class.skills[0] = 'shield_bash'` | `'cleave'` | classes.js | 1 | `CharacterBuilderScreen.js:738` reads `class.skills[0]` to grant the starter skill. Warrior was getting nothing because no skill in SKILLS has id `shield_bash` (the actual knight skill is `knight_shield_bash`). |
| necromancer `class.skills` `'death_coil'` | `'corpse_explosion'` | classes.js | 1 | Same starter-skill path — necromancer's 4th skill was an orphan. |

### ⚠️ Known / intentional (left as-is)

| Form | Where | Reason |
|---|---|---|
| `'unarmed'` | `buildPresets.js: monk/ascetic.weapons` | Monk preset's first preference is intentional — DialogScreen now `SKIP_KEYS` it and falls through to `'staff'`. |
| `'giant_spider'` | `mapData.js: ENCOUNTERS.spider_nest.enemies` | Inline enemy definition (full stat block), not a registry reference. The audit produced a false positive because some encounters use enemy IDs (`enemyId: 'goblin'`) and others define enemies inline. |
| Dungeon stage `type:'skill_check'` (snake_case) | `mapData.js DUNGEONS, DungeonScreen.js` | Distinct from `NODE_TYPES.SKILL_CHECK = 'skillCheck'` (camelCase). Dungeon stages and zone nodes use different type strings; both code paths handle their own form. **Not a bug** but worth flagging. |

### 🔶 Outstanding — 49 orphan skill IDs in `build.preferredSkills[]`

Found across 21 of 30 build presets. These reference skill ids that don't
exist in `SKILLS`. They are **display-only metadata** — used only by the
build picker UI (`CharacterBuilderScreen` shows them as a comma list, no
dispatch). No runtime crash, but they will silently fail any future code
that filters/dispatches by these keys.

Sample (full list reproducible via `node /tmp/_audit2.mjs`):

| Build | Orphan id | Likely intent |
|---|---|---|
| `warrior/berserker`, `warrior/guardian` | `shield_bash` | → `knight_shield_bash`? warrior has no shield-bash variant. |
| `mage/evoker` | `frost_bolt` | (no SKILLS entry) — likely renamed during M236 skill rework. |
| `bard/flair` | `inspiring_song` | → `inspiring_tune` (renamed). |
| `druid/wildshape` | `entangling_roots`, `thorn_strike` | (no entries). |
| `necromancer/lichlord` | `death_coil`, `skeletal_servant`, `soul_drain` | None exist. |
| `warlock/dark_pact` | `curse`, `bound_imp`, `eldritch_blast`, `soul_burn` | None exist. |
| `demon_hunter/bowhunter`, `demon_hunter/channeler` | `spectral_bolt`, `mark_of_doom`, `eye_of_the_hunter` | None exist. |
| `pyromancer/inferno` | `burn_aura` | (no entry). |
| `stormcaller/thunderhead` | `lightning_bolt`, `thunder_strike` | → `chain_lightning`, `thunder_ring`? |
| `oracle/foresight` | `fate_seal`, `oracle_smite` | → `fate_weave`, `smite`? |
| `swashbuckler/duelist` | `flair_strike`, `taunt_flourish` | (no entries). |
| `scavenger/opportunist` | `scavenger_shot`, `dirty_trick` | (no entries). |
| `tactician/commander` | `rally_command`, `tactical_strike`, `volley_order`, `shield_wall` | (none). |
| `chronomancer/temporal` | `arcane_torrent` | → `arcane_surge`. |
| `sorcerer/wild_chaos` | `chaos_blast`, `mana_torrent` | → `chaos_ward`, `mana_burn`? |
| `shaman/spiritcaller` | `lightning_totem`, `spirit_walk` | → `chain_lightning`, `spirit_bolt`? |
| `witch_hunter/inquisitor` | `silver_shot`, `banish`, `mark_of_purity`, `witch_pyre` | → `silver_bolt`, `inquisitor_mark`. |
| `runesmith/forgewright` | `rune_strike`, `rune_ward`, `rune_break`, `forge_call` | → `rune_hammer`, `forge_flame`? |
| `shadow_dancer/umbral` | `shadow_strike`, `shadow_step_sd`, `veil_of_dusk`, `shadow_clone` | → `shadow_step`, `shadow_veil`. |

**Recommendation:** the new Dialog & Encounter Inspector tool exposes the
real skill ids per class. The user can audit each build preset visually
and pick the correct skill ids without me guessing at design intent.
Triaging ~49 entries with possibly-incorrect renames carries higher
regression risk than leaving the cosmetic strings stale.
