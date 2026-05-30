#!/usr/bin/env node
/**
 * scripts/verify-skills-parity.mjs — canonical-data migration gate (skills).
 *
 * Proves the canonical skills.json resolved through dataLoader.js is
 * deep-equal to the legacy inline SKILLS literal (was src/game/skills.js).
 *
 * The "legacy" side is a frozen byte-for-byte snapshot captured from the
 * pre-deletion SKILLS literal (scripts/.skills-legacy-snapshot.json). It is
 * NEVER regenerated — it is the authoritative reference forever, so the gate
 * keeps proving parity against the original values both BEFORE and AFTER the
 * inline literal is deleted from skills.js.
 *
 * Deep-equal is order-insensitive (keys sorted recursively), so JSON key
 * reordering is not a diff; any value/shape change IS.
 *
 * Exit 0 on full parity; exit 1 with a readable diff on any mismatch.
 *
 * Usage: node scripts/verify-skills-parity.mjs
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

// Minimal browser shims so dataLoader.js loads cleanly in Node.
globalThis.window = undefined;
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

// ── Frozen legacy snapshot — captured byte-for-byte from the pre-deletion
//    inline SKILLS literal in src/game/skills.js. Authoritative reference;
//    deep-equal is order-insensitive so this remains valid post-deletion. ──
const LEGACY_SKILLS = JSON.parse(
  readFileSync(path.join(__dirname, '.skills-legacy-snapshot.json'), 'utf8')
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
const skillsMod  = await import(P('src/game/skills.js'));

const cases = [
  ['SKILLS (dataLoader.SKILLS_CANONICAL vs frozen legacy)', LEGACY_SKILLS, dataLoader.SKILLS_CANONICAL],
  ['SKILLS (dataLoader.getSkills() vs frozen legacy)',      LEGACY_SKILLS, dataLoader.getSkills()],
  ['SKILLS (skills.js export vs frozen legacy)',            LEGACY_SKILLS, skillsMod.SKILLS],
];

let totalDiffs = 0;
for (const [label, legacy, resolved] of cases) {
  const a = norm(legacy);
  const b = norm(resolved);
  if (a === b) {
    console.log(GRN('  OK ') + label + ` — ${Object.keys(legacy).length} skill(s), identical`);
    continue;
  }
  totalDiffs++;
  console.error(RED('  FAIL ') + label);
  const la = JSON.parse(a), lb = JSON.parse(b);
  const keys = new Set([...Object.keys(la), ...Object.keys(lb)]);
  for (const k of keys) {
    if (JSON.stringify(la[k]) !== JSON.stringify(lb[k])) {
      console.error('    skill "' + k + '"');
      console.error('      legacy : ' + JSON.stringify(la[k]));
      console.error('      resolved: ' + JSON.stringify(lb[k]));
    }
  }
}

console.log('');
if (totalDiffs === 0) {
  console.log(GRN(`SKILLS PARITY OK: 0 diffs (${Object.keys(LEGACY_SKILLS).length} skills byte-identical to legacy literal).`));
  process.exit(0);
} else {
  console.error(RED(`SKILLS PARITY FAIL: ${totalDiffs} case(s) differ.`));
  process.exit(1);
}
