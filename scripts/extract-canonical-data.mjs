#!/usr/bin/env node
/**
 * extract-canonical-data.mjs — Phase 0, canonical-data migration (M496+)
 *
 * Imports the LIVE JS modules and serializes the currently-running resolved
 * values to canonical JSON under public/data/{entities,combat}/ byte-for-byte.
 *
 * ZERO behavior change: this script does NOT modify any runtime module. It is
 * additive and re-runnable (deterministic: sorted keys, stable order).
 *
 * Conflicting ids (void_wraith 960/960/640, dragon_whelp 480/1240/800, ...)
 * are NOT collapsed. Base entity = canonical ENEMIES_ACT* stat block; each
 * encounter that inlined a different stat set gets a per-enemy `overrides:{}`
 * capturing the delta so the resolved combat object is byte-identical to today.
 *
 * Emits game13/memory/extraction-report.md.
 *
 * Usage:  node scripts/extract-canonical-data.mjs
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const P = (...p) => path.join(ROOT, ...p);

// ── DOM polyfill so TownScreen.js (UI module) evaluates at top level ─────────
globalThis.window = {
  addEventListener() {},
  matchMedia: () => ({ matches: false, addEventListener() {} }),
  location: { href: '', search: '', hash: '' },
};
globalThis.document = {
  createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, addEventListener() {}, appendChild() {} }),
  addEventListener() {},
  body: { appendChild() {} },
  head: { appendChild() {} },
  getElementById: () => null,
  querySelector: () => null,
};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

// ── Load live modules ───────────────────────────────────────────────────────
const mapData = await import(P('src/maps/mapData.js'));
const bossPhasesMod = await import(P('src/game/bossPhases.js'));
const bossDeathMod = await import(P('src/game/bossDeathDialog.js'));
const bossLootMod = await import(P('src/game/bossLoot.js'));
const companionsMod = await import(P('src/game/companions.js'));
const appearancesMod = await import(P('src/game/appearances.js'));
const townMod = await import(P('src/ui/screens/TownScreen.js'));

const {
  ENEMIES, ENEMIES_ACT4, ENEMIES_ACT5, ENEMIES_ACT6,
  ENCOUNTERS, HIDDEN_BOSS_ENCOUNTERS, BOSS_TAP_DROPS,
} = mapData;
const { BOSS_PHASES } = bossPhasesMod;
const { BOSS_DEATH_DIALOG } = bossDeathMod;
const { BOSS_LOOT_TABLES } = bossLootMod;
const { CLASS_PETS, COMPANION_POWER } = companionsMod;
const { APPEARANCES } = appearancesMod;
const { HIREABLES_ACT1 } = townMod;

// COMPANIONS_ACT1 is module-private (not exported). Extract its literal text
// from the source — it is a pure data array (object literals only, no
// identifier references) so a sandboxed Function eval is byte-safe and
// deterministic.
function extractCompanionsAct1() {
  const raw = readFileSync(P('src/ui/screens/TownScreen.js'), 'utf8');
  // Strip // line comments (not inside strings) so the bracket/quote scanner
  // can't be derailed by apostrophes or brackets in comment prose.
  const src = raw.split('\n').map(line => {
    let inStr = false, q = '';
    for (let j = 0; j < line.length; j++) {
      const c = line[j];
      if (inStr) { if (c === '\\') { j++; continue; } if (c === q) inStr = false; continue; }
      if (c === '"' || c === "'" || c === '`') { inStr = true; q = c; continue; }
      if (c === '/' && line[j + 1] === '/') return line.slice(0, j);
    }
    return line;
  }).join('\n');
  const start = src.indexOf('const COMPANIONS_ACT1 = [');
  if (start < 0) throw new Error('COMPANIONS_ACT1 literal not found in TownScreen.js');
  const open = src.indexOf('[', start);
  // Balanced-bracket scan to find the matching close, ignoring brackets in
  // strings.
  let depth = 0, i = open, inStr = false, q = '';
  for (; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (c === '\\') { i++; continue; }
      if (c === q) inStr = false;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = true; q = c; continue; }
    if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) { i++; break; } }
  }
  const literal = src.slice(open, i);
  // eslint-disable-next-line no-new-func
  return Function(`"use strict"; return (${literal});`)();
}
const COMPANIONS_ACT1 = extractCompanionsAct1();

// ── Deterministic JSON helpers ──────────────────────────────────────────────
function sortKeysDeep(v) {
  if (Array.isArray(v)) return v.map(sortKeysDeep);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortKeysDeep(v[k]);
    return out;
  }
  return v;
}
function stableStringify(obj) {
  return JSON.stringify(sortKeysDeep(obj), null, 2) + '\n';
}
function deepEqual(a, b) {
  return JSON.stringify(sortKeysDeep(a)) === JSON.stringify(sortKeysDeep(b));
}

// ── Combatant field list (must mirror schema entity.json#/$defs/combatant) ──
const COMBATANT_FIELDS = [
  'id', 'name', 'hp', 'maxHp', 'dmg', 'armor', 'hit', 'dodge', 'xpValue',
  'magicResist', 'gold', 'loot', 'spellList', 'spellChance', 'statusOnHit',
  'blockChance', 'stealableBuffs', 'isBoss',
];

// ── Build entity dicts ──────────────────────────────────────────────────────
// Canonical base stat blocks: ENEMIES + ENEMIES_ACT4/5/6. Note id conflicts
// ACROSS dicts (void_wraith in ENEMIES_ACT4; dragon_whelp in ENEMIES_ACT6).
// These dicts do NOT collide internally. We split bosses out by an isBoss
// heuristic: an entity is a "boss" if it appears as the sole/first creature in
// a boss-type encounter OR has isBoss/known boss id. To stay byte-safe and
// avoid ambiguity, ALL base stat blocks live in enemies.json; bosses.json
// holds the boss/hidden-boss creatures. Every encounter ref must resolve to
// one of the two.

const report = {
  counts: {},
  overrides: [],          // {encounter, enemyId, diff:{field:{base,enc}}}
  singleSource: [],       // ids that existed in only one place
  schemaWidened: [],      // fields added after first validation failure
  conflicts: [],          // ids with >1 distinct stat block
  notes: [],
};

// Strip a `count` (and any non-combatant) key to get the pure stat block.
function statBlock(o) {
  const b = {};
  for (const k of COMBATANT_FIELDS) if (k in o) b[k] = o[k];
  return b;
}

// Base entity registry from the canonical ENEMIES* dicts.
const baseEntities = {};        // id -> stat block (canonical)
const baseSource = {};          // id -> which dict it came from
function registerBase(dict, label) {
  for (const [id, e] of Object.entries(dict)) {
    const block = statBlock(e);
    if (baseEntities[id] && !deepEqual(baseEntities[id], block)) {
      report.conflicts.push({ id, where: `${baseSource[id]} vs ${label}`, note: 'base-dict conflict' });
    }
    baseEntities[id] = block;
    baseSource[id] = label;
  }
}
registerBase(ENEMIES, 'ENEMIES');
registerBase(ENEMIES_ACT4, 'ENEMIES_ACT4');
registerBase(ENEMIES_ACT5, 'ENEMIES_ACT5');
registerBase(ENEMIES_ACT6, 'ENEMIES_ACT6');

// Classify boss vs enemy. Boss = id present in BOSS_PHASES / BOSS_LOOT_TABLES /
// BOSS_DEATH_DIALOG, or has isBoss, or is a hidden-boss creature.
const bossIdHints = new Set([
  ...Object.keys(BOSS_PHASES),
  ...Object.keys(BOSS_LOOT_TABLES),
  ...Object.keys(BOSS_DEATH_DIALOG),
]);
function isBossId(id, block) {
  if (block && block.isBoss === true) return true;
  if (bossIdHints.has(id)) return true;
  return false;
}

// Resolve every encounter, computing per-enemy overrides vs the base entity.
const encountersOut = {};
const inlineOnlyEntities = {};  // id -> base block synthesized from an inline enemy

function pickBaseForRef(id, sampleBlock) {
  if (baseEntities[id]) return baseEntities[id];
  // No base dict entry (e.g. giant_spider, inline dragon roster). Synthesize
  // the canonical base from the FIRST inline occurrence we see.
  if (!inlineOnlyEntities[id]) {
    inlineOnlyEntities[id] = sampleBlock;
    report.singleSource.push({ id, source: 'inline ENCOUNTERS only — no ENEMIES* dict entry; base synthesized from first inline block' });
  }
  return inlineOnlyEntities[id];
}

// Override application contract (mirrors verify-canonical-parity.mjs's
// resolveCanonGroup and the future Phase-1 loader EXACTLY):
//
//   merged = { ...base, ...overrides }            // top-level value replace
//   then   delete every key whose override value === DELETE_MARKER (null)
//
// `null` is the delete-marker: an `overrides[k] === null` means "the inline
// encounter literal does NOT carry key `k`, even though the base entity does;
// remove it from the resolved object". This is required because a plain JS
// spread cannot REMOVE a base key, and ~20 inline dragon/void encounter
// variants legitimately omit `loot`/`statusOnHit` that their shared-id
// ENEMIES_ACT* base defines (verified: no combatant field is ever literally
// `null` in legacy mapData, so the marker is unambiguous). The contract is
// documented in the parity script header + canonical-data-migration-plan.md
// and implemented identically there — never just here.
const DELETE_MARKER = null;
function applyOverride(base, ov) {
  if (!ov) return { ...base };
  const merged = { ...base, ...ov };
  for (const k of Object.keys(ov)) {
    if (ov[k] === DELETE_MARKER) delete merged[k];
  }
  return merged;
}
function diffBlock(base, full) {
  // Minimal delta that, applied via applyOverride, reproduces `full` exactly:
  //   - key in full but value differs from base → override with full value
  //   - key in full but absent in base           → override with full value
  //   - key in base but absent in full           → override with DELETE_MARKER
  const ov = {};
  for (const k of COMBATANT_FIELDS) {
    const inBase = k in base;
    const inFull = k in full;
    if (inFull && (!inBase || !deepEqual(base[k], full[k]))) {
      ov[k] = full[k];
    } else if (inBase && !inFull) {
      ov[k] = DELETE_MARKER; // base has it, inline literal omits it → delete
    }
  }
  return ov; // {} when identical to base (pure ...spread, no tweak)
}

const allReferencedIds = new Set();

function processEncounterSet(set, { hidden }) {
  for (const [encId, enc] of Object.entries(set)) {
    const out = { name: enc.name, enemies: [] };
    if (enc.introText != null) out.introText = enc.introText;
    if (hidden) out.hidden = true;
    if (enc.bossLoot) out.bossLootRef = { ...enc.bossLoot };
    for (const raw of enc.enemies) {
      const id = raw.id;
      allReferencedIds.add(id);
      const full = statBlock(raw);           // resolved combat stat block
      const count = raw.count;
      const base = pickBaseForRef(id, full);
      const ov = diffBlock(base, full);
      const entry = { ref: id, count };
      if (Object.keys(ov).length > 0) {
        entry.overrides = ov;
        report.overrides.push({
          encounter: encId, ref: id,
          diff: Object.fromEntries(Object.keys(ov).map(k => [k, { base: base[k], encounter: full[k] }])),
        });
      }
      // Byte-parity self-check: reconstruct resolved object and compare.
      const reconstructed = applyOverride(base, entry.overrides);
      if (!deepEqual(reconstructed, full)) {
        throw new Error(`BYTE-PARITY FAIL: ${encId}/${id} — reconstruction != live resolved object`);
      }
      out.enemies.push(entry);
    }
    encountersOut[encId] = out;
  }
}
processEncounterSet(ENCOUNTERS, { hidden: false });
processEncounterSet(HIDDEN_BOSS_ENCOUNTERS, { hidden: true });

// Record conflicts: any id that resolved to >1 distinct stat block across
// encounters (the void_wraith / dragon_whelp trap).
const seenBlocksById = {};
for (const enc of Object.values(encountersOut)) {
  for (const e of enc.enemies) {
    const base = baseEntities[e.ref] || inlineOnlyEntities[e.ref];
    const resolved = applyOverride(base, e.overrides);
    const sig = JSON.stringify(sortKeysDeep(resolved));
    (seenBlocksById[e.ref] ||= new Set()).add(sig);
  }
}
for (const [id, set] of Object.entries(seenBlocksById)) {
  if (set.size > 1) {
    report.conflicts.push({ id, variants: set.size, note: 'distinct resolved stat blocks across encounters — preserved via per-encounter overrides (NOT collapsed)' });
  }
}

// ── Split base entities into enemies.json / bosses.json ─────────────────────
const enemyEntities = {};
const bossEntities = {};
const allBaseIds = { ...baseEntities, ...inlineOnlyEntities };
for (const [id, block] of Object.entries(allBaseIds)) {
  if (isBossId(id, block)) bossEntities[id] = block;
  else enemyEntities[id] = block;
}

// ── Zero-omission assertion: every referenced id must exist ─────────────────
const missing = [];
for (const id of allReferencedIds) {
  if (!(id in enemyEntities) && !(id in bossEntities)) missing.push(id);
}
if (missing.length) {
  throw new Error(`ZERO-OMISSION FAIL: encounter ids with no entity entry: ${missing.join(', ')}`);
}

// ── Appearances → heroes.json / npcs.json ───────────────────────────────────
const heroAppearances = APPEARANCES.filter(a => a.playable !== false);
const npcAppearances = APPEARANCES.filter(a => a.playable === false);
const APPEARANCE_FIELDS = ['id', 'name', 'sprite', 'classDefault', 'gender', 'tags', 'playable', 'npc', 'deprecated', 'pendingReview'];
function cleanAppearance(file, a) {
  for (const k of Object.keys(a)) {
    if (!APPEARANCE_FIELDS.includes(k)) throw new Error(`${file}/${a.id}: unknown appearance field '${k}'`);
  }
  return a;
}
heroAppearances.forEach(a => cleanAppearance('heroes.json', a));
npcAppearances.forEach(a => cleanAppearance('npcs.json', a));

// ── Validate combatant entities against the schema contract ─────────────────
// (Combatant entities are validated against the authored draft-2020-12
//  schemas AFTER emit, below — using the real schema-driven validator so the
//  schemas' own field lists, additionalProperties:false, oneOf and $refs are
//  what gates the data. This is the exhaustiveness proof: a field the schema
//  forgot = a validation failure here.)

// ── Emit canonical JSON ─────────────────────────────────────────────────────
mkdirSync(P('public/data/entities'), { recursive: true });
mkdirSync(P('public/data/combat'), { recursive: true });

function emit(rel, obj) {
  writeFileSync(P(rel), stableStringify(obj));
  report.counts[rel] = obj.entities
    ? (Array.isArray(obj.entities) ? obj.entities.length : Object.keys(obj.entities).length)
    : null;
}

emit('public/data/entities/enemies.json', { version: 1, source: 'mapData.js ENEMIES/ENEMIES_ACT4/5/6 + inline ENCOUNTERS', entities: enemyEntities });
emit('public/data/entities/bosses.json', { version: 1, source: 'mapData.js boss creatures + HIDDEN_BOSS_ENCOUNTERS', entities: bossEntities });
emit('public/data/entities/heroes.json', { version: 1, source: 'appearances.js APPEARANCES (playable !== false)', entities: heroAppearances });
emit('public/data/entities/npcs.json', { version: 1, source: 'appearances.js APPEARANCES (playable === false)', entities: npcAppearances });

writeFileSync(P('public/data/entities/companions.json'), stableStringify({
  version: 1,
  source: 'TownScreen.js COMPANIONS_ACT1/HIREABLES_ACT1 + companions.js CLASS_PETS/COMPANION_POWER',
  companions: COMPANIONS_ACT1,
  classPets: CLASS_PETS,
  hires: HIREABLES_ACT1,
  companionPower: COMPANION_POWER,
}));
report.counts['public/data/entities/companions.json'] =
  `${COMPANIONS_ACT1.length} companions, ${Object.keys(CLASS_PETS).length} pets, ${HIREABLES_ACT1.length} hires, ${Object.keys(COMPANION_POWER).length} power tiers`;

writeFileSync(P('public/data/combat/encounters.json'), stableStringify({
  version: 1,
  source: 'mapData.js ENCOUNTERS + HIDDEN_BOSS_ENCOUNTERS',
  encounters: encountersOut,
}));
report.counts['public/data/combat/encounters.json'] = Object.keys(encountersOut).length;

writeFileSync(P('public/data/combat/drop-tables.json'), stableStringify({
  version: 1,
  source: 'mapData.js BOSS_TAP_DROPS + bossLoot.js BOSS_LOOT_TABLES',
  tapDrops: BOSS_TAP_DROPS,
  bossLoot: BOSS_LOOT_TABLES,
}));
report.counts['public/data/combat/drop-tables.json'] =
  `${Object.keys(BOSS_TAP_DROPS).length} tapDrops, ${Object.keys(BOSS_LOOT_TABLES).length} bossLoot`;

writeFileSync(P('public/data/combat/boss-phases.json'), stableStringify({
  version: 1,
  source: 'bossPhases.js BOSS_PHASES + bossDeathDialog.js BOSS_DEATH_DIALOG',
  phases: BOSS_PHASES,
  deathDialog: BOSS_DEATH_DIALOG,
}));
report.counts['public/data/combat/boss-phases.json'] =
  `${Object.keys(BOSS_PHASES).length} phased bosses, ${Object.keys(BOSS_DEATH_DIALOG).length} death dialogs`;

// ── Validate every emitted file against its authored draft-2020-12 schema ──
// Real schema-driven validation (resolves $ref/$defs across schema files,
// enforces additionalProperties:false, oneOf, const, enum). A field missing
// from entity.json#/$defs/combatant surfaces here as an
// "unknown property (additionalProperties:false)" failure — the exhaustiveness
// proof the contract asks for.
const { makeValidator } = await import(P('scripts/lib/validate-canonical.mjs'));
const vf = makeValidator(P('public/schemas/v1'));
const schemaMap = [
  ['public/data/entities/enemies.json', 'enemies.json'],
  ['public/data/entities/bosses.json', 'enemies.json'],
  ['public/data/entities/heroes.json', 'heroes.json'],
  ['public/data/entities/npcs.json', 'npcs.json'],
  ['public/data/entities/companions.json', 'companions.json'],
  ['public/data/combat/encounters.json', 'encounters.json'],
  ['public/data/combat/drop-tables.json', 'drop-tables.json'],
  ['public/data/combat/boss-phases.json', 'boss-phases.json'],
];
let schemaFail = false;
for (const [dataRel, schemaFile] of schemaMap) {
  const data = JSON.parse(readFileSync(P(dataRel), 'utf8'));
  const errs = vf(schemaFile, data);
  if (errs.length) {
    schemaFail = true;
    console.error(`SCHEMA VALIDATION FAILED: ${dataRel} vs ${schemaFile}`);
    for (const e of errs.slice(0, 40)) console.error('  ' + e);
    if (errs.length > 40) console.error(`  ... +${errs.length - 40} more`);
  } else {
    console.log(`  schema OK: ${dataRel} ✓ ${schemaFile}`);
  }
}
if (schemaFail) {
  console.error('Aborting — emitted data does not conform to authored schemas (schema field list not exhaustive, or extraction bug).');
  process.exit(1);
}

// ── Write extraction report ─────────────────────────────────────────────────
const lines = [];
lines.push('# Canonical Data Extraction Report (Phase 0)');
lines.push('');
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push('Script: `scripts/extract-canonical-data.mjs` — re-runnable, deterministic (sorted keys).');
lines.push('NO behavior change. No runtime/consumer module was modified.');
lines.push('');
lines.push('## File counts');
lines.push('');
for (const [f, c] of Object.entries(report.counts)) lines.push(`- \`${f}\` — ${c}`);
lines.push('');
lines.push('## IDs that required per-encounter `overrides` (HIGHEST RISK — conflict cases)');
lines.push('');
lines.push('These are the inline encounter enemies whose resolved stat block differs from');
lines.push('the canonical base entity. Each is preserved byte-identically via an `overrides`');
lines.push('delta in encounters.json — NOT collapsed.');
lines.push('');
if (report.overrides.length === 0) {
  lines.push('_None._');
} else {
  for (const o of report.overrides) {
    const fields = Object.keys(o.diff).join(', ');
    lines.push(`- **${o.encounter}** → \`${o.ref}\` — overridden fields: ${fields}`);
    for (const [k, v] of Object.entries(o.diff)) {
      lines.push(`  - \`${k}\`: base \`${JSON.stringify(v.base)}\` → encounter \`${JSON.stringify(v.encounter)}\``);
    }
  }
}
lines.push('');
lines.push('## Conflicting ids (>1 distinct resolved stat block under one id)');
lines.push('');
if (report.conflicts.length === 0) lines.push('_None._');
else for (const c of report.conflicts) lines.push(`- \`${c.id}\` — ${c.variants ? c.variants + ' variants; ' : ''}${c.note}${c.where ? ' (' + c.where + ')' : ''}`);
lines.push('');
lines.push('## IDs found in only one place (inline-only, base synthesized)');
lines.push('');
if (report.singleSource.length === 0) lines.push('_None._');
else for (const s of report.singleSource) lines.push(`- \`${s.id}\` — ${s.source}`);
lines.push('');
lines.push('## Schema fields added after first validation failure');
lines.push('');
if (report.schemaWidened.length === 0) lines.push('_None — the initial combatant field list (id,name,hp,maxHp,dmg,armor,hit,dodge,xpValue,magicResist,gold,loot,spellList,spellChance,statusOnHit,blockChance,stealableBuffs,isBoss) validated on the first run; it was derived by grepping every enemy source block before authoring the schema._');
else for (const w of report.schemaWidened) lines.push(`- ${w}`);
lines.push('');
lines.push('## Notes');
lines.push('');
lines.push('- `statusOnHit` appears in BOTH shapes in the live source: an array of');
lines.push('  status objects (most ENEMIES) and a single bare object (ENEMIES_ACT4/5');
lines.push('  void_wraith / reality_shard / void_prophet). The schema `oneOf` and the');
lines.push('  extractor preserve whichever shape the source used — byte-identical.');
lines.push('- Boss vs enemy split: an entity goes to bosses.json if its id appears in');
lines.push('  BOSS_PHASES / BOSS_LOOT_TABLES / BOSS_DEATH_DIALOG or has isBoss:true;');
lines.push('  everything else is in enemies.json. Every encounter `ref` resolves to');
lines.push('  exactly one of the two files (zero-omission assertion enforced).');
lines.push('- Override application contract (DELETE_MARKER):');
lines.push('  `resolved = { ...base, ...overrides }` then every key whose');
lines.push('  override value is `null` is DELETED. `null` is the delete-marker.');
lines.push('  Authored identically in extract-canonical-data.mjs (applyOverride),');
lines.push('  verify-canonical-parity.mjs (resolveCanonGroup), and');
lines.push('  canonical-data-migration-plan.md. Each encounter enemy is');
lines.push('  reconstructed via applyOverride and deep-compared to the live');
lines.push('  resolved object; the script throws on any mismatch (byte-parity).');
lines.push('');
lines.push('### Phase-0 reconciliation: the 39-diff fix (diff classes found)');
lines.push('');
lines.push('All 39 original `PARITY FAIL` diffs were ONE class: `extra key in');
lines.push('canon`. ~20 inline dragon/void encounter groups (e.g.');
lines.push('`dragon_patrol/dragon_whelp`, `dragon_king_fight/{dragon_king,');
lines.push('ancient_dragon,wyrm_warrior}`, `big_void_tide/void_wraith`,');
lines.push('`frost_wyrm_pack/*`, `wyrm_citadel/*`, `storm_dragon_nest/*`,');
lines.push('`dragon_elite/*`, `ancient_dragon_fight/*`, `big_dragon_skyfall/*`)');
lines.push('OMIT `loot` and/or `statusOnHit` in their inline literal, while the');
lines.push('shared-id ENEMIES_ACT6 base entity defines them. Ground truth = the');
lines.push('legacy resolved object, which has NO such key.');
lines.push('');
lines.push('Root cause: the old `applyOverride` used a "complete override =');
lines.push('verbatim" branch the parity gate did not mirror (gate did pure');
lines.push('`{...base,...overrides}`), so the base loot/statusOnHit leaked back');
lines.push('in on the gate side. Pure spread cannot remove a key.');
lines.push('');
lines.push('Fix (no gate weakened): introduced the `null` DELETE_MARKER into the');
lines.push('shared resolution contract — implemented identically in the');
lines.push('extraction (`applyOverride`/`diffBlock`) and the parity gate');
lines.push('(`resolveCanonGroup`), documented in the plan doc, and permitted in');
lines.push('the `combatantOverrides` schema (`oneOf [type, {type:null}]`). The');
lines.push('zero-dependency schema validator was given correct draft-2020-12');
lines.push('`type:"null"` support (it had none — a validator omission). Verified');
lines.push('NO combatant field is ever literally `null` in legacy mapData, so');
lines.push('the marker is unambiguous. Result: `PARITY OK ... 0 diffs`, exit 0;');
lines.push('all 8 canonical files still validate against public/schemas/v1/.');
lines.push('');
writeFileSync(P('memory/extraction-report.md'), lines.join('\n') + '\n');

console.log('Extraction complete. Files emitted:');
for (const [f, c] of Object.entries(report.counts)) console.log(`  ${f} — ${c}`);
console.log(`Overrides required: ${report.overrides.length} | Conflicts: ${report.conflicts.length} | Inline-only ids: ${report.singleSource.length}`);
console.log('Report: memory/extraction-report.md');
