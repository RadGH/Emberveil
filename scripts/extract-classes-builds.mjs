#!/usr/bin/env node
/**
 * scripts/extract-classes-builds.mjs — ONE-SHOT canonical extractor
 * (classes + build presets), part of the M496+ canonical-data migration.
 *
 * Serializes the LIVE running values of:
 *   - the base CLASSES literal (pre-mutation: WITHOUT the `unlockRequirement`
 *     and `tags` keys that classes.js attaches via post-definition loops —
 *     those stay computed in classes.js, NOT in the JSON)
 *   - the CLASS_TAGS data const (sibling pure-data map)
 *   - the BUILDS data map (per-class build presets)
 *
 * Output:
 *   public/data/classes.json        { version, source, classes:[...], classTags:{...} }
 *   public/data/build-presets.json  { version, source, builds:{ classId:[...] } }
 *
 * Run once to seed the canonical files; the byte-parity gate
 * (scripts/verify-builds-classes-parity.mjs) is the ongoing guard.
 *
 * Usage: node scripts/extract-classes-builds.mjs
 */
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const GAME_ROOT  = path.resolve(__dirname, '..');
const P = (rel) => new URL(path.join(GAME_ROOT, rel).replace(/\\/g, '/'), 'file:///').href;

// Browser shims so module graph loads in Node.
globalThis.window = undefined;
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const classesMod = await import(P('src/game/classes.js'));
const buildsMod  = await import(P('src/game/buildPresets.js'));

// classes.js mutates each CLASSES entry post-definition with two derived keys
// (`unlockRequirement` from classUnlocks.js, `tags` from CLASS_TAGS). Those
// are recomputed in classes.js from the canonical data, so the JSON holds the
// PRE-mutation base literal only.
const DERIVED_KEYS = ['unlockRequirement', 'tags'];
const baseClasses = classesMod.CLASSES.map((c) => {
  const out = {};
  for (const k of Object.keys(c)) {
    if (DERIVED_KEYS.includes(k)) continue;
    out[k] = c[k];
  }
  return out;
});

const classesDoc = {
  version: 1,
  source: 'src/game/classes.js (CLASSES base literal + CLASS_TAGS)',
  classes: baseClasses,
  classTags: classesMod.CLASS_TAGS,
};

const buildsDoc = {
  version: 1,
  source: 'src/game/buildPresets.js (BUILDS)',
  builds: buildsMod.BUILDS,
};

writeFileSync(
  path.join(GAME_ROOT, 'public/data/classes.json'),
  JSON.stringify(classesDoc, null, 2) + '\n'
);
writeFileSync(
  path.join(GAME_ROOT, 'public/data/build-presets.json'),
  JSON.stringify(buildsDoc, null, 2) + '\n'
);

console.log(`Wrote public/data/classes.json — ${baseClasses.length} classes, ${Object.keys(classesMod.CLASS_TAGS).length} tag maps`);
console.log(`Wrote public/data/build-presets.json — ${Object.keys(buildsMod.BUILDS).length} class build sets`);
