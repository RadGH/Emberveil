#!/usr/bin/env node
/**
 * scripts/verify-builds-classes-parity.mjs — canonical-data migration gate
 * (classes + build presets).
 *
 * Proves the canonical classes.json / build-presets.json resolved through
 * dataLoader.js (and re-exported by classes.js / buildPresets.js) are
 * deep-equal to the legacy inline literals.
 *
 * The "legacy" side is a frozen byte-for-byte snapshot captured from the
 * pre-deletion CLASSES / CLASS_TAGS / BUILDS values
 * (scripts/.classes-builds-legacy-snapshot.json). It is NEVER regenerated —
 * it is the authoritative reference forever, so the gate keeps proving parity
 * against the original values both BEFORE and AFTER the inline literals are
 * deleted from classes.js / buildPresets.js.
 *
 * CLASSES legacy snapshot is the FULLY-RESOLVED export (post-mutation: with
 * the derived `unlockRequirement` + `tags` keys attached by classes.js). The
 * canonical JSON stores the pre-mutation base literal; classes.js re-applies
 * the same derivation on top of CLASSES_CANONICAL, so the exported CLASSES
 * must remain byte-identical.
 *
 * Deep-equal is order-insensitive (keys sorted recursively), so JSON key
 * reordering is not a diff; any value/shape change IS.
 *
 * Gate 2 (SAVE-COMPAT): class id-set diff legacy-vs-JSON must be empty.
 *
 * Exit 0 on full parity; exit 1 with a readable diff on any mismatch.
 *
 * Usage: node scripts/verify-builds-classes-parity.mjs
 */
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const GAME_ROOT  = path.resolve(__dirname, '..');
const P = (rel) => new URL(path.join(GAME_ROOT, rel).replace(/\\/g, '/'), 'file:///').href;

const RED = (s) => `\x1b[31m${s}\x1b[0m`;
const GRN = (s) => `\x1b[32m${s}\x1b[0m`;

globalThis.window = undefined;
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const LEGACY = JSON.parse(
  readFileSync(path.join(__dirname, '.classes-builds-legacy-snapshot.json'), 'utf8')
);

function sortKeysDeep(v) {
  if (Array.isArray(v)) return v.map(sortKeysDeep);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortKeysDeep(v[k]);
    return out;
  }
  return v;
}
const norm = (v) => JSON.stringify(sortKeysDeep(v));

const dataLoader = await import(P('src/game/dataLoader.js'));
const classesMod = await import(P('src/game/classes.js'));
const buildsMod  = await import(P('src/game/buildPresets.js'));

// CLASSES_CANONICAL is the PRE-mutation base literal. The legacy snapshot is
// the POST-mutation export. So we re-derive the post-mutation shape the SAME
// way classes.js does, then compare; AND we compare classes.js's own export.
const classUnlocks = await import(P('src/game/classUnlocks.js'));

function deriveExportedClasses(baseList, classTags) {
  return baseList.map((c) => {
    const out = { ...c };
    out.unlockRequirement = classUnlocks.STARTING_CLASS_IDS.includes(c.id)
      ? null
      : (classUnlocks.UNLOCK_REQUIREMENTS[c.id] || null);
    out.tags = classTags[c.id] || [];
    return out;
  });
}

const derivedFromCanonical = deriveExportedClasses(
  dataLoader.CLASSES_CANONICAL,
  dataLoader.CLASS_TAGS_CANONICAL
);

const cases = [
  ['CLASSES (classes.js export vs frozen legacy)',          LEGACY.CLASSES,   classesMod.CLASSES],
  ['CLASSES (canonical re-derived vs frozen legacy)',        LEGACY.CLASSES,   derivedFromCanonical],
  ['CLASS_TAGS (classes.js export vs frozen legacy)',        LEGACY.CLASS_TAGS, classesMod.CLASS_TAGS],
  ['CLASS_TAGS (dataLoader.CLASS_TAGS_CANONICAL vs legacy)', LEGACY.CLASS_TAGS, dataLoader.CLASS_TAGS_CANONICAL],
  ['BUILDS (buildPresets.js export vs frozen legacy)',       LEGACY.BUILDS,    buildsMod.BUILDS],
  ['BUILDS (dataLoader.BUILDS_CANONICAL vs frozen legacy)',  LEGACY.BUILDS,    dataLoader.BUILDS_CANONICAL],
];

let totalDiffs = 0;
for (const [label, legacy, resolved] of cases) {
  const a = norm(legacy);
  const b = norm(resolved);
  if (a === b) {
    const n = Array.isArray(legacy) ? legacy.length : Object.keys(legacy).length;
    console.log(GRN('  OK ') + label + ` — ${n} entr${n === 1 ? 'y' : 'ies'}, identical`);
    continue;
  }
  totalDiffs++;
  console.error(RED('  FAIL ') + label);
  const la = JSON.parse(a), lb = JSON.parse(b);
  if (Array.isArray(la)) {
    const byId = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]));
    const ma = byId(la), mb = byId(lb);
    const ids = new Set([...Object.keys(ma), ...Object.keys(mb)]);
    for (const id of ids) {
      if (JSON.stringify(ma[id]) !== JSON.stringify(mb[id])) {
        console.error('    id "' + id + '"');
        console.error('      legacy  : ' + JSON.stringify(ma[id]));
        console.error('      resolved: ' + JSON.stringify(mb[id]));
      }
    }
  } else {
    const keys = new Set([...Object.keys(la), ...Object.keys(lb)]);
    for (const k of keys) {
      if (JSON.stringify(la[k]) !== JSON.stringify(lb[k])) {
        console.error('    key "' + k + '"');
        console.error('      legacy  : ' + JSON.stringify(la[k]));
        console.error('      resolved: ' + JSON.stringify(lb[k]));
      }
    }
  }
}

// ── Gate 2: SAVE-COMPAT class id-set diff (legacy vs canonical JSON) ──────────
const legacyIds = LEGACY.CLASSES.map((c) => c.id).sort();
const jsonIds   = dataLoader.CLASSES_CANONICAL.map((c) => c.id).sort();
const legacySet = new Set(legacyIds);
const jsonSet   = new Set(jsonIds);
const onlyLegacy = legacyIds.filter((id) => !jsonSet.has(id));
const onlyJson   = jsonIds.filter((id) => !legacySet.has(id));

console.log('');
console.log('── Gate 2: class id-set diff (SAVE-COMPAT) ──');
console.log(`  legacy ids (${legacyIds.length}): ${legacyIds.join(', ')}`);
console.log(`  json   ids (${jsonIds.length}): ${jsonIds.join(', ')}`);
console.log(`  only in legacy: [${onlyLegacy.join(', ')}]`);
console.log(`  only in json  : [${onlyJson.join(', ')}]`);
let idDiff = onlyLegacy.length + onlyJson.length;
if (idDiff === 0) {
  console.log(GRN('  OK — class id-set diff is EMPTY (save-compat preserved)'));
} else {
  console.error(RED('  FAIL — class id-set differs (SAVE-COMPAT BLOCKER)'));
}

console.log('');
if (totalDiffs === 0 && idDiff === 0) {
  console.log(GRN(
    `BUILDS/CLASSES PARITY OK: 0 diffs ` +
    `(${LEGACY.CLASSES.length} classes, ${Object.keys(LEGACY.CLASS_TAGS).length} tag maps, ` +
    `${Object.keys(LEGACY.BUILDS).length} build sets byte-identical; id-set diff empty).`
  ));
  process.exit(0);
} else {
  console.error(RED(`BUILDS/CLASSES PARITY FAIL: ${totalDiffs} value diff case(s), ${idDiff} id-set diff(s).`));
  process.exit(1);
}
