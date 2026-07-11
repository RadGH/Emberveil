# Canonical Data Extraction Report (Phase 0)

Generated: 2026-05-18T01:20:52.488Z
Script: `scripts/extract-canonical-data.mjs` — re-runnable, deterministic (sorted keys).
NO behavior change. No runtime/consumer module was modified.

## File counts

- `public/data/entities/enemies.json` — 33
- `public/data/entities/bosses.json` — 12
- `public/data/entities/heroes.json` — 62
- `public/data/entities/npcs.json` — 22
- `public/data/entities/companions.json` — 15 companions, 11 pets, 9 hires, 15 power tiers
- `public/data/combat/encounters.json` — 49
- `public/data/combat/drop-tables.json` — 6 tapDrops, 8 bossLoot
- `public/data/combat/boss-phases.json` — 6 phased bosses, 8 death dialogs

## IDs that required per-encounter `overrides` (HIGHEST RISK — conflict cases)

These are the inline encounter enemies whose resolved stat block differs from
the canonical base entity. Each is preserved byte-identically via an `overrides`
delta in encounters.json — NOT collapsed.

- **veil_high_priest** → `veil_sorcerer` — overridden fields: name, hp, maxHp, dmg, xpValue
  - `name`: base `"Veil Sorcerer"` → encounter `"Veil High Priest"`
  - `hp`: base `440` → encounter `1260`
  - `maxHp`: base `440` → encounter `1260`
  - `dmg`: base `[52,76]` → encounter `[36,56]`
  - `xpValue`: base `78` → encounter `220`
- **void_horde** → `void_wraith` — overridden fields: spellList, spellChance
  - `spellList`: base `undefined` → encounter `["void_silence","wraith_chill"]`
  - `spellChance`: base `undefined` → encounter `0.35`
- **void_horde** → `star_horror` — overridden fields: spellList, spellChance
  - `spellList`: base `undefined` → encounter `["cosmic_rupture","nightmare_hex"]`
  - `spellChance`: base `undefined` → encounter `0.35`
- **cosmic_assault** → `star_horror` — overridden fields: spellList, spellChance
  - `spellList`: base `undefined` → encounter `["cosmic_rupture","nightmare_hex"]`
  - `spellChance`: base `undefined` → encounter `0.35`
- **cosmic_assault** → `cosmic_titan` — overridden fields: spellList, spellChance, blockChance
  - `spellList`: base `undefined` → encounter `["void_lance","brute_slam","cosmic_rupture"]`
  - `spellChance`: base `undefined` → encounter `0.4`
  - `blockChance`: base `undefined` → encounter `0.25`
- **unraveler** → `the_unraveler` — overridden fields: spellList, spellChance, stealableBuffs
  - `spellList`: base `undefined` → encounter `["sovereign_voidstorm","void_silence","nightmare_hex","cosmic_rupture"]`
  - `spellChance`: base `undefined` → encounter `0.5`
  - `stealableBuffs`: base `undefined` → encounter `[]`
- **unraveler** → `void_wraith` — overridden fields: spellList, spellChance
  - `spellList`: base `undefined` → encounter `["void_silence","wraith_chill"]`
  - `spellChance`: base `undefined` → encounter `0.35`
- **dragon_patrol** → `dragon_whelp` — overridden fields: hp, maxHp, dmg, armor, loot, spellList, spellChance, statusOnHit
  - `hp`: base `480` → encounter `1240`
  - `maxHp`: base `480` → encounter `1240`
  - `dmg`: base `[60,104]` → encounter `[80,124]`
  - `armor`: base `14` → encounter `22`
  - `loot`: base `["dragonscale_cloth","dragonfang_dagger"]` → encounter `undefined`
  - `spellList`: base `undefined` → encounter `["imp_fireball","infernal_brand"]`
  - `spellChance`: base `undefined` → encounter `0.3`
  - `statusOnHit`: base `[{"type":"burn","chance":0.5,"duration":3,"power":14}]` → encounter `undefined`
- **dragon_patrol** → `dragon_cultist` — overridden fields: hp, maxHp, dmg, armor, loot, spellList, spellChance, statusOnHit
  - `hp`: base `560` → encounter `1320`
  - `maxHp`: base `560` → encounter `1320`
  - `dmg`: base `[72,116]` → encounter `[84,128]`
  - `armor`: base `8` → encounter `16`
  - `loot`: base `["dragonbone_staff","cloth_chest"]` → encounter `undefined`
  - `spellList`: base `undefined` → encounter `["acolyte_curse","molten_shatter"]`
  - `spellChance`: base `undefined` → encounter `0.4`
  - `statusOnHit`: base `[{"type":"burn","chance":0.6,"duration":3,"power":16}]` → encounter `undefined`
- **wyrm_citadel** → `wyrm_warrior` — overridden fields: hp, maxHp, dmg, armor, loot, spellList, spellChance, statusOnHit, blockChance
  - `hp`: base `720` → encounter `1840`
  - `maxHp`: base `720` → encounter `1840`
  - `dmg`: base `[80,128]` → encounter `[104,152]`
  - `armor`: base `22` → encounter `32`
  - `loot`: base `["dragonsteel_chest","wyrmscale_helm"]` → encounter `undefined`
  - `spellList`: base `undefined` → encounter `["demon_disarm"]`
  - `spellChance`: base `undefined` → encounter `0.25`
  - `statusOnHit`: base `[{"type":"bleed","chance":0.4,"duration":3,"power":12}]` → encounter `undefined`
  - `blockChance`: base `undefined` → encounter `0.25`
- **wyrm_citadel** → `dragon_whelp` — overridden fields: hp, maxHp, dmg, armor, loot, spellList, spellChance, statusOnHit
  - `hp`: base `480` → encounter `1240`
  - `maxHp`: base `480` → encounter `1240`
  - `dmg`: base `[60,104]` → encounter `[80,124]`
  - `armor`: base `14` → encounter `22`
  - `loot`: base `["dragonscale_cloth","dragonfang_dagger"]` → encounter `undefined`
  - `spellList`: base `undefined` → encounter `["imp_fireball","infernal_brand"]`
  - `spellChance`: base `undefined` → encounter `0.3`
  - `statusOnHit`: base `[{"type":"burn","chance":0.5,"duration":3,"power":14}]` → encounter `undefined`
- **frost_wyrm_pack** → `frost_wyrm` — overridden fields: hp, maxHp, dmg, armor, loot, spellList, spellChance, statusOnHit
  - `hp`: base `880` → encounter `2240`
  - `maxHp`: base `880` → encounter `2240`
  - `dmg`: base `[84,140]` → encounter `[104,160]`
  - `armor`: base `18` → encounter `28`
  - `loot`: base `["wyrmscale_chest","dragontooth_amulet"]` → encounter `undefined`
  - `spellList`: base `undefined` → encounter `["frost_lance","wraith_chill","ash_blind"]`
  - `spellChance`: base `undefined` → encounter `0.4`
  - `statusOnHit`: base `[{"type":"stun","chance":0.3,"duration":1}]` → encounter `undefined`
- **frost_wyrm_pack** → `wyrm_warrior` — overridden fields: hp, maxHp, dmg, armor, loot, spellList, spellChance, statusOnHit, blockChance
  - `hp`: base `720` → encounter `1840`
  - `maxHp`: base `720` → encounter `1840`
  - `dmg`: base `[80,128]` → encounter `[104,152]`
  - `armor`: base `22` → encounter `32`
  - `loot`: base `["dragonsteel_chest","wyrmscale_helm"]` → encounter `undefined`
  - `spellList`: base `undefined` → encounter `["demon_disarm"]`
  - `spellChance`: base `undefined` → encounter `0.25`
  - `statusOnHit`: base `[{"type":"bleed","chance":0.4,"duration":3,"power":12}]` → encounter `undefined`
  - `blockChance`: base `undefined` → encounter `0.25`
- **storm_dragon_nest** → `storm_dragon` — overridden fields: hp, maxHp, dmg, armor, loot, spellList, spellChance, statusOnHit
  - `hp`: base `1040` → encounter `2560`
  - `maxHp`: base `1040` → encounter `2560`
  - `dmg`: base `[96,156]` → encounter `[116,176]`
  - `armor`: base `16` → encounter `26`
  - `loot`: base `["dragonheart_ring","dragonscale_cloth"]` → encounter `undefined`
  - `spellList`: base `undefined` → encounter `["brute_slam","molten_shatter","ash_blind"]`
  - `spellChance`: base `undefined` → encounter `0.4`
  - `statusOnHit`: base `[{"type":"stun","chance":0.25,"duration":1},{"type":"burn","chance":0.4,"duration":2,"power":10}]` → encounter `undefined`
- **storm_dragon_nest** → `dragon_cultist` — overridden fields: hp, maxHp, dmg, armor, loot, spellList, spellChance, statusOnHit
  - `hp`: base `560` → encounter `1320`
  - `maxHp`: base `560` → encounter `1320`
  - `dmg`: base `[72,116]` → encounter `[84,128]`
  - `armor`: base `8` → encounter `16`
  - `loot`: base `["dragonbone_staff","cloth_chest"]` → encounter `undefined`
  - `spellList`: base `undefined` → encounter `["acolyte_curse","molten_shatter"]`
  - `spellChance`: base `undefined` → encounter `0.4`
  - `statusOnHit`: base `[{"type":"burn","chance":0.6,"duration":3,"power":16}]` → encounter `undefined`
- **dragon_elite** → `wyrm_warrior` — overridden fields: hp, maxHp, dmg, armor, loot, spellList, spellChance, statusOnHit, blockChance
  - `hp`: base `720` → encounter `1840`
  - `maxHp`: base `720` → encounter `1840`
  - `dmg`: base `[80,128]` → encounter `[104,152]`
  - `armor`: base `22` → encounter `32`
  - `loot`: base `["dragonsteel_chest","wyrmscale_helm"]` → encounter `undefined`
  - `spellList`: base `undefined` → encounter `["demon_disarm"]`
  - `spellChance`: base `undefined` → encounter `0.25`
  - `statusOnHit`: base `[{"type":"bleed","chance":0.4,"duration":3,"power":12}]` → encounter `undefined`
  - `blockChance`: base `undefined` → encounter `0.25`
- **dragon_elite** → `frost_wyrm` — overridden fields: hp, maxHp, dmg, armor, loot, spellList, spellChance, statusOnHit
  - `hp`: base `880` → encounter `2240`
  - `maxHp`: base `880` → encounter `2240`
  - `dmg`: base `[84,140]` → encounter `[104,160]`
  - `armor`: base `18` → encounter `28`
  - `loot`: base `["wyrmscale_chest","dragontooth_amulet"]` → encounter `undefined`
  - `spellList`: base `undefined` → encounter `["frost_lance","wraith_chill","ash_blind"]`
  - `spellChance`: base `undefined` → encounter `0.4`
  - `statusOnHit`: base `[{"type":"stun","chance":0.3,"duration":1}]` → encounter `undefined`
- **dragon_elite** → `storm_dragon` — overridden fields: hp, maxHp, dmg, armor, loot, spellList, spellChance, statusOnHit
  - `hp`: base `1040` → encounter `2560`
  - `maxHp`: base `1040` → encounter `2560`
  - `dmg`: base `[96,156]` → encounter `[116,176]`
  - `armor`: base `16` → encounter `26`
  - `loot`: base `["dragonheart_ring","dragonscale_cloth"]` → encounter `undefined`
  - `spellList`: base `undefined` → encounter `["brute_slam","molten_shatter","ash_blind"]`
  - `spellChance`: base `undefined` → encounter `0.4`
  - `statusOnHit`: base `[{"type":"stun","chance":0.25,"duration":1},{"type":"burn","chance":0.4,"duration":2,"power":10}]` → encounter `undefined`
- **ancient_dragon_fight** → `ancient_dragon` — overridden fields: hp, maxHp, dmg, armor, loot, spellList, spellChance, statusOnHit, blockChance, stealableBuffs
  - `hp`: base `3640` → encounter `8750`
  - `maxHp`: base `3640` → encounter `8750`
  - `dmg`: base `[120,200]` → encounter `[148,228]`
  - `armor`: base `28` → encounter `38`
  - `loot`: base `["dragonsteel_chest","dragonheart_ring","dragonfang_greatsword"]` → encounter `undefined`
  - `spellList`: base `undefined` → encounter `["titan_magma_wave","infernal_brand","nightmare_hex","brute_slam"]`
  - `spellChance`: base `undefined` → encounter `0.5`
  - `statusOnHit`: base `[{"type":"burn","chance":0.7,"duration":3,"power":18},{"type":"bleed","chance":0.4,"duration":3,"power":14}]` → encounter `undefined`
  - `blockChance`: base `undefined` → encounter `0.28`
  - `stealableBuffs`: base `undefined` → encounter `[]`
- **ancient_dragon_fight** → `dragon_whelp` — overridden fields: hp, maxHp, dmg, armor, loot, spellList, spellChance, statusOnHit
  - `hp`: base `480` → encounter `1240`
  - `maxHp`: base `480` → encounter `1240`
  - `dmg`: base `[60,104]` → encounter `[80,124]`
  - `armor`: base `14` → encounter `22`
  - `loot`: base `["dragonscale_cloth","dragonfang_dagger"]` → encounter `undefined`
  - `spellList`: base `undefined` → encounter `["imp_fireball","infernal_brand"]`
  - `spellChance`: base `undefined` → encounter `0.3`
  - `statusOnHit`: base `[{"type":"burn","chance":0.5,"duration":3,"power":14}]` → encounter `undefined`
- **dragon_king_fight** → `dragon_king` — overridden fields: hp, maxHp, dmg, armor, loot, spellList, spellChance, statusOnHit, blockChance, stealableBuffs
  - `hp`: base `8400` → encounter `18900`
  - `maxHp`: base `8400` → encounter `18900`
  - `dmg`: base `[140,240]` → encounter `[172,276]`
  - `armor`: base `34` → encounter `46`
  - `loot`: base `["dragonfang_greatsword","dragonheart_ring","dragonscale_cloth","dragontooth_amulet"]` → encounter `undefined`
  - `spellList`: base `undefined` → encounter `["titan_magma_wave","infernal_brand","molten_shatter","nightmare_hex","demon_disarm"]`
  - `spellChance`: base `undefined` → encounter `0.55`
  - `statusOnHit`: base `[{"type":"burn","chance":0.8,"duration":3,"power":22},{"type":"stun","chance":0.3,"duration":1},{"type":"bleed","chance":0.5,"duration":3,"power":16}]` → encounter `undefined`
  - `blockChance`: base `undefined` → encounter `0.35`
  - `stealableBuffs`: base `undefined` → encounter `[]`
- **dragon_king_fight** → `ancient_dragon` — overridden fields: hp, maxHp, dmg, armor, loot, spellList, spellChance, statusOnHit, blockChance, stealableBuffs
  - `hp`: base `3640` → encounter `8750`
  - `maxHp`: base `3640` → encounter `8750`
  - `dmg`: base `[120,200]` → encounter `[148,228]`
  - `armor`: base `28` → encounter `38`
  - `loot`: base `["dragonsteel_chest","dragonheart_ring","dragonfang_greatsword"]` → encounter `undefined`
  - `spellList`: base `undefined` → encounter `["titan_magma_wave","infernal_brand","nightmare_hex","brute_slam"]`
  - `spellChance`: base `undefined` → encounter `0.5`
  - `statusOnHit`: base `[{"type":"burn","chance":0.7,"duration":3,"power":18},{"type":"bleed","chance":0.4,"duration":3,"power":14}]` → encounter `undefined`
  - `blockChance`: base `undefined` → encounter `0.28`
  - `stealableBuffs`: base `undefined` → encounter `[]`
- **dragon_king_fight** → `wyrm_warrior` — overridden fields: hp, maxHp, dmg, armor, loot, spellList, spellChance, statusOnHit, blockChance
  - `hp`: base `720` → encounter `1840`
  - `maxHp`: base `720` → encounter `1840`
  - `dmg`: base `[80,128]` → encounter `[104,152]`
  - `armor`: base `22` → encounter `32`
  - `loot`: base `["dragonsteel_chest","wyrmscale_helm"]` → encounter `undefined`
  - `spellList`: base `undefined` → encounter `["demon_disarm"]`
  - `spellChance`: base `undefined` → encounter `0.25`
  - `statusOnHit`: base `[{"type":"bleed","chance":0.4,"duration":3,"power":12}]` → encounter `undefined`
  - `blockChance`: base `undefined` → encounter `0.25`
- **big_void_tide** → `void_wraith` — overridden fields: hp, maxHp, dmg, armor, hit, xpValue, gold, spellList, spellChance, statusOnHit
  - `hp`: base `960` → encounter `640`
  - `maxHp`: base `960` → encounter `640`
  - `dmg`: base `[80,124]` → encounter `[56,88]`
  - `armor`: base `17` → encounter `16`
  - `hit`: base `83` → encounter `82`
  - `xpValue`: base `165` → encounter `120`
  - `gold`: base `[28,52]` → encounter `[20,40]`
  - `spellList`: base `undefined` → encounter `["void_silence","wraith_chill"]`
  - `spellChance`: base `undefined` → encounter `0.35`
  - `statusOnHit`: base `{"type":"stun","chance":0.12,"duration":1}` → encounter `undefined`
- **big_void_tide** → `star_horror` — overridden fields: hp, maxHp, dmg, armor, hit, xpValue, gold, spellList, spellChance
  - `hp`: base `1080` → encounter `720`
  - `maxHp`: base `1080` → encounter `720`
  - `dmg`: base `[68,108]` → encounter `[48,76]`
  - `armor`: base `13` → encounter `12`
  - `hit`: base `80` → encounter `78`
  - `xpValue`: base `175` → encounter `130`
  - `gold`: base `[24,46]` → encounter `[18,35]`
  - `spellList`: base `undefined` → encounter `["cosmic_rupture","nightmare_hex"]`
  - `spellChance`: base `undefined` → encounter `0.35`
- **big_dragon_skyfall** → `dragon_whelp` — overridden fields: hp, maxHp, dmg, armor, loot, statusOnHit
  - `hp`: base `480` → encounter `800`
  - `maxHp`: base `480` → encounter `800`
  - `dmg`: base `[60,104]` → encounter `[72,116]`
  - `armor`: base `14` → encounter `22`
  - `loot`: base `["dragonscale_cloth","dragonfang_dagger"]` → encounter `undefined`
  - `statusOnHit`: base `[{"type":"burn","chance":0.5,"duration":3,"power":14}]` → encounter `undefined`
- **big_dragon_skyfall** → `wyrm_warrior` — overridden fields: hp, maxHp, dmg, armor, loot, statusOnHit
  - `hp`: base `720` → encounter `1200`
  - `maxHp`: base `720` → encounter `1200`
  - `dmg`: base `[80,128]` → encounter `[96,144]`
  - `armor`: base `22` → encounter `32`
  - `loot`: base `["dragonsteel_chest","wyrmscale_helm"]` → encounter `undefined`
  - `statusOnHit`: base `[{"type":"bleed","chance":0.4,"duration":3,"power":12}]` → encounter `undefined`
- **big_dragon_skyfall** → `dragon_cultist` — overridden fields: hp, maxHp, dmg, armor, loot, statusOnHit
  - `hp`: base `560` → encounter `880`
  - `maxHp`: base `560` → encounter `880`
  - `dmg`: base `[72,116]` → encounter `[84,128]`
  - `armor`: base `8` → encounter `16`
  - `loot`: base `["dragonbone_staff","cloth_chest"]` → encounter `undefined`
  - `statusOnHit`: base `[{"type":"burn","chance":0.6,"duration":3,"power":16}]` → encounter `undefined`

## Conflicting ids (>1 distinct resolved stat block under one id)

- `veil_sorcerer` — 2 variants; distinct resolved stat blocks across encounters — preserved via per-encounter overrides (NOT collapsed)
- `void_wraith` — 2 variants; distinct resolved stat blocks across encounters — preserved via per-encounter overrides (NOT collapsed)
- `star_horror` — 2 variants; distinct resolved stat blocks across encounters — preserved via per-encounter overrides (NOT collapsed)
- `dragon_whelp` — 2 variants; distinct resolved stat blocks across encounters — preserved via per-encounter overrides (NOT collapsed)
- `dragon_cultist` — 2 variants; distinct resolved stat blocks across encounters — preserved via per-encounter overrides (NOT collapsed)
- `wyrm_warrior` — 2 variants; distinct resolved stat blocks across encounters — preserved via per-encounter overrides (NOT collapsed)

## IDs found in only one place (inline-only, base synthesized)

- `giant_spider` — inline ENCOUNTERS only — no ENEMIES* dict entry; base synthesized from first inline block
- `vault_guardian` — inline ENCOUNTERS only — no ENEMIES* dict entry; base synthesized from first inline block
- `void_scholar` — inline ENCOUNTERS only — no ENEMIES* dict entry; base synthesized from first inline block
- `echo_sovereign` — inline ENCOUNTERS only — no ENEMIES* dict entry; base synthesized from first inline block
- `the_first_ember` — inline ENCOUNTERS only — no ENEMIES* dict entry; base synthesized from first inline block

## Schema fields added after first validation failure

_None — the initial combatant field list (id,name,hp,maxHp,dmg,armor,hit,dodge,xpValue,magicResist,gold,loot,spellList,spellChance,statusOnHit,blockChance,stealableBuffs,isBoss) validated on the first run; it was derived by grepping every enemy source block before authoring the schema._

## Notes

- `statusOnHit` appears in BOTH shapes in the live source: an array of
  status objects (most ENEMIES) and a single bare object (ENEMIES_ACT4/5
  void_wraith / reality_shard / void_prophet). The schema `oneOf` and the
  extractor preserve whichever shape the source used — byte-identical.
- Boss vs enemy split: an entity goes to bosses.json if its id appears in
  BOSS_PHASES / BOSS_LOOT_TABLES / BOSS_DEATH_DIALOG or has isBoss:true;
  everything else is in enemies.json. Every encounter `ref` resolves to
  exactly one of the two files (zero-omission assertion enforced).
- Override application contract (DELETE_MARKER):
  `resolved = { ...base, ...overrides }` then every key whose
  override value is `null` is DELETED. `null` is the delete-marker.
  Authored identically in extract-canonical-data.mjs (applyOverride),
  verify-canonical-parity.mjs (resolveCanonGroup), and
  canonical-data-migration-plan.md. Each encounter enemy is
  reconstructed via applyOverride and deep-compared to the live
  resolved object; the script throws on any mismatch (byte-parity).

### Phase-0 reconciliation: the 39-diff fix (diff classes found)

All 39 original `PARITY FAIL` diffs were ONE class: `extra key in
canon`. ~20 inline dragon/void encounter groups (e.g.
`dragon_patrol/dragon_whelp`, `dragon_king_fight/{dragon_king,
ancient_dragon,wyrm_warrior}`, `big_void_tide/void_wraith`,
`frost_wyrm_pack/*`, `wyrm_citadel/*`, `storm_dragon_nest/*`,
`dragon_elite/*`, `ancient_dragon_fight/*`, `big_dragon_skyfall/*`)
OMIT `loot` and/or `statusOnHit` in their inline literal, while the
shared-id ENEMIES_ACT6 base entity defines them. Ground truth = the
legacy resolved object, which has NO such key.

Root cause: the old `applyOverride` used a "complete override =
verbatim" branch the parity gate did not mirror (gate did pure
`{...base,...overrides}`), so the base loot/statusOnHit leaked back
in on the gate side. Pure spread cannot remove a key.

Fix (no gate weakened): introduced the `null` DELETE_MARKER into the
shared resolution contract — implemented identically in the
extraction (`applyOverride`/`diffBlock`) and the parity gate
(`resolveCanonGroup`), documented in the plan doc, and permitted in
the `combatantOverrides` schema (`oneOf [type, {type:null}]`). The
zero-dependency schema validator was given correct draft-2020-12
`type:"null"` support (it had none — a validator omission). Verified
NO combatant field is ever literally `null` in legacy mapData, so
the marker is unambiguous. Result: `PARITY OK ... 0 diffs`, exit 0;
all 8 canonical files still validate against public/schemas/v1/.

