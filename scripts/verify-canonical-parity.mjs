#!/usr/bin/env node
/**
 * scripts/verify-canonical-parity.mjs — Canonical Data Migration, Phase 0 step 3.
 *
 * The verification gate for Phase 1 steps 4 & 5 (see
 * game13/memory/canonical-data-migration-plan.md). Proves the canonical JSON
 * resolves to BYTE-IDENTICAL combat objects vs the legacy JS literals in
 * src/maps/mapData.js. If this passes, the dataLoader can take over live
 * combat with zero behaviour change; if it fails it prints the exact field
 * diff per enemy instance.
 *
 *   LEGACY  = the live, module-evaluated ENCOUNTERS / HIDDEN_BOSS_ENCOUNTERS
 *             from src/maps/mapData.js. Each `enemies[]` entry is ALREADY a
 *             fully-resolved flat object (the `{ ...ENEMIES.x, count }` spread
 *             happens at module eval), so it is exactly what
 *             encounterToCombatants() consumes via `group.*`.
 *
 *   CANON   = public/data/combat/encounters.json resolved against
 *             public/data/entities/enemies.json + bosses.json using the SAME
 *             {ref,count,overrides} semantics the future dataLoader will use:
 *
 *               base   = enemies[ref]  ?? bosses[ref]      (enemies first)
 *               merged = { ...base, ...overrides }         (top-level replace,
 *                                                           matching JS spread)
 *               then   delete every key whose override value === null
 *                                                          (the DELETE_MARKER —
 *                                                           an inline encounter
 *                                                           variant that OMITS a
 *                                                           key its shared-id base
 *                                                           defines, e.g. inline
 *                                                           dragon_whelp has no
 *                                                           loot/statusOnHit while
 *                                                           ENEMIES_ACT6 does; a
 *                                                           JS spread can't remove
 *                                                           a key so the contract
 *                                                           carries an explicit
 *                                                           null delete-marker.
 *                                                           No combatant field is
 *                                                           ever literally null in
 *                                                           legacy mapData, so the
 *                                                           marker is unambiguous)
 *               resolved = { ...merged, count }            (count is a property
 *                                                           of the group object,
 *                                                           exactly as in mapData)
 *
 *   This delete-marker is part of the {ref,count,overrides} resolution
 *   CONTRACT, authored identically here, in scripts/extract-canonical-data.mjs
 *   (applyOverride), and documented in
 *   game13/memory/canonical-data-migration-plan.md. It is NOT a comparator
 *   leniency: the deep-equal below is still strict and byte-exact. The marker
 *   only lets the canonical {base+overrides} representation EXPRESS a legacy
 *   object whose key set is a strict subset of its shared-id base — which a
 *   plain spread structurally cannot.
 *
 *   For every encounter key we expand BOTH sides to a flat, ORDERED list of
 *   fully-resolved enemy group objects (one entry per `enemies[]` group — the
 *   `count` value is compared as a field, NOT exploded into N instances, since
 *   the legacy literal carries `count` on the group and the simulator/combat
 *   screen explode it identically downstream regardless of source). We then
 *   deep-equal field by field. Any difference is reported with the encounter
 *   key, enemy id, group index, and the precise legacy-vs-canon value.
 *
 * Deterministic, idempotent, re-runnable. No args. Exit 0 on full parity,
 * non-zero with a readable diff on any mismatch or when canonical JSON is
 * absent.
 *
 * Usage:  node scripts/verify-canonical-parity.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const GAME_ROOT  = path.resolve(__dirname, '..');

const LEGACY_MAPDATA = path.join(GAME_ROOT, 'src/maps/mapData.js');
const CANON_ENCOUNTERS = path.join(GAME_ROOT, 'public/data/combat/encounters.json');
const CANON_ENEMIES    = path.join(GAME_ROOT, 'public/data/entities/enemies.json');
const CANON_BOSSES     = path.join(GAME_ROOT, 'public/data/entities/bosses.json');

const RED = (s) => `\x1b[31m${s}\x1b[0m`;
const GRN = (s) => `\x1b[32m${s}\x1b[0m`;
const DIM = (s) => `\x1b[2m${s}\x1b[0m`;

function fail(msg) {
  console.error(RED('PARITY FAIL') + ' — ' + msg);
  process.exit(1);
}

function requireCanonFile(p, label) {
  if (!fs.existsSync(p)) {
    console.error(RED('PARITY FAIL') + ` — canonical ${label} not found:`);
    console.error('  ' + DIM(path.relative(GAME_ROOT, p)));
    console.error('');
    console.error('  The canonical JSON has not been emitted yet. Run the');
    console.error('  extraction script first:');
    console.error('');
    console.error('    node scripts/extract-canonical-data.mjs');
    console.error('');
    console.error('  then re-run this gate.');
    process.exit(2);
  }
}

function readJson(p, label) {
  let txt;
  try {
    txt = fs.readFileSync(p, 'utf8');
  } catch (e) {
    fail(`could not read canonical ${label}: ${e.message}`);
  }
  try {
    return JSON.parse(txt);
  } catch (e) {
    fail(`canonical ${label} is not valid JSON: ${e.message}`);
  }
}

/* ---------- deep-equal with a precise first-difference path ---------- */

function diffValue(a, b, pathStr, diffs) {
  if (a === b) return;
  const ta = typeOf(a);
  const tb = typeOf(b);
  if (ta !== tb) {
    diffs.push({ path: pathStr, legacy: a, canon: b, why: `type ${ta} vs ${tb}` });
    return;
  }
  if (ta === 'array') {
    if (a.length !== b.length) {
      diffs.push({ path: pathStr, legacy: a, canon: b, why: `array length ${a.length} vs ${b.length}` });
      return;
    }
    for (let i = 0; i < a.length; i++) diffValue(a[i], b[i], `${pathStr}[${i}]`, diffs);
    return;
  }
  if (ta === 'object') {
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    const all = new Set([...ka, ...kb]);
    for (const k of all) {
      const inA = Object.prototype.hasOwnProperty.call(a, k);
      const inB = Object.prototype.hasOwnProperty.call(b, k);
      if (inA && !inB) { diffs.push({ path: `${pathStr}.${k}`, legacy: a[k], canon: undefined, why: 'key missing in canon' }); continue; }
      if (!inA && inB) { diffs.push({ path: `${pathStr}.${k}`, legacy: undefined, canon: b[k], why: 'extra key in canon' }); continue; }
      diffValue(a[k], b[k], `${pathStr}.${k}`, diffs);
    }
    return;
  }
  // primitive mismatch
  diffs.push({ path: pathStr, legacy: a, canon: b, why: 'value' });
}

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

/* ---------- canonical resolution (mirrors the future dataLoader) ---------- */

/**
 * Resolve one canonical {ref,count,overrides} entry into the fully-flattened
 * group object that must byte-match the legacy mapData literal.
 *
 *   merged = { ...base, ...overrides }   // top-level key replace == JS spread
 *   then     delete keys whose override value === DELETE_MARKER (null)
 *   group  = { ...merged, count }        // count carried on the group object
 */
const DELETE_MARKER = null;
function resolveCanonGroup(entry, enemiesById, bossesById, encKey, idx) {
  const ref = entry.ref;
  const base = enemiesById[ref] ?? bossesById[ref];
  if (!base) {
    fail(`encounter "${encKey}" enemy[${idx}] ref "${ref}" not found in enemies.json or bosses.json`);
  }
  const ov = entry.overrides || {};
  const merged = { ...base, ...ov };
  // DELETE_MARKER: an inline encounter variant that OMITS a key its shared-id
  // base defines. A JS spread cannot remove a key, so the canonical override
  // carries an explicit null marker; resolving it removes the key, making the
  // resolved object a byte-exact match for the legacy literal.
  for (const k of Object.keys(ov)) {
    if (ov[k] === DELETE_MARKER) delete merged[k];
  }
  // `count` lives on the legacy group literal; carry it identically.
  merged.count = entry.count;
  return merged;
}

/* ---------- main ---------- */

async function main() {
  if (!fs.existsSync(LEGACY_MAPDATA)) {
    fail(`legacy source missing: ${path.relative(GAME_ROOT, LEGACY_MAPDATA)}`);
  }

  // Canonical files may not exist yet (sibling agent emits them) — fail
  // gracefully with an actionable message rather than a stack trace.
  requireCanonFile(CANON_ENCOUNTERS, 'encounters.json');
  requireCanonFile(CANON_ENEMIES, 'entities/enemies.json');
  requireCanonFile(CANON_BOSSES, 'entities/bosses.json');

  // --- LEGACY ---
  const legacy = await import(pathToFileURL(LEGACY_MAPDATA).href);
  const L_ENCOUNTERS = legacy.ENCOUNTERS || {};
  const L_HIDDEN = legacy.HIDDEN_BOSS_ENCOUNTERS || {};
  // One unified legacy map keyed exactly like the canonical encounters file.
  const legacyAll = { ...L_ENCOUNTERS, ...L_HIDDEN };

  // --- CANON ---
  const canonEnc = readJson(CANON_ENCOUNTERS, 'encounters.json');
  const canonEnemiesDoc = readJson(CANON_ENEMIES, 'entities/enemies.json');
  const canonBossesDoc = readJson(CANON_BOSSES, 'entities/bosses.json');
  const enemiesById = canonEnemiesDoc.entities || canonEnemiesDoc;
  const bossesById = canonBossesDoc.entities || canonBossesDoc;
  const canonEncMap = canonEnc.encounters || canonEnc;

  const legacyKeys = Object.keys(legacyAll).sort();
  const canonKeys = Object.keys(canonEncMap).sort();

  const diffs = [];

  // Encounter-key set parity.
  const onlyLegacy = legacyKeys.filter((k) => !(k in canonEncMap));
  const onlyCanon = canonKeys.filter((k) => !(k in legacyAll));
  for (const k of onlyLegacy) diffs.push({ path: `encounter "${k}"`, legacy: '<present>', canon: undefined, why: 'encounter missing from canonical encounters.json' });
  for (const k of onlyCanon) diffs.push({ path: `encounter "${k}"`, legacy: undefined, canon: '<present>', why: 'extra encounter in canonical encounters.json (not in legacy)' });

  let nEncounters = 0;
  let nInstances = 0;

  for (const key of legacyKeys) {
    if (!(key in canonEncMap)) continue; // already reported above
    nEncounters++;

    const lEnc = legacyAll[key];
    const cEnc = canonEncMap[key];

    // Encounter-level scalar fields that affect combat presentation/parity.
    for (const f of ['name', 'introText']) {
      if ((lEnc[f] ?? null) !== (cEnc[f] ?? null)) {
        diffs.push({
          path: `encounter "${key}".${f}`,
          legacy: lEnc[f], canon: cEnc[f], why: 'encounter field',
        });
      }
    }

    const lGroups = Array.isArray(lEnc.enemies) ? lEnc.enemies : [];
    const cEntries = Array.isArray(cEnc.enemies) ? cEnc.enemies : [];

    if (lGroups.length !== cEntries.length) {
      diffs.push({
        path: `encounter "${key}".enemies`,
        legacy: `${lGroups.length} groups`,
        canon: `${cEntries.length} groups`,
        why: 'enemy group count differs',
      });
      continue;
    }

    for (let i = 0; i < lGroups.length; i++) {
      const lGroup = lGroups[i];
      const cGroup = resolveCanonGroup(cEntries[i], enemiesById, bossesById, key, i);
      nInstances += (lGroup.count || 1);

      const before = diffs.length;
      diffValue(lGroup, cGroup, `encounter "${key}".enemies[${i}](${lGroup.id || cGroup.id || '?'})`, diffs);
      // If a same-index pair differs, annotate which legacy id we matched on
      // (helps when ordering itself is the bug).
      if (diffs.length > before && lGroup.id !== cGroup.id) {
        diffs.push({
          path: `encounter "${key}".enemies[${i}]`,
          legacy: `id=${lGroup.id}`,
          canon: `id=${cGroup.id}`,
          why: 'enemy id mismatch at same group index — ordering bug',
        });
      }
    }
  }

  /* ---------- report ---------- */

  if (diffs.length === 0) {
    console.log(GRN(`PARITY OK: ${nEncounters} encounters, ${nInstances} enemy instances, 0 diffs`));
    process.exit(0);
  }

  console.error(RED(`PARITY FAIL: ${diffs.length} diff(s) across ${nEncounters} encounters`));
  console.error('');
  for (const d of diffs) {
    console.error(RED('  ✗ ') + d.path);
    console.error('      ' + DIM('legacy:') + ' ' + safe(d.legacy));
    console.error('      ' + DIM('canon :') + ' ' + safe(d.canon));
    console.error('      ' + DIM('why   :') + ' ' + d.why);
  }
  console.error('');
  console.error(RED(`PARITY FAIL: ${diffs.length} diff(s) — canonical JSON does NOT resolve byte-identical to legacy mapData.js`));
  process.exit(1);
}

function safe(v) {
  if (v === undefined) return '<undefined>';
  try { return JSON.stringify(v); } catch { return String(v); }
}

main().catch((e) => {
  console.error(RED('PARITY FAIL') + ' — unexpected error:');
  console.error(e && e.stack ? e.stack : String(e));
  process.exit(1);
});
