#!/usr/bin/env node
/**
 * ONE-SHOT: freeze the pre-deletion legacy snapshot for the
 * classes/build-presets parity gate. Captures the FULLY-RESOLVED exported
 * values (CLASSES is post-mutation: includes the `unlockRequirement` + `tags`
 * keys classes.js attaches), so the gate keeps proving parity against the
 * original values both before AND after the inline literals are deleted.
 *
 * Writes scripts/.classes-builds-legacy-snapshot.json — NEVER regenerate it.
 */
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const GAME_ROOT  = path.resolve(__dirname, '..');
const P = (rel) => new URL(path.join(GAME_ROOT, rel).replace(/\\/g, '/'), 'file:///').href;

globalThis.window = undefined;
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const classesMod = await import(P('src/game/classes.js'));
const buildsMod  = await import(P('src/game/buildPresets.js'));

const snapshot = {
  CLASSES: classesMod.CLASSES,        // post-mutation (unlockRequirement + tags attached)
  CLASS_TAGS: classesMod.CLASS_TAGS,
  BUILDS: buildsMod.BUILDS,
};

const dest = path.join(__dirname, '.classes-builds-legacy-snapshot.json');
writeFileSync(dest, JSON.stringify(snapshot, null, 2) + '\n');
console.log(`Froze legacy snapshot → ${dest}`);
console.log(`  CLASSES: ${snapshot.CLASSES.length}  CLASS_TAGS: ${Object.keys(snapshot.CLASS_TAGS).length}  BUILDS: ${Object.keys(snapshot.BUILDS).length}`);
