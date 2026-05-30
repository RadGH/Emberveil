/**
 * dataLoader.js — Phase 1, canonical-data migration (M496+)
 *
 * Loads canonical JSON from public/data/ and resolves {ref,count,overrides}
 * encounter entries into fully-flattened group objects byte-identical to the
 * legacy `{...ENEMIES.x, count}` literals in src/maps/mapData.js.
 *
 * The {ref,count,overrides} resolution contract is IDENTICAL to:
 *   - scripts/extract-canonical-data.mjs  (applyOverride)
 *   - scripts/verify-canonical-parity.mjs (resolveCanonGroup)
 *   - game13/memory/canonical-data-migration-plan.md
 * Never change one without changing all three.
 *
 * Feature flag: USE_CANONICAL_DATA
 *   - Default: true (canonical path active)
 *   - Override via localStorage key 'USE_CANONICAL_DATA' = '0' to disable
 *     (browser only; ignored in Node since combat is stateless in tests)
 *   - Override via window.__USE_CANONICAL_DATA = false before module loads
 *   - In Node scripts: use process.env.USE_CANONICAL_DATA = '0'
 *
 * Circular-import safety: this module imports ONLY static JSON files and
 * uses no imports from src/maps/mapData.js or any game module. It is safe
 * to import from mapData.js without creating a cycle.
 *
 * ENEMIES* sub-dict reconstruction:
 *   The canonical enemies.json merges all four ENEMIES* dicts. Sub-dict
 *   membership is reconstructed using the stable ID sets below (derived from
 *   mapData.js and verified against the canonical JSON at extraction time).
 *   These sets are authoritative for Phase 1; Phase 2+ will add a `dict`
 *   field to the schema to make this self-describing.
 */

// ── Static JSON imports (Vite bundles these; Node 22 supports import assertions) ──
import enemiesDoc  from '../../public/data/entities/enemies.json'  with { type: 'json' };
import bossesDoc   from '../../public/data/entities/bosses.json'   with { type: 'json' };
import encountersDoc from '../../public/data/combat/encounters.json' with { type: 'json' };
import dropTablesDoc from '../../public/data/combat/drop-tables.json' with { type: 'json' };
import bossPhasesDoc from '../../public/data/combat/boss-phases.json' with { type: 'json' };
import companionsDoc from '../../public/data/entities/companions.json' with { type: 'json' };
import heroesDoc from '../../public/data/entities/heroes.json' with { type: 'json' };
import npcsDoc from '../../public/data/entities/npcs.json' with { type: 'json' };
import skillsDoc from '../../public/data/combat/skills.json' with { type: 'json' };
import itemsDoc from '../../public/data/items.json' with { type: 'json' };
import uniquesDoc from '../../public/data/uniques.json' with { type: 'json' };

// ── Feature flag ─────────────────────────────────────────────────────────────
// Step 5 note: legacy literals have been deleted from mapData.js. The flag
// is kept for auditability and the verify-runtime-parity gate, but setting
// it false no longer falls back to literals (they're gone). The git tag
// `pre-canonical-migration` is the authoritative rollback point.

function resolveFlag() {
  // Node: environment variable
  if (typeof process !== 'undefined' && process.env && process.env.USE_CANONICAL_DATA === '0') return false;
  // Browser: window override (must be set before module loads)
  if (typeof window !== 'undefined' && window.__USE_CANONICAL_DATA === false) return false;
  // Browser: localStorage override
  if (typeof localStorage !== 'undefined') {
    const v = localStorage.getItem('USE_CANONICAL_DATA');
    if (v === '0' || v === 'false') return false;
  }
  return true; // default ON
}

export const USE_CANONICAL_DATA = resolveFlag();

// ── Delete-marker contract ───────────────────────────────────────────────────
// The DELETE_MARKER (null) signals that an inline encounter variant OMITS a
// key its shared-id base entity defines. A JS spread cannot remove a key, so
// the canonical override carries an explicit null; resolving it removes that
// key to produce a byte-exact match for the legacy literal.
//
// Verified: no combatant field is ever literally null in legacy mapData, so
// null is unambiguous as a delete-marker.
//
// CONTRACT (4 steps — must stay in lockstep with extract + verify scripts):
//   1. base   = enemies[ref] ?? bosses[ref]
//   2. merged = { ...base, ...overrides }     (top-level value replace)
//   3. Delete every key in overrides whose value === null (DELETE_MARKER)
//   4. group  = { ...merged, count }          (count on the group object)
const DELETE_MARKER = null;

/**
 * Resolve one {ref, count, overrides?} canonical entry into the flat group
 * object the game runtime consumes — byte-identical to the legacy
 * `{ ...ENEMIES.someEnemy, count }` spread.
 *
 * @param {object} entry       - canonical encounter enemy entry
 * @param {object} enemiesById - enemies.json entities dict
 * @param {object} bossesById  - bosses.json entities dict
 * @param {string} encKey      - encounter key (for error messages)
 * @param {number} idx         - enemy group index (for error messages)
 * @returns {object}           - fully resolved group object
 */
function resolveGroup(entry, enemiesById, bossesById, encKey, idx) {
  const ref = entry.ref;
  // Step 1: base = enemies[ref] ?? bosses[ref]
  const base = enemiesById[ref] ?? bossesById[ref];
  if (!base) {
    throw new Error(
      `dataLoader: encounter "${encKey}" enemy[${idx}] ref "${ref}" ` +
      `not found in enemies.json or bosses.json`
    );
  }
  // Step 2: merged = { ...base, ...overrides }
  const ov = entry.overrides || {};
  const merged = { ...base, ...ov };
  // Step 3: delete every key whose override value === DELETE_MARKER (null)
  for (const k of Object.keys(ov)) {
    if (ov[k] === DELETE_MARKER) delete merged[k];
  }
  // Step 4: attach count
  merged.count = entry.count;
  return merged;
}

// ── Build canonical maps ─────────────────────────────────────────────────────

const _enemiesById = enemiesDoc.entities || enemiesDoc;
const _bossesById  = bossesDoc.entities  || bossesDoc;
const _encMap      = encountersDoc.encounters || encountersDoc;

/**
 * Resolve all encounters (regular + hidden) into legacy-shaped encounter
 * objects: { name, introText?, bossLoot?, enemies: [{...statBlock, count}] }
 *
 * @param {boolean} hiddenOnly - if true, only emit hidden:true encounters
 * @param {boolean} regularOnly - if true, only emit hidden:false encounters
 */
function buildEncounterMap(hiddenOnly, regularOnly) {
  const out = {};
  for (const [key, enc] of Object.entries(_encMap)) {
    const isHidden = !!enc.hidden;
    if (hiddenOnly  && !isHidden) continue;
    if (regularOnly &&  isHidden) continue;

    const resolved = { name: enc.name };
    if (enc.introText != null) resolved.introText = enc.introText;
    // bossLootRef in canonical JSON → bossLoot on the legacy encounter object
    if (enc.bossLootRef != null) resolved.bossLoot = enc.bossLootRef;

    resolved.enemies = (enc.enemies || []).map((entry, i) =>
      resolveGroup(entry, _enemiesById, _bossesById, key, i)
    );
    out[key] = resolved;
  }
  return out;
}

// Regular encounters (hidden:false or absent)
export const ENCOUNTERS_CANONICAL = buildEncounterMap(false, true);
// Hidden boss encounters (hidden:true)
export const HIDDEN_BOSS_ENCOUNTERS_CANONICAL = buildEncounterMap(true, false);

// ── ENEMIES* sub-dict reconstruction ────────────────────────────────────────
// Stable ID sets per legacy dict (extracted from mapData.js; disjoint across
// all four dicts). Authoritative for Phase 1.
const ENEMIES_ACT1_IDS = new Set([
  'goblin_scout', 'goblin_warrior', 'goblin_shaman', 'goblin_warlord',
  'corrupted_wolf', 'corrupted_bear', 'bandit', 'bandit_captain',
  'imp', 'hell_knight', 'void_shade', 'demon_brute', 'archfiend_malgrath',
  'emberveil_sovereign', 'ash_wraith', 'cinder_hound', 'molten_golem',
  'veil_cultist', 'veil_sorcerer', 'lava_titan', 'grax_veil_touched',
  'veil_warden', 'veilspawn_herald',
]);
const ENEMIES_ACT4_IDS = new Set([
  'void_wraith', 'star_horror', 'cosmic_titan', 'void_prophet', 'the_unraveler',
]);
const ENEMIES_ACT5_IDS = new Set([
  'primordial_elemental', 'abyssal_knight', 'reality_shard', 'genesis_worm',
  'the_architect',
]);
const ENEMIES_ACT6_IDS = new Set([
  'dragon_whelp', 'wyrm_warrior', 'dragon_cultist', 'frost_wyrm',
  'storm_dragon', 'ancient_dragon', 'dragon_king',
]);

function buildEnemiesSubDict(idSet) {
  const out = {};
  for (const id of idSet) {
    const entity = _enemiesById[id] ?? _bossesById[id];
    if (entity) out[id] = entity;
    // Inline-only entities (e.g. giant_spider) may not be in the base dicts;
    // they are synthesized from encounter literals and live in enemies.json.
  }
  return out;
}

// ENEMIES_CANONICAL mirrors the legacy ENEMIES dict (Acts 1-3 only).
// Inline-only entities like giant_spider are NOT included — they were never
// in the legacy ENEMIES dict; they live only in the encounter literals and
// are accessed through ENCOUNTERS (where they're fully resolved with count).
export const ENEMIES_CANONICAL        = buildEnemiesSubDict(ENEMIES_ACT1_IDS);
export const ENEMIES_ACT4_CANONICAL   = buildEnemiesSubDict(ENEMIES_ACT4_IDS);
export const ENEMIES_ACT5_CANONICAL   = buildEnemiesSubDict(ENEMIES_ACT5_IDS);
export const ENEMIES_ACT6_CANONICAL   = buildEnemiesSubDict(ENEMIES_ACT6_IDS);

// ── Phase 2 step 6: drop tables (BOSS_LOOT_TABLES + BOSS_TAP_DROPS) ──────────
// Canonical source: public/data/combat/drop-tables.json
//   { version, source, tapDrops:{zone:itemId}, bossLoot:{bossId:{...table}} }
// These resolve to objects deep-equal to the legacy literals that previously
// lived in src/game/bossLoot.js (BOSS_LOOT_TABLES) and src/maps/mapData.js
// (BOSS_TAP_DROPS). No {ref,count,overrides} expansion applies here — drop
// tables are flat data, so the canonical objects ARE the resolved objects.
// All JSON loading stays centralized in dataLoader.js (no scattered imports).
export const BOSS_LOOT_TABLES = dropTablesDoc.bossLoot || {};
export const BOSS_TAP_DROPS   = dropTablesDoc.tapDrops || {};

/**
 * getDropTables — accessor for the full canonical drop-tables document.
 * @returns {{version:number, source:string, tapDrops:object, bossLoot:object}}
 */
export function getDropTables() {
  return dropTablesDoc;
}

// ── Phase 2 step 7: boss phases (BOSS_PHASES + BOSS_DEATH_DIALOG) ────────────
// Canonical source: public/data/combat/boss-phases.json
//   { version, source, phases:{bossId:{phases:[...]}}, deathDialog:{bossId:{...}} }
// These resolve to objects deep-equal (value-identical) to the legacy literals
// that previously lived in src/game/bossPhases.js (BOSS_PHASES) and
// src/game/bossDeathDialog.js (BOSS_DEATH_DIALOG). No {ref,count,overrides}
// expansion applies — boss-phase config is flat data, so the canonical objects
// ARE the resolved objects. The phases[] array order (descending hpThreshold)
// is load-bearing and preserved verbatim by the extraction; only object key
// insertion order differs (alphabetized in JSON), which no consumer depends on
// (all access is by named property / by enemy id). All JSON loading stays
// centralized here (no scattered imports in bossPhases.js / bossDeathDialog.js).
export const BOSS_PHASES_CANONICAL       = bossPhasesDoc.phases      || {};
export const BOSS_DEATH_DIALOG_CANONICAL = bossPhasesDoc.deathDialog || {};

/**
 * getBossPhases — accessor for the canonical BOSS_PHASES map (keyed by enemy id).
 * @returns {object} { bossId: { phases: [...] } }
 */
export function getBossPhases() {
  return BOSS_PHASES_CANONICAL;
}

/**
 * getBossDeathDialog — accessor for the canonical BOSS_DEATH_DIALOG map.
 * @returns {object} { bossId: { bossLine, heroLine, narratorLine } }
 */
export function getBossDeathDialog() {
  return BOSS_DEATH_DIALOG_CANONICAL;
}

// ── Phase 2 step 8: companions (CLASS_PETS + COMPANION_POWER + tavern lists) ──
// Canonical source: public/data/entities/companions.json
//   { version, source, classPets:{petId:{...}}, companionPower:{id:tier},
//     companions:[...], hires:[...] }
// These resolve to objects deep-equal (value-identical) to the legacy literals
// that previously lived in src/game/companions.js (CLASS_PETS, COMPANION_POWER)
// and src/ui/screens/TownScreen.js (HIREABLES_ACT1, COMPANIONS_ACT1). No
// {ref,count,overrides} expansion applies — companion config is flat data, so
// the canonical objects ARE the resolved objects. Key/array order is not
// load-bearing: CLASS_PETS / COMPANION_POWER are accessed by id; HIREABLES_ACT1
// / COMPANIONS_ACT1 are searched by `.find(x => x.id === …)` and filtered, never
// index-addressed. SAVE-COMPAT: ids are preserved verbatim from the legacy
// literals (a renamed/dropped companion templateId would orphan a saved
// companion). All JSON loading stays centralized here — companions.js and
// TownScreen.js import these named exports rather than re-declaring literals.
export const CLASS_PETS_CANONICAL      = companionsDoc.classPets      || {};
export const COMPANION_POWER_CANONICAL = companionsDoc.companionPower  || {};
export const HIREABLES_ACT1_CANONICAL  = companionsDoc.hires           || [];
export const COMPANIONS_ACT1_CANONICAL = companionsDoc.companions      || [];

/**
 * getCompanionsDoc — accessor for the full canonical companions document.
 * @returns {{version:number, source:string, classPets:object, companionPower:object, companions:Array, hires:Array}}
 */
export function getCompanionsDoc() {
  return companionsDoc;
}

// ── Phase 2 step 9: appearances (heroes.json + npcs.json) ────────────────────
// Canonical source: public/data/entities/heroes.json (62 playable appearances)
//   + public/data/entities/npcs.json (22 playable:false NPC/enemy appearances).
// These resolve to objects deep-equal (value-identical) to the legacy
// APPEARANCES literal that previously lived in src/game/appearances.js. No
// {ref,count,overrides} expansion applies — appearance config is flat data, so
// the canonical objects ARE the resolved objects.
//
// SAVE-COMPAT CRITICAL: saved heroes embed an `appearance` id. Every legacy id
// is preserved verbatim across heroes.json ∪ npcs.json (verified by
// scripts/verify-appearances-parity.mjs). A renamed/dropped id would orphan a
// saved hero's sprite.
//
// Field-shape note: the canonical JSON alphabetizes object keys and only emits
// the optional flags (`playable`, `npc`, `deprecated`, `pendingReview`) when
// truthy — exactly mirroring the legacy literal, where those flags were also
// only present on the relevant entries.
//
// Order note: the legacy APPEARANCES *array order* is load-bearing for the
// character/hire picker and the asset-gallery surfaces (they iterate the array
// in order). The canonical split (heroes.json = 62 playable, npcs.json = 22
// playable:false) does NOT preserve that order because the legacy literal
// interleaves one NPC (`cleric_priestess`) at index 7 amid the playable
// classes, with the rest of the NPCs trailing at the end. So the legacy
// sequence is reconstructed from the explicit ordered id manifest below
// (`_APPEARANCE_ORDER`). The manifest contains ONLY ids that already exist in
// heroes.json ∪ npcs.json — it introduces no new data, only the original
// presentation order. Verified id-for-id against the pre-deletion literal by
// scripts/verify-appearances-parity.mjs (Gate 1 + Gate 2). All JSON loading
// stays centralized here — appearances.js imports the named export below
// rather than re-declaring the literal.
const _heroEntities = heroesDoc.entities || heroesDoc;
const _npcEntities  = npcsDoc.entities   || npcsDoc;

// Legacy presentation order (frozen snapshot of the pre-deletion APPEARANCES
// literal's id sequence). Every id here MUST resolve in the merged hero+npc
// map; the parity gate fails loudly otherwise.
const _APPEARANCE_ORDER = [
  'warrior','fighter','paladin','ranger','rogue','mage','cleric','cleric_priestess',
  'bard','druid','necromancer','warlock','demon_hunter','dragon_knight','pyromancer',
  'stormcaller','oracle','oracle_old','swashbuckler','scavenger','tactician',
  'chronomancer','monk','knight','sorcerer','shaman','witch_hunter','runesmith',
  'shadow_dancer','tinker','tinker_female','clockwork_turret','bard_female',
  'chronomancer_female','cleric_male','demon_hunter_female','dragon_knight_male',
  'druid_male','fighter_female','knight_male','mage_female','monk_female',
  'necromancer_female','oracle_male','paladin_female','pyromancer_male','ranger_male',
  'rogue_male','runesmith_female','scavenger_female','shadow_dancer_male','shaman_male',
  'sorcerer_female','stormcaller_female','swashbuckler_female','tactician_female',
  'warlock_male','warrior_female','witch_hunter_female','enchanter_male','priest_female',
  'enchanter_female','priest_male','silas_veilward','kaela_thorne','marek_greel',
  'mira_seer','iris_vael','garrick_ostmere','mother_yssira','tomek_halverin',
  'krix_bonechewer','halden_man_at_arms','sister_veya','bulwark_dorn','kessa_quill',
  'magnus_orre','giant_spider','the_unraveler','dragon_king','vault_guardian',
  'void_scholar','echo_sovereign','the_first_ember',
];

// Re-key each entry into the legacy literal's field order so downstream
// consumers (and the parity gate's structural compare) see byte-identical
// objects. Missing optional flags are simply absent (not set to false/undefined),
// matching the legacy literal exactly.
function _shapeAppearance(e) {
  const out = {
    id: e.id,
    name: e.name,
    classDefault: e.classDefault,
    sprite: e.sprite,
    gender: e.gender,
    tags: e.tags,
  };
  if (e.playable === false) out.playable = false;
  if (e.npc === true)       out.npc = true;
  if (e.deprecated === true)    out.deprecated = true;
  if (e.pendingReview === true) out.pendingReview = true;
  return out;
}

const _appearanceById = new Map();
for (const e of _heroEntities) _appearanceById.set(e.id, e);
for (const e of _npcEntities)  _appearanceById.set(e.id, e);

export const APPEARANCES_CANONICAL = _APPEARANCE_ORDER.map((id) => {
  const e = _appearanceById.get(id);
  if (!e) {
    throw new Error(
      `dataLoader: appearance order id "${id}" not found in heroes.json ` +
      `or npcs.json — SAVE-COMPAT BLOCKER (a saved hero with this ` +
      `appearance would orphan its sprite)`
    );
  }
  return _shapeAppearance(e);
});

/**
 * getAppearancesDoc — accessor for the raw canonical hero + npc documents.
 * @returns {{heroes:Array, npcs:Array}}
 */
export function getAppearancesDoc() {
  return { heroes: _heroEntities, npcs: _npcEntities };
}

// ── Phase 3 step: skills (SKILLS const) ─────────────────────────────────────
// Canonical source: public/data/combat/skills.json
//   { version, source, skills:{ skillId:{...config} } }
// These resolve to objects deep-equal (value-identical) to the legacy SKILLS
// literal that previously lived in src/game/skills.js (124 skills, 14 classes).
// No {ref,count,overrides} expansion applies — skill config is flat data, so
// the canonical objects ARE the resolved objects. Key/array order is not
// load-bearing: SKILLS is accessed by skill id; talents[]/upgrades[] are
// iterated/filtered, never index-addressed against the literal. All
// per-skill logic (mergeSkillForCast, _mergeInto, lookups) stays in
// skills.js; only the data const moved here. All JSON loading stays
// centralized in dataLoader.js (skills.js imports this named export rather
// than re-declaring the literal).
const _skillsDoc = skillsDoc.skills || skillsDoc;

export const SKILLS_CANONICAL = _skillsDoc;

/**
 * getSkills — accessor for the canonical SKILLS map (keyed by skill id).
 * @returns {object} { skillId: { name, class, unlockLevel, type, ... } }
 */
export function getSkills() {
  return SKILLS_CANONICAL;
}

// ── Canonical-data migration: items (12 pure data consts) + uniques ─────────
// Canonical sources:
//   public/data/items.json   — { version, source, RARITIES, QUALITIES,
//     RARITY_COLORS, WEAPON_BASES, ARMOR_BASES, AFFIXES_ACT1, SHIELD_AFFIXES,
//     ITEM_SETS, ITEM_SCORE_WEIGHTS, MATERIALS, SALVAGE_YIELD, POTIONS }
//   public/data/uniques.json — { version, source, uniques:{ id:{...} } }
// schemas: public/schemas/v1/items.json + public/schemas/v1/uniques.json
//
// These resolve to objects deep-equal (value-identical) to the legacy
// literals that previously lived in src/game/items.js (the 12 pure data
// consts) and src/game/uniques.js (UNIQUES). No {ref,count,overrides}
// expansion applies — item/unique config is flat data, so the canonical
// objects ARE the resolved objects. Key/array order is not load-bearing:
// every const is accessed by key or iterated/filtered, never index-addressed
// against the literal. ALL item/unique LOGIC (generateItem, computeItemScores,
// generateUnique, salvage/craft helpers, getUniquesForAct/Boss) stays in
// items.js / uniques.js — only the data moved here. All JSON loading stays
// centralized in dataLoader.js (items.js / uniques.js import these named
// exports rather than re-declaring the literals). Byte-parity proven by
// scripts/verify-items-parity.mjs.
//
// Derived consts (QUALITY_MULT, RARITY_AFFIX_COUNT, ACCESSORY_AFFIX_BONUS
// from balance-loader; CRAFT_RECIPES via flatMap; POTION_STOCK via spread)
// are NOT migrated — they are computed in items.js, not pure literals.
export const ITEMS_RARITIES_CANONICAL           = itemsDoc.RARITIES;
export const ITEMS_QUALITIES_CANONICAL          = itemsDoc.QUALITIES;
export const ITEMS_RARITY_COLORS_CANONICAL      = itemsDoc.RARITY_COLORS;
export const ITEMS_WEAPON_BASES_CANONICAL       = itemsDoc.WEAPON_BASES;
export const ITEMS_ARMOR_BASES_CANONICAL        = itemsDoc.ARMOR_BASES;
export const ITEMS_AFFIXES_ACT1_CANONICAL       = itemsDoc.AFFIXES_ACT1;
export const ITEMS_SHIELD_AFFIXES_CANONICAL     = itemsDoc.SHIELD_AFFIXES;
export const ITEMS_ITEM_SETS_CANONICAL          = itemsDoc.ITEM_SETS;
export const ITEMS_ITEM_SCORE_WEIGHTS_CANONICAL = itemsDoc.ITEM_SCORE_WEIGHTS;
export const ITEMS_MATERIALS_CANONICAL          = itemsDoc.MATERIALS;
export const ITEMS_SALVAGE_YIELD_CANONICAL      = itemsDoc.SALVAGE_YIELD;
export const ITEMS_POTIONS_CANONICAL            = itemsDoc.POTIONS;
export const UNIQUES_CANONICAL                  = uniquesDoc.uniques || {};

/**
 * getItems — accessor for the full canonical items document.
 * @returns {object} { version, source, RARITIES, QUALITIES, RARITY_COLORS,
 *   WEAPON_BASES, ARMOR_BASES, AFFIXES_ACT1, SHIELD_AFFIXES, ITEM_SETS,
 *   ITEM_SCORE_WEIGHTS, MATERIALS, SALVAGE_YIELD, POTIONS }
 */
export function getItems() {
  return itemsDoc;
}

/**
 * getUniques — accessor for the canonical UNIQUES map (keyed by unique id).
 * @returns {object} { uniqueId: { id, name, slot, baseItemId, act, ... } }
 */
export function getUniques() {
  return UNIQUES_CANONICAL;
}

// ── Phase 3 step: classes + build presets ───────────────────────────────────
// Canonical source: public/data/classes.json + public/data/build-presets.json
//   classes.json       { version, source, classes:[...base literal...], classTags:{} }
//   build-presets.json { version, source, builds:{ classId:[...] } }
//
// These resolve to objects deep-equal (value-identical) to the legacy literals
// that previously lived in src/game/classes.js (the CLASSES *base* literal
// + CLASS_TAGS) and src/game/buildPresets.js (BUILDS). No {ref,count,overrides}
// expansion applies — class/build config is flat data, so the canonical
// objects ARE the resolved objects.
//
// IMPORTANT — CLASSES base vs. exported shape: classes.json holds the CLASSES
// literal BEFORE the two derived keys (`unlockRequirement`, `tags`) that
// classes.js attaches via post-definition loops. That derivation logic stays
// in classes.js and runs on top of CLASSES_CANONICAL; the exported `CLASSES`
// therefore still gains those keys at module load, byte-identical to before.
//
// SAVE-COMPAT CRITICAL: saved heroes embed `member.class` (a class id). Every
// legacy class id is preserved verbatim in classes.json (verified by
// scripts/verify-builds-classes-parity.mjs Gate 2 — the id-set diff). A
// renamed/dropped id would orphan a saved hero's class.
//
// Key/array order is not load-bearing for parity (the gate's deep-equal is
// order-insensitive), but the canonical extraction preserves the original
// array order anyway so the class catalog / picker iteration is unchanged.
// All JSON loading stays centralized here — classes.js / buildPresets.js
// import these named exports rather than re-declaring the literals.
const _classesDataDoc = classesDataDoc;
const _buildsDataDoc  = buildPresetsDataDoc;

export const CLASSES_CANONICAL    = _classesDataDoc.classes   || [];
export const CLASS_TAGS_CANONICAL = _classesDataDoc.classTags || {};
export const BUILDS_CANONICAL     = _buildsDataDoc.builds     || {};

/**
 * getClassesDoc — accessor for the full canonical classes document.
 * @returns {{version:number, source:string, classes:Array, classTags:object}}
 */
export function getClassesDoc() {
  return _classesDataDoc;
}

/**
 * getBuildPresetsDoc — accessor for the full canonical build-presets document.
 * @returns {{version:number, source:string, builds:object}}
 */
export function getBuildPresetsDoc() {
  return _buildsDataDoc;
}

// Static JSON imports (hoisted; kept adjacent to their consumers per the
// append-only convention used throughout this file's migration phases).
import classesDataDoc      from '../../public/data/classes.json'        with { type: 'json' };
import buildPresetsDataDoc from '../../public/data/build-presets.json' with { type: 'json' };

// ── Combat-modifier domain: enemy spells + status meta + affixes ─────────────
// Canonical sources:
//   public/data/combat/enemy-spells.json   { version, source, spells:{ id:{...} } }
//   public/data/combat/status-effects.json { version, source, statusMeta:{ id:{...} } }
//   public/data/combat/affixes.json        { version, source, affixes:{ CONST:[...] } }
// These resolve to objects deep-equal (value-identical) to the legacy literals
// formerly inlined in src/game/enemySpells.js (ENEMY_SPELLS), src/game/
// statusEffects.js (STATUS_META), and src/game/affixes.js (6 M305 affix-pool
// consts). No {ref,count,overrides} expansion applies — all three are flat
// data, so the canonical objects ARE the resolved objects. Key/array order is
// not load-bearing: ENEMY_SPELLS is accessed by spell id (resolveSpells maps
// ids), STATUS_META by status type, and the affix arrays are spread/filtered
// (never index-addressed) by extendAffixPool / affix-coverage. All per-spell
// LOGIC (resolveSpells) stays in enemySpells.js, all status combat logic stays
// in its consumers, and the derived AFFIXES_M305 flat array + extendAffixPool()
// helper stay in affixes.js — only the pure data consts moved here. All JSON
// loading stays centralized in dataLoader.js (the three source modules import
// these named exports rather than re-declaring the literals).
import enemySpellsDoc from '../../public/data/combat/enemy-spells.json' with { type: 'json' };
import statusEffectsDoc from '../../public/data/combat/status-effects.json' with { type: 'json' };
import affixesDoc from '../../public/data/combat/affixes.json' with { type: 'json' };

export const ENEMY_SPELLS_CANONICAL = enemySpellsDoc.spells || enemySpellsDoc;
export const STATUS_META_CANONICAL  = statusEffectsDoc.statusMeta || statusEffectsDoc;

const _affixesById = affixesDoc.affixes || affixesDoc;
export const ELEMENTAL_COMBO_AFFIXES_CANONICAL    = _affixesById.ELEMENTAL_COMBO_AFFIXES    || [];
export const CONDITIONAL_TRIGGER_AFFIXES_CANONICAL = _affixesById.CONDITIONAL_TRIGGER_AFFIXES || [];
export const SET_HELPER_AFFIXES_CANONICAL          = _affixesById.SET_HELPER_AFFIXES          || [];
export const DEFENSIVE_AFFIXES_CANONICAL           = _affixesById.DEFENSIVE_AFFIXES           || [];
export const RESOURCE_AFFIXES_CANONICAL            = _affixesById.RESOURCE_AFFIXES            || [];
export const ADVANCED_STAT_AFFIXES_CANONICAL       = _affixesById.ADVANCED_STAT_AFFIXES       || [];

/**
 * getEnemySpells — accessor for the canonical ENEMY_SPELLS map (keyed by id).
 * @returns {object} { spellId: { id, name, fxKind, cooldown, target, effect, ... } }
 */
export function getEnemySpells() {
  return ENEMY_SPELLS_CANONICAL;
}

/**
 * getStatusMeta — accessor for the canonical STATUS_META map (keyed by status type).
 * @returns {object} { statusType: { glyph, color, name, plain } }
 */
export function getStatusMeta() {
  return STATUS_META_CANONICAL;
}

/**
 * getAffixesDoc — accessor for the full canonical affixes document.
 * @returns {{version:number, source:string, affixes:object}}
 */
export function getAffixesDoc() {
  return affixesDoc;
}
