#!/usr/bin/env node
/**
 * generate-story-npc-sprites.cjs — M-S21
 *
 * Generates 9-pose sprite sheets for the 20 story NPCs from
 * data/story/npcs.json using the existing openai-spritesheet-gen.py pipeline.
 *
 * Each NPC is processed sequentially with retry-once-on-failure.
 * Sprites are written to public/images/openai_v2/<id>_<pose>.png
 * and enrolled in the open image-review-v2 batch (M462 mandatory rule).
 *
 * Usage:
 *   node scripts/generate-story-npc-sprites.cjs [--dry-run] [--id <id>]
 */

'use strict';

const fs          = require('fs');
const path        = require('path');
const { execSync } = require('child_process');

const ROOT    = path.resolve(__dirname, '..');
const NPC_FILE = path.join(ROOT, 'data', 'story', 'npcs.json');
const SCRIPT  = path.join(ROOT, 'scripts', 'openai-spritesheet-gen.py');

const npcs = JSON.parse(fs.readFileSync(NPC_FILE, 'utf8'));

// Map archetype to --kind flag for the sprite generator
function getKind(archetype) {
  if (!archetype) return 'humanoid';
  const a = archetype.toLowerCase();
  if (a.includes('elemental') && a.includes('construct')) return 'construct';
  if (a.includes('elemental')) return 'elemental';
  if (a.includes('construct')) return 'construct';
  return 'humanoid';
}

// Map archetype to --spell flag for casters
function getSpellColor(archetype) {
  if (!archetype) return '';
  const a = archetype.toLowerCase();
  if (a.includes('mage')) return 'projecting a swirling purple arcane sigil from an open palm';
  if (a.includes('caster')) return 'channeling red ember-veil energy from outstretched hands';
  if (a.includes('priest')) return 'channeling a golden healing radiance from both hands';
  if (a.includes('monk')) return 'projecting a yellow-gold radiant stone-blessing from wraps';
  if (a.includes('rogue')) return 'flicking a sickly green poison cloud from one hand';
  if (a.includes('ranger')) return 'firing a precise glowing arrow of focused energy';
  return '';
}

// Build character description from NPC bio
function buildDesc(npc) {
  // Trim the bio to ~200 chars + key visual cues from voiceNotes
  const bioSnippet = npc.bio ? npc.bio.slice(0, 200) : npc.fullName;
  return bioSnippet;
}

// Check if sprite already exists
function spriteExists(id) {
  const outDir = path.join(ROOT, 'public', 'images', 'openai_v2');
  const portraitPath = path.join(outDir, `${id}_portrait.png`);
  return fs.existsSync(portraitPath);
}

function runSprite(npc, dryRun) {
  const kind = getKind(npc.archetype);
  const desc = buildDesc(npc);
  const spellDesc = getSpellColor(npc.archetype);

  const args = [
    'python3', SCRIPT,
    npc.id,
    '--desc', desc,
    '--kind', kind,
  ];

  if (spellDesc) {
    args.push('--spell', spellDesc);
  }

  const cmd = args.map(a => {
    // Shell-quote args containing spaces or special chars
    if (typeof a === 'string' && /[ "'\\]/.test(a)) {
      return `'${a.replace(/'/g, "'\\''")}'`;
    }
    return a;
  }).join(' ');

  console.log(`\n[${npc.id}] ${npc.fullName} (${npc.archetype}) kind=${kind}`);
  console.log(`  cmd: python3 scripts/openai-spritesheet-gen.py ${npc.id} --kind ${kind}`);

  if (dryRun) {
    console.log('  DRY RUN — would call OpenAI');
    return true;
  }

  try {
    execSync(cmd, {
      stdio: 'inherit',
      cwd: ROOT,
      timeout: 300000,
    });
    console.log(`  [OK] ${npc.id}`);
    return true;
  } catch (e) {
    console.error(`  [FAIL] ${npc.id}: ${e.message?.slice(0, 200)}`);
    return false;
  }
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const idFilter = args.includes('--id') ? args[args.indexOf('--id') + 1] : null;
  const skipExisting = !args.includes('--force');

  const targets = idFilter ? npcs.filter(n => n.id === idFilter) : npcs;

  console.log(`M-S21: Generating ${targets.length} NPC sprite sheets`);
  console.log(`Script: ${SCRIPT}`);
  if (skipExisting) console.log('Skipping existing sprites (use --force to regenerate)');
  if (dryRun) console.log('DRY RUN — no API calls');

  const results = { ok: [], failed: [], skipped: [] };

  for (const npc of targets) {
    if (skipExisting && spriteExists(npc.id)) {
      console.log(`\n[${npc.id}] already exists — skipping`);
      results.skipped.push(npc.id);
      continue;
    }

    const ok = runSprite(npc, dryRun);

    if (!ok && !dryRun) {
      console.log(`  Retrying ${npc.id} once...`);
      const retryOk = runSprite(npc, dryRun);
      if (retryOk) {
        results.ok.push(npc.id);
      } else {
        results.failed.push(npc.id);
      }
    } else {
      if (ok) results.ok.push(npc.id);
      else results.failed.push(npc.id);
    }
  }

  console.log('\n== NPC Sprite Generation Summary ==');
  console.log(`  OK:      ${results.ok.length} — ${results.ok.join(', ')}`);
  console.log(`  Failed:  ${results.failed.length}${results.failed.length ? ' — ' + results.failed.join(', ') : ''}`);
  console.log(`  Skipped: ${results.skipped.length}`);

  if (results.failed.length > 0) {
    console.log('\nFailed IDs (for resume):');
    results.failed.forEach(id => console.log(`  ${id}`));
    process.exit(1);
  }
}

main();
