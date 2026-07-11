#!/usr/bin/env node
/**
 * generate-story-enemy-sprites.cjs — M-S21
 *
 * Generates 9-pose sprite sheets for the 20 story enemies/bosses from
 * data/story/enemies-story.json using the existing openai-spritesheet-gen.py
 * pipeline.
 *
 * Archetype → --kind mapping:
 *   humanoid/*           → humanoid
 *   beast/*              → beast
 *   elemental            → elemental
 *   elemental/construct  → construct (hybrid — baked-in armor suits construct best)
 *   construct/*          → construct
 *
 * Usage:
 *   node scripts/generate-story-enemy-sprites.cjs [--dry-run] [--id <id>]
 */

'use strict';

const fs           = require('fs');
const path         = require('path');
const { execSync } = require('child_process');

const ROOT        = path.resolve(__dirname, '..');
const ENEMY_FILE  = path.join(ROOT, 'data', 'story', 'enemies-story.json');
const SCRIPT      = path.join(ROOT, 'scripts', 'openai-spritesheet-gen.py');

const enemies = JSON.parse(fs.readFileSync(ENEMY_FILE, 'utf8'));

// Map archetype string to --kind flag
function getKind(archetype) {
  if (!archetype) return 'humanoid';
  const a = archetype.toLowerCase();
  // Order matters: most specific first
  if (a.includes('beast/quadruped') || a.includes('beast/avian') ||
      a.includes('beast/reptile') || a.includes('beast/boss') ||
      a === 'beast') return 'beast';
  if (a.includes('construct/elemental') || a.includes('elemental/construct')) return 'construct';
  if (a.includes('elemental')) return 'elemental';
  if (a.includes('construct')) return 'construct';
  // humanoid/* variants including undead, boss, caster, warrior
  return 'humanoid';
}

// Build enemy sprite description from the enemies-story.json description field
function buildDesc(enemy) {
  return enemy.description ? enemy.description.slice(0, 300) : enemy.name;
}

// Infer spell color from archetype/description
function getSpellDesc(enemy) {
  const a = (enemy.archetype || '').toLowerCase();
  const d = (enemy.description || '').toLowerCase();
  const id = (enemy.id || '').toLowerCase();

  // Caster types
  if (id === 'ash_ritualist')  return 'channeling red-ember Rift energy from outstretched arms';
  if (id === 'bog_witch')      return 'throwing a toxic green spore-cloud from one hand';
  if (id === 'veil_shade')     return 'projecting a purple-white shadow tendril from its core';
  if (id === 'veil_sprite')    return 'radiating purple-white Rift energy as a projected pulse';
  if (id === 'veil_hulk')      return 'projecting purple-white Rift energy from its absorbed core';
  if (id === 'plague_herald')  return 'hurling a weaponized green spore-canister from one arm';
  if (id === 'veil_champion')  return 'channeling purple-white Veil-flame through heavy gauntlets';
  if (id === 'corrupted_guardian') return 'projecting corrupted purple-veined stone energy from its fists';
  if (id === 'emberveil_sovereign_story') return 'channeling purple-white Rift light through the Crown artifact';
  if (id === 'corpse_lantern') return 'the chest lantern pulses with purple-white rift light';
  if (id === 'bone_revenant')  return 'the iron-wire binding flares with Veil energy';
  if (id === 'ash_golem')      return 'hurling a compressed ash-ball from an arm-stub';
  if (id === 'architect_fragment') return 'projecting a crystalline beam from its maintenance arm';

  return '';
}

// Check if sprite already exists
function spriteExists(id) {
  const outDir = path.join(ROOT, 'public', 'images', 'openai_v2');
  const portraitPath = path.join(outDir, `${id}_portrait.png`);
  return fs.existsSync(portraitPath);
}

function runSprite(enemy, dryRun) {
  const kind = getKind(enemy.archetype);
  const desc = buildDesc(enemy);
  const spellDesc = getSpellDesc(enemy);

  const cmdParts = [
    'python3', SCRIPT,
    enemy.id,
    '--desc', desc,
    '--kind', kind,
    '--no-south-reference',  // these are new characters with no prior art
  ];

  if (spellDesc) {
    cmdParts.push('--spell', spellDesc);
  }

  const cmd = cmdParts.map(a => {
    if (typeof a === 'string' && /[ "'\\]/.test(a)) {
      return `'${a.replace(/'/g, "'\\''")}'`;
    }
    return a;
  }).join(' ');

  console.log(`\n[${enemy.id}] ${enemy.name} (${enemy.archetype}) kind=${kind}`);

  if (dryRun) {
    console.log('  DRY RUN — would call OpenAI');
    console.log(`  desc: ${desc.slice(0, 120)}`);
    return true;
  }

  try {
    execSync(cmd, {
      stdio: 'inherit',
      cwd: ROOT,
      timeout: 300000,
    });
    console.log(`  [OK] ${enemy.id}`);
    return true;
  } catch (e) {
    console.error(`  [FAIL] ${enemy.id}: ${e.message?.slice(0, 200)}`);
    return false;
  }
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const idFilter = args.includes('--id') ? args[args.indexOf('--id') + 1] : null;
  const skipExisting = !args.includes('--force');

  const targets = idFilter ? enemies.filter(e => e.id === idFilter) : enemies;

  console.log(`M-S21: Generating ${targets.length} enemy/boss sprite sheets`);
  console.log(`Script: ${SCRIPT}`);
  if (skipExisting) console.log('Skipping existing sprites (use --force to regenerate)');
  if (dryRun) console.log('DRY RUN — no API calls');

  const results = { ok: [], failed: [], skipped: [] };

  for (const enemy of targets) {
    if (skipExisting && spriteExists(enemy.id)) {
      console.log(`\n[${enemy.id}] already exists — skipping`);
      results.skipped.push(enemy.id);
      continue;
    }

    const ok = runSprite(enemy, dryRun);

    if (!ok && !dryRun) {
      console.log(`  Retrying ${enemy.id} once...`);
      const retryOk = runSprite(enemy, dryRun);
      if (retryOk) {
        results.ok.push(enemy.id);
      } else {
        results.failed.push(enemy.id);
      }
    } else {
      if (ok) results.ok.push(enemy.id);
      else results.failed.push(enemy.id);
    }
  }

  console.log('\n== Enemy/Boss Sprite Generation Summary ==');
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
