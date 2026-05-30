#!/usr/bin/env node
/**
 * generate-storyteller-portraits.cjs — M518b
 *
 * Orchestrates generation of one 512x768 portrait per storyteller (6 total)
 * via scripts/openai-portrait-gen.py. Runs sequentially with retry-once-on-
 * failure. Cost estimate: ~$0.40–0.50/image × 6 = ~$2.40–3.00.
 *
 * Usage:
 *   node scripts/generate-storyteller-portraits.cjs
 *   node scripts/generate-storyteller-portraits.cjs --dry-run
 *   node scripts/generate-storyteller-portraits.cjs --id chronicler
 *
 * Each generated portrait lands at:
 *   public/images/openai_v2/storyteller_<id>_portrait.png
 *
 * All 6 are enrolled in the open image-review batch (M462 mandatory rule).
 */
'use strict';

const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(__dirname, 'openai-portrait-gen.py');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const ONLY_ID = (() => {
  const i = args.indexOf('--id');
  return i >= 0 ? args[i + 1] : null;
})();

// ---------------------------------------------------------------------------
// Storyteller portrait descriptors — one per storyteller.
// These descriptors are intentionally narrow: single character, transparent-
// friendly pose, clear silhouette. Style is governed by the Emberveil preset
// baked into openai-portrait-gen.py.
// ---------------------------------------------------------------------------
const STORYTELLERS = [
  {
    id:    'storyteller_chronicler',
    title: 'The Chronicler',
    desc:  'A calm, scholarly figure in neutral grey-brown robes, holding a quill in one hand and a leather-bound tome in the other. Intelligent eyes, slightly disheveled hair, ink stains on their fingers. No armor, no weapon — this is a keeper of records, not a warrior. Posed in a composed, thoughtful 3/4 stance, mid-chest book open.',
  },
  {
    id:    'storyteller_ash_prophet',
    title: 'The Ash Prophet',
    desc:  'An ominous hooded figure in dark flowing robes with ash-grey streaks and faint ember-glow trim. Ash smeared across their gaunt face and hands. They gaze into the distance with unsettling intensity, one hand half-raised as though delivering a dark portent. The hood casts their upper face in shadow. No weapon — just dread presence and grey cloth.',
  },
  {
    id:    'storyteller_warbringer',
    title: 'The Warbringer',
    desc:  'A scarred, battle-worn warrior in dented plate armor with a deep red sash. Old wounds and campaign grime visible across their face and armor. They stand with confident, aggressive authority — weapon (a heavy sword or axe) resting at their side, not raised. Broad shouldered, imposing, the look of a commander who has won many battles and lost a few.',
  },
  {
    id:    'storyteller_trickster',
    title: 'The Trickster',
    desc:  'A masked figure in vibrant mismatched clothing — layers of richly colored fabric, asymmetric flair, one sleeve purple and one gold. They wear a stylized half-mask (jester or harlequin style) that hides one eye. Their pose is dynamic and playful, one hand gesturing dramatically, a sly grin visible below the mask edge. Colorful, chaotic, but undeniably stylish.',
  },
  {
    id:    'storyteller_pilgrim',
    title: 'The Pilgrim',
    desc:  'A weathered traveler in a simple earth-tone cloak, worn by long journeys. They carry a gnarled walking staff in one hand and a small lantern in the other, its flame warm amber. Their expression is contemplative, peaceful — a person who has seen much and accepted it. Roads and dust of countless miles seem baked into their garments. No armor.',
  },
  {
    id:    'storyteller_iron_judge',
    title: 'The Iron Judge',
    desc:  'A stern, hooded figure in ceremonial dark armor engraved with scales-of-justice motifs. They stand rigid and unbending, arms folded or a sword grounded blade-down before them. Their expression is utterly cold and unforgiving — the face of a magistrate who has never granted clemency. Rich dark iron color palette with silver accents. Weight and authority in every line.',
  },
];

function log(msg) {
  process.stdout.write(`[gen-portraits] ${msg}\n`);
}

function runPortraitGen(storyteller) {
  const pythonArgs = [
    SCRIPT,
    storyteller.id,
    '--desc', storyteller.desc,
    '--style', 'emberveil',
    '--category', 'storyteller',
  ];
  if (DRY_RUN) pythonArgs.push('--dry-run');

  log(`generating: ${storyteller.id} (${storyteller.title})`);
  if (DRY_RUN) {
    log(`  DRY RUN — would call: python3 ${pythonArgs.join(' ').slice(0, 80)}…`);
    return true;
  }
  try {
    execFileSync('python3', pythonArgs, {
      stdio: 'inherit',
      cwd: ROOT,
    });
    return true;
  } catch (err) {
    log(`  ERROR: ${err.message}`);
    return false;
  }
}

async function main() {
  if (!fs.existsSync(SCRIPT)) {
    log(`ERROR: portrait script not found at ${SCRIPT}`);
    process.exit(1);
  }

  const targets = ONLY_ID
    ? STORYTELLERS.filter(s => s.id === ONLY_ID || s.id === `storyteller_${ONLY_ID}`)
    : STORYTELLERS;

  if (ONLY_ID && !targets.length) {
    log(`ERROR: no storyteller found with id "${ONLY_ID}". Valid: ${STORYTELLERS.map(s => s.id).join(', ')}`);
    process.exit(1);
  }

  log(`generating ${targets.length} storyteller portrait(s)${DRY_RUN ? ' [DRY RUN]' : ''}…`);

  const failed = [];
  for (const storyteller of targets) {
    let ok = runPortraitGen(storyteller);
    if (!ok) {
      log(`  retrying ${storyteller.id} once…`);
      // Wait 5 seconds before retry (rate-limit buffer).
      if (!DRY_RUN) await new Promise(r => setTimeout(r, 5000));
      ok = runPortraitGen(storyteller);
      if (!ok) {
        failed.push(storyteller.id);
        log(`  FAILED after retry: ${storyteller.id}`);
      }
    }
    // Brief pause between calls to avoid rate limits.
    if (!DRY_RUN && targets.indexOf(storyteller) < targets.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  log('');
  log(`done. ${targets.length - failed.length}/${targets.length} portraits generated.`);
  if (failed.length) {
    log(`FAILED: ${failed.join(', ')}`);
    log('Re-run with --id <id> to retry individual portraits.');
    process.exit(1);
  }
}

main().catch(err => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
