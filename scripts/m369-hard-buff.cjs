#!/usr/bin/env node
/**
 * m369-hard-buff.cjs — One-shot rebalance: "hard mode" enemy buff.
 *
 * Multiplies enemy HP and damage in src/maps/mapData.js:
 *   - Regular enemies: HP × 4.0, damage × 2.0
 *   - Boss enemies:    HP × 7.0, damage × 2.0
 *
 * Strategy: locate the innermost { ... } block enclosing every `hp: <num>`
 * occurrence, and rewrite hp/maxHp/dmg numerics within that block only.
 * isBoss decision is keyed on the block's id/name field.
 *
 * Idempotent guard: refuses to run if the file already contains the
 * sentinel comment at the top.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const SENTINEL = '// M369-HARD-BUFF-APPLIED';

const BOSS_IDS = new Set([
  'goblin_warlord',
  'grax_veil_touched',
  'veilspawn_herald',
  'lava_titan',
  'archfiend_malgrath',
  'emberveil_sovereign',
  'the_unraveler',
  'the_architect',
  'ancient_dragon',
  'dragon_king',
  'vault_guardian',
  'void_scholar',
  'echo_sovereign',
  'the_first_ember',
]);

const BOSS_NAMES = new Set([
  'Veil High Priest',
]);

const HP_MULT_REG = 4.0;
const HP_MULT_BOSS = 7.0;
const DMG_MULT = 2.0;

/**
 * Given full source `src` and an offset `pos`, find the innermost `{...}`
 * enclosing pos. Returns [openIdx, closeIdx] or null.
 */
function findEnclosingBraces(src, pos) {
  // Walk backward to find candidate opens
  let depth = 0;
  let openIdx = -1;
  for (let k = pos - 1; k >= 0; k--) {
    const ch = src[k];
    if (ch === '}') depth++;
    else if (ch === '{') {
      if (depth === 0) { openIdx = k; break; }
      depth--;
    }
  }
  if (openIdx < 0) return null;
  // Walk forward from openIdx to find matching close, properly handling strings.
  let d = 0, inStr = null, esc = false;
  for (let k = openIdx; k < src.length; k++) {
    const ch = src[k];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { inStr = ch; continue; }
    if (ch === '{') d++;
    else if (ch === '}') {
      d--;
      if (d === 0) return [openIdx, k];
    }
  }
  return null;
}

function main() {
  const file = path.join(__dirname, '..', 'src/maps/mapData.js');
  let src = fs.readFileSync(file, 'utf8');
  if (src.startsWith(SENTINEL)) {
    console.error('Refusing to run: M369 buff already applied (sentinel present).');
    process.exit(1);
  }

  // Collect all hp: <num> match positions
  const hpRx = /\bhp\s*:\s*\d+/g;
  const positions = [];
  let m;
  while ((m = hpRx.exec(src)) !== null) positions.push(m.index);

  // Resolve each to its enclosing block. Dedup by openIdx.
  const blocks = new Map(); // openIdx -> [openIdx, closeIdx]
  for (const p of positions) {
    const range = findEnclosingBraces(src, p);
    if (!range) continue;
    blocks.set(range[0], range);
  }

  // Sort blocks by openIdx descending so edits don't disturb earlier offsets.
  const sorted = [...blocks.values()].sort((a, b) => b[0] - a[0]);

  let buffed = 0, bossesBuffed = 0;
  for (const [open, close] of sorted) {
    const block = src.slice(open + 1, close); // inner content
    const idM = block.match(/\bid\s*:\s*['"]([^'"]+)['"]/);
    const nameM = block.match(/\bname\s*:\s*['"]([^'"]+)['"]/);
    const id = idM ? idM[1] : null;
    const name = nameM ? nameM[1] : null;
    const isBoss = (id && BOSS_IDS.has(id)) || (name && BOSS_NAMES.has(name));
    const hpMult = isBoss ? HP_MULT_BOSS : HP_MULT_REG;

    let newBlock = block;
    newBlock = newBlock.replace(/\b(hp|maxHp)\s*:\s*(\d+)/g, (_, k, v) => `${k}: ${Math.round(+v * hpMult)}`);
    newBlock = newBlock.replace(/\b(dmg|dmgRange|damage)\s*:\s*\[\s*(\d+)\s*,\s*(\d+)\s*\]/g, (_, k, lo, hi) => `${k}: [${Math.round(+lo * DMG_MULT)}, ${Math.round(+hi * DMG_MULT)}]`);

    if (newBlock !== block) {
      src = src.slice(0, open + 1) + newBlock + src.slice(close);
      buffed++;
      if (isBoss) bossesBuffed++;
    }
  }

  const finalSrc = SENTINEL + ' ' + new Date().toISOString() + '\n' + src;
  fs.writeFileSync(file, finalSrc);
  console.log(`buffed ${buffed} enemy blocks (${bossesBuffed} boss-tier, ${buffed - bossesBuffed} regular)`);
}

main();
