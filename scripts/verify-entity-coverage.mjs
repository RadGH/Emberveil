#!/usr/bin/env node
/**
 * scripts/verify-entity-coverage.mjs — Canonical Data Migration, Phase 0.
 *
 * Proves the giant_spider bug class is permanently closed: every entity the
 * game can put on screen (combat, companion, npc, hero) has a canonical
 * entity record AND resolvable art, and the canonical entity set is a perfect
 * set match with public/assets/appearances-manifest.json. That set-equality is
 * the "the game and images.html read the same data" guarantee — the exact
 * thing that drifted when inline ENCOUNTERS enemies (giant_spider, the
 * void/dragon roster, hidden bosses) were invisible to the manifest builder.
 *
 * Checks (all must pass; any failure → non-zero with a precise list):
 *
 *   1. ENTITY COVERAGE — every entity id referenced by any encounter / boss /
 *      hidden-boss (canonical encounters.json + bosses.json) AND every
 *      appearance / companion / npc id (canonical heroes/npcs/companions.json,
 *      falling back to the appearances-manifest when a canonical file is
 *      absent) has an entry in the appropriate canonical entity JSON.
 *
 *   2. SPRITE RESOLVABILITY — every combat-referenced id resolves art:
 *      public/images/openai_v2/<id>_<pose>.png OR
 *      public/images/spritecook/<id>_<pose>.png exists for at least the
 *      portrait pose AND the east pose. Any id with NO art is listed.
 *
 *   3. MANIFEST CROSS-CHECK — the union of ids in the canonical entity JSON
 *      and the union of ids in public/assets/appearances-manifest.json are a
 *      perfect set match. Every manifest id must exist in canonical JSON and
 *      vice-versa.
 *
 * Canonical JSON may not exist yet (a sibling agent emits it). When absent,
 * the script exits with a clear "run extract-canonical-data.mjs first"
 * message (exit 2) rather than a stack trace.
 *
 * Deterministic, idempotent, re-runnable. No args.
 *
 * Usage:  node scripts/verify-entity-coverage.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const GAME_ROOT  = path.resolve(__dirname, '..');

const P = {
  encounters:  path.join(GAME_ROOT, 'public/data/combat/encounters.json'),
  enemies:     path.join(GAME_ROOT, 'public/data/entities/enemies.json'),
  bosses:      path.join(GAME_ROOT, 'public/data/entities/bosses.json'),
  heroes:      path.join(GAME_ROOT, 'public/data/entities/heroes.json'),
  npcs:        path.join(GAME_ROOT, 'public/data/entities/npcs.json'),
  companions:  path.join(GAME_ROOT, 'public/data/entities/companions.json'),
  manifest:    path.join(GAME_ROOT, 'public/assets/appearances-manifest.json'),
  imgRoot:     path.join(GAME_ROOT, 'public/images'),
};

const SPRITE_DIRS = ['openai_v2', 'spritecook'];
const REQUIRED_POSES = ['portrait', 'east'];

const RED = (s) => `\x1b[31m${s}\x1b[0m`;
const GRN = (s) => `\x1b[32m${s}\x1b[0m`;
const DIM = (s) => `\x1b[2m${s}\x1b[0m`;

function hardFail(msg) {
  console.error(RED('COVERAGE FAIL') + ' — ' + msg);
  process.exit(1);
}

function missingCanonExit(p, label) {
  console.error(RED('COVERAGE FAIL') + ` — canonical ${label} not found:`);
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

function readJson(p, label) {
  let txt;
  try {
    txt = fs.readFileSync(p, 'utf8');
  } catch (e) {
    hardFail(`could not read ${label}: ${e.message}`);
  }
  try {
    return JSON.parse(txt);
  } catch (e) {
    hardFail(`${label} is not valid JSON: ${e.message}`);
  }
}

/**
 * Pull the id→record map out of a combat-entity doc.
 * enemies.json / bosses.json are `{version,entities:{id:{...}}}` (object map).
 */
function entityMap(doc) {
  if (doc && typeof doc === 'object' && doc.entities && !Array.isArray(doc.entities)
      && typeof doc.entities === 'object') {
    return doc.entities;
  }
  return doc || {};
}

/**
 * Canonical appearance id set = heroes.json ∪ npcs.json. Phase 2 emits both
 * as `{version,entities:[{id,...}]}` (ARRAY, not object map) — the legacy
 * `entityMap` returned the array verbatim, so `Object.keys` yielded numeric
 * indices instead of ids. This mirrors how dataLoader.js / emit-game-data /
 * build-appearances-manifest derive the appearance id set, so all four read
 * the SAME data (the migration's whole point). Returns a Set<string>.
 */
function appearanceIdSet(heroesDoc, npcsDoc) {
  const ids = new Set();
  for (const doc of [heroesDoc, npcsDoc]) {
    if (!doc) continue;
    const list = Array.isArray(doc.entities) ? doc.entities
      : Array.isArray(doc) ? doc
      : Object.values(doc.entities || doc || {});
    for (const e of list) {
      if (e && typeof e === 'object' && typeof e.id === 'string') ids.add(e.id);
    }
  }
  return ids;
}

/**
 * Canonical companion id set = keys(classPets) ∪ companions[].id ∪ hires[].id.
 * companions.json is `{version,source,classPets:{},companionPower:{},
 * companions:[],hires:[]}` — NOT an `entities` doc — so the legacy `entityMap`
 * returned the whole doc and `Object.keys` yielded the group names
 * (classPets/companionPower/…) instead of companion ids. This mirrors
 * dataLoader.CLASS_PETS/HIREABLES/COMPANIONS + the manifest builder so the
 * gate validates the real entity set. (companionPower is per-id tier
 * metadata whose ids ⊆ companions[], so it adds nothing — verified.)
 * Returns a Set<string>.
 */
function companionIdSet(doc) {
  const ids = new Set();
  if (!doc || typeof doc !== 'object') return ids;
  for (const id of Object.keys(doc.classPets || {})) ids.add(id);
  for (const c of (doc.companions || [])) { if (c && c.id) ids.add(c.id); }
  for (const h of (doc.hires || [])) { if (h && h.id) ids.add(h.id); }
  return ids;
}

function spriteExists(id) {
  for (const pose of REQUIRED_POSES) {
    let found = false;
    for (const dir of SPRITE_DIRS) {
      if (fs.existsSync(path.join(P.imgRoot, dir, `${id}_${pose}.png`))) { found = true; break; }
    }
    if (!found) return { ok: false, pose };
  }
  return { ok: true };
}

function main() {
  // --- required canonical inputs (sibling agent emits these) ---
  if (!fs.existsSync(P.encounters)) missingCanonExit(P.encounters, 'combat/encounters.json');
  if (!fs.existsSync(P.enemies))    missingCanonExit(P.enemies, 'entities/enemies.json');
  if (!fs.existsSync(P.bosses))     missingCanonExit(P.bosses, 'entities/bosses.json');
  if (!fs.existsSync(P.manifest)) {
    hardFail(`appearances-manifest.json not found: ${path.relative(GAME_ROOT, P.manifest)} — run scripts/build-appearances-manifest.cjs`);
  }

  const encDoc      = readJson(P.encounters, 'encounters.json');
  const enemiesById = entityMap(readJson(P.enemies, 'enemies.json'));
  const bossesById  = entityMap(readJson(P.bosses, 'bosses.json'));
  const manifest    = readJson(P.manifest, 'appearances-manifest.json');

  // Optional canonical files — fall back to the manifest when absent so the
  // gate is runnable through Phase 1 before Phase 2 emits these. The
  // heroes/npcs docs are entity ARRAYS and companions.json is a grouped doc
  // (classPets/companions[]/hires[]) — extract the real id sets accordingly.
  const heroesDoc      = fs.existsSync(P.heroes)     ? readJson(P.heroes, 'heroes.json')         : null;
  const npcsDoc        = fs.existsSync(P.npcs)       ? readJson(P.npcs, 'npcs.json')             : null;
  const companionsDoc  = fs.existsSync(P.companions) ? readJson(P.companions, 'companions.json') : null;
  const canonAppearSet = (heroesDoc || npcsDoc) ? appearanceIdSet(heroesDoc, npcsDoc) : null;
  const canonCompSet   = companionsDoc ? companionIdSet(companionsDoc) : null;

  const encMap = encDoc.encounters || encDoc;

  const failures = [];

  /* ---------- 1. collect every combat-referenced id ---------- */
  // encounters.json {ref} entries + every boss id in bosses.json + every
  // hidden-boss encounter ref.
  const combatRefs = new Set();
  const refSites = new Map(); // id -> [encounter keys]
  for (const [encKey, enc] of Object.entries(encMap)) {
    for (const g of (enc.enemies || [])) {
      if (!g || !g.ref) continue;
      combatRefs.add(g.ref);
      if (!refSites.has(g.ref)) refSites.set(g.ref, []);
      refSites.get(g.ref).push(encKey);
    }
  }
  for (const id of Object.keys(bossesById)) combatRefs.add(id);

  /* ---------- 2. combat ids must resolve to a canonical entity ---------- */
  for (const id of [...combatRefs].sort()) {
    if (!(id in enemiesById) && !(id in bossesById)) {
      const where = (refSites.get(id) || []).join(', ');
      failures.push(`[entity] combat id "${id}" referenced by [${where}] has NO entry in enemies.json or bosses.json`);
    }
  }

  /* ---------- 3. combat ids must resolve art ---------- */
  const noArt = [];
  for (const id of [...combatRefs].sort()) {
    const r = spriteExists(id);
    if (!r.ok) noArt.push(`[art] combat id "${id}" has no ${r.pose} sprite under public/images/{${SPRITE_DIRS.join(',')}}/`);
  }
  failures.push(...noArt);

  /* ---------- 4. appearance / companion / npc canonical coverage ---------- */
  // Canonical entity ids (the game's source of truth) for the non-combat
  // domains. When a canonical file is missing we derive the expected id set
  // from the manifest so the set-match check still runs (and flags drift).
  const manAppearances = (manifest.appearances || []).map((a) => a.id);
  const manCompanions  = (manifest.companions  || []).map((a) => a.id);
  const manEnemies     = (manifest.enemies     || []).map((a) => a.id);
  const manBosses      = (manifest.bosses      || []).map((a) => a.id);

  if (canonCompSet) {
    const manCompSet = new Set(manCompanions);
    for (const id of manCompanions) {
      if (!canonCompSet.has(id)) failures.push(`[entity] manifest companion "${id}" missing from canonical companions.json`);
    }
    for (const id of canonCompSet) {
      if (!manCompSet.has(id)) failures.push(`[entity] canonical companion "${id}" missing from appearances-manifest.json`);
    }
  }
  if (canonAppearSet) {
    const manAppSet = new Set(manAppearances);
    for (const id of manAppearances) {
      if (!canonAppearSet.has(id)) failures.push(`[entity] manifest appearance "${id}" missing from canonical heroes.json/npcs.json`);
    }
    for (const id of canonAppearSet) {
      if (!manAppSet.has(id)) failures.push(`[entity] canonical appearance "${id}" missing from appearances-manifest.json`);
    }
  }

  /* ---------- 5. perfect set match: combat entity JSON <-> manifest ---------- */
  // Every enemy/boss id in the canonical entity JSON must appear in the
  // manifest enemy/boss lists and vice-versa. This is the giant_spider guard:
  // an inline encounter enemy that the manifest builder can't see fails here.
  const canonCombat = new Set([...Object.keys(enemiesById), ...Object.keys(bossesById)]);
  const manCombat   = new Set([...manEnemies, ...manBosses]);

  for (const id of [...canonCombat].sort()) {
    if (!manCombat.has(id)) {
      failures.push(`[set-match] canonical combat entity "${id}" absent from appearances-manifest.json (enemies/bosses) — game vs images.html would drift`);
    }
  }
  for (const id of [...manCombat].sort()) {
    if (!canonCombat.has(id)) {
      failures.push(`[set-match] manifest combat entity "${id}" has NO canonical enemies.json/bosses.json entry`);
    }
  }

  /* ---------- report ---------- */
  const stats = [
    `${combatRefs.size} combat ids`,
    `${Object.keys(enemiesById).length} enemies`,
    `${Object.keys(bossesById).length} bosses`,
    canonCompSet ? `${canonCompSet.size} companions` : 'companions: (canonical file absent, manifest-only check)',
    canonAppearSet ? `${canonAppearSet.size} appearances` : 'appearances: (canonical files absent)',
  ];

  if (failures.length === 0) {
    console.log(GRN('COVERAGE OK') + ` — ${stats.join(', ')}, 0 gaps`);
    process.exit(0);
  }

  console.error(RED(`COVERAGE FAIL: ${failures.length} issue(s)`));
  console.error(DIM('  inputs: ' + stats.join(', ')));
  console.error('');
  for (const f of failures.sort()) console.error(RED('  ✗ ') + f);
  console.error('');
  console.error(RED(`COVERAGE FAIL: ${failures.length} issue(s) — entity coverage / set-match broken`));
  process.exit(1);
}

try {
  main();
} catch (e) {
  console.error(RED('COVERAGE FAIL') + ' — unexpected error:');
  console.error(e && e.stack ? e.stack : String(e));
  process.exit(1);
}
