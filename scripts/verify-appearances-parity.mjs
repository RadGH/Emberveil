#!/usr/bin/env node
/**
 * verify-appearances-parity.mjs — Phase 2 step 9 gate.
 *
 * Proves the JSON-resolved APPEARANCES (heroes.json ∪ npcs.json, via
 * dataLoader.js) is deep-equal and id-set-identical to a snapshot of the
 * legacy inline APPEARANCES literal. SAVE-COMPAT: every legacy appearance id
 * MUST survive verbatim or saved heroes orphan their sprite.
 *
 * Usage: node scripts/verify-appearances-parity.mjs
 * Exit 0 = PARITY OK; exit 1 = blocker.
 *
 * The legacy literal was deleted from src/game/appearances.js once this gate
 * passed; the authoritative snapshot is embedded below (taken pre-deletion,
 * byte-for-byte from git tag pre-canonical-migration era literal).
 */
import { APPEARANCES_CANONICAL, getAppearancesDoc } from '../src/game/dataLoader.js';

// ── Frozen legacy snapshot (the inline literal as it existed before deletion) ─
const LEGACY = [
  { id: 'warrior',          name: 'Warrior',      classDefault: 'warrior',       sprite: 'warrior',          gender: 'male',   tags: ['heavy','male'] },
  { id: 'fighter',          name: 'Fighter',      classDefault: 'fighter',       sprite: 'fighter',          gender: 'male',   tags: ['heavy','male'] },
  { id: 'paladin',          name: 'Paladin',      classDefault: 'paladin',       sprite: 'paladin',          gender: 'male',   tags: ['holy','male'] },
  { id: 'ranger',           name: 'Ranger',       classDefault: 'ranger',        sprite: 'ranger',           gender: 'female', tags: ['light','female'] },
  { id: 'rogue',            name: 'Rogue',        classDefault: 'rogue',         sprite: 'rogue',            gender: 'female', tags: ['light','stealth'] },
  { id: 'mage',             name: 'Mage',         classDefault: 'mage',          sprite: 'mage',             gender: 'male',   tags: ['robes','male'] },
  { id: 'cleric',           name: 'Cleric',       classDefault: 'cleric',        sprite: 'cleric',           gender: 'female', tags: ['robes','holy'] },
  { id: 'cleric_priestess', name: 'Cleric (Priestess)', classDefault: 'cleric', sprite: 'cleric_priestess', gender: 'female', tags: ['robes','holy','female','npc'], playable: false, npc: true },
  { id: 'bard',             name: 'Bard',         classDefault: 'bard',          sprite: 'bard',             gender: 'male',   tags: ['light'] },
  { id: 'druid',            name: 'Druid',        classDefault: 'druid',         sprite: 'druid',            gender: 'female', tags: ['nature'] },
  { id: 'necromancer',      name: 'Necromancer',  classDefault: 'necromancer',   sprite: 'necromancer',      gender: 'male',   tags: ['dark','robes'] },
  { id: 'warlock',          name: 'Warlock',      classDefault: 'warlock',       sprite: 'warlock',          gender: 'female', tags: ['dark','robes'] },
  { id: 'demon_hunter',     name: 'Demon Hunter', classDefault: 'demon_hunter',  sprite: 'demon_hunter',     gender: 'male',   tags: ['light','female'] },
  { id: 'dragon_knight',    name: 'Dragon Knight',classDefault: 'dragon_knight', sprite: 'dragon_knight',    gender: 'female', tags: ['heavy','draconic'] },
  { id: 'pyromancer',       name: 'Pyromancer',   classDefault: 'pyromancer',    sprite: 'pyromancer',       gender: 'female', tags: ['fire','robes'] },
  { id: 'stormcaller',      name: 'Stormcaller',  classDefault: 'stormcaller',   sprite: 'stormcaller',      gender: 'male',   tags: ['storm','robes'] },
  { id: 'oracle',           name: 'Oracle',       classDefault: 'oracle',        sprite: 'oracle',           gender: 'female', tags: ['prophetic','robes'] },
  { id: 'oracle_old',       name: 'Oracle (Classic)', classDefault: 'oracle',    sprite: 'oracle_old',       gender: 'female', tags: ['prophetic','robes','deprecated'], deprecated: true },
  { id: 'swashbuckler',     name: 'Swashbuckler', classDefault: 'swashbuckler',  sprite: 'swashbuckler',     gender: 'male',   tags: ['light','flair'] },
  { id: 'scavenger',        name: 'Scavenger',    classDefault: 'scavenger',     sprite: 'scavenger',        gender: 'male',   tags: ['light','ragtag'] },
  { id: 'tactician',        name: 'Tactician',    classDefault: 'tactician',     sprite: 'tactician',        gender: 'male',   tags: ['medium','leader'] },
  { id: 'chronomancer',     name: 'Chronomancer', classDefault: 'chronomancer',  sprite: 'chronomancer',     gender: 'male',   tags: ['arcane','robes'] },
  { id: 'monk',             name: 'Monk',         classDefault: 'monk',          sprite: 'monk',             gender: 'male',   tags: ['light','martial'] },
  { id: 'knight',           name: 'Knight',       classDefault: 'knight',        sprite: 'knight',           gender: 'female', tags: ['heavy','male'] },
  { id: 'sorcerer',         name: 'Sorcerer',     classDefault: 'sorcerer',      sprite: 'sorcerer',         gender: 'male',   tags: ['arcane','robes','male'] },
  { id: 'shaman',           name: 'Shaman',       classDefault: 'shaman',        sprite: 'shaman',           gender: 'female', tags: ['nature','tribal'] },
  { id: 'witch_hunter',     name: 'Witch Hunter', classDefault: 'witch_hunter',  sprite: 'witch_hunter',     gender: 'male',   tags: ['dark','light','male'] },
  { id: 'runesmith',        name: 'Runesmith',    classDefault: 'runesmith',     sprite: 'runesmith',        gender: 'male',   tags: ['heavy','craft'] },
  { id: 'shadow_dancer',    name: 'Shadow Dancer',classDefault: 'shadow_dancer', sprite: 'shadow_dancer',    gender: 'female', tags: ['light','stealth','dark'] },
  { id: 'tinker',           name: 'Tinker',        classDefault: 'tinker',       sprite: 'tinker',           gender: 'male',   tags: ['medium','clockwork'] },
  { id: 'tinker_female',    name: 'Tinker (Female)', classDefault: 'tinker',     sprite: 'tinker_female',    gender: 'female', tags: ['female','variant','clockwork'] },
  { id: 'clockwork_turret', name: 'Clockwork Turret', classDefault: 'companion', sprite: 'clockwork_turret', gender: 'companion', tags: ['companion','clockwork','construct'] },
  { id: 'bard_female',          name: 'Bard (Female)',          classDefault: 'bard',          sprite: 'bard_female',          gender: 'female', tags: ['female','variant'] },
  { id: 'chronomancer_female',  name: 'Chronomancer (Female)',  classDefault: 'chronomancer',  sprite: 'chronomancer_female',  gender: 'female', tags: ['female','variant'] },
  { id: 'cleric_male',          name: 'Cleric (Male)',          classDefault: 'cleric',        sprite: 'cleric_male',          gender: 'male',   tags: ['male','variant'] },
  { id: 'demon_hunter_female',  name: 'Demon Hunter (Female)',  classDefault: 'demon_hunter',  sprite: 'demon_hunter_female',  gender: 'female', tags: ['female','variant'] },
  { id: 'dragon_knight_male',   name: 'Dragon Knight (Male)',   classDefault: 'dragon_knight', sprite: 'dragon_knight_male',   gender: 'male',   tags: ['male','variant'] },
  { id: 'druid_male',           name: 'Druid (Male)',           classDefault: 'druid',         sprite: 'druid_male',           gender: 'male',   tags: ['male','variant'] },
  { id: 'fighter_female',       name: 'Fighter (Female)',       classDefault: 'fighter',       sprite: 'fighter_female',       gender: 'female', tags: ['female','variant'] },
  { id: 'knight_male',          name: 'Knight (Male)',          classDefault: 'knight',        sprite: 'knight_male',          gender: 'male',   tags: ['male','variant'] },
  { id: 'mage_female',          name: 'Mage (Female)',          classDefault: 'mage',          sprite: 'mage_female',          gender: 'female', tags: ['female','variant'] },
  { id: 'monk_female',          name: 'Monk (Female)',          classDefault: 'monk',          sprite: 'monk_female',          gender: 'female', tags: ['female','variant'] },
  { id: 'necromancer_female',   name: 'Necromancer (Female)',   classDefault: 'necromancer',   sprite: 'necromancer_female',   gender: 'female', tags: ['female','variant'] },
  { id: 'oracle_male',          name: 'Oracle (Male)',          classDefault: 'oracle',        sprite: 'oracle_male',          gender: 'male',   tags: ['male','variant'] },
  { id: 'paladin_female',       name: 'Paladin (Female)',       classDefault: 'paladin',       sprite: 'paladin_female',       gender: 'female', tags: ['female','variant'] },
  { id: 'pyromancer_male',      name: 'Pyromancer (Male)',      classDefault: 'pyromancer',    sprite: 'pyromancer_male',      gender: 'male',   tags: ['male','variant'] },
  { id: 'ranger_male',          name: 'Ranger (Male)',          classDefault: 'ranger',        sprite: 'ranger_male',          gender: 'male',   tags: ['male','variant'] },
  { id: 'rogue_male',           name: 'Rogue (Male)',           classDefault: 'rogue',         sprite: 'rogue_male',           gender: 'male',   tags: ['male','variant'] },
  { id: 'runesmith_female',     name: 'Runesmith (Female)',     classDefault: 'runesmith',     sprite: 'runesmith_female',     gender: 'female', tags: ['female','variant'] },
  { id: 'scavenger_female',     name: 'Scavenger (Female)',     classDefault: 'scavenger',     sprite: 'scavenger_female',     gender: 'female', tags: ['female','variant'] },
  { id: 'shadow_dancer_male',   name: 'Shadow Dancer (Male)',   classDefault: 'shadow_dancer', sprite: 'shadow_dancer_male',   gender: 'male',   tags: ['male','variant'] },
  { id: 'shaman_male',          name: 'Shaman (Male)',          classDefault: 'shaman',        sprite: 'shaman_male',          gender: 'male',   tags: ['male','variant'] },
  { id: 'sorcerer_female',      name: 'Sorcerer (Female)',      classDefault: 'sorcerer',      sprite: 'sorcerer_female',      gender: 'female', tags: ['female','variant'] },
  { id: 'stormcaller_female',   name: 'Stormcaller (Female)',   classDefault: 'stormcaller',   sprite: 'stormcaller_female',   gender: 'female', tags: ['female','variant'] },
  { id: 'swashbuckler_female',  name: 'Swashbuckler (Female)',  classDefault: 'swashbuckler',  sprite: 'swashbuckler_female',  gender: 'female', tags: ['female','variant'] },
  { id: 'tactician_female',     name: 'Tactician (Female)',     classDefault: 'tactician',     sprite: 'tactician_female',     gender: 'female', tags: ['female','variant'] },
  { id: 'warlock_male',         name: 'Warlock (Male)',         classDefault: 'warlock',       sprite: 'warlock_male',         gender: 'male',   tags: ['male','variant'] },
  { id: 'warrior_female',       name: 'Warrior (Female)',       classDefault: 'warrior',       sprite: 'warrior_female',       gender: 'female', tags: ['female','variant'] },
  { id: 'witch_hunter_female',  name: 'Witch Hunter (Female)',  classDefault: 'witch_hunter',  sprite: 'witch_hunter_female',  gender: 'female', tags: ['female','variant'] },
  { id: 'enchanter_male',       name: 'Enchanter (Male)',       classDefault: 'enchanter',     sprite: 'enchanter_male',       gender: 'male',   tags: ['male','robes','arcane','enchant'], pendingReview: true },
  { id: 'priest_female',        name: 'Priest (Female)',        classDefault: 'priest',        sprite: 'priest_female',        gender: 'female', tags: ['female','robes','holy','shadow','healer'], pendingReview: true },
  { id: 'enchanter_female',     name: 'Enchanter (Female)',     classDefault: 'enchanter',     sprite: 'enchanter_female',     gender: 'female', tags: ['female','robes','arcane','enchant'], pendingReview: true },
  { id: 'priest_male',          name: 'Priest (Male)',          classDefault: 'priest',        sprite: 'priest_male',          gender: 'male',   tags: ['male','robes','holy','shadow','healer'], pendingReview: true },
  { id: 'silas_veilward', name: 'Silas Veilward', classDefault: 'silas_veilward', sprite: 'silas_veilward', gender: 'male',   tags: ['npc','mentor'],   playable: false, npc: true },
  { id: 'kaela_thorne',   name: 'Kaela Thorne',   classDefault: 'kaela_thorne',   sprite: 'kaela_thorne',   gender: 'female', tags: ['npc','rival'],    playable: false, npc: true },
  { id: 'marek_greel',    name: 'Marek Greel',    classDefault: 'marek_greel',    sprite: 'marek_greel',    gender: 'male',   tags: ['npc','villain'],  playable: false, npc: true },
  { id: 'mira_seer',      name: 'Mira the Seer',  classDefault: 'mira_seer',      sprite: 'mira_seer',      gender: 'female', tags: ['npc','oracle'],   playable: false, npc: true },
  { id: 'iris_vael',         name: 'Iris Vael',          classDefault: 'iris_vael',         sprite: 'iris_vael',         gender: 'female', tags: ['npc','scholar','recurring'],  playable: false, npc: true },
  { id: 'garrick_ostmere',   name: 'Sir Garrick Ostmere',classDefault: 'garrick_ostmere',   sprite: 'garrick_ostmere',   gender: 'male',   tags: ['npc','knight','recurring'],   playable: false, npc: true },
  { id: 'mother_yssira',     name: 'Mother Yssira',      classDefault: 'mother_yssira',     sprite: 'mother_yssira',     gender: 'female', tags: ['npc','seer','recurring'],     playable: false, npc: true },
  { id: 'tomek_halverin',    name: 'Tomek Halverin',     classDefault: 'tomek_halverin',    sprite: 'tomek_halverin',    gender: 'male',   tags: ['npc','merchant','recurring'], playable: false, npc: true },
  { id: 'krix_bonechewer',   name: 'Krix Bonechewer',    classDefault: 'krix_bonechewer',   sprite: 'krix_bonechewer',   gender: 'male',   tags: ['npc','defector','recurring'], playable: false, npc: true },
  { id: 'halden_man_at_arms', name: 'Halden',         classDefault: 'fighter', sprite: 'halden_man_at_arms', gender: 'male',   tags: ['npc','recruitable','fighter'], playable: false, npc: true },
  { id: 'sister_veya',        name: 'Sister Veya',    classDefault: 'cleric',  sprite: 'sister_veya',        gender: 'female', tags: ['npc','recruitable','healer'],  playable: false, npc: true },
  { id: 'bulwark_dorn',       name: 'Bulwark Dorn',   classDefault: 'paladin', sprite: 'bulwark_dorn',       gender: 'male',   tags: ['npc','recruitable','tank'],    playable: false, npc: true },
  { id: 'kessa_quill',        name: 'Kessa Quill',    classDefault: 'ranger',  sprite: 'kessa_quill',        gender: 'female', tags: ['npc','recruitable','ranged'],  playable: false, npc: true },
  { id: 'magnus_orre',        name: 'Magnus Orre',    classDefault: 'mage',    sprite: 'magnus_orre',        gender: 'male',   tags: ['npc','recruitable','caster'],  playable: false, npc: true },
  { id: 'giant_spider',     name: 'Giant Spider',   classDefault: 'giant_spider',     sprite: 'giant_spider',     gender: 'none', tags: ['enemy','beast'],     playable: false, npc: true },
  { id: 'the_unraveler',    name: 'The Unraveler',  classDefault: 'the_unraveler',    sprite: 'the_unraveler',    gender: 'none', tags: ['enemy','boss','void'], playable: false, npc: true },
  { id: 'dragon_king',      name: 'Dragon King',    classDefault: 'dragon_king',      sprite: 'dragon_king',      gender: 'none', tags: ['enemy','boss','dragon'], playable: false, npc: true },
  { id: 'vault_guardian',   name: 'Vault Guardian', classDefault: 'vault_guardian',   sprite: 'vault_guardian',   gender: 'none', tags: ['enemy','boss','construct'], playable: false, npc: true },
  { id: 'void_scholar',     name: 'Void Scholar',   classDefault: 'void_scholar',     sprite: 'void_scholar',     gender: 'none', tags: ['enemy','boss','void'], playable: false, npc: true },
  { id: 'echo_sovereign',   name: 'Echo Sovereign', classDefault: 'echo_sovereign',   sprite: 'echo_sovereign',   gender: 'none', tags: ['enemy','boss','hidden'], playable: false, npc: true },
  { id: 'the_first_ember',  name: 'The First Ember',classDefault: 'the_first_ember',  sprite: 'the_first_ember',  gender: 'none', tags: ['enemy','boss','fire'], playable: false, npc: true },
];

// Canonical JSON serialization with sorted keys → byte-exact value compare.
function canon(o) {
  if (Array.isArray(o)) return '[' + o.map(canon).join(',') + ']';
  if (o && typeof o === 'object') {
    return '{' + Object.keys(o).sort().map(k => JSON.stringify(k) + ':' + canon(o[k])).join(',') + '}';
  }
  return JSON.stringify(o);
}

let diffs = 0;

// ── Gate 1: id-set identity (SAVE-COMPAT) ────────────────────────────────────
const legacyIds = LEGACY.map(a => a.id);
const jsonIds   = APPEARANCES_CANONICAL.map(a => a.id);
const legacySet = new Set(legacyIds);
const jsonSet   = new Set(jsonIds);
const missing = legacyIds.filter(id => !jsonSet.has(id));
const extra   = jsonIds.filter(id => !legacySet.has(id));
if (missing.length) { console.error('BLOCKER missing ids (dropped/renamed):', missing); diffs += missing.length; }
if (extra.length)   { console.error('BLOCKER extra ids (invented):', extra); diffs += extra.length; }

// Every entry in heroes.json ∪ npcs.json must surface in the resolved array
// (i.e. the order manifest must cover the full JSON id set — no silent drop).
const { heroes, npcs } = getAppearancesDoc();
const jsonSrcIds = [...heroes, ...npcs].map(e => e.id);
const uncovered = jsonSrcIds.filter(id => !jsonSet.has(id));
if (uncovered.length) {
  console.error('BLOCKER JSON ids not covered by resolved APPEARANCES (order manifest gap):', uncovered);
  diffs += uncovered.length;
}

// ── Gate 2: deep-equal, original order preserved ─────────────────────────────
if (LEGACY.length !== APPEARANCES_CANONICAL.length) {
  console.error(`BLOCKER length mismatch: legacy ${LEGACY.length} vs json ${APPEARANCES_CANONICAL.length}`);
  diffs++;
}
for (let i = 0; i < LEGACY.length; i++) {
  const L = LEGACY[i];
  const R = APPEARANCES_CANONICAL[i];
  if (!R) { console.error(`[${i}] ${L.id}: no JSON-resolved entry at index`); diffs++; continue; }
  if (canon(L) !== canon(R)) {
    console.error(`[${i}] ${L.id}: VALUE DIFF`);
    console.error('  legacy:', canon(L));
    console.error('  json  :', canon(R));
    diffs++;
  }
}

if (diffs === 0) {
  console.log(`PARITY OK 0 diffs (${LEGACY.length} appearances; id-set identical; order preserved)`);
  process.exit(0);
} else {
  console.error(`PARITY FAIL ${diffs} diffs`);
  process.exit(1);
}
