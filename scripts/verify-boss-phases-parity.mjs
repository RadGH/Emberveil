#!/usr/bin/env node
/**
 * scripts/verify-boss-phases-parity.mjs — Phase 2 step 7 gate.
 *
 * Proves the canonical boss-phases.json resolved through dataLoader.js is
 * deep-equal to the legacy inline literals:
 *   - BOSS_PHASES        (was src/game/bossPhases.js)
 *   - BOSS_DEATH_DIALOG  (was src/game/bossDeathDialog.js)
 *
 * The inline literals have been deleted, so the "legacy" side is taken from a
 * frozen snapshot embedded here (captured byte-for-byte from the pre-deletion
 * literals) so the gate keeps proving parity against the original values
 * forever. Deep-equal is order-insensitive on object keys (no consumer
 * depends on object key insertion order), but the phases[] array order
 * (descending hpThreshold — load-bearing) is preserved verbatim and IS
 * checked because arrays are NOT sorted by sortKeysDeep.
 *
 * Exit 0 on full parity; exit 1 with a readable diff on any mismatch.
 *
 * Usage: node scripts/verify-boss-phases-parity.mjs
 */

import { fileURLToPath } from 'node:url';
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

// ── Frozen legacy snapshot (captured byte-for-byte from the pre-deletion
//    inline literals: bossPhases.js BOSS_PHASES + bossDeathDialog.js
//    BOSS_DEATH_DIALOG). Deep-equal is order-insensitive on object keys, so
//    this is the authoritative legacy ref; phases[] array order is checked. ──
const LEGACY_BOSS_PHASES = {
  grax_veil_touched: {
    phases: [
      { hpThreshold: 0.60, name: 'Veil-Rent', onEnter: 'Grax tears the Veil open around himself — the air tastes like copper and rot.', addSpells: ['acolyte_curse'], addStatuses: [{ type: 'fury', duration: 99, power: 12 }] },
      { hpThreshold: 0.25, name: 'Last Breath', onEnter: 'Grax howls with borrowed power — something inside him tears free!', swapSpells: ['lich_soul_shatter', 'lich_drain_life', 'acolyte_curse'], addStatuses: [{ type: 'fury', duration: 99, power: 24 }] },
    ],
  },
  lava_titan: {
    phases: [
      { hpThreshold: 0.65, name: 'Molten Core', onEnter: 'Cracks split the Titan\'s hide — magma pours from within. The ground beneath blisters.', addSpells: ['titan_magma_wave'], addStatuses: [{ type: 'burn', duration: 99, power: 6 }] },
      { hpThreshold: 0.30, name: 'Pyroclastic Fury', onEnter: 'The Titan erupts — superheated shards of stone scatter across the field!', swapSpells: ['titan_magma_wave', 'imp_fireball', 'titan_magma_wave'], addStatuses: [{ type: 'fury', duration: 99, power: 20 }] },
    ],
  },
  archfiend_malgrath: {
    phases: [
      { hpThreshold: 0.65, name: 'Hellfire Unleashed', onEnter: 'Malgrath throws back his head and laughs — then his form ignites. True demonic fire.', addSpells: ['imp_fireball', 'titan_magma_wave'], addStatuses: [{ type: 'burn', duration: 99, power: 8 }] },
      { hpThreshold: 0.30, name: 'Demonic Ascendance', onEnter: 'Wings of pure hellfire tear from Malgrath\'s back. "None of you leave this pit alive."', swapSpells: ['imp_fireball', 'titan_magma_wave', 'acolyte_curse', 'lich_drain_life'], addStatuses: [{ type: 'fury', duration: 99, power: 30 }, { type: 'bleed', duration: 3, power: 12 }] },
    ],
  },
  emberveil_sovereign: {
    phases: [
      { hpThreshold: 0.66, name: 'Veil Ascendant', onEnter: 'The Sovereign spreads arms wide — the Emberveil itself floods through the chamber.', addSpells: ['sovereign_voidstorm'], addStatuses: [{ type: 'fury', duration: 99, power: 15 }] },
      { hpThreshold: 0.33, name: 'Sovereign Unbound', onEnter: 'Flesh burns away, leaving a silhouette of pure Emberveil. "I am the Veil. The Veil does not fall."', swapSpells: ['sovereign_voidstorm', 'lich_drain_life', 'acolyte_curse', 'sovereign_voidstorm'], addStatuses: [{ type: 'fury', duration: 99, power: 35 }, { type: 'poison', duration: 3, power: 14 }] },
    ],
  },
  the_unraveler: {
    phases: [
      { hpThreshold: 0.65, name: 'Reality Fraying', onEnter: 'The Unraveler laughs without a mouth. Threads of reality unravel around it.', addSpells: ['wraith_chill', 'lich_drain_life'], addStatuses: [{ type: 'poison', duration: 99, power: 10 }] },
      { hpThreshold: 0.30, name: 'The Hunger Made Manifest', onEnter: 'IT SEES YOU. Not your face — your entire existence, threadbare and ready to dissolve.', swapSpells: ['sovereign_voidstorm', 'lich_soul_shatter', 'lich_drain_life', 'wraith_chill'], addStatuses: [{ type: 'fury', duration: 99, power: 40 }, { type: 'weaken', duration: 99, power: 25 }] },
    ],
  },
  dragon_king: {
    phases: [
      { hpThreshold: 0.66, name: 'First Flame Rising', onEnter: 'Bahamorth\'s scales ignite. Every breath now is an inferno. "You still breathe. Remarkable."', addSpells: ['imp_fireball', 'titan_magma_wave'], addStatuses: [{ type: 'burn', duration: 99, power: 10 }] },
      { hpThreshold: 0.33, name: 'The World Ends With Me', onEnter: 'Bahamorth rears back and the mountain trembles. The sky outside goes dark with ash.', swapSpells: ['titan_magma_wave', 'imp_fireball', 'titan_magma_wave', 'sovereign_voidstorm'], addStatuses: [{ type: 'fury', duration: 99, power: 50 }, { type: 'burn', duration: 99, power: 18 }] },
    ],
  },
};

const LEGACY_BOSS_DEATH_DIALOG = {
  grax_veil_touched: { bossLine: '"The Veil... will not... be held back forever..."', heroLine: '"Rest now, Grax. The Breach dies with you."', narratorLine: 'A tremor runs through the air. The Veil holds — for now.' },
  lava_titan: { bossLine: '"You... quench what cannot be quenched..."', heroLine: '"Then let the wastes cool."', narratorLine: 'Magma hardens around the titan\'s husk. Steam fills the caldera.' },
  archfiend_malgrath: { bossLine: '"Hell does not forget. Hell will send another."', heroLine: '"Let hell try."', narratorLine: 'The breach seals with a sound like a door slamming in the void.' },
  emberveil_sovereign: { bossLine: '"I am the Veil. The Veil... is everywhere..."', heroLine: '"Then we will fight it everywhere."', narratorLine: 'The Veil shudders. A door opens.' },
  the_unraveler: { bossLine: '"You cannot destroy what was never whole."', heroLine: '"We didn\'t. We just put it back in the dark."', narratorLine: 'Threads of reality knit themselves closed. Something recedes.' },
  the_architect: { bossLine: '"I drew every outcome. In none of them... did I fall."', heroLine: '"Then you missed one."', narratorLine: 'Creation breathes. The blueprint crumbles to ash. It is over.' },
  dragon_king: { bossLine: '"A thousand years... and this is how... it ends?"', heroLine: '"Every king falls. Even the last one."', narratorLine: 'The mountain goes quiet. The dragon\'s fire fades from the sky.' },
  veil_stalker: { bossLine: '"You should not be here..."', heroLine: '"Neither should you."', narratorLine: 'The prologue ends. The real journey begins.' },
};

function sortKeysDeep(v) {
  if (Array.isArray(v)) return v.map(sortKeysDeep);   // arrays NOT reordered
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortKeysDeep(v[k]);
    return out;
  }
  return v;
}
const norm = (v) => JSON.stringify(sortKeysDeep(v));

const dataLoader   = await import(P('src/game/dataLoader.js'));
const bossPhasesMod = await import(P('src/game/bossPhases.js'));
const bossDeathMod  = await import(P('src/game/bossDeathDialog.js'));

const cases = [
  ['BOSS_PHASES (dataLoader.getBossPhases vs frozen legacy)', LEGACY_BOSS_PHASES, dataLoader.getBossPhases()],
  ['BOSS_PHASES (bossPhases.js export vs frozen legacy)', LEGACY_BOSS_PHASES, bossPhasesMod.BOSS_PHASES],
  ['BOSS_DEATH_DIALOG (dataLoader.getBossDeathDialog vs frozen legacy)', LEGACY_BOSS_DEATH_DIALOG, dataLoader.getBossDeathDialog()],
  ['BOSS_DEATH_DIALOG (bossDeathDialog.js export vs frozen legacy)', LEGACY_BOSS_DEATH_DIALOG, bossDeathMod.BOSS_DEATH_DIALOG],
];

let totalDiffs = 0;
for (const [label, legacy, resolved] of cases) {
  const a = norm(legacy);
  const b = norm(resolved);
  if (a === b) {
    console.log(GRN('  OK ') + label + ` — ${Object.keys(legacy).length} key(s), identical`);
    continue;
  }
  totalDiffs++;
  console.error(RED('  FAIL ') + label);
  const la = JSON.parse(a), lb = JSON.parse(b);
  const keys = new Set([...Object.keys(la), ...Object.keys(lb)]);
  for (const k of keys) {
    if (JSON.stringify(la[k]) !== JSON.stringify(lb[k])) {
      console.error('    key "' + k + '"');
      console.error('      legacy : ' + JSON.stringify(la[k]));
      console.error('      resolved: ' + JSON.stringify(lb[k]));
    }
  }
}

console.log('');
if (totalDiffs === 0) {
  console.log(GRN('BOSS-PHASES PARITY OK: 0 diffs (BOSS_PHASES + BOSS_DEATH_DIALOG byte-identical to legacy literals).'));
  process.exit(0);
} else {
  console.error(RED(`BOSS-PHASES PARITY FAIL: ${totalDiffs} case(s) differ.`));
  process.exit(1);
}
